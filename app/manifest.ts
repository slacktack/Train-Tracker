import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Train Tracker — Live Indian Railways',
    short_name: 'Train Tracker',
    description: 'Live train tracking across India — real-time position, delay, ETA, and coach occupancy.',
    start_url: '/',
    display: 'standalone',
    background_color: '#E2DFD5',
    theme_color: '#E2DFD5',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
