-- $WERGILD — core schema (SPEC.md, "Modèle de données")
-- 10 tables. Force per cell and per Banner is never stored: it is derived from
-- deployments (view cell_strength). All times are UTC (timestamptz).

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.cell_kind as enum ('normal', 'bonus', 'bridge', 'blocked');
create type public.season_status as enum ('scheduled', 'active', 'ended');
create type public.event_type as enum ('tithe', 'plague', 'rush');

-- ---------------------------------------------------------------------------
-- factions — 5 fixed rows
-- ---------------------------------------------------------------------------
create table public.factions (
  id text primary key check (id in ('goblins', 'changelings', 'knaves', 'unburied', 'wretches')),
  name text not null unique,
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  base_x smallint not null,
  base_y smallint not null
);

-- ---------------------------------------------------------------------------
-- players — one row per connected wallet
-- ---------------------------------------------------------------------------
create table public.players (
  wallet text primary key check (length(wallet) between 32 and 44),
  faction_id text references public.factions (id),
  -- raw on-chain amount (token base units), read by RPC
  balance numeric(39, 0) not null default 0 check (balance >= 0),
  -- weighted seniority (rule 2), valid at age_updated_at; it keeps growing with time
  age_days numeric(12, 4) not null default 0 check (age_days >= 0),
  age_updated_at timestamptz not null default now(),
  force bigint not null default 0 check (force >= 0),
  reserve bigint not null default 0 check (reserve >= 0),
  faction_switches smallint not null default 0 check (faction_switches >= 0),
  is_excluded boolean not null default false,
  created_at timestamptz not null default now()
);
create index players_faction_idx on public.players (faction_id);

-- ---------------------------------------------------------------------------
-- seasons — only one active at a time
-- ---------------------------------------------------------------------------
create table public.seasons (
  id bigint generated always as identity primary key,
  number integer not null unique check (number >= 0),
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.season_status not null default 'scheduled',
  winner_faction_id text references public.factions (id),
  check (ends_at > starts_at)
);
create unique index seasons_one_active on public.seasons ((true)) where status = 'active';

-- ---------------------------------------------------------------------------
-- cells — 1 440 rows per season (48 × 30)
-- ---------------------------------------------------------------------------
create table public.cells (
  id bigint generated always as identity primary key,
  season_id bigint not null references public.seasons (id) on delete cascade,
  x smallint not null check (x >= 0 and x < 48),
  y smallint not null check (y >= 0 and y < 30),
  kind public.cell_kind not null default 'normal',
  -- 2×2 base camp handed to each Banner at the start of the season
  base_faction_id text references public.factions (id),
  owner_faction_id text references public.factions (id),
  contested boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (season_id, x, y),
  check (kind <> 'blocked' or (owner_faction_id is null and base_faction_id is null))
);
create index cells_season_idx on public.cells (season_id);
create index cells_owner_idx on public.cells (season_id, owner_faction_id);

-- ---------------------------------------------------------------------------
-- deployments — unique (wallet, cell_id)
-- ---------------------------------------------------------------------------
create table public.deployments (
  wallet text not null references public.players (wallet) on delete cascade,
  cell_id bigint not null references public.cells (id) on delete cascade,
  season_id bigint not null references public.seasons (id) on delete cascade,
  force bigint not null check (force > 0),
  locked_until timestamptz not null default now(),
  primary key (wallet, cell_id)
);
create index deployments_cell_idx on public.deployments (cell_id);
create index deployments_season_idx on public.deployments (season_id);

-- ---------------------------------------------------------------------------
-- balance_history — used for the hourly minimum force (rule 7)
-- ---------------------------------------------------------------------------
create table public.balance_history (
  id bigint generated always as identity primary key,
  wallet text not null references public.players (wallet) on delete cascade,
  balance numeric(39, 0) not null check (balance >= 0),
  observed_at timestamptz not null default now()
);
create index balance_history_wallet_time_idx on public.balance_history (wallet, observed_at desc);

-- ---------------------------------------------------------------------------
-- score_ticks — one row per Banner and per (UTC) hour
-- ---------------------------------------------------------------------------
create table public.score_ticks (
  season_id bigint not null references public.seasons (id) on delete cascade,
  faction_id text not null references public.factions (id),
  hour timestamptz not null check (date_trunc('hour', hour) = hour),
  points integer not null check (points >= 0),
  primary key (season_id, faction_id, hour)
);

-- ---------------------------------------------------------------------------
-- player_scores — individual Renown, updated every tick
-- ---------------------------------------------------------------------------
create table public.player_scores (
  season_id bigint not null references public.seasons (id) on delete cascade,
  wallet text not null references public.players (wallet) on delete cascade,
  renown numeric(14, 2) not null default 0 check (renown >= 0),
  primary key (season_id, wallet)
);
create index player_scores_rank_idx on public.player_scores (season_id, renown desc);

-- ---------------------------------------------------------------------------
-- events — scheduled from /admin, announced ≥ 6 h ahead (rule 9)
-- ---------------------------------------------------------------------------
create table public.events (
  id bigint generated always as identity primary key,
  season_id bigint not null references public.seasons (id) on delete cascade,
  type public.event_type not null,
  zone_x smallint,
  zone_y smallint,
  zone_w smallint,
  zone_h smallint,
  announced_at timestamptz not null default now(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  check (ends_at >= starts_at),
  check (starts_at >= announced_at),
  -- the Rush is map-wide; the Tithe and the Plague have a zone
  check (
    (type = 'rush' and zone_x is null and zone_y is null and zone_w is null and zone_h is null)
    or (type <> 'rush' and zone_x is not null and zone_y is not null and zone_w > 0 and zone_h > 0)
  )
);
create index events_season_idx on public.events (season_id, starts_at);

-- ---------------------------------------------------------------------------
-- auth_nonces — single use, valid 5 minutes (Sign-In With Solana)
-- ---------------------------------------------------------------------------
create table public.auth_nonces (
  nonce text primary key,
  wallet text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);
create index auth_nonces_expiry_idx on public.auth_nonces (expires_at);

-- ---------------------------------------------------------------------------
-- cell_strength — total force per cell and per Banner, derived from deployments.
-- security_invoker: callers only see what RLS lets them see on deployments/players
-- (i.e. nothing for the browser). The public map reads it through map_strengths().
-- ---------------------------------------------------------------------------
create view public.cell_strength
with (security_invoker = true) as
select d.cell_id, d.season_id, p.faction_id, sum(d.force)::bigint as force
from public.deployments d
join public.players p on p.wallet = d.wallet
where p.faction_id is not null
group by d.cell_id, d.season_id, p.faction_id;

-- Public, aggregated read of the map strengths (no wallet is exposed).
create function public.map_strengths(p_season_id bigint)
returns table (cell_id bigint, faction_id text, force bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select cs.cell_id, cs.faction_id, cs.force
  from public.cell_strength cs
  where cs.season_id = p_season_id;
$$;

-- keep cells.updated_at fresh: every game action touches the cell row,
-- which is what Realtime broadcasts to the browsers
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger cells_touch before update on public.cells
for each row execute function public.touch_updated_at();
