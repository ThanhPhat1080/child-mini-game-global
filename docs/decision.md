# Architecture & Design Decision Records (ADR)

## ADR-001: Choosing Web-Based Architecture over Native TV Apps
* **Status:** Amended by ADR-028 (2026-10-28): the target is a computer browser, not Smart TV browsers.
* **Context:** The app needs to run across multiple Smart TV brands (LG webOS, Samsung Tizen, Sony Android TV) while supporting rapid iteration and centralized database integration.
* **Decision:** Build a web-based application instead of native platform SDK apps.
* **Rationale:** Web standards provide cross-platform compatibility, eliminate complex app-store approval processes, and allow instant updates via cloud deployments.

## ADR-002: Selecting Phaser.js over Unity WebGL
* **Context:** The target devices include Smart TVs with limited RAM and processing power (especially older LG/Samsung models). 
* **Decision:** Use Phaser.js for 2D mini-game rendering.
* **Rationale:** Unity WebGL builds result in heavy asset bundles and high memory consumption, often causing lag on TV browsers. Phaser.js is lightweight, highly optimized for 2D casual games, loads instantly, and runs smoothly on low-spec TV hardware.

## ADR-003: Server-Enforced Session Limits with a Graceful Princess Lock Screen
* **Status:** Dropped (2026-10-29, ADR-029). Kept for history.
* **Context:** Children need clear boundaries on screen time, but abrupt cuts cause frustration and emotional distress.
* **Decision:** Implement a 1-hour play limit / 3-hour cool-down governed by server timestamps, paired with a graceful "Rest Screen" featuring an animated princess.
* **Rationale:** Storing session checkpoints on the server prevents local client manipulation (like clearing cache), while the gentle princess visual maintains a positive, nurturing emotional experience for a 4-5-year-old.

## ADR-004: King Arthur's 4-Digit PIN Override Mechanism
* **Status:** Dropped (2026-10-29, ADR-029). Kept for history.
* **Context:** Parents need a quick way to bypass the 3-hour lock when necessary, using only a TV remote control.
* **Decision:** Implement a simple grid-based 4-digit PIN pad branded as "King Arthur's Magic PIN".
* **Rationale:** Keeps parental control secure against a 4-year-old while remaining simple to operate via remote navigation without requiring a physical keyboard.

## ADR-005: JSON-Driven Dynamic Level Configuration for Mini-Games
* **Context:** The "Spot the Differences" mini-game and future expansion games will require frequent content updates.
* **Decision:** Store level configurations (image assets, coordinate hotspots, metadata) as JSON structures retrieved from Supabase.
* **Rationale:** Separates game code from content data, allowing new levels to be added effortlessly without rewriting or rebuilding the frontend application.

## ADR-006: Adopting "Calm & Slow Gaming" & Ghibli Aesthetic Principles
* **Context:** Modern digital products for children often rely on high-stimulation designs, flashy neon colors, and rapid animations that can induce sensory overload or unwanted hyperactivity. The creator desires a wholesome, low-stress experience reminiscent of simple 8x/9x retro games.
* **Decision:** Enforce a strict design system utilizing desaturated Ghibli-inspired pastel color palettes, smooth minimal animations, quiet ambient loop music, and gentle feedback loops ("Hooray" with slow pastel confetti, mild "Oh-oh").
* **Rationale:** Protects the child from sensory fatigue, encourages deep focus, promotes calm interaction, and mirrors the pure, unpretentious charm of classic games from the 8x/9x era.

## ADR-007: Remote Number Pad Shortcuts for Toddler Accessibility
* **Context:** Navigating complex UI layouts with arrow keys on a TV remote can frustrate a 4-5-year-old child who cannot yet read.
* **Decision:** Implement direct remote number shortcut mapping (e.g., pressing `1`, `2`, `3` corresponding to labeled answer choices).
* **Rationale:** Drastically simplifies interaction, minimizes cognitive load, and leverages the physical number keys on standard TV remotes for instant, satisfying responses.
## ADR updates (2026-10-25)

### Amendments to existing ADRs

