-- Phase 3 multi-user: review workflow, ban and quota functions (spec V2-V5, V7, U15, Q4).
--
-- All functions are security definer with a pinned search_path. They run as the function owner,
-- which is how they get past the content_guard trigger and RLS; each one checks the caller itself.
-- Banning changes no visibility: banned owners' rows are hidden by can_read_content, so unban
-- restores everything exactly.

create table public.review_events (
  id uuid primary key default gen_random_uuid(),
  item_table text not null,
  item_id uuid not null,
  owner_id uuid not null references public.profiles (user_id) on delete cascade,
  kind text not null check (kind in ('rejection', 'edit_request')),
  note text,
  created_by uuid references public.profiles (user_id) on delete set null,
  created_at timestamptz not null default now()
);
create index review_events_item_idx on public.review_events (item_table, item_id);
create index review_events_owner_idx on public.review_events (owner_id);

alter table public.review_events enable row level security;
revoke all on public.review_events from anon, public;
grant select on public.review_events to authenticated;
grant all on public.review_events to service_role;

-- A parent reads the events of their own items (rejection reasons), a Super Admin reads all.
create policy review_events_select on public.review_events for select to authenticated
  using (owner_id = auth.uid() or public.current_role() = 'super_admin');

create or replace function public.assert_content_table(p_table text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_table is null or p_table not in ('quiz_sets', 'memory_cards', 'spot_levels', 'card_groups', 'find_levels') then
    raise exception 'invalid_table: %', p_table using errcode = '22023';
  end if;
end;
$$;

create or replace function public.assert_super_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_role() is distinct from 'super_admin' then
    raise exception 'forbidden: Super Admin only' using errcode = '42501';
  end if;
end;
$$;

-- Moves one row from one visibility to another; raises when the row is not in `p_from`
-- (or, with p_owner_only, not owned by the caller).
create or replace function public.move_content(
  p_table text, p_id uuid, p_from public.visibility, p_to public.visibility, p_owner_only boolean
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
  n int;
begin
  perform public.assert_content_table(p_table);
  execute format(
    'update public.%I set visibility = $1
       where id = $2 and visibility = $3 and ($4 is false or owner_id = auth.uid())
       returning owner_id', p_table)
    into owner using p_to, p_id, p_from, p_owner_only;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'not_%: no % item % in that state', p_from, p_table, p_id using errcode = '22023';
  end if;
  return owner;
end;
$$;

-- V2: the owner (a parent who is not banned) shares a private row; it becomes pending.
create or replace function public.share_item(p_table text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_role() is distinct from 'parent' or public.is_banned(auth.uid()) then
    raise exception 'forbidden: only a parent can share' using errcode = '42501';
  end if;
  perform public.move_content(p_table, p_id, 'private', 'pending', true);
end;
$$;

-- V3: approve makes a pending row global.
create or replace function public.review_approve(p_table text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  perform public.move_content(p_table, p_id, 'pending', 'global', false);
end;
$$;

-- V3, V7: reject returns the row to private and keeps a readable reason.
create or replace function public.review_reject(p_table text, p_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  perform public.assert_super_admin();
  if p_note is null or btrim(p_note) = '' then
    raise exception 'note_required: a rejection needs a reason' using errcode = '22023';
  end if;
  owner := public.move_content(p_table, p_id, 'pending', 'private', false);
  insert into public.review_events (item_table, item_id, owner_id, kind, note, created_by)
    values (p_table, p_id, owner, 'rejection', btrim(p_note), auth.uid());
end;
$$;

-- V4, V5: back to private; the owner can edit and share again.
create or replace function public.unpublish_item(p_table text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  perform public.move_content(p_table, p_id, 'global', 'private', false);
end;
$$;

-- V5: delete any item.
create or replace function public.delete_item(p_table text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  perform public.assert_super_admin();
  perform public.assert_content_table(p_table);
  execute format('delete from public.%I where id = $1', p_table) using p_id;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'not_found: no % item %', p_table, p_id using errcode = '22023';
  end if;
end;
$$;

-- V4: the owner of a global row asks for it to be unpublished so they can edit it.
create or replace function public.request_edit(p_table text, p_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_owner uuid;
begin
  if public.current_role() is distinct from 'parent' or public.is_banned(auth.uid()) then
    raise exception 'forbidden: only a parent can request an edit' using errcode = '42501';
  end if;
  perform public.assert_content_table(p_table);
  execute format('select owner_id from public.%I where id = $1 and visibility = ''global'' and owner_id = auth.uid()', p_table)
    into found_owner using p_id;
  if found_owner is null then
    raise exception 'not_global: no global % item % of yours', p_table, p_id using errcode = '22023';
  end if;
  insert into public.review_events (item_table, item_id, owner_id, kind, note, created_by)
    values (p_table, p_id, found_owner, 'edit_request', nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
end;
$$;

-- U15: ban a parent with one of the content-policy reason codes (lib/policy/reasons.ts).
create or replace function public.ban_parent(p_user uuid, p_code text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  if p_code is null or p_code not in
     ('inaccurate', 'sexual', 'violent_scary', 'political', 'hate', 'off_target', 'personal_or_copyright', 'other') then
    raise exception 'invalid_reason: unknown ban reason code' using errcode = '22023';
  end if;
  update public.profiles
    set banned = true, ban_reason_code = p_code, ban_note = nullif(btrim(coalesce(p_note, '')), ''), banned_at = now()
    where user_id = p_user and role = 'parent';
  if not found then
    raise exception 'not_a_parent: % is not a parent', p_user using errcode = '22023';
  end if;
end;
$$;

create or replace function public.unban_parent(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  update public.profiles
    set banned = false, ban_reason_code = null, ban_note = null, banned_at = null
    where user_id = p_user and role = 'parent';
  if not found then
    raise exception 'not_a_parent: % is not a parent', p_user using errcode = '22023';
  end if;
end;
$$;

-- Q4: change a parent's storage quota.
create or replace function public.set_quota(p_user uuid, p_bytes bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  if p_bytes is null or p_bytes < 0 then
    raise exception 'invalid_quota: quota must be zero or more bytes' using errcode = '22023';
  end if;
  update public.profiles set quota_bytes = p_bytes where user_id = p_user and role = 'parent';
  if not found then
    raise exception 'not_a_parent: % is not a parent', p_user using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.assert_content_table(text) from public;
revoke all on function public.assert_super_admin() from public;
revoke all on function public.move_content(text, uuid, public.visibility, public.visibility, boolean) from public, anon, authenticated;
revoke all on function public.share_item(text, uuid) from public;
revoke all on function public.review_approve(text, uuid) from public;
revoke all on function public.review_reject(text, uuid, text) from public;
revoke all on function public.unpublish_item(text, uuid) from public;
revoke all on function public.delete_item(text, uuid) from public;
revoke all on function public.request_edit(text, uuid, text) from public;
revoke all on function public.ban_parent(uuid, text, text) from public;
revoke all on function public.unban_parent(uuid) from public;
revoke all on function public.set_quota(uuid, bigint) from public;
grant execute on function public.share_item(text, uuid) to authenticated, service_role;
grant execute on function public.review_approve(text, uuid) to authenticated, service_role;
grant execute on function public.review_reject(text, uuid, text) to authenticated, service_role;
grant execute on function public.unpublish_item(text, uuid) to authenticated, service_role;
grant execute on function public.delete_item(text, uuid) to authenticated, service_role;
grant execute on function public.request_edit(text, uuid, text) to authenticated, service_role;
grant execute on function public.ban_parent(uuid, text, text) to authenticated, service_role;
grant execute on function public.unban_parent(uuid) to authenticated, service_role;
grant execute on function public.set_quota(uuid, bigint) to authenticated, service_role;
