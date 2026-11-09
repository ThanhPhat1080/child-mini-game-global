-- Guest Play (spec GU13): a visitor with no account reads global, published or active content only.
-- Anon gets select policies that name visibility = 'global' explicitly, so a private, pending or
-- draft row of any family stays invisible. Anon writes nothing and executes no function (20261105000000).
-- children, child_settings, profiles, review_events and support_messages stay closed to anon.

-- quiz_sets: global and published
drop policy if exists quiz_sets_select_anon on public.quiz_sets;
create policy quiz_sets_select_anon on public.quiz_sets for select to anon
  using (visibility = 'global' and status = 'published');

-- memory_cards, spot_levels, find_levels: global and active
drop policy if exists memory_cards_select_anon on public.memory_cards;
create policy memory_cards_select_anon on public.memory_cards for select to anon
  using (visibility = 'global' and active);

drop policy if exists spot_levels_select_anon on public.spot_levels;
create policy spot_levels_select_anon on public.spot_levels for select to anon
  using (visibility = 'global' and active);

drop policy if exists find_levels_select_anon on public.find_levels;
create policy find_levels_select_anon on public.find_levels for select to anon
  using (visibility = 'global' and active);

-- card_groups: global only (no published notion)
drop policy if exists card_groups_select_anon on public.card_groups;
create policy card_groups_select_anon on public.card_groups for select to anon
  using (visibility = 'global');

-- questions and answers: readable only when their set is global and published.
-- The subquery runs under anon's own quiz_sets policy, so the rule is the same as the set's.
drop policy if exists questions_select_anon on public.questions;
create policy questions_select_anon on public.questions for select to anon
  using (exists (select 1 from public.quiz_sets s
                 where s.id = set_id and s.visibility = 'global' and s.status = 'published'));

drop policy if exists answers_select_anon on public.answers;
create policy answers_select_anon on public.answers for select to anon
  using (exists (select 1 from public.questions q
                 join public.quiz_sets s on s.id = q.set_id
                 where q.id = question_id and s.visibility = 'global' and s.status = 'published'));

grant select on public.quiz_sets, public.memory_cards, public.spot_levels, public.find_levels,
  public.card_groups, public.questions, public.answers to anon;
