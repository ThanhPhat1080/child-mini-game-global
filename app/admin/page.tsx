import { redirect } from 'next/navigation';
import { getMyProfile } from '@/lib/auth/roles';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Role-based landing: a parent starts at their Profile, a Super Admin at the parents list. */
export default async function AdminHome() {
  const me = await getMyProfile(await createSupabaseServerClient());
  redirect(me?.role === 'super_admin' ? '/admin/parents' : '/admin/profile');
}
