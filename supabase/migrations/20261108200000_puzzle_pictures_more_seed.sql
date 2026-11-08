-- Puzzle Pairs: the 31 pictures drawn for the Body, Home, Clothes and Furniture quiz sets, added to the list
-- switched OFF. The Super Admin turns on the ones to play on /admin/puzzle (spec A32, A35); a new level draws 4
-- of the pictures that are on at random (H2). Skips a row whose picture is already listed, so it is safe to re-run.
insert into public.puzzle_pictures (word, image_path, active, sort_order, owner_id)
select v.word, v.image_path, false, v.sort_order, null
from (values
  ('eye', 'seed/eye.svg', 4),
  ('ear', 'seed/ear.svg', 5),
  ('nose', 'seed/nose.svg', 6),
  ('mouth', 'seed/mouth.svg', 7),
  ('hand', 'seed/hand.svg', 8),
  ('foot', 'seed/foot.svg', 9),
  ('hair', 'seed/hair.svg', 10),
  ('tooth', 'seed/tooth.svg', 11),
  ('spoon', 'seed/spoon.svg', 12),
  ('bowl', 'seed/bowl.svg', 13),
  ('toothbrush', 'seed/toothbrush.svg', 14),
  ('key', 'seed/key.svg', 15),
  ('lamp', 'seed/lamp.svg', 16),
  ('umbrella', 'seed/umbrella.svg', 17),
  ('towel', 'seed/towel.svg', 18),
  ('broom', 'seed/broom.svg', 19),
  ('shirt', 'seed/shirt.svg', 20),
  ('pants', 'seed/pants.svg', 21),
  ('dress', 'seed/dress.svg', 22),
  ('hat', 'seed/hat.svg', 23),
  ('socks', 'seed/socks.svg', 24),
  ('shoes', 'seed/shoes.svg', 25),
  ('jacket', 'seed/jacket.svg', 26),
  ('gloves', 'seed/gloves.svg', 27),
  ('bed', 'seed/bed.svg', 28),
  ('table', 'seed/table.svg', 29),
  ('sofa', 'seed/sofa.svg', 30),
  ('wardrobe', 'seed/wardrobe.svg', 31),
  ('tv', 'seed/tv.svg', 32),
  ('mirror', 'seed/mirror.svg', 33),
  ('shelf', 'seed/shelf.svg', 34)
) as v(word, image_path, sort_order)
where not exists (select 1 from public.puzzle_pictures p where p.image_path = v.image_path);
