'use client';

import { useEffect, useState } from 'react';
import type { InputMode, MetaInput, MetaInputMode } from '@/lib/types';

interface Props {
  onAnalyze: (content: string, mode: InputMode, metaInput?: MetaInput) => void;
  loading: boolean;
}

const MODES: Array<{ id: InputMode; label: string; icon: string; hint: string }> = [
  { id: 'text', label: 'Tekst', icon: 'T', hint: 'Zwykły tekst, szkic, Google Docs, Word lub ChatGPT' },
  { id: 'html', label: 'HTML', icon: '<>', hint: 'Kod HTML artykułu lub strony' },
  { id: 'url', label: 'URL', icon: '@', hint: 'Adres opublikowanej strony' },
];

const PLACEHOLDERS: Record<InputMode, string> = {
  text: `Wklej tutaj tekst artykułu bez HTML.

Przykład:
Ciasto z truskawkami i pianką low carb

To ciasto łączy kruche ciasto, soczyste truskawki i lekką piankę.

Składniki
200 g mąki migdałowej
60 g mąki kokosowej

FAQ
Czy można zamrozić to ciasto?
Tak. Najlepiej zamrażać pojedyncze porcje.`,
  html: `Wklej tutaj kod HTML artykułu lub strony.

Przykład:
<h1>Jak wybrać labradora</h1>
<p>Labrador to jedna z najpopularniejszych ras psów...</p>`,
  url: `Wklej adres URL opublikowanej strony.

Przykład:
https://twojadomena.pl/artykul`,
};

function detectModeFromContent(text: string): InputMode {
  const trimmed = text.trim();
  if (/^https?:\/\//i.test(trimmed)) return 'url';
  if (/<(h[1-6]|p|title|meta|img|div|span|article|section|header|footer|nav|ul|ol|li|details|summary)\b[^>]*>/i.test(trimmed)) return 'html';
  return 'text';
}

export function ContentInput({ onAnalyze, loading }: Props) {
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<InputMode>('text');
  const [autoDetected, setAutoDetected] = useState(false);
  const [metaMode, setMetaMode] = useState<MetaInputMode>('generate');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');

  useEffect(() => {
    if (content.length <= 30) return;

    const detected = detectModeFromContent(content);
    if (detected === mode) return;

    setMode(detected);
    setAutoDetected(true);

    const timeoutId = window.setTimeout(() => setAutoDetected(false), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [content, mode]);

  const isUrl = mode === 'url' && /^https?:\/\//i.test(content.trim());
  const hasProvidedMeta = metaTitle.trim().length > 0 || metaDescription.trim().length > 0;
  const metaReady = mode !== 'text' || metaMode === 'generate' || hasProvidedMeta;
  const canSubmit = (content.trim().length >= 30 || isUrl) && metaReady && !loading;
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const charCount = content.length;

  function selectMode(nextMode: InputMode) {
    setMode(nextMode);
    setAutoDetected(false);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    const metaInput: MetaInput | undefined = mode === 'text'
      ? { mode: metaMode, title: metaTitle.trim(), description: metaDescription.trim() }
      : undefined;

    onAnalyze(content, mode, metaInput);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        background: 'var(--ink-5)',
        borderRadius: 10,
        border: '1px solid var(--ink-10)',
      }}>
        {MODES.map(item => (
          <button
            key={item.id}
            type="button"
            title={item.hint}
            onClick={() => selectMode(item.id)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 10px',
              background: mode === item.id ? 'var(--white)' : 'transparent',
              color: mode === item.id ? 'var(--ink)' : 'var(--ink-60)',
              border: 'none',
              borderRadius: 7,
              fontSize: 13,
              fontWeight: mode === item.id ? 600 : 400,
              fontFamily: 'var(--font-display)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: mode === item.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <span style={{ fontSize: 11, opacity: 0.7 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {autoDetected && (
        <div className="animate-fade-in" style={{
          fontSize: 11,
          color: 'var(--signal-amber)',
          fontFamily: 'var(--font-mono)',
        }}>
          Wykryto automatycznie: tryb {MODES.find(item => item.id === mode)?.label}
        </div>
      )}

      <textarea
        className="content-textarea"
        value={content}
        onChange={event => setContent(event.target.value)}
        placeholder={PLACEHOLDERS[mode]}
        spellCheck={false}
        autoComplete="off"
        disabled={loading}
        style={{ opacity: loading ? 0.6 : 1, minHeight: mode === 'url' ? 80 : 280 }}
      />

      {mode === 'text' && (
        <div style={{
          padding: 12,
          border: '1px solid var(--ink-10)',
          borderRadius: 8,
          background: 'var(--ink-5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            Masz już meta dane?
          </div>

          <div style={{ display: 'flex', gap: 4 }}>
            <MetaModeButton
              active={metaMode === 'generate'}
              label="Nie, przygotuj propozycje"
              onClick={() => setMetaMode('generate')}
            />
            <MetaModeButton
              active={metaMode === 'provided'}
              label="Tak, chcę je sprawdzić"
              onClick={() => setMetaMode('provided')}
            />
          </div>

          {metaMode === 'generate' ? (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-60)', lineHeight: 1.5 }}>
              ContentProof przygotuje meta title i meta description na podstawie aktualnego tekstu.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--ink-60)' }}>
                Meta title
                <input
                  value={metaTitle}
                  onChange={event => setMetaTitle(event.target.value)}
                  placeholder="Wpisz obecny meta title"
                  disabled={loading}
                  style={metaFieldStyle}
                />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--ink-60)' }}>
                Meta description
                <textarea
                  value={metaDescription}
                  onChange={event => setMetaDescription(event.target.value)}
                  placeholder="Wpisz obecny meta description"
                  disabled={loading}
                  rows={3}
                  style={{ ...metaFieldStyle, resize: 'vertical' }}
                />
              </label>
              {!hasProvidedMeta && (
                <p style={{ margin: 0, fontSize: 11, color: 'var(--signal-amber)' }}>
                  Wpisz co najmniej jeden element meta do sprawdzenia.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {content.length > 0 && (
          <div style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            fontSize: 11,
            color: 'var(--ink-40)',
            fontFamily: 'var(--font-mono)',
          }}>
            <span>{wordCount} słów</span>
            <span>·</span>
            <span>{charCount.toLocaleString()} znaków</span>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {content.length > 0 && (
          <button
            type="button"
            onClick={() => setContent('')}
            style={{
              fontSize: 12,
              color: 'var(--ink-40)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Wyczyść
          </button>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 22px',
            background: canSubmit ? 'var(--ink)' : 'var(--ink-20)',
            color: canSubmit ? 'var(--white)' : 'var(--ink-40)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 14,
            fontWeight: 500,
            fontFamily: 'var(--font-display)',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? 'Analizuję...' : 'Analizuj treść'}
        </button>
      </div>

      {content.length > 0 && content.trim().length < 30 && !isUrl && (
        <p style={{ fontSize: 11, color: 'var(--ink-40)', margin: 0 }}>
          Minimum 30 znaków do analizy.
        </p>
      )}
    </form>
  );
}

function MetaModeButton({ active, label, onClick }: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '7px 10px',
        borderRadius: 6,
        border: `1px solid ${active ? 'var(--ink)' : 'var(--ink-10)'}`,
        background: active ? 'var(--ink)' : 'var(--white)',
        color: active ? 'var(--white)' : 'var(--ink-60)',
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

const metaFieldStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '9px 10px',
  border: '1px solid var(--ink-10)',
  borderRadius: 6,
  background: 'var(--white)',
  color: 'var(--ink)',
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  lineHeight: 1.5,
};
