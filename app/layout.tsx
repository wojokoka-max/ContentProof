import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'ContentProof — Analiza treści',
  description: 'Sprawdź jakość treści przed publikacją. Analiza struktury, SEO, czytelności i AI Junk.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const authEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const content = (
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

  if (authEnabled) {
    return <ClerkProvider>{content}</ClerkProvider>;
  }

  return content;
}
