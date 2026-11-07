-- Puzzle Pairs (spec A32-A35): the pictures the game may cut into halves.
-- One list for every family. Everyone reads the active rows; only a Super Admin writes.

create table if not exists public.puzzle_pictures (
  id uuid primary key default gen_random_uuid(),
  word text not null check (char_length(btrim(word)) between 1 and 40),
  image_path text not null,
  audio_path text,
  active boolean not null default true,
  sort_order int not null default 0,
  owner_id uuid default auth.uid() references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.puzzle_pictures enable row level security;

-- anon may not execute current_role() (20261105000000), so it gets its own policy.
drop policy if exists puzzle_pictures_read_anon on public.puzzle_pictures;
create policy puzzle_pictures_read_anon on public.puzzle_pictures for select to anon
  using (active);

drop policy if exists puzzle_pictures_read on public.puzzle_pictures;
create policy puzzle_pictures_read on public.puzzle_pictures for select to authenticated
  using (active or public.current_role() = 'super_admin');

drop policy if exists puzzle_pictures_insert on public.puzzle_pictures;
create policy puzzle_pictures_insert on public.puzzle_pictures for insert to authenticated
  with check (public.current_role() = 'super_admin');

drop policy if exists puzzle_pictures_update on public.puzzle_pictures;
create policy puzzle_pictures_update on public.puzzle_pictures for update to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

drop policy if exists puzzle_pictures_delete on public.puzzle_pictures;
create policy puzzle_pictures_delete on public.puzzle_pictures for delete to authenticated
  using (public.current_role() = 'super_admin');

grant select on public.puzzle_pictures to anon;
grant select, insert, update, delete on public.puzzle_pictures to authenticated;

-- A35: the four seed pictures. Skips a row whose picture is already listed.
insert into public.puzzle_pictures (word, image_path, sort_order, owner_id)
select v.word, v.image_path, v.sort_order, null
from (values
  ('fish', 'seed/fish.svg', 0),
  ('triangle', 'seed/triangle.svg', 1),
  ('house', 'seed/house.svg', 2),
  ('apple', 'seed/apple.svg', 3)
) as v(word, image_path, sort_order)
where not exists (select 1 from public.puzzle_pictures p where p.image_path = v.image_path);

-- A34: a picture or sound used by the list counts as in use.
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
    or exists (select 1 from public.puzzle_pictures z where p_path in (z.image_path, z.audio_path))
  );
$$;

create or replace function public.media_used_by_others(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_path is not null and p_path <> '' and (
    exists (select 1 from public.quiz_sets s
      where s.cover_path = p_path
        and s.owner_id::text is distinct from (storage.foldername(p_path))[1])
    or exists (select 1 from public.questions q join public.quiz_sets s on s.id = q.set_id
      where p_path in (q.prompt_image_path, q.prompt_audio_path)
        and s.owner_id::text is distinct from (storage.foldername(p_path))[1])
    or exists (select 1 from public.answers a join public.questions q on q.id = a.question_id join public.quiz_sets s on s.id = q.set_id
      where a.image_path = p_path
        and s.owner_id::text is distinct from (storage.foldername(p_path))[1])
    or exists (select 1 from public.memory_cards m
      where p_path in (m.image_path, m.audio_path)
        and m.owner_id::text is distinct from (storage.foldername(p_path))[1])
    or exists (select 1 from public.spot_levels l
      where p_path in (l.image_a_path, l.image_b_path)
        and l.owner_id::text is distinct from (storage.foldername(p_path))[1])
    or exists (select 1 from public.find_levels f
      where (f.image_path = p_path
             or exists (select 1 from jsonb_array_elements(f.objects) o where o ->> 'audio_path' = p_path))
        and f.owner_id::text is distinct from (storage.foldername(p_path))[1])
    or exists (select 1 from public.puzzle_pictures z
      where p_path in (z.image_path, z.audio_path)
        and z.owner_id::text is distinct from (storage.foldername(p_path))[1])
  );
$$;

revoke all on function public.media_in_use(text) from public, anon;
grant execute on function public.media_in_use(text) to authenticated, service_role;
revoke all on function public.media_used_by_others(text) from public, anon;
grant execute on function public.media_used_by_others(text) to authenticated, service_role;
