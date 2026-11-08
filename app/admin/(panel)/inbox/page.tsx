'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from '../../admin.module.css';
import { ContactForm, MAX_PER_DAY } from '@/components/admin/ContactForm';
import { InboxHighlight } from '@/components/admin/InboxHighlight';
import { MessageList } from '@/components/admin/MessageList';
import { listMyMessages, sentToday, type OwnMessage } from '@/lib/inbox';
import { loadMyProfile, type MyProfile } from '@/lib/profile';

/** The parent's Inbox (spec IN1-IN4): what the mailbox is for, a message form, and the messages with their status. */
export default function InboxPage() {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [messages, setMessages] = useState<OwnMessage[] | null>(null);

  const load = useCallback(async () => {
    try {
      setMessages(await listMyMessages());
    } catch {
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    loadMyProfile().then(setProfile, () => setProfile(null));
    void load();
  }, [load]);

  const used = messages ? sentToday(messages) : 0;
  const limited = used >= MAX_PER_DAY;

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1>Inbox</h1>
          <p className={styles.sub}>Send a message to the Super Admin, and follow what happens to it.</p>
        </div>
      </div>

      <InboxHighlight phone={profile?.phone ?? null} email={profile?.email ?? ''} />

      {messages && (
        // The key remounts the form when the day's limit is reached, so it starts off (IN4).
        <ContactForm key={String(limited)} initiallyLimited={limited} onSent={load} />
      )}
      {messages && <p className={styles.sub}>You have sent {used} of {MAX_PER_DAY} messages today.</p>}

      <MessageList messages={messages} />
    </>
  );
}
