-- Step 4 — on-chain balances become soldiers (rules 1, 2, 6). Server only.

alter table public.players add column balance_synced_at timestamptz;

-- ---------------------------------------------------------------------------
-- apply_balance — called with a balance READ BY RPC (never taken from a webhook body).
-- One transaction, player row locked.
--   rule 1: soldiers = floor(balance / units per soldier)
--   rule 2: seniority grows with time; a balance increase (buy or incoming
--           transfer) dilutes it: age × old / new. A decrease leaves it unchanged.
--           force = soldiers × (1 + min(age, 30) / 30)
--   rule 6: if force falls below what is deployed, the reserve goes first (it is
--           already empty then), and every deployment loses the same proportion.
--   rule 10: excluded wallets have no force.
-- Every balance change is written to balance_history (hourly minimum force, rule 7).
-- ---------------------------------------------------------------------------
create function public.apply_balance(
  p_wallet text,
  p_balance numeric,
  p_units_per_soldier numeric,
  p_veteran_days numeric default 30
)
returns table (soldiers bigint, force bigint, reserve bigint, deployed bigint, age_days numeric, trimmed boolean)
language plpgsql
set search_path = ''
as $$
declare
  v public.players;
  v_now timestamptz := now();
  v_age numeric;
  v_soldiers bigint;
  v_force bigint;
  v_deployed bigint;
  v_ratio numeric;
  v_cells bigint[];
  v_cell bigint;
  v_trimmed boolean := false;
begin
  if p_balance < 0 or p_units_per_soldier <= 0 then
    raise exception 'invalid_balance';
  end if;

  select * into v from public.players p where p.wallet = p_wallet for update;
  if not found then
    return; -- not a player: nothing to do
  end if;

  v_age := v.age_days + extract(epoch from (v_now - v.age_updated_at)) / 86400.0;
  if p_balance > v.balance then
    v_age := v_age * v.balance / p_balance; -- fresh tokens dilute seniority
  end if;

  v_soldiers := floor(p_balance / p_units_per_soldier);
  v_force := case
    when v.is_excluded then 0
    else floor(v_soldiers * (1 + least(v_age, p_veteran_days) / p_veteran_days))
  end;

  select coalesce(sum(d.force), 0) into v_deployed from public.deployments d where d.wallet = p_wallet;

  if v_deployed > v_force then
    v_trimmed := true;
    v_ratio := v_force::numeric / v_deployed;
    with del as (
      delete from public.deployments d
      where d.wallet = p_wallet and floor(d.force * v_ratio) = 0
      returning d.cell_id
    ),
    upd as (
      update public.deployments d set force = floor(d.force * v_ratio)
      where d.wallet = p_wallet and floor(d.force * v_ratio) > 0
      returning d.cell_id
    )
    select array_agg(x.cell_id) into v_cells
    from (select del.cell_id from del union select upd.cell_id from upd) x;

    foreach v_cell in array coalesce(v_cells, '{}') loop
      perform public.recompute_cell(v_cell);
    end loop;

    select coalesce(sum(d.force), 0) into v_deployed from public.deployments d where d.wallet = p_wallet;
  end if;

  update public.players p
  set balance = p_balance,
      age_days = round(v_age, 4),
      age_updated_at = v_now,
      force = v_force,
      reserve = greatest(0, v_force - v_deployed),
      balance_synced_at = v_now
  where p.wallet = p_wallet;

  if p_balance is distinct from v.balance
     or not exists (select 1 from public.balance_history h where h.wallet = p_wallet) then
    insert into public.balance_history (wallet, balance, observed_at) values (p_wallet, p_balance, v_now);
  end if;

  return query select v_soldiers, v_force, greatest(0, v_force - v_deployed), v_deployed, round(v_age, 4), v_trimmed;
end;
$$;

revoke execute on function public.apply_balance(text, numeric, numeric, numeric) from public, anon, authenticated;
grant execute on function public.apply_balance(text, numeric, numeric, numeric) to service_role;
