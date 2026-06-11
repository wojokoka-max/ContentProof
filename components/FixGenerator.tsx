'use client';

import { useState } from 'react';
import type { AnalysisResult } from '@/lib/types';

interface Props {
  result: AnalysisResult;
  rawContent: string;
}

interface GeneratedFix {
  h1: string;
  title: string;
  metaDescription: string;
  faqSuggestions: Array<{ question: string; answer: string }>;
  internalLinkSuggestions: string[];
}

function generateFixes(result: AnalysisResult, rawContent: string): GeneratedFix {
  // Extract key topic words from content
  const plainText = rawContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = plainText.split(/\s+/);

  // Get most frequent meaningful words (topic extraction)
  const stopwords = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','is','are','was','were','be','been','have','has','had','do','does','did','will','would','could','should','że','się','nie','jak','dla','oraz','przez','jest','są','być','co','ale','czy','już','przy','więcej','tylko','też','ten','ta','to','tę','tej','tego','temu','tym','te','które','który','która']);

  const freq: Record<string, number> = {};
  words.forEach(w => {
    const clean = w.toLowerCase().replace(/[^a-złśćąóęźżń]/g, '');
    if (clean.length > 4 && !stopwords.has(clean)) {
      freq[clean] = (freq[clean] ?? 0) + 1;
    }
  });

  const topWords = Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([w]) => w);

  const mainTopic = topWords[0] ?? 'temat';
  const secondTopic = topWords[1] ?? '';
  const lang = result.meta.language;

  // ── H1 ──────────────────────────────────────────────────────────────────────
  const existingH1 = result.meta.detectedH1;
  let h1: string;

  if (existingH1) {
    h1 = existingH1;
  } else if (lang === 'pl') {
    const templates = [
      `Jak ${mainTopic}${secondTopic ? ` i ${secondTopic}` : ''} — kompletny poradnik`,
      `${mainTopic.charAt(0).toUpperCase() + mainTopic.slice(1)}: wszystko co musisz wiedzieć`,
      `Przewodnik po ${mainTopic}${secondTopic ? ` i ${secondTopic}` : ''}`,
    ];
    h1 = templates[0];
  } else {
    h1 = `${mainTopic.charAt(0).toUpperCase() + mainTopic.slice(1)}${secondTopic ? ` and ${secondTopic}` : ''}: Complete Guide`;
  }

  // ── Title ────────────────────────────────────────────────────────────────────
  const existingTitle = result.meta.detectedTitle;
  let title: string;

  if (existingTitle && existingTitle.length >= 30 && existingTitle.length <= 60) {
    title = existingTitle;
  } else if (existingTitle && existingTitle.length > 60) {
    const withoutBrand = existingTitle.split(/\s[|–—-]\s/)[0]?.trim() || existingTitle;
    title = withoutBrand.length <= 60
      ? withoutBrand
      : withoutBrand.slice(0, 60).replace(/\s+\S*$/, '').trim();
  } else {
    const h1Short = h1.length > 45 ? h1.slice(0, 45).replace(/\s+\S*$/, '').trim() : h1;
    title = lang === 'pl' ? `${h1Short} | Twój Brand` : `${h1Short} | Your Brand`;
  }

  // ── Meta description ─────────────────────────────────────────────────────────
  const existingDesc = result.meta.detectedMetaDescription;
  let metaDescription: string;

  if (existingDesc && existingDesc.length >= 70 && existingDesc.length <= 160) {
    metaDescription = existingDesc;
  } else {
    // Generate from first substantial sentences
    const sentences = plainText
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 30 && s.length < 200)
      .slice(0, 2);

    const base = sentences.join(' ').slice(0, 140).replace(/\s+\S*$/, '').trim();
    if (lang === 'pl') {
      metaDescription = base
        ? `${base} Sprawdź nasz poradnik.`
        : `Kompletny przewodnik po temacie ${mainTopic}. Sprawdź praktyczne wskazówki i porady ekspertów.`;
    } else {
      metaDescription = base
        ? `${base} Read our complete guide.`
        : `Complete guide to ${mainTopic}. Discover practical tips and expert advice.`;
    }
    if (metaDescription.length > 155) metaDescription = metaDescription.slice(0, 155).replace(/\s+\S*$/, '').trim();
  }

  // ── Internal link suggestions ─────────────────────────────────────────────
  return {
    h1,
    title,
    metaDescription,
    faqSuggestions: [],
    internalLinkSuggestions: [],
  };
}

