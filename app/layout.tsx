import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { SiteFooter } from '@/components/SiteFooter';
import './globals.css';

const SITE_URL = 'https://www.contentproof.pl';
const STUDIO_URL = 'https://nextdoorstudio.pl';
const CONTACT_EMAIL = 'kontakt@nextdoorstudio.pl';
const SITE_TITLE = 'ContentProof - analiza SEO treści, URL i HTML';
const SITE_DESCRIPTION = 'ContentProof analizuje szkice, opublikowane URL-e i HTML. Sprawdza SEO, strukturę, czytelność, FAQ i metadane oraz przygotowuje gotowe poprawki dla twórców treści.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: '%s | ContentProof',
  },
  description: SITE_DESCRIPTION,
  applicationName: 'ContentProof',
  category: 'SEO software',
  classification: 'SaaS, SEO, content quality, publishing workflow',
  keywords: [
    'ContentProof',
    'analiza SEO',
    'audyt treści',
    'analiza URL',
    'analiza HTML',
    'meta title',
    'meta description',
    'FAQ schema',
    'narzędzie dla twórców treści',
  ],
  authors: [{ name: 'NextDoor Studio', url: STUDIO_URL }],
  creator: 'NextDoor Studio',
  publisher: 'NextDoor Studio',
  referrer: 'origin-when-cross-origin',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon-contentproof.png', type: 'image/png' },
    ],
    shortcut: '/favicon-contentproof.png',
    apple: '/favicon-contentproof.png',
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'pl_PL',
    url: SITE_URL,
    siteName: 'ContentProof',
    title: SITE_TITLE,
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
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const authEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: 'ContentProof',
        url: SITE_URL,
        inLanguage: 'pl-PL',
        description: SITE_DESCRIPTION,
        publisher: {
          '@id': `${STUDIO_URL}/#organization`,
        },
      },
      {
        '@type': 'Organization',
        '@id': `${STUDIO_URL}/#organization`,
        name: 'NextDoor Studio',
        url: STUDIO_URL,
        email: CONTACT_EMAIL,
        contactPoint: {
          '@type': 'ContactPoint',
          email: CONTACT_EMAIL,
          contactType: 'customer support',
          availableLanguage: 'pl-PL',
        },
        sameAs: [
          STUDIO_URL,
        ],
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
        mainEntityOfPage: {
          '@id': `${SITE_URL}/#website`,
        },
        featureList: [
          'Analiza szkiców tekstowych',
          'Analiza opublikowanych URL-i',
          'Analiza kodu HTML',
          'SEO Pack z meta title i meta description',
          'FAQ i JSON-LD schema',
          'Historia analiz w planie Premium',
        ],
        audience: {
          '@type': 'Audience',
          audienceType: 'Twórcy treści, blogerzy, właściciele stron i małe firmy',
        },
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
