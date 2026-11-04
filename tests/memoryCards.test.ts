import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  result: { data: null as unknown, error: null as { message: string } | null },
  eq: vi.fn(),
  order: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  speakKid: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    from: h.from,
    storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.test/${p}` } }) }) },
  }),
}));
vi.mock('@/lib/sfx', () => ({ speakKid: h.speakKid }));

import { fetchActiveCards, sayWord, stopWord } from '@/lib/memory/cards';

class FakeAudio {
  static instances: FakeAudio[] = [];
  static playResult: 'resolve' | 'reject' = 'resolve';
  listeners: Record<string, (() => void)[]> = {};
  pause = vi.fn();
  play = vi.fn(() => (FakeAudio.playResult === 'resolve' ? Promise.resolve() : Promise.reject(new Error('blocked'))));
  constructor(public src: string) { FakeAudio.instances.push(this); }
  addEventListener(type: string, fn: () => void) { (this.listeners[type] ??= []).push(fn); }
  fire(type: string) { (this.listeners[type] ?? []).forEach((f) => f()); }
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  h.speakKid.mockReset();
  stopWord();
  FakeAudio.instances = [];
  FakeAudio.playResult = 'resolve';
  vi.stubGlobal('Audio', FakeAudio);
  window.Audio = FakeAudio as unknown as typeof Audio;
  h.result = { data: null, error: null };
  h.order.mockImplementation(() => Promise.resolve(h.result));
  h.eq.mockImplementation(() => ({ order: h.order }));
  h.select.mockImplementation(() => ({ eq: h.eq }));
  h.from.mockImplementation(() => ({ select: h.select }));
});

describe('fetchActiveCards', () => {
  it('asks only for active cards and returns the rows', async () => {
    const rows = [{ id: 'a', word: 'cat', image_path: 'seed/cat.svg', audio_path: null, active: true }];
    h.result = { data: rows, error: null };
    await expect(fetchActiveCards()).resolves.toEqual(rows);
    expect(h.from).toHaveBeenCalledWith('memory_cards');
    expect(h.select).toHaveBeenCalledWith('id, word, image_path, audio_path, active');
    expect(h.eq).toHaveBeenCalledWith('active', true);
    expect(h.order).toHaveBeenCalledWith('created_at');
  });

  it('throws the Supabase error message', async () => {
    h.result = { data: null, error: { message: 'boom' } };
    await expect(fetchActiveCards()).rejects.toThrow('boom');
  });
});

describe('sayWord', () => {
  it('plays the recorded file and does not speak', async () => {
    sayWord({ word: 'cat', audio_path: 'seed/cat.mp3' });
    await flush();
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].src).toBe('/seed/cat.mp3');
    expect(FakeAudio.instances[0].play).toHaveBeenCalled();
    expect(h.speakKid).not.toHaveBeenCalled();
  });

  it('speaks the word when there is no recording', () => {
    sayWord({ word: 'cat', audio_path: null });
    expect(FakeAudio.instances).toHaveLength(0);
    expect(h.speakKid).toHaveBeenCalledExactlyOnceWith('cat');
  });

  it('falls back to speech when play() is rejected', async () => {
    FakeAudio.playResult = 'reject';
    sayWord({ word: 'cat', audio_path: 'seed/cat.mp3' });
    await flush();
    expect(h.speakKid).toHaveBeenCalledExactlyOnceWith('cat');
  });

  it('falls back to speech when the file fires an error event', async () => {
    sayWord({ word: 'cat', audio_path: 'seed/cat.mp3' });
    FakeAudio.instances[0].fire('error');
    await flush();
    expect(h.speakKid).toHaveBeenCalledExactlyOnceWith('cat');
  });

  it('falls back only once when both the rejection and the error event happen', async () => {
    FakeAudio.playResult = 'reject';
    sayWord({ word: 'cat', audio_path: 'seed/cat.mp3' });
    FakeAudio.instances[0].fire('error');
    await flush();
    FakeAudio.instances[0].fire('error');
    expect(h.speakKid).toHaveBeenCalledTimes(1);
  });

  it('pauses the previous recording when a new word starts', async () => {
    sayWord({ word: 'cat', audio_path: 'seed/cat.mp3' });
    sayWord({ word: 'dog', audio_path: 'seed/dog.mp3' });
    await flush();
    expect(FakeAudio.instances[0].pause).toHaveBeenCalled();
    expect(FakeAudio.instances[1].pause).not.toHaveBeenCalled();
  });

  it('a stale recording that errors later does not speak over the new word', async () => {
    sayWord({ word: 'cat', audio_path: 'seed/cat.mp3' });
    sayWord({ word: 'dog', audio_path: null });
    FakeAudio.instances[0].fire('error');
    await flush();
    expect(h.speakKid).toHaveBeenCalledExactlyOnceWith('dog');
  });

  it('speaks when the recording URL cannot be resolved', () => {
    sayWord({ word: 'cat', audio_path: 'pending:gone' });
    expect(FakeAudio.instances).toHaveLength(0);
    expect(h.speakKid).toHaveBeenCalledExactlyOnceWith('cat');
  });

  it('never throws when Audio itself fails', () => {
    vi.stubGlobal('Audio', function Boom() { throw new Error('no audio'); });
    expect(() => sayWord({ word: 'cat', audio_path: 'seed/cat.mp3' })).not.toThrow();
    expect(h.speakKid).toHaveBeenCalledExactlyOnceWith('cat');
  });
});

describe('sayWord onEnd (the page waits for the last word before the celebration)', () => {
  it('spoken word: onEnd is passed to the voice and called once when it finishes', () => {
    const onEnd = vi.fn();
    sayWord({ word: 'cat', audio_path: null }, onEnd);
    expect(h.speakKid).toHaveBeenCalledTimes(1);
    expect(h.speakKid.mock.calls[0][0]).toBe('cat');
    expect(onEnd).not.toHaveBeenCalled();
    const opts = h.speakKid.mock.calls[0][1] as { onEnd: () => void };
    opts.onEnd();
    opts.onEnd();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('no recording and no voice available: onEnd is called right away, once', () => {
    h.speakKid.mockImplementation((_t: string, o?: { onEnd?: () => void }) => o?.onEnd?.()); // as speakKid does without speechSynthesis
    const onEnd = vi.fn();
    sayWord({ word: 'cat', audio_path: null }, onEnd);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('recording: onEnd is called once when it ends, not before', async () => {
    const onEnd = vi.fn();
    sayWord({ word: 'cat', audio_path: 'seed/cat.mp3' }, onEnd);
    await flush();
    expect(onEnd).not.toHaveBeenCalled();
    FakeAudio.instances[0].fire('ended');
    FakeAudio.instances[0].fire('ended');
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(h.speakKid).not.toHaveBeenCalled();
  });

  it('recording error: the voice fallback carries onEnd, called once', async () => {
    FakeAudio.playResult = 'reject';
    const onEnd = vi.fn();
    sayWord({ word: 'cat', audio_path: 'seed/cat.mp3' }, onEnd);
    FakeAudio.instances[0].fire('error');
    await flush();
    expect(h.speakKid).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();
    const opts = h.speakKid.mock.calls[0][1] as { onEnd: () => void };
    opts.onEnd();
    opts.onEnd();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('Audio failing and the voice throwing: onEnd is still called once, nothing throws', () => {
    vi.stubGlobal('Audio', function Boom() { throw new Error('no audio'); });
    h.speakKid.mockImplementation(() => { throw new Error('no voice'); });
    const onEnd = vi.fn();
    expect(() => sayWord({ word: 'cat', audio_path: 'seed/cat.mp3' }, onEnd)).not.toThrow();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('an onEnd that throws does not escape', async () => {
    sayWord({ word: 'cat', audio_path: 'seed/cat.mp3' }, () => { throw new Error('x'); });
    await flush();
    expect(() => FakeAudio.instances[0].fire('ended')).not.toThrow();
  });
});

describe('sayWord cuts off a spoken word before a recording (no overlapping voices)', () => {
  it('cancels the browser voice before it plays the recording', async () => {
    const cancel = vi.fn();
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { cancel } });
    try {
      sayWord({ word: 'cat', audio_path: 'x.mp3' });
      await flush();
      expect(cancel).toHaveBeenCalled();
      expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(FakeAudio.instances[0].play.mock.invocationCallOrder[0]);
    } finally {
      // @ts-expect-error test cleanup of the stub
      delete window.speechSynthesis;
    }
  });
});

describe('stopWord (M10: leaving the page silences the word)', () => {
  it('pauses the playing recording and cancels speech', async () => {
    const cancel = vi.fn();
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { cancel } });
    sayWord({ word: 'cat', audio_path: 'seed/cat.mp3' });
    await flush();
    cancel.mockClear(); // sayWord cancels speech before a recording; this test checks stopWord's cancel
    stopWord();
    expect(FakeAudio.instances[0].pause).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    stopWord(); // the reference was cleared: no second pause
    expect(FakeAudio.instances[0].pause).toHaveBeenCalledTimes(1);
    // @ts-expect-error test cleanup of the stub
    delete window.speechSynthesis;
  });

  it('a recording that ended is forgotten (no pause on stop)', async () => {
    sayWord({ word: 'cat', audio_path: 'seed/cat.mp3' });
    await flush();
    FakeAudio.instances[0].fire('ended');
    stopWord();
    expect(FakeAudio.instances[0].pause).not.toHaveBeenCalled();
  });

  it('a stopped recording that errors later does not speak', async () => {
    sayWord({ word: 'cat', audio_path: 'seed/cat.mp3' });
    stopWord();
    FakeAudio.instances[0].fire('error');
    await flush();
    expect(h.speakKid).not.toHaveBeenCalled();
  });

  it('never throws, with nothing playing and no speechSynthesis, or when pause throws', async () => {
    expect(() => stopWord()).not.toThrow();
    sayWord({ word: 'cat', audio_path: 'seed/cat.mp3' });
    FakeAudio.instances[0].pause.mockImplementation(() => { throw new Error('x'); });
    expect(() => stopWord()).not.toThrow();
  });
});
