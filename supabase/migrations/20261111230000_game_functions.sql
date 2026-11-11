-- Game functions. Server only (service_role): the browser can never call them.

-- ---------------------------------------------------------------------------
-- recompute_cell — rule 5: the strongest Banner owns the cell; on a tie the
-- holder keeps it (a tie among challengers leaves it unclaimed); no force =
-- unclaimed; base camps always stay with their Banner (rule 4).
-- Contested = top two Banners within 10 % (CONTESTED_GAP_PCT in config/game.ts).
-- Always touches the row, so Realtime broadcasts the change.
-- ---------------------------------------------------------------------------
create function public.recompute_cell(p_cell_id bigint)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_cell public.cells;
  v_f1 bigint;
  v_f2 bigint;
  v_tied text[];
  v_owner text;
begin
  select * into v_cell from public.cells where id = p_cell_id for update;
  if not found then
    return;
  end if;

  select coalesce(max(cs.force), 0) into v_f1 from public.cell_strength cs where cs.cell_id = p_cell_id;

  if v_f1 = 0 then
    v_owner := null;
    v_f2 := 0;
  else
    select array_agg(cs.faction_id) into v_tied
    from public.cell_strength cs where cs.cell_id = p_cell_id and cs.force = v_f1;

    if array_length(v_tied, 1) = 1 then
      v_owner := v_tied[1];
      select coalesce(max(cs.force), 0) into v_f2
      from public.cell_strength cs where cs.cell_id = p_cell_id and cs.force < v_f1;
    else
      v_owner := case when v_cell.owner_faction_id = any (v_tied) then v_cell.owner_faction_id end;
      v_f2 := v_f1;
    end if;
  end if;

  update public.cells
  set owner_faction_id = coalesce(v_cell.base_faction_id, v_owner),
      contested = v_f2 > 0 and (v_f1 - v_f2)::numeric / v_f1 < 0.10
  where id = p_cell_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- join_faction — rule 3, in one transaction with the player row locked.
--   * excluded wallets cannot play (rule 10)
--   * a Banner above p_cap_pct of the total force of registered players
--     (reserve included) is closed to newcomers
--   * one switch per season; switching sends every soldier back to reserve
-- Errors are raised with a stable message code the API maps to a response.
-- ---------------------------------------------------------------------------
create function public.join_faction(
  p_wallet text,
  p_faction text,
  p_cap_pct numeric default 35,
  p_max_switches integer default 1
)
returns table (faction_id text, switched boolean, switches_left integer)
language plpgsql
set search_path = ''
as $$
declare
  v_player public.players;
  v_total numeric;
  v_banner numeric;
  v_cell bigint;
begin
  select * into v_player from public.players p where p.wallet = p_wallet for update;
  if not found then
    raise exception 'unknown_player';
  end if;
  if v_player.is_excluded then
    raise exception 'excluded_wallet';
  end if;
  if not exists (select 1 from public.factions f where f.id = p_faction) then
    raise exception 'unknown_banner';
  end if;

  if v_player.faction_id = p_faction then
    return query select p_faction, false, greatest(0, p_max_switches - v_player.faction_switches);
    return;
  end if;

  if v_player.faction_id is not null and v_player.faction_switches >= p_max_switches then
    raise exception 'no_switch_left';
  end if;

  select coalesce(sum(p.force), 0) into v_total
  from public.players p where not p.is_excluded and p.faction_id is not null;
  select coalesce(sum(p.force), 0) into v_banner
  from public.players p where not p.is_excluded and p.faction_id = p_faction;
  if v_total > 0 and v_banner * 100 / v_total > p_cap_pct then
    raise exception 'banner_closed';
  end if;

  -- switching Banner: every soldier returns to reserve
  if v_player.faction_id is not null then
    for v_cell in
      with gone as (delete from public.deployments d where d.wallet = p_wallet returning d.cell_id)
      select distinct gone.cell_id from gone
    loop
      perform public.recompute_cell(v_cell);
    end loop;
  end if;

  update public.players p
  set faction_id = p_faction,
      reserve = p.force,
      faction_switches = p.faction_switches + case when v_player.faction_id is null then 0 else 1 end
  where p.wallet = p_wallet
  returning p.faction_switches into v_player.faction_switches;

  return query select p_faction, v_player.faction_id is not null and v_player.faction_id <> p_faction,
    greatest(0, p_max_switches - v_player.faction_switches);
end;
$$;

-- ---------------------------------------------------------------------------
-- banner_status — public aggregates for /join: members and force per Banner.
-- ---------------------------------------------------------------------------
create function public.banner_status()
returns table (faction_id text, members bigint, force numeric, share_pct numeric)
language sql
stable
set search_path = ''
as $$
  with t as (
    select coalesce(sum(p.force), 0) as total
    from public.players p where not p.is_excluded and p.faction_id is not null
  )
  select f.id,
    count(p.wallet),
    coalesce(sum(p.force), 0),
    case when t.total > 0 then round(coalesce(sum(p.force), 0) * 100 / t.total, 2) else 0 end
  from public.factions f
  cross join t
  left join public.players p on p.faction_id = f.id and not p.is_excluded
  group by f.id, t.total
  order by f.id;
$$;

revoke execute on function public.recompute_cell(bigint) from public, anon, authenticated;
revoke execute on function public.join_faction(text, text, numeric, integer) from public, anon, authenticated;
revoke execute on function public.banner_status() from public, anon, authenticated;
grant execute on function public.recompute_cell(bigint) to service_role;
grant execute on function public.join_faction(text, text, numeric, integer) to service_role;
grant execute on function public.banner_status() to service_role;
