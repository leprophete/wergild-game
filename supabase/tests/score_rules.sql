-- Rule 7 — score_tick. Runs in an isolated test season and ALWAYS ends with an exception,
-- so nothing is written. Read each line: got vs expect.
do $$
declare
  log text := '';
  h timestamptz := date_trunc('hour', now());   -- the tick; the scored hour is [h - 1 h, h)
  u numeric := 1000000000;                       -- base units per soldier
  s bigint;
  a text := 'ScoreTestAxxxxxxxxxxxxxxxxxxxxxxxxxx'; -- Wretches: buys then sells inside the hour
  b text := 'ScoreTestBxxxxxxxxxxxxxxxxxxxxxxxxxx'; -- Goblins
  c text := 'ScoreTestCxxxxxxxxxxxxxxxxxxxxxxxxxx'; -- Wretches
  d text := 'ScoreTestDxxxxxxxxxxxxxxxxxxxxxxxxxx'; -- Goblins
  e text := 'ScoreTestExxxxxxxxxxxxxxxxxxxxxxxxxxx'; -- Knaves
  c1 bigint; c2 bigint; c3 bigint; c4 bigint;
  r record;
begin
  -- isolated season with five cells
  update public.seasons set status = 'ended' where status = 'active';
  insert into public.seasons (number, name, starts_at, ends_at, status)
  values (999, 'Score test', h - interval '3 hours', h + interval '1 day', 'active') returning id into s;
  insert into public.cells (season_id, x, y, kind) values (s, 0, 0, 'normal') returning id into c1;
  insert into public.cells (season_id, x, y, kind) values (s, 1, 0, 'bonus') returning id into c2;
  insert into public.cells (season_id, x, y, kind) values (s, 2, 0, 'normal') returning id into c3;
  insert into public.cells (season_id, x, y, kind, owner_faction_id) values (s, 3, 0, 'normal', 'knaves') returning id into c4;
  insert into public.cells (season_id, x, y, kind, base_faction_id, owner_faction_id) values (s, 4, 0, 'normal', 'wretches', 'wretches');
  -- The Tithe on cell 3 during the scored hour
  insert into public.events (season_id, type, zone_x, zone_y, zone_w, zone_h, announced_at, starts_at, ends_at)
  values (s, 'tithe', 2, 0, 1, 1, h - interval '10 hours', h - interval '2 hours', h + interval '20 hours');

  insert into public.players (wallet, faction_id, age_updated_at) values
    (a, 'wretches', now()), (b, 'goblins', now()), (c, 'wretches', now()), (d, 'goblins', now()), (e, 'knaves', now());
  -- balances: everyone steady since before the hour; A buys at +10 min and sells at +20 min
  insert into public.balance_history (wallet, balance, observed_at) values
    (a, 1000 * u, h - interval '70 minutes'),
    (a, 5000 * u, h - interval '50 minutes'),
    (a, 500 * u,  h - interval '40 minutes'),
    (b, 1000 * u, h - interval '70 minutes'),
    (c, 1000 * u, h - interval '70 minutes'),
    (d, 1000 * u, h - interval '70 minutes'),
    (e, 1000 * u, h - interval '70 minutes');
  insert into public.deployments (wallet, cell_id, season_id, force) values
    (a, c1, s, 1000), (a, c2, s, 300),  -- A deployed 1 300 but its minimum this hour is 500
    (b, c1, s, 600), (b, c3, s, 200),
    (c, c2, s, 230),
    (d, c4, s, 100), (e, c4, s, 100);   -- tie on cell 4: the holder (Knaves) keeps it

  for r in select * from public.score_tick(h) loop
    log := log || format(E'\n  %s: %s', r.faction_id, r.points);
  end loop;
  log := E'\n1 points per Banner (expect wretches 4 = camp 1 + tower 3, goblins 4 = cell 1 + Tithe 3, knaves 1, others 0):' || log;

  log := log || format(E'\n2 Renown B=%s A=%s C=%s E=%s D=%s (expect 4, 1, 2, 1, none)',
    (select renown from public.player_scores where season_id = s and wallet = b),
    (select renown from public.player_scores where season_id = s and wallet = a),
    (select renown from public.player_scores where season_id = s and wallet = c),
    (select renown from public.player_scores where season_id = s and wallet = e),
    coalesce((select renown::text from public.player_scores where season_id = s and wallet = d), 'none'));
  log := log || format(E'\n3 live owner of cell 1 untouched: %s (expect null: the tick does not change the map)',
    coalesce((select owner_faction_id from public.cells where id = c1), 'null'));

  perform public.score_tick(h);
  log := log || format(E'\n4 second call: score rows %s, total points %s, B Renown %s (expect 5, 9, 4)',
    (select count(*) from public.score_ticks where season_id = s),
    (select sum(points) from public.score_ticks where season_id = s),
    (select renown from public.player_scores where season_id = s and wallet = b));

  raise exception 'ROLLBACK — results:%', log;
end $$;
