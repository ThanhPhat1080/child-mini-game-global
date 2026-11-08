import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { getMyProfile } from '@/lib/auth/roles';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const me = await getMyProfile(await createSupabaseServerClient());
  return <AdminShell role={me?.role ?? null}>{children}</AdminShell>;
}
