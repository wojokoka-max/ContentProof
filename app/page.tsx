'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { AnalysisResult, FetchDebug, InputMode, MetaInput } from '@/lib/types';
import type { SavedAnalysis } from '@/lib/history';
import { ContentInput }    from '@/components/ContentInput';
import { AnalysisReport }  from '@/components/AnalysisReport';
import { FetchDebugPanel } from '@/components/FetchDebugPanel';
import { AccountControls, type AccountState } from '@/components/AccountControls';
import { HistoryPanel } from '@/components/HistoryPanel';
import { isCrawlerUserAgent } from '@/lib/crawler';

const HOME_FAQ = [
  {
    question: 'Do czego służy ContentProof?',
    answer: 'ContentProof pomaga sprawdzić jakość treści przed publikacją i po opublikowaniu. Analizuje strukturę artykułu, SEO, meta dane, FAQ, czytelność oraz elementy techniczne ważne dla widoczności w Google.',
  },
  {
    question: 'Czy ContentProof jest tylko dla specjalistów SEO?',
    answer: 'Nie. Narzędzie jest tworzone przede wszystkim dla twórców treści, blogerów, właścicieli stron i małych firm. Wyniki mają być gotowe do wykorzystania, bez konieczności czytania kodu lub dokumentacji technicznej.',
  },
  {
    question: 'Jakie treści można analizować?',
    answer: 'Można analizować zwykły tekst, opublikowany adres URL oraz kod HTML. Dzięki temu ContentProof sprawdza zarówno szkice przed publikacją, jak i artykuły, które są już dostępne w internecie.',
  },
  {
    question: 'Czy ContentProof przygotowuje meta title i meta description?',
    answer: 'Tak. ContentProof przygotowuje propozycje meta title i meta description na podstawie realnej treści artykułu. Opisy mają być gotowe do wklejenia, naturalne i dopasowane do intencji czytelnika.',
  },
  {
    question: 'Czy ContentProof pomaga z FAQ i schema.org?',
    answer: 'Tak. Narzędzie przygotowuje pytania i odpowiedzi FAQ oraz dane strukturalne JSON-LD, które można wkleić do strony. Celem jest lepszy kontekst semantyczny artykułu i czytelniejszy SEO Pack.',
  },
];

type AppState =
  | { phase: 'input' }
  | { phase: 'loading'; content: string; analysisId: string }
  | { phase: 'result'; result: AnalysisResult; content: string }
  | { phase: 'fetch-error'; message: string; debug: FetchDebug }
  | { phase: 'error'; message: string };

