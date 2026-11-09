/**
 * The built-in background track, shipped in `public/seed/sounds/` (no upload needed).
 * A child's own track from the library wins; with none set, this one loops.
 */
export const DEFAULT_MUSIC_URL = '/seed/sounds/background-track.mp3';

/** The track to loop: the child's chosen file (already turned into a URL) or the built-in one. */
export function musicUrl(chosen: string | null | undefined): string {
  return chosen || DEFAULT_MUSIC_URL;
}
