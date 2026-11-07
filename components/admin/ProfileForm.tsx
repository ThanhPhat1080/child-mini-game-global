'use client';

import { useState, type FormEvent } from 'react';
import { Pic } from '@/components/Pic';
import { InitialsAvatar } from '@/components/admin/InitialsAvatar';
import { LibraryButton } from '@/components/admin/LibraryButton';
import { Toast, useToast } from '@/components/admin/Toast';
import { mediaUrl } from '@/lib/media';
import { normalizePhone, saveMyProfile, validateName, validatePhone, type MyProfile } from '@/lib/profile';
import styles from '@/app/admin/admin.module.css';

const field = { display: 'flex', flexDirection: 'column' as const, gap: 6 };
const input = { height: 44, borderRadius: 12, border: '1.5px solid #E3D5C4', padding: '0 14px', fontSize: 15, fontFamily: 'Nunito, sans-serif', background: '#fff', color: '#4A3830' };

/**
 * "About you" (PR6-PR10): name, phone, sign-in email (read only) and the picture. One Save writes all of them.
 * Not optimistic: several fields are saved together, and a save can fail on validation (spec PR10).
 */
export function ProfileForm({ profile, onSaved }: { profile: MyProfile; onSaved: (p: MyProfile) => void }) {
  const [name, setName] = useState(profile.displayName);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [avatarPath, setAvatarPath] = useState(profile.avatarPath);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast, show, close } = useToast();

  const nameError = validateName(name);
  const phoneValue = normalizePhone(phone);
  const phoneError = validatePhone(phoneValue);
  const changed = name.trim() !== profile.displayName || phoneValue !== profile.phone || avatarPath !== profile.avatarPath;
  const canSave = changed && !nameError && !phoneError && !busy;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      await saveMyProfile({ displayName: name, phone: phoneValue, avatarPath });
      onSaved({ ...profile, displayName: name.trim(), phone: phoneValue, avatarPath });
      show('success', 'Profile saved.');
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} aria-labelledby="about-you" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 id="about-you" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>About you</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {avatarPath
          ? <Pic src={mediaUrl(avatarPath) ?? ''} alt="" width={120} height={120} style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover' }} />
          : <InitialsAvatar name={name || '?'} size={120} />}
        <LibraryButton kind="image" label="profile picture" onChoose={setAvatarPath} />
      </div>

      <div style={field}>
        <label htmlFor="profile-name" style={{ fontWeight: 700 }}>Name</label>
        <input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} style={input} />
        {nameError && name.length > 0 && <p role="alert" className={styles.sub} style={{ color: '#A8484F' }}>{nameError}</p>}
      </div>

      <div style={field}>
        <label htmlFor="profile-phone" style={{ fontWeight: 700 }}>Phone</label>
        <input id="profile-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={input} />
        <p className={styles.sub} style={{ fontSize: 13 }}>The Super Admin uses this number to reach you about your messages.</p>
        {phoneError && <p role="alert" className={styles.sub} style={{ color: '#A8484F' }}>{phoneError}</p>}
      </div>

      <div style={field}>
        <label htmlFor="profile-email" style={{ fontWeight: 700 }}>Email</label>
        <input id="profile-email" value={profile.email} readOnly style={{ ...input, background: '#F6F0E8', color: '#7A6458' }} />
        <p className={styles.sub} style={{ fontSize: 13 }}>This is your sign-in email. It does not change here.</p>
      </div>

      {error && <p role="alert" className={styles.sub} style={{ color: '#A8484F' }}>{error}</p>}

      <div>
        <button type="submit" disabled={!canSave} style={{ height: 44, padding: '0 22px', borderRadius: 12, border: 'none', background: '#5A4038', color: '#fff', fontWeight: 700, fontFamily: 'Nunito, sans-serif', fontSize: 15, cursor: canSave ? 'pointer' : 'default', opacity: canSave ? 1 : 0.5 }}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>

      <Toast toast={toast} onClose={close} />
    </form>
  );
}
