# Parent Profile and Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (chosen by the user: implement in this session). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parents get a Profile page (name, phone, picture, children) and an Inbox that sends feedback to the Super Admin and shows each message's status. The Super Admin sees a parent's email and phone next to each message, and every admin, parent or Super Admin, has an optional phone on Profile.

**Architecture:** One additive migration (columns, a column grant, an own-row update policy, a Super Admin-only contacts function). Small focused units: validation and data access in `lib/`, a shared `ContactForm`, a `ChildrenPanel` moved out of the Children page, and two new pages under `app/admin/(panel)/`. The e2e stand-in Supabase learns the new columns and the function.

**Tech Stack:** Next.js (App Router), React, TypeScript, Supabase (Postgres, RLS, Auth), Vitest, pg-based RLS tests (`npm run test:rls`), Playwright (`npm run e2e`).

**Spec:** `docs/superpowers/specs/2026-11-07-parent-profile-inbox-design.md` (decisions: phone optional, checked only for length and allowed characters; the Super Admin also has an optional phone).

## Global Constraints

- Phone: optional. After trim, empty means null. Otherwise it must match `^\+?[0-9 ().-]{8,20}$` and contain at least 8 digits. No country-code check.
- Display name: 1 to 40 characters after trim. Required for a parent to save.
- Picture: square crop (A24), chosen from the library. Picking from the library gives no crop (A25).
- Admin copy is English. No child-facing text.
- RLS decides access. The UI only mirrors it. No service role key in the frontend.
- Migration is additive. No production deploy and no Supabase dashboard change.
- Commits end with the `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>` line. Branch `claude/parent-profile-inbox`.

## Review Focus

1. A name of only spaces is rejected in the UI and by the database, and is not saved (PR3, PR6).
2. A phone with letters, or with fewer than 8 digits, is rejected; an empty phone is stored as null, not an empty string (PR1, PR7).
3. A parent cannot set `role`, `banned` or `quota_bytes` through a direct update, even with the own-row policy (PR4).
4. A banned parent cannot update their profile (PR5).
5. At 5 messages today the Inbox form turns off; a further attempt shows the rate-limit text, not a generic error (IN4).

Each line is pinned by the test named in its owning task (Tasks 1, 2, 3, 5).

---

### Task 1: Migration and database tests

**Files:**
- Create: `supabase/migrations/20261107100000_parent_profile_inbox.sql`
- Create: `tests/db/profile.test.ts`

**Interfaces:**
- Consumes: the existing harness in `tests/db/harness.ts` (`startDb`, `stopDb`, `resetDb`, `createUser`, `as`, `superQuery`).
- Produces: columns `profiles.phone`, `profiles.avatar_path`; function `public.super_admin_parent_contacts()` returning `table (user_id uuid, display_name text, email text, phone text)`, for Tasks 3 and 11.

- [ ] **Step 1: Write the failing database tests**

