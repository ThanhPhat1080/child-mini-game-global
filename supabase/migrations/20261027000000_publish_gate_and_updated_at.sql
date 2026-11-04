-- T4-T6: sets track updated_at; publish gate = at least one complete question.
-- Incomplete questions may exist in a published set; the child app only shows complete ones.
alter table public.quiz_sets add column if not exists updated_at timestamptz not null default now();

create or replace function public.assert_set_publishable()
returns trigger
language plpgsql
as $$
declare
  ok int;
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    select count(*) into ok
    from public.questions q
    where q.set_id = new.id
      and (coalesce(btrim(q.prompt_text), '') <> '' or q.prompt_audio_path is not null)
      and (select count(*) from public.answers a where a.question_id = q.id) between 2 and 3
      and not exists (select 1 from public.answers a where a.question_id = q.id and a.image_path is null)
      and (select count(*) from public.answers a where a.question_id = q.id and a.is_correct) = 1;
    if ok = 0 then
      raise exception 'quiz set % needs at least one complete question before it can be published', new.id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
