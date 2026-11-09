'use client';

import { useEffect, useState } from 'react';
import type { Gender } from '@/lib/childTheme';
import { mediaUrl } from '@/lib/media';
import { getMyChildSettings, visitorSettings, type ChildSettings } from '@/lib/settings';
import { getVisitor, VISITOR_HEAD } from '@/lib/visitor';

/** The child on this device, for the play screens (FP1). `failed` also covers "no child chosen". */
export type ActiveChild =
  | { status: 'loading'; settings: null; name: ''; avatarUrl: null; gender: null }
  | { status: 'failed'; settings: null; name: ''; avatarUrl: null; gender: null }
  | { status: 'ready'; settings: ChildSettings; name: string; avatarUrl: string | null; gender: Gender };

export function useActiveChild(): ActiveChild {
  const [state, setState] = useState<ActiveChild>({ status: 'loading', settings: null, name: '', avatarUrl: null, gender: null });

  useEffect(() => {
    // A visitor is the child: no database call (GU12).
    const visitor = getVisitor();
    if (visitor) {
      setState({ status: 'ready', settings: visitorSettings(visitor), name: visitor.name, avatarUrl: VISITOR_HEAD[visitor.gender], gender: visitor.gender });
      return;
    }
    let live = true;
    getMyChildSettings()
      .then((settings) => {
        if (!live) return;
        if (!settings) return setState({ status: 'failed', settings: null, name: '', avatarUrl: null, gender: null });
        setState({
          status: 'ready',
          settings,
          name: settings.child_name ?? '',
          avatarUrl: mediaUrl(settings.avatar_path),
          gender: settings.gender,
        });
      })
      .catch(() => {
        if (live) setState({ status: 'failed', settings: null, name: '', avatarUrl: null, gender: null });
      });
    return () => {
      live = false;
    };
  }, []);

  return state;
}
