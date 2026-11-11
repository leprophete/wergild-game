-- $WERGILD — Row Level Security & Realtime (SPEC.md, "Anti-triche et sécurité")
--
-- * RLS is enabled on every table.
-- * Public (anon + authenticated) READ only on the map and the rankings.
-- * The browser has NO write right at all: no INSERT/UPDATE/DELETE policy,
--   and the privileges are revoked as well. Every write goes through the
--   server API with the service key, which only exists server-side.
-- * There is no is_admin column: the admin wallet is a server env variable.

-- 1. RLS everywhere
alter table public.factions enable row level security;
alter table public.players enable row level security;
alter table public.seasons enable row level security;
alter table public.cells enable row level security;
alter table public.deployments enable row level security;
alter table public.balance_history enable row level security;
alter table public.score_ticks enable row level security;
alter table public.player_scores enable row level security;
alter table public.events enable row level security;
alter table public.auth_nonces enable row level security;

-- 2. No write privilege for browser roles, on anything (belt and braces)
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;
alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;

-- private tables: not even readable
revoke select on public.players, public.deployments, public.balance_history, public.auth_nonces
  from anon, authenticated;
revoke select on public.cell_strength from anon, authenticated;

-- 3. Public read: the map and the rankings
create policy "public read factions" on public.factions for select to anon, authenticated using (true);
create policy "public read seasons" on public.seasons for select to anon, authenticated using (true);
create policy "public read cells" on public.cells for select to anon, authenticated using (true);
create policy "public read events" on public.events for select to anon, authenticated using (true);
create policy "public read score_ticks" on public.score_ticks for select to anon, authenticated using (true);
create policy "public read player_scores" on public.player_scores for select to anon, authenticated using (true);

-- 4. Functions: only what the browser needs
revoke execute on function public.map_strengths(bigint) from public;
grant execute on function public.map_strengths(bigint) to anon, authenticated, service_role;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- 5. Realtime: the map updates without reloading
alter publication supabase_realtime add table public.cells, public.events, public.seasons, public.score_ticks;
