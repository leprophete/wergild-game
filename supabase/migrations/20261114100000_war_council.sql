-- The War Council: one private chat per Banner.
-- Same rules as step 9: RLS on and NO policy (nothing readable or writable from outside);
-- every read and write goes through /api/chat, which checks the session, then calls these
-- functions with the service role. The functions check the Banner once more.
-- Messages are wiped at the knell.

-- ---------------------------------------------------------------------------
-- tables
-- ---------------------------------------------------------------------------
create table public.chat_messages (
  id bigint generated always as identity primary key,
  season_id bigint not null references public.seasons (id) on delete cascade,
  faction_id text not null references public.factions (id),
  wallet text not null references public.players (wallet) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now(),
  reports integer not null default 0 check (reports >= 0),
  last_reported_at timestamptz
);
create index chat_messages_faction_idx on public.chat_messages (faction_id, id);
create index chat_messages_season_idx on public.chat_messages (season_id);
create index chat_messages_wallet_idx on public.chat_messages (wallet);
create index chat_messages_reported_idx on public.chat_messages (last_reported_at desc) where reports > 0;

create table public.chat_reports (
  message_id bigint not null references public.chat_messages (id) on delete cascade,
  reporter text not null check (length(reporter) between 32 and 44),
  created_at timestamptz not null default now(),
  primary key (message_id, reporter)
);