export default function Home() {
  const [state, setState] = useState<AppState>({ phase: 'input' });
  const [account, setAccount] = useState<AccountState>({
    configured: false,
    signedIn: false,
    isPremium: false,
    isAdmin: false,
    historyReady: false,
    plan: 'guest',
    remaining: 1,
    limit: 1,
    purchasedCredits: 0,
    canUseAdvancedModes: false,
    canSaveHistory: false,
    canExport: false,
    billingConfigured: false,
    billingPeriod: null,
    subscriptionStatus: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [adminHistoryOpen, setAdminHistoryOpen] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isCrawlerClient, setIsCrawlerClient] = useState(false);
  const currentAnalysisIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const authEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const accountAuthEnabled = authEnabled && !isCrawlerClient;

  useEffect(() => {
    setIsCrawlerClient(isCrawlerUserAgent(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (!accountAuthEnabled) return;

    let active = true;
    fetch('/api/account', { cache: 'no-store' })
      .then(response => response.json())
      .then(data => {
        if (!active) return;
        setAccount({
          configured: Boolean(data.configured),
          signedIn: Boolean(data.signedIn),
          isPremium: Boolean(data.isPremium),
          isAdmin: Boolean(data.isAdmin),
          historyReady: Boolean(data.historyReady),
          plan: data.plan ?? 'guest',
          remaining: typeof data.remaining === 'number' ? data.remaining : null,
          limit: typeof data.limit === 'number' ? data.limit : null,
          purchasedCredits: typeof data.purchasedCredits === 'number' ? data.purchasedCredits : 0,
          canUseAdvancedModes: Boolean(data.canUseAdvancedModes),
          canSaveHistory: Boolean(data.canSaveHistory),
          canExport: Boolean(data.canExport),
          billingConfigured: Boolean(data.billingConfigured),
          billingPeriod: data.billingPeriod ?? null,
          subscriptionStatus: data.subscriptionStatus ?? null,
          cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd),
          currentPeriodEnd: data.currentPeriodEnd ?? null,
        });
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [accountAuthEnabled]);

  async function handleAnalyze(content: string, mode: InputMode = 'text', metaInput?: MetaInput) {
    const analysisId = crypto.randomUUID();
    currentAnalysisIdRef.current = analysisId;
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setSaveStatus('idle');

    setState({ phase: 'loading', content, analysisId });
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, mode, analysisId, metaInput }),
        cache: 'no-store',
        signal: abortController.signal,
      });

      const data = await res.json();
      const responseAnalysisId = typeof data?.analysisId === 'string' ? data.analysisId : null;

      if (
        currentAnalysisIdRef.current !== analysisId ||
        responseAnalysisId !== analysisId
      ) {
        return;
      }

      if (!res.ok) {
        // URL fetch error — has debug panel
        if (data.isUrlFetchError && data.fetchDebug) {
          setState({ phase: 'fetch-error', message: data.error, debug: data.fetchDebug });
          return;
        }
        setState({ phase: 'error', message: data.error ?? 'Nieznany błąd.' });
        return;
      }

      setState({ phase: 'result', result: data as AnalysisResult, content });
      if (data.usage) {
        setAccount(current => ({
          ...current,
          plan: data.usage.plan ?? current.plan,
          remaining: typeof data.usage.remaining === 'number' ? data.usage.remaining : null,
          limit: typeof data.usage.limit === 'number' ? data.usage.limit : null,
          purchasedCredits: typeof data.usage.purchasedCredits === 'number'
            ? data.usage.purchasedCredits
            : current.purchasedCredits,
        }));
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (currentAnalysisIdRef.current !== analysisId) return;
      setState({ phase: 'error', message: 'Nie udało się połączyć z serwerem.' });
    }
  }

  function handleReset() {
    currentAnalysisIdRef.current = null;
    abortControllerRef.current?.abort();
    setSaveStatus('idle');
    setState({ phase: 'input' });
  }

  async function handleSaveAnalysis() {
    if (state.phase !== 'result' || !account.isPremium || !account.historyReady) return;

    setSaveStatus('saving');
    const title = state.result.seoPack.title
      || state.result.meta.detectedH1
      || 'Analiza bez tytułu';
    const sourceLabel = state.result.meta.analysisMode === 'url'
      ? state.content.trim()
      : null;

    try {
      const response = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: state.result.analysisId,
          title,
          inputMode: state.result.meta.analysisMode,
          sourceLabel,
          input: state.content,
          result: state.result,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Nie udało się zachować analizy.');

      setSaveStatus('saved');
      setHistoryRefreshKey(value => value + 1);
    } catch {
      setSaveStatus('error');
    }
  }

  function handleOpenSavedAnalysis(saved: SavedAnalysis) {
    currentAnalysisIdRef.current = null;
    abortControllerRef.current?.abort();
    setSaveStatus('saved');
    setState({ phase: 'result', result: saved.result, content: saved.input });
  }

  const saveAccess = getSaveAccess(account, saveStatus);
  const homeFaqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: HOME_FAQ.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--white)' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homeFaqSchema).replace(/</g, '\\u003c'),
        }}
      />

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <header className="app-header" style={{
        borderBottom: '1px solid var(--ink-10)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', zIndex: 100,
      }}>
        <div className="app-brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: 'var(--ink)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" fill="white" opacity="0.9"/>
              <rect x="8" y="1" width="5" height="5" rx="1" fill="white" opacity="0.6"/>
              <rect x="1" y="8" width="5" height="5" rx="1" fill="white" opacity="0.6"/>
              <rect x="8" y="8" width="5" height="5" rx="1" fill="white" opacity="0.3"/>
            </svg>
          </div>
          <span className="app-brand-name" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>
            ContentProof
          </span>
          <span className="app-version-badge" style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-40)', background: 'var(--ink-5)', padding: '2px 6px', borderRadius: 4 }}>MVP</span>
        </div>
        <div className="app-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link href="/instrukcja" className="header-link header-help-link">Instrukcja</Link>
          {state.phase === 'result' && (
            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-60)' }}>
              <span>Wynik:</span>
              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{state.result.overallScore}/100</span>
            </div>
          )}
          <AccountControls
            authEnabled={accountAuthEnabled}
            account={account}
            onOpenHistory={() => setHistoryOpen(true)}
            onOpenAdminHistory={() => setAdminHistoryOpen(true)}
          />
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 780, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Input phase */}
        {(state.phase === 'input' || state.phase === 'error') && (
          <>
            <div className="animate-fade-up" style={{ marginBottom: 40 }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.03em', margin: '0 0 12px' }}>
                Sprawdź treść<br />
                <span style={{ color: 'var(--ink-40)' }}>przed publikacją.</span>
              </h1>
              <p style={{ fontSize: 18, color: 'var(--ink)', fontWeight: 650, lineHeight: 1.45, margin: '0 0 8px' }}>
                Analiza SEO treści, URL i HTML.
              </p>
              <p style={{ fontSize: 15, color: 'var(--ink-60)', maxWidth: 560, lineHeight: 1.6, margin: 0 }}>
                ContentProof sprawdza szkice przed publikacją oraz artykuły już dostępne w internecie. Otrzymujesz ocenę, gotowe poprawki, meta dane i FAQ.
              </p>
            </div>
            <div className="animate-fade-up" style={{ animationDelay: '80ms' }}>
              <ContentInput
                onAnalyze={handleAnalyze}
                loading={false}
                canUseAdvancedModes={account.canUseAdvancedModes}
              />
              {state.phase === 'error' && (
                <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--signal-red-bg)', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', color: 'var(--signal-red)', fontSize: 13 }}>
                  {state.message}
                </div>
              )}
              <Features />
              <ProductOverview />
              <SeoLandingContent />
              <EcosystemSection />
              <HomeFaq />
            </div>
          </>
        )}

        {/* Loading phase */}
        {state.phase === 'loading' && (
          <div className="animate-fade-in">
            <ContentInput
              onAnalyze={handleAnalyze}
              loading={true}
              canUseAdvancedModes={account.canUseAdvancedModes}
            />
            <LoadingState isUrl={isUrlLike(state.content)} />
          </div>
        )}

        {/* Fetch error phase — show debug + retry */}
        {state.phase === 'fetch-error' && (
          <div className="animate-fade-up">
            <div style={{
              marginBottom: 20, padding: '16px 20px',
              background: 'var(--signal-red-bg)',
              border: '1px solid #fecaca',
              borderRadius: 'var(--radius-lg)',
            }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--signal-red)', marginBottom: 4 }}>
                Nie udało się pobrać treści strony
              </div>
              <div style={{ fontSize: 13, color: 'var(--signal-red)', opacity: 0.85 }}>
                {state.message}
              </div>
            </div>
            <FetchDebugPanel debug={state.debug} />
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                onClick={handleReset}
                style={{
                  padding: '9px 18px', background: 'var(--ink)', color: 'var(--white)',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  fontSize: 13, fontFamily: 'var(--font-sans)', cursor: 'pointer',
                }}
              >
                ← Spróbuj ponownie
              </button>
              <div style={{ fontSize: 12, color: 'var(--ink-60)', alignSelf: 'center', lineHeight: 1.4 }}>
                Jeśli strona wymaga logowania lub blokuje boty, pobierz HTML ręcznie i wklej go poniżej.
              </div>
            </div>
          </div>
        )}

        {/* Result phase */}
        {state.phase === 'result' && (
          <div className="animate-fade-in">
            <AnalysisReport
              key={state.result.analysisId}
              result={state.result}
              onReset={handleReset}
              onSave={() => void handleSaveAnalysis()}
              saveStatus={saveStatus}
              canSave={saveAccess.canSave}
              saveHint={saveAccess.hint}
              canExport={account.canExport}
              hasFullSeoPack={account.isPremium}
            />
          </div>
        )}

      </main>
      <HistoryPanel
        open={historyOpen}
        account={account}
        refreshKey={historyRefreshKey}
        onClose={() => setHistoryOpen(false)}
        onOpenAnalysis={handleOpenSavedAnalysis}
      />
      <HistoryPanel
        open={adminHistoryOpen}
        account={account}
        adminMode
        refreshKey={historyRefreshKey}
        onClose={() => setAdminHistoryOpen(false)}
        onOpenAnalysis={handleOpenSavedAnalysis}
      />
    </div>
  );
}

