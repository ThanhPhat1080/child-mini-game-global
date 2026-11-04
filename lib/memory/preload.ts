/** Longest wait for the deck's pictures before the board opens anyway (a slow or broken image never blocks the game). */
export const PRELOAD_MS = 1500;

/**
 * Loads every url into the browser cache, resolving when all have loaded or failed, or after PRELOAD_MS.
 * Returns a cancel function that drops the wait (and its timer) without calling `done`.
 */
export function preloadImages(urls: readonly (string | null)[], done: () => void): () => void {
  const list = [...new Set(urls.filter((u): u is string => !!u))];
  let left = list.length;
  let over = false;
  const finish = () => {
    if (over) return;
    over = true;
    clearTimeout(timer);
    done();
  };
  const timer = setTimeout(finish, PRELOAD_MS);
  if (left === 0) finish();
  const imgs = list.map((url) => {
    const img = new Image();
    img.onload = img.onerror = () => { if (--left === 0) finish(); };
    img.src = url;
    return img;
  });
  return () => {
    over = true;
    clearTimeout(timer);
    for (const img of imgs) img.onload = img.onerror = null;
  };
}
