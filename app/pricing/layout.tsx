import type { Metadata } from 'next';

const DESCRIPTION = 'Porównaj plan Free oraz pakiety ContentProof Premium. Zyskaj analizę tekstu, URL i HTML, historię wyników, SEO Pack oraz eksport PDF.';

export const metadata: Metadata = {
  title: 'Cennik',
  description: DESCRIPTION,
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
  return children;
}
