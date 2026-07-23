import Link from 'next/link';

const STEPS = [
  {
    name: 'Wybierz sposób podania treści',
    text: 'Wklej szkic jako tekst, kod artykułu jako HTML albo adres opublikowanej strony. Każdy tryb sprawdza treść w sposób odpowiedni do jej formy.',
  },
  {
    name: 'Uruchom analizę',
    text: 'ContentProof oceni strukturę, czytelność, SEO i FAQ, a przy HTML oraz URL rozpozna także dane dostępne na stronie.',
  },
  {
    name: 'Wykorzystaj gotowe propozycje',
    text: 'Skopiuj dopracowane meta dane, FAQ i elementy SEO, które pasują do Twojego artykułu. Wynik traktuj jak konkretną pomoc redakcyjną, nie jak listę technicznych obowiązków.',
  },
];

export default function InstructionsPage() {
  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Jak korzystać z ContentProof',
    description: 'Instrukcja analizy tekstu, HTML i opublikowanego URL w ContentProof.',
    inLanguage: 'pl-PL',
    totalTime: 'PT5M',
    step: STEPS.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };

  return (
    <main className="instructions-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(howToSchema).replace(/</g, '\\u003c'),
        }}
      />

      <nav className="instructions-topbar" aria-label="Nawigacja instrukcji">
        <Link href="/" className="header-link">&larr; ContentProof</Link>
        <Link href="/pricing" className="header-link">Cennik</Link>
      </nav>

      <header className="instructions-hero">
        <p className="instructions-eyebrow">INSTRUKCJA</p>
        <h1>Jak korzystać z ContentProof</h1>
        <p>
          ContentProof pomaga dopracować artykuł przed publikacją albo sprawdzić
          stronę, która już jest online. Wybierasz formę treści, uruchamiasz
          analizę i dostajesz konkretne propozycje do wykorzystania.
        </p>
      </header>

      <section className="instructions-section" aria-labelledby="what-is-contentproof">
        <h2 id="what-is-contentproof">Co robi ContentProof</h2>
        <p>
          Narzędzie sprawdza, czy treść jest dobrze uporządkowana, czy odpowiada
          na potrzeby czytelnika i czy ma elementy przydatne w wyszukiwarce.
          W jednym wyniku znajdziesz ocenę, rekomendacje, propozycje meta danych,
          FAQ oraz SEO Pack.
        </p>
        <p>
          Nie musisz znać kodu. Techniczne elementy, takie jak schema, Open Graph
          czy canonical URL, pozostają dostępne wtedy, gdy ich potrzebujesz.
        </p>
      </section>

      <section className="instructions-section" aria-labelledby="choose-mode">
        <h2 id="choose-mode">Wybierz odpowiedni tryb</h2>
        <div className="instructions-mode-grid">
          <article>
            <h3>Tekst</h3>
            <p>
              Wybierz ten tryb dla szkicu, treści z dokumentu lub tekstu wklejonego
              przed publikacją. ContentProof pomoże uporządkować temat, nagłówki,
              meta dane i FAQ.
            </p>
          </article>
          <article>
            <h3>HTML</h3>
            <p>
              Użyj go, gdy masz kod artykułu. Narzędzie odczyta widoczne nagłówki,
              listy, FAQ i dane obecne w kodzie, a potem poda poprawki.
            </p>
          </article>
          <article>
            <h3>URL</h3>
            <p>
              Wklej adres opublikowanej strony, aby sprawdzić to, co widzą
              czytelnicy i wyszukiwarka: tytuł, opis, canonical, strukturę oraz
              treść strony.
            </p>
          </article>
        </div>
      </section>

      <section className="instructions-section" aria-labelledby="work-step-by-step">
        <h2 id="work-step-by-step">Pracuj krok po kroku</h2>
        <ol className="instructions-steps">
          {STEPS.map((step, index) => (
            <li key={step.name}>
              <span aria-hidden="true">{index + 1}</span>
              <div>
                <h3>{step.name}</h3>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="instructions-section" aria-labelledby="read-results">
        <h2 id="read-results">Jak czytać wynik</h2>
        <dl className="instructions-results">
          <div>
            <dt>Ocena i kategorie</dt>
            <dd>
              Pomagają szybko zobaczyć, co działa dobrze, a co warto poprawić.
              Niższy wynik nie jest karą za styl, tylko wskazówką, gdzie szukać
              największej korzyści.
            </dd>
          </div>
          <div>
            <dt>Gotowe poprawki</dt>
            <dd>
              Korzystaj z nich wtedy, gdy są zgodne z intencją artykułu. To
              propozycje gotowego tekstu, który możesz skopiować lub potraktować
              jako punkt wyjścia.
            </dd>
          </div>
          <div>
            <dt>SEO Pack</dt>
            <dd>
              Znajdziesz w nim meta title, meta description, FAQ i dane SEO do
              wklejenia w odpowiednie pola swojego CMS-a.
            </dd>
          </div>
        </dl>
      </section>

      <section className="instructions-note" aria-labelledby="before-publish">
        <h2 id="before-publish">Przed publikacją</h2>
        <p>
          Przeczytaj propozycje jeszcze raz w kontekście całego artykułu. Najlepszy
          efekt daje zachowanie faktów, tonu marki i obietnicy, która rzeczywiście
          znajduje pokrycie w treści.
        </p>
      </section>

      <section className="instructions-actions" aria-label="Dalsze kroki">
        <div>
          <h2>Gotowa, aby sprawdzić treść?</h2>
          <p>Wróć do analizy i wybierz tekst, HTML albo adres opublikowanej strony.</p>
        </div>
        <div className="instructions-actions-links">
          <Link href="/" className="instructions-primary-action">Przejdź do analizy</Link>
          <a href="mailto:kontakt@nextdoorstudio.pl" className="instructions-secondary-action">
            Napisz do nas
          </a>
        </div>
      </section>
    </main>
  );
}
