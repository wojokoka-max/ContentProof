import type { Metadata } from 'next';

const DESCRIPTION = 'Praktyczna instrukcja ContentProof: dowiedz sie, jak analizowac tekst, HTML i opublikowany URL oraz jak wykorzystac gotowe poprawki SEO, meta dane i FAQ.';

export const metadata: Metadata = {
  title: 'Jak korzystac z ContentProof',
  description: DESCRIPTION,
  alternates: { canonical: '/instrukcja' },
  robots: { index: true, follow: true },
  openGraph: { type: 'article', url: '/instrukcja', title: 'Jak korzystac z ContentProof', description: DESCRIPTION },
  twitter: { card: 'summary_large_image', title: 'Jak korzystac z ContentProof', description: DESCRIPTION },
};

export default function InstructionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
