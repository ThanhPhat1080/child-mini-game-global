# Intent: Kid-Friendly Interactive Web Gaming Hub

## 1. Overview & Vision
A personalized, safe, web-based gaming platform built specifically for a 4-5-year-old child (Hà My) who cannot yet read. The application runs in a computer browser (the child plays on a computer; the screen can be cast to a TV, see ADR-028), combining a friendly, customized UI with calm, gentle games chosen by the parent, so the child plays in a safe, toxic-free environment.

## 2. Target Audience & Personas & Creator Philosophy
* **Primary User (The Child):** Hà My (4-5 years old). Needs ultra-simplified UI ("Mega Buttons"), large click targets, visual/auditory feedback (anime princess graphics, personalized audio greetings), and zero negative reinforcement (no punishment for wrong answers).
* **Secondary User (The Parent):** Looking for a safe environment where they can add and update games and content themselves, without touching code.
* **Creator Philosophy (Calm & Slow Gaming):** Inspired by the innocent, straightforward nature of 8x/9x retro games, the webapp strictly avoids over-hyped, flashy, high-stimulation elements (such as neon colors, rapid jarring animations, and loud sensory overload). The goal is to cultivate a **calm, focused, and stress-free cognitive environment** that prevents unwanted hyperactivity and screen fatigue.

## 3. Core Functional Requirements & Aesthetic Principles
* **Personalized Onboarding:** Load custom anime princess artwork, user avatar, and an automated voice greeting ("Hà My ơi...") fetched from Supabase storage upon initial page load.
* **Aesthetic & Sensory Design (Ghibli & Minimalist Style in 2D):**
  * **Color Palette:** Desaturated, warm pastel tones (soft warm cream, muted pinks, soft peach, gentle yellows) avoiding high-saturation neon glare to protect eyes and maintain deep focus.
  * **Audio Experience:** Continuous, gentle, lofi/acoustic instrumental background music (Studio Ghibli style) with soft, comforting feedback sounds (gentle "Hooray" with slow pastel confetti, mild "Oh-oh" for wrong attempts without harsh penalties).
* **Intuitive Input:** Mouse clicks plus direct **number key shortcuts** on the keyboard (e.g., pressing `1`, `2`, `3` to answer questions instantly).
* **Extensible Mini-Game Hub (more games are Phase 2):** A modular game registry (ADR-014) so new mini-games can be added one by one; Phaser.js is the plan for canvas games (starting with "Spot the Differences").

## 4. Technical Architecture & Tech Stack
* **Frontend Hub & Shell:** Next.js + React + TypeScript (see ADR-027; DOM/CSS for the Phase 1 quiz, see ADR-014) for routing and splash screens.
* **Game Engine:** Phaser.js 2D for lightweight, high-performance canvas rendering for the next mini-games.
* **Backend & Database:** Supabase (Postgres, Storage, Auth; Firebase is not used, see ADR-008) for storing child profile metadata and dynamic mini-game content (JSON-driven levels).
* **Deployment & Delivery:** Web-based deployment (Vercel/Netlify), accessed in a computer browser.

## Phasing (updated 2026-10-29)

**Phase 1 is closed (2026-10-28).** Phase 2 is only "more games". The play-time limit, rest screen and PIN were dropped on 2026-10-29 (ADR-029). See `plan.md` sections 4-5.

### Phase 1: MVP (build first)

**Goal:** Hà My can finish a full quiz set with images. Parents update the content themselves without touching code.

**In scope:**

