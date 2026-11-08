-- Seed: four more global quiz sets (Body, Home, Clothes, Furniture), 8 questions each.
-- Pictures are bundled in public/seed (pastel SVG, same style as the first seed). Platform content:
-- owned by the first Super Admin when one exists (null on a fresh project) and global, so every
-- family plays it after their own sets. Each set is inserted only when no global set has its title,
-- so the migration is safe to re-run.
do $$
declare s uuid; qid uuid; sa uuid;
begin
  select p.user_id into sa from public.profiles p where p.role = 'super_admin' order by p.created_at, p.user_id limit 1;
  if not exists (select 1 from public.quiz_sets where title = 'Body' and visibility = 'global') then
    insert into public.quiz_sets (title, subtitle, heading_color, cover_path, position, owner_id, visibility) values ('Body', 'Find the body part', '#9B5E73', 'seed/cover-body.svg', (select coalesce(max(position), -1) + 1 from public.quiz_sets), sa, 'global') returning id into s;
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 0, 'Where is the eye?', 'seed/eye.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/eye.svg', true), (qid, 2, 'seed/mouth.svg', false), (qid, 3, 'seed/foot.svg', false);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 1, 'Where is the ear?', 'seed/ear.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/hand.svg', false), (qid, 2, 'seed/ear.svg', true), (qid, 3, 'seed/hair.svg', false);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 2, 'Where is the nose?', 'seed/nose.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/foot.svg', false), (qid, 2, 'seed/tooth.svg', false), (qid, 3, 'seed/nose.svg', true);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 3, 'Where is the mouth?', 'seed/mouth.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/mouth.svg', true), (qid, 2, 'seed/hair.svg', false), (qid, 3, 'seed/eye.svg', false);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 4, 'Where is the hand?', 'seed/hand.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/tooth.svg', false), (qid, 2, 'seed/hand.svg', true), (qid, 3, 'seed/ear.svg', false);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 5, 'Where is the foot?', 'seed/foot.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/eye.svg', false), (qid, 2, 'seed/nose.svg', false), (qid, 3, 'seed/foot.svg', true);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 6, 'Where is the hair?', 'seed/hair.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/hair.svg', true), (qid, 2, 'seed/ear.svg', false), (qid, 3, 'seed/mouth.svg', false);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 7, 'Where is the tooth?', 'seed/tooth.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/nose.svg', false), (qid, 2, 'seed/tooth.svg', true), (qid, 3, 'seed/hand.svg', false);
    update public.quiz_sets set status = 'published' where id = s;
  end if;
  if not exists (select 1 from public.quiz_sets where title = 'Home' and visibility = 'global') then
    insert into public.quiz_sets (title, subtitle, heading_color, cover_path, position, owner_id, visibility) values ('Home', 'Find the thing', '#5E8A6B', 'seed/cover-home.svg', (select coalesce(max(position), -1) + 1 from public.quiz_sets), sa, 'global') returning id into s;
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 0, 'Where is the spoon?', 'seed/spoon.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/spoon.svg', true), (qid, 2, 'seed/key.svg', false), (qid, 3, 'seed/umbrella.svg', false);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 1, 'Where is the bowl?', 'seed/bowl.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/lamp.svg', false), (qid, 2, 'seed/bowl.svg', true), (qid, 3, 'seed/towel.svg', false);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 2, 'Where is the toothbrush?', 'seed/toothbrush.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/umbrella.svg', false), (qid, 2, 'seed/broom.svg', false), (qid, 3, 'seed/toothbrush.svg', true);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 3, 'Where is the key?', 'seed/key.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/key.svg', true), (qid, 2, 'seed/towel.svg', false), (qid, 3, 'seed/cup.svg', false);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 4, 'Where is the lamp?', 'seed/lamp.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/broom.svg', false), (qid, 2, 'seed/lamp.svg', true), (qid, 3, 'seed/clock.svg', false);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 5, 'Where is the umbrella?', 'seed/umbrella.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/cup.svg', false), (qid, 2, 'seed/book.svg', false), (qid, 3, 'seed/umbrella.svg', true);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 6, 'Where is the towel?', 'seed/towel.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/towel.svg', true), (qid, 2, 'seed/clock.svg', false), (qid, 3, 'seed/spoon.svg', false);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 7, 'Where is the broom?', 'seed/broom.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/book.svg', false), (qid, 2, 'seed/broom.svg', true), (qid, 3, 'seed/bowl.svg', false);
    update public.quiz_sets set status = 'published' where id = s;
  end if;
  if not exists (select 1 from public.quiz_sets where title = 'Clothes' and visibility = 'global') then
    insert into public.quiz_sets (title, subtitle, heading_color, cover_path, position, owner_id, visibility) values ('Clothes', 'What do we wear?', '#7A68A6', 'seed/cover-clothes.svg', (select coalesce(max(position), -1) + 1 from public.quiz_sets), sa, 'global') returning id into s;
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 0, 'Where is the shirt?', 'seed/shirt.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/shirt.svg', true), (qid, 2, 'seed/hat.svg', false), (qid, 3, 'seed/shoes.svg', false);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 1, 'Where are the pants?', 'seed/pants.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/socks.svg', false), (qid, 2, 'seed/pants.svg', true), (qid, 3, 'seed/jacket.svg', false);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 2, 'Where is the dress?', 'seed/dress.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/shoes.svg', false), (qid, 2, 'seed/gloves.svg', false), (qid, 3, 'seed/dress.svg', true);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 3, 'Where is the hat?', 'seed/hat.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/hat.svg', true), (qid, 2, 'seed/jacket.svg', false), (qid, 3, 'seed/shirt.svg', false);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 4, 'Where are the socks?', 'seed/socks.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/gloves.svg', false), (qid, 2, 'seed/socks.svg', true), (qid, 3, 'seed/pants.svg', false);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 5, 'Where are the shoes?', 'seed/shoes.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/shirt.svg', false), (qid, 2, 'seed/dress.svg', false), (qid, 3, 'seed/shoes.svg', true);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 6, 'Where is the jacket?', 'seed/jacket.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/jacket.svg', true), (qid, 2, 'seed/pants.svg', false), (qid, 3, 'seed/hat.svg', false);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 7, 'Where are the gloves?', 'seed/gloves.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/dress.svg', false), (qid, 2, 'seed/gloves.svg', true), (qid, 3, 'seed/socks.svg', false);
    update public.quiz_sets set status = 'published' where id = s;
  end if;
  if not exists (select 1 from public.quiz_sets where title = 'Furniture' and visibility = 'global') then
    insert into public.quiz_sets (title, subtitle, heading_color, cover_path, position, owner_id, visibility) values ('Furniture', 'Find the furniture', '#8C6A4E', 'seed/cover-furniture.svg', (select coalesce(max(position), -1) + 1 from public.quiz_sets), sa, 'global') returning id into s;
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 0, 'Where is the bed?', 'seed/bed.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/bed.svg', true), (qid, 2, 'seed/wardrobe.svg', false), (qid, 3, 'seed/mirror.svg', false);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 1, 'Where is the table?', 'seed/table.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/tv.svg', false), (qid, 2, 'seed/table.svg', true), (qid, 3, 'seed/shelf.svg', false);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 2, 'Where is the sofa?', 'seed/sofa.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/mirror.svg', false), (qid, 2, 'seed/chair.svg', false), (qid, 3, 'seed/sofa.svg', true);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 3, 'Where is the wardrobe?', 'seed/wardrobe.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/wardrobe.svg', true), (qid, 2, 'seed/shelf.svg', false), (qid, 3, 'seed/bed.svg', false);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 4, 'Where is the tv?', 'seed/tv.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/chair.svg', false), (qid, 2, 'seed/tv.svg', true), (qid, 3, 'seed/table.svg', false);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 5, 'Where is the mirror?', 'seed/mirror.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/bed.svg', false), (qid, 2, 'seed/sofa.svg', false), (qid, 3, 'seed/mirror.svg', true);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 6, 'Where is the shelf?', 'seed/shelf.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/shelf.svg', true), (qid, 2, 'seed/table.svg', false), (qid, 3, 'seed/wardrobe.svg', false);
    insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 7, 'Where is the chair?', 'seed/chair.svg') returning id into qid;
    insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/sofa.svg', false), (qid, 2, 'seed/chair.svg', true), (qid, 3, 'seed/tv.svg', false);
    update public.quiz_sets set status = 'published' where id = s;
  end if;
end $$;