- **ADR-002 (Phaser.js):** applies from Phase 2 (Spot the Differences) only. The Phase 1 quiz uses React/DOM (see ADR-014).
- **ADR-003 (play time tracked on the server):** dropped (ADR-029).
- **ADR-004 (King Arthur PIN):** dropped (ADR-029).
- **ADR-005 (Supabase):** confirmed. Firebase is not used (see ADR-008).
- **ADR-007 (number keys 1/2/3):** each answer also shows an image and a color, because the child cannot read numbers yet.

## ADR updates (2026-10-28, Phase 1 closed)

- **ADR-007, ADR-018:** the keys 1/2/3, Left/Right arrows, Enter, Space and Esc are the child's laptop keyboard controls (arrows move between choices; Enter or Space picks). They are a supported requirement, no longer "TV remote" keys. Shared helper: `lib/keynav.ts`.
- **ADR-012:** superseded by ADR-028. No webOS or TV testing.
- **ADR-014, 015, 016:** accepted (built and in use in Phase 1).
- **ADR-025:** the answer images fill the card width (`object-fit: contain`). The question image frame is a 300x300 square (ADR-032); the older 600x300, 4:3 and 400x300 figures are obsolete.
- **ADR-002:** Phaser stays the plan for the next games. **ADR-003, 004, 010, 011** (play limit, rest screen, PIN) are dropped, see ADR-029.

### ADR-028: Computer browser is the target platform

- **Status:** Accepted (2026-10-28, PO decision)
- **Context:** Hà My plays on a computer; casting it to the TV already works well enough.
- **Decision:** Support the latest Chromium-based desktop browsers. Do not test or design for LG webOS, other Smart TV browsers or the Magic Remote. Remove TV requirements from the spec and plan.
- **Consequences:** Supersedes ADR-012. ADR-001's TV rationale no longer drives choices. Existing code (keyboard shortcuts, large buttons, `browserslist`, the scaled 1920x1080 stage) stays because it still works; nothing is built for TVs from now on.

### ADR-008: Use Supabase as the backend

- **Status:** Accepted
- **Context:** The Intent file says "Supabase / Firebase" but no choice had been made.
- **Decision:** Use Supabase (Postgres, Storage, Auth).
- **Consequences:** Remove Firebase from the documentation. Manage the schema with migrations.

### ADR-009: One deployment per child

