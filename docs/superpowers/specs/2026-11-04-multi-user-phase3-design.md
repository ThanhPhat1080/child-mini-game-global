# Phase 3: Multi-user (Super Admin, Parent, Child) design

Date: 2026-11-04. Status: draft for owner review. Repo: `child-mini-game-global` (own codebase, own Vercel project, own Supabase project; never point it at the original `child-mini-game` backend).

Requirement IDs for this phase: `U1..` (users and auth), `V1..` (visibility and review), `Q1..` (media and quota), `N1..` (UI), `T1..` (tests). Cite them in commits.

## 1. Goal

Turn HaMy from "one deployment per child" into a product many families use. Parents sign up themselves, create 1 to 5 child accounts, author their own game content for those children, and may offer content to everyone through a Super Admin review. Children sign in once on a device and play read-only.

Success means: two unrelated parents can each run their own children and content on one deployment with no data leaking between them; Super Admin can moderate; a banned parent loses admin access and their content disappears, while their children can still play global content.

Supersedes the Phase 1 rules "Child pages are read-only and unauthenticated" and "One deployment per child, configured by env vars only" (CLAUDE.md must be updated when this ships). Games, the registry (ADR-014), Calm & Slow design and the "child cannot read" rule are unchanged.

## 2. Roles

| Role | Can do |
|---|---|
| Super Admin | See, edit, unpublish and delete everyone's content; review the pending queue; ban and unban parents; create parents, children and other Super Admins; change a parent's storage quota. |
| Parent | Self sign-up; create 1 to 5 children (max 5, enforced in DB); edit each child's avatar, name and welcome/feedback sounds; create and edit own content while it is `private`; offer content for global review; read the Global tab (read-only). |
| Child | Sign in (email + password set by the parent), play own parent's content plus global content, read-only. Opening `/admin` shows a "no permission" screen. |

Parents never see other parents' non-global content. Children see only their parent's content and global content.

## 3. Data model (U1..U6)

One Supabase project, RLS by owner. All schema changes are new files in `supabase/migrations/`.

- **U1 `profiles`** replaces `admins`: `user_id` (PK, FK `auth.users`), `role` (`super_admin | parent | child`), `parent_id` (set only for children, FK `profiles.user_id`), `display_name`, `banned boolean default false`, `ban_reason_code` and `ban_note` (set when banned, see U15), `banned_at`, `policy_version_accepted` and `policy_accepted_at` (set at sign-up, see U16), `quota_bytes bigint default 52428800` (50 MB), `created_at`. A trigger enforces: a child has a parent; a parent has at most 5 children; roles other than child have no `parent_id`.
- **U2 helper functions** (`security definer`, stable): `current_role()`, `owner_scope()` (parent: self; child: `parent_id`; super admin: null), `is_banned(uuid)`. The old `is_admin()` is removed and every policy that used it (20 references in 6 migrations) is rewritten in one new migration.
- **U3 ownership**: `quiz_sets`, `memory_cards`, `spot_levels`, `card_groups`, `find_levels` gain `owner_id uuid not null` (FK `profiles`). Existing seed rows are assigned to the first Super Admin. `questions` and `answers` inherit access through their parent set.
- **U4 `child_settings`** replaces the singleton `settings` (`id = 1`): one row per child (`child_id` PK, `child_name`, `avatar_path`, `hooray_path`, `ohoh_path`, `complete_path`, music volume, feedback sounds, and the other current columns). The roughly eight pages that read `settings id=1` read the signed-in child's row instead. A parent edits only their own children's rows.
- **U5 bans**: `profiles.banned` is the only switch. RLS treats content owned by a banned user as invisible; no content rows are rewritten. Unbanning restores the exact previous state.
- **U6 first Super Admin**: created once by a documented SQL step (insert into `profiles` for a user created in the Supabase dashboard). Later Super Admins are created in the app.

## 4. Visibility and review (V1..V7)

Content tables get `visibility`: `private | pending | global`. The existing `published` flag keeps its meaning (draft vs ready to play); the two are independent.

- **V1** `private`: visible to the owner and the owner's children; owner can edit.
- **V2** Parent ticks "Share with all children": row becomes `pending`; the parent sees an "Under review" notice; the parent cannot edit while `pending`.
- **V3** Super Admin queue lists `pending` items and can open the full set including its images and sounds. **Approve** makes it `global` (read-only for the owner, visible to every parent and child). **Reject** returns it to `private` with a short reason the parent can read.
- **V4** Changing a `global` item: the parent sends an edit request; Super Admin unpublishes it (back to `private`); the parent edits; the parent shares again and it goes through review again. The live global version is never edited in place.
- **V5** Super Admin may unpublish (`global` to `private`) or delete any item at any time.
- **V6** Banned owner: all their content (private and global) is hidden from everyone except Super Admin. Their children keep signing in and see only other owners' global content plus their own settings. The ban reason is recorded (U15). Unbanning clears the reason and restores everything.
- **V7** Edit requests and rejection reasons are stored in a small `review_events` table (`id`, `item_table`, `item_id`, `kind`, `note`, `created_by`, `created_at`) so both sides see history.

