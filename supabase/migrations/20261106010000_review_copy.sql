-- Phase 4: review per game; approve creates a Super Admin copy (spec 2026-11-06-review-copy, V8-V13).
--
-- Approve no longer moves the parent's row to global. It sends the original back to private (the
-- parent keeps editing it) and creates a global copy owned by the Super Admin. The copy references
-- the parent's media paths, so it adds no bytes to the Super Admin's quota. A file used by a copy
-- cannot be renamed by its owner (media_owner_update), and cannot be deleted (media_in_use).

-- V8: where a copy came from. source_id is the original; both columns are cleared when it goes.
do $$
declare
  t text;
begin
  foreach t in array array['quiz_sets', 'memory_cards', 'card_groups', 'spot_levels', 'find_levels'] loop
    execute format(
      'alter table public.%I
         add column if not exists source_id uuid references public.%I (id) on delete set null,
         add column if not exists source_owner_id uuid references public.profiles (user_id) on delete set null', t, t);
    execute format('create index if not exists %I on public.%I (source_id)', t || '_source_id_idx', t);
  end loop;
end $$;

-- A Super Admin's group with the same name (case and surrounding spaces ignored), created if missing.
-- An existing one is set to global, since the copy of a card must sit in a global group.
create or replace function public.copy_group_as(p_name text, p_owner uuid, p_source uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid uuid;
begin
  select g.id into gid from public.card_groups g
    where g.owner_id = p_owner and lower(btrim(g.name)) = lower(btrim(p_name))
    limit 1;
  if gid is null then
    insert into public.card_groups (name, owner_id, visibility, source_id, source_owner_id)
      select btrim(p_name), p_owner, 'global'::public.visibility, g.id, g.owner_id
        from public.card_groups g where g.id = p_source
      returning id into gid;
  else
    update public.card_groups set visibility = 'global' where id = gid and visibility <> 'global';
  end if;
  return gid;
end;
$$;

-- V8: deep copy of one row, owned by p_owner, global, with source_id = p_id. Media paths and jsonb are
-- copied verbatim. Returns the copy's id. Not granted to clients: review_approve calls it.
create or replace function public.copy_content_as(p_table text, p_id uuid, p_owner uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  new_q uuid;
  new_group uuid;
  grp_name text;
  src_group uuid;
  src_status text;
  found_row boolean;
  q record;
begin
  perform public.assert_content_table(p_table);
  if p_owner is null then
    raise exception 'invalid_owner: a copy needs an owner' using errcode = '22023';
  end if;
  execute format('select exists (select 1 from public.%I where id = $1)', p_table) into found_row using p_id;
  if not found_row then
    raise exception 'not_found: no % item %', p_table, p_id using errcode = '22023';
  end if;

  if p_table = 'quiz_sets' then
    select s.status into src_status from public.quiz_sets s where s.id = p_id;
    -- Inserted as draft: the publish gate needs the questions and answers before the status is set.
    insert into public.quiz_sets (title, subtitle, heading_color, cover_path, status, position, owner_id, visibility, source_id, source_owner_id)
      select s.title, s.subtitle, s.heading_color, s.cover_path, 'draft', s.position, p_owner, 'global'::public.visibility, s.id, s.owner_id
        from public.quiz_sets s where s.id = p_id
      returning id into new_id;
    for q in select * from public.questions where set_id = p_id order by position loop
      insert into public.questions (set_id, position, prompt_text, prompt_image_path, prompt_audio_path, read_answers, hide_answer_text)
        values (new_id, q.position, q.prompt_text, q.prompt_image_path, q.prompt_audio_path, q.read_answers, q.hide_answer_text)
        returning id into new_q;
      insert into public.answers (question_id, slot, image_path, text, is_correct)
        select new_q, a.slot, a.image_path, a.text, a.is_correct from public.answers a where a.question_id = q.id;
    end loop;
    update public.quiz_sets set status = src_status where id = new_id;

  elsif p_table = 'memory_cards' then
    select c.group_id into src_group from public.memory_cards c where c.id = p_id;
    if src_group is not null then
      select g.name into grp_name from public.card_groups g where g.id = src_group;
      new_group := public.copy_group_as(grp_name, p_owner, src_group);
    end if;
    insert into public.memory_cards (word, image_path, audio_path, active, group_id, owner_id, visibility, source_id, source_owner_id)
      select c.word, c.image_path, c.audio_path, c.active, new_group, p_owner, 'global'::public.visibility, c.id, c.owner_id
        from public.memory_cards c where c.id = p_id
      returning id into new_id;

  elsif p_table = 'card_groups' then
    select g.name into grp_name from public.card_groups g where g.id = p_id;
    new_id := public.copy_group_as(grp_name, p_owner, p_id);

  elsif p_table = 'spot_levels' then
    insert into public.spot_levels (image_a_path, image_b_path, differences, active, sort_order, owner_id, visibility, source_id, source_owner_id)
      select l.image_a_path, l.image_b_path, l.differences, l.active, l.sort_order, p_owner, 'global'::public.visibility, l.id, l.owner_id
        from public.spot_levels l where l.id = p_id
      returning id into new_id;

  else -- find_levels
    insert into public.find_levels (image_path, objects, active, sort_order, owner_id, visibility, source_id, source_owner_id)
      select f.image_path, f.objects, f.active, f.sort_order, p_owner, 'global'::public.visibility, f.id, f.owner_id
        from public.find_levels f where f.id = p_id
      returning id into new_id;
  end if;

  return new_id;
end;
$$;

-- V11: the rename guard. True when a content row owned by someone other than the file's folder owner
-- uses the path. Definer, because the parent cannot read the Super Admin's rows under RLS.
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
  );
$$;

revoke all on function public.media_used_by_others(text) from public, anon;
grant execute on function public.media_used_by_others(text) to authenticated, service_role;

-- The owner may rename or overwrite a file only when no copy of someone else uses it.
drop policy if exists media_owner_update on storage.objects;
create policy media_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.can_write_media(name) and not public.media_used_by_others(name))
  with check (
    bucket_id = 'media' and public.can_write_media(name) and (
      (metadata ->> 'mimetype' in ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml')
        and public.media_size(metadata) <= 2097152)
      or metadata ->> 'mimetype' like 'audio/%'
    )
  );

-- V8: approve. The original goes back to private; the Super Admin gets a global copy.
-- Returns the copy's id. Drop and recreate: the return type changed from void.
drop function if exists public.review_approve(text, uuid);
create function public.review_approve(p_table text, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  copy_id uuid;
begin
  perform public.assert_super_admin();
  perform public.move_content(p_table, p_id, 'pending', 'private', false);
  copy_id := public.copy_content_as(p_table, p_id, auth.uid());
  return copy_id;
end;
$$;

-- V10: a Super Admin publishes one of their own private rows, without a review.
create or replace function public.publish_own(p_table text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  perform public.move_content(p_table, p_id, 'private', 'global', true);
end;
$$;

revoke all on function public.copy_group_as(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.copy_content_as(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.review_approve(text, uuid) from public, anon, authenticated;
revoke all on function public.publish_own(text, uuid) from public, anon, authenticated;
grant execute on function public.review_approve(text, uuid) to authenticated, service_role;
grant execute on function public.publish_own(text, uuid) to authenticated, service_role;

-- V13: one-time backfill. Null-owner rows go to the first Super Admin (the seed rule). Every global
-- row a parent owns becomes a Super Admin copy, and the parent's row goes back to private.
-- Groups before cards, so a card's copy finds the group copy that already exists.
-- backfill:start
do $$
declare
  sa uuid;
  t text;
  r record;
begin
  select p.user_id into sa from public.profiles p
    where p.role = 'super_admin' order by p.created_at, p.user_id limit 1;
  if sa is null then
    return;
  end if;

  update public.card_groups set owner_id = sa where owner_id is null;
  update public.memory_cards set owner_id = sa where owner_id is null;
  update public.quiz_sets set owner_id = sa where owner_id is null;
  update public.spot_levels set owner_id = sa where owner_id is null;
  update public.find_levels set owner_id = sa where owner_id is null;

  foreach t in array array['card_groups', 'memory_cards', 'quiz_sets', 'spot_levels', 'find_levels'] loop
    for r in execute format(
      'select x.id from public.%I x
        where x.visibility = ''global''
          and x.owner_id in (select p.user_id from public.profiles p where p.role = ''parent'')', t) loop
      perform public.copy_content_as(t, r.id, sa);
      execute format('update public.%I set visibility = ''private'' where id = $1', t) using r.id;
    end loop;
  end loop;
end $$;
-- backfill:end
