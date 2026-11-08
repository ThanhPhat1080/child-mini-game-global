/** The child chosen on this device (K8). A plain cookie: it only says who is playing, RLS still guards the data. */
export const ACTIVE_CHILD_COOKIE = 'cp_child';
/**
 * Guest play (no child): a parent without children, or anyone who picks Guest. Only global content is listed.
 * A plain cookie, like the child one; the picker clears it when a child is chosen.
 */
export const GUEST_COOKIE = 'cp_guest';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const YEAR = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key !== name) continue;
    return rest.join('=');
  }
  return null;
}

export function getActiveChildId(): string | null {
  const value = readCookie(ACTIVE_CHILD_COOKIE);
  return value !== null && UUID.test(value) ? value : null;
}

export function isGuestPlay(): boolean {
  return readCookie(GUEST_COOKIE) === '1';
}

export function setActiveChild(id: string): void {
  clearGuestPlay();
  document.cookie = `${ACTIVE_CHILD_COOKIE}=${id}; Path=/; Max-Age=${YEAR}; SameSite=Lax`;
}

export function setGuestPlay(): void {
  clearActiveChild();
  document.cookie = `${GUEST_COOKIE}=1; Path=/; Max-Age=${YEAR}; SameSite=Lax`;
}

/** Forget the chosen child and any guest play (sign-out, leaving a game). */
export function clearActiveChild(): void {
  document.cookie = `${ACTIVE_CHILD_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  clearGuestPlay();
}

function clearGuestPlay(): void {
  document.cookie = `${GUEST_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
