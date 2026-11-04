-- Memory Match cards (spec A11, design 2026-10-29-memory-match section 5).
-- The picture of a card is `image_path`; paths starting with `seed/` are bundled
-- in the app (public/seed) and are never deleted from Storage.

create table if not exists public.memory_cards (
  id uuid primary key default gen_random_uuid(),
  word text not null check (char_length(btrim(word)) between 1 and 40),
  image_path text not null,
  audio_path text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.memory_cards enable row level security;

create policy memory_cards_read_active on public.memory_cards for select to anon, authenticated
  using (active);
create policy memory_cards_admin_all on public.memory_cards for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Sample cards (idempotent: a row is skipped when its image_path already exists).
insert into public.memory_cards (word, image_path, audio_path, active)
select v.word, v.image_path, null, true
from (values
  ('apple', 'seed/apple.svg'),
  ('ball', 'seed/ball.svg'),
  ('banana', 'seed/banana.svg'),
  ('berry', 'seed/berry.svg'),
  ('bird', 'seed/bird.svg'),
  ('car', 'seed/car.svg'),
  ('cat', 'seed/cat.svg'),
  ('circle', 'seed/circle.svg'),
  ('cookie', 'seed/cookie.svg'),
  ('duck', 'seed/duck.svg'),
  ('fish', 'seed/fish.svg'),
  ('flower', 'seed/flower.svg'),
  ('grapes', 'seed/grapes.svg'),
  ('heart', 'seed/heart.svg'),
  ('house', 'seed/house.svg'),
  ('moon', 'seed/moon.svg'),
  ('square', 'seed/square.svg'),
  ('star', 'seed/star.svg'),
  ('sun', 'seed/sun.svg'),
  ('tree', 'seed/tree.svg'),
  ('triangle', 'seed/triangle.svg')
) as v(word, image_path)
where not exists (
  select 1 from public.memory_cards c where c.image_path = v.image_path
);
