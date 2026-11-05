-- Newer Storage versions put the upload size in metadata.contentLength when the row is first
-- inserted (older ones used metadata.size). The write policies and the quota trigger only read
-- 'size', so on those versions every upload failed with "new row violates row-level security
-- policy" and the quota counted 0 bytes. Read either key.

create or replace function public.media_size(p_metadata jsonb)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select coalesce((p_metadata ->> 'size')::bigint, (p_metadata ->> 'contentLength')::bigint);
$$;
grant execute on function public.media_size(jsonb) to authenticated, service_role;

create or replace function public.storage_used(p_owner uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(coalesce(public.media_size(o.metadata), 0)), 0)::bigint
    from storage.objects o
   where o.bucket_id = 'media' and (storage.foldername(o.name))[1] = p_owner::text;
$$;

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
  added bigint := coalesce(public.media_size(new.metadata), 0);
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

drop policy if exists media_owner_insert on storage.objects;
drop policy if exists media_owner_update on storage.objects;

create policy media_owner_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media' and public.can_write_media(name) and (
      (metadata ->> 'mimetype' in ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml')
        and public.media_size(metadata) <= 2097152)
      or metadata ->> 'mimetype' like 'audio/%'
    )
  );

create policy media_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.can_write_media(name))
  with check (
    bucket_id = 'media' and public.can_write_media(name) and (
      (metadata ->> 'mimetype' in ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml')
        and public.media_size(metadata) <= 2097152)
      or metadata ->> 'mimetype' like 'audio/%'
    )
  );
