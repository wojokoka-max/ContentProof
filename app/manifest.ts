import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ContentProof',
    short_name: 'ContentProof',
    description: 'Analiza SEO i jakości treści dla szkiców, opublikowanych URL-i oraz HTML.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#111111',
    categories: ['business', 'productivity', 'utilities'],
    lang: 'pl-PL',
    icons: [
      {
        src: '/favicon-contentproof.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/favicon-contentproof.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