- **Status:** Accepted
- **Context:** The app must be reusable for other children while staying simple.
- **Decision:** Same source code. Each child gets one Supabase project and one Vercel URL. Configuration comes from environment variables. Content (child's name, greeting, music, quiz sets) lives in the database and Storage.
- **Consequences:** No multi-tenant setup or profiles. Requires a reusable setup README and migrations.

### ADR-010: Play sessions do not identify the user

- **Status:** Dropped (2026-10-29, ADR-029): there is no session table any more
- **Context:** One child plays on one device.
- **Decision:** Each deployment has a single session row in the database.
- **Consequences:** Simpler design. The server still stores timestamps, so clearing the cache cannot reset play time.

### ADR-011: Keep the 4-digit PIN for the MVP

- **Status:** Dropped (2026-10-29, ADR-029)
- **Decision:** Keep the 4-digit PIN. Store a hash in the database and check it with a Postgres function (RPC). The PIN never appears in the frontend.
- **Consequences:** Weak protection, but adequate for the MVP. A limit on failed attempts can be added later.

### ADR-012: Chromium first, webOS later

- **Status:** Superseded by ADR-028 (2026-10-28)
- **Decision:** Phase 1 runs on Chromium. (Original plan: test by casting a MacBook to the TV; webOS in Phase 2. Dropped.)
- **Consequences:** Avoid very new JavaScript features is no longer a requirement.

### ADR-013: Admin dashboard inside the app

- **Status:** Accepted
- **Context:** Parents need to upload music and the greeting and enter questions with images themselves.
- **Decision:** Build the admin pages into the app rather than using the Supabase Dashboard.
- **Consequences:** Needs tickets for sign-in, media upload, and the question editor.

### ADR-014: Build the quiz with React/DOM

- **Status:** Accepted
- **Decision:** The quiz uses React and CSS, not Phaser. Phaser starts in Phase 2.
- **Consequences:** Light to load, and large tap targets and simple animations are easy to build. The hub needs a game registry so Phaser games can be added later.

### ADR-015: Admin sign-in with Supabase Auth

- **Status:** Accepted
- **Decision:** Parents sign in with email and password. The child's page needs no sign-in and only reads content. Write access is limited to admin accounts (RLS).
- **Consequences:** The service role key must never be included in the frontend.

### ADR-016: "Tap to enter" gate for audio

- **Status:** Accepted
- **Context:** Chromium blocks audio from playing automatically until the user interacts with the page.
- **Decision:** The Welcome screen has a large "tap to enter" button. Pressing it plays the greeting and background music, then shows the "Start game" button.
- **Consequences:** Needs a shared audio manager for background music, voice, and sound effects.

### ADR-017: Fonts for Vietnamese and English

- **Status:** Accepted
- **Context:** Names and labels contain Vietnamese diacritics; many display fonts render them badly.
- **Decision:** Child UI uses Baloo 2 (rounded, full Vietnamese support). Admin uses Nunito. Self-host the font files so the app does not depend on a CDN.
- **Consequences:** Check diacritics on every new screen.

### ADR-018: Game list is a carousel with four input methods

- **Status:** Accepted
- **Decision:** Left/Right keys, mouse click-and-hold drag, arrow buttons and dots all move the game list. A drag must not trigger a click on the card underneath.
- **Consequences:** Needs a click-versus-drag threshold and focus handling for the keyboard.

### ADR-019: Answer slot colors are fixed by position

- **Status:** Accepted
- **Decision:** Answer 1 is rose, 2 is sky, 3 is butter, always, plus the number and the image. The admin does not choose answer colors.
- **Consequences:** Extends ADR-007. Color, number and key always match, so the child learns them.

### ADR-020: Quiz set presentation and theming

- **Status:** Accepted
- **Decision:** A set has a name, an optional sub-title written by the admin (no default text, nothing hard-coded in Vietnamese), a cover image, and a heading color (6 presets plus a custom color picker). The cover tint is derived from the heading color. The card shows a question-count pill and a star when finished. The editor warns on low-contrast colors.
- **Consequences:** `quiz_sets` stores `subtitle` and `heading_color`.

### ADR-021: Feedback is gentle and slow

- **Status:** Accepted
- **Decision:** Correct answer: slow pastel confetti burst and "Hooray!". Wrong answer: a soft "Oh-oh" and the child tries again; nothing is removed, no timer. All motion is disabled or reduced under `prefers-reduced-motion`.
- **Consequences:** Implements ADR-006 for the quiz.

### ADR-022: Admin destructive actions need confirmation; preview before publish

- **Status:** Accepted
- **Decision:** Deleting a set or a question always shows a confirmation popup. Questions are deleted from the editor panel only (no trash icon in the list). "Preview as child" is enabled after the set is saved and works on drafts, so the parent can check without publishing.
- **Consequences:** `quiz_sets.status` is `draft` or `published`; the child only sees published sets.

### ADR-023: Admin list shows a front-page preview

- **Status:** Accepted
- **Decision:** The set list shows a strip that mirrors the child's selection screen, and the add-question form shows a completeness checklist (question text or audio, 2-3 images, one correct answer).
- **Consequences:** The child set card is one shared component used by both the child app and the admin preview.

### ADR-024: Question image with size limits

- **Status:** Superseded by ADR-032 (2026-10-31). The 600x300 frame and "recommended 600x300 px" are obsolete.
- **Decision:** A question may have a prompt image, shown in a small fixed 600x300 frame beside the question text, fitted (never cropped or stretched). Admin upload accepts PNG, JPG or WebP up to 2 MB; recommended 600x300 px. The image is optional and does not block completeness; it appears in the checklist.
- **Consequences:** Validate type and size on upload (client and Storage policy). Resize or compress large images before storing. `questions.prompt_image_path` is used.

### ADR-025: Question screen layout in three bands

- **Status:** Accepted
- **Decision:** Header (back, progress dots), question row (image frame 400x300, replay-voice button, text), answer row (cards 460x400). No overlapping elements at 1920x1080; the wrong-answer message sits below the cards.
- **Consequences:** Answer art must fit about 260 px.

### ADR-026: Set-completed celebration

- **Status:** Accepted
- **Decision:** Reuse the correct-answer confetti burst, denser (about 140 pieces in waves), plus the chibi girl image on the left. Party horns were tried and rejected. Character images are transparent cut-outs shown at native size to avoid blur.
- **Consequences:** Keep one shared confetti component; honor `prefers-reduced-motion`.

### ADR-027: Next.js + React + TypeScript as the app framework

- **Status:** Accepted (2026-10-26)
- **Context:** The framework was open between Vite + React and Next.js (spec section 9, `docs/intent.md` open questions).
- **Decision:** Build the app with Next.js, React and TypeScript, deployed on Vercel. The child app and the admin dashboard live in the same Next.js project.
- **Consequences:** Browser-exposed env vars need the `NEXT_PUBLIC_` prefix; only the Supabase URL and anon key may use it, never the service role key (ADR-015). Keep the child pages light. ADR-014 still applies: the quiz is React/DOM, Phaser only in Phase 2.

### ADR-029: Phase 2 is only more games; wellbeing controls dropped

- **Status:** Accepted (2026-10-29, PO decision)
- **Context:** The intent had a play-time limit with a rest period, a princess rest screen and a parental PIN override. The PO decided the child does not need them.
- **Decision:** Remove "Session Management & Digital Wellbeing" and "Parental Override (King Arthur's PIN)" from the product. Phase 2 only adds games on the game registry.
- **Consequences:** ADR-003, 004, 010 and 011 are dropped. No session table, no PIN function and no rest screen are built. Calm & Slow principles (ADR-006) still apply to every new game. If limits are wanted later, start again with a new ADR.

### ADR-030: Phase 2 games use HTML/CSS first; Phaser only as a last resort

- **Status:** Accepted (2026-10-29, PO decision)
- **Context:** ADR-002 and ADR-005 planned Phaser for Phase 2 games. Quiz already works well as React + CSS (ADR-027), and Memory Match (cards, flips, a grid) needs no game engine.
- **Decision:** New games are built with React + CSS (DOM) like Quiz. Phaser (ADR-002) is used only if a game cannot be built well with HTML/CSS.
- **Consequences:** Memory Match is DOM-based. A game that wants Phaser must justify it in its own spec first. ADR-014 (game registry) and ADR-006 (Calm & Slow) still apply to every game.

### ADR-031: removeMedia keeps files other records still reference

- **Status:** Accepted (2026-10-30)
- **Context:** Pictures and sounds can be reused from the `media` bucket (Find It object sounds and pictures, Memory Match cards, Spot pictures, quiz answers), so one file may be used by several records. Deleting a file that another record still points to would break that record.
- **Decision:** `removeMedia` checks every media column that can point to a file (cards, spot levels, find levels, quiz answers and question images, settings) before deleting. A path that is still referenced is kept. If the check itself fails, every file is kept and the save does not fail.
- **Consequences:** The check needs the `find_levels` table, so migration `20261030120000_find_levels.sql` must be applied before the Find It admin or game is released. Every new media column or table must be added to the check.

### ADR-032: Every admin picture is a square

- **Status:** Accepted (2026-10-31, PO decision). Supersedes ADR-024.
- **Context:** Pictures appear in many frames (question, answers, cards, covers, avatar, Spot and Find boards, level thumbnails). Mixed shapes broke the layout, and Spot and Find pictures were required to be landscape.
- **Decision:** Every bitmap picture (PNG, JPG, WebP) uploaded in the admin is cropped to a square in a crop window before it is stored (A24). The original may be up to 20 MB (phone photos often exceed 2 MB); the crop is saved as WebP at most 1024 px per side at quality 0.8, and the cropped result must be 2 MB or smaller. Spot picture B uses picture A's crop (A25). Pictures uploaded before this change are not re-cropped; they are shown fitted in the square frame (A26). SVG files are not cropped. The Quiz question frame is 300x300. Spot and Find boards and the level thumbnails are square.
- **Consequences:** Landscape and tall-picture warnings in the Spot editor are removed for new uploads; the 2% A/B aspect warning stays. `MediaLibraryDialog` is the one upload path that crops. Spot and Find pictures that were uploaded before this change keep their shape and are shown inside the square frame.
