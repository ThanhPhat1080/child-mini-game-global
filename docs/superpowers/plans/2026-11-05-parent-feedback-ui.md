# Parent Feedback UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Act on the parent's 10 feedback items: admin modal fixes, a clearly different play sign-in, a themed child picker and PIN popup, a Leave game popup, and a game list without the filter.

**Architecture:** Small shared pieces (`ModalClose`, `SkyScene`, `useActiveChild`, `lib/familyContent.ts`, extended `GENDER_THEME`) plugged into the existing pages. No dialog rewrite, no database change. Four groups of tasks, each on its own stacked branch.

**Tech Stack:** Next.js 16, React, TypeScript, CSS modules, Supabase JS client, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-05-parent-feedback-ui-design.md`. Requirement IDs (`FA`, `FS`, `FP`, `FG`, `FT`) come from it.

## How to work (read this first)

- Do the tasks in order. Do not skip a failing-test step.
- Run one test file with `npx vitest run tests/<file>`. Run one E2E file with `npm run e2e -- e2e/<file>`.
- Do not change anything a task does not name, and do not refactor nearby code. Never add a dependency or a migration.
- Line numbers were correct when this plan was written. If a line moved, search for the quoted text.
- If a task's test still fails after three honest attempts, or a named file or text does not exist, **stop and report** what you saw. Do not delete or weaken a test to make it pass. Do not guess at design.
- Only change an existing test when the plan says so, or when it asserts the old behavior that the task replaces. Say which one you changed in the commit message.
- Commit at the end of each task, citing the IDs. Do not push and do not open a PR unless the owner asks. Never push to `main` or `develop`.
- `graphify-out/` is git-ignored: run `graphify update .` at the end of each group, and do not commit it.

## Global Constraints

- Stage screens (`/`, `/play`, `/games*`) are a fixed 1920x1080 canvas (`components/Stage.tsx`); sizes there are in canvas pixels. `/play/sign-in` and admin pages are normal responsive pages.
- Calm & Slow: pastel colors, slow motion, no timers. Every animation stops under `@media (prefers-reduced-motion: reduce)`.
- Every button keeps a visible `:focus-visible` ring.
- Fixed child-screen text is allowed only for: "Who are you?", "Enter your PIN, <name>!", "Leave game?", "Stay", "Leave". Wrong-PIN feedback stays without text.
- Fonts: Baloo 2 on child screens (inherited from `Stage`), Nunito in admin.
- No inline `<canvas>` for decoration: SVG and CSS only (ADR-030). Use `Pic` from `@/components/Pic` for pictures.
- Never put a service role key in the frontend. Do not change RLS or `supabase/migrations`.

## Review Focus

1. Settings fail to load on `/`: the enter button must still appear so the child is not stuck. Test in Task 7.
2. A literal `*` typed, or a caret in front of the mask, in a PIN box: the stored PIN must not be corrupted or cleared. Test in Task 9.
3. `/sign-up?from=PLAY` or `?from=https://evil.test`: treated as no value, goes to `/admin/sign-in`. Test in Task 5.
4. Leave as one child, then pick another child with a different music track: the old track is gone and the new one loads, and the saved on/off choice is unchanged. Test in Task 10.
5. No session when content loads (`getMyUserId` returns null): the query asks for global rows only and does not crash. Test in Task 13.

---

## Task 0: Prepare the branch

**Files:** `docs/superpowers/specs/2026-11-05-parent-feedback-ui-design.md`, this plan, `public/images/prince.webp`

- [ ] **Step 1: Check the starting point**

Run: `git fetch origin; git status --short; git log --oneline -1 claude/children-table; ls public/images/prince.webp docs/superpowers/plans/2026-11-05-parent-feedback-ui.md`
Expected: both files exist. If they are missing (a fresh worktree does not copy untracked files), stop and ask the owner to commit them or run in the original folder.

- [ ] **Step 2: Create the first branch from the children table branch**

```bash
git checkout -b claude/feedback-1-admin-ui claude/children-table
```

If git refuses because of local changes, stop and report. Do not stash or discard anything.

- [ ] **Step 3: Commit the documents and the image if they are still uncommitted**

Do not add `public/images/prince.jpg`.

```bash
git add docs/superpowers/specs/2026-11-05-parent-feedback-ui-design.md docs/superpowers/plans/2026-11-05-parent-feedback-ui.md public/images/prince.webp
git commit -m "docs: parent feedback UI spec and plan, prince art"
```

- [ ] **Step 4: Get a green baseline**

Run: `npm test`
Expected: all pass. If something already fails, report it before changing code.

---

# Group 1: Admin UI and modals (FA1..FA5). Branch `claude/feedback-1-admin-ui`

## Task 1: `ModalClose` (FA4)

**Files:**
- Create: `components/ModalClose.tsx`, `components/ModalClose.module.css`
- Test: `tests/ModalClose.test.tsx`

**Interfaces:**
- Produces: `export function ModalClose(props: { onClick(): void; disabled?: boolean; size?: 'admin' | 'child' }): JSX.Element` (default `size` is `'admin'`). Renders `<button type="button" aria-label="Close" data-size={size}>`. It is absolutely positioned, so its parent dialog must have `position: relative`.

- [ ] **Step 1: Write the failing test**

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModalClose } from '@/components/ModalClose';

afterEach(cleanup);

