-- LOCAL DEVELOPMENT ONLY. `supabase db reset` runs this file after the migrations (config.toml [db.seed]).
-- `supabase db push` never runs seed files, so production is never touched.
--
-- Makes sure the local database has the Super Admin thanhphat.994@gmail.com (the U6 step, done for you):
--   * no such account: creates it, email confirmed, with the local-only password below;
--   * the account exists (e.g. you signed up in the app): only sets its role to super_admin, password unchanged.
-- Safe to run again at any time.
do $$
declare
  v_email constant text := 'thanhphat.994@gmail.com';
  v_password constant text := 'local-superadmin'; -- local Supabase only; sign in, then change it if you like
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = v_email;

  if v_id is null then
    v_id := gen_random_uuid();
    -- "provisioned" tells the sign-up trigger (20261104000000_profiles_roles.sql) not to create a parent profile.
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"], "provisioned": true}', '{}', now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      v_id::text, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
      'email', now(), now(), now()
    );
  else
    update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = v_id;
  end if;

  insert into public.profiles (user_id, role, policy_version_accepted, policy_accepted_at)
  values (v_id, 'super_admin', '2026-11-04', now())
  on conflict (user_id) do update set role = 'super_admin', banned = false;
end $$;
