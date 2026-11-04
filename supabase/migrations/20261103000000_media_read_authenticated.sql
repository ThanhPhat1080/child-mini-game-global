-- Signed-in admins must be able to list the media bucket (library pop-up and Media page).
create policy media_read_authenticated on storage.objects
  for select to authenticated
  using (bucket_id = 'media');
