-- A parent's picture lives in the parent's own folder (spec 2026-11-07, PR2; the media bucket keeps owner folders, Q1).
-- Follows 20261107100000_parent_profile_inbox.sql. It is written so it runs once whichever version of that file was
-- applied: the constraint is added only when it is missing.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_avatar_folder_check'
  ) then
    alter table public.profiles add constraint profiles_avatar_folder_check check (
      avatar_path is null or avatar_path like user_id::text || '/%'
    );
  end if;
end;
$$;
