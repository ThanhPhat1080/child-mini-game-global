-- Phase 3 multi-user: profiles, roles and helper functions (spec U1, U2, U5, U6).
--
-- Who creates profiles:
--   * Parent self sign-up: the trigger on auth.users below. Sign-up metadata must carry
--     policy_version (U16) and must not carry role or parent_id (rejected: forbidden_metadata).
--   * Children and Super Admins: server routes using the service role create the auth user with
--     app metadata {"provisioned": true} (only the admin API can set app metadata) and insert the
--     profile themselves. The trigger creates no profile for provisioned users.
--
-- U6, first Super Admin (one-time SQL step, run in the SQL editor as postgres):
--   sign up through the app as a parent with the Super Admin's email, then
--   update public.profiles set role = 'super_admin'
--     where user_id = (select id from auth.users where email = '<super admin email>');
-- (A user created in the Supabase dashboard has no policy_version and no provisioned flag,
-- so the sign-up trigger rejects it.)
--
-- Note: current_role is an SQL keyword, so always call it schema-qualified: public.current_role().

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('super_admin', 'parent', 'child')),
  -- No cascade: a parent's profile cannot be deleted while it still has children.
  parent_id uuid references public.profiles (user_id),
  display_name text,
  banned boolean not null default false,
  ban_reason_code text,
  ban_note text,
  banned_at timestamptz,
  policy_version_accepted text,
  policy_accepted_at timestamptz,
  quota_bytes bigint not null default 52428800,
  created_at timestamptz not null default now()
);
create index profiles_parent_id_idx on public.profiles (parent_id);

-- Role rules (U1): a child has a parent whose role is parent; a parent has at most 5 children;
-- roles other than child have no parent_id; a parent with children keeps role parent.
create or replace function public.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_role text;
  n int;
begin
  if new.role = 'child' then
    if new.parent_id is null then
      raise exception 'child_needs_parent: a child profile needs a parent_id' using errcode = '23514';
    end if;
    if tg_op = 'INSERT' or new.parent_id is distinct from old.parent_id or old.role <> 'child' then
      -- Serialise slot checks per parent so two concurrent inserts cannot both take the 5th slot.
      perform pg_advisory_xact_lock(hashtext(new.parent_id::text));
      select p.role into parent_role from public.profiles p where p.user_id = new.parent_id;
      if parent_role is distinct from 'parent' then
        raise exception 'child_needs_parent: parent_id must point to a parent profile'
          using errcode = '23514';
      end if;
      select count(*) into n from public.profiles p
        where p.parent_id = new.parent_id and p.user_id <> new.user_id;
      if n >= 5 then
        raise exception 'too_many_children: a parent has at most 5 children' using errcode = '23514';
      end if;
    end if;
  elsif new.parent_id is not null then
    raise exception 'parent_id_not_allowed: only child profiles may have a parent_id'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and old.role = 'parent' and new.role <> 'parent'
     and exists (select 1 from public.profiles p where p.parent_id = new.user_id) then
    raise exception 'parent_has_children: a parent with children must keep role parent'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger profiles_guard
  before insert or update on public.profiles
  for each row execute function public.profiles_guard();

-- Parent self sign-up (U16): runs inside the auth.users insert, so a raise rejects the sign-up
-- and leaves neither the user nor a profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  version text;
begin
  if coalesce(new.raw_app_meta_data, '{}'::jsonb) ->> 'provisioned' = 'true' then
    return new; -- created by a server route, which inserts the profile itself
  end if;
  if meta ? 'role' or meta ? 'parent_id' then
    raise exception 'forbidden_metadata' using errcode = '42501',
      detail = 'sign-up metadata may not set role or parent_id';
  end if;
  version := nullif(btrim(meta ->> 'policy_version'), '');
  if version is null then
    raise exception 'policy_version_required' using errcode = '23514',
      detail = 'sign-up metadata must carry the accepted policy_version';
  end if;
  insert into public.profiles (user_id, role, policy_version_accepted, policy_accepted_at)
    values (new.id, 'parent', version, now());
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper functions (U2). Definer so they can read profiles regardless of the caller's RLS.
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.user_id = auth.uid();
$$;

create or replace function public.owner_scope()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case p.role when 'parent' then p.user_id when 'child' then p.parent_id end
    from public.profiles p where p.user_id = auth.uid();
$$;

create or replace function public.is_banned(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.banned from public.profiles p where p.user_id = uid), false);
$$;

-- Kept until the policy rewrite drops it; no longer reads public.admins.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_role() = 'super_admin', false);
$$;

revoke all on function public.profiles_guard() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.current_role() from public;
revoke all on function public.owner_scope() from public;
revoke all on function public.is_banned(uuid) from public;
grant execute on function public.current_role() to anon, authenticated, service_role;
grant execute on function public.owner_scope() to anon, authenticated, service_role;
grant execute on function public.is_banned(uuid) to anon, authenticated, service_role;

-- Existing admins keep their access as Super Admins.
insert into public.profiles (user_id, role)
  select a.user_id, 'super_admin' from public.admins a
  on conflict (user_id) do nothing;

-- RLS: read own row, a parent reads their children, a Super Admin reads all.
-- Clients never write profiles; the service role (bypassrls) and definer functions do.
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated, public;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;

create policy profiles_read on public.profiles for select to authenticated
  using (
    user_id = auth.uid()
    or parent_id = auth.uid()
    or public.current_role() = 'super_admin'
  );
