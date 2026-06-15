import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { SiteFooter } from '@/components/SiteFooter';
import './globals.css';

const SITE_URL = 'https://www.contentproof.pl';
const STUDIO_URL = 'https://nextdoorstudio.pl';
const SITE_DESCRIPTION = 'Analizuj teksty, opublikowane strony i HTML. ContentProof sprawdza SEO, strukturę, czytelność i FAQ oraz przygotowuje gotowe poprawki.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'ContentProof - analiza SEO treści, URL i HTML',
    template: '%s | ContentProof',
  },
  description: SITE_DESCRIPTION,
  applicationName: 'ContentProof',
  authors: [{ name: 'NextDoor Studio' }],
  creator: 'NextDoor Studio',
  publisher: 'NextDoor Studio',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'pl_PL',
    url: SITE_URL,
    siteName: 'ContentProof',
    title: 'ContentProof - analiza SEO treści, URL i HTML',
    description: SITE_DESCRIPTION,
    images: [{
      url: '/opengraph-image',
      width: 1200,
      height: 630,
      alt: 'ContentProof - analiza SEO i jakości treści',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ContentProof - analiza SEO treści, URL i HTML',
    description: SITE_DESCRIPTION,
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const authEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${STUDIO_URL}/#organization`,
        name: 'NextDoor Studio',
        url: STUDIO_URL,
        email: 'kontakt@nextdoorstudio.pl',
        contactPoint: {
          '@type': 'ContactPoint',
          email: 'kontakt@nextdoorstudio.pl',
          contactType: 'customer support',
          availableLanguage: 'Polish',
        },
        owns: {
          '@id': `${SITE_URL}/#software`,
        },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_URL}/#software`,
        name: 'ContentProof',
        url: SITE_URL,
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'SEO and content analysis',
        operatingSystem: 'Web',
        inLanguage: 'pl-PL',
        description: SITE_DESCRIPTION,
        publisher: {
          '@id': `${STUDIO_URL}/#organization`,
        },
        provider: {
          '@id': `${STUDIO_URL}/#organization`,
        },
        offers: [
          {
            '@type': 'Offer',
            name: 'Free',
            price: '0',
            priceCurrency: 'PLN',
            url: `${SITE_URL}/pricing`,
          },
          {
            '@type': 'Offer',
            name: 'Premium miesięczny',
            price: '49',
            priceCurrency: 'PLN',
            url: `${SITE_URL}/pricing`,
          },
          {
            '@type': 'Offer',
            name: 'Premium roczny',
            price: '399',
            priceCurrency: 'PLN',
            url: `${SITE_URL}/pricing`,
          },
        ],
      },
    ],
  };
  const content = (
    <html lang="pl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
          }}
        />
      </head>
      <body className="min-h-screen bg-white">
        <div className="site-shell">
          <div className="site-content">{children}</div>
          <SiteFooter />
        </div>
      </body>
    </html>
  );

  if (authEnabled) {
    return <ClerkProvider>{content}</ClerkProvider>;
  }

  return content;
}
