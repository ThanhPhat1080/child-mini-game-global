-- Storage does not reliably expose size/mimetype in object metadata when the
-- insert policy runs, so those checks rejected real uploads. Types are enforced by
-- the bucket (allowed_mime_types, file_size_limit); the 2 MB image limit is enforced in the app.
drop policy if exists media_admin_insert on storage.objects;
drop policy if exists media_admin_update on storage.objects;

create policy media_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());

create policy media_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());
