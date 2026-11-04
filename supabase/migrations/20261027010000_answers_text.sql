-- Each answer has an optional text that the app reads aloud when the child picks it.
alter table public.answers add column if not exists text text;

-- Fill the prototype seed answers with their picture names.
update public.answers a
set text = initcap(regexp_replace(a.image_path, '^seed/(.*)\.svg$', '\1'))
where a.text is null and a.image_path like 'seed/%';
