import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/** One row per child (spec U4); replaces the old singleton `settings` table. */
export type ChildSettings = {
  child_id: string;
  child_name: string | null;
  greeting_path: string | null;
  music_path: string | null;
  music_volume: number;
  avatar_path: string | null;
  hooray_path: string | null;
  ohoh_path: string | null;
  complete_path: string | null;
};

type Client = ReturnType<typeof createSupabaseBrowserClient>;

/** The signed-in child's row, or null when nobody is signed in or there is no row. */
export async function getMyChildSettings(client: Client = createSupabaseBrowserClient()): Promise<ChildSettings | null> {
  const { data } = await client.auth.getSession();
  if (!data.session) return null;
  return getChildSettings(data.session.user.id, client);
}

export async function getChildSettings(
  childId: string,
  client: Client = createSupabaseBrowserClient(),
): Promise<ChildSettings | null> {
  const { data, error } = await client.from('child_settings').select('*').eq('child_id', childId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ChildSettings | null) ?? null;
}

export async function updateChildSettings(
  childId: string,
  patch: Partial<ChildSettings>,
  client: Client = createSupabaseBrowserClient(),
): Promise<void> {
  const { child_id: _ignored, ...rest } = patch;
  const { error } = await client.from('child_settings').update(rest).eq('child_id', childId);
  if (error) throw new Error(error.message);
}

export type ChildSummary = Pick<ChildSettings, 'child_id' | 'child_name' | 'avatar_path'>;

/** The signed-in parent's children (RLS limits the rows), oldest first by name. */
export async function listMyChildren(client: Client = createSupabaseBrowserClient()): Promise<ChildSummary[]> {
  const { data, error } = await client.from('child_settings').select('child_id, child_name, avatar_path').order('child_name');
  if (error) throw new Error(error.message);
  return (data ?? []) as ChildSummary[];
}
