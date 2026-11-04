import { redirect } from 'next/navigation';
import { getMyProfile } from '@/lib/auth/roles';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Role-based landing: a parent starts at their children, a Super Admin at the review queue. */
export default async function AdminHome() {
  const me = await getMyProfile(await createSupabaseServerClient());
  redirect(me?.role === 'super_admin' ? '/admin/queue' : '/admin/children');
}
