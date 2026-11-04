-- SVG pictures: sharp at any size, best for question and answer images. Added to the bucket allow-list.
-- Idempotent, and keeps any other types already allowed.
update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types, 'image/svg+xml')
where id = 'media'
  and allowed_mime_types is not null
  and not ('image/svg+xml' = any (allowed_mime_types));
