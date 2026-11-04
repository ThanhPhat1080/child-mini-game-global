-- Card groups for Sort It (spec R2, A17; design 2026-10-30-sort-it section 4).
-- Group names are for the parent only: only the admin may read or write them.
-- The game reads memory_cards.group_id, never the names. Whole file is idempotent.

create table if not exists public.card_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);

create unique index if not exists card_groups_name_key
  on public.card_groups (lower(btrim(name)));

alter table public.card_groups enable row level security;

drop policy if exists card_groups_admin_select on public.card_groups;
drop policy if exists card_groups_admin_insert on public.card_groups;
drop policy if exists card_groups_admin_update on public.card_groups;
drop policy if exists card_groups_admin_delete on public.card_groups;

create policy card_groups_admin_select on public.card_groups for select to authenticated
  using (public.is_admin());
create policy card_groups_admin_insert on public.card_groups for insert to authenticated
  with check (public.is_admin());
create policy card_groups_admin_update on public.card_groups for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy card_groups_admin_delete on public.card_groups for delete to authenticated
  using (public.is_admin());

alter table public.memory_cards
  add column if not exists group_id uuid null references public.card_groups(id) on delete set null;

-- Seed groups (skipped when a group with that name already exists).
insert into public.card_groups (name)
select v.name
from (values
  ('food'),
  ('animals'),
  ('shapes'),
  ('school'),
  ('home'),
  ('nature')
) as v(name)
where not exists (
  select 1 from public.card_groups g where lower(btrim(g.name)) = lower(btrim(v.name))
);

-- Tag the seeded cards (only where no group is set yet).
update public.memory_cards c
set group_id = g.id
from (values
  ('food', 'seed/apple.svg'),
  ('food', 'seed/banana.svg'),
  ('food', 'seed/berry.svg'),
  ('food', 'seed/grapes.svg'),
  ('food', 'seed/cookie.svg'),
  ('animals', 'seed/bird.svg'),
  ('animals', 'seed/cat.svg'),
  ('animals', 'seed/duck.svg'),
  ('animals', 'seed/fish.svg'),
  ('shapes', 'seed/circle.svg'),
  ('shapes', 'seed/heart.svg'),
  ('shapes', 'seed/square.svg'),
  ('shapes', 'seed/star.svg'),
  ('shapes', 'seed/triangle.svg'),
  ('school', 'seed/ruler.svg'),
  ('school', 'seed/pencil.svg'),
  ('school', 'seed/pen.svg'),
  ('school', 'seed/eraser.svg'),
  ('school', 'seed/book.svg'),
  ('school', 'seed/scissors.svg'),
  ('school', 'seed/backpack.svg'),
  ('home', 'seed/cup.svg'),
  ('home', 'seed/chair.svg'),
  ('home', 'seed/clock.svg'),
  ('home', 'seed/house.svg'),
  ('nature', 'seed/flower.svg'),
  ('nature', 'seed/moon.svg'),
  ('nature', 'seed/sun.svg'),
  ('nature', 'seed/tree.svg')
) as v(group_name, image_path)
join public.card_groups g on lower(btrim(g.name)) = v.group_name
where c.image_path = v.image_path
  and c.group_id is null;
