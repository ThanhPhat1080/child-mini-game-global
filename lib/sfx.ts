/**
 * Small synthesized sound effects + a child-like voice (Web Audio / speechSynthesis).
 * No files needed; call only after a user gesture (ADR-016). Swap for recorded files later if wanted.
 */
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(c: AudioContext, out: AudioNode, t: number, f0: number, f1: number, dur: number, type: OscillatorType, gain = 0.25) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Child-like voice: high pitch, slightly slow, English female voice if present. */
export function speakKid(text: string, opts: { pitch?: number; rate?: number; onEnd?: () => void } = {}): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) { opts.onEnd?.(); return; }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  // Always English, whatever the browser or page language is: without `lang` (or with no voice found yet, as when
  // the voice list has not loaded) the browser falls back to its own language, e.g. Vietnamese.
  u.lang = 'en-US';
  // The browser's default voice for en-US is used (no voice is set on purpose).
  u.pitch = opts.pitch ?? 1.3;
  u.rate = opts.rate ?? 0.95;
  u.volume = 1;
  if (opts.onEnd) {
    let done = false;
    const fin = () => { if (!done) { done = true; opts.onEnd?.(); } };
    u.onend = fin;
    u.onerror = fin;
    setTimeout(fin, 4000); // never leave the child waiting
  }
  synth.speak(u);
}

/** Stop handle for a built-in sound; `ms` is roughly how long it plays. */
export type SoundHandle = { stop: () => void; ms: number };

function makeBus(c: AudioContext, ms: number): { bus: GainNode; handle: SoundHandle } {
  const bus = c.createGain();
  bus.connect(c.destination);
  return {
    bus,
    handle: {
      ms,
      stop: () => {
        try { bus.disconnect(); } catch { /* already disconnected */ }
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
      },
    },
  };
}

/** Plays an uploaded sound file once. */
export function playFile(url: string): SoundHandle {
  const a = new Audio(url);
  a.play().catch(() => undefined);
  return { ms: 0, stop: () => a.pause() };
}

/** Soft descending "oh-oh" (two wobbly notes), or the uploaded track. */
export function ohOh(customUrl?: string | null): SoundHandle | void {
  if (customUrl) return playFile(customUrl);
  const c = ac();
  if (!c) return;
  const { bus, handle } = makeBus(c, 1900);
  const t = c.currentTime;
  tone(c, bus, t, 520, 400, 0.28, 'triangle', 0.28);
  tone(c, bus, t + 0.34, 420, 300, 0.4, 'triangle', 0.28);
  speakKid('Oh-oh!', { pitch: 1.6, rate: 0.8 });
  return handle;
}

/** Happy rising sparkle plus a cheerful "Yay, hooray!", or the uploaded track. */
export function yay(customUrl?: string | null): SoundHandle | void {
  if (customUrl) return playFile(customUrl);
  const c = ac();
  if (!c) return;
  const { bus, handle } = makeBus(c, 2400);
  const t = c.currentTime;
  [523, 659, 784, 1046].forEach((f, i) => tone(c, bus, t + i * 0.09, f, f * 1.01, 0.3, 'sine', 0.2));
  speakKid('Yay! Hooray!', { pitch: 2, rate: 1.05 });
  return handle;
}

/** Audience applause: many tiny band-passed noise claps over `seconds`. */
export function applause(seconds = 3): SoundHandle | void {
  const c = ac();
  if (!c) return;
  const { bus, handle } = makeBus(c, seconds * 1000 + 1500);
  const len = Math.floor(c.sampleRate * 0.06);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const t0 = c.currentTime + 0.05;
  const claps = Math.floor(seconds * 55);
  for (let n = 0; n < claps; n++) {
    const phase = n / claps;
    const level = Math.sin(Math.min(1, phase * 1.15) * Math.PI) * 0.9 + 0.1; // swell then fade
    if (Math.random() > level) continue;
    const s = c.createBufferSource();
    s.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1200 + Math.random() * 2400;
    f.Q.value = 0.8;
    const g = c.createGain();
    g.gain.value = 0.35 * level * (0.4 + Math.random() * 0.6);
    s.connect(f).connect(g).connect(bus);
    s.start(t0 + phase * seconds + Math.random() * 0.02);
  }
  return handle;
}

/** Memory Match: one very short, quiet tick when a card flips. Silent when there is no AudioContext. */
export function flipTick(): void {
  const c = ac();
  if (!c) return;
  const { bus } = makeBus(c, 200);
  tone(c, bus, c.currentTime, 850, 700, 0.1, 'triangle', 0.11);
}

/** Memory Match: soft high "ting ting" when a pair matches. Silent when there is no AudioContext. */
export function chime(): void {
  const c = ac();
  if (!c) return;
  const { bus } = makeBus(c, 600);
  const t = c.currentTime;
  tone(c, bus, t, 1318, 1318, 0.25, 'sine', 0.3);
  tone(c, bus, t + 0.14, 1760, 1760, 0.3, 'sine', 0.3);
}
