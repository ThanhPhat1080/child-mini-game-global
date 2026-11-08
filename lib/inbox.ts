/**
 * The parent's Inbox (spec 2026-11-07, IN1, IN4, IN6, IN8): reading the own messages and their status.
 * RLS keeps the rows to the signed-in parent; nothing here filters by user.
 */
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Client = ReturnType<typeof createSupabaseBrowserClient>;

export type MessageStatus = 'sent' | 'read' | 'resolved';

/** The label shown for each status. Text, so the status is never shown by colour alone. */
export const STATUS_LABEL: Record<MessageStatus, string> = { sent: 'Sent', read: 'Read', resolved: 'Resolved' };

/** Resolved wins over read, read over sent. A resolved message has been read, too. */
export function messageStatus(m: { readAt: string | null; resolvedAt: string | null }): MessageStatus {
  if (m.resolvedAt) return 'resolved';
  if (m.readAt) return 'read';
  return 'sent';
}

/** How many of these messages were sent in the 24 hours before `now` (the same window as the database limit). */
export function sentToday(messages: { createdAt: string }[], now: Date = new Date()): number {
  const since = now.getTime() - 24 * 60 * 60 * 1000;
  return messages.filter((m) => new Date(m.createdAt).getTime() > since).length;
}

export type OwnMessage = { id: string; body: string; createdAt: string; readAt: string | null; resolvedAt: string | null };

/** The signed-in parent's messages, newest first. */
export async function listMyMessages(client: Client = createSupabaseBrowserClient()): Promise<OwnMessage[]> {
  const { data, error } = await client
    .from('support_messages')
    .select('id, body, created_at, read_at, resolved_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string; body: string; created_at: string; read_at: string | null; resolved_at: string | null }[]).map((m) => ({
    id: m.id, body: m.body, createdAt: m.created_at, readAt: m.read_at, resolvedAt: m.resolved_at,
  }));
}
