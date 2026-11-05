/** The child chosen on this device (K8). A plain cookie: it only says who is playing, RLS still guards the data. */
export const ACTIVE_CHILD_COOKIE = 'cp_child';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const YEAR = 60 * 60 * 24 * 365;

export function getActiveChildId(): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name !== ACTIVE_CHILD_COOKIE) continue;
    const value = rest.join('=');
    return UUID.test(value) ? value : null;
  }
  return null;
}

export function setActiveChild(id: string): void {
  document.cookie = `${ACTIVE_CHILD_COOKIE}=${id}; Path=/; Max-Age=${YEAR}; SameSite=Lax`;
}

export function clearActiveChild(): void {
  document.cookie = `${ACTIVE_CHILD_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
