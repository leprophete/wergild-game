-- The Chronicles (redone): what the knell keeps, beyond the map and the scores.
--
-- * cells.flips counts every change of hands (recompute_cell): the most disputed cell;
-- * events.cleared_cells / returned_force record what the Plague took (apply_plague);
-- * season_archives.moments: three great moments computed at the knell —
--     most_disputed {x, y, flips, owner}, biggest_army {x, y, faction, force},
--     plague {x, y, w, h, cells, force, at} (null when there was none);
-- * season_players: every renowned player's Banner and rank in that season (server only),
--   for "Your chronicle".

alter table public.cells add column flips integer not null default 0 check (flips >= 0);
alter table public.events add column cleared_cells integer, add column returned_force bigint;
alter table public.season_archives add column moments jsonb not null default '{}'::jsonb;

create table public.season_players (
  season_id bigint not null references public.seasons (id) on delete cascade,
  wallet text not null references public.players (wallet) on delete cascade,
  faction_id text references public.factions (id),
  renown numeric(14, 2) not null,
  rank integer not null check (rank >= 1),
  primary key (season_id, wallet)
);
create index season_players_wallet_idx on public.season_players (wallet);
create index season_players_faction_idx on public.season_players (faction_id);
alter table public.season_players enable row level security; -- no policy: server only

create function public.archive_moments(p_season_id bigint)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'most_disputed', (
      select jsonb_build_object('x', c.x, 'y', c.y, 'flips', c.flips, 'owner', c.owner_faction_id)
      from public.cells c
      where c.season_id = p_season_id and c.flips > 0
      order by c.flips desc, c.id limit 1),
    'biggest_army', (
      select jsonb_build_object('x', c.x, 'y', c.y, 'faction', s.faction_id, 'force', s.force)
      from public.cell_strength s join public.cells c on c.id = s.cell_id
      where s.season_id = p_season_id
      order by s.force desc, c.id limit 1),
    'plague', (
      select jsonb_build_object('x', e.zone_x, 'y', e.zone_y, 'w', e.zone_w, 'h', e.zone_h,
                                'cells', coalesce(e.cleared_cells, 0), 'force', coalesce(e.returned_force, 0),
                                'at', e.starts_at)
      from public.events e
      where e.season_id = p_season_id and e.type = 'plague' and e.applied_at is not null
      order by e.starts_at limit 1)
  );
$$;

create or replace function public.recompute_cell(p_cell_id bigint)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_cell public.cells;
  v_f1 bigint;
  v_f2 bigint;
  v_tied text[];
  v_owner text;
begin
  select * into v_cell from public.cells where id = p_cell_id for update;
  if not found then
    return;
  end if;

  select coalesce(max(cs.force), 0) into v_f1 from public.cell_strength cs where cs.cell_id = p_cell_id;

  if v_f1 = 0 then
    v_owner := null;
    v_f2 := 0;
  else
    select array_agg(cs.faction_id) into v_tied
    from public.cell_strength cs where cs.cell_id = p_cell_id and cs.force = v_f1;

    if array_length(v_tied, 1) = 1 then
      v_owner := v_tied[1];
      select coalesce(max(cs.force), 0) into v_f2
      from public.cell_strength cs where cs.cell_id = p_cell_id and cs.force < v_f1;
    else
      v_owner := case when v_cell.owner_faction_id = any (v_tied) then v_cell.owner_faction_id end;
      v_f2 := v_f1;
    end if;
  end if;

  v_owner := coalesce(v_cell.base_faction_id, v_owner);
  update public.cells
  set owner_faction_id = v_owner,
      contested = v_f2 > 0 and (v_f1 - v_f2)::numeric / v_f1 < 0.10,
      -- the Chronicles' "most disputed cell": every change of hands is counted
      flips = flips + case when v_owner is distinct from v_cell.owner_faction_id then 1 else 0 end
  where id = p_cell_id;
end;
$$;

create or replace function public.apply_plague(p_event_id bigint)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_ev public.events;
  v_cell bigint;
  v_n integer := 0;
  v_cleared integer := 0;
begin
  select * into v_ev from public.events e
  where e.id = p_event_id and e.type = 'plague' and e.applied_at is null
  for update;
  if not found then
    return 0;
  end if;

  -- what the Plague takes, for the Chronicles: held cells turned neutral, soldiers sent home
  select count(*) into v_cleared from public.cells c
  where c.season_id = v_ev.season_id and c.base_faction_id is null and c.owner_faction_id is not null
    and c.x >= v_ev.zone_x and c.x < v_ev.zone_x + v_ev.zone_w
    and c.y >= v_ev.zone_y and c.y < v_ev.zone_y + v_ev.zone_h;

  create temp table wg_plague on commit drop as
  with gone as (
    delete from public.deployments d
    using public.cells c
    where c.id = d.cell_id and c.season_id = v_ev.season_id
      and c.x >= v_ev.zone_x and c.x < v_ev.zone_x + v_ev.zone_w
      and c.y >= v_ev.zone_y and c.y < v_ev.zone_y + v_ev.zone_h
    returning d.wallet, d.cell_id, d.force
  )
  select * from gone;

  -- every cell of the zone, with or without soldiers, is redrawn
  for v_cell in
    select c.id from public.cells c
    where c.season_id = v_ev.season_id and c.kind <> 'blocked'
      and c.x >= v_ev.zone_x and c.x < v_ev.zone_x + v_ev.zone_w
      and c.y >= v_ev.zone_y and c.y < v_ev.zone_y + v_ev.zone_h
  loop
    perform public.recompute_cell(v_cell);
    v_n := v_n + 1;
  end loop;

  update public.players p
  set reserve = greatest(0, p.force - coalesce(
    (select sum(d.force) from public.deployments d where d.wallet = p.wallet and d.season_id = v_ev.season_id), 0))
  where p.wallet in (select distinct g.wallet from wg_plague g);

  update public.events
  set applied_at = now(),
      cleared_cells = v_cleared,
      returned_force = (select coalesce(sum(g.force), 0) from wg_plague g)
  where id = p_event_id;
  drop table wg_plague;
  return v_n;
