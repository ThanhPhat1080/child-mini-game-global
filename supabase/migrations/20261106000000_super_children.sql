-- Super Admin people pages (spec 2026-11-06-super-admin-people, N16): the Super Admin adds and edits
-- a parent's children, but only their non-media fields. Select and delete already reach the Super
-- Admin (20261105020000_children_table.sql); this adds insert and update.

-- A Super Admin can add a child only for a parent profile (not for another Super Admin or a missing user).
create policy children_insert_super on public.children for insert to authenticated
  with check (
    public.current_role() = 'super_admin'
    and exists (select 1 from public.profiles p where p.user_id = parent_id and p.role = 'parent')
  );

create policy children_update_super on public.children for update to authenticated
  using (public.current_role() = 'super_admin')
  with check (
    public.current_role() = 'super_admin'
    and exists (select 1 from public.profiles p where p.user_id = parent_id and p.role = 'parent')
  );

-- A Super Admin never sets or changes the child's pictures. Parents keep full control of theirs.
create or replace function public.children_super_no_media()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Invoker on purpose: current_user must stay the caller's role (a definer would report the owner).
  -- Only client calls can be a Super Admin; the owner and service paths skip the role lookup.
  if current_user in ('anon', 'authenticated') and public.current_role() = 'super_admin' then
    if tg_op = 'INSERT' then
      if new.avatar_path is not null or new.celebrate_a_path is not null or new.celebrate_b_path is not null then
        raise exception 'super_admin_media: a Super Admin cannot set child pictures' using errcode = '23514';
      end if;
    elsif new.avatar_path is distinct from old.avatar_path
       or new.celebrate_a_path is distinct from old.celebrate_a_path
       or new.celebrate_b_path is distinct from old.celebrate_b_path then
      raise exception 'super_admin_media: a Super Admin cannot change child pictures' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.children_super_no_media() from public, anon, authenticated;

create trigger children_super_no_media
  before insert or update on public.children
  for each row execute function public.children_super_no_media();
