-- Aisle household sharing. Run in the Supabase SQL editor (once per project).
-- Auth: enable Email provider. For a family app, turn off "Confirm email"
-- unless you want invitees to confirm before they can join.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Family',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('adult', 'kid')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create unique index if not exists memberships_one_household_per_user
  on public.memberships (user_id);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email text not null,
  role text not null check (role in ('adult', 'kid')),
  invited_by uuid not null references public.profiles (id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now()
);

create unique index if not exists invites_one_pending_per_email
  on public.invites (household_id, email)
  where status = 'pending';

create table if not exists public.needs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  added_by uuid references public.profiles (id),
  name text not null,
  list_id text not null check (list_id in ('grocery', 'school', 'shopping', 'travel')),
  pinned_store text check (pinned_store is null or pinned_store in ('costco', 'publix', 'office-depot')),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists needs_household_idx on public.needs (household_id, created_at);

create or replace function public.aisle_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(coalesce(new.email, 'member'), '@', 1)
    )
  );
  return new;
end;
$$;

drop trigger if exists aisle_on_auth_user_created on auth.users;
create trigger aisle_on_auth_user_created
  after insert on auth.users
  for each row execute function public.aisle_handle_new_user();

create or replace function public.aisle_is_adult(p_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where household_id = p_household
      and user_id = auth.uid()
      and role = 'adult'
  );
$$;

create or replace function public.aisle_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.memberships where user_id = auth.uid() limit 1;
$$;

create or replace function public.aisle_create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to continue.';
  end if;
  if exists (select 1 from public.memberships where user_id = auth.uid()) then
    raise exception 'You already belong to a household.';
  end if;
  insert into public.households (name, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'Family'), auth.uid())
  returning id into v_id;
  insert into public.memberships (household_id, user_id, role)
  values (v_id, auth.uid(), 'adult');
  return v_id;
end;
$$;

create or replace function public.aisle_invite_member(p_email text, p_role text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid;
  v_email text;
  v_id uuid;
begin
  if p_role not in ('adult', 'kid') then
    raise exception 'Role must be adult or kid.';
  end if;
  v_household := public.aisle_household_id();
  if v_household is null or not public.aisle_is_adult(v_household) then
    raise exception 'Only adults can manage the household.';
  end if;
  v_email := lower(trim(p_email));
  if v_email is null or position('@' in v_email) = 0 then
    raise exception 'Enter a valid email address.';
  end if;
  if v_email = (select email from public.profiles where id = auth.uid()) then
    raise exception 'You are already in this household.';
  end if;
  if exists (
    select 1
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    where m.household_id = v_household and p.email = v_email
  ) then
    raise exception 'That person is already in this household.';
  end if;
  if exists (
    select 1 from public.invites
    where household_id = v_household and email = v_email and status = 'pending'
  ) then
    raise exception 'An invite is already pending for that email.';
  end if;
  insert into public.invites (household_id, email, role, invited_by)
  values (v_household, v_email, p_role, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.aisle_accept_pending()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_invite public.invites;
begin
  if auth.uid() is null then
    raise exception 'Sign in to continue.';
  end if;
  if exists (select 1 from public.memberships where user_id = auth.uid()) then
    return public.aisle_household_id();
  end if;
  select email into v_email from public.profiles where id = auth.uid();
  select * into v_invite
  from public.invites
  where email = v_email and status = 'pending'
  order by created_at desc
  limit 1;
  if v_invite.id is null then
    return null;
  end if;
  insert into public.memberships (household_id, user_id, role)
  values (v_invite.household_id, auth.uid(), v_invite.role);
  update public.invites set status = 'accepted' where id = v_invite.id;
  return v_invite.household_id;
end;
$$;

create or replace function public.aisle_accept_invite(p_invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_invite public.invites;
begin
  if exists (select 1 from public.memberships where user_id = auth.uid()) then
    raise exception 'You already belong to a household.';
  end if;
  select email into v_email from public.profiles where id = auth.uid();
  select * into v_invite from public.invites where id = p_invite_id;
  if v_invite.id is null or v_invite.status <> 'pending' or v_invite.email <> v_email then
    raise exception 'This invite is not for your email, or it is no longer valid.';
  end if;
  insert into public.memberships (household_id, user_id, role)
  values (v_invite.household_id, auth.uid(), v_invite.role);
  update public.invites set status = 'accepted' where id = v_invite.id;
  return v_invite.household_id;
end;
$$;

create or replace function public.aisle_revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid;
begin
  v_household := public.aisle_household_id();
  if v_household is null or not public.aisle_is_adult(v_household) then
    raise exception 'Only adults can manage the household.';
  end if;
  update public.invites
  set status = 'revoked'
  where id = p_invite_id and household_id = v_household;
end;
$$;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.memberships enable row level security;
alter table public.invites enable row level security;
alter table public.needs enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1
      from public.memberships me
      join public.memberships them on them.household_id = me.household_id
      where me.user_id = auth.uid()
        and them.user_id = profiles.id
        and me.role = 'adult'
    )
  );

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid());

drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select using (id = public.aisle_household_id());

drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships
  for select using (
    user_id = auth.uid()
    or (
      household_id = public.aisle_household_id()
      and public.aisle_is_adult(household_id)
    )
  );

drop policy if exists invites_select on public.invites;
create policy invites_select on public.invites
  for select using (
    email = (select email from public.profiles where id = auth.uid())
    or (
      household_id = public.aisle_household_id()
      and public.aisle_is_adult(household_id)
    )
  );

drop policy if exists needs_select on public.needs;
create policy needs_select on public.needs
  for select using (
    household_id = public.aisle_household_id()
    and (
      public.aisle_is_adult(household_id)
      or added_by = auth.uid()
    )
  );

drop policy if exists needs_insert on public.needs;
create policy needs_insert on public.needs
  for insert with check (
    household_id = public.aisle_household_id()
    and added_by = auth.uid()
  );

drop policy if exists needs_update on public.needs;
create policy needs_update on public.needs
  for update using (
    household_id = public.aisle_household_id()
    and (
      public.aisle_is_adult(household_id)
      or added_by = auth.uid()
    )
  );

drop policy if exists needs_delete on public.needs;
create policy needs_delete on public.needs
  for delete using (
    household_id = public.aisle_household_id()
    and (
      public.aisle_is_adult(household_id)
      or added_by = auth.uid()
    )
  );

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.households to authenticated;
grant select on public.memberships to authenticated;
grant select on public.invites to authenticated;
grant select, insert, update, delete on public.needs to authenticated;
grant execute on function public.aisle_create_household(text) to authenticated;
grant execute on function public.aisle_invite_member(text, text) to authenticated;
grant execute on function public.aisle_accept_pending() to authenticated;
grant execute on function public.aisle_accept_invite(uuid) to authenticated;
grant execute on function public.aisle_revoke_invite(uuid) to authenticated;
