'use client';

import { useEffect } from 'react';

/**
 * Child screens: a right-click counts as a left-click and never opens the browser menu.
 * The browser's contextmenu event is cancelled, and a click is dispatched at the same target so the
 * game's own click handlers run. The admin keeps the normal right-click menu.
 */
export default function RightClickAsLeft() {
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (window.location.pathname.startsWith('/admin')) return;
      e.preventDefault();
      if (e.target instanceof Element) {
        e.target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
      }
    };
    document.addEventListener('contextmenu', onContextMenu);
    return () => document.removeEventListener('contextmenu', onContextMenu);
  }, []);

  return null;
}
