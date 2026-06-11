'use client';

import { useRef, useState } from 'react';
import type { AnalysisResult, FetchDebug, InputMode, MetaInput } from '@/lib/types';
import { ContentInput }    from '@/components/ContentInput';
import { AnalysisReport }  from '@/components/AnalysisReport';
import { FetchDebugPanel } from '@/components/FetchDebugPanel';

type AppState =
  | { phase: 'input' }
  | { phase: 'loading'; content: string; analysisId: string }
  | { phase: 'result'; result: AnalysisResult; content: string }
  | { phase: 'fetch-error'; message: string; debug: FetchDebug }
  | { phase: 'error'; message: string };

export default function Home() {
  const [state, setState] = useState<AppState>({ phase: 'input' });
  const currentAnalysisIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  async function handleAnalyze(content: string, mode: InputMode = 'text', metaInput?: MetaInput) {
    const analysisId = crypto.randomUUID();
    currentAnalysisIdRef.current = analysisId;
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

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
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (currentAnalysisIdRef.current !== analysisId) return;
      setState({ phase: 'error', message: 'Nie udało się połączyć z serwerem.' });
    }
  }

  function handleReset() {
    currentAnalysisIdRef.current = null;
    abortControllerRef.current?.abort();
    setState({ phase: 'input' });
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--white)' }}>

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <header style={{
        borderBottom: '1px solid var(--ink-10)',
        padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: 'var(--ink)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" fill="white" opacity="0.9"/>
              <rect x="8" y="1" width="5" height="5" rx="1" fill="white" opacity="0.6"/>
              <rect x="1" y="8" width="5" height="5" rx="1" fill="white" opacity="0.6"/>
              <rect x="8" y="8" width="5" height="5" rx="1" fill="white" opacity="0.3"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>
            ContentProof
          </span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-40)', background: 'var(--ink-5)', padding: '2px 6px', borderRadius: 4 }}>MVP</span>
        </div>
        {state.phase === 'result' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-60)' }}>
            <span>Wynik:</span>
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{state.result.overallScore}/100</span>
          </div>
        )}
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
              <p style={{ fontSize: 15, color: 'var(--ink-60)', maxWidth: 480, lineHeight: 1.6, margin: 0 }}>
                Wklej HTML, tekst artykułu lub adres URL strony.
              </p>
            </div>
            <div className="animate-fade-up" style={{ animationDelay: '80ms' }}>
              <ContentInput onAnalyze={handleAnalyze} loading={false} />
              {state.phase === 'error' && (
                <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--signal-red-bg)', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', color: 'var(--signal-red)', fontSize: 13 }}>
                  {state.message}
                </div>
              )}
              <Features />
            </div>
          </>
        )}

        {/* Loading phase */}
        {state.phase === 'loading' && (
          <div className="animate-fade-in">
            <ContentInput onAnalyze={handleAnalyze} loading={true} />
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
            />
          </div>
        )}

      </main>
    </div>
  );
}

function isUrlLike(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
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
