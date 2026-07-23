import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="site-footer no-print">
      <div className="site-footer-inner">
        <nav className="site-footer-links" aria-label="Linki w stopce">
          <Link href="/instrukcja">Instrukcja</Link>
          <Link href="/pricing">Cennik</Link>
          <a href="mailto:kontakt@nextdoorstudio.pl">Kontakt</a>
          <a
            href="https://nextdoorstudio.pl"
            target="_blank"
            rel="noopener noreferrer"
          >
            Next Door Studio
          </a>
        </nav>

        <p>
          Built by{' '}
          <a
            href="https://nextdoorstudio.pl"
            target="_blank"
            rel="noopener noreferrer"
          >
            Next Door Studio
          </a>
        </p>
      </div>
    </footer>
  );
}
