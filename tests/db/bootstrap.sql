-- Minimal Supabase stand-ins so supabase/migrations apply on plain Postgres.
-- Every object is created only if absent (existence checks), so on the real
-- supabase/postgres image nothing is created or overwritten. Unverified there: no Docker here.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin nologin noinherit;
  end if;
end $$;

-- Let the connecting user SET ROLE into them (superusers already can).
do $$
begin
  if not exists (
    select 1 from pg_auth_members m join pg_roles r on r.oid = m.roleid
    where r.rolname = 'authenticated' and m.member = (select oid from pg_roles where rolname = current_user)
  ) and not (select rolsuper from pg_roles where rolname = current_user) then
    execute format('grant anon, authenticated, service_role to %I', current_user);
  end if;
end $$;

create schema if not exists auth;
create schema if not exists storage;

do $$
begin
  if to_regclass('auth.users') is null then
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb default '{}',
      raw_app_meta_data jsonb default '{}',
      created_at timestamptz default now()
    );
    grant select on auth.users to service_role;
  end if;

  if to_regprocedure('auth.uid()') is null then
    create function auth.uid() returns uuid
    language sql stable as $f$
      select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
    $f$;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  end if;

  if to_regclass('storage.buckets') is null then
    create table storage.buckets (
      id text primary key,
      name text not null,
      owner uuid,
      public boolean default false,
      file_size_limit bigint,
      allowed_mime_types text[],
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );
    grant select, insert, update, delete on storage.buckets to anon, authenticated, service_role;
  end if;

  if to_regclass('storage.objects') is null then
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets (id),
      name text,
      owner uuid,
      metadata jsonb,
      path_tokens text[] generated always as (string_to_array(name, '/')) stored,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      last_accessed_at timestamptz default now()
    );
    alter table storage.objects enable row level security;
    grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
  end if;

  if to_regprocedure('storage.filename(text)') is null then
    create function storage.filename(name text) returns text
    language sql immutable as $f$
      select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)]
    $f$;
    grant execute on function storage.filename(text) to anon, authenticated, service_role;
  end if;

  if to_regprocedure('storage.foldername(text)') is null then
    create function storage.foldername(name text) returns text[]
    language plpgsql immutable as $f$
    declare _parts text[];
    begin
      _parts := string_to_array(name, '/');
      return _parts[1:array_length(_parts, 1) - 1];
    end $f$;
    grant execute on function storage.foldername(text) to anon, authenticated, service_role;
  end if;
end $$;

-- Schema usage: on the real image these already exist, and the grants are harmless re-grants
-- only when we are allowed to make them.
do $$
begin
  begin
    grant usage on schema auth, storage to anon, authenticated, service_role;
  exception when insufficient_privilege then null;
  end;
  grant usage on schema public to anon, authenticated, service_role;
end $$;