```ts
// tests/db/profile.test.ts
describe('parent profile and contacts (PR1-PR5, SA1)', () => {
  // beforeAll/afterAll/beforeEach as in tests/db/media.test.ts: resetDb, then sa, a (parent), b (parent).
  it('a parent updates their own name, phone and picture', async () => {
    await as(a).query(`update public.profiles set display_name = 'Lan', phone = '+84 912 345 678', avatar_path = $1 where user_id = $2`, [`${a}/me.webp`, a]);
    const row = (await superQuery(`select display_name, phone, avatar_path from public.profiles where user_id = $1`, [a])).rows[0];
    expect(row).toEqual({ display_name: 'Lan', phone: '+84 912 345 678', avatar_path: `${a}/me.webp` });
  });
  it('a parent cannot change role, banned or quota_bytes', async () => {
    await expect(as(a).query(`update public.profiles set banned = true where user_id = $1`, [a])).rejects.toThrow();
    await expect(as(a).query(`update public.profiles set quota_bytes = 1 where user_id = $1`, [a])).rejects.toThrow();
    await expect(as(a).query(`update public.profiles set role = 'super_admin' where user_id = $1`, [a])).rejects.toThrow();
  });
  it('a parent cannot update another profile', async () => {
    const r = await as(a).query(`update public.profiles set display_name = 'x' where user_id = $1 returning user_id`, [b]);
    expect(r).toHaveLength(0);
  });
  it('a banned parent cannot update their own profile', async () => {
    await superQuery(`update public.profiles set banned = true where user_id = $1`, [a]);
    const r = await as(a).query(`update public.profiles set display_name = 'x' where user_id = $1 returning user_id`, [a]);
    expect(r).toHaveLength(0);
  });
  it('the phone check accepts empty (null) and 8 to 20 digits, rejects letters and short numbers', async () => {
    await expect(as(a).query(`update public.profiles set phone = null where user_id = $1`, [a])).resolves.toBeDefined();
    await expect(as(a).query(`update public.profiles set phone = '0912345678' where user_id = $1`, [a])).resolves.toBeDefined();
    await expect(as(a).query(`update public.profiles set phone = '0912abc678' where user_id = $1`, [a])).rejects.toThrow();
    await expect(as(a).query(`update public.profiles set phone = '1234567' where user_id = $1`, [a])).rejects.toThrow();
  });
  it('the display name check rejects a blank name on a new write', async () => {
    await expect(as(a).query(`update public.profiles set display_name = '   ' where user_id = $1`, [a])).rejects.toThrow();
  });
  it('super_admin_parent_contacts returns parents with email for a Super Admin only', async () => {
    const rows = (await as(sa).query(`select user_id, email from public.super_admin_parent_contacts()`));
    expect(rows.map((r) => r.user_id).sort()).toEqual([a, b].sort());
    await expect(as(a).query(`select * from public.super_admin_parent_contacts()`)).rejects.toThrow(/forbidden/);
    await expect(as(null).query(`select * from public.super_admin_parent_contacts()`)).rejects.toThrow();
  });
});
```

Note for the implementer: `as(...).query` and `superQuery` return rows as in `tests/db/media.test.ts`. Use the same helper signatures; if `as(...).query` returns `{ rows }`, adapt the assertions. The `email` values come from `auth.users`, which `createUser` already writes.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:rls -- tests/db/profile.test.ts`
Expected: FAIL (columns and function do not exist).

- [ ] **Step 3: Write the migration**

File `supabase/migrations/20261107100000_parent_profile_inbox.sql`. Content, in this order:

```sql
alter table public.profiles add column phone text;
alter table public.profiles add column avatar_path text;

alter table public.profiles add constraint profiles_phone_check check (
  phone is null or (
    phone = btrim(phone)
    and phone ~ '^\+?[0-9 ().-]{8,20}$'
    and length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 8
  )
);
-- not valid: existing rows are not checked at once; every new write is.
alter table public.profiles add constraint profiles_display_name_check check (
  display_name is null or char_length(btrim(display_name)) between 1 and 40
) not valid;

grant update (display_name, phone, avatar_path) on public.profiles to authenticated;

create policy profiles_update_own on public.profiles for update to authenticated
  using (user_id = auth.uid() and banned = false)
  with check (user_id = auth.uid() and banned = false);

