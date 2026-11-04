'use client';

import { useCallback, useEffect, useState } from 'react';
import { banParent, listPeople, setQuota, storageUsedBy, unbanParent, type PersonRow } from '@/lib/superAdmin';
import { BAN_REASONS } from '@/lib/policy/reasons';
import { BanDialog } from '@/components/admin/BanDialog';
import { CreateAccountForm } from '@/components/admin/CreateAccountForm';
import { QuotaMeter } from '@/components/admin/QuotaMeter';
import { Toast, useToast } from '@/components/admin/Toast';
import styles from '../../admin.module.css';

const MB = 1024 * 1024;

/** Parents (N5): ban with a reason, unban, change the storage quota, create parents and Super Admins. */
export default function ParentsPage() {
  const [parents, setParents] = useState<PersonRow[] | null>(null);
  const [used, setUsed] = useState<Record<string, number>>({});
  const [banning, setBanning] = useState<PersonRow | null>(null);
  const [quotaMb, setQuotaMb] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const { toast, show, close } = useToast();

  const load = useCallback(async () => {
    try {
      const list = await listPeople('parent');
      setParents(list);
      setUsed(await storageUsedBy(list.map((p) => p.userId)));
    } catch (e) { show('error', (e as Error).message); }
  }, [show]);
  useEffect(() => { void load(); }, [load]);

  async function run(fn: () => Promise<void>, done: string) {
    setBusy(true);
    try { await fn(); show('success', done); setBanning(null); await load(); }
    catch (e) { show('error', (e as Error).message); }
    finally { setBusy(false); }
  }

  const reasonLabel = (code: string | null) => BAN_REASONS.find((r) => r.code === code)?.label ?? code ?? '';

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1>Parents</h1>
          <p className={styles.sub}>Ban a parent, restore them, or change how much they can store.</p>
        </div>
      </div>
      {parents && parents.length === 0 && <p className={styles.note}>No parents yet.</p>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 14 }}>
        {(parents ?? []).map((p) => (
          <li key={p.userId} className={styles.section} aria-label={`Parent ${p.name}`}>
            <div className={styles.head}>
              <div>
                <h2>{p.name || 'Unnamed parent'}</h2>
                {p.banned && <p>Banned: {reasonLabel(p.banReasonCode)}{p.banNote ? ` · ${p.banNote}` : ''}</p>}
              </div>
              {p.banned
                ? <button type="button" className={styles.ghost} disabled={busy} onClick={() => run(() => unbanParent(p.userId), 'Parent restored.')}>Unban</button>
                : <button type="button" className={styles.ghost} disabled={busy} onClick={() => setBanning(p)}>Ban</button>}
            </div>
            <QuotaMeter used={used[p.userId] ?? 0} quota={p.quotaBytes} />
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className={styles.fieldGroup}>
                <label htmlFor={`quota-${p.userId}`}>Quota (MB)</label>
                <input id={`quota-${p.userId}`} className={styles.input} type="number" min={0} style={{ width: 120 }}
                  value={quotaMb[p.userId] ?? String(Math.round(p.quotaBytes / MB))} onChange={(e) => setQuotaMb((m) => ({ ...m, [p.userId]: e.target.value }))} />
              </div>
              <button type="button" className={styles.primary} disabled={busy || !Number.isFinite(Number(quotaMb[p.userId] ?? 'x'))}
                onClick={() => run(() => setQuota(p.userId, Math.round(Number(quotaMb[p.userId]) * MB)), 'Quota changed.')}>Save quota</button>
            </div>
          </li>
        ))}
      </ul>
      <CreateAccountForm roles={['parent', 'super_admin']} onCreated={(m) => { show('success', m); void load(); }} onError={(m) => show('error', m)} />
      {banning && (
        <BanDialog name={banning.name} busy={busy} onCancel={() => setBanning(null)}
          onConfirm={(code, note) => run(() => banParent(banning.userId, code, note), 'Parent banned.')} />
      )}
      <Toast toast={toast} onClose={close} />
    </>
  );
}
