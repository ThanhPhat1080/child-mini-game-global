---
name: generating-tts-audio
description: Use when asked to create, generate or record voice lines, audio, TTS or mp3 files for questions or prompts, such as "Which is the letter A?" for A to Z, colors, numbers or animals.
---

# Generating TTS audio

Turns a list of phrases into one mp3 per phrase with `scripts/generate_tts.py` (edge-tts, no Supabase). Output goes to `text-to-speech-out/` (gitignored). The user uploads the files in the admin page; do not upload them yourself.

## Steps

1. Build the phrase list from the user's pattern, for example `Which is the letter {X}?` over A-Z. Ask only if the wording or the set is unclear.
2. Write `scripts/tts-input-<topic>.json` (new file, never overwrite `tts-input-template.json`). Generate it with Python instead of typing it out:

```bash
python3 -c "
import json,string
v=[{'name':f'which-letter-{c.lower()}','text':f'Which is the letter {c}?'} for c in string.ascii_uppercase]
open('scripts/tts-input-letters.json','w').write(json.dumps({'voices':v},indent=2)+'\n')"
```

3. Run it:

```bash
npm run tts -- scripts/tts-input-<topic>.json
```

If `scripts/.venv` is missing, run `npm run tts:setup` once first.

4. Report the count and the output folder (full path). Existing files are skipped; add `--force` to remake them.

## Quick reference

| Need | Command |
|---|---|
| Slower (better for a 4-5 year old) | `npm run tts:slow -- <json>` (out: `text-to-speech-out/slow`) |
| Faster | `npm run tts:fast -- <json>` |
| Other voice or speed | `--voice en-US-AnaNeural`, `--rate -20%`, `--pitch +0Hz` |
| List voices | `npm run tts:voices` |
| Per-item override | add `"voice"`, `"rate"`, `"pitch"` to that item |

Each item needs `text`; give it a `name` (no `.mp3`) so files get readable names instead of hash slugs. Details: `scripts/tts_Readme.md`.

## Common mistakes

- A bare letter can be read as a word. "A" may sound like the article "uh". Tell the user to listen to the files for such letters and fix that entry's text (for example "ay") if it sounds wrong.
- Child-facing text must not be hard-coded in the app (CLAUDE.md); these files are only audio the admin uploads.
- Do not commit `text-to-speech-out/`. The input JSON may be committed only if the user asks.