function isUrlLike(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

function getSaveAccess(
  account: AccountState,
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
): { canSave: boolean; hint: string } {
  if (!account.configured) {
    return { canSave: false, hint: 'Logowanie nie jest jeszcze skonfigurowane.' };
  }
  if (!account.signedIn) {
    return { canSave: false, hint: 'Zaloguj się, aby zachować analizę.' };
  }
  if (!account.isPremium) {
    return { canSave: false, hint: 'Historia analiz jest dostępna w planie Premium.' };
  }
  if (!account.historyReady) {
    return { canSave: false, hint: 'Baza historii nie jest jeszcze skonfigurowana.' };
  }
  if (saveStatus === 'error') {
    return { canSave: true, hint: 'Zapis nie powiódł się. Spróbuj ponownie.' };
  }
  return { canSave: true, hint: 'Zapisz aktualny wynik w historii Premium.' };
}

// ── Features strip ────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: '⊞', label: 'Struktura' }, { icon: '◎', label: 'SEO Basics' },
  { icon: '⇆', label: 'Linkowanie' }, { icon: '⬚', label: 'Obrazy' },
  { icon: '?', label: 'FAQ' }, { icon: '≡', label: 'Czytelność' }, { icon: '⚡', label: 'AI Junk' },
];

function Features() {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 28, flexWrap: 'wrap' as const }}>
      {FEATURES.map(f => (
        <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'var(--ink-5)', borderRadius: 6, fontSize: 12, color: 'var(--ink-60)' }}>
          <span style={{ fontSize: 11, opacity: 0.7 }}>{f.icon}</span>
          {f.label}
        </div>
      ))}
    </div>
  );
}

