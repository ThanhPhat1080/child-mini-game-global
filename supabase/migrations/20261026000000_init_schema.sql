-- T1: schema, RLS, storage (spec 5; ADR-008, 015, 024)

-- Admins: the only users who can write. Add the admin's auth user id by hand once:
--   insert into public.admins (user_id) select id from auth.users where email = '<admin email>';
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;
-- no policies on admins: clients cannot read or write it; is_admin() reads it as definer.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

-- Single-row settings (child name, greeting audio, background music).
create table public.settings (
  id int primary key default 1 check (id = 1),
  child_name text not null default '',
  greeting_path text,
  music_path text
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

create table public.quiz_sets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  heading_color text not null default '#5A4038'
    check (heading_color ~ '^#[0-9A-Fa-f]{6}$'),
  cover_path text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.quiz_sets (id) on delete cascade,
  position int not null,
  prompt_text text,
  prompt_image_path text,
  prompt_audio_path text,
  -- deferred so the editor can swap two positions in one transaction
  constraint questions_set_position_key unique (set_id, position) deferrable initially deferred
);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  slot int not null check (slot between 1 and 3),
  -- nullable: drafts may be incomplete; publishing requires it (see trigger below)
  image_path text,
  is_correct boolean not null default false,
  constraint answers_question_slot_key unique (question_id, slot)
);

-- At most one correct answer per question, always. Exactly-one is enforced at publish.
create unique index answers_one_correct_per_question
  on public.answers (question_id) where is_correct;

-- Publish gate: a set can only become published if every question has 2-3 answers,
-- each with an image, and exactly one correct answer.
create or replace function public.assert_set_publishable()
returns trigger
language plpgsql
as $$
declare
  bad int;
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    select count(*) into bad
    from public.questions q
    where q.set_id = new.id
      and not (
        (select count(*) from public.answers a where a.question_id = q.id) between 2 and 3
        and not exists (select 1 from public.answers a where a.question_id = q.id and a.image_path is null)
        and (select count(*) from public.answers a where a.question_id = q.id and a.is_correct) = 1
      );
    if bad > 0 then
      raise exception 'quiz set % has % incomplete question(s)', new.id, bad
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger quiz_sets_publish_gate
  before insert or update of status on public.quiz_sets
  for each row execute function public.assert_set_publishable();

-- RLS ------------------------------------------------------------------------
alter table public.settings enable row level security;
alter table public.quiz_sets enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;

-- settings: anyone reads, only admin writes
create policy settings_read on public.settings for select to anon, authenticated using (true);
create policy settings_admin_write on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- quiz_sets: anon reads published only; admin reads and writes everything (drafts too)
create policy quiz_sets_read_published on public.quiz_sets for select to anon
  using (status = 'published');
create policy quiz_sets_admin_all on public.quiz_sets for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- questions and answers: visible to anon only when their set is published
create policy questions_read_published on public.questions for select to anon
  using (exists (select 1 from public.quiz_sets s where s.id = set_id and s.status = 'published'));
create policy questions_admin_all on public.questions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy answers_read_published on public.answers for select to anon
  using (exists (
    select 1 from public.questions q
    join public.quiz_sets s on s.id = q.set_id
    where q.id = question_id and s.status = 'published'
  ));
create policy answers_admin_all on public.answers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Storage: bucket media -------------------------------------------------------
-- Bucket-level limits: image and audio types only, 10 MB ceiling.
-- Image size limit (2 MB) is enforced in the object policy below.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', true, 10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy media_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'media');

create policy media_admin_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media' and public.is_admin() and (
      (metadata->>'mimetype' in ('image/png', 'image/jpeg', 'image/webp')
        and (metadata->>'size')::bigint <= 2097152)
      or metadata->>'mimetype' like 'audio/%'
    )
  );

create policy media_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (
    bucket_id = 'media' and public.is_admin() and (
      (metadata->>'mimetype' in ('image/png', 'image/jpeg', 'image/webp')
        and (metadata->>'size')::bigint <= 2097152)
      or metadata->>'mimetype' like 'audio/%'
    )
  );

create policy media_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());
