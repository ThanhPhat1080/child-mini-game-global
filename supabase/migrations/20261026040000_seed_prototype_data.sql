-- Seed: the prototype's quiz sets (Fruits, Animals, Shapes). Images are bundled in public/seed.
-- Only inserts when no sets exist, so it is safe to re-run.
do $$
declare s uuid; qid uuid;
begin
  if exists (select 1 from public.quiz_sets) then return; end if;
  insert into public.quiz_sets (title, subtitle, heading_color, cover_path, position) values ('Fruits', 'Find the fruit', '#B8737B', 'seed/cover-fruit.svg', 0) returning id into s;
  insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 0, 'Where is the apple?', 'seed/apple.svg') returning id into qid;
  insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/apple.svg', true), (qid, 2, 'seed/banana.svg', false), (qid, 3, 'seed/grapes.svg', false);
  insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 1, 'Where is the banana?', 'seed/banana.svg') returning id into qid;
  insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/grapes.svg', false), (qid, 2, 'seed/apple.svg', false), (qid, 3, 'seed/banana.svg', true);
  insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 2, 'Where are the grapes?', 'seed/grapes.svg') returning id into qid;
  insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/banana.svg', false), (qid, 2, 'seed/grapes.svg', true), (qid, 3, 'seed/apple.svg', false);
  insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 3, 'Which one is red?', 'seed/berry.svg') returning id into qid;
  insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/berry.svg', true), (qid, 2, 'seed/banana.svg', false), (qid, 3, 'seed/grapes.svg', false);
  insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 4, 'Which one is yellow?', 'seed/banana.svg') returning id into qid;
  insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/apple.svg', false), (qid, 2, 'seed/grapes.svg', false), (qid, 3, 'seed/banana.svg', true);
  update public.quiz_sets set status = 'published' where id = s;
  insert into public.quiz_sets (title, subtitle, heading_color, cover_path, position) values ('Animals', 'Who is this?', '#4F7A9E', 'seed/cover-animal.svg', 1) returning id into s;
  insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 0, 'Where is the fish?', 'seed/fish.svg') returning id into qid;
  insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/fish.svg', true), (qid, 2, 'seed/bird.svg', false), (qid, 3, 'seed/cat.svg', false);
  insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 1, 'Where is the bird?', 'seed/bird.svg') returning id into qid;
  insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/cat.svg', false), (qid, 2, 'seed/bird.svg', true), (qid, 3, 'seed/duck.svg', false);
  insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 2, 'Where is the cat?', 'seed/cat.svg') returning id into qid;
  insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/duck.svg', false), (qid, 2, 'seed/fish.svg', false), (qid, 3, 'seed/cat.svg', true);
  insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 3, 'Where is the duck?', 'seed/duck.svg') returning id into qid;
  insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/bird.svg', false), (qid, 2, 'seed/duck.svg', true), (qid, 3, 'seed/fish.svg', false);
  insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 4, 'Where is the fish?', 'seed/fish.svg') returning id into qid;
  insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/cat.svg', false), (qid, 2, 'seed/fish.svg', true), (qid, 3, 'seed/duck.svg', false);
  insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 5, 'Where is the bird?', 'seed/bird.svg') returning id into qid;
  insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/bird.svg', true), (qid, 2, 'seed/cat.svg', false), (qid, 3, 'seed/fish.svg', false);
  update public.quiz_sets set status = 'published' where id = s;
  insert into public.quiz_sets (title, subtitle, heading_color, cover_path, position) values ('Shapes', null, '#8A6A2A', 'seed/cover-shape.svg', 2) returning id into s;
  insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 0, 'Where is the circle?', 'seed/circle.svg') returning id into qid;
  insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/circle.svg', true), (qid, 2, 'seed/square.svg', false), (qid, 3, 'seed/star.svg', false);
  insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 1, 'Where is the triangle?', 'seed/triangle.svg') returning id into qid;
  insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/heart.svg', false), (qid, 2, 'seed/triangle.svg', true), (qid, 3, 'seed/circle.svg', false);
  insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 2, 'Where is the square?', 'seed/square.svg') returning id into qid;
  insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/triangle.svg', false), (qid, 2, 'seed/star.svg', false), (qid, 3, 'seed/square.svg', true);
  insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 3, 'Where is the star?', 'seed/star.svg') returning id into qid;
  insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/square.svg', false), (qid, 2, 'seed/star.svg', true), (qid, 3, 'seed/heart.svg', false);
  insert into public.questions (set_id, position, prompt_text, prompt_image_path) values (s, 4, 'Where is the heart?', 'seed/heart.svg') returning id into qid;
  insert into public.answers (question_id, slot, image_path, is_correct) values (qid, 1, 'seed/circle.svg', false), (qid, 2, 'seed/heart.svg', true), (qid, 3, 'seed/triangle.svg', false);
  update public.quiz_sets set status = 'published' where id = s;
end $$;
