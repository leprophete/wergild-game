-- Step 9 — security hardening.
--
-- 1. Rate limiting (SPEC "Anti-triche": [30] actions per minute and per wallet), kept in
--    Postgres so it holds across every server instance: one atomic upsert per request.
-- 2. Default privileges: functions and tables created later in `public` are NOT executable /
--    readable by anon and authenticated unless granted on purpose (Supabase grants them by
--    default; every function so far was revoked by hand).
-- 3. Housekeeping: old rate-limit windows and expired sign-in nonces are purged hourly.

create table public.rate_limits (
  key text primary key check (length(key) between 3 and 120),
  window_start timestamptz not null,
  hits integer not null check (hits >= 0)
);
alter table public.rate_limits enable row level security; -- no policy: server only
revoke all on public.rate_limits from anon, authenticated;

-- true = allowed. Fixed window of p_window_seconds per key.
create function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start <= now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start <= now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning r.hits into v_hits;
  return v_hits <= p_limit;
end;
$$;
revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;

-- 2. secure defaults for whatever comes next
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- 3. housekeeping, every hour at :30
select cron.schedule(
  'wergild-housekeeping',
  '30 * * * *',
  $cron$
    delete from public.rate_limits where window_start < now() - interval '1 hour';
    delete from public.auth_nonces where expires_at < now() - interval '1 day';
  $cron$
);
