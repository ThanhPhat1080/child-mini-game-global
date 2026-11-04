-- Phase 3 multi-user: content ownership, visibility and RLS rewrite (spec U3, U5, V1, V5, V6).
--
-- Applies to quiz_sets, memory_cards, spot_levels, card_groups and find_levels (questions and
-- answers follow their set). Sharing acts on rows.
--
-- owner_id is nullable on purpose: it is the first Super Admin when one exists at migration time,
-- otherwise null = platform content (the seed rows on a fresh project, where the first Super
-- Admin only exists after the migrations ran, spec U6). Null-owner rows are global and only a
-- Super Admin edits them. Existing rows become global so existing children keep seeing them.
--
-- Visibility changes (private -> pending -> global ...) are not allowed from a client session:
-- the content_guard trigger rejects them unless the caller is a Super Admin or the change runs
-- inside a definer function (the review functions of the next migration).

create type public.visibility as enum ('private', 'pending', 'global');

do $$
declare
  t text;
  sa uuid;
begin
  select p.user_id into sa from public.profiles p
    where p.role = 'super_admin' order by p.created_at, p.user_id limit 1;
  foreach t in array array['quiz_sets', 'memory_cards', 'spot_levels', 'card_groups', 'find_levels'] loop
    execute format(
      'alter table public.%I
         add column owner_id uuid references public.profiles (user_id) on delete cascade,
         add column visibility public.visibility not null default ''global''', t);
    execute format('update public.%I set owner_id = $1', t) using sa;
    execute format('alter table public.%I
        alter column owner_id set default auth.uid(),
        alter column visibility set default ''private''', t);
    execute format('create index %I on public.%I (owner_id)', t || '_owner_id_idx', t);
  end loop;
end $$;

-- Group names are unique per owner, not globally (platform groups share the null bucket).
drop index if exists public.card_groups_name_key;
create unique index card_groups_owner_name_key
  on public.card_groups (coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(name)));

-- One place for the read rule. `published` is the table's own flag (status/active; true for groups).
create or replace function public.can_read_content(o uuid, v public.visibility, published boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case public.current_role()
      when 'super_admin' then true
      when 'parent' then not public.is_banned(o) and (o = auth.uid() or (v = 'global' and published))
      when 'child' then not public.is_banned(o) and published
        and (v = 'global' or (o = public.owner_scope() and v in ('private', 'pending')))
      else false
    end,
    false);
$$;

-- One place for the write rule: a Super Admin, or a non-banned parent on their own private row.
create or replace function public.can_write_content(o uuid, v public.visibility)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.current_role() = 'super_admin'
    or (public.current_role() = 'parent' and o = auth.uid() and v = 'private'
        and not public.is_banned(auth.uid())),
    false);
$$;

revoke all on function public.can_read_content(uuid, public.visibility, boolean) from public;
revoke all on function public.can_write_content(uuid, public.visibility) from public;
grant execute on function public.can_read_content(uuid, public.visibility, boolean)
  to anon, authenticated, service_role;
grant execute on function public.can_write_content(uuid, public.visibility)
  to anon, authenticated, service_role;

-- Security invoker on purpose: current_user is the session role for client calls and the function
-- owner inside definer functions, which is how the next migration's functions are let through.
create or replace function public.content_guard()
returns trigger
language plpgsql
as $$
begin
  if (new.owner_id is distinct from old.owner_id or new.visibility is distinct from old.visibility)
     and current_user in ('anon', 'authenticated')
     and coalesce(public.current_role(), '') <> 'super_admin' then
    raise exception 'visibility_locked: owner and visibility change only through the review functions'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
  pub text;
  pol text;
begin
  foreach t in array array['quiz_sets', 'memory_cards', 'spot_levels', 'card_groups', 'find_levels'] loop
    pub := case t when 'quiz_sets' then 'status = ''published''' when 'card_groups' then 'true' else 'active' end;

    -- Drop every old policy on the table (names differ per migration).
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', pol, t);
    end loop;

    execute format('create trigger %I before update on public.%I for each row execute function public.content_guard()',
      t || '_content_guard', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (public.can_read_content(owner_id, visibility, %s))', t || '_select', t, pub);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (public.can_write_content(owner_id, visibility))', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (public.can_write_content(owner_id, visibility))
         with check (public.can_write_content(owner_id, visibility))', t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (public.can_write_content(owner_id, visibility))', t || '_delete', t);
  end loop;
end $$;

-- questions and answers: same visibility and write rights as their set. The subqueries run under
-- the caller's own RLS, so a row is seen only when its set is.
do $$
declare
  pol text;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'questions' loop
    execute format('drop policy %I on public.questions', pol);
  end loop;
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'answers' loop
    execute format('drop policy %I on public.answers', pol);
  end loop;
end $$;

create policy questions_select on public.questions for select to authenticated
  using (exists (select 1 from public.quiz_sets s where s.id = set_id));
create policy questions_insert on public.questions for insert to authenticated
  with check (exists (select 1 from public.quiz_sets s
    where s.id = set_id and public.can_write_content(s.owner_id, s.visibility)));
create policy questions_update on public.questions for update to authenticated
  using (exists (select 1 from public.quiz_sets s
    where s.id = set_id and public.can_write_content(s.owner_id, s.visibility)))
  with check (exists (select 1 from public.quiz_sets s
    where s.id = set_id and public.can_write_content(s.owner_id, s.visibility)));
create policy questions_delete on public.questions for delete to authenticated
  using (exists (select 1 from public.quiz_sets s
    where s.id = set_id and public.can_write_content(s.owner_id, s.visibility)));

create policy answers_select on public.answers for select to authenticated
  using (exists (select 1 from public.questions q where q.id = question_id));
create policy answers_insert on public.answers for insert to authenticated
  with check (exists (select 1 from public.questions q join public.quiz_sets s on s.id = q.set_id
    where q.id = question_id and public.can_write_content(s.owner_id, s.visibility)));
create policy answers_update on public.answers for update to authenticated
  using (exists (select 1 from public.questions q join public.quiz_sets s on s.id = q.set_id
    where q.id = question_id and public.can_write_content(s.owner_id, s.visibility)))
  with check (exists (select 1 from public.questions q join public.quiz_sets s on s.id = q.set_id
    where q.id = question_id and public.can_write_content(s.owner_id, s.visibility)));
create policy answers_delete on public.answers for delete to authenticated
  using (exists (select 1 from public.questions q join public.quiz_sets s on s.id = q.set_id
    where q.id = question_id and public.can_write_content(s.owner_id, s.visibility)));

-- A card keeps its group's owner. Definer, because FKs ignore RLS and the group may be invisible
-- to the caller.
create or replace function public.memory_cards_group_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  group_owner uuid;
begin
  if new.group_id is not null then
    select g.owner_id into group_owner from public.card_groups g where g.id = new.group_id;
    if group_owner is distinct from new.owner_id then
      raise exception 'group_owner_mismatch: a card must have the same owner as its group'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.memory_cards_group_owner() from public, anon, authenticated;

create trigger memory_cards_group_owner
  before insert or update of group_id, owner_id on public.memory_cards
  for each row execute function public.memory_cards_group_owner();