export function FixGenerator({ result, rawContent }: Props) {
  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [fixes, setFixes] = useState<GeneratedFix | null>(null);

  function handleGenerate() {
    if (!fixes) setFixes(generateFixes(result, rawContent));
    setOpen(o => !o);
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  }

  return (
    <div style={{ marginTop: 20 }}>
      <button
        onClick={handleGenerate}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '11px 20px',
          background: open ? 'var(--ink-5)' : 'var(--ink)',
          color: open ? 'var(--ink)' : 'var(--white)',
          border: `1.5px solid ${open ? 'var(--ink-20)' : 'var(--ink)'}`,
          borderRadius: 'var(--radius-md)',
          fontSize: 14, fontWeight: 500,
          fontFamily: 'var(--font-display)',
          cursor: 'pointer',
          transition: 'all 0.2s',
          letterSpacing: '0.01em',
        }}
      >
        <span style={{ fontSize: 16 }}>⚡</span>
        {open ? 'Ukryj propozycje poprawek' : 'Wygeneruj poprawkę'}
      </button>

      {open && fixes && (
        <div className="animate-fade-up" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* H1 */}
          <FixBlock
            label="Nagłówek H1"
            description="Główny tytuł strony widoczny dla czytelnika"
            code={`<h1>${fixes.h1}</h1>`}
            isExisting={!!result.meta.detectedH1}
            copyKey="h1"
            copiedKey={copiedKey}
            onCopy={copy}
          />

          {/* Title */}
          <FixBlock
            label="Tag <title>"
            description="Tytuł wyświetlany w wynikach Google (SERP)"
            code={`<title>${fixes.title}</title>`}
            isExisting={!!result.meta.detectedTitle}
            copyKey="title"
            copiedKey={copiedKey}
            onCopy={copy}
          />

          {/* Meta description */}
          <FixBlock
            label="Meta description"
            description={`${fixes.metaDescription.length} znaków — snippet w wynikach Google`}
            code={`<meta name="description" content="${fixes.metaDescription}">`}
            isExisting={!!result.meta.detectedMetaDescription}
            copyKey="meta"
            copiedKey={copiedKey}
            onCopy={copy}
          />

          {/* FAQ */}
          <div className="card-sm">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-display)' }}>Propozycje FAQ</div>
                <div style={{ fontSize: 11, color: 'var(--ink-60)', marginTop: 2 }}>Gotowe propozycje pytań i odpowiedzi do redakcji</div>
              </div>
              {fixes.faqSuggestions.length > 0 && (
                <button
                  onClick={() => {
                    const text = fixes.faqSuggestions.map(f => `${f.question}\n${f.answer}`).join('\n\n');
                    copy(text, 'faq');
                  }}
                  style={copyBtnStyle(copiedKey === 'faq')}
                >
                  {copiedKey === 'faq' ? '✓ skopiowano' : 'kopiuj wszystkie'}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {fixes.faqSuggestions.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--ink-60)' }}>
                  Brak gotowego FAQ do skopiowania. W tej sekcji pokazujemy tylko pytania i odpowiedzi, które wynikają bezpośrednio z treści artykułu.
                </div>
              )}
              {fixes.faqSuggestions.map((item, i) => (
                <div key={i} style={{
                  padding: '10px 12px',
                  background: 'var(--ink-5)',
                  borderRadius: 6,
                }}>
                  <div style={{ fontWeight: 500, fontSize: 12, marginBottom: 3 }}>{item.question}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-60)', fontStyle: 'italic' }}>{item.answer}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ── FixBlock ──────────────────────────────────────────────────────────────────

function FixBlock({ label, description, code, isExisting, copyKey, copiedKey, onCopy }: {
  label: string;
  description: string;
  code: string;
  isExisting: boolean;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (code: string, key: string) => void;
}) {
  return (
    <div className="card-sm">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-display)' }}>{label}</span>
            {isExisting && (
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 4,
                background: 'var(--signal-green-bg)', color: 'var(--signal-green)',
                fontFamily: 'var(--font-mono)',
              }}>
                wykryty
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-60)', marginTop: 2 }}>{description}</div>
        </div>
        <button
          onClick={() => onCopy(code, copyKey)}
          style={copyBtnStyle(copiedKey === copyKey)}
        >
          {copiedKey === copyKey ? '✓ skopiowano' : 'kopiuj'}
        </button>
      </div>
      <pre style={{
        margin: 0, padding: '10px 12px',
        background: 'var(--ink)', color: '#e4e2e0',
        borderRadius: 6, fontSize: 11,
        fontFamily: 'var(--font-mono)', lineHeight: 1.6,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {code}
      </pre>
    </div>
  );
}

function copyBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '4px 10px',
    background: active ? 'var(--signal-green-bg)' : 'var(--ink-5)',
    color: active ? 'var(--signal-green)' : 'var(--ink-60)',
    border: `1px solid ${active ? 'var(--signal-green)' : 'var(--ink-20)'}`,
    borderRadius: 6, fontSize: 11,
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer', flexShrink: 0,
    transition: 'all 0.2s', whiteSpace: 'nowrap' as const,
  };
}
