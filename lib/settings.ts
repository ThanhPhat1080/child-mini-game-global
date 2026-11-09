import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getActiveChildId } from '@/lib/childSession';
import type { Gender } from '@/lib/childTheme';
import { getVisitor, type Visitor } from '@/lib/visitor';

/** `child_settings` columns: sounds and music, one row per child. */
export type ChildSettingsRow = {
  child_id: string;
  greeting_path: string | null;
  music_path: string | null;
  music_volume: number;
  hooray_path: string | null;
  ohoh_path: string | null;
  complete_path: string | null;
};

/** What play pages read: the settings row plus the child's display name and avatar from `children`. */
export type ChildSettings = ChildSettingsRow & { child_name: string | null; avatar_path: string | null; gender: Gender };

type Client = ReturnType<typeof createSupabaseBrowserClient>;

/**
 * A visitor (Guest Play, GU12) plays as a synthetic child: no sounds, the default music volume, the visitor's name
 * and gender. Nothing is read from or written to the database.
 */
export function visitorSettings(v: Visitor): ChildSettings {
  return {
    child_id: 'visitor',
    greeting_path: null,
    music_path: null,
    music_volume: 30,
    hooray_path: null,
    ohoh_path: null,
    complete_path: null,
    child_name: v.name,
    avatar_path: null,
    gender: v.gender,
  };
}

/** The active child's settings, or null when no child is chosen or the child is not visible. */
export async function getMyChildSettings(client: Client = createSupabaseBrowserClient()): Promise<ChildSettings | null> {
  const visitor = getVisitor();
  if (visitor) return visitorSettings(visitor);
  const id = getActiveChildId();
  if (!id) return null;
  const [settings, kid] = await Promise.all([
    getChildSettings(id, client),
    client.from('children').select('display_name, avatar_path, gender').eq('id', id).maybeSingle(),
  ]);
  if (kid.error) throw new Error(kid.error.message);
  if (!settings || !kid.data) return null;
  const k = kid.data as { display_name: string; avatar_path: string | null; gender: Gender };
  return { ...settings, child_name: k.display_name, avatar_path: k.avatar_path, gender: k.gender };
}

export async function getChildSettings(
  childId: string,
  client: Client = createSupabaseBrowserClient(),
): Promise<ChildSettingsRow | null> {
  const { data, error } = await client.from('child_settings').select('*').eq('child_id', childId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ChildSettingsRow | null) ?? null;
}

export async function updateChildSettings(
  childId: string,
  patch: Partial<ChildSettingsRow>,
  client: Client = createSupabaseBrowserClient(),
): Promise<void> {
  // child_name and avatar_path live on `children` now; drop them (and the key) if a caller still sends them.
  const { child_id: _ignored, child_name: _n, avatar_path: _a, ...rest } = patch as Record<string, unknown>;
  const { error } = await client.from('child_settings').update(rest).eq('child_id', childId);
  if (error) throw new Error(error.message);
}
