-- Children as a plain table (spec 2026-11-05-children-table K1-K6, section 8).
--
-- A child stops being an Auth user with role `child`; it becomes a row in public.children owned
-- by a parent. Only meant for a product with no real families yet: old child accounts are deleted.

-- K1: the table. child_name is the immutable login name (unique service-wide, compared
-- case-insensitively after trimming and collapsing runs of whitespace).
create table public.children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null default auth.uid() references public.profiles (user_id) on delete cascade,
  child_name text not null check (char_length(btrim(child_name)) between 1 and 40),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  avatar_path text,
  gender text not null check (gender in ('male', 'female')),
  age_band text not null check (age_band in ('2-5', '5-10')),
  pin text not null check (pin ~ '^[A-Za-z0-9]{4}$'),
  created_at timestamptz not null default now()
);
create unique index children_child_name_key
  on public.children (lower(regexp_replace(btrim(child_name), '\s+', ' ', 'g')));
create index children_parent_id_idx on public.children (parent_id);

-- K2: at most 5 children per parent. The advisory lock serialises slot checks per parent so two
-- concurrent inserts cannot both take the last slot.
create or replace function public.children_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  perform pg_advisory_xact_lock(hashtext(new.parent_id::text));
  select count(*) into n from public.children c where c.parent_id = new.parent_id;
  if n >= 5 then
    raise exception 'too_many_children: a parent has at most 5 children' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- K3: login name and owner never change.
create or replace function public.children_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.child_name is distinct from old.child_name or new.parent_id is distinct from old.parent_id then
    raise exception 'child_immutable: child_name and parent_id cannot be changed' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.children_limit() from public, anon, authenticated;
revoke all on function public.children_immutable() from public, anon, authenticated;

create trigger children_limit
  before insert on public.children
  for each row execute function public.children_limit();
create trigger children_immutable
  before update on public.children
  for each row execute function public.children_immutable();

-- K6: RLS. A parent has full access to their own rows (writes need a non-banned parent); a Super
-- Admin selects and deletes all; anon has nothing.
alter table public.children enable row level security;
revoke all on public.children from anon, public;
grant select, insert, update, delete on public.children to authenticated;
grant all on public.children to service_role;

create policy children_select on public.children for select to authenticated
  using (parent_id = auth.uid() or public.current_role() = 'super_admin');

create policy children_insert on public.children for insert to authenticated
  with check (parent_id = auth.uid() and public.current_role() = 'parent' and not public.is_banned(auth.uid()));

create policy children_update on public.children for update to authenticated
  using (parent_id = auth.uid() and public.current_role() = 'parent' and not public.is_banned(auth.uid()))
  with check (parent_id = auth.uid() and public.current_role() = 'parent' and not public.is_banned(auth.uid()));

create policy children_delete on public.children for delete to authenticated
  using (
    public.current_role() = 'super_admin'
    or (parent_id = auth.uid() and public.current_role() = 'parent' and not public.is_banned(auth.uid()))
  );

-- Remove old child accounts. Deleting auth.users cascades to profiles and old child_settings rows.
delete from auth.users u
  where u.id in (select p.user_id from public.profiles p where p.role = 'child');

-- Policies that read profiles.parent_id go before the column does.
drop policy profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.current_role() = 'super_admin');

drop policy child_settings_select on public.child_settings;
drop policy child_settings_update on public.child_settings;
drop trigger profiles_create_child_settings on public.profiles;

-- The profile guard only had child rules and the parent_id rule.
drop trigger profiles_guard on public.profiles;
drop function public.profiles_guard();

alter table public.profiles drop column parent_id;
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('super_admin', 'parent'));

-- owner_scope() and can_read_content() lose their child branch.
create or replace function public.owner_scope()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case p.role when 'parent' then p.user_id end
    from public.profiles p where p.user_id = auth.uid();
$$;

create or replace function public.can_read_content(o uuid, v public.visibility, published boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case public.current_role()
      when 'super_admin' then true
      when 'parent' then not public.is_banned(o) and (o = auth.uid() or (v = 'global' and published))
      else false
    end,
    false);
$$;

-- K5: child_settings is re-keyed to children; name and avatar move to children.
delete from public.child_settings;
alter table public.child_settings drop constraint child_settings_child_id_fkey;
alter table public.child_settings drop column child_name;
alter table public.child_settings drop column avatar_path;
alter table public.child_settings
  add constraint child_settings_child_id_fkey
  foreign key (child_id) references public.children (id) on delete cascade;

create or replace function public.create_child_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.child_settings (child_id) values (new.id) on conflict (child_id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_child_settings() from public, anon, authenticated;

create trigger children_create_settings
  after insert on public.children
  for each row execute function public.create_child_settings();

create policy child_settings_select on public.child_settings for select to authenticated
  using (
    public.current_role() = 'super_admin'
    or exists (select 1 from public.children c where c.id = child_id and c.parent_id = auth.uid())
  );

create policy child_settings_update on public.child_settings for update to authenticated
  using (
    public.current_role() = 'super_admin'
    or (not public.is_banned(auth.uid())
        and exists (select 1 from public.children c where c.id = child_id and c.parent_id = auth.uid()))
  )
  with check (
    public.current_role() = 'super_admin'
    or (not public.is_banned(auth.uid())
        and exists (select 1 from public.children c where c.id = child_id and c.parent_id = auth.uid()))
  );

-- media_in_use() read child_settings.avatar_path; the avatar now lives on children.
create or replace function public.media_in_use(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_path is not null and p_path <> '' and (
    exists (select 1 from public.children ch where ch.avatar_path = p_path)
    or exists (select 1 from public.child_settings c where p_path in
      (c.greeting_path, c.music_path, c.hooray_path, c.ohoh_path, c.complete_path))
    or exists (select 1 from public.quiz_sets s where s.cover_path = p_path)
    or exists (select 1 from public.questions q where p_path in (q.prompt_image_path, q.prompt_audio_path))
    or exists (select 1 from public.answers a where a.image_path = p_path)
    or exists (select 1 from public.memory_cards m where p_path in (m.image_path, m.audio_path))
    or exists (select 1 from public.spot_levels l where p_path in (l.image_a_path, l.image_b_path))
    or exists (select 1 from public.find_levels f where f.image_path = p_path)
    or exists (
      select 1 from public.find_levels f, jsonb_array_elements(f.objects) o
      where o ->> 'audio_path' = p_path)
  );
$$;
