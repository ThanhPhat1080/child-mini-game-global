import type { MetadataRoute } from 'next';

/** PWA manifest: name, colors and the red-apple icons (transparent "any" + full-bleed maskable). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ABC play',
    short_name: 'ABC play',
    description: 'Calm quiz games for little kids.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FBF4E9',
    theme_color: '#FBF4E9',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
