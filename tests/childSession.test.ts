import { beforeEach, describe, expect, it } from 'vitest';
import { ACTIVE_CHILD_COOKIE, GUEST_COOKIE, clearActiveChild, getActiveChildId, isGuestPlay, setActiveChild, setGuestPlay } from '@/lib/childSession';

const ID = '3f2b8c1e-5a47-4d0a-9b6e-1c2d3e4f5a6b';

beforeEach(() => {
  document.cookie = `${ACTIVE_CHILD_COOKIE}=; Max-Age=0; Path=/`;
  document.cookie = `${GUEST_COOKIE}=; Max-Age=0; Path=/`;
});

describe('guest play cookie (Guest)', () => {
  it('is its own state: a chosen child ends it, and clearing forgets both', () => {
    expect(isGuestPlay()).toBe(false);
    setGuestPlay();
    expect(isGuestPlay()).toBe(true);
    expect(getActiveChildId()).toBeNull();
    setActiveChild(ID);
    expect(isGuestPlay()).toBe(false);
    setGuestPlay();
    clearActiveChild();
    expect(isGuestPlay()).toBe(false);
  });
});

describe('active child cookie (K8)', () => {
  it('round-trips set, get and clear', () => {
    expect(getActiveChildId()).toBeNull();
    setActiveChild(ID);
    expect(getActiveChildId()).toBe(ID);
    clearActiveChild();
    expect(getActiveChildId()).toBeNull();
  });

  it('returns null for a malformed value', () => {
    document.cookie = `${ACTIVE_CHILD_COOKIE}=not-an-id; Path=/`;
    expect(getActiveChildId()).toBeNull();
  });
});