create table public.chat_mutes (
  wallet text primary key check (length(wallet) between 32 and 44),
  muted_until timestamptz not null,
  muted_by text,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;
alter table public.chat_reports enable row level security;
alter table public.chat_mutes enable row level security;
revoke all on public.chat_messages, public.chat_reports, public.chat_mutes from public, anon, authenticated;
grant select, insert, update, delete on public.chat_messages, public.chat_reports, public.chat_mutes to service_role;

-- ---------------------------------------------------------------------------
-- the link filter (the same pattern lives in src/lib/chat.ts): a scheme, "www.", or any
-- name ending in a known top-level domain ("name.com", or disguised "name[.]com", "name (dot) com").
-- A plain dot must touch both words, so "...it. In the morning" stays a sentence.
-- ---------------------------------------------------------------------------
create function public.chat_has_link(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p ~* '(https?|ftp|wss?)\s*:\s*/\s*/'
    or p ~* '(^|[^a-z0-9])www\s*\.'
    or p ~* '[a-z0-9-](\.|\s*(\[\s*\.?\s*\]|\(\s*\.?\s*\)|\[\s*dot\s*\]|\(\s*dot\s*\))\s*)(com|net|org|io|xyz|fun|app|gg|co|me|ru|tv|link|ly|to|sh|so|ai|dev|info|biz|site|online|club|top|pro|finance|money|cash|live|chat|bot|tk|ml|cc|ws|in|uk|de|fr|eu|us|ca|cn|be|nl|es|it|ch|se|jp|kr|vn|id|ph|tr|ua|br|mx|au|nz|pw|lol|wtf|art|store|shop|tech|space|website|click|page|sol|eth|ton|bio|one|win|vip|icu|cyou|buzz|rest|bond|ink|news|zone|world|exchange|market|trade|network|group|codes|tools|games|game)([^a-z0-9]|$)',
    false);
$$;

-- ---------------------------------------------------------------------------
-- grades: the author's place in this season's Renown
--   top 10 Warlord · top 10 % Captain · top 35 % Sergeant · any Renown Soldier · none Recruit
-- ---------------------------------------------------------------------------
create function public.chat_grade(p_wallet text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_s bigint;
  v_renown numeric;
  v_rank bigint;
  v_n bigint;
begin
  select id into v_s from public.seasons where status = 'active';
  if v_s is null then return 'Recruit'; end if;
  select renown into v_renown from public.player_scores where season_id = v_s and wallet = p_wallet;
  if coalesce(v_renown, 0) <= 0 then return 'Recruit'; end if;
  select count(*) + 1 into v_rank from public.player_scores where season_id = v_s and renown > v_renown;
  select count(*) into v_n from public.player_scores where season_id = v_s and renown > 0;
  return case
    when v_rank <= 10 then 'Warlord'
    when v_rank <= ceil(v_n * 0.10) then 'Captain'
    when v_rank <= ceil(v_n * 0.35) then 'Sergeant'
    else 'Soldier'
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- reading: the caller's own Banner only (p_faction, if given, must be theirs)
-- ---------------------------------------------------------------------------
create function public.chat_read(p_wallet text, p_since bigint, p_faction text default null, p_limit integer default 50)
returns table (id bigint, wallet text, body text, created_at timestamptz, grade text, mine boolean, faction_id text, muted_until timestamptz)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_faction text;
  v_until timestamptz;
begin
  select p.faction_id into v_faction from public.players p where p.wallet = p_wallet;
  if v_faction is null then raise exception 'no_banner'; end if;
  if p_faction is not null and p_faction <> v_faction then raise exception 'not_your_council'; end if;
  select m.muted_until into v_until from public.chat_mutes m where m.wallet = p_wallet and m.muted_until > now();
  return query
    select x.id, x.wallet, x.body, x.created_at, public.chat_grade(x.wallet), x.wallet = p_wallet, v_faction, v_until
    from (
      select c.id, c.wallet, c.body, c.created_at
      from public.chat_messages c
      where c.faction_id = v_faction and c.id > coalesce(p_since, 0)
      order by c.id desc
      limit least(greatest(coalesce(p_limit, 50), 1), 100)
    ) x
    order by x.id;
  -- an empty council still says whose it is (and whether the caller is muted)
  if not found then
    return query select null::bigint, null::text, null::text, null::timestamptz, null::text, null::boolean, v_faction, v_until;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- writing
-- ---------------------------------------------------------------------------
create function public.chat_post(p_wallet text, p_body text, p_faction text default null)
returns table (id bigint, created_at timestamptz)
language plpgsql
set search_path = ''
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_player public.players;
  v_season bigint;
  v_until timestamptz;
begin
  if char_length(v_body) = 0 or char_length(v_body) > 280 then raise exception 'invalid_message'; end if;
  if v_body ~ '[\x01-\x08\x0B-\x1F\x7F]' then raise exception 'invalid_message'; end if;
  if v_body ~* '<\s*/?\s*[a-z!][^>]*>' then raise exception 'html_not_allowed'; end if;
  if public.chat_has_link(v_body) then raise exception 'link_not_allowed'; end if;

  select * into v_player from public.players p where p.wallet = p_wallet;
  if not found or v_player.faction_id is null then raise exception 'no_banner'; end if;
  if p_faction is not null and p_faction <> v_player.faction_id then raise exception 'not_your_council'; end if;
  if v_player.is_excluded then raise exception 'excluded_wallet'; end if;
  select m.muted_until into v_until from public.chat_mutes m where m.wallet = p_wallet and m.muted_until > now();
  if v_until is not null then raise exception 'muted' using detail = v_until::text; end if;
  select s.id into v_season from public.seasons s where s.status = 'active';
  if v_season is null then raise exception 'no_active_season'; end if;

  return query
    insert into public.chat_messages as c (season_id, faction_id, wallet, body)
    values (v_season, v_player.faction_id, p_wallet, v_body)
    returning c.id, c.created_at;
end;
$$;

-- a member reports a message of their own council (once per member and message)
create function public.chat_report(p_wallet text, p_message_id bigint)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_faction text;
  v_msg_faction text;
  v_new integer;
begin
  select p.faction_id into v_faction from public.players p where p.wallet = p_wallet;
  if v_faction is null then raise exception 'no_banner'; end if;
  select c.faction_id into v_msg_faction from public.chat_messages c where c.id = p_message_id;
  -- a message of another council is answered like a missing one: nothing to learn
  if v_msg_faction is null or v_msg_faction <> v_faction then raise exception 'not_your_council'; end if;
  insert into public.chat_reports (message_id, reporter) values (p_message_id, p_wallet) on conflict do nothing;
  get diagnostics v_new = row_count;
  if v_new > 0 then
    update public.chat_messages set reports = reports + 1, last_reported_at = now() where id = p_message_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- moderation (/admin)
-- ---------------------------------------------------------------------------
create function public.admin_chat_reported()
returns table (id bigint, wallet text, faction_id text, body text, created_at timestamptz, reports integer, last_reported_at timestamptz, muted_until timestamptz)
language sql
stable
set search_path = ''
as $$
  select c.id, c.wallet, c.faction_id, c.body, c.created_at, c.reports, c.last_reported_at,
         (select m.muted_until from public.chat_mutes m where m.wallet = c.wallet and m.muted_until > now())
  from public.chat_messages c
  where c.reports > 0
  order by c.last_reported_at desc
  limit 200;
$$;

create function public.admin_chat_delete(p_message_id bigint)
returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from public.chat_messages where id = p_message_id;
  if not found then raise exception 'message_not_found'; end if;
end;
$$;

create function public.admin_chat_dismiss(p_message_id bigint)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.chat_messages set reports = 0, last_reported_at = null where id = p_message_id;
  if not found then raise exception 'message_not_found'; end if;
  delete from public.chat_reports where message_id = p_message_id;
end;
$$;

-- p_minutes = 0 lifts the mute
create function public.admin_chat_mute(p_wallet text, p_minutes integer, p_by text)
returns timestamptz
language plpgsql
set search_path = ''
as $$
declare
  v_until timestamptz;
begin
  if p_wallet is null or length(p_wallet) not between 32 and 44 or p_wallet !~ '^[1-9A-HJ-NP-Za-km-z]+$' then
    raise exception 'invalid_wallet';
  end if;
  if p_minutes is null or p_minutes < 0 or p_minutes > 60 * 24 * 90 then raise exception 'invalid_duration'; end if;
  delete from public.chat_mutes where muted_until <= now();
  if p_minutes = 0 then
    delete from public.chat_mutes where wallet = p_wallet;
    return null;
  end if;
  v_until := now() + make_interval(mins => p_minutes);
  insert into public.chat_mutes (wallet, muted_until, muted_by) values (p_wallet, v_until, p_by)
  on conflict (wallet) do update set muted_until = excluded.muted_until, muted_by = excluded.muted_by, created_at = now();
  return v_until;
end;
$$;

-- ---------------------------------------------------------------------------
-- the knell wipes the councils: a fresh start, and nothing kept that is not needed
-- ---------------------------------------------------------------------------
create function public.chat_wipe_on_knell()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.chat_messages where season_id = new.id;
  return new;
end;
$$;

create trigger seasons_chat_wipe
after update of status on public.seasons
for each row
when (new.status = 'ended' and old.status is distinct from 'ended')
execute function public.chat_wipe_on_knell();

-- ---------------------------------------------------------------------------
-- server only
-- ---------------------------------------------------------------------------
revoke execute on function
  public.chat_has_link(text),
  public.chat_grade(text),
  public.chat_read(text, bigint, text, integer),
  public.chat_post(text, text, text),
  public.chat_report(text, bigint),
  public.admin_chat_reported(),
  public.admin_chat_delete(bigint),
  public.admin_chat_dismiss(bigint),
  public.admin_chat_mute(text, integer, text),
  public.chat_wipe_on_knell()
from public, anon, authenticated;
grant execute on function
  public.chat_has_link(text),
  public.chat_grade(text),
  public.chat_read(text, bigint, text, integer),
  public.chat_post(text, text, text),
  public.chat_report(text, bigint),
  public.admin_chat_reported(),
  public.admin_chat_delete(bigint),
  public.admin_chat_dismiss(bigint),
  public.admin_chat_mute(text, integer, text)
to service_role;
