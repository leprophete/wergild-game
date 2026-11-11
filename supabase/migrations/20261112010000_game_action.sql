-- Step 5 — deploy, withdraw, move: ONE transactional function (rules 4 and 5). Server only.
--
-- The player row is locked first (FOR UPDATE): two simultaneous requests are serialised,
-- so nobody can spend the same reserve twice. Every rule is checked inside, the
-- deployment is written, and the owner of every touched cell is recomputed — all or nothing.
--
-- Rule 4: deploy on a cell held by your Banner, or touching one by a side; base camps
--         are impregnable; the river cannot be held; at most p_max_per_cell force per
--         player per cell; soldiers placed or moved are locked p_cooldown_minutes
--         ("wet ink") — except during The Rush (rule 9).
-- Rule 5: owner = strongest Banner, tie goes to the holder (recompute_cell).

create function public.game_action(
  p_wallet text,
  p_action text,            -- 'deploy' | 'withdraw' | 'move'
  p_x smallint,
  p_y smallint,
  p_amount bigint,
  p_to_x smallint default null,
  p_to_y smallint default null,
  p_max_per_cell bigint default 20000,
  p_cooldown_minutes integer default 60
)
returns table (reserve bigint, owner_before text, owner_after text, to_owner_before text, to_owner_after text, locked_until timestamptz)
language plpgsql
set search_path = ''
as $$
declare
  v_player public.players;
  v_season public.seasons;
  v_src public.cells;
  v_dst public.cells;
  v_target public.cells;
  v_dep public.deployments;
  v_deployed bigint;
  v_reserve bigint;
  v_rush boolean;
  v_lock timestamptz;
  v_src_owner_before text;
  v_dst_owner_before text;
begin
  if p_action not in ('deploy', 'withdraw', 'move') then raise exception 'invalid_action'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;

  -- 1. the player, locked for the whole transaction
  select * into v_player from public.players p where p.wallet = p_wallet for update;
  if not found then raise exception 'unknown_player'; end if;
  if v_player.is_excluded then raise exception 'excluded_wallet'; end if;
  if v_player.faction_id is null then raise exception 'no_banner'; end if;

  -- 2. the running season
  select * into v_season from public.seasons s
  where s.status = 'active' and now() >= s.starts_at and now() < s.ends_at;
  if not found then raise exception 'no_active_season'; end if;

  v_rush := exists (
    select 1 from public.events e
    where e.season_id = v_season.id and e.type = 'rush' and now() >= e.starts_at and now() < e.ends_at
  );
  v_lock := case when v_rush then now() else now() + make_interval(mins => p_cooldown_minutes) end;

  select * into v_src from public.cells c where c.season_id = v_season.id and c.x = p_x and c.y = p_y;
  if not found then raise exception 'unknown_cell'; end if;
  v_src_owner_before := v_src.owner_faction_id;

  select coalesce(sum(d.force), 0) into v_deployed from public.deployments d where d.wallet = p_wallet;
  v_reserve := greatest(0, v_player.force - v_deployed);

  -- 3. leaving a cell (withdraw, or the first half of a move)
  if p_action in ('withdraw', 'move') then
    select * into v_dep from public.deployments d where d.wallet = p_wallet and d.cell_id = v_src.id for update;
    if not found or v_dep.force < p_amount then raise exception 'not_enough_here'; end if;
    if v_dep.locked_until > now() and not v_rush then raise exception 'ink_still_wet'; end if;
  end if;

  -- 4. entering a cell (deploy, or the second half of a move)
  if p_action = 'deploy' then
    v_target := v_src;
    if v_reserve < p_amount then raise exception 'not_enough_reserve'; end if;
  elsif p_action = 'move' then
    if p_to_x is null or p_to_y is null then raise exception 'invalid_destination'; end if;
    select * into v_dst from public.cells c where c.season_id = v_season.id and c.x = p_to_x and c.y = p_to_y;
    if not found then raise exception 'unknown_cell'; end if;
    if v_dst.id = v_src.id then raise exception 'invalid_destination'; end if;
    v_dst_owner_before := v_dst.owner_faction_id;
    v_target := v_dst;
  end if;

  if p_action in ('deploy', 'move') then
    if v_target.kind = 'blocked' then raise exception 'river'; end if;
    if v_target.base_faction_id is not null and v_target.base_faction_id <> v_player.faction_id then
      raise exception 'impregnable';
    end if;
    if v_target.owner_faction_id is distinct from v_player.faction_id and not exists (
      select 1 from public.cells n
      where n.season_id = v_season.id
        and n.owner_faction_id = v_player.faction_id
        and abs(n.x - v_target.x) + abs(n.y - v_target.y) = 1
    ) then
      raise exception 'not_adjacent';
    end if;
    if coalesce((select d.force from public.deployments d where d.wallet = p_wallet and d.cell_id = v_target.id), 0)
       + p_amount > p_max_per_cell then
      raise exception 'cell_cap';
    end if;
  end if;

  -- 5. write
  if p_action in ('withdraw', 'move') then
    if v_dep.force = p_amount then
      delete from public.deployments d where d.wallet = p_wallet and d.cell_id = v_src.id;
    else
      update public.deployments d set force = d.force - p_amount where d.wallet = p_wallet and d.cell_id = v_src.id;
    end if;
  end if;

  if p_action in ('deploy', 'move') then
    insert into public.deployments (wallet, cell_id, season_id, force, locked_until)
    values (p_wallet, v_target.id, v_season.id, p_amount, v_lock)
    on conflict (wallet, cell_id) do update
      set force = public.deployments.force + excluded.force,
          locked_until = excluded.locked_until; -- reinforcements wet the whole stack again
  end if;

  -- 6. rule 5 on every touched cell
  perform public.recompute_cell(v_src.id);
  if p_action = 'move' then perform public.recompute_cell(v_dst.id); end if;

  select coalesce(sum(d.force), 0) into v_deployed from public.deployments d where d.wallet = p_wallet;
  update public.players p set reserve = greatest(0, v_player.force - v_deployed) where p.wallet = p_wallet;

  return query select
    greatest(0, v_player.force - v_deployed),
    v_src_owner_before,
    (select c.owner_faction_id from public.cells c where c.id = v_src.id),
    v_dst_owner_before,
    case when p_action = 'move' then (select c.owner_faction_id from public.cells c where c.id = v_dst.id) end,
    case when p_action = 'withdraw' then null else v_lock end;
end;
$$;

revoke execute on function public.game_action(text, text, smallint, smallint, bigint, smallint, smallint, bigint, integer)
  from public, anon, authenticated;
grant execute on function public.game_action(text, text, smallint, smallint, bigint, smallint, smallint, bigint, integer)
  to service_role;