- **Welcome screen**: a large "tap to enter" button (so the browser allows audio to play), a greeting sound, background music uploaded by the parent, and a "Start game" button.
- **Game list**: shows only the Quiz game. The structure is ready for more games in Phase 2.
- **Quiz**: the child picks a quiz set and answers one question at a time. Each of the 2-3 answers is an image with a number and a color (mouse, or keys 1-3). A correct answer gets praise and a gentle effect. A wrong answer lets the child try again. No penalty, no timer.
- **Admin dashboard** (parent signs in): upload the greeting and background music, enter the child's name, create and edit quiz sets, and add questions with image answers and optional question audio.
- **Reuse for other children**: same source code, one Supabase project and one deployment URL per child. Only environment variables change. Set up an admin and enter content by following the setup README.
- **Platform:** web on a computer browser (Chromium). Casting to a TV works but is not a requirement (ADR-028).

**Out of scope for Phase 1:** any other game (Spot the Differences etc.).

**Definition of done (proposed, adjust as needed):**

- The child goes from Welcome to the end of a quiz set without anyone reading text to her.
- A parent creates a new quiz set (at least 5 questions) in under 10 minutes.
- A second child's deployment can be set up from the README alone, without code changes.

### Phase 2 (redefined 2026-10-29: only more games)

- Add more mini-games to the game registry. First candidate: Spot the Differences (Phaser.js, levels stored as JSON, a tool to pick hotspot coordinates). The exact list of games is decided in the Phase 2 brainstorm.
- Dropped for good: play-time limit and rest period, rest screen, parental PIN override (ADR-029).

### Design constraints (input for Claude Design)

- The child is 4-5 and cannot read yet, so no screen requires reading. All navigation uses pictures, color, and sound.
- Keep the pastel palette and the "Calm & Slow Gaming" feel described above.
- Designed on a 1920x1080 canvas scaled to the window: large buttons and click targets, generous spacing.
- Screens to mock for Phase 1: Welcome, Game list, Quiz set selection, Question, Correct/wrong feedback, Set completed, and four admin pages (sign-in, settings, quiz set list, question editor).

## Design outcomes from the prototype (2026-10-25)

The Phase 1 prototype (Claude Design canvas, 12 boards) is approved by the owner. Details: `spec.md`. Prototype: https://claude.ai/artifact/L1YRtj4NVFe6NewZ3w2s4E

- **Welcome:** keeps the layout, adds a 2D anime chibi princess (left side) waving. Tap to enter, then greeting, then Start.
- **Language and fonts:** UI must support Vietnamese and English. Child UI uses Baloo 2, admin uses Nunito. No Vietnamese text is hard-coded in the child UI; wording shown to the child is decided by the admin.
- **Game list:** a carousel. Left/Right keys, mouse click-and-hold drag, arrow buttons and dots all move it.
- **Quiz set selection:** each set shows cover image, name (in the set's heading color), optional admin sub-title, a question-count pill and a star when finished, so the child and parent can choose without reading.
- **Question:** 2-3 picture answers, each with a number and a fixed color by position (1 rose, 2 sky, 3 butter). Separate states: question, wrong (gentle retry), correct (slow pastel confetti "Hooray!").
- **Admin:** sign-in, settings, quiz set list with a live preview of how each set looks on the front page, set editor (name, sub-title, heading color presets plus custom picker, cover with preview, questions), add-question flow with a completeness checklist, delete set / delete question with a confirmation popup, and "Preview as child" that works on a saved draft without publishing.
- **Question image:** each question can show a picture above the answers (small 600x300 frame, image fitted not cropped; changed from 4:3 in ADR-024). The admin question editor has an upload field with limits: PNG/JPG/WebP/SVG, up to 2 MB, best at 600x300 px.
- **Layout (Question):** three bands, header, question row (image + replay-voice button + text), answers. Nothing overlaps.
- **Set completed:** 2D chibi girl with a camera (left side) and a large Hooray confetti burst, same effect as the correct-answer screen but denser. No party horns.
- **Motion:** slow; respects `prefers-reduced-motion`.

## Open questions

- ~~Star progress: localStorage or database?~~ Decided: localStorage (no user identification).
- ~~App framework: Vite + React vs Next.js.~~ Decided 2026-10-26: Next.js + React + TypeScript (ADR-027).