function ProductOverview() {
  return (
    <section className="product-overview" aria-labelledby="product-overview-title">
      <div className="product-overview-heading">
        <h2 id="product-overview-title">Co sprawdza ContentProof?</h2>
        <p>
          Jedno narzędzie obsługuje trzy różne etapy pracy z treścią. Zakres analizy
          dopasowuje się do materiału, który podajesz.
        </p>
      </div>

      <div className="product-overview-grid">
        <div>
          <h3>Tekst i szkic</h3>
          <p>
            Analiza struktury, czytelności i tematu jeszcze przed dodaniem artykułu
            do CMS. ContentProof proponuje również nagłówki, meta dane i FAQ.
          </p>
        </div>
        <div>
          <h3>Opublikowany URL</h3>
          <p>
            Kontrola gotowej strony wraz z tytułem, opisem, canonical, nagłówkami,
            linkami, obrazami i danymi strukturalnymi.
          </p>
        </div>
        <div>
          <h3>Kod HTML</h3>
          <p>
            Sprawdzenie rzeczywistej struktury dokumentu i elementów SEO zapisanych
            w kodzie, bez mieszania ich z samą treścią artykułu.
          </p>
        </div>
      </div>

      <div className="product-overview-footer">
        <p>Tryb tekstowy jest dostępny bezpłatnie. Analiza URL i HTML należy do Premium.</p>
        <Link href="/pricing" className="header-link">Porównaj plany</Link>
      </div>
    </section>
  );
}

