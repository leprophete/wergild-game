-- Rules 4 and 5 — game_action (deploy / withdraw / move). Run in the SQL editor or via the MCP:
-- the block ALWAYS ends with an exception, so nothing is written. Read each line: got vs expect.
do $$
declare
  log text := '';
  a text := 'RulesTestAxxxxxxxxxxxxxxxxxxxxxxxxxx'; -- Wretches
  b text := 'RulesTestBxxxxxxxxxxxxxxxxxxxxxxxxxx'; -- Goblins
  n text := 'RulesTestNxxxxxxxxxxxxxxxxxxxxxxxxxx'; -- no Banner
  s bigint; near public.cells; far public.cells; next_to public.cells; r record;
begin
  select id into s from public.seasons where status = 'active';
  insert into public.players (wallet, faction_id, force) values (a, 'wretches', 30000), (b, 'goblins', 1000), (n, null, 1000);

  -- a neutral cell touching Wretches land, one far from it, and a free neighbour of `near`
  select c.* into near from public.cells c
  where c.season_id = s and c.kind = 'normal' and c.owner_faction_id is null and c.base_faction_id is null
    and exists (select 1 from public.cells m where m.season_id = s and m.owner_faction_id = 'wretches' and abs(m.x - c.x) + abs(m.y - c.y) = 1)
    and exists (select 1 from public.cells o where o.season_id = s and o.kind = 'normal' and o.owner_faction_id is null
                and o.base_faction_id is null and abs(o.x - c.x) + abs(o.y - c.y) = 1)
  order by c.y, c.x limit 1;
  select c.* into far from public.cells c
  where c.season_id = s and c.kind = 'normal' and c.owner_faction_id is null
    and not exists (select 1 from public.cells m where m.season_id = s and m.owner_faction_id = 'wretches' and abs(m.x - c.x) + abs(m.y - c.y) <= 2)
  order by c.y, c.x limit 1;
  select c.* into next_to from public.cells c
  where c.season_id = s and c.kind = 'normal' and c.owner_faction_id is null and c.base_faction_id is null
    and abs(c.x - near.x) + abs(c.y - near.y) = 1
  order by c.y, c.x limit 1;
  log := log || format(E'\n    cells used: near=(%s,%s) far=(%s,%s) next_to=(%s,%s)', near.x, near.y, far.x, far.y, next_to.x, next_to.y);

  -- refusals (each in its own sub-block, rolled back on error)
  begin perform public.game_action(a, 'deploy', far.x, far.y, 100); log := log || E'\n 1 ALLOWED (bug)';
  exception when others then log := log || format(E'\n 1 deploy far from my land ............ %s (expect not_adjacent)', sqlerrm); end;
  begin perform public.game_action(a, 'deploy', 24::smallint, 2::smallint, 100); log := log || E'\n 2 ALLOWED (bug)';
  exception when others then log := log || format(E'\n 2 deploy on the river ............... %s (expect river)', sqlerrm); end;
  begin perform public.game_action(a, 'deploy', 14::smallint, 6::smallint, 100); log := log || E'\n 3 ALLOWED (bug)';
  exception when others then log := log || format(E'\n 3 deploy on the Goblin camp (14,6) .. %s (expect impregnable)', sqlerrm); end;
  begin perform public.game_action(n, 'deploy', near.x, near.y, 100); log := log || E'\n 4 ALLOWED (bug)';
  exception when others then log := log || format(E'\n 4 player without a Banner .......... %s (expect no_banner)', sqlerrm); end;
  begin perform public.game_action(a, 'deploy', near.x, near.y, 0); log := log || E'\n 5 ALLOWED (bug)';
  exception when others then log := log || format(E'\n 5 deploy 0 ......................... %s (expect invalid_amount)', sqlerrm); end;

  -- deploy, reserve, per-cell cap
  select * into r from public.game_action(a, 'deploy', near.x, near.y, 500);
  log := log || format(E'\n 6 deploy 500 next to my land ....... owner %s -> %s, reserve %s, wet %s min (expect none -> wretches, 29500, 60)',
    coalesce(r.owner_before, 'none'), r.owner_after, r.reserve, round(extract(epoch from r.locked_until - now()) / 60));
  begin perform public.game_action(a, 'deploy', near.x, near.y, 29501); log := log || E'\n 7 ALLOWED (bug)';
  exception when others then log := log || format(E'\n 7 deploy more than my reserve ....... %s (expect not_enough_reserve)', sqlerrm); end;
  begin perform public.game_action(a, 'deploy', near.x, near.y, 19501); log := log || E'\n 8 ALLOWED (bug)';
  exception when others then log := log || format(E'\n 8 500 + 19 501 on one cell ......... %s (expect cell_cap)', sqlerrm); end;
  select * into r from public.game_action(a, 'deploy', near.x, near.y, 19500);
  log := log || format(E'\n 9 500 + 19 500 = the cap exactly .... reserve %s (expect 10000)', r.reserve);

  -- cooldown ("wet ink")
  begin perform public.game_action(a, 'withdraw', near.x, near.y, 100); log := log || E'\n10 ALLOWED (bug)';
  exception when others then log := log || format(E'\n10 withdraw while the ink is wet .... %s (expect ink_still_wet)', sqlerrm); end;
  update public.deployments set locked_until = now() - interval '1 second' where wallet = a;
  select * into r from public.game_action(a, 'withdraw', near.x, near.y, 19700);
  log := log || format(E'\n11 withdraw 19 700 once dry ......... left %s, reserve %s (expect 300, 29700)',
    (select force from public.deployments where wallet = a and cell_id = near.id), r.reserve);
  begin perform public.game_action(a, 'withdraw', near.x, near.y, 301); log := log || E'\n12 ALLOWED (bug)';
  exception when others then log := log || format(E'\n12 withdraw more than I have there .. %s (expect not_enough_here)', sqlerrm); end;

  -- rule 5: tie goes to the holder, then strictly more wins
  insert into public.deployments (wallet, cell_id, season_id, force) values (b, near.id, s, 300);
  perform public.recompute_cell(near.id);
  log := log || format(E'\n13 Goblins 300 vs Wretches 300 ...... owner %s, contested %s (expect wretches, true)',
    (select owner_faction_id from public.cells where id = near.id), (select contested from public.cells where id = near.id));
  update public.deployments set force = 301 where wallet = b and cell_id = near.id;
  perform public.recompute_cell(near.id);
  log := log || format(E'\n14 Goblins 301 vs Wretches 300 ...... owner %s (expect goblins)', (select owner_faction_id from public.cells where id = near.id));
  update public.deployments set force = 3000 where wallet = b and cell_id = near.id;
  perform public.recompute_cell(near.id);
  log := log || format(E'\n15 Goblins 3000 vs Wretches 300 ..... contested %s (expect false)', (select contested from public.cells where id = near.id));
  delete from public.deployments where wallet = b;
  perform public.recompute_cell(near.id);

  -- move in one action: from `near` to its free neighbour
  select * into r from public.game_action(a, 'move', near.x, near.y, 300, next_to.x, next_to.y);
  log := log || format(E'\n16 move 300 to the next cell ........ from %s -> %s, to %s -> %s (expect wretches -> none, none -> wretches)',
    coalesce(r.owner_before, 'none'), coalesce(r.owner_after, 'none'), coalesce(r.to_owner_before, 'none'), coalesce(r.to_owner_after, 'none'));
  begin perform public.game_action(a, 'move', next_to.x, next_to.y, 300, near.x, near.y); log := log || E'\n17 ALLOWED (bug)';
  exception when others then log := log || format(E'\n17 move again before the ink dries .. %s (expect ink_still_wet)', sqlerrm); end;

  -- The Rush lifts cooldowns
  insert into public.events (season_id, type, announced_at, starts_at, ends_at)
  values (s, 'rush', now() - interval '7 hours', now() - interval '1 minute', now() + interval '59 minutes');
  select * into r from public.game_action(a, 'withdraw', next_to.x, next_to.y, 300);
  log := log || format(E'\n18 withdraw during The Rush ......... ok, reserve %s (expect 30000)', r.reserve);

  raise exception 'ROLLBACK — results:%', log;
end $$;
