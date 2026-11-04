import { newQuestion, type EQuestion } from '@/lib/sets';

export const IMPORT_MAX_QUESTIONS = 50;
export const IMPORT_MAX_BYTES = 1024 * 1024;
const MAX_TEXT = 200;
const MAX_URL = 2000;

export type ImportResult = { questions: EQuestion[]; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export const SVG_MAX_CHARS = 30000;

/** Removes what may legally come before <svg>: an <?xml ?> line, comments and a simple DOCTYPE (no internal subset). */
function stripProlog(raw: string): string {
  let s = raw.trim();
  for (;;) {
    const next = s
      .replace(/^<\?xml[^>]*\?>\s*/i, '')
      .replace(/^<!--[\s\S]*?-->\s*/, '')
      .replace(/^<!DOCTYPE[^\[>]*>\s*/i, '');
    if (next === s) return s;
    s = next;
  }
}

/** True when the text is raw SVG code (starts with <svg, optionally after an <?xml ?> line, comments or a DOCTYPE). */
export const isInlineSvg = (s: string): boolean => /^\s*<(svg[\s>]|\?xml|!doctype|!--)/i.test(s);

/**
 * Checks raw SVG code and returns it cleaned (one line, xmlns added when missing).
 * SVG is only ever shown through <img>, where scripts do not run, but unsafe parts are rejected anyway.
 */
export function checkSvg(raw: string): { svg: string } | { error: string } {
  let s = stripProlog(raw).replace(/&nbsp;/g, '&#160;'); // the one HTML entity designers' tools often leave in
  if (s.length > SVG_MAX_CHARS) return { error: `SVG code is longer than ${SVG_MAX_CHARS.toLocaleString('en-US')} characters (minify it first, for example with SVGO)` };
  if (!/<\/svg>\s*$/i.test(s)) return { error: 'SVG code must end with </svg>' };
  if (/<!DOCTYPE|<!ENTITY/i.test(s)) return { error: 'SVG code may not contain a DOCTYPE with extra definitions or ENTITY declarations' };
  if (/<script|<foreignObject|<iframe|<embed|<object|javascript:|@import/i.test(s)) return { error: 'SVG code may not contain scripts, foreignObject or embedded content' };
  if (/\son[a-z]+\s*=/i.test(s)) return { error: 'SVG code may not contain event handlers such as onclick' };
  if (/href\s*=\s*(["'])\s*data:/i.test(s)) return { error: 'SVG code may not embed pictures (data: links); draw shapes instead, or upload the picture as a PNG/JPG/WebP' };
  if (/href\s*=\s*(["'])\s*(?!#)/i.test(s) || /url\(\s*["']?\s*(?!#)/i.test(s)) return { error: 'SVG code may not link to other files or web addresses (only #id references are allowed)' };
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(s, 'image/svg+xml');
    if (doc.getElementsByTagName('parsererror').length || doc.documentElement?.localName !== 'svg') return { error: 'SVG code is not valid XML (check the quotes and closing tags; HTML entities such as &copy; are not allowed, use the character itself)' };
  }
  if (!/^<svg\b[^>]*\sxmlns\s*=/i.test(s)) s = s.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  // identical drawings must produce identical text, so they can share one file
  return { svg: s.replace(/\s+/g, ' ').replace(/>\s+</g, '><') };
}

/** Blank means "upload later". Otherwise an https:// link or raw SVG code. Returns the cleaned value or an error. */
export function readImage(v: unknown): { value: string | null } | { error: string } {
  if (v === undefined || v === null) return { value: null };
  if (typeof v !== 'string') return { error: 'image must be text (a link or SVG code) or left blank' };
  const s = v.trim();
  if (!s) return { value: null };
  if (isInlineSvg(s)) {
    const r = checkSvg(s);
    return 'error' in r ? r : { value: r.svg };
  }
  if (/^http:\/\//i.test(s)) return { error: 'image link must start with https:// (http:// links are blocked by browsers)' };
  if (!/^https:\/\//i.test(s)) return { error: 'image must be blank, a link starting with https://, or SVG code starting with <svg' };
  if (s.length > MAX_URL) return { error: 'image link is too long' };
  try { new URL(s); } catch { return { error: 'image link is not a valid address' }; }
  return { value: s };
}

function readText(v: unknown, label: string, errors: string[]): string {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string') { errors.push(`${label}: text must be a string`); return ''; }
  const s = v.trim();
  if (s.length > MAX_TEXT) errors.push(`${label}: text is longer than ${MAX_TEXT} characters`);
  return s;
}

/** Parses and validates a quiz-template.json file. Nothing is returned for import when there is any error. */
export function parseQuizImport(text: string): ImportResult {
  let root: unknown;
  try { root = JSON.parse(text); } catch (e) {
    return { questions: [], errors: [`This is not valid JSON (${(e as Error).message}).`] };
  }
  const list = Array.isArray(root) ? root : isObj(root) ? root.questions : undefined;
  if (!Array.isArray(list)) return { questions: [], errors: ['The file needs a "questions" list.'] };
  if (list.length === 0) return { questions: [], errors: ['The "questions" list is empty.'] };
  if (list.length > IMPORT_MAX_QUESTIONS) return { questions: [], errors: [`Too many questions (${list.length}). Import up to ${IMPORT_MAX_QUESTIONS} at a time.`] };

  const errors: string[] = [];
  const questions: EQuestion[] = [];
  list.forEach((raw, qi) => {
    const ql = `Question ${qi + 1}`;
    if (!isObj(raw)) { errors.push(`${ql}: must be an object with "text" and "answers".`); return; }
    const q = newQuestion();
    q.text = readText(raw.text, ql, errors);
    const qimg = readImage(raw.image);
    if ('error' in qimg) errors.push(`${ql}: ${qimg.error}`); else q.qimg = qimg.value;
    if (raw.readAnswersAloud !== undefined) {
      if (typeof raw.readAnswersAloud === 'boolean') q.readAnswers = raw.readAnswersAloud;
      else errors.push(`${ql}: readAnswersAloud must be true or false`);
    }
    if (raw.hideAnswerText !== undefined) {
      if (typeof raw.hideAnswerText === 'boolean') q.hideAnswerText = raw.hideAnswerText;
      else errors.push(`${ql}: hideAnswerText must be true or false`);
    }

    if (!Array.isArray(raw.answers) || raw.answers.length < 2 || raw.answers.length > 3) {
      errors.push(`${ql}: needs 2 or 3 answers.`);
      return;
    }
    q.count = raw.answers.length === 2 ? 2 : 3;
    let correct = 0;
    raw.answers.forEach((a: unknown, ai) => {
      const al = `${ql}, answer ${ai + 1}`;
      if (!isObj(a)) { errors.push(`${al}: must be an object.`); return; }
      q.texts[ai] = readText(a.text, al, errors);
      const img = readImage(a.image);
      if ('error' in img) errors.push(`${al}: ${img.error}`); else q.imgs[ai] = img.value;
      if (a.correct !== undefined && typeof a.correct !== 'boolean') errors.push(`${al}: correct must be true or false`);
      else if (a.correct === true) { correct += 1; q.correct = ai; }
    });
    if (correct !== 1) errors.push(`${ql}: mark exactly one answer with "correct": true (found ${correct}).`);
    questions.push(q);
  });
  return errors.length ? { questions: [], errors } : { questions, errors };
}
