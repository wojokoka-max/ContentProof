'use client';

import { useState, useEffect } from 'react';
import type { ContentExpansionPack } from '@/lib/types';

interface Props {
  pack: ContentExpansionPack;
}

// ─── Shared copy button ───────────────────────────────────────────────────────

function CopyBtn({ text, onClick }: { text: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 10px', flexShrink: 0,
      background: text ? 'var(--signal-green-bg)' : 'var(--ink-5)',
      color: text ? 'var(--signal-green)' : 'var(--ink-60)',
      border: `1px solid ${text ? 'var(--signal-green)' : 'var(--ink-10)'}`,
      borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-mono)',
      cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' as const,
    }}>
      {text ? '✓ skopiowano' : 'Kopiuj'}
    </button>
  );
}

// ─── FAQ section ─────────────────────────────────────────────────────────────

function FaqSection({ pack, copiedKey, onCopy }: {
  pack: ContentExpansionPack;
  copiedKey: string | null;
  onCopy: (t: string, k: string) => void;
}) {
  const faqText = pack.faqText;

  if (pack.faqSuggestions.length === 0) {
    return (
      <div style={{
        padding: '16px 18px',
        background: 'var(--ink-5)',
        border: '1px solid var(--ink-10)',
        borderRadius: 8,
        color: 'var(--ink-60)',
        fontSize: 13,
        lineHeight: 1.6,
      }}>
        Nie wygenerowano FAQ, bo w artykule nie ma wystarczająco konkretnych sekcji ani odpowiedzi, z których można bezpiecznie ułożyć pytania. Dodaj w tekście fragmenty odpowiadające na realne pytania czytelników, a ContentProof wykorzysta je w FAQ.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {pack.faqSuggestions.map((f, i) => (
        <div key={i} style={{
          background: 'var(--ink-5)', borderRadius: 8,
          border: '1px solid var(--ink-10)', overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'flex-start',
            justifyContent: 'space-between', gap: 12,
            padding: '12px 14px',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: 'var(--ink)' }}>
                {f.question}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-60)', lineHeight: 1.55 }}>
                {f.answer}
              </div>
            </div>
            <CopyBtn
              text={copiedKey === `faq-text-${i}`}
              onClick={() => onCopy(`${f.question}\n${f.answer}`, `faq-text-${i}`)}
            />
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
        <CopyBtn
          text={copiedKey === 'faq-text-all'}
          onClick={() => onCopy(faqText, 'faq-text-all')}
        />
      </div>
    </div>
  );
}

// ─── Missing sections ─────────────────────────────────────────────────────────

function SectionsSection({ pack, copiedKey, onCopy }: {
  pack: ContentExpansionPack;
  copiedKey: string | null;
  onCopy: (t: string, k: string) => void;
}) {
  if (pack.missingSections.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: 6, color: 'var(--signal-green)' }}>
        <span style={{ fontSize: 24 }}>✓</span>
        <span style={{ fontSize: 13, fontWeight: 500 }}>Artykuł zawiera wszystkie kluczowe sekcje</span>
      </div>
    );
  }

  const sectionsText = pack.missingSections
    .map(s => `${s.heading}\n${s.why}`)
    .join('\n\n---\n\n');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pack.missingSections.map((s, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr auto',
              gap: 12, alignItems: 'flex-start',
              padding: '12px 14px',
              background: '#fff8f0', borderRadius: 8,
              border: '1px solid #fde8c8',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 3 }}>
                  {s.heading}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-60)', lineHeight: 1.5 }}>
                  {s.why}
                </div>
              </div>
              <CopyBtn
                text={copiedKey === `section-${i}`}
                onClick={() => onCopy(`${s.heading}\n${s.why}`, `section-${i}`)}
              />
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <CopyBtn text={copiedKey === 'sections-all'} onClick={() => onCopy(sectionsText, 'sections-all')} />
          </div>
    </div>
  );
}

// ─── Internal links ───────────────────────────────────────────────────────────

