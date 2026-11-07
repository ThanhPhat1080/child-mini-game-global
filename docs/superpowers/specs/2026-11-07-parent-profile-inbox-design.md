# Parent Profile and Inbox design

Date: 2026-11-07. Status: Draft, awaiting review. Repo: `child-mini-game-global`. Branch: `claude/parent-profile-inbox` (from `develop`).

Requirement IDs: `PR1..` (Profile), `IN1..` (Inbox), `SA1..` (Super Admin reads a parent's contact), `PT1..` (tests). Cite them in commits.

## 1. Goal

Parents have no profile yet. They can set their name, phone number and picture, and they can see their children in the same place. Parents also have an Inbox, a feedback mailbox for any problem to the Super Admin. The Super Admin answers as fast as possible, by email or by phone.

Success: a parent signs in, opens Profile, changes the name, adds a phone number and a picture, and sees their children below. A parent opens Inbox, reads that it is a feedback mailbox, sends a message, and sees it listed with its status. The Super Admin sees the parent's email and phone next to the message, so they can reply.

Existing rules still hold: RLS decides access, and the UI only mirrors it. Admin text is English, as on every admin screen. Calm, keyboard, focus ring and the optimistic UI rule (CLAUDE.md) are respected where they apply.

## 2. Decisions taken in brainstorming

| Topic | Decision |
|---|---|
| Inbox depth | Send a message and see its status (sent, read, resolved). No replies from the Super Admin in this change. |
| "Name" | Display name only. The sign-in email does not change. |
| Profile layout | One page with two parts: the parent's details on top, then the children (the same cards and dialogs as the old Children page). |
| Phone number | Added to the parent profile. Optional, but the Inbox asks for it. |
| Super Admin replies | By email or phone, as soon as possible. The Super Admin sees both in Messages. |
| Avatar | Square crop (A24), chosen through the library like a child's avatar. Counts toward the parent's quota. |

## 3. Non-goals

- Replies from the Super Admin, reply threads, and notifications (red dot) for replies.
- Changing the sign-in email or the password from Profile.
- Changing the Super Admin's Messages page beyond showing contact details.
- Changing `/admin/suspended` beyond sharing its message form (banned parents keep sending from there).
- Changing child avatars or the children's own settings.

## 4. Data model and security (migration `20261107100000_parent_profile_inbox.sql`)

- **PR1** `profiles.phone text null`: the parent's phone number as typed, trimmed. A check constraint allows null, or 8 to 20 characters made of digits, spaces, `+`, `(`, `)`, `.` and `-` (`^\+?[0-9 ().-]{8,20}$` after trim) and requires at least 8 digits.
- **PR2** `profiles.avatar_path text null`: the bucket path of the parent's picture, as `children.avatar_path` is.
- **PR3** `profiles.display_name` is the parent's name. A check `char_length(btrim(display_name)) between 1 and 40` is added `not valid`, so existing rows are not checked at once but every new write is.
- **PR4** Grant `update (display_name, phone, avatar_path)` on `public.profiles` to `authenticated`. No other column is granted, so `role`, `banned`, `quota_bytes` and `policy_version_accepted` cannot be changed by the parent.
- **PR5** Policy `profiles_update_own`: `using` and `with check` both require `user_id = auth.uid()` and `banned = false`. A banned parent cannot change their profile.
- **SA1** Function `public.super_admin_parent_contacts()` returns `(user_id, display_name, email, phone)` for every parent. It is `security definer` with `set search_path = ''`, raises `insufficient_privilege` unless `public.current_role() = 'super_admin'`, and reads the email from `auth.users`. Execute is granted to `authenticated` only (revoked from `public` and `anon`). Email is never stored in `profiles`.
- **IN1** Support messages keep the existing table, trigger (5 per day) and policies. The parent already reads their own rows (`from_user = auth.uid()`) and inserts (`body` only).

Avatar uploads go through the existing media upload, so storage is counted by owner through the existing `storage_used` function (no new quota rule).

## 5. Profile page `/admin/profile` (parent only)

Route: `app/admin/(panel)/profile/page.tsx`. The old `/admin/children` route redirects here for parents. `app/admin/page.tsx` and `app/admin/(panel)/settings/page.tsx` also redirect here.

**Top part: "About you"**

- **PR6** Name (text, required, 1 to 40 characters after trim). Error: "Enter your name (1 to 40 characters)."
- **PR7** Phone (optional, `tel` input). Hint: "The Super Admin uses this number to reach you about your messages." Error when filled and invalid: "Enter a phone number with 8 to 20 digits, for example +84 912 345 678."
- **PR8** Email (read only, shown from the signed-in account). Note: "This is your sign-in email. It does not change here."
- **PR9** Picture: a circle showing the current picture, or the initials of the name when there is none (`InitialsAvatar`, the N10 convention). Button "Choose images" opens the library with a square crop (A24). Picking a file from the library gives no crop (A25).
- **PR10** Save button, enabled only when something changed and the form is valid. One request writes name, phone and picture. Success shows a toast "Profile saved." On failure, the form keeps the values and shows "Could not save. Please try again." The save is not optimistic: it writes several fields, and it can fail validation, so the optimistic rule (CLAUDE.md) does not apply here.

**Bottom part: "Your children"**

- **PR11** The children section is the current Children page moved into `components/admin/ChildrenPanel.tsx`: the grid of `ChildCard`s, the add card, `ChildModal` for create and edit, and the remove dialog. The panel is not rewritten; only its wrapper moves.

## 6. Inbox page `/admin/inbox` (parent only)

Route: `app/admin/(panel)/inbox/page.tsx`. Sidebar item: "Inbox" with a mailbox icon.

- **IN2** Heading "Inbox", with a short highlight card above the form, in calm pastel colors: "This is your feedback mailbox. Tell the Super Admin about any problem or idea, big or small. The Super Admin replies as soon as possible, by email or by phone."
- **IN3** Contact line in the card: when the profile has a phone number, "Replies go to your email {email} and your phone {phone}." When it has none: "Add your phone number in Profile so the Super Admin can call you." with a link to `/admin/profile`.
- **IN4** Compose form: text area (max 2000 characters, required after trim), "Send message" button, and a line "You have sent N of 5 messages today." The form turns off at 5 and says so, as the existing form does. Errors: "You can send 5 messages a day. Please try again tomorrow." for the rate limit, and "Could not send the message. Please try again." for anything else.
- **IN5** Form component `components/admin/ContactForm.tsx`, shared with `/admin/suspended`. Its behaviour there does not change.
- **IN6** List "Your messages", newest first. Each item shows the text, the time sent (local time), and one status: "Sent" (no `read_at`), "Read" (`read_at`), "Resolved" (`resolved_at`, which also counts as read). No list items show a reply.
- **IN7** Empty state: "No messages yet. Write to the Super Admin above whenever you need help."
- **IN8** The list and the count come from the parent's own rows, so RLS does the filtering.

## 7. Super Admin reads the contact (Messages page)

- **SA2** `/admin/messages` shows, beside each message, the sender's name, email and phone, from `super_admin_parent_contacts()`. The phone is a `tel:` link and the email a `mailto:` link, so the Super Admin can reply in one click. When the parent has no phone, the line says "No phone number".
- **SA3** The contact list is read once when the page loads, and only by a Super Admin. If it fails, the messages still show, with "Contact details are not available right now."

## 8. Navigation

- **PR12** Parent sidebar: "Profile" (person icon) replaces "Children". "Inbox" (mailbox icon) follows it. The rest of the parent menu stays as it is.
- **PR13** Super Admin sidebar is unchanged.
- **PR14** The collapsed rail keeps the tooltip and accessible name rules of `AdminNav` (`aria-label` and tooltip on each link).

## 9. Errors and edge cases

- A banned parent gets `/admin/suspended` as today. Their profile cannot be changed (PR5), and their message form is the same shared `ContactForm`.
- If a parent changes their name, the Super Admin sees the new name on the next load. No cache is kept.
- Uploads that fail or are over 2 MB show the existing messages from the library dialog.
- A parent whose name is empty (a legacy account) sees the form with an empty name and must enter one before Save is enabled. The profile row exists for every parent, so the update always has a row to change.

## 10. Testing

- **PT1 Unit**: phone and name validation (`lib/profile.ts`), the status label of a message, the parent and Super Admin menu lists, the highlight card and contact line for both phone states, the message counter at 0, 4 and 5, and the redirects.
- **PT2 Database (`npm run test:rls`)**: a parent updates their own name, phone and picture; a parent cannot change `role`, `banned` or `quota_bytes`, cannot update another profile, and a banned parent cannot update their own; the phone check rejects letters and short numbers; `super_admin_parent_contacts()` returns rows for a Super Admin, raises for a parent and for `anon`.
- **PT3 E2E** (new `e2e/parent-profile.spec.ts`, plus `e2e/admin-parent-inbox.spec.ts`): a parent saves name and phone and sees the children below; `/admin/children` redirects to Profile; the Inbox shows the highlight and sends a message that appears as "Sent"; the Super Admin's Messages page shows the email and phone links. The stand-in Supabase in `e2e/support/` needs profile update support, the new function, and email in the stand-in state. That work is part of the plan.

## 11. Rollout

- One PR into `develop` after review. The migration is additive: new columns, a grant, a policy, a function, and one `not valid` check. No existing row changes.
- Deploy and Supabase dashboard steps are not part of this change. The owner decides when to run the migration in production.

## 12. Open points for review

- Phone format: the check accepts any 8 to 20 digits with common separators, and does not check country codes. Fine for now?
- The Super Admin's own profile has no phone field in this change. Is that needed?
