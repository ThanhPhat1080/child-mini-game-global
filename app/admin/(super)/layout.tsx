import type { ReactNode } from 'react';
import { getMyProfile } from '@/lib/auth/roles';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ForbiddenView } from '@/components/admin/ForbiddenView';
import { AdminShell } from '@/components/admin/AdminShell';

/** Guard for the Super Admin console (N5): anyone else, parents included, gets the no-permission screen. */
export default async function SuperLayout({ children }: { children: ReactNode }) {
  const me = await getMyProfile(await createSupabaseServerClient());
  if (me?.role !== 'super_admin') {
    return <ForbiddenView text="This page is only for the Super Admin." home="/admin" />;
  }
  return <AdminShell role="super_admin">{children}</AdminShell>;
}
