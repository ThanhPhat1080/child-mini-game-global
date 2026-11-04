import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let created = 0;
let started = 0;

function makeParam() {
  return { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), value: 0 };
}
class FakeAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  resume = vi.fn();
  createGain() {
    const node = { gain: makeParam(), connect: (n: unknown) => n, disconnect: vi.fn() };
    return node;
  }
  createOscillator() {
    created++;
    const node = {
      type: 'sine',
      frequency: makeParam(),
      connect: (n: unknown) => n,
      start: () => { started++; },
      stop: vi.fn(),
    };
    return node;
  }
}

beforeEach(() => {
  created = 0;
  started = 0;
  vi.resetModules();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('memory sounds', () => {
  it('flipTick starts exactly one oscillator', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { flipTick } = await import('@/lib/sfx');
    flipTick();
    expect(created).toBe(1);
    expect(started).toBe(1);
  });

  it('chime starts exactly two oscillators', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { chime } = await import('@/lib/sfx');
    chime();
    expect(created).toBe(2);
    expect(started).toBe(2);
  });

  it('chime rings both tones at a louder peak gain (0.3, was 0.12)', async () => {
    const peaks: number[] = [];
    class RecordingAudioContext extends FakeAudioContext {
      createGain() {
        return {
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn((v: number) => { if (v > 0.001) peaks.push(v); }),
            value: 0,
          },
          connect: (n: unknown) => n,
          disconnect: vi.fn(),
        };
      }
    }
    vi.stubGlobal('AudioContext', RecordingAudioContext);
    const { chime } = await import('@/lib/sfx');
    chime();
    expect(peaks).toEqual([0.3, 0.3]);
  });

  it('both are silent no-ops without an AudioContext', async () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);
    const { flipTick, chime } = await import('@/lib/sfx');
    expect(() => flipTick()).not.toThrow();
    expect(() => chime()).not.toThrow();
    expect(created).toBe(0);
  });
});
