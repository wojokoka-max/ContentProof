import type { Metadata } from 'next';

const DESCRIPTION = 'Porównaj plan Free oraz pakiety ContentProof Premium. Zyskaj analizę tekstu, URL i HTML, historię wyników, SEO Pack oraz eksport PDF.';

export const metadata: Metadata = {
  title: 'Cennik',
  description: DESCRIPTION,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: '/pricing',
  },
  openGraph: {
    type: 'website',
    url: '/pricing',
    title: 'Cennik ContentProof',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cennik ContentProof',
    description: DESCRIPTION,
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  const pricingStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Cennik ContentProof',
    url: 'https://www.contentproof.pl/pricing',
    inLanguage: 'pl-PL',
    description: DESCRIPTION,
    isPartOf: {
      '@type': 'WebSite',
      name: 'ContentProof',
      url: 'https://www.contentproof.pl',
    },
    mainEntity: {
      '@type': 'SoftwareApplication',
      name: 'ContentProof',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'SEO and content analysis',
      operatingSystem: 'Web',
      offers: [
        {
          '@type': 'Offer',
          name: 'Free',
          price: '0',
          priceCurrency: 'PLN',
          url: 'https://www.contentproof.pl/pricing',
          description: 'Podstawowy plan do testowania analizy treści.',
        },
        {
          '@type': 'Offer',
          name: 'Premium miesięczny',
          price: '49',
          priceCurrency: 'PLN',
          url: 'https://www.contentproof.pl/pricing',
          description: 'Plan z analizą tekstu, URL i HTML, historią analiz oraz pełnym SEO Pack.',
        },
        {
          '@type': 'Offer',
          name: 'Premium roczny',
          price: '399',
          priceCurrency: 'PLN',
          url: 'https://www.contentproof.pl/pricing',
          description: 'Roczny plan Premium z większym limitem kredytów miesięcznych.',
        },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(pricingStructuredData).replace(/</g, '\\u003c'),
        }}
      />
      {children}
    </>
  );
}
