'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { mediaUrl } from '@/lib/media';
import { deleteSet, isQuestionComplete, tintFor } from '@/lib/sets';
import { SetCard } from '@/components/SetCard';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import s from '@/components/admin/admin-ui.module.css';
import { Pic } from '@/components/Pic';
import { ContentTabs } from '@/components/admin/ContentTabs';
import { VisibilityBadge } from '@/components/admin/VisibilityBadge';
import { getMyUserId, useContentScope, type Visibility } from '@/lib/review';

type Row = {
  id: string; title: string; subtitle: string | null; heading_color: string; cover_path: string | null; status: string; updated_at: string; owner_id: string | null; visibility: Visibility;
  questions: { prompt_text: string | null; prompt_audio_path: string | null; answers: { slot: number; image_path: string | null; text: string | null; is_correct: boolean }[] }[];
};
type View = { id: string; title: string; subtitle: string | null; heading_color: string; cover_path: string | null; pub: boolean; visibility: Visibility; owner: string | null; count: number; total: number; updated: string };

function toView(r: Row): View {
  const complete = r.questions.filter((q) => {
    const imgs: (string | null)[] = [null, null, null];
    let correct: number | null = null;
    const texts = ['', '', ''];
    q.answers.forEach((a) => { imgs[a.slot - 1] = a.image_path; texts[a.slot - 1] = a.text ?? ''; if (a.is_correct) correct = a.slot - 1; });
    return isQuestionComplete({ text: q.prompt_text ?? '', voice: q.prompt_audio_path, imgs, texts, correct, count: q.answers.length === 2 ? 2 : 3 });
  }).length;
  return {
    id: r.id, title: r.title, subtitle: r.subtitle, heading_color: r.heading_color, cover_path: r.cover_path, pub: r.status === 'published', visibility: r.visibility, owner: r.owner_id,
    count: complete, total: r.questions.length,
    updated: new Date(r.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
  };
}

/** Quiz sets list + front page preview strip (A3). */
export default function SetsPage() {
  const [rows, setRows] = useState<View[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const { scope, setScope } = useContentScope();
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => { void getMyUserId().then(setMe, () => setMe(null)); }, []);

  const load = useCallback(async () => {
    const { data, error: e } = await createSupabaseBrowserClient()
      .from('quiz_sets')
      .select('id, title, subtitle, heading_color, cover_path, status, updated_at, owner_id, visibility, questions(prompt_text, prompt_audio_path, answers(slot, image_path, text, is_correct))')
      .order('position');
    if (e) setError(e.message);
    else setRows(((data as unknown as Row[]) ?? []).map(toView));
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function remove() {
    if (!confirm) return;
    setBusy(true);
    const r = await deleteSet(confirm.id);
    setBusy(false);
    if (r.error || r.warning) setError(r.error ?? r.warning);
    setConfirm(null);
    await load();
  }

  // "Mine" = my own sets (any state); "Global" = approved sets of other families, read-only (N3).
  const mine = (rows ?? []).filter((r) => (scope === 'mine' ? r.owner === me : r.visibility === 'global' && r.owner !== me));
  const visible = mine.filter((r) => r.pub && r.count > 0);
  const th = { padding: '16px 12px', fontWeight: 700 } as const;

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Quiz sets</h1>
          <p style={{ margin: '6px 0 0', color: '#7A6458', fontSize: 15 }}>Create sets, choose how they look on the front page, and delete the ones you no longer need.</p>
        </div>
        {scope === 'mine' && <Link href="/admin/sets/new" style={{ height: 46, padding: '0 22px', borderRadius: 12, background: '#5A4038', color: '#fff', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New quiz set
        </Link>}
      </div>
      <ContentTabs scope={scope} onChange={setScope} />
      {error && <p role="alert" style={{ margin: 0, color: '#A8484F', fontWeight: 700, fontSize: 14 }}>{error}</p>}

      <section style={{ background: '#fff', borderRadius: 18, padding: '22px 24px 24px', boxShadow: '0 1px 0 #EADCC8', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>Front page preview</h2>
          <p style={{ margin: '4px 0 0', color: '#7A6458', fontSize: 14 }}>This is what the child sees on the Quiz screen, left to right. Draft sets are hidden.</p>
        </div>
        <div style={{ display: 'flex', gap: 22, padding: '28px 24px 34px', borderRadius: 16, background: '#FBF4E9', overflowX: 'auto', alignItems: 'flex-start' }}>
          {visible.map((r) => (
            <div key={r.id} style={{ flex: 'none', width: 210, height: 306 }} aria-label={`${r.title}, ${r.count} questions`}>
              <div style={{ transform: 'scale(0.4375)', transformOrigin: 'top left', width: 480, height: 700 }}>
                <SetCard set={{ id: r.id, title: r.title, subtitle: r.subtitle, heading_color: r.heading_color, cover_path: r.cover_path, count: r.count }} />
              </div>
            </div>
          ))}
          {rows && visible.length === 0 && <p style={{ margin: 0, padding: '36px 8px', color: '#7A6458', fontSize: 15 }}>No published sets yet. The Quiz screen will be empty until you publish one.</p>}
        </div>
      </section>

      <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 1px 0 #EADCC8', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: 15 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#7A6458', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              <th style={{ ...th, padding: '16px 20px' }}>Set</th>
              <th style={th}>Questions</th>
              <th style={th}>Status</th>
              <th style={th}>Updated</th>
              <th style={{ ...th, padding: '16px 20px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...mine].reverse().map((r) => (
              <tr key={r.id} className={s.row} style={{ borderTop: '1px solid #F1E7DA' }}>
                <td style={{ padding: '12px 20px' }}>
                  <Link href={`/admin/sets/${r.id}`} style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', color: 'inherit' }}>
                    <Thumb path={r.cover_path} color={r.heading_color} />
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 20, fontWeight: 600, lineHeight: 1.1, color: r.heading_color }}>{r.title}</span>
                      <span style={{ fontSize: 13, ...(r.subtitle ? { color: '#7A6458' } : { color: '#A8968A', fontStyle: 'italic' }) }}>{r.subtitle || 'No sub-title'}</span>
                    </span>
                  </Link>
                </td>
                <td style={{ padding: '12px 12px' }}>{r.count}{r.total > r.count ? <span style={{ color: '#7A5410', fontSize: 13 }}> · {r.total - r.count} incomplete</span> : null}</td>
                <td style={{ padding: '12px 12px' }}>
                  <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, ...(r.pub ? { background: '#E3EEDD', color: '#3F6B48' } : { background: '#F3ECE3', color: '#6E5A4E' }) }}>{r.pub ? 'Published' : 'Draft'}</span>
                    <VisibilityBadge visibility={r.visibility} />
                  </span>
                </td>
                <td style={{ padding: '12px 12px', color: '#7A6458' }}>{r.updated}</td>
                <td style={{ padding: '12px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <Link href={`/admin/sets/${r.id}`} className={s.link} style={{ fontWeight: 700, marginRight: 8, padding: '8px 10px' }}>{scope === 'mine' && r.visibility === 'private' ? 'Edit' : 'View'}</Link>
                  {scope === 'mine' && r.visibility === 'private' && <button type="button" className={s.danger} aria-label={`Delete ${r.title}`} onClick={() => setConfirm(r)} style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 15, color: '#A8484F', background: 'transparent', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows && mine.length === 0 && <p style={{ margin: 0, padding: '32px 20px', textAlign: 'center', color: '#7A6458' }}>{scope === 'mine' ? 'No quiz sets yet. Create your first one with “New quiz set”.' : 'No global quiz sets yet.'}</p>}
      </div>
      <p style={{ margin: 0, fontSize: 13, color: '#7A6458' }}>A set needs at least one complete question before it can be published.</p>

      {confirm && (
        <ConfirmDialog
          title={`Delete “${confirm.title}”?`}
          body={`This removes the set and its ${confirm.total} ${confirm.total === 1 ? 'question' : 'questions'}${confirm.pub ? ', and it disappears from the front page' : ''}. This can’t be undone.`}
          button="Delete set"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={remove}
        />
      )}
    </>
  );
}

function Thumb({ path, color }: { path: string | null; color: string }) {
  return (
    <span style={{ width: 56, height: 56, borderRadius: 28, flex: 'none', background: tintFor(color), display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {path && <CoverImg path={path} size={38} />}
    </span>
  );
}
function CoverImg({ path, size }: { path: string; size: number }) {
  return <Pic src={mediaUrl(path) ?? ''} alt="" width={size} height={size} style={{ objectFit: 'contain' }} />;
}
