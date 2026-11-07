-- Parent profile and Super Admin contacts (spec 2026-11-07, PR1-PR5, SA1).
-- Additive: new columns, a column grant, an own-row update policy and one function. No existing row changes.

alter table public.profiles add column phone text;
alter table public.profiles add column avatar_path text;

alter table public.profiles add constraint profiles_phone_check check (
  phone is null or (
    phone = btrim(phone)
    and phone ~ '^\+?[0-9 ().-]{8,20}$'
    and length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 8
  )
);

-- not valid: existing rows are not checked at once; every new write is.
alter table public.profiles add constraint profiles_display_name_check check (
  display_name is null or char_length(btrim(display_name)) between 1 and 40
) not valid;

-- Only these three columns: role, banned and quota_bytes stay out of reach of the parent.
grant update (display_name, phone, avatar_path) on public.profiles to authenticated;

create policy profiles_update_own on public.profiles for update to authenticated
  using (user_id = auth.uid() and banned = false)
  with check (user_id = auth.uid() and banned = false);

-- The Super Admin's list of parents with their sign-in email (email lives in auth.users, never in profiles).
create or replace function public.super_admin_parent_contacts()
returns table (user_id uuid, display_name text, email text, phone text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_role() is distinct from 'super_admin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select p.user_id, p.display_name, u.email::text, p.phone
    from public.profiles p
    join auth.users u on u.id = p.user_id
    where p.role = 'parent'
    order by p.created_at;
end;
$$;

revoke all on function public.super_admin_parent_contacts() from public, anon;
grant execute on function public.super_admin_parent_contacts() to authenticated;