Access rule summary per content row (read): Super Admin always; otherwise the owner is not banned and (`visibility = global` or the reader's `owner_scope()` equals `owner_id`). Write: Super Admin always; a parent only when `owner_id = auth.uid()` and `visibility = private`. Children never write.

## 5. Auth and accounts (U7..U14)

- **U7** Parent self sign-up with email and password and email confirmation, then a short first-run flow to create the first child (a parent needs at least 1 child before the child app is usable, at most 5).
- **U8** Child accounts are created server-side: a Next.js route handler checks the caller is a parent (or Super Admin), then uses the Supabase service-role key to create the auth user (`email_confirm: true`) and the `profiles` and `child_settings` rows in one step. The service-role key lives only in a server-only Vercel env var (no `NEXT_PUBLIC_`).
- **U9** Child signs in with the email and password the parent chose, typed by the parent on the child's device. The session is persistent (Supabase SSR cookie) so the child is not asked again.
- **U10** Logout button in a corner of the child UI. It opens a small adult check (a simple addition question, answered with the keyboard or mouse) and signs out only on a correct answer. A child who cannot read cannot pass it.
- **U11** `middleware.ts` reads the role from `profiles` instead of `is_admin()`. `/admin` is allowed for `super_admin` and non-banned `parent`. A child gets an explicit "You don't have permission" page; a banned parent gets "Account suspended". Unauthenticated users go to sign-in.
- **U12** Child pages now require a signed-in child (or a parent/Super Admin previewing). Unauthenticated visitors reach a child sign-in page.
- **U13** A banned parent: `/admin` blocked, children unaffected (see V6). A banned child is not a case; only parents are banned. The ban takes effect immediately (the check runs on every request, not on token refresh).
- **U15 Ban reason.** Banning requires a reason code from the content-policy list (section 5.1) and an optional free-text note from the Super Admin. A banned parent who opens any `/admin` page sees a "Your account is suspended" screen that shows the reason (code label and note), the date, and a **Contact the Super Admin** text box with a send button. They can sign out but cannot edit or create anything.
- **U16 Content policy at sign-up.** The parent sign-up page has email and password only for now. Pressing **Create account** does not submit yet: it opens a modal carousel (section 5.2) that the parent must page through to the last slide. Only then does the **Register** button become enabled. Submitting stores `policy_version_accepted` and `policy_accepted_at` on the profile, so a later policy change can re-prompt existing parents (not built in this phase).
- **U17 Contact Super Admin.** Table `support_messages` (`id`, `from_user`, `body` (max 2000 chars), `created_at`, `read_at`, `resolved_at`). A banned parent may insert rows for themselves (and read their own); the Super Admin reads all, marks them read/resolved. Rate limit in the UI and a DB check: at most 5 messages per user per day.

### 5.1 Content-policy reasons (ban reason codes)

The app is for teaching English to young children (4-5). A ban reason is one of:

1. `inaccurate` - questions, answers or translations that are wrong or misleading (e.g. wrong spelling, wrong correct answer).
2. `sexual` - sexual or otherwise adult content, including suggestive images.
3. `violent_scary` - violence, gore, weapons or horror/scary imagery or sounds.
4. `political` - political, propaganda or distorted/misleading historical or social content, and content against the spirit of the app.
5. `hate` - hateful, discriminatory or bullying content.
6. `off_target` - content that is not about learning English for young children (ads, spam, links, unrelated material).
7. `personal_or_copyright` - photos of identifiable people without consent, personal data of others, or material the parent has no right to use.
8. `other` - anything else; the note must explain it.

Banning one parent hides all their content immediately (V6). The labels are stored in one shared constants file so the ban dialog, the suspended screen and the carousel use the same wording.

### 5.2 Sign-up content-policy carousel

- A modal with 5 to 6 slides, each with one simple illustration (inline SVG shipped in the repo) and a short, plain-language message in Vietnamese with an English line below it. No slide has more than two short sentences.
- Slide plan: (1) Welcome: this app helps young children learn English. (2) Keep content correct: check spelling and answers. (3) No sexual or adult content. (4) No violence, gore or scary images or sounds. (5) No political or misleading content that goes against the app's spirit. (6) What happens if you break the rules: content is hidden, the account can be banned, and you can contact the Super Admin.
- Navigation: Next and Back buttons and dots; keyboard arrows. The **Register** button is disabled until the last slide has been shown, and the user cannot skip ahead by clicking the dots past the furthest slide viewed. Closing the modal cancels the sign-up without creating the account.
- The slide copy lives in one file with a `POLICY_VERSION` constant (U16).
- **U14** Operational requirements: custom SMTP for confirmation emails (the Supabase default sender is heavily rate limited), Auth redirect URLs for the new Vercel domain, password reset for parents.

## 6. Media and quota (Q1..Q6)

- **Q1** Files are stored at `media/<owner_id>/...`.
- **Q2** Any signed-in user can read any file (policy `media_read_authenticated` already does this). Only the content rows are access-controlled; file paths are unguessable ids. This avoids copying files when content goes global.
- **Q3** Writes are limited to the uploader's own folder.
- **Q4** Per-parent quota: total bytes under the owner's folder must stay within `profiles.quota_bytes` (default 50 MB), checked by a trigger on `storage.objects` insert. Super Admin can change a parent's quota.
- **Q5** Per-file limit of 2 MB for both images and sounds, enforced in the UI only. Images already use `MAX_IMAGE_BYTES` (2 MB); `MAX_SOUND_BYTES` changes from 10 MB to 2 MB, with its messages and help texts updated.
- **Q6** Deleting a file is refused while any content row in any table references it. The existing client check (`isMediaInUse`) only sees rows visible to the caller, so a `security definer` function scans all content tables and the delete policy relies on it.
- **Q7** Media moderation happens in the review queue (V3): the reviewer sees all attached images and sounds.

## 7. UI (N1..N8)

- **N1** One `/admin/sign-in` for parents and Super Admins; role-based landing. Add parent sign-up and email-confirmation pages. A separate child sign-in page.
- **N2** Parent dashboard: list of children (max 5) with add, edit email/password, avatar, name, sounds.
- **N3** Parent content area has two tabs: "Mine" (editable) and "Global" (read-only, lock badge).
- **N4** Editor shows a status badge (`Private`, `Under review`, `Global`), the "Share with all children" toggle, and a storage meter ("12 / 50 MB").
- **N5** Super Admin: pending queue (approve / reject with reason), parent list (ban, unban, quota), child list, all-content browser with unpublish and delete, creation of parents, children and Super Admins.
- **N6** Child app: same games and Calm & Slow look, plus the logout button with adult check and a content switch between "My family" and "Global". Nothing editable.
- **N7** Child-facing text stays admin-written (rule unchanged); new adult-facing screens use Nunito and may contain text.
- **N8** Existing "Preview as child" keeps working for parents, scoped to the chosen child.
- **N9** Ban dialog (Super Admin): reason select (section 5.1), optional note, confirm. Messages inbox for `support_messages` with read/resolved state. Banned-parent screen and sign-up carousel as in U15 and U16.

## 8. Testing (T1..T4)

- **T1 RLS matrix**: a database-level test suite signs in as Super Admin, parent A, parent B, child of A and a banned parent, and checks select, insert, update and delete on every content table, `child_settings`, `profiles`, `review_events` and storage. Key cases: B cannot read A's `private`; a parent cannot edit `pending` or `global`; a child cannot write; the 6th child is rejected; banned content is hidden and returns on unban.
- **T2 Lifecycle**: private to pending to global to unpublished, rejection with reason, edit-request loop.
- **T3 Media**: quota exceeded is rejected by the DB; delete of an in-use file is refused for every owner.
- **T5 Ban and policy**: banning requires a reason code; the suspended screen shows reason and note; a banned parent can send a message (and no more than 5 a day) but cannot write content; sign-up stores the accepted policy version; the Register button stays disabled until the last carousel slide is reached and dots cannot skip ahead.
- **T4 E2E (Playwright)**: parent signs up through the carousel and creates a child; child signs in and the session survives reload; logout needs the adult check; child opening `/admin` sees "no permission"; ban keeps the child playing; sharing and approval end to end. The existing stand-in Supabase in `e2e/support/` must be extended or replaced to cover roles and RLS, or the RLS suite must run against a real local Supabase (decision for the plan).

## 9. Deployment and bootstrap

New Supabase project (apply all migrations in order through the migration tool, never by pasting SQL), new Vercel project linked to this repo, env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and server-only `SUPABASE_SERVICE_ROLE_KEY`, custom SMTP, first Super Admin per U6. Ids are recorded in `docs/git-workflow.md` once created.

## 10. Decisions and open risks

- Chosen: one project with `profiles` and RLS (not role-in-JWT; can be adopted later for speed, at the cost of non-instant ban).
- Existing prototype data is kept as Super Admin-owned content. Whether any of it is made `global` at launch is a launch decision.
- Children's personal data (names, emails, avatars) and minors' privacy rules (e.g. COPPA/GDPR-K) are not analysed here. They need an owner decision before a public launch: privacy policy, parental consent wording at sign-up, account and data deletion.
- Open signup invites spam and abuse. Rate limiting, CAPTCHA or email-domain checks are deferred; the ban tool is the only control in this phase.
- Not in scope: payments, parent-to-parent sharing of private content, per-child content assignment (every child of a parent sees all of that parent's content), analytics, mobile/TV (ADR-028 stays).
