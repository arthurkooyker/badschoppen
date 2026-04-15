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

create index if not exists idx_household_invites_household_id on public.household_invites(household_id);
create index if not exists idx_household_invites_invite_code on public.household_invites(invite_code);

drop trigger if exists set_household_invites_updated_at on public.household_invites;
create trigger set_household_invites_updated_at
before update on public.household_invites
for each row execute function public.set_updated_at();

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

grant execute on function public.create_household_invite(uuid) to authenticated;
grant execute on function public.join_household_by_invite(text) to authenticated;

alter table public.household_invites enable row level security;

drop policy if exists "household_invites_select_same_household" on public.household_invites;
create policy "household_invites_select_same_household"
on public.household_invites for select
using (public.is_household_member(household_id));

