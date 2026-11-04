-- Custom sound tracks for the feedback moments. Null = built-in default sound.
alter table public.settings
  add column if not exists hooray_path text,
  add column if not exists ohoh_path text,
  add column if not exists complete_path text;
