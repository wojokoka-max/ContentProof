import type { MetadataRoute } from 'next';

const SITE_URL = 'https://www.contentproof.pl';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/sign-in/',
        '/sign-up/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
