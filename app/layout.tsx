import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ContentProof — Analiza treści',
  description: 'Sprawdź jakość treści przed publikacją. Analiza struktury, SEO, czytelności i AI Junk.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-white">
        {children}
      </body>
    </html>
  );
}