function SeoLandingContent() {
  return (
    <section className="product-overview" aria-labelledby="seo-landing-title">
      <div className="product-overview-heading">
        <h2 id="seo-landing-title">ContentProof jako narzędzie do analizy SEO treści</h2>
        <p>
          ContentProof jest narzędziem SaaS dla osób, które publikują artykuły,
          poradniki, wpisy blogowe, opisy usług i treści sprzedażowe. Pomaga
          sprawdzić, czy tekst jest zrozumiały, uporządkowany i przygotowany do
          publikacji w Google.
        </p>
      </div>

      <div className="product-overview-grid">
        <div>
          <h3>Gotowe elementy SEO</h3>
          <p>
            Po analizie otrzymujesz propozycje meta title, meta description,
            canonical URL, Open Graph, Twitter Card, robots oraz schema.org w
            formacie JSON-LD. To nie jest raport techniczny dla developerów, ale
            zestaw gotowych fragmentów do użycia w CMS.
          </p>
        </div>
        <div>
          <h3>Wsparcie dla twórców</h3>
          <p>
            Narzędzie zwraca uwagę na strukturę nagłówków, brakujące sekcje,
            FAQ, linkowanie wewnętrzne, obrazy, czytelność i powtarzalne błędy
            językowe. Dzięki temu łatwiej poprawić tekst przed publikacją albo
            uporządkować artykuł, który już działa w internecie.
          </p>
        </div>
        <div>
          <h3>Kontrola po publikacji</h3>
          <p>
            Analiza URL pomaga sprawdzić opublikowaną stronę: tytuł, opis,
            nagłówki, canonical, linki, obrazy i dane strukturalne. To przydaje
            się szczególnie wtedy, gdy artykuł jest już w WordPressie, WebWave
            albo innym systemie CMS.
          </p>
        </div>
      </div>

      <div className="product-overview-footer">
        <p>
          ContentProof łączy analizę jakości treści, podstawy SEO on-page i
          gotowe propozycje tekstów, które można wdrożyć bez pracy w kodzie.
        </p>
      </div>
    </section>
  );
}

function EcosystemSection() {
  return (
    <section className="product-overview" aria-labelledby="ecosystem-title">
      <div className="product-overview-heading">
        <h2 id="ecosystem-title">Część ekosystemu narzędzi NextDoor Studio</h2>
        <p>
          ContentProof jest rozwijany jako pierwsze narzędzie w spokojnym
          ekosystemie aplikacji do pracy z treścią, SEO i procesem publikacji.
          Kolejne produkty będą wspierać analizę większych serwisów, planowanie
          tematów i porządkowanie całego content marketingu.
        </p>
      </div>

      <div className="product-overview-grid">
        <div>
          <h3>ContentProof</h3>
          <p>
            Narzędzie do pojedynczej analizy artykułu, szkicu, strony URL lub
            kodu HTML. Pomaga przygotować SEO Pack, FAQ, schema.org i konkretne
            rekomendacje dla autora treści.
          </p>
        </div>
        <div>
          <h3>ContentEcosystemAnalyzer</h3>
          <p>
            Siostrzany projekt planowany z myślą o szerszej analizie serwisów:
            strukturze tematów, powiązaniach między artykułami, lukach
            semantycznych i długofalowej strategii treści.
          </p>
        </div>
        <div>
          <h3>NextDoor Studio</h3>
          <p>
            Studio tworzące minimalistyczne narzędzia dla twórców, małych firm i
            osób publikujących online. Wspólny kierunek to mniej chaosu, więcej
            jasnych decyzji i praktyczne wsparcie w codziennej pracy.
          </p>
        </div>
      </div>
    </section>
  );
}

function HomeFaq() {
  return (
    <section className="product-overview" aria-labelledby="home-faq-title">
      <div className="product-overview-heading">
        <h2 id="home-faq-title">Najczęstsze pytania o ContentProof</h2>
        <p>
          Krótko i konkretnie: co sprawdza narzędzie, dla kogo jest i kiedy warto go użyć.
        </p>
      </div>

      <div className="product-overview-grid">
        {HOME_FAQ.map(item => (
          <div key={item.question}>
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Loading state ─────────────────────────────────────────────────────────────

function LoadingState({ isUrl }: { isUrl: boolean }) {
  const steps = isUrl
    ? ['Pobieranie strony...', 'Parsowanie HTML...', 'Analiza struktury...', 'Sprawdzanie SEO...', 'Obliczanie wyniku...']
    : ['Parsowanie treści...', 'Analiza struktury...', 'Sprawdzanie SEO...', 'Ocena czytelności...', 'Wykrywanie AI Junk...', 'Obliczanie wyniku...'];

  return (
    <div className="animate-fade-in" style={{ marginTop: 24, padding: '24px', background: 'var(--ink-5)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {steps.map((step, i) => (
        <div key={step} className="animate-slide-in" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink-60)', animationDelay: `${i * 120}ms` }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ink-40)', display: 'inline-block', animation: 'pulse-dot 1.2s ease infinite', animationDelay: `${i * 0.15}s` }} />
          {step}
        </div>
      ))}
    </div>
  );
}
