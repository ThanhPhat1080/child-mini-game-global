-- Reading the answers aloud is optional per question (admin checkbox). Default on.
alter table public.questions add column if not exists read_answers boolean not null default true;
