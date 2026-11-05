-- Celebration pictures (spec 2026-11-05 parent feedback, item 3): each child has two pictures the
-- parent uploads. They show on the "you did it" screen after a game, swaying gently.
-- Both are optional; the screen falls back to the built-in characters when they are empty.

alter table public.children
  add column celebrate_a_path text,
  add column celebrate_b_path text;

-- media_in_use() must see the new columns, or a picture still in use could be deleted from storage.
create or replace function public.media_in_use(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_path is not null and p_path <> '' and (
    exists (select 1 from public.children ch
             where p_path in (ch.avatar_path, ch.celebrate_a_path, ch.celebrate_b_path))
    or exists (select 1 from public.child_settings c where p_path in
      (c.greeting_path, c.music_path, c.hooray_path, c.ohoh_path, c.complete_path))
    or exists (select 1 from public.quiz_sets s where s.cover_path = p_path)
    or exists (select 1 from public.questions q where p_path in (q.prompt_image_path, q.prompt_audio_path))
    or exists (select 1 from public.answers a where a.image_path = p_path)
    or exists (select 1 from public.memory_cards m where p_path in (m.image_path, m.audio_path))
    or exists (select 1 from public.spot_levels l where p_path in (l.image_a_path, l.image_b_path))
    or exists (select 1 from public.find_levels f where f.image_path = p_path)
    or exists (
      select 1 from public.find_levels f, jsonb_array_elements(f.objects) o
      where o ->> 'audio_path' = p_path)
  );
$$;