create or replace function public.super_admin_parent_contacts()
returns table (user_id uuid, display_name text, email text, phone text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_role() is distinct from 'super_admin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select p.user_id, p.display_name, u.email::text, p.phone
    from public.profiles p
    join auth.users u on u.id = p.user_id
    where p.role = 'parent'
    order by p.created_at;
end;
$$;
revoke all on function public.super_admin_parent_contacts() from public, anon;
grant execute on function public.super_admin_parent_contacts() to authenticated;
```

Check: `order by p.created_at` requires `created_at` on `profiles`. Confirm in `supabase/migrations/20261104000000_profiles_roles.sql`; if it is missing, order by `p.user_id` instead.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:rls -- tests/db/profile.test.ts`
Expected: PASS. Then run `npm run test:rls` in full; expected: all files pass (no existing policy changed).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261107100000_parent_profile_inbox.sql tests/db/profile.test.ts
git commit -m "feat: parent phone and picture, own-row profile update, Super Admin parent contacts (PR1-PR5, SA1)"
```

---

### Task 2: Validation for name and phone

**Files:**
- Create: `lib/profile.ts`
- Create: `tests/profile.test.ts`

**Interfaces:**
- Produces:
  - `export const MAX_NAME = 40;`
  - `export function validateName(name: string): string | null` (returns the error text or null)
  - `export function normalizePhone(phone: string): string | null` (trim; empty becomes null)
  - `export function validatePhone(phone: string | null): string | null`
  - `export const PHONE_HINT: string` = `"Enter a phone number with 8 to 20 digits, for example +84 912 345 678."`
  - `export const NAME_ERROR: string` = `"Enter your name (1 to 40 characters)."`

- [ ] **Step 1: Write the failing tests**

```ts
describe('validateName (PR6)', () => {
  it('rejects blank and over-long names', () => {
    expect(validateName('   ')).toBe(NAME_ERROR);
    expect(validateName('a'.repeat(41))).toBe(NAME_ERROR);
  });
  it('accepts a name of 1 to 40 characters', () => {
    expect(validateName(' Lan ')).toBeNull();
    expect(validateName('a'.repeat(40))).toBeNull();
  });
});

describe('phone (PR1, PR7)', () => {
  it('an empty phone is null', () => {
    expect(normalizePhone('   ')).toBeNull();
    expect(validatePhone(null)).toBeNull();
  });
  it('accepts digits with common separators, 8 to 20 characters, at least 8 digits', () => {
    expect(validatePhone('+84 912 345 678')).toBeNull();
    expect(validatePhone('0912.345.678')).toBeNull();
  });
  it('rejects letters, fewer than 8 digits, and too long values', () => {
    expect(validatePhone('0912abc678')).toBe(PHONE_HINT);
    expect(validatePhone('1234567')).toBe(PHONE_HINT);
    expect(validatePhone('1'.repeat(21))).toBe(PHONE_HINT);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/profile.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/profile.ts` validation**

Use the regex and digit rule from Global Constraints. `validateName` trims, then checks length with `[...name].length` (matches `lib/children.ts`). `normalizePhone` returns `null` for an empty trimmed value and the trimmed string otherwise. `validatePhone` returns `null` for null or valid, `PHONE_HINT` otherwise.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/profile.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/profile.ts tests/profile.test.ts
git commit -m "feat: name and phone validation for the parent profile (PR1, PR6, PR7)"
```

---

### Task 3: Profile data access

**Files:**
- Modify: `lib/profile.ts` (add data functions below the validation)
- Modify: `lib/superAdmin.ts` (add `listParentContacts`)
- Create: `tests/profileData.test.ts`

**Interfaces:**
- Consumes: Task 2 validation; `getMyProfile` in `lib/auth/roles.ts`; `Client` type used in `lib/superAdmin.ts`.
- Produces:
  - `export type MyProfile = { userId: string; role: 'parent' | 'super_admin'; displayName: string; phone: string | null; avatarPath: string | null; email: string }`
  - `export async function loadMyProfile(client?: Client): Promise<MyProfile | null>`: reads `profiles` columns and the email from the signed-in user (`client.auth.getUser()`).
  - `export async function saveMyProfile(input: { displayName: string; phone: string | null; avatarPath: string | null }, client?: Client): Promise<void>`: throws `Error` with the validation text when invalid; writes the three columns with `update ... eq('user_id', me)`.
  - `export type ParentContact = { userId: string; displayName: string; email: string; phone: string | null }` and `export async function listParentContacts(client?: Client): Promise<ParentContact[]>` in `lib/superAdmin.ts`: calls `rpc('super_admin_parent_contacts')`.

- [ ] **Step 1: Write the failing tests**

Mock the client with a small fake exposing `from(table).update(row).eq(...)`, `from(table).select(...).eq(...).maybeSingle()`, `auth.getUser()` and `rpc(name)`. Tests:

```ts
it('saveMyProfile trims the name and stores a null phone when empty', async () => {
  await saveMyProfile({ displayName: '  Lan  ', phone: normalizePhone('  ') , avatarPath: null }, fake);
  expect(fake.updates.at(-1)).toEqual({ display_name: 'Lan', phone: null, avatar_path: null });
});
it('saveMyProfile refuses an invalid name before any request', async () => {
  await expect(saveMyProfile({ displayName: ' ', phone: null, avatarPath: null }, fake)).rejects.toThrow(NAME_ERROR);
  expect(fake.updates).toHaveLength(0);
});
it('listParentContacts maps the rpc rows', async () => { /* fake rpc returns one row */ });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/profileData.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`loadMyProfile`: `getUser()` for the id and email; `profiles` select of `display_name, phone, avatar_path, role`; return `null` when either is missing. `saveMyProfile`: run both validators first, then `update` with the three columns and `.eq('user_id', userId)` from `getUser()`. Map a database error to `Error(message)`. `listParentContacts`: `client.rpc('super_admin_parent_contacts')`, map `user_id`, `display_name` (null becomes `''`), `email`, `phone`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/profileData.test.ts tests/profile.test.ts tests/superAdmin.test.ts`
Expected: PASS (existing `superAdmin` tests stay green).

- [ ] **Step 5: Commit**

```bash
git add lib/profile.ts lib/superAdmin.ts tests/profileData.test.ts
git commit -m "feat: load and save the own profile, list parent contacts for the Super Admin (PR6, PR10, SA2)"
```

---

### Task 4: Shared ContactForm, used by the suspended page

**Files:**
- Create: `components/admin/ContactForm.tsx`
- Modify: `app/admin/suspended/page.tsx` (use the form; behaviour unchanged)
- Create: `tests/ContactForm.test.tsx`

**Interfaces:**
- Produces: `export function ContactForm({ onSent }: { onSent?: () => void })`, which owns the textarea, the 2000-character limit, the send button, the rate-limit state and the status line. It writes `support_messages` with `{ body }` through `createSupabaseBrowserClient()`, exactly as the suspended page does today, and calls `onSent` after a successful send.
- Constants used: `MAX_PER_DAY = 5`, `"Message sent. The Super Admin will read it."`, `"You can send 5 messages a day. Please try again tomorrow."`, `"Could not send the message. Please try again."`.

- [ ] **Step 1: Write the failing tests**

Test cases, mocking `createSupabaseBrowserClient` so `from('support_messages').insert` resolves or rejects:
- disables Send while the body is blank, and enables it with text;
- success shows "Message sent. The Super Admin will read it." and clears the text;
- an error whose message contains `rate_limited` shows the rate-limit text;
- any other error shows "Could not send the message. Please try again.".

Run the existing `tests/SuspendedPage.test.tsx` (if present) plus `grep -rl suspended tests` to find the file; it must keep passing.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/ContactForm.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Move the form JSX and `send` from `app/admin/suspended/page.tsx` into `ContactForm`. The suspended page keeps its heading and its reason text and renders `<ContactForm />`. Keep the label "Contact the Super Admin" on the suspended page; the inbox passes its own heading (Task 6).

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/ContactForm.test.tsx` then `grep -l -i suspended tests/*.tsx | xargs npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/admin/ContactForm.tsx app/admin/suspended/page.tsx tests/ContactForm.test.tsx
git commit -m "refactor: share the contact form between the suspended page and the Inbox (IN4, IN5)"
```

---

### Task 5: Message status and list

**Files:**
- Create: `lib/inbox.ts`
- Create: `components/admin/MessageList.tsx`
- Create: `tests/inbox.test.ts`, `tests/MessageList.test.tsx`

**Interfaces:**
- Produces:
  - `export type MessageStatus = 'sent' | 'read' | 'resolved'`
  - `export function messageStatus(m: { readAt: string | null; resolvedAt: string | null }): MessageStatus` (resolved wins; read otherwise, sent when neither)
  - `export const STATUS_LABEL: Record<MessageStatus, string>` = `{ sent: 'Sent', read: 'Read', resolved: 'Resolved' }`
  - `export function sentToday(messages: { createdAt: string }[], now?: Date): number` (count within the last 24 hours)
  - `export async function listMyMessages(client?: Client): Promise<OwnMessage[]>` with `OwnMessage = { id; body; createdAt; readAt; resolvedAt }` from `support_messages` (RLS keeps only own rows), newest first.
  - `export function MessageList({ messages }: { messages: OwnMessage[] | null })`: heading "Your messages"; empty text `"No messages yet. Write to the Super Admin above whenever you need help."`; each item shows body, local time, and the status label.

- [ ] **Step 1: Write the failing tests**

```ts
it('resolved wins over read, read over sent', () => {
  expect(messageStatus({ readAt: 'x', resolvedAt: 'y' })).toBe('resolved');
  expect(messageStatus({ readAt: 'x', resolvedAt: null })).toBe('read');
  expect(messageStatus({ readAt: null, resolvedAt: null })).toBe('sent');
});
it('counts messages in the last 24 hours', () => {
  const now = new Date('2026-11-07T12:00:00Z');
  expect(sentToday([{ createdAt: '2026-11-07T11:00:00Z' }, { createdAt: '2026-11-05T11:00:00Z' }], now)).toBe(1);
});
it('shows the empty text, and one status label per item', () => { /* render cases */ });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/inbox.test.ts tests/MessageList.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** the functions and the list above. The list uses the `styles` and `ui` modules already used by `app/admin/(super)/messages/page.tsx`; status is text, not colour alone.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/inbox.test.ts tests/MessageList.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/inbox.ts components/admin/MessageList.tsx tests/inbox.test.ts tests/MessageList.test.tsx
git commit -m "feat: message status and the parent's own message list (IN6, IN7, IN8)"
```

---

### Task 6: Inbox page

**Files:**
- Create: `app/admin/(panel)/inbox/page.tsx`
- Create: `components/admin/InboxHighlight.tsx`
- Create: `tests/InboxPage.test.tsx`

**Interfaces:**
- Consumes: `ContactForm` (Task 4), `listMyMessages`, `sentToday` (Task 5), `loadMyProfile` (Task 3).
- Produces: the page at `/admin/inbox`.
- `InboxHighlight({ phone, email })` renders the highlight text from IN2 and the contact line from IN3. Exact copy:
  - Highlight: `"This is your feedback mailbox. Tell the Super Admin about any problem or idea, big or small. The Super Admin replies as soon as possible, by email or by phone."`
  - With a phone: `"Replies go to your email {email} and your phone {phone}."`
  - Without a phone: `"Add your phone number in Profile so the Super Admin can call you."` with a link to `/admin/profile`.
- The page shows "You have sent N of 5 messages today." under the form, using `sentToday`.

- [ ] **Step 1: Write the failing tests**

- the highlight text and both contact-line variants render;
- the counter shows "You have sent 4 of 5 messages today." for four messages in the last day;
- the list shows the statuses from `listMyMessages` (mock it).

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/InboxPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** the page as a client component: load profile and messages on mount, then render `InboxHighlight`, `ContactForm` (with `onSent` reloading the messages), the counter, and `MessageList`. Heading: `Inbox`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/InboxPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/admin/\(panel\)/inbox/page.tsx components/admin/InboxHighlight.tsx tests/InboxPage.test.tsx
git commit -m "feat: parent Inbox page with the feedback mailbox highlight (IN1-IN4)"
```

---

### Task 7: Picture and profile form, role-aware Profile page

**Files:**
- Create: `components/admin/ProfileForm.tsx` (name, phone, email, picture, Save)
- Create: `app/admin/(panel)/profile/page.tsx`
- Create: `tests/ProfileForm.test.tsx`

**Interfaces:**
- Consumes: `loadMyProfile`, `saveMyProfile` (Task 3); `LibraryButton` with `aspect={1}` (existing; the square crop is the default); `InitialsAvatar` (existing); `Toast`/`useToast` (existing); `ChildrenPanel` (Task 8) rendered only when `role === 'parent'`.
- Produces: `ProfileForm({ profile, onSaved })` where `profile` is `MyProfile` from Task 3; it renders the picture with `InitialsAvatar` when there is no picture, the library button with the label `Choose from library for profile picture`, and a Save button enabled only when a field changed and the name is valid.
- Copy: heading `Profile`; section label `About you`; field labels `Name`, `Phone`, `Email`; hints `The Super Admin uses this number to reach you about your messages.` and `This is your sign-in email. It does not change here.`; toast `Profile saved.`; error `Could not save. Please try again.`
- Not optimistic (spec PR10): the values change only after `saveMyProfile` resolves.

- [ ] **Step 1: Write the failing tests**

- Save is disabled until the name changes, and disabled for a blank name;
- a valid save calls `saveMyProfile` with the trimmed name and null for an empty phone, then shows `Profile saved.`;
- an invalid phone shows the `PHONE_HINT` text and does not call save;
- a save error keeps the typed values and shows `Could not save. Please try again.`;
- a Super Admin profile (`role: 'super_admin'`) renders no `Your children` section, and the parent profile does.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/ProfileForm.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** `ProfileForm` and the page. The page loads the profile with `loadMyProfile`, shows a loading line until it is known, and renders `ProfileForm`, then (for parents only) the `Your children` section.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/ProfileForm.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/admin/ProfileForm.tsx app/admin/\(panel\)/profile/page.tsx tests/ProfileForm.test.tsx
git commit -m "feat: Profile page with name, phone, picture for parents and the Super Admin (PR6-PR10, PR13)"
```

---

### Task 8: Children moved into Profile, old routes redirect

**Files:**
- Create: `components/admin/ChildrenPanel.tsx` (the body of `app/admin/(panel)/children/page.tsx`, unchanged in behaviour)
- Modify: `app/admin/(panel)/children/page.tsx` (redirect to `/admin/profile`)
- Modify: `app/admin/(panel)/settings/page.tsx` (redirect to `/admin/profile`)
- Modify: `app/admin/page.tsx` (parent lands on `/admin/profile`)
- Create: `tests/ChildrenPanel.test.tsx`

**Interfaces:**
- Produces: `export function ChildrenPanel()` with no props; it renders the same heading text `Children` only as a section label inside Profile (level 2), not as a page title.
- Redirects use `redirect('/admin/profile')` from `next/navigation`.

- [ ] **Step 1: Write the failing test**

Mock `listMyChildren`; render `<ChildrenPanel />`; expect the `Add child` button and a card per child, and the section heading `Your children` (level 2).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/ChildrenPanel.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**: copy the children page body into `ChildrenPanel`, change the title to a level-2 heading `Your children`, keep the existing behaviour. Then replace the children page body with `redirect('/admin/profile')`, same for settings, and change `app/admin/page.tsx` to redirect parents to `/admin/profile`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/ChildrenPanel.test.tsx tests/AdminPage.test.tsx` (if it exists; otherwise `grep -l "admin/children" tests/*` and run those)
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/admin/ChildrenPanel.tsx app/admin/\(panel\)/children/page.tsx app/admin/\(panel\)/settings/page.tsx app/admin/page.tsx tests/ChildrenPanel.test.tsx
git commit -m "refactor: children move into Profile; the old Children and Settings routes redirect (PR11)"
```

---

### Task 9: Sidebar

**Files:**
- Modify: `components/AdminNav.tsx`
- Modify: `tests/AdminNav.test.tsx`

**Interfaces:**
- Parent sidebar: `Profile` (person glyph, `/admin/profile`), then `Inbox` (mailbox glyph, `/admin/inbox`), replacing `Children`.
- Super Admin sidebar: `Profile` is added at the top of the Super Admin group, linking to `/admin/profile`. Everything else is unchanged.
- Glyphs use the same `icon` props and `stroke` style as the existing items.

- [ ] **Step 1: Write the failing test**

Update `tests/AdminNav.test.tsx`: for a parent, the links are `Profile`, `Inbox` and the shared ones; no `Children` link. For a Super Admin, `Profile` is present along with `Children`, `Parents`, `Messages`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/AdminNav.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** the two items in `components/AdminNav.tsx` (replace `CHILDREN` for parents; add `PROFILE` for both roles) and render them with the existing `link()` helper so tooltips and accessible names still work.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/AdminNav.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/AdminNav.tsx tests/AdminNav.test.tsx
git commit -m "feat: Profile and Inbox in the parent sidebar; Profile for the Super Admin too (PR12-PR14)"
```

---

### Task 10: Super Admin sees contact details on Messages

**Files:**
- Modify: `app/admin/(super)/messages/page.tsx`
- Create: `tests/MessagesContacts.test.tsx`

**Interfaces:**
- Consumes: `listParentContacts` (Task 3).
- Each message shows the sender's name, `mailto:` link for the email, and `tel:` link for the phone. When the phone is null the line says `No phone number`. If `listParentContacts` fails, the messages still show, with `Contact details are not available right now.`

- [ ] **Step 1: Write the failing test**

Mock `listMessages`, `listPeople` and `listParentContacts`. Expect a `mailto:` link with the email, a `tel:` link with the phone, and the failure text when the contacts promise rejects while the messages still render.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/MessagesContacts.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**: load contacts in the same `Promise.all` path as the messages, but catch its failure separately so messages still show.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/MessagesContacts.test.tsx` and the existing `tests/*Messages*` files.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/admin/\(super\)/messages/page.tsx tests/MessagesContacts.test.tsx
git commit -m "feat: Super Admin sees a parent's email and phone next to each message (SA2, SA3)"
```

---

### Task 11: E2E stand-in and e2e specs

**Files:**
- Modify: `e2e/support/standin-supabase.mjs`:
  - `profile(u, role, extra)` helper (around line 36 and 256) gains `phone: null` and `avatar_path: null`.
  - The fake user store keeps `email` per user (the same emails as `ACCOUNTS` in `e2e/support/fixtures.ts`).
  - `rpc()` (around line 263) adds `super_admin_parent_contacts`: for a Super Admin, return the parent profiles with `user_id, display_name, email, phone`; otherwise return a 403 with `{ message: 'forbidden' }`.
  - `profiles` updates for the signed-in user are applied; other users' rows are not changed.
- Modify: `e2e/support/fixtures.ts` only if a new helper is needed.
- Create: `e2e/parent-profile.spec.ts`, `e2e/admin-parent-inbox.spec.ts`.

**Interfaces:**
- Consumes: Tasks 1 to 10.

- [ ] **Step 1: Write the failing e2e tests**

`e2e/parent-profile.spec.ts`:
- signs in as the parent (`signInAsAdmin`), opens `Profile` from the sidebar, types name `Lan Anh` and phone `+84 912 345 678`, clicks Save, sees `Profile saved.`, reloads, and sees both values;
- the `Your children` section lists the seeded child `Test`;
- `/admin/children` redirects to `/admin/profile`.

`e2e/admin-parent-inbox.spec.ts`:
- the parent opens Inbox, sees the highlight text, sends `Please fix the sound`, and sees it listed as `Sent`;
- the Super Admin (`signInAsSuper`) opens Messages and sees the parent's email as a `mailto:` link and the phone as a `tel:` link.

Use `reset()` in `beforeEach` as the other specs do.

- [ ] **Step 2: Run to verify they fail**

Run: `PW_CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npx playwright test e2e/parent-profile.spec.ts e2e/admin-parent-inbox.spec.ts`
Expected: FAIL (Profile and Inbox do not exist in the stand-in yet).

- [ ] **Step 3: Implement the stand-in changes and make the specs pass.**

- [ ] **Step 4: Run to verify they pass**

Run the same command. Expected: PASS. Then run the related existing specs: `PW_CHROMIUM_PATH=... npx playwright test e2e/admin-celebration-crop.spec.ts e2e/back-leave.spec.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/support/standin-supabase.mjs e2e/support/fixtures.ts e2e/parent-profile.spec.ts e2e/admin-parent-inbox.spec.ts
git commit -m "test: e2e for parent Profile, Inbox and the Super Admin contact view"
```

---

### Task 12: Full verification and spec IDs

**Files:**
- Modify: `spec.md` (short section listing PR1–PR14, IN1–IN8, SA1–SA3, pointing to the design doc)

- [ ] **Step 1: Add the spec section** with one line per requirement ID, copying the wording from the design doc (sections 4 to 8).

- [ ] **Step 2: Run the full checks**

Run: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:rls`
Expected: all pass, no warnings introduced.

- [ ] **Step 3: Commit**

```bash
git add spec.md
git commit -m "docs: list Profile and Inbox requirement IDs in spec.md"
```

- [ ] **Step 4: Push the branch and open the PR into `develop`**, not merged, for the user to verify locally.

```bash
git push -u origin claude/parent-profile-inbox
gh pr create --base develop --head claude/parent-profile-inbox --title "Parent Profile and Inbox (PR, IN, SA)" --body "<summary, test plan, IDs>"
```
