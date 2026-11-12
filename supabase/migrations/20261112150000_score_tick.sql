-- Step 6 — the hourly score (rule 7). Runs inside the database, every full UTC hour (pg_cron).
--
-- score_tick(p_tick) scores the hour that just ended, [p_tick - 1 h, p_tick):
--  * each player counts with the LOWEST force observed during that hour (balance at the
--    start of the hour and every change inside it): buying just before the tick and selling
--    just after brings nothing;
--  * if that minimum is below what the player has deployed, all their deployments count
--    pro rata (as rule 6 would trim them);
--  * the owner of every cell is recomputed from these forces (strongest Banner, tie to the
--    current holder, base camps always to their Banner) — not taken from the live map;
--  * a cell is worth p_cell_points, a watchtower p_bonus_points, ×p_tithe_multiplier inside
--    a Tithe zone active at the start of the hour;
--  * a Banner's points on a cell are shared as Renown among its members on that cell, pro
--    rata to their force there.
-- Idempotent: an hour already scored is never scored twice.

create function public.score_tick(
  p_tick timestamptz,
  p_units_per_soldier numeric default 1000000000, -- 1 000 tokens × 10^6 (config/game.ts)
  p_veteran_days numeric default 30,
  p_cell_points integer default 1,
  p_bonus_points integer default 3,
  p_tithe_multiplier integer default 3
)
returns table (faction_id text, points bigint)
language plpgsql
set search_path = ''
as $$
declare
  v_hour timestamptz := date_trunc('hour', p_tick) - interval '1 hour';
  v_end timestamptz := date_trunc('hour', p_tick);
  v_season bigint;
begin
  select s.id into v_season from public.seasons s
  where s.status = 'active' and v_hour >= s.starts_at and v_hour < s.ends_at;
  if v_season is null then
    return;
  end if;

  -- already scored: return what was recorded, change nothing
  if exists (select 1 from public.score_ticks t where t.season_id = v_season and t.hour = v_hour) then
    return query select t.faction_id, t.points::bigint from public.score_ticks t
      where t.season_id = v_season and t.hour = v_hour order by t.faction_id;
    return;
  end if;

  drop table if exists wg_min, wg_eff, wg_cells;

  -- 1. lowest force of each player during the hour
  create temp table wg_min on commit drop as
  with bal as (
    select p.wallet, p.faction_id, p.is_excluded, p.age_days, p.age_updated_at,
      coalesce((select h.balance from public.balance_history h
                where h.wallet = p.wallet and h.observed_at <= v_hour
                order by h.observed_at desc limit 1), 0) as at_start,
      (select min(h.balance) from public.balance_history h
       where h.wallet = p.wallet and h.observed_at > v_hour and h.observed_at < v_end) as min_inside
    from public.players p
    where p.faction_id is not null
  )
  select b.wallet, b.faction_id,
    case when b.is_excluded then 0
    else floor(
      floor(least(b.at_start, coalesce(b.min_inside, b.at_start)) / p_units_per_soldier)
      * (1 + least(greatest(0, b.age_days + extract(epoch from (v_end - b.age_updated_at)) / 86400.0), p_veteran_days) / p_veteran_days)
    ) end::bigint as force_min,
    coalesce((select sum(d.force) from public.deployments d where d.wallet = b.wallet and d.season_id = v_season), 0)::bigint as deployed
  from bal b;

  -- 2. what each deployment is worth for this hour
  create temp table wg_eff on commit drop as
  select d.cell_id, m.wallet, m.faction_id,
    d.force * least(1, m.force_min::numeric / nullif(m.deployed, 0)) as force
  from public.deployments d
  join wg_min m on m.wallet = d.wallet
  where d.season_id = v_season and m.deployed > 0;

  -- 3. owner of every cell for this hour, and its points
  create temp table wg_cells on commit drop as
  with strength as (
    select e.cell_id, e.faction_id, sum(e.force) as force from wg_eff e where e.force > 0 group by e.cell_id, e.faction_id
  ),
  top as (
    select s.cell_id, max(s.force) as f1 from strength s group by s.cell_id
  ),
  leaders as (
    select s.cell_id, array_agg(s.faction_id) as tied
    from strength s join top t on t.cell_id = s.cell_id and s.force = t.f1
    group by s.cell_id
  )
  select c.id as cell_id,
    coalesce(
      c.base_faction_id,
      case
        when l.tied is null then null
        when array_length(l.tied, 1) = 1 then l.tied[1]
        when c.owner_faction_id = any (l.tied) then c.owner_faction_id
        else null
      end
    ) as owner,
    (case when c.kind = 'bonus' then p_bonus_points else p_cell_points end)
      * (case when exists (
           select 1 from public.events ev
           where ev.season_id = v_season and ev.type = 'tithe'
             and ev.starts_at <= v_hour and ev.ends_at > v_hour
             and c.x >= ev.zone_x and c.x < ev.zone_x + ev.zone_w
             and c.y >= ev.zone_y and c.y < ev.zone_y + ev.zone_h
         ) then p_tithe_multiplier else 1 end) as points
  from public.cells c
  left join leaders l on l.cell_id = c.id
  where c.season_id = v_season and c.kind <> 'blocked';

  -- 4. Banner points (one row per Banner, zero included)
  insert into public.score_ticks (season_id, faction_id, hour, points)
  select v_season, f.id, v_hour, coalesce(sum(wc.points), 0)
  from public.factions f
  left join wg_cells wc on wc.owner = f.id
  group by f.id;

  -- 5. Renown: each held cell's points shared among the holder's members on it
  insert into public.player_scores as ps (season_id, wallet, renown)
  select v_season, e.wallet, round(sum(wc.points * e.force / tot.force), 2)
  from wg_eff e
  join wg_cells wc on wc.cell_id = e.cell_id and wc.owner = e.faction_id
  join (select e2.cell_id, e2.faction_id, sum(e2.force) as force from wg_eff e2 group by e2.cell_id, e2.faction_id) tot
    on tot.cell_id = e.cell_id and tot.faction_id = e.faction_id and tot.force > 0
  where e.force > 0
  group by e.wallet
  on conflict (season_id, wallet) do update set renown = ps.renown + excluded.renown;

  return query select t.faction_id, t.points::bigint from public.score_ticks t
    where t.season_id = v_season and t.hour = v_hour order by t.faction_id;
end;
$$;

revoke execute on function public.score_tick(timestamptz, numeric, numeric, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.score_tick(timestamptz, numeric, numeric, integer, integer, integer) to service_role;

-- Every full UTC hour.
create extension if not exists pg_cron;
select cron.schedule('wergild-score-tick', '0 * * * *', $cron$select public.score_tick(now())$cron$);
