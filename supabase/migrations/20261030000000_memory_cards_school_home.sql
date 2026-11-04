-- More Memory Match sample cards: school supplies and household objects
-- (feedback F6). No table or policy changes; pictures are bundled in public/seed.
-- Idempotent: a row is skipped when its image_path already exists.
insert into public.memory_cards (word, image_path, audio_path, active)
select v.word, v.image_path, null, true
from (values
  ('ruler', 'seed/ruler.svg'),
  ('pencil', 'seed/pencil.svg'),
  ('pen', 'seed/pen.svg'),
  ('eraser', 'seed/eraser.svg'),
  ('book', 'seed/book.svg'),
  ('scissors', 'seed/scissors.svg'),
  ('backpack', 'seed/backpack.svg'),
  ('cup', 'seed/cup.svg'),
  ('chair', 'seed/chair.svg'),
  ('clock', 'seed/clock.svg')
) as v(word, image_path)
where not exists (
  select 1 from public.memory_cards c where c.image_path = v.image_path
);
