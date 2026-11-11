-- Rule 4: a base camp is impregnable. Its cells belong to their Banner all season long,
-- even without soldiers, and only that Banner's members may deploy there.

-- 1. Ownership can never drift away from the camp's Banner.
alter table public.cells
  add constraint cells_base_camp_owned
  check (base_faction_id is null or owner_faction_id = base_faction_id);

-- 2. No enemy deployment on a base camp, whatever code path writes it.
create function public.forbid_enemy_on_base_camp()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  camp text;
  banner text;
begin
  select c.base_faction_id into camp from public.cells c where c.id = new.cell_id;
  if camp is null then
    return new;
  end if;
  select p.faction_id into banner from public.players p where p.wallet = new.wallet;
  if banner is distinct from camp then
    raise exception 'base camp of % is impregnable', camp using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.forbid_enemy_on_base_camp() from public, anon, authenticated;

create trigger deployments_base_camp
before insert or update of cell_id, wallet on public.deployments
for each row execute function public.forbid_enemy_on_base_camp();
