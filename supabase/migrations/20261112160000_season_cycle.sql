-- Step 7 — the season cycle (rule 8), events (rule 9), the Chronicles and the admin tools.
-- Everything runs inside the database; the job `wergild-season` checks every minute:
--   * a Plague whose hour has come strikes its zone (cells neutral, soldiers back to reserve);
--   * at the knell (ends_at) the season is scored one last time, archived, its winner
--     embroidered, the top 10 badged, every soldier sent back to reserve, and the next
--     season opens on a fresh map named after the winner (seniority is kept);
--   * a scheduled season whose hour has come becomes active.
-- The Tithe (×3 points) is read by score_tick(); the Rush (no wet ink) by game_action().

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
alter table public.events add column applied_at timestamptz;

-- The Chronicles: one read-only page per finished season.
create table public.season_archives (
  season_id bigint primary key references public.seasons (id) on delete cascade,
  winner_faction_id text references public.factions (id),
  -- { "goblins": 1234, ... } — cumulated points of the season
  scores jsonb not null,
  -- [[x, y, "goblins"], ...] — owner of every held cell at the knell
  cells jsonb not null,
  -- [{ "rank": 1, "wallet": "...", "faction": "goblins", "renown": 12.5 }, ...]
  top jsonb not null,
  archived_at timestamptz not null default now()
);

-- Permanent badges: the top 10 Renown of each season (rule 8).
create table public.badges (
  wallet text not null references public.players (wallet) on delete cascade,
  season_id bigint not null references public.seasons (id) on delete cascade,
  rank smallint not null check (rank between 1 and 100),
  faction_id text references public.factions (id),
  renown numeric(14, 2) not null,
  primary key (wallet, season_id)
);
create index badges_season_idx on public.badges (season_id);
create index season_archives_winner_idx on public.season_archives (winner_faction_id);
create index badges_faction_idx on public.badges (faction_id);

alter table public.season_archives enable row level security;
alter table public.badges enable row level security;
create policy "public read season_archives" on public.season_archives for select to anon, authenticated using (true);
create policy "public read badges" on public.badges for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- score_tick: serialise it (the hourly job and the knell may both score the last hour)
-- ---------------------------------------------------------------------------
create or replace function public.score_tick_locked(p_tick timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('wergild_score_tick'));
  perform public.score_tick(p_tick);
end;
$$;
select cron.unschedule('wergild-score-tick');
select cron.schedule('wergild-score-tick', '0 * * * *', $cron$select public.score_tick_locked(now())$cron$);

