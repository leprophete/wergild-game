-- The Chronicles — what the knell keeps: the three great moments (most disputed cell,
-- biggest army, the Plague's toll) and every renowned player's Banner and rank.
-- Runs in an isolated test season and ALWAYS ends with an exception, so nothing is written.
-- Read each line: got vs expect.
do $$
declare
  log text := '';
  h timestamptz := date_trunc('hour', now());
  s bigint;
  a text := 'ChronicleTestAxxxxxxxxxxxxxxxxxxxxx'; -- Goblins
  b text := 'ChronicleTestBxxxxxxxxxxxxxxxxxxxxx'; -- Knaves
  c1 bigint; c2 bigint; c3 bigint;
  m jsonb;
begin
  update public.seasons set status = 'ended' where status in ('active', 'scheduled');
  insert into public.seasons (number, name, starts_at, ends_at, status)
  values (997, 'Chronicle test', h - interval '14 days', h + interval '1 day', 'active') returning id into s;
  insert into public.cells (season_id, x, y, kind) values (s, 0, 0, 'normal') returning id into c1;
  insert into public.cells (season_id, x, y, kind) values (s, 1, 0, 'normal') returning id into c2;
  insert into public.cells (season_id, x, y, kind) values (s, 10, 10, 'normal') returning id into c3; -- in the Plague
  insert into public.players (wallet, faction_id, force, reserve) values (a, 'goblins', 1000, 1000), (b, 'knaves', 1000, 1000);

  -- cell 1 changes hands three times: nobody → Goblins → Knaves → Goblins
  insert into public.deployments (wallet, cell_id, season_id, force) values (a, c1, s, 300);
  perform public.recompute_cell(c1);
  insert into public.deployments (wallet, cell_id, season_id, force) values (b, c1, s, 400);
  perform public.recompute_cell(c1);
  update public.deployments set force = 500 where wallet = a and cell_id = c1;
  perform public.recompute_cell(c1);
  -- cell 2 once, cell 3 once
  insert into public.deployments (wallet, cell_id, season_id, force) values (a, c2, s, 100), (b, c3, s, 250);
  perform public.recompute_cell(c2);
  perform public.recompute_cell(c3);
  log := log || format(E'\n1 flips c1 %s, c2 %s, c3 %s; owner of c1 %s (expect 3, 1, 1, goblins)',
    (select flips from public.cells where id = c1), (select flips from public.cells where id = c2),
    (select flips from public.cells where id = c3), (select owner_faction_id from public.cells where id = c1));

  -- the Plague over cell 3: one held cell turned neutral, 250 soldiers sent home
  insert into public.events (season_id, type, zone_x, zone_y, zone_w, zone_h, announced_at, starts_at, ends_at)
  values (s, 'plague', 9, 9, 4, 4, h - interval '10 hours', h - interval '2 hours', h - interval '2 hours');
  perform public.season_tick(now());
  log := log || format(E'\n2 Plague: cleared %s, returned %s (expect 1, 250)',
    (select cleared_cells from public.events where season_id = s and type = 'plague'),
    (select returned_force from public.events where season_id = s and type = 'plague'));

  insert into public.player_scores (season_id, wallet, renown) values (s, a, 10), (s, b, 5);

  -- the knell
  update public.seasons set ends_at = h where id = s;
  perform public.season_tick(now());
  select moments into m from public.season_archives where season_id = s;
  log := log || format(E'\n3 most disputed %s (expect x 0, y 0, flips 3, owner goblins)', m->'most_disputed');
  log := log || format(E'\n4 biggest army %s (expect x 0, y 0, goblins, 500)', m->'biggest_army');
  log := log || format(E'\n5 plague %s (expect x 9, y 9, 4×4, cells 1, force 250)', m->'plague');
  log := log || format(E'\n6 season players: A %s, B %s (expect goblins rank 1, knaves rank 2)',
    (select faction_id || ' rank ' || rank from public.season_players where season_id = s and wallet = a),
    (select faction_id || ' rank ' || rank from public.season_players where season_id = s and wallet = b));
  log := log || format(E'\n7 next season cells start with flips %s (expect 0)',
    (select coalesce(max(flips), 0) from public.cells c join public.seasons x on x.id = c.season_id and x.status = 'active'));

  raise exception 'ROLLBACK — results:%', log;
end $$;
