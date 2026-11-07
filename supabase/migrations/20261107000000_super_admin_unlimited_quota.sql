-- Super Admins have no storage quota: their folder is not checked against profiles.quota_bytes.
-- Parents keep their per-owner quota (Q4). Everything else in enforce_media_quota is unchanged.

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
  owner_role text;
  added bigint := coalesce(public.media_size(new.metadata), 0);
begin
  if new.bucket_id is distinct from 'media' or folder is null
     or folder !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return new;
  end if;
  owner := folder::uuid;
  select p.quota_bytes, p.role into quota, owner_role from public.profiles p where p.user_id = owner;
  if quota is null or owner_role = 'super_admin' then
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
