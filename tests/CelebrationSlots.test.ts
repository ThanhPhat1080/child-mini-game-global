import { describe, expect, it } from 'vitest';
import { celebrationSlots } from '@/lib/celebration';

// "You did it" pictures (parent feedback): default prince for a boy, princess for a girl, on the left only.
// Uploads replace it: both A and B fill the two sides; one upload goes on the right, the default stays on the left.

const none = { a: null, b: null };
const princess = '/images/princess.webp';
const prince = '/images/prince.webp';

describe('celebrationSlots', () => {
  it('a girl with nothing uploaded: the princess alone on the left', () => {
    expect(celebrationSlots({ ...none, gender: 'female' })).toEqual({ left: { src: princess, kind: 'default' }, right: null });
  });

  it('a boy with nothing uploaded: the prince alone on the left', () => {
    expect(celebrationSlots({ ...none, gender: 'male' })).toEqual({ left: { src: prince, kind: 'default' }, right: null });
  });

  it('both pictures uploaded: A on the left and B on the right, no built-in character', () => {
    expect(celebrationSlots({ a: '/media/a.png', b: '/media/b.png', gender: 'male' })).toEqual({
      left: { src: '/media/a.png', kind: 'a' },
      right: { src: '/media/b.png', kind: 'b' },
    });
  });

  it('only A uploaded: the built-in character stays on the left, A goes on the right', () => {
    expect(celebrationSlots({ a: '/media/a.png', b: null, gender: 'male' })).toEqual({
      left: { src: prince, kind: 'default' },
      right: { src: '/media/a.png', kind: 'a' },
    });
  });

  it('only B uploaded: the built-in character stays on the left, B goes on the right', () => {
    expect(celebrationSlots({ a: null, b: '/media/b.png', gender: 'female' })).toEqual({
      left: { src: princess, kind: 'default' },
      right: { src: '/media/b.png', kind: 'b' },
    });
  });
});
