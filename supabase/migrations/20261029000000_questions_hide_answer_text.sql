-- Optional per question: do not show the answer text on the child's answer cards (picture only).
-- The text is still read aloud (when "Read the answers aloud" is on, and always for the answer the child picks).
alter table public.questions add column if not exists hide_answer_text boolean not null default false;
