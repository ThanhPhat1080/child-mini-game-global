import type { ReactNode } from 'react';
import { getMyProfile } from '@/lib/auth/roles';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Browser tab title of every /admin page: "Super Admin" for the Super Admin, "Parent Admin" for anyone else. */
export async function generateMetadata() {
  const me = await getMyProfile(await createSupabaseServerClient());
  return { title: me?.role === 'super_admin' ? 'Super Admin' : 'Parent Admin' };
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
