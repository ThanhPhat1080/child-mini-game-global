'use client';

import { useEffect, useState } from 'react';
import styles from '../../admin.module.css';
import { ChildrenPanel } from '@/components/admin/ChildrenPanel';
import { ProfileForm } from '@/components/admin/ProfileForm';
import { loadMyProfile, type MyProfile } from '@/lib/profile';
import { AdminLoading } from '@/components/admin/AdminLoading';

/**
 * Profile (spec PR6-PR13): the signed-in user's name, phone and picture. A parent also sees their children here.
 * A Super Admin has the same details and no children.
 */
export default function ProfilePage() {
  const [profile, setProfile] = useState<MyProfile | null | undefined>(undefined);

  useEffect(() => {
    loadMyProfile().then(setProfile, () => setProfile(null));
  }, []);

  if (profile === undefined) return <AdminLoading label="Loading your profile…" />;
  if (profile === null) return <p className={styles.note}>Could not load your profile. Please sign in again.</p>;

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1>Profile</h1>
          <p className={styles.sub}>Your details{profile.role === 'parent' ? ', and your children' : ''}.</p>
        </div>
      </div>
      <ProfileForm profile={profile} onSaved={setProfile} />
      {profile.role === 'parent' && <ChildrenPanel />}
    </>
  );
}
