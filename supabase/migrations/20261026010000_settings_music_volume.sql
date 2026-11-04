alter table public.settings
  add column music_volume int not null default 30 check (music_volume between 0 and 100);
