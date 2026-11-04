-- Phase 3 multi-user: contact the Super Admin (spec U17).
--
-- A parent, banned or not, inserts messages for themselves and reads their own. A Super Admin
-- reads all and sets read_at / resolved_at (column grant: nothing else is editable).
-- Rate limit: at most 5 messages per user in any 24 hours, enforced here and in the UI.

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null default auth.uid() references public.profiles (user_id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  resolved_at timestamptz
);
create index support_messages_from_user_idx on public.support_messages (from_user, created_at desc);

create or replace function public.support_messages_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('support:' || new.from_user::text));
  if (select count(*) from public.support_messages m
       where m.from_user = new.from_user and m.created_at > now() - interval '1 day') >= 5 then
    raise exception 'rate_limited: at most 5 messages per day' using errcode = '53400';
  end if;
  return new;
end;
$$;
revoke all on function public.support_messages_limit() from public, anon, authenticated;

create trigger support_messages_limit
  before insert on public.support_messages
  for each row execute function public.support_messages_limit();

alter table public.support_messages enable row level security;
revoke all on public.support_messages from anon, authenticated, public;
grant select, insert (body) on public.support_messages to authenticated;
grant update (read_at, resolved_at) on public.support_messages to authenticated;
grant all on public.support_messages to service_role;

create policy support_messages_select on public.support_messages for select to authenticated
  using (from_user = auth.uid() or public.current_role() = 'super_admin');

create policy support_messages_insert on public.support_messages for insert to authenticated
  with check (from_user = auth.uid() and public.current_role() = 'parent');

create policy support_messages_update on public.support_messages for update to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');