describe('ModalClose (FA4)', () => {
  it('is a button named Close that calls onClick', () => {
    const onClick = vi.fn();
    render(<ModalClose onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it('does nothing while disabled', () => {
    const onClick = vi.fn();
    render(<ModalClose onClick={onClick} disabled />);
    const b = screen.getByRole('button', { name: 'Close' }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    fireEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });
  it('defaults to the admin size and accepts the child size', () => {
    const { rerender } = render(<ModalClose onClick={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Close' }).getAttribute('data-size')).toBe('admin');
    rerender(<ModalClose onClick={() => undefined} size="child" />);
    expect(screen.getByRole('button', { name: 'Close' }).getAttribute('data-size')).toBe('child');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/ModalClose.test.tsx`
Expected: FAIL, cannot resolve `@/components/ModalClose`.

- [ ] **Step 3: Implement the component**

Icon: `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>`, sized by CSS.

CSS:

```css
.btn { position: absolute; z-index: 2; display: flex; align-items: center; justify-content: center; padding: 0; background: #fff; color: #4a3830; cursor: pointer; }
.btn:disabled { opacity: 0.5; cursor: default; }
.admin { top: 14px; right: 14px; width: 36px; height: 36px; border-radius: 10px; border: 1.5px solid #e3d5c4; }
.admin svg { width: 18px; height: 18px; }
.admin:hover:not(:disabled) { background: #f6eadc; }
.admin:focus-visible { outline: 3px solid #c77d85; outline-offset: 2px; }
.child { top: 20px; right: 20px; width: 88px; height: 88px; border-radius: 44px; border: none; box-shadow: 0 6px 0 #eadcc8; color: #7a5c50; }
.child svg { width: 44px; height: 44px; }
.child:focus-visible { outline: 6px solid #7a5c50; outline-offset: 4px; }
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run tests/ModalClose.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ModalClose.tsx components/ModalClose.module.css tests/ModalClose.test.tsx
git commit -m "feat: shared modal close button (FA4)"
```

## Task 2: Add `ModalClose` to every dialog and equalize footer buttons (FA1, FA5)

**Files:**
- Modify: `app/admin/admin.module.css`, `components/auth/auth.module.css`, `components/auth/AdultCheck.tsx`, `components/auth/PolicyCarousel.tsx`, `components/admin/ConfirmDialog.tsx`, `components/admin/BanDialog.tsx`, `components/admin/ImportDialog.tsx`, `components/admin/CardImportDialog.tsx`, `components/admin/CropDialog.tsx`, `components/admin/MediaLibraryDialog.tsx`, `components/admin/ChildModal.tsx`, `components/admin/admin-ui.module.css`
- Test: `tests/ModalCloseDialogs.test.tsx`, `tests/MediaLibraryDialog.test.tsx`, `tests/ChildModal.test.tsx`

**Interfaces:**
- Consumes: `ModalClose` from Task 1.
- Produces: CSS class `.modalBtn` in `app/admin/admin.module.css`.

- [ ] **Step 1: Write the failing test `tests/ModalCloseDialogs.test.tsx`**

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { BanDialog } from '@/components/admin/BanDialog';
import { ImportDialog } from '@/components/admin/ImportDialog';
import { CardImportDialog } from '@/components/admin/CardImportDialog';
import AdultCheck from '@/components/auth/AdultCheck';

afterEach(cleanup);
const close = () => screen.getByRole('button', { name: 'Close' }) as HTMLButtonElement;

describe('dialogs have a top-right Close (FA5)', () => {
  it.each([
    ['ConfirmDialog', (c: () => void) => <ConfirmDialog title="t" body="b" button="Delete" onCancel={c} onConfirm={vi.fn()} />],
    ['BanDialog', (c: () => void) => <BanDialog name="n" onCancel={c} onConfirm={vi.fn()} />],
    ['ImportDialog', (c: () => void) => <ImportDialog onCancel={c} onImport={vi.fn()} />],
    ['CardImportDialog', (c: () => void) => <CardImportDialog onCancel={c} onImport={vi.fn()} />],
    ['AdultCheck', (c: () => void) => <AdultCheck open onPass={vi.fn()} onCancel={c} />],
  ])('%s: Close does what Cancel does', (_name, make) => {
    const onCancel = vi.fn();
    render(make(onCancel));
    fireEvent.click(close());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Close is disabled while a dialog is busy', () => {
    render(<ConfirmDialog title="t" body="b" button="Delete" busy onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(close().disabled).toBe(true);
  });
});
```

Add one test to `tests/MediaLibraryDialog.test.tsx`, using that file's own render helper in dialog mode: clicking the `Close` button calls the same `onClose` as Cancel. Assert that the Cancel and OK buttons both have `style.height === '44px'`.

Add one test to `tests/ChildModal.test.tsx`, using that file's own setup: clicking `Close` calls `onClose`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/ModalCloseDialogs.test.tsx tests/MediaLibraryDialog.test.tsx tests/ChildModal.test.tsx`
Expected: the new tests FAIL, no button named Close.

- [ ] **Step 3: Add `ModalClose` as the first child of each dialog box**

Add `position: 'relative'` (or `position: relative` in its CSS class) to each dialog box, not to the backdrop. Keep Cancel and all `autoFocus` attributes.

| File | Dialog box element | `onClick` | Extra |
|---|---|---|---|
| `ConfirmDialog.tsx` | `role="alertdialog"` div | `onCancel` | `disabled={busy}` |
| `BanDialog.tsx` | `role="dialog"` div | `onCancel` | `disabled={busy}` |
| `ImportDialog.tsx` | `role="dialog"` div | `onCancel` | |
| `CardImportDialog.tsx` | `role="dialog"` div | `onCancel` | |
| `MediaLibraryDialog.tsx` | `role="dialog"` div at line 455, dialog branch only | `onClose` | Header padding at line 405 becomes `dialog ? '24px 64px 16px 28px' : '20px 24px 12px'` so Sort by clears the X |
| `AdultCheck.tsx` | `.dialog` div | `onCancel` | Add `position: relative` to `.dialog` in `auth.module.css` |
| `ChildModal.tsx` | `role="dialog"` div | `requestClose` | `disabled={busy}`; add `position: relative` to `.modal` in `admin-ui.module.css` |
| `CropDialog.tsx` | `role="dialog"` div | `onCancel` | Delete the old `×` button at line 110 |
| `PolicyCarousel.tsx` | `.dialog` div | `onClose` | Replace `<button className={admin.ghost} onClick={onClose}>Close</button>` at line 106 with `<ModalClose onClick={onClose} />` in the same place |

- [ ] **Step 4: Equalize footer buttons (FA1)**

Add to `app/admin/admin.module.css`, after the `.ghost:disabled` rule:

```css
.modalBtn { height: 44px; padding: 0 20px; border-radius: 12px; font-size: 15px; }
```

Then:
- `AdultCheck.tsx`: `className={`${admin.ghost} ${admin.modalBtn}`}` on Cancel and `className={`${admin.primary} ${admin.modalBtn}`}` on OK.
- `PolicyCarousel.tsx`: add `admin.modalBtn` to every button in the `.nav` row.
- `MediaLibraryDialog.tsx` lines 36 and 38: `primaryBtn` becomes `height: 44, padding: '0 20px'`, `cancelBtn` becomes `height: 44, padding: '0 20px'`.
- `BanDialog.tsx`: give Cancel the same inline style as Cancel in `ConfirmDialog.tsx`.
- `admin-ui.module.css`: `.modalPrimary` padding becomes `0 20px`.
- `CropDialog.tsx`, `ImportDialog.tsx`, `CardImportDialog.tsx`: read each footer. Set any footer button that is not already 44px high with 20px padding to those values, using inline style as in `ConfirmDialog.tsx`.

- [ ] **Step 5: Run the affected tests**

Run: `npx vitest run tests/ModalCloseDialogs.test.tsx tests/MediaLibraryDialog.test.tsx tests/ChildModal.test.tsx tests/PolicyCarousel.test.tsx tests/AdultCheck.test.tsx`
Expected: PASS. `PolicyCarousel` keeps passing because the button is still named Close and stays first in tab order.

- [ ] **Step 6: Run everything**

Run: `npm test`
Expected: PASS. If a test finds two buttons named Close, scope that test with `within(dialog)`. Do not rename the button.

- [ ] **Step 7: Commit**

```bash
git add -A components app/admin/admin.module.css tests
git commit -m "feat: top-right close on every modal, equal footer buttons (FA1,FA5)"
```

## Task 3: Lighter child form, Gender beside Age (FA2, FA3)

**Files:**
- Modify: `lib/childTheme.ts`, `components/admin/ChildModal.tsx:166-168,175-184,235-243`, `components/admin/admin-ui.module.css`
- Test: `tests/childTheme.test.ts`, `tests/ChildModal.test.tsx`

**Interfaces:**
- Produces: `GENDER_THEME[g].modalBg: string`.

- [ ] **Step 1: Update and extend the tests**

In `tests/childTheme.test.ts`, add `modalBg: '#EEF4F9'` to the male `toEqual` and `modalBg: '#FCEFF0'` to the female one, then add:

```ts
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

it('modal text meets WCAG AA on modalBg (FA2)', () => {
  expect(contrast(GENDER_THEME.male.text, GENDER_THEME.male.modalBg)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(GENDER_THEME.female.text, GENDER_THEME.female.modalBg)).toBeGreaterThanOrEqual(4.5);
});
```

In `tests/ChildModal.test.tsx`, add, using the file's own setup:

```tsx
it('Gender and Age share one row (FA3)', async () => {
  // render the modal with the file's setup helper first
  const gender = screen.getByRole('group', { name: 'Gender' });
  const age = screen.getByRole('group', { name: 'Age band' });
  expect(gender.parentElement).toBe(age.parentElement);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/childTheme.test.ts tests/ChildModal.test.tsx`
Expected: FAIL on `modalBg` and on the shared parent.

- [ ] **Step 3: Implement**

- Add `modalBg` to the type and both entries in `lib/childTheme.ts`.
- In `ChildModal.tsx`, change the dialog's `style` to `background: theme.modalBg`.
- Move the Age field block up. Wrap Gender and Age in `<div className={s.genderAgeRow}>`, Gender first. Add `<span className={s.modalLabel}>Gender</span>` as the first child of the Gender group so both columns have a label.
- Add to `admin-ui.module.css`: `.genderAgeRow { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 14px 24px; }`

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run tests/childTheme.test.ts tests/ChildModal.test.tsx tests/ChildCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Finish the group**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all pass. Then run `graphify update .`

- [ ] **Step 6: Commit**

```bash
git add lib/childTheme.ts components/admin/ChildModal.tsx components/admin/admin-ui.module.css tests/childTheme.test.ts tests/ChildModal.test.tsx
git commit -m "feat: lighter child form colors, gender beside age (FA2,FA3)"
```

---

# Group 2: Sign-in and sign-up (FS1..FS7). Branch `claude/feedback-2-sign-in`

Start with: `git checkout -b claude/feedback-2-sign-in`

## Task 4: The play sign-in page (FS1..FS4)

**Files:**
- Create: `components/play/SkyScene.tsx`, `components/play/SkyScene.module.css`, `app/play/sign-in/playSignIn.module.css`
- Modify: `app/play/sign-in/page.tsx`
- Test: `tests/PlaySignIn.test.tsx`

**Interfaces:**
- Produces: `export function SkyScene(props: { festive?: boolean }): JSX.Element`, an `aria-hidden` SVG that fills its positioned parent. Task 8 uses `festive`.

- [ ] **Step 1: Add failing tests to `tests/PlaySignIn.test.tsx`**

Add this mock beside the others, copied from `tests/SignUpPage.test.tsx`:

```tsx
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
```

```tsx
describe('play area sign-in (FS1-FS4)', () => {
  it('says this is the play area and to play along', () => {
    render(<PlaySignIn />);
    expect(screen.getByRole('heading', { name: 'Grown-ups, sign in' })).toBeTruthy();
    expect(screen.getByText('Sign in and play along with your child.')).toBeTruthy();
    expect(screen.getByText('Play area')).toBeTruthy();
  });
  it('links to sign-up from the play area', () => {
    render(<PlaySignIn />);
    expect(screen.getByRole('link', { name: 'Sign up now' }).getAttribute('href')).toBe('/sign-up?from=play');
  });
  it('the ? button toggles the help panel', () => {
    render(<PlaySignIn />);
    const help = screen.getByRole('button', { name: 'How do I create an account?' });
    expect(help.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(/Open the link we email you/)).toBeNull();
    fireEvent.click(help);
    expect(help.getAttribute('aria-expanded')).toBe('true');
    expect(help.getAttribute('aria-controls')).toBe(screen.getByText(/Open the link we email you/).closest('[id]')?.id);
    fireEvent.click(help);
    expect(screen.queryByText(/Open the link we email you/)).toBeNull();
  });
  it('links to Parent Admin', () => {
    render(<PlaySignIn />);
    expect(screen.getByRole('link', { name: 'Go to Parent Admin' }).getAttribute('href')).toBe('/admin/sign-in');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/PlaySignIn.test.tsx`
Expected: the new tests FAIL. The old ones pass.

- [ ] **Step 3: Implement `SkyScene`**

An SVG with `aria-hidden="true"`, `viewBox="0 0 1920 1080"`, `preserveAspectRatio="xMidYMid slice"`, `style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}`. Copy the sun circles, the two drifting cloud groups, both hill paths and the four small circles from `app/page.tsx:36-52`. Do not change `app/page.tsx`.

When `festive` is true, also draw:
- Three balloons in a `.bob` group. Each is an ellipse `rx=56 ry=70` with a thin curved string. Positions and colors: `(170,300) #E59AA1`, `(1750,260) #8FB3D1`, `(1610,420) #F6E2A6`.
- Five stars in `.twinkle` groups, using this path translated to `(420,120)`, `(760,90)`, `(1180,130)`, `(1420,80)`, `(300,520)`: `M0 -22 L5 -5 L22 0 L5 5 L0 22 L-5 5 L-22 0 L-5 -5 Z`, fill `#F6E2A6`.

`SkyScene.module.css`:

```css
.drift { animation: drift 18s ease-in-out infinite alternate; }
.bob { animation: bob 7s ease-in-out infinite; }
.twinkle { animation: twinkle 3.4s ease-in-out infinite; }
@keyframes drift { from { transform: translateX(0); } to { transform: translateX(60px); } }
@keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-16px); } }
@keyframes twinkle { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .drift, .bob, .twinkle { animation: none; } }
```

- [ ] **Step 4: Rewrite the JSX of `app/play/sign-in/page.tsx`**

Keep all the state and `onSubmit`. Keep importing `styles` from `admin.module.css` for `.card`, `.fieldGroup`, `.input`, `.error`, `.primary`, `.sub`, `.brand`, `.foot`. Add `import play from './playSignIn.module.css'`, `next/link`, `Pic`, `SkyScene`, and `const [help, setHelp] = useState(false)`.

Structure, top to bottom:

```tsx
<div className={play.wrap}>
  <SkyScene />
  <Pic src="/images/princess.webp" alt="" width={520} height={655} className={`${play.hero} ${play.heroLeft}`} />
  <Pic src="/images/prince.webp" alt="" width={520} height={655} className={`${play.hero} ${play.heroRight}`} />
  <div className={play.col}>
    <div className={play.brandRow}>
      <span className={styles.brand} style={{ fontSize: 28 }}>childPlayer</span>
      <span className={play.tag}>{/* controller icon */}Play area</span>
    </div>
    <form className={styles.card} ...>{/* title "Grown-ups, sign in", subtitle, fields, error, submit: unchanged except the subtitle text */}</form>
    <div className={play.signupRow}>
      <span>No account yet?</span> <Link href="/sign-up?from=play">Sign up now</Link>
      <button type="button" className={play.helpBtn} aria-label="How do I create an account?" aria-expanded={help} aria-controls="play-help" onClick={() => setHelp((v) => !v)}>?</button>
    </div>
    {help && (
      <div id="play-help" className={play.helpPanel}>
        <p>childPlayer is a calm game space for young children. You set up the games, then play along with your child.</p>
        <ol>
          <li>Create an account with your email.</li>
          <li>Open the link we email you to confirm it.</li>
          <li>Sign in, open Parent configuration and add your child.</li>
        </ol>
      </div>
    )}
    <p className={styles.foot}>Managing content? <Link href="/admin/sign-in">Go to Parent Admin</Link></p>
  </div>
</div>
```

Subtitle text is exactly `Sign in and play along with your child.`.

Controller icon, 22x22, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth="2"`, `strokeLinecap="round"`, `strokeLinejoin="round"`, `aria-hidden`:

```tsx
<path d="M6 11h4M8 9v4M15 12h.01M18 10h.01" /><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258A4 4 0 0 0 17.32 5z" />
```

`playSignIn.module.css`:

```css
.wrap { position: relative; min-height: 100vh; overflow: hidden; display: flex; align-items: center; justify-content: center; padding: 48px 16px; box-sizing: border-box; background: linear-gradient(#dce8f1, #fbf4e9 70%); font-family: 'Nunito', sans-serif; color: #4a3830; }
.col { position: relative; z-index: 1; width: 100%; max-width: 440px; display: flex; flex-direction: column; gap: 18px; }
.brandRow { display: flex; align-items: center; justify-content: center; gap: 12px; }
.tag { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 16px; background: #fff; color: #3f6285; font-weight: 700; font-size: 14px; }
.signupRow { display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; font-size: 15px; }
.helpBtn { width: 30px; height: 30px; border-radius: 15px; border: 1.5px solid #8fb3d1; background: #fff; color: #3f6285; font: 700 16px 'Nunito', sans-serif; cursor: pointer; }
.helpBtn:focus-visible { outline: 3px solid #c77d85; outline-offset: 2px; }
.helpPanel { background: #fff; border-radius: 16px; padding: 16px 20px; font-size: 14px; line-height: 1.5; }
.helpPanel p { margin: 0 0 8px; }
.helpPanel ol { margin: 0; padding-left: 20px; }
.hero { position: absolute; bottom: 0; width: clamp(160px, 22vw, 420px); height: auto; pointer-events: none; }
.heroLeft { left: 2vw; }
.heroRight { right: 2vw; }
@media (max-width: 900px) { .hero { display: none; } }
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/PlaySignIn.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/play/SkyScene.tsx components/play/SkyScene.module.css app/play/sign-in tests/PlaySignIn.test.tsx
git commit -m "feat: play area sign-in with scene, sign-up link and help (FS1-FS4)"
```

## Task 5: Admin sign-in, sign-up origin, logout destination (FS5..FS7)

**Files:**
- Create: `lib/auth/signInPath.ts`
- Modify: `app/admin/sign-in/page.tsx`, `app/sign-up/page.tsx`, `components/auth/LogoutButton.tsx:26`
- Test: `tests/signInPath.test.ts` (create), `tests/SignUpPage.test.tsx`, `tests/AdminSignIn.test.tsx`, `tests/LogoutButton.test.tsx`, `tests/PlayPicker.test.tsx:176-181`, `e2e/multiuser.spec.ts:77`

**Interfaces:**
- Produces: `export type SignInPath = '/play/sign-in' | '/admin/sign-in'` and `export function signInPathFor(search: string): SignInPath`.

- [ ] **Step 1: Write the failing tests**

`tests/signInPath.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { signInPathFor } from '@/lib/auth/signInPath';

describe('signInPathFor (FS6)', () => {
  it('from=play goes to the play sign-in', () => expect(signInPathFor('?from=play')).toBe('/play/sign-in'));
  it.each(['', '?from=PLAY', '?from=admin', '?from=https://evil.test', '?x=play'])('%s goes to the admin sign-in', (s) => {
    expect(signInPathFor(s)).toBe('/admin/sign-in');
  });
});
```

Add to `tests/SignUpPage.test.tsx`, with `afterEach(() => window.history.pushState({}, '', '/sign-up'))`:

```tsx
it('from=play sends every sign-in path to the play area (FS6)', async () => {
  window.history.pushState({}, '', '/sign-up?from=play');
  render(<SignUpPage />);
  expect(await screen.findByText('childPlayer')).toBeTruthy();
  expect(screen.getByRole('link', { name: /sign in/i }).getAttribute('href')).toBe('/play/sign-in');
  fill();
  await acceptPolicy();
  expect((await screen.findAllByRole('link', { name: /sign in/i }))[0].getAttribute('href')).toBe('/play/sign-in');
  expect(h.signUp.mock.calls[0][0].options.emailRedirectTo).toBe(`${location.origin}/play/sign-in`);
});
```

Add to `tests/AdminSignIn.test.tsx`, mocking `next/link` as in `SignUpPage.test.tsx` if it is not mocked yet:

```tsx
it('is clearly the admin page and links to the play area (FS5)', () => {
  render(<SignInPage />);
  expect(screen.getByRole('heading', { name: 'Parent Admin sign-in' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Go to the play area' }).getAttribute('href')).toBe('/play/sign-in');
});
```

Use the page import name that the file already has.

Replace `/admin/sign-in` with `/play/sign-in` in the expectations at `tests/LogoutButton.test.tsx:35,40`, `tests/PlayPicker.test.tsx:176,181` and `e2e/multiuser.spec.ts:77` (`/\/play\/sign-in$/`).

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/signInPath.test.ts tests/SignUpPage.test.tsx tests/AdminSignIn.test.tsx tests/LogoutButton.test.tsx tests/PlayPicker.test.tsx`
Expected: the new and changed tests FAIL.

- [ ] **Step 3: Implement**

- `signInPathFor`: `new URLSearchParams(search).get('from') === 'play' ? '/play/sign-in' : '/admin/sign-in'`.
- `app/sign-up/page.tsx`: do **not** use `useSearchParams`, because it needs a Suspense boundary and breaks the build. Use `const [signInPath, setSignInPath] = useState<SignInPath>('/admin/sign-in');` with `useEffect(() => setSignInPath(signInPathFor(window.location.search)), []);`. Use `signInPath` in `emailRedirectTo` (line 67) and both links (lines 96, 116). The brand at line 85 becomes `{signInPath === '/play/sign-in' ? 'childPlayer' : 'Parent Admin'}`.
- `app/admin/sign-in/page.tsx`: h1 becomes `Parent Admin sign-in`. After the "Create a parent account" paragraph add `<p className={styles.foot}>Want to play? <Link href="/play/sign-in">Go to the play area</Link></p>`.
- `LogoutButton.tsx:26`: push `/play/sign-in`. Update the doc comment. Leave `AdminNav.tsx` and `AdminSignOutButton.tsx` alone.

- [ ] **Step 4: Run the tests and the group checks**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all pass. The build proves `/sign-up` still prerenders.

- [ ] **Step 5: Add an E2E test and run it**

Create `e2e/play-sign-in.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { reset, SIGNED_OUT } from './support/fixtures';

test.use({ storageState: SIGNED_OUT });
test.beforeEach(async () => { await reset(); });

test('from the play sign-in to sign-up and back (FS3, FS6)', async ({ page }) => {
  await page.goto('/play/sign-in');
  await page.getByRole('button', { name: 'How do I create an account?' }).click();
  await expect(page.getByText('Open the link we email you to confirm it.')).toBeVisible();
  await page.getByRole('link', { name: 'Sign up now' }).click();
  await expect(page).toHaveURL(/\/sign-up\?from=play$/);
  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/play\/sign-in$/);
});
```

Run: `npm run e2e -- e2e/play-sign-in.spec.ts e2e/multiuser.spec.ts`
Expected: PASS. Then run `graphify update .`

- [ ] **Step 6: Commit**

```bash
git add lib/auth/signInPath.ts app/admin/sign-in/page.tsx app/sign-up/page.tsx components/auth/LogoutButton.tsx tests e2e
git commit -m "feat: sign-in paths follow where the parent came from (FS5-FS7)"
```

---

# Group 3: Picker, PIN, theme, corner buttons (FP1..FP13). Branch `claude/feedback-3-play`

Start with: `git checkout -b claude/feedback-3-play`

## Task 6: Active child data and theme tokens (FP1)

**Files:**
- Create: `lib/useActiveChild.ts`
- Modify: `lib/settings.ts:16,26,30-31`, `lib/childTheme.ts`
- Test: `tests/useActiveChild.test.tsx` (create), `tests/settings.test.ts`, `tests/childTheme.test.ts`

**Interfaces:**
- Produces:

```ts
// lib/settings.ts
export type ChildSettings = ChildSettingsRow & { child_name: string | null; avatar_path: string | null; gender: Gender };
// lib/useActiveChild.ts
export type ActiveChild =
  | { status: 'loading'; settings: null; name: ''; avatarUrl: null; gender: null }
  | { status: 'failed'; settings: null; name: ''; avatarUrl: null; gender: null }
  | { status: 'ready'; settings: ChildSettings; name: string; avatarUrl: string | null; gender: Gender };
export function useActiveChild(): ActiveChild;
// lib/childTheme.ts
GENDER_THEME[g].hero: '/images/prince.webp' | '/images/princess.webp'
GENDER_THEME[g].heroAlt: string
export const BOY_WELCOME_VARS: Record<'--w-enter' | '--w-enter-shadow' | '--w-enter-halo' | '--w-name' | '--w-bars', string>;
```

- [ ] **Step 1: Write the failing tests**

`tests/useActiveChild.test.tsx`:

```tsx
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/settings', () => ({ getMyChildSettings: h.get }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));

import { useActiveChild } from '@/lib/useActiveChild';

beforeEach(() => h.get.mockReset());
afterEach(cleanup);

describe('useActiveChild (FP1)', () => {
  it('starts loading, then gives the child', async () => {
    h.get.mockResolvedValue({ child_name: 'Bi', avatar_path: 'a.png', gender: 'male' });
    const { result } = renderHook(() => useActiveChild());
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ name: 'Bi', avatarUrl: '/media/a.png', gender: 'male' });
  });
  it('fails when the load rejects', async () => {
    h.get.mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useActiveChild());
    await waitFor(() => expect(result.current.status).toBe('failed'));
  });
  it('fails when there is no active child', async () => {
    h.get.mockResolvedValue(null);
    const { result } = renderHook(() => useActiveChild());
    await waitFor(() => expect(result.current.status).toBe('failed'));
  });
});
```

In `tests/settings.test.ts`, add `gender: 'female'` to `kid` and update any `toEqual` on the `getMyChildSettings` result to include it.

In `tests/childTheme.test.ts`, add to the male `toEqual`: `hero: '/images/prince.webp', heroAlt: 'Chibi prince with a crown and cape'`. Add to the female one: `hero: '/images/princess.webp', heroAlt: 'Chibi princess with a magic wand'`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/useActiveChild.test.tsx tests/settings.test.ts tests/childTheme.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

- `lib/settings.ts`: `import type { Gender } from '@/lib/childTheme'`. Select `'display_name, avatar_path, gender'`. Add `gender: Gender` to the local `k` type. Return `{ ...settings, child_name: k.display_name, avatar_path: k.avatar_path, gender: k.gender }`.
- `lib/useActiveChild.ts`: start with `'use client';`. Call `getMyChildSettings` once in `useEffect`, guarded with a `live` flag. `name` is `settings.child_name ?? ''`, `avatarUrl` is `mediaUrl(settings.avatar_path)`.
- `lib/childTheme.ts`:

```ts
export const BOY_WELCOME_VARS = {
  '--w-enter': '#A9C6DE',
  '--w-enter-shadow': '#8FB3D1',
  '--w-enter-halo': 'rgba(169, 198, 222, 0.25)',
  '--w-name': '#3F6285',
  '--w-bars': '#8FB3D1',
} as const;
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run tests/useActiveChild.test.tsx tests/settings.test.ts tests/childTheme.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/useActiveChild.ts lib/settings.ts lib/childTheme.ts tests/useActiveChild.test.tsx tests/settings.test.ts tests/childTheme.test.ts
git commit -m "feat: active child hook with gender and hero art (FP1)"
```

## Task 7: Welcome screen by gender (FP9)

**Files:**
- Modify: `app/page.tsx`, `app/welcome.module.css`
- Test: `tests/WelcomePage.test.tsx` (create)

**Interfaces:**
- Consumes: `useActiveChild`, `GENDER_THEME[g].hero`, `heroAlt`, `BOY_WELCOME_VARS`.

- [ ] **Step 1: Write the failing test**

```tsx
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/settings', () => ({ getMyChildSettings: h.get }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));
vi.mock('@/lib/audio', () => ({ playOnce: vi.fn(), startMusic: vi.fn() }));
vi.mock('@/components/MusicButton', () => ({ MusicButton: () => null }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

import Welcome from '@/app/page';

const base = { child_name: 'Bi', greeting_path: null, music_path: null, music_volume: 30, avatar_path: null };
const enter = () => screen.queryByRole('button', { name: 'Tap to enter' });

beforeEach(() => h.get.mockReset());
afterEach(cleanup);

describe('Welcome by gender (FP9, FP1)', () => {
  it('shows no hero and no enter button until the child is known', () => {
    h.get.mockReturnValue(new Promise(() => undefined));
    render(<Welcome />);
    expect(enter()).toBeNull();
    expect(screen.queryByAltText(/chibi/i)).toBeNull();
  });
  it('a boy gets the prince and the blue variables', async () => {
    h.get.mockResolvedValue({ ...base, gender: 'male' });
    const { container } = render(<Welcome />);
    expect(await screen.findByAltText('Chibi prince with a crown and cape')).toBeTruthy();
    const scene = container.querySelector('[data-welcome-scene]') as HTMLElement;
    expect(scene.style.getPropertyValue('--w-enter')).toBe('#A9C6DE');
  });
  it('a girl keeps the princess and sets no variables', async () => {
    h.get.mockResolvedValue({ ...base, gender: 'female' });
    const { container } = render(<Welcome />);
    expect(await screen.findByAltText('Chibi princess with a magic wand')).toBeTruthy();
    const scene = container.querySelector('[data-welcome-scene]') as HTMLElement;
    expect(scene.style.getPropertyValue('--w-enter')).toBe('');
  });
  it('a failed load shows the princess and still lets the child enter', async () => {
    h.get.mockRejectedValue(new Error('x'));
    render(<Welcome />);
    await waitFor(() => expect(enter()).toBeTruthy());
    expect(screen.getByAltText('Chibi princess with a magic wand')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/WelcomePage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `app/page.tsx`**

Replace the `settings` state and its `useEffect` with `const child = useActiveChild(); const settings = child.settings;`. Then:

```tsx
const known = child.status !== 'loading';
const theme = GENDER_THEME[child.gender ?? 'female'];
const vars = child.gender === 'male' ? (BOY_WELCOME_VARS as React.CSSProperties) : undefined;
```

- Scene div: `<div className={styles.scene} data-welcome-scene style={vars}>`.
- Wrap the `styles.princess` block in `{known && ...}`. The picture uses `src={theme.hero}` and `alt={theme.heroAlt}`.
- The `!entered` block renders only when `known`: `{!entered ? (known ? <enter block /> : null) : <entered block />}`.
- `onEnter` still uses `settings?.`. `settings` is null after a failure, and that already works.
- Keep the `Settings` type only if something still uses it. Otherwise remove it.

- [ ] **Step 4: Update `app/welcome.module.css`, keeping today's colors as fallbacks**

- `.enterBtn`: `background: var(--w-enter, #ebb7bc); box-shadow: 0 16px 0 var(--w-enter-shadow, #d9a0a6), 0 0 0 40px var(--w-enter-halo, rgba(235, 183, 188, 0.25));`
- `.bars span`: `background: var(--w-bars, #ebb7bc);`
- `.greeting`: `color: var(--w-name, #b8737b);`

Do not change `.start`.

- [ ] **Step 5: Run it to see it pass**

Run: `npx vitest run tests/WelcomePage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/welcome.module.css tests/WelcomePage.test.tsx
git commit -m "feat: welcome screen follows the child's gender (FP9)"
```

## Task 8: The "Who are you?" picker (FP2..FP5)

**Files:**
- Modify: `app/play/page.tsx`, `components/play/ChildPickCard.tsx`, `components/play/ParentConfigCard.tsx`, `components/play/play.module.css`
- Test: `tests/PlayPicker.test.tsx`

**Interfaces:**
- Consumes: `SkyScene` from Task 4.
- Produces: `ChildPickCard` and `ParentConfigCard` accept `size: 'large' | 'small'`, rendered as `data-size` on the button.

- [ ] **Step 1: Add failing tests to `tests/PlayPicker.test.tsx`**

Set up children with the same mock the file's other tests use (`h.list`, and a parent id that matches the session), and use its `ready()` helper:

```tsx
describe('picker look (FP2, FP4)', () => {
  it('asks "Who are you?"', async () => {
    await ready();
    expect(screen.getByRole('heading', { name: 'Who are you?' })).toBeTruthy();
  });
  it('uses large cards up to 4 in total', async () => {
    // make the list return 3 children: 3 + Parent configuration = 4 cards
    await ready();
    expect(screen.getByRole('button', { name: 'Parent configuration' }).getAttribute('data-size')).toBe('large');
  });
  it('uses small cards with 5 children (6 cards)', async () => {
    // make the list return 5 children
    await ready();
    expect(screen.getByRole('button', { name: 'Parent configuration' }).getAttribute('data-size')).toBe('small');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/PlayPicker.test.tsx`
Expected: the new tests FAIL.

- [ ] **Step 3: Implement**

`app/play/page.tsx`:
- Replace `<Hills variant="double" />` with `<SkyScene festive />` and remove the `Hills` import.
- In the `kids` branch, add `<h1 className={styles.title}>Who are you?</h1>` before the cards row. Wrap both in a fragment.
- `const size = kids && kids.length + 1 <= 4 ? 'large' : 'small';` and pass `size` to both card components.
- Change the row `gap` from `32` to `size === 'large' ? 32 : 24`.
- Update the doc comment: the title is for the grown-up (ADR-036).

`ChildPickCard` and `ParentConfigCard`: add the `size` prop, set `data-size={size}`, and add `size === 'large' ? styles.cardLarge : styles.cardSmall` to `className`.

`play.module.css`:
- Remove `width: 270px; height: 400px;` from `.card`.
- Change `.config` to `.config { background: transparent; border: 8px dashed #c9a98f; box-shadow: none; }`.
- Add:

```css
.title { position: absolute; left: 0; right: 0; top: 90px; margin: 0; text-align: center; font-size: 96px; font-weight: 600; color: #8a5560; line-height: 1.1; }
.cardLarge { width: 340px; height: 480px; }
.cardLarge .avatar { width: 210px; height: 210px; border-radius: 105px; font-size: 118px; }
.cardLarge .name { font-size: 52px; }
.cardSmall { width: 280px; height: 420px; }
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run tests/PlayPicker.test.tsx tests/ChildCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/play/page.tsx components/play tests/PlayPicker.test.tsx
git commit -m "feat: picker title, playful scene, bigger cards, dashed parent card (FP2-FP5)"
```

## Task 9: The PIN popup (FP6..FP8)

**Files:**
- Create: `lib/trapTab.ts`
- Modify: `components/play/PinEntry.tsx`, `components/play/play.module.css`
- Test: `tests/PinEntry.test.tsx`

**Interfaces:**
- Consumes: `ModalClose` with `size="child"`, `GENDER_THEME[g].hero`.
- Produces: `export function trapTab(e: { key: string; shiftKey: boolean; preventDefault(): void }, root: HTMLElement): void`. Task 10 uses it. It does nothing unless `e.key === 'Tab'`. It keeps focus inside `root` by wrapping between the first and last of `root.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]')`.

- [ ] **Step 1: Add failing tests to `tests/PinEntry.test.tsx`**

```tsx
describe('PIN popup (FP6-FP8)', () => {
  it('is a dialog titled with the child name, with the matching hero', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Enter your PIN, My!' })).toBeTruthy();
    expect(document.querySelector('img[src*="princess.webp"]')).toBeTruthy();
    cleanup();
    render(<PinEntry child={{ ...child, gender: 'male' }} onCorrect={onCorrect} onCancel={onCancel} />);
    expect(document.querySelector('img[src*="prince.webp"]')).toBeTruthy();
  });
  it('shows * and never the real character', () => {
    setup();
    fireEvent.change(boxes()[0], { target: { value: 'a' } });
    expect(boxes()[0].value).toBe('*');
    expect(document.body.innerHTML).not.toContain('value="a"');
  });
  it('a caret before the mask still reads the new character', () => {
    setup();
    type('a');
    fireEvent.change(boxes()[0], { target: { value: 'B*' } });
    expect(boxes()[0].value).toBe('*');
    type('');
    fireEvent.change(boxes()[1], { target: { value: 'B' } });
    fireEvent.change(boxes()[2], { target: { value: '3' } });
    fireEvent.change(boxes()[3], { target: { value: 'z' } });
    expect(onCorrect).not.toHaveBeenCalled(); // box 1 now holds B, so the PIN is BB3z
  });
  it('typing a literal * does not clear or change a filled box', () => {
    setup();
    type('a');
    fireEvent.change(boxes()[0], { target: { value: '**' } });
    type('');
    fireEvent.change(boxes()[1], { target: { value: 'B' } });
    fireEvent.change(boxes()[2], { target: { value: '3' } });
    fireEvent.change(boxes()[3], { target: { value: 'z' } });
    expect(onCorrect).toHaveBeenCalledTimes(1); // box 1 still holds a
  });
  it('closes by X and by a click outside, not by a click inside', () => {
    const { container } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(container.querySelector('[data-pin-overlay]') as Element);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
```

The first test uses `cleanup` from the file's existing import. `type('')` is a no-op from the file's helper.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/PinEntry.test.tsx`
Expected: the new tests FAIL. The old ones pass.

- [ ] **Step 3: Implement the input masking**

In `components/play/PinEntry.tsx`, replace the first lines of `onChange`:

```ts
function onChange(i: number, raw: string) {
  const typed = raw.replace(/\*/g, '');
  if (raw !== '' && typed === '') return; // only mask characters: nothing new was typed
  const c = typed.slice(-1);
  if (c !== '' && !OK.test(c)) return;
  // the rest of the function is unchanged
```

On each input: `value={c ? '*' : ''}` and `onFocus={(e) => e.target.select()}`. Keep `type="text"`, `maxLength={1}`, `autoComplete="off"`.

- [ ] **Step 4: Implement the panel**

```tsx
const titleId = useId();
const panelRef = useRef<HTMLDivElement>(null);
const name = child.display_name.trim();
return (
  <div className={styles.overlay} data-pin-overlay onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
    <div ref={panelRef} className={styles.panel} role="dialog" aria-modal="true" aria-labelledby={titleId}
      style={{ borderColor: theme.accent, background: theme.bg, position: 'relative' }}
      onKeyDown={(e) => { if (panelRef.current) trapTab(e, panelRef.current); }}>
      <ModalClose size="child" onClick={onCancel} />
      <div className={styles.pinHead}>
        <Pic src={theme.hero} alt="" width={200} height={252} className={styles.pinHero} />
        <span className={styles.avatar} aria-hidden="true" style={{ color: theme.text, width: 130, height: 130, fontSize: 72 }}>{/* unchanged contents */}</span>
      </div>
      <h2 id={titleId} className={styles.pinTitle} style={{ color: theme.text }}>Enter your PIN, {name}!</h2>
      {/* the existing row of boxes, unchanged */}
    </div>
  </div>
);
```

Add to `play.module.css`:

```css
.pinHead { display: flex; align-items: center; gap: 32px; }
.pinHero { width: 200px; height: 252px; object-fit: contain; }
.pinTitle { margin: 0; max-width: 760px; font-size: 56px; font-weight: 600; line-height: 1.15; text-align: center; overflow-wrap: anywhere; }
```

Change `.panel` `gap` to `24px` and `padding` to `36px 64px 44px`, so the panel fits inside 1080. Update the component's doc comment: the title is for the grown-up (ADR-036), wrong PIN still has no text.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/PinEntry.test.tsx tests/PlayPicker.test.tsx`
Expected: PASS. The old "shakes with no text" test still passes because the title does not change.

- [ ] **Step 6: Commit**

```bash
git add lib/trapTab.ts components/play tests/PinEntry.test.tsx
git commit -m "feat: PIN popup with title, hero, masked boxes and close (FP6-FP8)"
```

## Task 10: Leave game button and popup (FP11..FP13)

**Files:**
- Create: `components/auth/LeaveGameButton.tsx`
- Delete: `components/auth/SwitchChildButton.tsx`, `tests/SwitchChildButton.test.tsx`
- Modify: `lib/audio.ts`, `components/auth/auth.module.css`, `components/play/play.module.css`, `app/games/page.tsx:16,134`, `app/page.tsx`
- Test: `tests/LeaveGameButton.test.tsx` (create), `tests/audio*.test.ts` if one exists

**Interfaces:**
- Consumes: `useActiveChild`, `trapTab`, `ModalClose`, `clearActiveChild`, `GENDER_THEME`.
- Produces: `export default function LeaveGameButton(): JSX.Element` and, in `lib/audio.ts`, `export function stopMusic(): void`. `stopMusic` pauses the track, sets `music` and `currentUrl` to null and calls `notify()`. It must not change `wanted` or `localStorage`.

- [ ] **Step 1: Write the failing test `tests/LeaveGameButton.test.tsx`**

```tsx
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ push: vi.fn(), clear: vi.fn(), stop: vi.fn(), get: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock('@/lib/childSession', () => ({ clearActiveChild: h.clear }));
vi.mock('@/lib/audio', () => ({ stopMusic: h.stop }));
vi.mock('@/lib/settings', () => ({ getMyChildSettings: h.get }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));

import LeaveGameButton from '@/components/auth/LeaveGameButton';

beforeEach(() => {
  vi.clearAllMocks();
  h.get.mockResolvedValue({ child_name: 'Bi', avatar_path: null, gender: 'male' });
});
afterEach(cleanup);

const open = () => fireEvent.click(screen.getByRole('button', { name: 'Leave game' }));
const dialog = () => screen.queryByRole('dialog', { name: 'Leave game?' });

describe('LeaveGameButton (FP11-FP13)', () => {
  it('opens with focus on Stay, and needs no sum', () => {
    render(<LeaveGameButton />);
    open();
    expect(dialog()).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.queryByTestId('adult-question')).toBeNull();
  });
  it.each([
    ['Stay', () => fireEvent.click(screen.getByRole('button', { name: 'Stay' }))],
    ['X', () => fireEvent.click(screen.getByRole('button', { name: 'Close' }))],
    ['Esc', () => fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })],
    ['outside', () => fireEvent.mouseDown(document.querySelector('[data-leave-overlay]') as Element)],
  ])('%s stays in the game and returns focus to the button', (_n, act) => {
    render(<LeaveGameButton />);
    open();
    act();
    expect(dialog()).toBeNull();
    expect(h.clear).not.toHaveBeenCalled();
    expect(h.push).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Leave game' }));
  });
  it('Leave clears the child, stops the music and goes to the picker', () => {
    render(<LeaveGameButton />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(h.stop).toHaveBeenCalledTimes(1);
    expect(h.clear).toHaveBeenCalledTimes(1);
    expect(h.push).toHaveBeenCalledWith('/play');
  });
  it('shows the first letter when the child has no avatar', async () => {
    render(<LeaveGameButton />);
    open();
    await waitFor(() => expect(screen.getByRole('dialog').textContent).toContain('B'));
  });
});
```

Create `tests/stopMusic.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeAudio {
  static made: FakeAudio[] = [];
  paused = true; loop = false; volume = 1;
  constructor(public src: string) { FakeAudio.made.push(this); }
  addEventListener() {}
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}

beforeEach(() => { vi.resetModules(); FakeAudio.made = []; vi.stubGlobal('Audio', FakeAudio); localStorage.clear(); });

describe('stopMusic (FP13)', () => {
  it('stops the track, keeps the saved choice, and the next child loads their own track', async () => {
    const a = await import('@/lib/audio');
    a.setMusicWanted(true);
    a.startMusic('/one.mp3', 30);
    expect(a.isMusicPlaying()).toBe(true);
    const saved = localStorage.getItem('childPlayer-music');
    a.stopMusic();
    expect(a.isMusicPlaying()).toBe(false);
    expect(a.hasMusic()).toBe(false);
    expect(a.isMusicWanted()).toBe(true);
    expect(localStorage.getItem('childPlayer-music')).toBe(saved);
    a.startMusic('/two.mp3', 30);
    expect(FakeAudio.made.at(-1)?.src).toBe('/two.mp3');
    expect(a.isMusicPlaying()).toBe(true);
    expect(FakeAudio.made[0].paused).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/LeaveGameButton.test.tsx tests/stopMusic.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add `stopMusic` to `lib/audio.ts`**

Follow the Interfaces block.

- [ ] **Step 4: Implement `LeaveGameButton`**

Start with `'use client';`. State: `open`. Refs: `btn` for the corner button, `stay` for the Stay button, `leaveChoice` for the Leave button, `panel` for the panel.

- Corner button: `<button ref={btn} type="button" className={auth.leave} aria-label="Leave game" onClick={() => setOpen(true)}>`. Icon, 52x52, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="#7A5C50"`, `strokeWidth="2"`, `strokeLinecap="round"`, `strokeLinejoin="round"`, `aria-hidden`: `<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" /><path d="M16 8l4 4-4 4" /><path d="M20 12H10" />`.
- `useEffect` when `open` becomes true: `stay.current?.focus()`.
- `close()`: `setOpen(false); btn.current?.focus();`. Focus the button after the state update; use `flushSync` from `react-dom` around `setOpen(false)` so the test sees focus at once.
- `leave()`: `stopMusic(); clearActiveChild(); router.push('/play');`.
- Popup, when open:

```tsx
<div className={play.overlay} data-leave-overlay onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
  <div ref={panel} className={play.panel} role="dialog" aria-modal="true" aria-labelledby={titleId}
    style={{ position: 'relative', background: '#fff', borderColor: theme.accent }}
    onKeyDown={onKey}>
    <ModalClose size="child" onClick={close} />
    <span className={play.avatar} aria-hidden="true" style={{ color: theme.text, width: 220, height: 220, fontSize: 120, border: `10px solid ${theme.accent}` }}>
      {child.avatarUrl ? <Pic src={child.avatarUrl} alt="" /> : [...child.name.trim()][0]?.toUpperCase()}
    </span>
    <h2 id={titleId} className={play.pinTitle} style={{ color: theme.text }}>Leave game?</h2>
    <div className={play.leaveRow}>
      <button ref={stay} type="button" className={`hm-tap ${play.stayBtn}`} onClick={close}>{/* play icon */}Stay</button>
      <button ref={leaveChoice} type="button" className={`hm-tap ${play.leaveBtn}`} onClick={leave}>{/* sign-out icon */}Leave</button>
    </div>
  </div>
</div>
```

- `theme = GENDER_THEME[child.gender ?? 'female']`, `child = useActiveChild()`.
- `onKey(e)`: on `Escape`, `e.stopPropagation(); close();`. On `ArrowLeft`/`ArrowRight`, call `e.preventDefault()` and `stepFocus([stay.current!, leaveChoice.current!], e.key === 'ArrowRight' ? 1 : -1)` (`stepFocus` is in `@/lib/keynav`). Otherwise `trapTab(e, panel.current)`.
- Play icon for Stay: `<path d="M8 5.5v13l10.5-6.5z" />`, 44x44, `fill="#fff"`. Leave uses the sign-out icon at 44x44.

CSS, in `auth.module.css`:

```css
.leave { position: absolute; z-index: 10; left: 56px; bottom: 48px; width: 104px; height: 104px; border-radius: 52px; border: none; background: #fff; box-shadow: 0 6px 0 #eadcc8; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
.leave:hover { filter: brightness(1.03); }
.leave:focus-visible { outline: 6px solid #c77d85; outline-offset: 4px; }
```

In `play.module.css`:

```css
.leaveRow { display: flex; gap: 32px; }
.stayBtn, .leaveBtn { display: flex; align-items: center; gap: 16px; height: 120px; padding: 0 48px; border-radius: 60px; font-size: 48px; font-weight: 600; font-family: inherit; cursor: pointer; }
.stayBtn { border: none; background: #9cc3a4; color: #fff; box-shadow: 0 10px 0 #7fa889; }
.leaveBtn { border: 6px solid #e3d5c4; background: #fff; color: #5a4038; box-shadow: 0 10px 0 #eadcc8; }
.stayBtn:focus-visible, .leaveBtn:focus-visible { outline: 6px solid #7a5c50; outline-offset: 6px; }
```

- [ ] **Step 5: Swap the buttons in**

- `app/games/page.tsx`: replace the `SwitchChildButton` import and `<SwitchChildButton />` with `LeaveGameButton`.
- `app/page.tsx`: add `<LeaveGameButton />` right after `<MusicButton />`.
- Delete the old component and test:

```bash
git rm components/auth/SwitchChildButton.tsx tests/SwitchChildButton.test.tsx
```

- Leave `.logout` in `auth.module.css`, because `LogoutButton` still uses it.
- In `tests/WelcomePage.test.tsx`, change the audio mock to `vi.mock('@/lib/audio', () => ({ playOnce: vi.fn(), startMusic: vi.fn(), stopMusic: vi.fn() }))` and add `vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))`, because `/` now renders `LeaveGameButton`.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/LeaveGameButton.test.tsx tests/stopMusic.test.ts tests/GamesPage.test.tsx tests/WelcomePage.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A components/auth components/play lib/audio.ts app/games/page.tsx app/page.tsx tests
git commit -m "feat: leave game button and popup, stop music on leaving (FP11-FP13)"
```

## Task 11: Move the music button and check every page (FP10, FT5)

**Files:**
- Modify: `components/MusicButton.module.css:4`, `components/MusicButton.tsx:17`, `lib/audio.ts` (comment on `setMusicWanted`), `components/find/FindBoard.tsx:10`, `app/games/find/[levelId]/page.tsx:203`
- Test: `e2e/corners.spec.ts` (create), `tests/FindBoard*.test.tsx` if one asserts 1280

- [ ] **Step 1: Write the E2E test `e2e/corners.spec.ts`**

Use `reset` and `pickChild` from `./support/fixtures`, and `test.use({ viewport: { width: 1920, height: 1080 } })`. Seed with `makeCards(30)` plus one quiz set, one find level and one spot level. Copy the row shapes from `e2e/find-play.spec.ts`, `e2e/spot-play.spec.ts` and `e2e/games.spec.ts`; give them stable ids.

```ts
const PAGES = ['/', '/games', '/games/memory', '/games/memory/12', '/games/listen', '/games/sort', '/games/quiz', `/games/quiz/${SET}`, `/games/quiz/${SET}/done`, '/games/find', `/games/find/${FIND}`, '/games/spot', `/games/spot/${SPOT}`];

for (const path of PAGES) {
  test(`music button is bottom-right and clear on ${path} (FP10)`, async ({ page }) => {
    await page.goto(path);
    const music = page.getByRole('button', { name: /background music/i });
    await expect(music).toBeVisible();
    await page.waitForTimeout(800); // pictures and layouts settle
    await page.screenshot({ path: `test-results/corners${path.replace(/\W+/g, '-')}.png` });
    const { left, top, hits } = await music.evaluate((btn) => {
      const m = btn.getBoundingClientRect();
      const out: string[] = [];
      for (const el of document.querySelectorAll('button, a, input, img, [role="img"], [data-card]')) {
        if (el === btn || btn.contains(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.left < m.right && r.right > m.left && r.top < m.bottom && r.bottom > m.top) out.push(`${el.tagName}:${el.getAttribute('aria-label') ?? ''}`);
      }
      return { left: m.left, top: m.top, hits: out };
    });
    expect(left).toBeGreaterThan(1500);
    expect(top).toBeGreaterThan(800);
    expect(hits).toEqual([]);
  });
}

test('the leave button is on / and /games only (FP11)', async ({ page }) => {
  for (const p of ['/', '/games']) { await page.goto(p); await expect(page.getByRole('button', { name: 'Leave game' })).toBeVisible(); }
  await page.goto('/games/quiz');
  await expect(page.getByRole('button', { name: /background music/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leave game' })).toHaveCount(0);
});

test('leave goes to the picker and coming back needs the PIN (FP13)', async ({ page }) => {
  await page.goto('/games');
  await page.getByRole('button', { name: 'Leave game' }).click();
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  await expect(page).toHaveURL(/\/play$/);
  await page.goto('/games');
  await expect(page).toHaveURL(/\/play$/); // no active child any more
  await pickChild(page); // the card and the PIN, then /games
  await expect(page).toHaveURL(/\/games$/);
});

test('the picker card and PIN look (FP5, FP7)', async ({ page }) => {
  await page.goto('/games');
  await page.getByRole('button', { name: 'Leave game' }).click();
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  const config = page.getByRole('button', { name: 'Parent configuration' });
  await expect(config).toHaveCSS('border-top-style', 'dashed');
  await expect(config).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.getByRole('button', { name: CHILD.name, exact: true }).click();
  await page.getByLabel('PIN character 1').pressSequentially(CHILD.pin[0]);
  await expect(page.getByLabel('PIN character 1')).toHaveValue('*');
});
```

Every test starts with `await reset(...)` and sign-in the same way `e2e/games.spec.ts` does. Import `CHILD` from fixtures if it is exported; if not, export it.

- [ ] **Step 2: Run it to see it fail**

Run: `npm run e2e -- e2e/corners.spec.ts`
Expected: music tests FAIL on `left > 1500`.

- [ ] **Step 3: Move the button**

- `MusicButton.module.css`: `left: 56px;` becomes `right: 56px;`.
- Update "bottom-left" to "bottom-right" in the doc comments of `MusicButton.tsx` and `lib/audio.ts`.
- `FindBoard.tsx:10`: `MAX_W = 1184`, comment "leaves room for the music button". `app/games/find/[levelId]/page.tsx:203`: `right: 56` becomes `right: 176`. If a test asserts 1280, change it to 1184.

- [ ] **Step 4: Run it again and fix each page that reports hits**

Run: `npm run e2e -- e2e/corners.spec.ts`

For each page that lists hits, move the page's content, never the music button: reduce that content's `right` or add `paddingRight`/`paddingBottom` of 120px on its container. If a hit is a full-screen decorative image, add `:not([aria-hidden="true"])` handling by excluding that element in the test and say so in the commit. If a fix would shrink a game's play area by more than 120px, stop and report with the screenshot from `test-results/`.

Expected at the end: PASS.

- [ ] **Step 5: Look at the screenshots**

Read `test-results/corners-.png`, `test-results/corners-games.png` and the three `corners-games-...` game pages. Confirm the button is bottom-right and nothing looks cut off. Note anything odd for the owner.

- [ ] **Step 6: Commit**

```bash
git add components/MusicButton.module.css components/MusicButton.tsx lib/audio.ts components/find/FindBoard.tsx "app/games/find/[levelId]/page.tsx" e2e/corners.spec.ts e2e/support tests
git commit -m "feat: music button moves bottom-right on all child pages (FP10)"
```

## Task 12: Group 3 docs and checks

**Files:**
- Modify: `docs/decision.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-11-05-children-table-design.md`

- [ ] **Step 1: Add the ADR at the end of `docs/decision.md`**

First run `grep -n "^### ADR-" docs/decision.md | tail -1`. If 036 is taken, use the next number and use that number everywhere.

```markdown
### ADR-036: Fixed English text on three child screens, for the accompanying grown-up

- **Status:** Accepted (2026-11-05). Narrow exception to "no child-facing text is hard-coded".
- **Decision:** `/play` ("Who are you?"), the PIN popup ("Enter your PIN, <name>!") and the Leave game popup ("Leave game?", "Stay", "Leave") may show fixed English text. It is for the grown-up playing along. Each screen stays usable without reading, through pictures, avatars and icons. Wrong-PIN feedback stays without text. Other child screens keep the old rule.
- **Also:** leaving a child's session has no "a + b" check, because the PIN guards coming back. Parent sign-out and Parent configuration keep the check.
```

- [ ] **Step 2: Update `CLAUDE.md`**

Keep it under one page. In the Rules section:
- First rule: after "no child-facing text is hard-coded (the admin writes it)", add ", except the three grown-up lines in ADR-036".
- Roles rule: change `sign-out or Parent Configuration asks "a + b = ?"` to `parent sign-out or Parent Configuration asks "a + b = ?"; Leave game on / and /games returns to /play with no check, and the PIN guards coming back`.

- [ ] **Step 3: Update `docs/superpowers/specs/2026-11-05-children-table-design.md`**

Add a short note at the end of each of these items, in this form: `(Changed by parent feedback spec: <ID>.)`
- KU7: modal background is now `modalBg` (FA2).
- KU9: Parent Configuration has a dashed border and no background (FP5).
- KU10: the PIN popup has a title, hero art, masked boxes and a close button (FP6-FP8).
- KU11: sign-out goes to `/play/sign-in` (FS7).
- K10: switching child goes through Leave game (FP11-FP13).

- [ ] **Step 4: Run all checks**

Run: `npm run typecheck && npm run lint && npm test && npm run e2e`
Expected: all pass. Run `graphify update .`

- [ ] **Step 5: Commit**

```bash
git add docs/decision.md CLAUDE.md docs/superpowers/specs/2026-11-05-children-table-design.md
git commit -m "docs: ADR-036 and updated rules for the play screens (FP1-FP13)"
```

---

# Group 4: Game list without the filter (FG1..FG6). Branch `claude/feedback-4-game-list`

Start with: `git checkout -b claude/feedback-4-game-list`

## Task 13: Family content helpers and stand-in support (FG2, FG3, FG4, FG6)

**Files:**
- Create: `lib/familyContent.ts`
- Modify: `e2e/support/standin-supabase.mjs:168`, `lib/memory/types.ts`
- Test: `tests/familyContent.test.ts` (create)

**Interfaces:**
- Produces, all in `lib/familyContent.ts`:

```ts
export function familyOrGlobal<Q>(query: Q, me: string | null): Q;
export function ownerFirst<T extends { owner_id?: string | null }>(rows: readonly T[], me: string | null): T[];
export function tagFamilyCards<T extends { word: string; owner_id?: string | null }>(cards: readonly T[], me: string | null): (T & { family?: true })[];
export function pickFamilyFirst<T extends { family?: true }>(items: readonly T[], n: number, rng?: () => number): T[];
```

- `MemoryCard` in `lib/memory/types.ts` gains `owner_id?: string | null` and `family?: true`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { familyOrGlobal, ownerFirst, pickFamilyFirst, tagFamilyCards } from '@/lib/familyContent';

describe('familyOrGlobal (FG2)', () => {
  it('asks for my rows or global rows', () => {
    const q = { or: vi.fn(() => 'done'), eq: vi.fn() };
    expect(familyOrGlobal(q, 'me-id')).toBe('done');
    expect(q.or).toHaveBeenCalledWith('owner_id.eq.me-id,visibility.eq.global');
  });
  it('asks for global rows only with no session', () => {
    const q = { or: vi.fn(), eq: vi.fn(() => 'done') };
    expect(familyOrGlobal(q, null)).toBe('done');
    expect(q.eq).toHaveBeenCalledWith('visibility', 'global');
    expect(q.or).not.toHaveBeenCalled();
  });
});

describe('ownerFirst (FG3, FG4)', () => {
  it('moves my rows first and keeps each part in order', () => {
    const rows = [{ id: 'g1', owner_id: 'x' }, { id: 'm1', owner_id: 'me' }, { id: 'g2', owner_id: null }, { id: 'm2', owner_id: 'me' }];
    expect(ownerFirst(rows, 'me').map((r) => r.id)).toEqual(['m1', 'm2', 'g1', 'g2']);
  });
  it('keeps the order with no session', () => {
    const rows = [{ id: 'a', owner_id: 'x' }, { id: 'b', owner_id: 'y' }];
    expect(ownerFirst(rows, null)).toEqual(rows);
  });
});

describe('tagFamilyCards (FG6)', () => {
  const c = (id: string, word: string, owner_id: string | null) => ({ id, word, owner_id });
  it('tags my cards and drops other cards with the same word', () => {
    const out = tagFamilyCards([c('g', ' Cat ', 'x'), c('m', 'cat', 'me'), c('d', 'dog', 'x')], 'me');
    expect(out.map((o) => o.id)).toEqual(['m', 'd']);
    expect(out[0].family).toBe(true);
    expect(out[1].family).toBeUndefined();
  });
  it('never removes my own cards, even with the same word', () => {
    expect(tagFamilyCards([c('a', 'cat', 'me'), c('b', 'cat', 'me')], 'me')).toHaveLength(2);
  });
  it('returns the same objects when nothing is mine', () => {
    const rows = [c('a', 'cat', 'x')];
    expect(tagFamilyCards(rows, 'me')[0]).toBe(rows[0]);
  });
});

describe('pickFamilyFirst (FG5)', () => {
  const fam = (id: string) => ({ id, family: true as const });
  const glo = (id: string) => ({ id });
  it('takes family items before others', () => {
    const out = pickFamilyFirst([glo('g1'), fam('f1'), glo('g2'), fam('f2')], 3);
    expect(out.slice(0, 2).map((o) => o.id).sort()).toEqual(['f1', 'f2']);
    expect(out).toHaveLength(3);
  });
  it('uses only family items when they are enough', () => {
    expect(pickFamilyFirst([fam('f1'), fam('f2'), glo('g')], 2).every((o) => o.family)).toBe(true);
  });
  it('works with no family items', () => {
    expect(pickFamilyFirst([glo('g1'), glo('g2')], 1)).toHaveLength(1);
  });
  it('returns everything when n is larger', () => {
    expect(pickFamilyFirst([glo('g1')], 5)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/familyContent.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`familyOrGlobal` casts like the old `applyScope`:

```ts
type Filterable = { or(f: string): unknown; eq(c: string, v: string): unknown };
export function familyOrGlobal<Q>(query: Q, me: string | null): Q {
  const q = query as unknown as Filterable;
  return (me ? q.or(`owner_id.eq.${me},visibility.eq.global`) : q.eq('visibility', 'global')) as Q;
}
```

`tagFamilyCards`: normalize with `word.trim().toLowerCase()`. Build the set of words on cards whose `owner_id === me`. Drop cards that are not mine when their word is in the set. Return `{ ...card, family: true }` for mine, and the same object for others.

`pickFamilyFirst`: write a local Fisher-Yates `shuffle(items, rng)` copied from `lib/memory/deck.ts:16-23`. `[...shuffle(family, rng), ...shuffle(others, rng)].slice(0, n)`. Shuffle `family` first. Shuffling an empty list uses no random numbers, so existing tests with a fixed `rng` keep their results.

- [ ] **Step 4: Teach the E2E stand-in the `or` filter**

In `e2e/support/standin-supabase.mjs`, replace line 168 with:

```js
if (key === 'and') throw new Unsupported(`stand-in: unsupported filter "${key}"`);
if (key === 'or') {
  // Only the shape the app uses: or=(col.eq.value,col.eq.value)
  const parts = raw.replace(/^\(|\)$/g, '').split(',').map((p) => {
    const m = /^([a-z_]+)\.eq\.(.*)$/.exec(p.trim());
    if (!m) throw new Unsupported(`stand-in: cannot parse or part ${p}`);
    return { col: m[1], val: m[2] };
  });
  tests.push((row) => parts.some(({ col, val }) => same(row[col], val)));
  continue;
}
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run tests/familyContent.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/familyContent.ts lib/memory/types.ts e2e/support/standin-supabase.mjs tests/familyContent.test.ts
git commit -m "feat: helpers for family and global content (FG2-FG6)"
```

## Task 14: Quiz, Find and Spot lists (FG2, FG4)

**Files:**
- Modify: `app/games/quiz/page.tsx:6,19,43-52`, `lib/find/levels.ts:6,13-19`, `lib/spot/levels.ts:5,9-15`, `lib/find/types.ts`, `lib/spot/types.ts`
- Test: `tests/QuizSets.test.tsx`, `tests/findLevels.test.ts`, `tests/spotLevels.test.ts`

**Interfaces:**
- Consumes: `familyOrGlobal`, `ownerFirst`, `getMyUserId` from `@/lib/review`.
- `SpotLevel` and `FindLevel` gain `owner_id?: string | null`.

- [ ] **Step 1: Update the tests' mocks and add failing tests**

In all three test files, replace `vi.mock('@/lib/review', () => ({ applyScope: (q: unknown) => q }));` with:

```ts
vi.mock('@/lib/review', () => ({ getMyUserId: async () => 'me' }));
vi.mock('@/lib/familyContent', async (orig) => ({ ...(await orig<typeof import('@/lib/familyContent')>()), familyOrGlobal: (q: unknown) => q }));
```

The second mock keeps the existing fake query chains working.

Update the column strings: in `tests/spotLevels.test.ts`, `COLS = 'id, image_a_path, image_b_path, differences, active, sort_order, owner_id'`. Do the same for `tests/findLevels.test.ts`.

Add to `tests/spotLevels.test.ts`, and the same with `fetchActiveFindLevels` and playable rows to `tests/findLevels.test.ts`:

```ts
it('lists my levels first (FG4)', async () => {
  h.result = { data: [
    { id: 'g', image_a_path: 'x', image_b_path: 'y', differences: [], active: true, sort_order: 0, owner_id: 'other' },
    { id: 'm', image_a_path: 'x', image_b_path: 'y', differences: [], active: true, sort_order: 1, owner_id: 'me' },
  ], error: null };
  expect((await fetchActiveLevels()).map((l) => l.id)).toEqual(['m', 'g']);
});
```

Add to `tests/QuizSets.test.tsx`, with the file's `set` and `good` helpers:

```tsx
it('lists my sets first (FG4)', async () => {
  h.rows = [{ ...set('g', 'Global', null, [good(1)]), owner_id: 'other' }, { ...set('m', 'Mine', null, [good(1)]), owner_id: 'me' }];
  render(<QuizSets />);
  await screen.findByRole('link', { name: /Mine/ });
  const names = screen.getAllByRole('link').map((l) => l.getAttribute('href')).filter((href) => /\/games\/quiz\/[gm]$/.test(href ?? ''));
  expect(names).toEqual(['/games/quiz/m', '/games/quiz/g']);
});
```

If the set cards in that file are not links with those names, adapt the query to how the file's other tests find a set. Keep the assertion on order.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/QuizSets.test.tsx tests/findLevels.test.ts tests/spotLevels.test.ts`
Expected: the order tests and the column assertions FAIL.

- [ ] **Step 3: Implement the levels**

In `lib/spot/levels.ts`:

```ts
export async function fetchActiveLevels(): Promise<SpotLevel[]> {
  const me = await getMyUserId();
  const { data, error } = await familyOrGlobal(
    createSupabaseBrowserClient().from('spot_levels').select(COLUMNS).eq('active', true),
    me,
  )
    .order('sort_order')
    .order('created_at');
  if (error) throw new Error(error.message);
  return ownerFirst((data ?? []) as SpotLevel[], me);
}
```

Add `, owner_id` to `COLUMNS`. Do the same in `lib/find/levels.ts`, keeping `.filter(isPlayable)` before `ownerFirst`. Add `owner_id` to both types. Replace the `applyScope` import with the new imports.

- [ ] **Step 4: Implement the quiz page**

Add `owner_id?: string | null` to `Row`, and `owner_id` to the `select` string. Replace the effect body:

```ts
useEffect(() => {
  let live = true;
  void (async () => {
    const me = await getMyUserId();
    const { data } = await familyOrGlobal(
      createSupabaseBrowserClient()
        .from('quiz_sets')
        .select('id, title, subtitle, heading_color, cover_path, owner_id, questions(prompt_text, prompt_audio_path, answers(image_path, text, is_correct))')
        .eq('status', 'published'),
      me,
    ).order('position');
    if (!live) return;
    const rows = ownerFirst(((data as unknown as Row[]) ?? []).map((r) => ({ ...r, count: r.questions.filter(isComplete).length })).filter((r) => r.count > 0), me);
    setSets(rows);
    // keep the existing "done" code here, unchanged
  })();
  return () => { live = false; };
}, []);
```

- [ ] **Step 5: Run them to see them pass**

Run: `npx vitest run tests/QuizSets.test.tsx tests/findLevels.test.ts tests/spotLevels.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/games/quiz/page.tsx lib/find lib/spot tests/QuizSets.test.tsx tests/findLevels.test.ts tests/spotLevels.test.ts
git commit -m "feat: quiz, find and spot lists show family content first (FG2,FG4)"
```

## Task 15: Memory, Listen and Sort cards (FG5, FG6)

**Files:**
- Modify: `lib/memory/cards.ts:8-15`, `lib/sort/cards.ts:6-13`, `lib/memory/deck.ts:33`, `lib/listen/rounds.ts:36`, `lib/sort/rounds.ts:29`
- Test: `tests/memoryCards.test.ts`, `tests/sortCards.test.ts`, `tests/memoryDeck.test.ts`, `tests/listenRounds.test.ts`, `tests/sortRounds.test.ts`

**Interfaces:**
- Consumes: `familyOrGlobal`, `tagFamilyCards`, `pickFamilyFirst`, `getMyUserId`.
- `fetchActiveCards()` and `fetchSortCards()` keep their names and return types.

- [ ] **Step 1: Update mocks and add failing tests**

In `tests/memoryCards.test.ts` and `tests/sortCards.test.ts`, replace the `applyScope` mock with the same two mocks as Task 14. Add `, owner_id` to any asserted `select` string.

Add to `tests/memoryCards.test.ts`:

```ts
it('tags my cards and drops other cards with the same word (FG6)', async () => {
  h.result = { data: [
    { id: 'g', word: 'cat', image_path: 'x', audio_path: null, active: true, owner_id: 'other' },
    { id: 'm', word: 'Cat', image_path: 'x', audio_path: null, active: true, owner_id: 'me' },
  ], error: null };
  const out = await fetchActiveCards();
  expect(out.map((c) => c.id)).toEqual(['m']);
  expect(out[0].family).toBe(true);
});
```

Add to `tests/memoryDeck.test.ts`, where `card(id)` is a local helper returning an active `MemoryCard` (reuse the file's helper if it has one):

```ts
it('uses family cards first (FG5)', () => {
  const fam = Array.from({ length: 6 }, (_, i) => ({ ...card(`f${i}`), family: true as const }));
  const glo = Array.from({ length: 20 }, (_, i) => card(`g${i}`));
  const tiles = drawDeck([...glo, ...fam], 12);
  expect(new Set(tiles.map((t) => t.card.id))).toEqual(new Set(fam.map((c) => c.id)));
});
it('fills with global cards when the family has too few (FG5)', () => {
  const fam = [{ ...card('f0'), family: true as const }];
  const glo = Array.from({ length: 20 }, (_, i) => card(`g${i}`));
  const ids = new Set(drawDeck([...glo, ...fam], 12).map((t) => t.card.id));
  expect(ids.has('f0')).toBe(true);
  expect(ids.size).toBe(6);
});
```

Add to `tests/listenRounds.test.ts`, where `card(id, word)` is a local helper returning an active `MemoryCard` (reuse the file's helper if it has one):

```ts
it('asks about family cards first, and wrong choices may come from anywhere (FG5)', () => {
  const fam = [1, 2, 3].map((i) => ({ ...card(`f${i}`, `fam${i}`), family: true as const }));
  const glo = Array.from({ length: 20 }, (_, i) => card(`g${i}`, `glo${i}`));
  const qs = buildRounds([...glo, ...fam], Math.random, 3)!;
  expect(new Set(qs.map((q) => q.answer.id))).toEqual(new Set(['f1', 'f2', 'f3']));
});
```

Add to `tests/sortRounds.test.ts`, using the file's way of making cards in a group:

```ts
it('prefers groups with family cards (FG6)', () => {
  // family group "F" with 4 cards tagged family: true, global groups "G1" and "G2" with 4 cards each
  for (let i = 0; i < 10; i++) {
    const r = buildSortRound(cards)!;
    expect(r.baskets.map((b) => b.groupId)).toContain('F');
  }
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/memoryCards.test.ts tests/sortCards.test.ts tests/memoryDeck.test.ts tests/listenRounds.test.ts tests/sortRounds.test.ts`
Expected: the new tests FAIL. Older tests still pass, except for `applyScope`-related ones you already changed.

- [ ] **Step 3: Implement fetches**

`fetchActiveCards` and `fetchSortCards` follow the Task 14 pattern: `const me = await getMyUserId();`, `familyOrGlobal(<query>, me)`, add `owner_id` to `select`, keep `.order('created_at')`, and return `tagFamilyCards((data ?? []) as MemoryCard[], me)`.

- [ ] **Step 4: Implement selection**

- `lib/memory/deck.ts:33`: `const chosen = pickFamilyFirst(active, pairs, rng);`
- `lib/listen/rounds.ts:36`: `const answers = pickFamilyFirst(pool, Math.min(max, pool.length), rng);`. Leave the wrong-choice code unchanged.
- `lib/sort/rounds.ts:29`:

```ts
const usable = usableGroups(cards);
const isFamily = (g: { cards: readonly MemoryCard[] }) => g.cards.some((c) => c.family);
const groups = [...shuffle(usable.filter(isFamily), rng), ...shuffle(usable.filter((g) => !isFamily(g)), rng)];
```

Keep the rest. The local `shuffle` in each file stays for its other uses.

`levelsAvailable` needs no change, because the Memory page passes `cards.length` after de-duplication.

- [ ] **Step 5: Run them to see them pass**

Run: `npx vitest run tests/memoryCards.test.ts tests/sortCards.test.ts tests/memoryDeck.test.ts tests/listenRounds.test.ts tests/sortRounds.test.ts tests/MemoryLevels.test.tsx`
Expected: PASS, including the older tests with a fixed `rng`.

Then run: `npm test`
Expected: PASS. If a page test fails because `auth` is undefined on its fake Supabase client, add the two mocks from Task 14, Step 1 to that test file.

- [ ] **Step 6: Commit**

```bash
git add lib/memory lib/sort lib/listen tests
git commit -m "feat: memory, listen and sort use family cards first (FG5,FG6)"
```

## Task 16: Remove the filter, docs, final checks (FG1, FT4)

**Files:**
- Delete: `components/games/ScopeSwitch.tsx`, `tests/ScopeSwitch.test.tsx`
- Modify: `app/games/page.tsx:17,133`, `lib/review.ts:57-63`, `tests/ReviewUi.test.tsx:11,94-98`, `e2e/multiuser.spec.ts:99-103`, `docs/superpowers/specs/2026-11-04-multi-user-phase3-design.md:103`
- Test: `tests/GamesPage.test.tsx`, `e2e/family-first.spec.ts` (create)

- [ ] **Step 1: Add a failing test to `tests/GamesPage.test.tsx`**

```tsx
it('has no family or everyone switch (FG1)', () => {
  render(<Games />);
  expect(screen.queryByRole('group', { name: 'Which games' })).toBeNull();
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/GamesPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Remove the code**

- `app/games/page.tsx`: remove the `ScopeSwitch` import and `<ScopeSwitch />`.
- Delete the component and its test:

```bash
git rm components/games/ScopeSwitch.tsx tests/ScopeSwitch.test.tsx
```

- `lib/review.ts`: delete `Narrowable` and `applyScope`. Keep `Scope`, `getStoredScope` and `useContentScope`, which the admin tabs use.
- `tests/ReviewUi.test.tsx`: remove `applyScope` from the import and delete the test at lines 94-98.
- `e2e/multiuser.spec.ts:99-103`: replace with:

```ts
// The child app has no family or everyone switch: approved content is simply listed.
const child = await signedOut(browser);
await signInOnDevice(child);
await pickChild(child);
await expect(child.getByRole('button', { name: /everyone/i })).toHaveCount(0);
```

Then confirm nothing is left: `grep -rn "applyScope\|ScopeSwitch" app components lib tests e2e`
Expected: no output. Remove leftovers only if they are references to these names.

- [ ] **Step 4: Add `e2e/family-first.spec.ts`**

Use the same signed-in setup and `pickChild` as `e2e/find-levels.spec.ts`. Copy the level row shape from that file and from `e2e/spot-levels.spec.ts`:

```ts
test('family levels are listed before global levels (FG4)', async ({ page }) => {
  await reset({ find_levels: [
    { ...LEVEL, id: GLOBAL_ID, sort_order: 0, owner_id: 'someone-else', visibility: 'global' },
    { ...LEVEL, id: FAMILY_ID, sort_order: 1, owner_id: ACCOUNTS.parent.id, visibility: 'private' },
    { ...LEVEL, id: HIDDEN_ID, sort_order: 2, owner_id: 'someone-else', visibility: 'private' },
  ] });
  await page.goto('/games/find');
  const hrefs = await page.locator('a[href^="/games/find/"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  expect(hrefs).toEqual([`/games/find/${FAMILY_ID}`, `/games/find/${GLOBAL_ID}`]);
});
```

Add the same test for Spot with `spot_levels`, and for Quiz with `quiz_sets` and `/games/quiz/` if the row shape is available in `e2e/games.spec.ts`. The rows must be valid UUIDs if existing rows use them. `HIDDEN_ID` proves the explicit filter hides another family's private row.

- [ ] **Step 5: Update the N6 requirement**

In `docs/superpowers/specs/2026-11-04-multi-user-phase3-design.md:103`, append: `(Changed by parent feedback spec FG1: the content switch is removed; the family's and global content are listed together, the family's first.)`

- [ ] **Step 6: Run all checks**

Run: `npm run typecheck && npm run lint && npm test && npm run test:rls && npm run build && npm run e2e`
Expected: all pass. Run `graphify update .`

- [ ] **Step 7: Commit**

```bash
git add -A app/games/page.tsx components/games lib/review.ts tests e2e docs/superpowers/specs/2026-11-04-multi-user-phase3-design.md
git commit -m "feat: remove the family and everyone switch from the game list (FG1)"
```

## Task 17: Report to the owner

- [ ] **Step 1: List the branches**

Run: `git log --oneline claude/children-table..claude/feedback-4-game-list`
Expected: all commits from this plan.

- [ ] **Step 2: Report**

Tell the owner, in Vietnamese:
- The four branch names, in order: `claude/feedback-1-admin-ui`, `claude/feedback-2-sign-in`, `claude/feedback-3-play`, `claude/feedback-4-game-list`.
- The result of each final check, with any failure quoted.
- Any page changed in Task 11 and anything odd in the screenshots.
- Owner action before deploying: add `/play/sign-in` to the Supabase Auth Redirect URLs (FS7).
- Ask whether to push the branches and open the PRs. Do not do this without a yes.