-- ---------------------------------------------------------------------------
-- next_season_name — the winning Banner names the next season's map (rule 8)
-- ---------------------------------------------------------------------------
create function public.next_season_name(p_winner text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_winner
    when 'goblins' then 'The Goblins'' Hoard'
    when 'changelings' then 'The Changelings'' Mist'
    when 'knaves' then 'The Knaves'' Bargain'
    when 'unburied' then 'The Vigil of the Unburied'
    when 'wretches' then 'The Wretches'' Harvest'
    else 'The Unclaimed Lands'
  end;
$$;

-- ---------------------------------------------------------------------------
-- copy_season_cells — a fresh map: same layout, only the base camps held
-- ---------------------------------------------------------------------------
create function public.copy_season_cells(p_from bigint, p_to bigint)
returns void
language sql
set search_path = ''
as $$
  insert into public.cells (season_id, x, y, kind, base_faction_id, owner_faction_id)
  select p_to, c.x, c.y, c.kind, c.base_faction_id, c.base_faction_id
  from public.cells c where c.season_id = p_from;
$$;

-- ---------------------------------------------------------------------------
-- apply_plague — rule 9: the zone becomes neutral, its soldiers go back to reserve.
-- Base camps stay with their Banner (rule 4), but their soldiers flee too.
-- ---------------------------------------------------------------------------
create function public.apply_plague(p_event_id bigint)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_ev public.events;
  v_cell bigint;
  v_n integer := 0;
begin
  select * into v_ev from public.events e
  where e.id = p_event_id and e.type = 'plague' and e.applied_at is null
  for update;
  if not found then
    return 0;
  end if;

  create temp table wg_plague on commit drop as
  with gone as (
    delete from public.deployments d
    using public.cells c
    where c.id = d.cell_id and c.season_id = v_ev.season_id
      and c.x >= v_ev.zone_x and c.x < v_ev.zone_x + v_ev.zone_w
      and c.y >= v_ev.zone_y and c.y < v_ev.zone_y + v_ev.zone_h
    returning d.wallet, d.cell_id
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

  update public.events set applied_at = now() where id = p_event_id;
  drop table wg_plague;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- end_season — the knell (rule 8). Returns the winner (null if nobody scored).
-- p_early lets the admin ring it before ends_at (the hour in progress is not scored).
-- ---------------------------------------------------------------------------
create function public.end_season(
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

-- ---------------------------------------------------------------------------
-- season_tick — run every minute by pg_cron
-- ---------------------------------------------------------------------------
create function public.season_tick(p_now timestamptz default now())
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_ev bigint;
  v_s public.seasons;
  v_log text := '';
begin
  for v_ev in
    select e.id from public.events e
    join public.seasons s on s.id = e.season_id and s.status = 'active'
    where e.type = 'plague' and e.applied_at is null and e.starts_at <= p_now
    order by e.starts_at
  loop
    perform public.apply_plague(v_ev);
    v_log := v_log || format('plague %s; ', v_ev);
  end loop;

  select * into v_s from public.seasons s where s.status = 'active';
  if found and v_s.ends_at <= p_now then
    v_log := v_log || format('knell of season %s, winner %s; ', v_s.number,
                             coalesce(public.end_season(v_s.id), 'none'));
  end if;

  if not exists (select 1 from public.seasons s where s.status = 'active') then
    update public.seasons s set status = 'active'
    where s.id = (select s2.id from public.seasons s2
                  where s2.status = 'scheduled' and s2.starts_at <= p_now
                  order by s2.starts_at limit 1)
    returning * into v_s;
    if found then
      v_log := v_log || format('season %s begins; ', v_s.number);
    end if;
  end if;
  return nullif(v_log, '');
end;
$$;

select cron.schedule('wergild-season', '* * * * *', $cron$select public.season_tick(now())$cron$);

-- ---------------------------------------------------------------------------
-- Admin: seasons
-- ---------------------------------------------------------------------------
-- A new season can be planned only when none is running or planned; it opens on a
-- Monday 17:00 UTC (rule 8) on the layout of the last season (or Season 0's).
create function public.admin_create_season(
  p_name text,
  p_starts_at timestamptz,
  p_season_days integer default 14
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_id bigint;
  v_from bigint;
begin
  if exists (select 1 from public.seasons s where s.status in ('active', 'scheduled')) then
    raise exception 'season_exists';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 3 and 60 then
    raise exception 'invalid_name';
  end if;
  if extract(isodow from p_starts_at at time zone 'UTC') <> 1
     or p_starts_at <> date_trunc('day', p_starts_at at time zone 'UTC') at time zone 'UTC' + interval '17 hours' then
    raise exception 'not_monday_17_utc';
  end if;
  if p_starts_at < date_trunc('hour', now()) - interval '7 days' then
    raise exception 'start_in_the_past';
  end if;
  select s.id into v_from from public.seasons s order by s.number desc limit 1;
  if v_from is null then
    raise exception 'no_layout';
  end if;
  insert into public.seasons (number, name, starts_at, ends_at, status)
  values ((select max(s.number) + 1 from public.seasons s), trim(p_name), p_starts_at,
          p_starts_at + make_interval(days => p_season_days), 'scheduled')
  returning id into v_id;
  perform public.copy_season_cells(v_from, v_id);
  perform public.season_tick(now()); -- opens it at once if its hour has come
  return v_id;
end;
$$;

create function public.admin_rename_season(p_season_id bigint, p_name text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if length(trim(coalesce(p_name, ''))) not between 3 and 60 then
    raise exception 'invalid_name';
  end if;
  update public.seasons set name = trim(p_name) where id = p_season_id and status in ('active', 'scheduled');
  if not found then
    raise exception 'season_not_open';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: events (rule 9) — announced at least p_notice_hours ahead, on a full hour,
-- inside a running or planned season. Frequencies: Tithe 1 per UTC day, Plague 1 per
-- season, Rush 1 per week.
-- ---------------------------------------------------------------------------
create function public.admin_schedule_event(
  p_type public.event_type,
  p_x integer,
  p_y integer,
  p_starts_at timestamptz,
  p_notice_hours integer default 6,
  p_tithe_size integer default 3,
  p_tithe_hours integer default 24,
  p_plague_size integer default 4,
  p_rush_hours integer default 1,
  p_grid_w integer default 48,
  p_grid_h integer default 30
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_s public.seasons;
  v_size integer;
  v_end timestamptz;
  v_id bigint;
begin
  if p_starts_at <> date_trunc('hour', p_starts_at) then
    raise exception 'not_on_the_hour';
  end if;
  if p_starts_at < now() + make_interval(hours => p_notice_hours) then
    raise exception 'too_soon';
  end if;
  select * into v_s from public.seasons s
  where s.status in ('active', 'scheduled') and p_starts_at >= s.starts_at and p_starts_at < s.ends_at
  order by s.starts_at limit 1;
  if not found then
    raise exception 'outside_season';
  end if;

  v_size := case p_type when 'tithe' then p_tithe_size when 'plague' then p_plague_size else null end;
  v_end := case p_type
    when 'tithe' then p_starts_at + make_interval(hours => p_tithe_hours)
    when 'rush' then p_starts_at + make_interval(hours => p_rush_hours)
    else p_starts_at end;

  if v_size is not null and (p_x is null or p_y is null or p_x < 0 or p_y < 0
                             or p_x + v_size > p_grid_w or p_y + v_size > p_grid_h) then
    raise exception 'zone_off_map';
  end if;

  if p_type = 'tithe' and exists (
    select 1 from public.events e where e.season_id = v_s.id and e.type = 'tithe'
      and date_trunc('day', e.starts_at at time zone 'UTC') = date_trunc('day', p_starts_at at time zone 'UTC')
  ) then
    raise exception 'one_tithe_per_day';
  end if;
  if p_type = 'plague' and exists (select 1 from public.events e where e.season_id = v_s.id and e.type = 'plague') then
    raise exception 'one_plague_per_season';
  end if;
  if p_type = 'rush' and exists (
    select 1 from public.events e where e.season_id = v_s.id and e.type = 'rush'
      and date_trunc('week', e.starts_at at time zone 'UTC') = date_trunc('week', p_starts_at at time zone 'UTC')
  ) then
    raise exception 'one_rush_per_week';
  end if;

  insert into public.events (season_id, type, zone_x, zone_y, zone_w, zone_h, announced_at, starts_at, ends_at)
  values (v_s.id, p_type,
          case when v_size is null then null else p_x end,
          case when v_size is null then null else p_y end,
          v_size, v_size, now(), p_starts_at, v_end)
  returning id into v_id;
  return v_id;
end;
$$;

-- An event can be called off only before it begins.
create function public.admin_cancel_event(p_event_id bigint)
returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from public.events e where e.id = p_event_id and e.starts_at > now();
  if not found then
    raise exception 'event_started_or_unknown';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: excluded wallets (rule 10). Excluding sends the wallet's soldiers home
-- and takes its force away; the next balance read keeps it at zero.
-- ---------------------------------------------------------------------------
create function public.admin_set_excluded(p_wallet text, p_excluded boolean)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_cell bigint;
begin
  if length(coalesce(p_wallet, '')) not between 32 and 44 then
    raise exception 'invalid_wallet';
  end if;
  insert into public.players (wallet, is_excluded) values (p_wallet, p_excluded)
  on conflict (wallet) do update set is_excluded = excluded.is_excluded;
  if p_excluded then
    for v_cell in
      with gone as (delete from public.deployments d where d.wallet = p_wallet returning d.cell_id)
      select distinct gone.cell_id from gone
    loop
      perform public.recompute_cell(v_cell);
    end loop;
    update public.players set force = 0, reserve = 0 where wallet = p_wallet;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Server only
-- ---------------------------------------------------------------------------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.score_tick_locked(timestamptz)',
    'public.next_season_name(text)',
    'public.copy_season_cells(bigint, bigint)',
    'public.apply_plague(bigint)',
    'public.end_season(bigint, boolean, integer, integer)',
    'public.season_tick(timestamptz)',
    'public.admin_create_season(text, timestamptz, integer)',
    'public.admin_rename_season(bigint, text)',
    'public.admin_schedule_event(public.event_type, integer, integer, timestamptz, integer, integer, integer, integer, integer, integer, integer)',
    'public.admin_cancel_event(bigint)',
    'public.admin_set_excluded(text, boolean)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;