end;
$$;

create or replace function public.end_season(
  p_season_id bigint,
  p_early boolean default false,
  p_season_days integer default 14,
  p_top integer default 10
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_s public.seasons;
  v_winner text;
  v_next bigint;
  v_start timestamptz;
begin
  -- the knell and the hourly score never run at the same time
  perform pg_advisory_xact_lock(hashtext('wergild_score_tick'));

  select * into v_s from public.seasons s where s.id = p_season_id and s.status = 'active' for update;
  if not found then
    raise exception 'season_not_active';
  end if;
  if now() < v_s.ends_at and not p_early then
    raise exception 'season_not_over';
  end if;

  -- the last hour before the knell
  perform public.score_tick(least(v_s.ends_at, date_trunc('hour', now())));

  -- winner: most points over the whole season; tie → most cells held at the knell, then name
  select f.id into v_winner
  from public.factions f
  left join (select t.faction_id, sum(t.points) as pts from public.score_ticks t
             where t.season_id = v_s.id group by t.faction_id) sc on sc.faction_id = f.id
  left join (select c.owner_faction_id, count(*) as n from public.cells c
             where c.season_id = v_s.id group by c.owner_faction_id) cc on cc.owner_faction_id = f.id
  where coalesce(sc.pts, 0) > 0
  order by sc.pts desc, coalesce(cc.n, 0) desc, f.id
  limit 1;

  -- the Chronicles
  insert into public.season_archives (season_id, winner_faction_id, scores, cells, top)
  values (
    v_s.id,
    v_winner,
    (select jsonb_object_agg(f.id, coalesce((select sum(t.points) from public.score_ticks t
                                              where t.season_id = v_s.id and t.faction_id = f.id), 0))
     from public.factions f),
    coalesce((select jsonb_agg(jsonb_build_array(c.x, c.y, c.owner_faction_id) order by c.y, c.x)
              from public.cells c where c.season_id = v_s.id and c.owner_faction_id is not null), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('rank', r.rank, 'wallet', r.wallet, 'faction', r.faction_id,
                                                  'renown', r.renown) order by r.rank)
              from (select ps.wallet, p.faction_id, ps.renown,
                           row_number() over (order by ps.renown desc, ps.wallet) as rank
                    from public.player_scores ps join public.players p on p.wallet = ps.wallet
                    where ps.season_id = v_s.id and ps.renown > 0
                    order by ps.renown desc, ps.wallet limit p_top) r), '[]'::jsonb)
  );

  -- the great moments of the season, and every renowned player's line (before the reset)
  update public.season_archives set moments = public.archive_moments(v_s.id) where season_id = v_s.id;
  insert into public.season_players (season_id, wallet, faction_id, renown, rank)
  select v_s.id, ps.wallet, p.faction_id, ps.renown,
         rank() over (order by ps.renown desc)
  from public.player_scores ps join public.players p on p.wallet = ps.wallet
  where ps.season_id = v_s.id and ps.renown > 0;

  -- the top 10 are honoured for ever
  insert into public.badges (wallet, season_id, rank, faction_id, renown)
  select (e->>'wallet'), v_s.id, (e->>'rank')::smallint, (e->>'faction'), (e->>'renown')::numeric
  from public.season_archives a, jsonb_array_elements(a.top) e
  where a.season_id = v_s.id;

  update public.seasons set status = 'ended', winner_faction_id = v_winner where id = v_s.id;

  -- every soldier back to reserve; seniority is kept; a new Banner change is allowed
  delete from public.deployments d where d.season_id = v_s.id;
  update public.players p set reserve = p.force, faction_switches = 0
  where p.reserve <> p.force or p.faction_switches <> 0;

  -- the next season, on a fresh map, named after the winner. It keeps the Monday 17:00 rhythm.
  if not exists (select 1 from public.seasons s where s.status = 'scheduled') then
    v_start := v_s.ends_at;
    insert into public.seasons (number, name, starts_at, ends_at, status)
    values (
      (select max(s.number) + 1 from public.seasons s),
      public.next_season_name(v_winner),
      v_start,
      v_start + make_interval(days => p_season_days),
      case when v_start <= now() then 'active'::public.season_status else 'scheduled'::public.season_status end
    )
    returning id into v_next;
    perform public.copy_season_cells(v_s.id, v_next);
  end if;

  return v_winner;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.archive_moments(bigint)',
    'public.recompute_cell(bigint)',
    'public.apply_plague(bigint)',
    'public.end_season(bigint, boolean, integer, integer)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;
