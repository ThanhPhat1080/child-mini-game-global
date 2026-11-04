-- Phase 3 multi-user: per-child settings replace the singleton public.settings (spec U4).
--
-- One row per child, created by a trigger when a child profile is inserted (so the server route
-- that creates a child needs no second insert). A parent edits only their own children's rows,
-- a child reads only their own, a Super Admin reads and edits all. If a child already exists when
-- this runs, the old singleton is copied into the first one.

create table public.child_settings (
  child_id uuid primary key references public.profiles (user_id) on delete cascade,
  child_name text,
  greeting_path text,
  music_path text,
  music_volume int not null default 30 check (music_volume between 0 and 100),
  avatar_path text,
  hooray_path text,
  ohoh_path text,
  complete_path text
);

create or replace function public.create_child_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.child_settings (child_id, child_name)
    values (new.user_id, new.display_name)
    on conflict (child_id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_child_settings() from public, anon, authenticated;

create trigger profiles_create_child_settings
  after insert on public.profiles
  for each row when (new.role = 'child')
  execute function public.create_child_settings();

-- Existing children get a row; the first one inherits the old singleton.
insert into public.child_settings (child_id, child_name)
  select p.user_id, p.display_name from public.profiles p where p.role = 'child'
  on conflict (child_id) do nothing;

update public.child_settings cs
  set child_name = coalesce(nullif(s.child_name, ''), cs.child_name),
      greeting_path = s.greeting_path,
      music_path = s.music_path,
      music_volume = s.music_volume,
      avatar_path = s.avatar_path,
      hooray_path = s.hooray_path,
      ohoh_path = s.ohoh_path,
      complete_path = s.complete_path
  from public.settings s
  where s.id = 1
    and cs.child_id = (select p.user_id from public.profiles p
                        where p.role = 'child' order by p.created_at, p.user_id limit 1);

drop table public.settings;

alter table public.child_settings enable row level security;
revoke all on public.child_settings from anon, public;
grant select, update on public.child_settings to authenticated;
grant all on public.child_settings to service_role;

create policy child_settings_select on public.child_settings for select to authenticated
  using (
    child_id = auth.uid()
    or public.current_role() = 'super_admin'
    or exists (select 1 from public.profiles p where p.user_id = child_id and p.parent_id = auth.uid())
  );

create policy child_settings_update on public.child_settings for update to authenticated
  using (
    public.current_role() = 'super_admin'
    or (not public.is_banned(auth.uid())
        and exists (select 1 from public.profiles p where p.user_id = child_id and p.parent_id = auth.uid()))
  )
  with check (
    public.current_role() = 'super_admin'
    or (not public.is_banned(auth.uid())
        and exists (select 1 from public.profiles p where p.user_id = child_id and p.parent_id = auth.uid()))
  );
