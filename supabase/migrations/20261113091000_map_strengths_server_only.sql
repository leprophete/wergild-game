-- Step 9 — map_strengths no longer callable from outside. The browser reads the map through
-- GET /api/map, which calls it with the server key; it no longer needs SECURITY DEFINER.
alter function public.map_strengths(bigint) security invoker;
revoke execute on function public.map_strengths(bigint) from public, anon, authenticated;
grant execute on function public.map_strengths(bigint) to service_role;
