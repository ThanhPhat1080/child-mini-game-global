-- Find It levels (spec A20, design 2026-10-30-find-it section 4).
-- Each level is one big picture. `objects` is a list of circles, in the order the
-- child is asked for them: {x, y, r, word, audio_path}. x and y are fractions of the
-- picture width and height (0-1), r is a fraction of the width. Paths starting with
-- `seed/` are bundled in the app (public/seed) and are never deleted from Storage.

create table if not exists public.find_levels (
  id uuid primary key default gen_random_uuid(),
  image_path text not null,
  objects jsonb not null check (jsonb_typeof(objects) = 'array' and jsonb_array_length(objects) between 2 and 12),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.find_levels enable row level security;

drop policy if exists find_levels_read_active on public.find_levels;
create policy find_levels_read_active on public.find_levels for select to anon, authenticated
  using (active);

drop policy if exists find_levels_admin_all on public.find_levels;
create policy find_levels_admin_all on public.find_levels for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
