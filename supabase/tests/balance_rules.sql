-- Rules 1, 2, 6, 10 — apply_balance. Run in the SQL editor (or via the Supabase MCP):
-- everything happens in one block that ends with an exception, so NOTHING is written.
-- Read the result in the error message: each line shows the value and the expected one.
do $$
declare r record; log text := ''; w text := 'BalanceTestxxxxxxxxxxxxxxxxxxxxxxxxx';
  u numeric := 1000000000; -- 1 000 tokens × 10^6 decimals per soldier
  k numeric := 1000000;    -- 1 token in base units
  c1 bigint; c2 bigint;
begin
  insert into public.players (wallet, faction_id) values (w, 'wretches');
  select * into r from public.apply_balance(w, 100000 * k, u); log := log || format(E'\n1 buy 100k: soldiers=%s force=%s age=%s (expect 100, 100, 0)', r.soldiers, r.force, r.age_days);
  update public.players set age_updated_at = now() - interval '15 days' where wallet = w;
  select * into r from public.apply_balance(w, 100000 * k, u); log := log || format(E'\n2 +15 days: force=%s age=%s (expect 150, 15)', r.force, r.age_days);
  select * into r from public.apply_balance(w, 200000 * k, u); log := log || format(E'\n3 buy +100k: soldiers=%s force=%s age=%s (expect 200, 250, 7.5)', r.soldiers, r.force, r.age_days);
  select id into c1 from public.cells c join public.seasons s on s.id = c.season_id and s.status = 'active' where c.x = 16 and c.y = 14;
  select id into c2 from public.cells c join public.seasons s on s.id = c.season_id and s.status = 'active' where c.x = 17 and c.y = 14;
  insert into public.deployments (wallet, cell_id, season_id, force)
    select w, c.id, c.season_id, v.f from public.cells c join (values (c1, 150), (c2, 100)) v(id, f) on v.id = c.id;
  perform public.recompute_cell(c1); perform public.recompute_cell(c2);
  log := log || format(E'\n4 deployed 150+100: owners=%s/%s (expect wretches/wretches)', (select owner_faction_id from public.cells where id=c1), (select owner_faction_id from public.cells where id=c2));
  select * into r from public.apply_balance(w, 100000 * k, u);
  log := log || format(E'\n5 sell half: force=%s deployed=%s reserve=%s trimmed=%s age=%s cells=%s/%s (expect 125, 125, 0, t, 7.5, 75/50)', r.force, r.deployed, r.reserve, r.trimmed, r.age_days,
    (select force from public.deployments where wallet=w and cell_id=c1), (select force from public.deployments where wallet=w and cell_id=c2));
  select * into r from public.apply_balance(w, 0, u);
  log := log || format(E'\n6 sell all: force=%s deployments=%s owners=%s/%s age=%s (expect 0, 0, none/none, 7.5)', r.force, (select count(*) from public.deployments where wallet=w),
    coalesce((select owner_faction_id from public.cells where id=c1),'none'), coalesce((select owner_faction_id from public.cells where id=c2),'none'), r.age_days);
  select * into r from public.apply_balance(w, 50000 * k, u); log := log || format(E'\n7 rebuy after selling all: force=%s age=%s (expect 50, 0)', r.force, r.age_days);
  update public.players set is_excluded = true where wallet = w;
  select * into r from public.apply_balance(w, 50000 * k, u); log := log || format(E'\n8 excluded wallet: force=%s (expect 0)', r.force);
  log := log || format(E'\n9 balance_history rows=%s (expect 5)', (select count(*) from public.balance_history where wallet = w));
  raise exception 'ROLLBACK — results:%', log;
end $$;
