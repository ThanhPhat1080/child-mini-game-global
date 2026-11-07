'use client';

import Link from 'next/link';

/** The copy at the top of the Inbox (spec IN2, IN3). Calm pastel card; the text is the whole message. */
export function InboxHighlight({ phone, email }: { phone: string | null; email: string }) {
  return (
    <section
      aria-label="About this mailbox"
      style={{ background: '#FFF8EC', border: '1.5px solid #EAD9A0', borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8, color: '#4A3830' }}
    >
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>
        This is your feedback mailbox. Tell the Super Admin about any problem or idea, big or small. The Super Admin replies as soon as possible, by email or by phone.
      </p>
      {email && phone && (
        <p style={{ margin: 0, fontSize: 15 }}>{`Replies go to your email ${email} and your phone ${phone}.`}</p>
      )}
      {email && !phone && (
        <p style={{ margin: 0, fontSize: 15 }}>
          <Link href="/admin/profile" style={{ fontWeight: 700, color: '#5A4038' }}>Add your phone number in Profile</Link>
          {' so the Super Admin can call you.'}
        </p>
      )}
    </section>
  );
}
