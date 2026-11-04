import { mediaUrl } from '@/lib/media';
import { tintFor } from '@/lib/sets';
import { Pic } from '@/components/Pic';

export type SetCardData = { id: string; title: string; subtitle: string | null; heading_color: string; cover_path: string | null; count: number };

/** Quiz set card shared by the child screen and the admin preview (ADR-023). Matches the QuizSets board. */
export function SetCard({ set, done, hintEmptyCover }: { set: SetCardData; index?: number; done?: boolean; hintEmptyCover?: boolean }) {
  const cover = mediaUrl(set.cover_path);
  return (
    <span
      style={{ position: 'relative', width: 480, height: 700, borderRadius: 56, background: '#fff', boxShadow: '0 16px 0 #E3CFC0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: '#5A4038', boxSizing: 'border-box' }}
    >
      {done && (
        <span style={{ position: 'absolute', top: -26, right: -26, width: 88, height: 88, borderRadius: 44, background: '#F6E2A6', border: '8px solid #FBF4E9', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
          <svg aria-hidden="true" width="46" height="46" viewBox="0 0 24 24" fill="#EED79A" stroke="#B8903F" strokeWidth="1.5" strokeLinejoin="round"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" /></svg>
        </span>
      )}
      <span style={{ width: 300, height: 300, borderRadius: 150, background: cover || !hintEmptyCover ? tintFor(set.heading_color) : '#FFFDF9', border: cover || !hintEmptyCover ? 'none' : '3px dashed #D9C6B2', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, overflow: 'hidden' }}>
        {!cover && hintEmptyCover && <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, fontSize: 28, fontWeight: 700, color: '#A8968A', fontFamily: 'Nunito, sans-serif' }}>No cover yet</span>}
        {cover && <Pic src={cover} alt="" width={210} height={210} draggable={false} style={{ width: 210, height: 210, objectFit: 'contain' }} />}
      </span>
      <span style={{ fontSize: 64, fontWeight: 600, color: set.heading_color, lineHeight: 1 }}>{set.title}</span>
      {set.subtitle && <span style={{ fontSize: 34, fontWeight: 500, color: '#9A8174', lineHeight: 1 }}>{set.subtitle}</span>}
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '8px 22px 8px 16px', borderRadius: 999, background: '#FBF4E9', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 24, color: '#6E5A4E' }}>
        <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={set.heading_color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
        {set.count} {set.count === 1 ? 'question' : 'questions'}
      </span>
    </span>
  );
}
