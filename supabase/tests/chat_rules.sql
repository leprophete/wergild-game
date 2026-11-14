-- The War Council — who may read and write, the link filter, reports, mutes, the knell wipe,
-- and that nothing is reachable from outside (anon / authenticated).
-- Runs in an isolated test season and ALWAYS ends with an exception, so nothing is written.
-- Read each line: got vs expect.
do $$
declare
  log text := '';
  h timestamptz := date_trunc('hour', now());
  s bigint;
  a text := 'ChatTestGobAxxxxxxxxxxxxxxxxxxxxxxxx';  -- Goblins
  a2 text := 'ChatTestGobBxxxxxxxxxxxxxxxxxxxxxxxx'; -- Goblins
  k text := 'ChatTestKnaveAxxxxxxxxxxxxxxxxxxxxxx';  -- Knaves
  v text := 'ChatTestNoBannerxxxxxxxxxxxxxxxxxxxx';  -- no Banner
  m1 bigint;
  got text;
  n integer;
begin
  -- 1. the link filter
  log := log || format(E'\n1 links refused: %s (expect all true)', (
    select string_agg(public.chat_has_link(t)::text, ',') from unnest(array[
      'see https://evil.example', 'www.pump.fun now', 'join t.me/goblins', 'buy at pump.fun',
      'dexscreener.com/solana', 'go to discord.gg/abc', 'evil[.]com', 'evil (dot) xyz', 'HTTP : // x', 'GOOGLE.COM'
    ]) t));
  log := log || format(E'\n2 sentences kept: %s (expect all false)', (
    select string_agg(public.chat_has_link(t)::text, ',') from unnest(array[
      'Hold the line. In the morning we march.', 'e.g. take M-25 first', 'up 3.5k soldiers', 'gg wp',
      'meet at the ford at 5 p.m.', 'the dot on the map', 'Knaves to the east!'
    ]) t));

  -- an isolated season
  update public.seasons set status = 'ended' where status in ('active', 'scheduled');
  insert into public.seasons (number, name, starts_at, ends_at, status)
  values (996, 'Chat test', h - interval '1 day', h + interval '13 days', 'active') returning id into s;
  insert into public.players (wallet, faction_id) values (a, 'goblins'), (a2, 'goblins'), (k, 'knaves'), (v, null);

  -- 2. writing
  select id into m1 from public.chat_post(a, '  To the ford, Goblins!  ');
  log := log || format(E'\n3 posted body %L (expect trimmed)', (select body from public.chat_messages where id = m1));
  perform public.chat_post(k, 'Knaves only');
  begin perform public.chat_post(v, 'hello'); got := 'accepted'; exception when others then got := sqlerrm; end;
  log := log || format(E'\n4 no Banner posts: %s (expect no_banner)', got);
  begin perform public.chat_post(k, 'sneaky', 'goblins'); got := 'accepted'; exception when others then got := sqlerrm; end;
  log := log || format(E'\n5 Knave posts to the Goblins: %s (expect not_your_council)', got);
  begin perform public.chat_post(a, 'buy at pump.fun'); got := 'accepted'; exception when others then got := sqlerrm; end;
  log := log || format(E'\n6 link: %s (expect link_not_allowed)', got);
  begin perform public.chat_post(a, '<img src=x onerror=alert(1)>'); got := 'accepted'; exception when others then got := sqlerrm; end;
  log := log || format(E'\n7 HTML: %s (expect html_not_allowed)', got);
  begin perform public.chat_post(a, repeat('x', 281)); got := 'accepted'; exception when others then got := sqlerrm; end;
  log := log || format(E'\n8 281 chars: %s (expect invalid_message)', got);

  -- 3. reading
  log := log || format(E'\n9 Goblin reads: %s (expect only the Goblin message)',
    (select string_agg(body, ' | ') from public.chat_read(a2, 0) where id is not null));
  log := log || format(E'\n10 Knave reads: %s (expect only the Knave message)',
    (select string_agg(body, ' | ') from public.chat_read(k, 0) where id is not null));
  begin perform public.chat_read(k, 0, 'goblins'); got := 'read'; exception when others then got := sqlerrm; end;
  log := log || format(E'\n11 Knave reads the Goblins: %s (expect not_your_council)', got);
  begin perform public.chat_read(v, 0); got := 'read'; exception when others then got := sqlerrm; end;
  log := log || format(E'\n12 no Banner reads: %s (expect no_banner)', got);
  log := log || format(E'\n13 since = last id: %s rows with an id (expect 0)',
    (select count(*) from public.chat_read(a, m1) where id is not null));

  -- 4. reports
  begin perform public.chat_report(k, m1); got := 'reported'; exception when others then got := sqlerrm; end;
  log := log || format(E'\n14 Knave reports a Goblin message: %s (expect not_your_council)', got);
  perform public.chat_report(a2, m1);
  perform public.chat_report(a2, m1);
  log := log || format(E'\n15 reported twice by one member: %s; in the admin list: %s (expect 1, true)',
    (select reports from public.chat_messages where id = m1),
    exists (select 1 from public.admin_chat_reported() r where r.id = m1));

  -- 5. mutes
  perform public.admin_chat_mute(a, 60, 'admin');
  begin perform public.chat_post(a, 'still here'); got := 'accepted'; exception when others then got := sqlerrm; end;
  log := log || format(E'\n16 muted posts: %s; read shows muted: %s (expect muted, true)', got,
    (select bool_or(muted_until is not null) from public.chat_read(a, 0)));
  perform public.admin_chat_mute(a, 0, 'admin');
  begin perform public.chat_post(a, 'free again'); got := 'accepted'; exception when others then got := sqlerrm; end;
  log := log || format(E'\n17 after the mute is lifted: %s (expect accepted)', got);

  -- 6. moderation
  perform public.admin_chat_delete(m1);
  log := log || format(E'\n18 deleted message gone: %s (expect true)', not exists (select 1 from public.chat_messages where id = m1));

  -- 7. nothing from outside
  log := log || format(E'\n19 anon/authenticated table rights: %s (expect all false)', concat_ws(',',
    has_table_privilege('anon', 'public.chat_messages', 'select'), has_table_privilege('anon', 'public.chat_messages', 'insert'),
    has_table_privilege('authenticated', 'public.chat_messages', 'select'), has_table_privilege('anon', 'public.chat_mutes', 'select'),
    has_table_privilege('anon', 'public.chat_reports', 'insert')));
  log := log || format(E'\n20 anon/authenticated function rights: %s (expect all false)', concat_ws(',',
    has_function_privilege('anon', 'public.chat_post(text,text,text)', 'execute'),
    has_function_privilege('anon', 'public.chat_read(text,bigint,text,integer)', 'execute'),
    has_function_privilege('authenticated', 'public.chat_report(text,bigint)', 'execute'),
    has_function_privilege('authenticated', 'public.admin_chat_mute(text,integer,text)', 'execute'),
    has_function_privilege('anon', 'public.admin_chat_reported()', 'execute')));
  log := log || format(E'\n21 policies on the chat tables: %s (expect 0)',
    (select count(*) from pg_policies where tablename in ('chat_messages', 'chat_reports', 'chat_mutes')));

  -- 8. the knell wipes the councils
  select count(*) into n from public.chat_messages where season_id = s;
  update public.seasons set ends_at = h where id = s;
  perform public.season_tick(now());
  log := log || format(E'\n22 messages before the knell %s, after %s (expect 2, 0)', n,
    (select count(*) from public.chat_messages where season_id = s));

  raise exception 'ROLLBACK — results:%', log;
end $$;
