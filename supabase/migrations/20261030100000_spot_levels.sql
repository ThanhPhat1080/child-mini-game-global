-- Spot the Differences levels (spec A14, design 2026-10-30-spot-the-differences section 4).
-- Each level is two pictures of the same size. `differences` is a list of circles
-- {x, y, r}: x and y are fractions of the picture width and height (0-1), r is a
-- fraction of the width. Paths starting with `seed/` are bundled in the app
-- (public/seed) and are never deleted from Storage.

create table if not exists public.spot_levels (
  id uuid primary key default gen_random_uuid(),
  image_a_path text not null,
  image_b_path text not null,
  differences jsonb not null check (jsonb_typeof(differences) = 'array' and jsonb_array_length(differences) between 3 and 10),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.spot_levels enable row level security;

create policy spot_levels_read_active on public.spot_levels for select to anon, authenticated
  using (active);
create policy spot_levels_admin_all on public.spot_levels for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Sample levels (idempotent: a row is skipped when its image_a_path already exists).
insert into public.spot_levels (image_a_path, image_b_path, differences, active, sort_order)
select v.image_a_path, v.image_b_path, v.differences, true, v.sort_order
from (values
  ('seed/spot/garden-a.svg', 'seed/spot/garden-b.svg',
   '[{"x":0.45,"y":0.2,"r":0.07},{"x":0.5,"y":0.8,"r":0.07},{"x":0.25,"y":0.893,"r":0.07},{"x":0.675,"y":0.367,"r":0.07}]'::jsonb, 1),
  ('seed/spot/farm-a.svg', 'seed/spot/farm-b.svg',
   '[{"x":0.55,"y":0.15,"r":0.07},{"x":0.775,"y":0.617,"r":0.07},{"x":0.138,"y":0.883,"r":0.07},{"x":0.513,"y":0.783,"r":0.07}]'::jsonb, 2),
  ('seed/spot/sea-a.svg', 'seed/spot/sea-b.svg',
   '[{"x":0.593,"y":0.2,"r":0.07},{"x":0.325,"y":0.4,"r":0.07},{"x":0.788,"y":0.917,"r":0.07},{"x":0.825,"y":0.5,"r":0.07}]'::jsonb, 3)
) as v(image_a_path, image_b_path, differences, sort_order)
where not exists (
  select 1 from public.spot_levels l where l.image_a_path = v.image_a_path
);
