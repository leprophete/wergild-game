-- Rules 8 and 9 — the Plague, the knell, the next season, the admin checks.
-- Runs in an isolated test season and ALWAYS ends with an exception, so nothing is written.
-- Read each line: got vs expect.
do $$
declare
  log text := '';
  h timestamptz := date_trunc('hour', now());   -- the knell: the test season ended at the last full hour
  u numeric := 1000000000;
  s bigint;
  nxt public.seasons;
  arc public.season_archives;
  a text := 'SeasonTestAxxxxxxxxxxxxxxxxxxxxxxxxx'; -- Goblins
  b text := 'SeasonTestBxxxxxxxxxxxxxxxxxxxxxxxxx'; -- Knaves
  camp bigint; c1 bigint; c2 bigint; c3 bigint;
  ev bigint;
  rush bigint;
  msg text;
begin
  update public.seasons set status = 'ended' where status in ('active', 'scheduled');
  insert into public.seasons (number, name, starts_at, ends_at, status)
  values (998, 'Season test', h - interval '14 days', h, 'active') returning id into s;
  insert into public.cells (season_id, x, y, kind, base_faction_id, owner_faction_id)
  values (s, 0, 0, 'normal', 'goblins', 'goblins') returning id into camp;
  insert into public.cells (season_id, x, y, kind) values (s, 10, 10, 'normal') returning id into c1; -- in the Plague
  insert into public.cells (season_id, x, y, kind) values (s, 1, 0, 'normal') returning id into c2;
  insert into public.cells (season_id, x, y, kind) values (s, 2, 0, 'bonus') returning id into c3;

  insert into public.players (wallet, faction_id, force, reserve, faction_switches, age_days, age_updated_at) values
    (a, 'goblins', 1000, 600, 1, 12, now()),
    (b, 'knaves', 1000, 950, 0, 3, now());
  insert into public.balance_history (wallet, balance, observed_at) values
    (a, 1000 * u, h - interval '15 days'), (b, 1000 * u, h - interval '15 days');
  insert into public.deployments (wallet, cell_id, season_id, force) values
    (a, c1, s, 300), (a, c2, s, 100), (b, c3, s, 50);
  update public.cells set owner_faction_id = 'goblins' where id in (c1, c2);
  update public.cells set owner_faction_id = 'knaves' where id = c3;
  -- earlier hours of the season
  insert into public.score_ticks (season_id, faction_id, hour, points) values
    (s, 'goblins', h - interval '3 hours', 10), (s, 'knaves', h - interval '3 hours', 10);
  insert into public.player_scores (season_id, wallet, renown) values (s, a, 10), (s, b, 10);

  -- 1. The Plague over (9,9)-(12,12), its hour has come
  insert into public.events (season_id, type, zone_x, zone_y, zone_w, zone_h, announced_at, starts_at, ends_at)
  values (s, 'plague', 9, 9, 4, 4, h - interval '10 hours', h - interval '2 hours', h - interval '2 hours')
  returning id into ev;
  -- the knell must not ring yet for this check: push the end away, strike, then bring it back
  update public.seasons set ends_at = h + interval '1 day' where id = s;
  perform public.season_tick(now());
  log := log || format(E'\n1 Plague: soldiers on c1 %s, owner %s, A reserve %s, applied %s (expect 0, null, 900, true)',
    (select count(*) from public.deployments where cell_id = c1),
    coalesce((select owner_faction_id from public.cells where id = c1), 'null'),
    (select reserve from public.players where wallet = a),
    (select applied_at is not null from public.events where id = ev));
  perform public.season_tick(now());
  log := log || format(E'\n2 Plague strikes once: %s (expect true)',
    (select reserve = 900 from public.players where wallet = a));
  update public.seasons set ends_at = h where id = s;

  -- 2. The knell
  msg := public.season_tick(now());
  log := log || format(E'\n3 season_tick says: %s', msg);
  select * into arc from public.season_archives where season_id = s;
  log := log || format(E'\n4 winner %s, scores goblins %s knaves %s (expect knaves: 10+2=12 vs 10+3=13)',
    arc.winner_faction_id, arc.scores->>'goblins', arc.scores->>'knaves');
  log := log || format(E'\n5 archived cells %s (expect 3: camp, c2, c3), top %s',
    jsonb_array_length(arc.cells), arc.top);
  log := log || format(E'\n6 badges: B rank %s, A rank %s (expect 1, 2)',
    (select rank from public.badges where season_id = s and wallet = b),
    (select rank from public.badges where season_id = s and wallet = a));
  log := log || format(E'\n7 old season %s, deployments left %s (expect ended, 0)',
    (select status from public.seasons where id = s),
    (select count(*) from public.deployments where season_id = s));
  log := log || format(E'\n8 A reserve %s, switches %s, age %s (expect 1000, 0, 12 kept)',
    (select reserve from public.players where wallet = a),
    (select faction_switches from public.players where wallet = a),
    (select age_days from public.players where wallet = a));
  select * into nxt from public.seasons where status = 'active';
  log := log || format(E'\n9 next season #%s "%s" %s → %s, cells %s, held %s (expect 999 "The Knaves'' Bargain", 14 days, 4 cells, 1 camp)',
    nxt.number, nxt.name, nxt.starts_at, nxt.ends_at,
    (select count(*) from public.cells where season_id = nxt.id),
    (select count(*) from public.cells where season_id = nxt.id and owner_faction_id is not null));

  -- 3. Admin checks, on the new season
  begin
    perform public.admin_schedule_event('tithe', 5, 5, h + interval '2 hours');
    log := log || E'\n10 tithe 2 h ahead: ACCEPTED (expect too_soon)';
  exception when others then log := log || format(E'\n10 tithe 2 h ahead: %s (expect too_soon)', sqlerrm);
  end;
  begin
    perform public.admin_schedule_event('tithe', 46, 5, h + interval '1 day');
    log := log || E'\n11 tithe off the map: ACCEPTED (expect zone_off_map)';
  exception when others then log := log || format(E'\n11 tithe off the map: %s (expect zone_off_map)', sqlerrm);
  end;
  ev := public.admin_schedule_event('tithe', 5, 5, h + interval '1 day');
  log := log || format(E'\n12 tithe 24 h ahead: %s × %s, lasts %s (expect 3 × 3, 24:00:00)',
    (select zone_w from public.events where id = ev), (select zone_h from public.events where id = ev),
    (select ends_at - starts_at from public.events where id = ev));
  begin
    perform public.admin_schedule_event('tithe', 20, 5, h + interval '1 day 1 hour');
    log := log || E'\n13 second tithe same day: ACCEPTED (expect one_tithe_per_day unless the day turned)';
  exception when others then log := log || format(E'\n13 second tithe same day: %s (expect one_tithe_per_day)', sqlerrm);
  end;
  perform public.admin_schedule_event('plague', 20, 20, h + interval '2 days');
  begin
    perform public.admin_schedule_event('plague', 30, 20, h + interval '3 days');
    log := log || E'\n14 second plague: ACCEPTED (expect one_plague_per_season)';
  exception when others then log := log || format(E'\n14 second plague: %s (expect one_plague_per_season)', sqlerrm);
  end;
  rush := public.admin_schedule_event('rush', 1, 1, h + interval '30 hours');
  log := log || format(E'\n15 rush: zone %s, lasts %s (expect null, 01:00:00)',
    coalesce((select zone_w::text from public.events where id = rush), 'null'),
    (select ends_at - starts_at from public.events where id = rush));
  perform public.admin_cancel_event(ev);
  log := log || format(E'\n16 cancelled tithe gone: %s (expect true)', not exists (select 1 from public.events where id = ev));
  begin
    perform public.admin_create_season('Another', date_trunc('week', h) + interval '7 days 17 hours');
    log := log || E'\n17 second season while one runs: ACCEPTED (expect season_exists)';
  exception when others then log := log || format(E'\n17 second season while one runs: %s (expect season_exists)', sqlerrm);
  end;

  raise exception 'ROLLBACK — results:%', log;
end $$;
