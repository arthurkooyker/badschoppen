create or replace function public.create_household_with_owner(household_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.households (name)
  values (household_name)
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, auth.uid(), 'owner');

  return new_household_id;
end;
$$;

create or replace function public.get_my_households()
returns table (
  id uuid,
  name text,
  role text
)
language sql
security definer
set search_path = public
stable
as $$
  select h.id, h.name, hm.role
  from public.households h
  join public.household_members hm on hm.household_id = h.id
  where hm.user_id = auth.uid()
  order by h.created_at asc;
$$;

grant execute on function public.create_household_with_owner(text) to authenticated;
grant execute on function public.get_my_households() to authenticated;