function LinksSection({ pack, copiedKey, onCopy }: {
  pack: ContentExpansionPack;
  copiedKey: string | null;
  onCopy: (t: string, k: string) => void;
}) {
  if (pack.internalLinkSuggestions.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: 6, color: 'var(--ink-60)' }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>Brak gotowych propozycji linków</span>
        <span style={{ fontSize: 12 }}>ContentProof nie tworzy linków do stron, których nie zna.</span>
      </div>
    );
  }

  const linksText = pack.internalLinkSuggestions
    .map(l => `${l.anchorText} → ${l.suggestedSlug}`)
    .join('\n');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pack.internalLinkSuggestions.map((l, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr auto',
              gap: 12, alignItems: 'center',
              padding: '10px 14px',
              background: 'var(--ink-5)', borderRadius: 8,
              border: '1px solid var(--ink-10)',
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
                  {l.anchorText}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-40)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  {l.suggestedSlug}
                </div>
              </div>
              <CopyBtn
                text={copiedKey === `link-${i}`}
                onClick={() => onCopy(l.anchorText, `link-${i}`)}
              />
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <CopyBtn text={copiedKey === 'links-all'} onClick={() => onCopy(linksText, 'links-all')} />
          </div>
    </div>
  );
}

// ─── Content gaps ─────────────────────────────────────────────────────────────

function GapsSection({ pack }: { pack: ContentExpansionPack }) {
  if (pack.contentGaps.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: 6, color: 'var(--signal-green)' }}>
        <span style={{ fontSize: 24 }}>✓</span>
        <span style={{ fontSize: 13, fontWeight: 500 }}>Nie wykryto istotnych braków tematycznych</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 12, color: 'var(--ink-60)', marginBottom: 4 }}>
        Te elementy są często oczekiwane przez czytelników i cenione przez Google. Rozważ dodanie ich do artykułu.
      </div>
      {pack.contentGaps.map((gap, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '10px 14px',
          background: '#fff8f0', borderRadius: 8,
          border: '1px solid #fde8c8',
        }}>
          <span style={{ color: 'var(--signal-amber)', fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚠</span>
          <span style={{ fontSize: 13, color: 'var(--ink)' }}>{gap}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExpansionPackPanel({ pack }: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sections' | 'faq' | 'links' | 'gaps'>('sections');

  // Reset state when pack content changes (new analysis)
  const packFingerprint = pack.faqSuggestions.map(f => f.question).join('|');
  useEffect(() => {
    setCopiedKey(null);
    setActiveTab('sections');
  }, [packFingerprint]);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  }

  const tabs = [
    { id: 'sections', label: 'Brakujące sekcje', count: pack.missingSections.length },
    { id: 'faq',      label: 'FAQ',               count: pack.faqSuggestions.length },
    { id: 'links',    label: 'Linki wewnętrzne',   count: pack.internalLinkSuggestions.length },
    { id: 'gaps',     label: 'Content gaps',       count: pack.contentGaps.length },
  ] as const;

  return (
    <div>
      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' as const }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px',
            background: activeTab === tab.id ? 'var(--ink)' : 'var(--ink-5)',
            color: activeTab === tab.id ? 'white' : 'var(--ink-60)',
            border: '1px solid', borderColor: activeTab === tab.id ? 'var(--ink)' : 'var(--ink-10)',
            borderRadius: 6, fontSize: 12, fontFamily: 'var(--font-sans)',
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                fontSize: 10, padding: '1px 5px', borderRadius: 10,
                background: activeTab === tab.id ? 'rgba(255,255,255,0.2)' : 'var(--ink-10)',
                color: activeTab === tab.id ? 'white' : 'var(--ink-60)',
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'sections' && <SectionsSection key={packFingerprint + '-s'} pack={pack} copiedKey={copiedKey} onCopy={copy} />}
      {activeTab === 'faq'      && <FaqSection      key={packFingerprint + '-f'} pack={pack} copiedKey={copiedKey} onCopy={copy} />}
      {activeTab === 'links'    && <LinksSection    key={packFingerprint + '-l'} pack={pack} copiedKey={copiedKey} onCopy={copy} />}
      {activeTab === 'gaps'     && <GapsSection     key={packFingerprint + '-g'} pack={pack} />}
    </div>
  );
}
