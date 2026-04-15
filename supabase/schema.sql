create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (household_id, user_id)
);

create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.recipes (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  notes text not null default '',
  servings integer not null default 4,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.recipe_ingredients (
  id uuid primary key,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  name text not null,
  amount numeric not null default 1,
  unit text not null,
  shelf text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.recipe_labels (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  label text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (recipe_id, label)
);

create table if not exists public.groceries (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  amount numeric not null default 1,
  unit text not null default 'stuk',
  shelf text not null default 'overig',
  enabled boolean not null default true,
  category text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.supermarkets (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  is_favorite boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.supermarket_route_items (
  id uuid primary key default gen_random_uuid(),
  supermarket_id uuid not null references public.supermarkets(id) on delete cascade,
  shelf text not null,
  sort_order integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (supermarket_id, shelf),
  unique (supermarket_id, sort_order)
);

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null default 'Actieve boodschappenlijst',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.shopping_list_recipes (
  id uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null references public.shopping_lists(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  servings integer not null,
  included boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (shopping_list_id, recipe_id)
);

create table if not exists public.shopping_list_groceries (
  id uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null references public.shopping_lists(id) on delete cascade,
  grocery_id uuid not null references public.groceries(id) on delete cascade,
  included boolean not null default true,
  checked boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (shopping_list_id, grocery_id)
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  theme_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id)
);

create index if not exists idx_household_members_user_id on public.household_members(user_id);
create index if not exists idx_household_invites_household_id on public.household_invites(household_id);
create index if not exists idx_household_invites_invite_code on public.household_invites(invite_code);
create index if not exists idx_recipes_household_id on public.recipes(household_id);
create index if not exists idx_recipe_ingredients_recipe_id on public.recipe_ingredients(recipe_id);
create index if not exists idx_recipe_labels_recipe_id on public.recipe_labels(recipe_id);
create index if not exists idx_groceries_household_id on public.groceries(household_id);
create index if not exists idx_supermarkets_household_id on public.supermarkets(household_id);
create index if not exists idx_supermarket_route_items_supermarket_id on public.supermarket_route_items(supermarket_id);
create index if not exists idx_shopping_lists_household_id on public.shopping_lists(household_id);
create index if not exists idx_shopping_list_recipes_shopping_list_id on public.shopping_list_recipes(shopping_list_id);
create index if not exists idx_shopping_list_groceries_shopping_list_id on public.shopping_list_groceries(shopping_list_id);

drop trigger if exists set_households_updated_at on public.households;
create trigger set_households_updated_at
before update on public.households
for each row execute function public.set_updated_at();

drop trigger if exists set_household_members_updated_at on public.household_members;
create trigger set_household_members_updated_at
before update on public.household_members
for each row execute function public.set_updated_at();

drop trigger if exists set_household_invites_updated_at on public.household_invites;
create trigger set_household_invites_updated_at
before update on public.household_invites
for each row execute function public.set_updated_at();

drop trigger if exists set_recipes_updated_at on public.recipes;
create trigger set_recipes_updated_at
before update on public.recipes
for each row execute function public.set_updated_at();

drop trigger if exists set_recipe_ingredients_updated_at on public.recipe_ingredients;
create trigger set_recipe_ingredients_updated_at
before update on public.recipe_ingredients
for each row execute function public.set_updated_at();

drop trigger if exists set_groceries_updated_at on public.groceries;
create trigger set_groceries_updated_at
before update on public.groceries
for each row execute function public.set_updated_at();

drop trigger if exists set_supermarkets_updated_at on public.supermarkets;
create trigger set_supermarkets_updated_at
before update on public.supermarkets
for each row execute function public.set_updated_at();

drop trigger if exists set_supermarket_route_items_updated_at on public.supermarket_route_items;
create trigger set_supermarket_route_items_updated_at
before update on public.supermarket_route_items
for each row execute function public.set_updated_at();

drop trigger if exists set_shopping_lists_updated_at on public.shopping_lists;
create trigger set_shopping_lists_updated_at
before update on public.shopping_lists
for each row execute function public.set_updated_at();

drop trigger if exists set_shopping_list_recipes_updated_at on public.shopping_list_recipes;
create trigger set_shopping_list_recipes_updated_at
before update on public.shopping_list_recipes
for each row execute function public.set_updated_at();

drop trigger if exists set_shopping_list_groceries_updated_at on public.shopping_list_groceries;
create trigger set_shopping_list_groceries_updated_at
before update on public.shopping_list_groceries
for each row execute function public.set_updated_at();

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = auth.uid()
  );
$$;

grant execute on function public.is_household_member(uuid) to authenticated;

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

create or replace function public.create_household_invite(target_household_id uuid)
returns table (
  invite_code text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_code text;
  generated_expires_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_household_member(target_household_id) then
    raise exception 'Not allowed to invite for this household';
  end if;

  generated_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  generated_expires_at := timezone('utc', now()) + interval '7 days';

  insert into public.household_invites (
    household_id,
    invite_code,
    created_by,
    expires_at
  )
  values (
    target_household_id,
    generated_code,
    auth.uid(),
    generated_expires_at
  );

  return query
  select generated_code, generated_expires_at;
end;
$$;

create or replace function public.join_household_by_invite(invite_code_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record public.household_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into invite_record
  from public.household_invites hi
  where hi.invite_code = upper(trim(invite_code_input))
    and hi.used_at is null
    and hi.expires_at > timezone('utc', now())
  order by hi.created_at desc
  limit 1;

  if invite_record.id is null then
    raise exception 'Invite code is ongeldig of verlopen';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (invite_record.household_id, auth.uid(), 'member')
  on conflict (household_id, user_id) do nothing;

  update public.household_invites
  set used_by = auth.uid(),
      used_at = timezone('utc', now())
  where id = invite_record.id;

  return invite_record.household_id;
end;
$$;

grant execute on function public.create_household_with_owner(text) to authenticated;
grant execute on function public.get_my_households() to authenticated;
grant execute on function public.create_household_invite(uuid) to authenticated;
grant execute on function public.join_household_by_invite(text) to authenticated;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_labels enable row level security;
alter table public.groceries enable row level security;
alter table public.supermarkets enable row level security;
alter table public.supermarket_route_items enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_recipes enable row level security;
alter table public.shopping_list_groceries enable row level security;
alter table public.user_preferences enable row level security;

drop policy if exists "households_select_members" on public.households;
create policy "households_select_members"
on public.households for select
using (public.is_household_member(id));

drop policy if exists "households_update_owner_or_member" on public.households;
create policy "households_update_owner_or_member"
on public.households for update
using (public.is_household_member(id))
with check (public.is_household_member(id));

drop policy if exists "household_members_select_same_household" on public.household_members;
create policy "household_members_select_same_household"
on public.household_members for select
using (public.is_household_member(household_id));

drop policy if exists "household_members_insert_same_household" on public.household_members;
create policy "household_members_insert_same_household"
on public.household_members for insert
with check (public.is_household_member(household_id));

drop policy if exists "household_members_update_same_household" on public.household_members;
create policy "household_members_update_same_household"
on public.household_members for update
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

drop policy if exists "household_invites_select_same_household" on public.household_invites;
create policy "household_invites_select_same_household"
on public.household_invites for select
using (public.is_household_member(household_id));

drop policy if exists "recipes_all_same_household" on public.recipes;
create policy "recipes_all_same_household"
on public.recipes for all
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

drop policy if exists "recipe_ingredients_all_same_household" on public.recipe_ingredients;
create policy "recipe_ingredients_all_same_household"
on public.recipe_ingredients for all
using (
  exists (
    select 1
    from public.recipes r
    where r.id = recipe_id
      and public.is_household_member(r.household_id)
  )
)
with check (
  exists (
    select 1
    from public.recipes r
    where r.id = recipe_id
      and public.is_household_member(r.household_id)
  )
);

drop policy if exists "recipe_labels_all_same_household" on public.recipe_labels;
create policy "recipe_labels_all_same_household"
on public.recipe_labels for all
using (
  exists (
    select 1
    from public.recipes r
    where r.id = recipe_id
      and public.is_household_member(r.household_id)
  )
)
with check (
  exists (
    select 1
    from public.recipes r
    where r.id = recipe_id
      and public.is_household_member(r.household_id)
  )
);

drop policy if exists "groceries_all_same_household" on public.groceries;
create policy "groceries_all_same_household"
on public.groceries for all
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

drop policy if exists "supermarkets_all_same_household" on public.supermarkets;
create policy "supermarkets_all_same_household"
on public.supermarkets for all
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

drop policy if exists "supermarket_route_items_all_same_household" on public.supermarket_route_items;
create policy "supermarket_route_items_all_same_household"
on public.supermarket_route_items for all
using (
  exists (
    select 1
    from public.supermarkets s
    where s.id = supermarket_id
      and public.is_household_member(s.household_id)
  )
)
with check (
  exists (
    select 1
    from public.supermarkets s
    where s.id = supermarket_id
      and public.is_household_member(s.household_id)
  )
);

drop policy if exists "shopping_lists_all_same_household" on public.shopping_lists;
create policy "shopping_lists_all_same_household"
on public.shopping_lists for all
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

drop policy if exists "shopping_list_recipes_all_same_household" on public.shopping_list_recipes;
create policy "shopping_list_recipes_all_same_household"
on public.shopping_list_recipes for all
using (
  exists (
    select 1
    from public.shopping_lists sl
    where sl.id = shopping_list_id
      and public.is_household_member(sl.household_id)
  )
)
with check (
  exists (
    select 1
    from public.shopping_lists sl
    where sl.id = shopping_list_id
      and public.is_household_member(sl.household_id)
  )
);

drop policy if exists "shopping_list_groceries_all_same_household" on public.shopping_list_groceries;
create policy "shopping_list_groceries_all_same_household"
on public.shopping_list_groceries for all
using (
  exists (
    select 1
    from public.shopping_lists sl
    where sl.id = shopping_list_id
      and public.is_household_member(sl.household_id)
  )
)
with check (
  exists (
    select 1
    from public.shopping_lists sl
    where sl.id = shopping_list_id
      and public.is_household_member(sl.household_id)
  )
);

drop policy if exists "user_preferences_own_rows" on public.user_preferences;
create policy "user_preferences_own_rows"
on public.user_preferences for all
using (user_id = auth.uid())
with check (user_id = auth.uid());
