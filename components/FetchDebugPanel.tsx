'use client';

import type { FetchDebug } from '@/lib/types';

interface Props {
  debug: FetchDebug;
}

// Detect JS-rendering from error message
function isJsRenderingError(debug: FetchDebug): boolean {
  return !!debug.error?.includes('JavaScript');
}

function isBotBlockError(debug: FetchDebug): boolean {
  return !!debug.error?.includes('blokuje') || debug.httpStatus === 403 || debug.httpStatus === 429;
}

export function FetchDebugPanel({ debug }: Props) {
  const jsRendering = isJsRenderingError(debug);
  const botBlock = isBotBlockError(debug);
  const hasIssue = !!debug.error;

  const rows: Array<{
    label: string;
    value: string;
    status: 'ok' | 'warn' | 'error' | 'neutral';
  }> = [
    {
      label: 'Pobierany URL',
      value: debug.fetchedUrl,
      status: 'neutral',
    },
    {
      label: 'HTTP status',
      value: debug.httpStatus !== null ? String(debug.httpStatus) : '—',
      status: debug.httpStatus === 200 ? 'ok' : debug.httpStatus !== null ? 'error' : 'warn',
    },
    {
      label: 'Content-Type',
      value: debug.contentType ?? '—',
      status: debug.contentType?.includes('text/html') ? 'ok' : 'warn',
    },
    {
      label: 'Pobrane HTML',
      value: debug.htmlLength > 0
        ? `${debug.htmlLength.toLocaleString('pl-PL')} znaków`
        : '0 znaków',
      status: debug.htmlLength >= 10_000 ? 'ok' : debug.htmlLength >= 1_000 ? 'warn' : 'error',
    },
    {
      label: 'Tekst po ekstrakcji',
      value: debug.textLength > 0
        ? `${debug.textLength.toLocaleString('pl-PL')} znaków`
        : '0 znaków — brak treści statycznej',
      status: debug.textLength >= 500 ? 'ok' : debug.textLength >= 100 ? 'warn' : 'error',
    },
    {
      label: 'Wykryty <title>',
      value: debug.detectedTitleRaw ?? '— nie wykryto',
      status: debug.detectedTitleRaw ? 'ok' : 'error',
    },
    {
      label: 'Liczba H1',
      value: `${debug.detectedH1Count}`,
      status: debug.detectedH1Count === 1 ? 'ok' : debug.detectedH1Count > 1 ? 'warn' : 'error',
    },
    {
      label: 'Meta description',
      value: debug.detectedMetaDescriptionRaw
        ? (debug.detectedMetaDescriptionRaw.length > 90
            ? debug.detectedMetaDescriptionRaw.slice(0, 87) + '…'
            : debug.detectedMetaDescriptionRaw)
        : '— nie wykryto',
      status: debug.detectedMetaDescriptionRaw ? 'ok' : 'warn',
    },
    {
      label: 'Czas pobierania',
      value: `${debug.fetchDurationMs} ms`,
      status: debug.fetchDurationMs < 5000 ? 'ok' : 'warn',
    },
  ];

  const DOT: Record<string, string> = {
    ok:      '#1a7a4a',
    warn:    '#92580a',
    error:   '#9b1c1c',
    neutral: '#99979a',
  };

  return (
    <div style={{
      border: '1px solid var(--ink-10)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        background: 'var(--ink-5)',
        borderBottom: '1px solid var(--ink-10)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          letterSpacing: '0.06em', textTransform: 'uppercase' as const,
          color: 'var(--ink-60)',
        }}>
          Debug — pobieranie URL
        </span>
        {hasIssue && (
          <span style={{
            marginLeft: 'auto', fontSize: 11,
            padding: '2px 8px', borderRadius: 4,
            background: jsRendering ? 'var(--signal-amber-bg)' : 'var(--signal-red-bg)',
            color: jsRendering ? 'var(--signal-amber)' : 'var(--signal-red)',
            fontWeight: 500,
          }}>
            {jsRendering ? 'JS rendering' : botBlock ? 'Zablokowany' : 'Błąd'}
          </span>
        )}
        {!hasIssue && (
          <span style={{
            marginLeft: 'auto', fontSize: 11,
            padding: '2px 8px', borderRadius: 4,
            background: 'var(--signal-green-bg)',
            color: 'var(--signal-green)', fontWeight: 500,
          }}>
            OK
          </span>
        )}
      </div>

      {/* Data rows */}
      {rows.map((row, i) => (
        <div key={row.label} style={{
          display: 'grid',
          gridTemplateColumns: '170px 1fr',
          gap: 10, padding: '8px 16px',
          borderBottom: i < rows.length - 1 ? '1px solid var(--ink-10)' : 'none',
          alignItems: 'flex-start',
          background: row.status === 'error' ? '#fff8f8' : 'transparent',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: DOT[row.status], flexShrink: 0,
            }} />
            <span style={{
              fontSize: 11, color: 'var(--ink-60)',
              fontFamily: 'var(--font-mono)',
            }}>
              {row.label}
            </span>
          </div>
          <span style={{
            fontSize: 12,
            color: row.status === 'error' ? 'var(--signal-red)' : 'var(--ink)',
            fontFamily: (row.label === 'Pobierany URL' || row.label === 'Content-Type')
              ? 'var(--font-mono)' : 'var(--font-sans)',
            wordBreak: 'break-all', lineHeight: 1.45,
          }}>
            {row.value}
          </span>
        </div>
      ))}

      {/* Explanation box */}
      {hasIssue && (
        <div style={{
          padding: '14px 16px',
          borderTop: '1px solid var(--ink-10)',
          background: jsRendering ? 'var(--signal-amber-bg)' : 'var(--signal-red-bg)',
        }}>
          <div style={{
            fontWeight: 600, fontSize: 12, marginBottom: 6,
            color: jsRendering ? 'var(--signal-amber)' : 'var(--signal-red)',
          }}>
            {jsRendering ? 'Dlaczego brakuje treści?' : 'Co poszło nie tak?'}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--ink)' }}>
            {debug.error}
          </div>

          {/* JS-rendering fix instructions */}
          {jsRendering && (
            <div style={{
              marginTop: 12, padding: '10px 12px',
              background: 'white', borderRadius: 6,
              border: '1px solid var(--ink-10)',
              fontSize: 12, lineHeight: 1.7,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12 }}>
                Jak pobrać HTML ręcznie:
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--ink-60)' }}>
                <li>Otwórz stronę w przeglądarce Chrome/Firefox</li>
                <li>Wciśnij <kbd style={{ background: 'var(--ink-10)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 11 }}>Ctrl+U</kbd> (lub prawym → Wyświetl źródło strony)</li>
                <li>Zaznacz wszystko <kbd style={{ background: 'var(--ink-10)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 11 }}>Ctrl+A</kbd> → Kopiuj <kbd style={{ background: 'var(--ink-10)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 11 }}>Ctrl+C</kbd></li>
                <li>{'Wklej do pola analizatora i kliknij "Analizuj treść"'}</li>
              </ol>
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-40)' }}>
                Alternatywnie: w DevTools (F12) → Network → odśwież → kliknij pierwszy request → Response → skopiuj treść.
              </div>
            </div>
          )}

          {/* Bot-block instructions */}
          {botBlock && !jsRendering && (
            <div style={{
              marginTop: 12, padding: '10px 12px',
              background: 'white', borderRadius: 6,
              border: '1px solid var(--ink-10)',
              fontSize: 12, lineHeight: 1.7,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12 }}>
                Jak pobrać HTML ręcznie:
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--ink-60)' }}>
                <li>Otwórz stronę w przeglądarce Chrome/Firefox</li>
                <li>Wciśnij <kbd style={{ background: 'var(--ink-10)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 11 }}>Ctrl+U</kbd> (lub prawym → Wyświetl źródło strony)</li>
                <li>Zaznacz wszystko <kbd style={{ background: 'var(--ink-10)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 11 }}>Ctrl+A</kbd> → Kopiuj <kbd style={{ background: 'var(--ink-10)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 11 }}>Ctrl+C</kbd></li>
                <li>{'Wklej do pola analizatora i kliknij "Analizuj treść"'}</li>
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
