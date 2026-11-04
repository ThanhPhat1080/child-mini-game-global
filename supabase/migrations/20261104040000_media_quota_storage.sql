-- Phase 3 multi-user: media owner folders, per-owner quota and safe delete (spec Q1-Q6).
--
-- Files live at media/<owner_id>/... Only parents and Super Admins write, and only under their
-- own folder; every signed-in user can read (media_read_authenticated, media_read stay).
-- The per-file 2 MB limit for sounds is UI-only (Q5); images keep the 2 MB policy check.

-- Every path that content or settings can point at, across all owners, ignoring RLS (Q6).
-- Mirrors MEDIA_SOURCES in lib/media/refs.ts.
create or replace function public.media_in_use(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_path is not null and p_path <> '' and (
    exists (select 1 from public.child_settings c where p_path in
      (c.greeting_path, c.music_path, c.avatar_path, c.hooray_path, c.ohoh_path, c.complete_path))
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

-- Bytes stored under an owner's folder in the media bucket.
create or replace function public.storage_used(p_owner uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(coalesce((o.metadata ->> 'size')::bigint, 0)), 0)::bigint
    from storage.objects o
   where o.bucket_id = 'media' and (storage.foldername(o.name))[1] = p_owner::text;
$$;

revoke all on function public.media_in_use(text) from public;
revoke all on function public.storage_used(uuid) from public;
grant execute on function public.media_in_use(text) to authenticated, service_role;
grant execute on function public.storage_used(uuid) to authenticated, service_role;

-- Q4: one upload at a time per owner (advisory lock until commit), so two racing uploads cannot
-- both pass the check.
create or replace function public.enforce_media_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  folder text := (storage.foldername(new.name))[1];
  owner uuid;
  quota bigint;
  added bigint := coalesce((new.metadata ->> 'size')::bigint, 0);
begin
  if new.bucket_id is distinct from 'media' or folder is null
     or folder !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return new;
  end if;
  owner := folder::uuid;
  select p.quota_bytes into quota from public.profiles p where p.user_id = owner;
  if quota is null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('media_quota:' || owner::text));
  if public.storage_used(owner) + added > quota then
    raise exception 'quota_exceeded: the % folder would pass its % byte quota', owner, quota
      using errcode = '53100';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_media_quota() from public, anon, authenticated;

create trigger media_quota
  before insert on storage.objects
  for each row execute function public.enforce_media_quota();

-- Write policies: own folder, non-child, not banned. Delete also needs the file to be unused.
drop policy if exists media_admin_insert on storage.objects;
drop policy if exists media_admin_update on storage.objects;
drop policy if exists media_admin_delete on storage.objects;

create or replace function public.can_write_media(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.current_role() in ('super_admin', 'parent')
    and (storage.foldername(p_name))[1] = auth.uid()::text
    and not public.is_banned(auth.uid()),
    false);
$$;
revoke all on function public.can_write_media(text) from public;
grant execute on function public.can_write_media(text) to authenticated, service_role;

create policy media_owner_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media' and public.can_write_media(name) and (
      (metadata ->> 'mimetype' in ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml')
        and (metadata ->> 'size')::bigint <= 2097152)
      or metadata ->> 'mimetype' like 'audio/%'
    )
  );

create policy media_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.can_write_media(name))
  with check (
    bucket_id = 'media' and public.can_write_media(name) and (
      (metadata ->> 'mimetype' in ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml')
        and (metadata ->> 'size')::bigint <= 2097152)
      or metadata ->> 'mimetype' like 'audio/%'
    )
  );

create policy media_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.can_write_media(name) and not public.media_in_use(name));

-- Nothing references is_admin() any more once the old media policies are gone.
drop function if exists public.is_admin();
