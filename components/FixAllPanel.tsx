'use client';

import { useState } from 'react';
import type { FixAllReport } from '@/lib/types';

interface Props {
  fixAll: FixAllReport;
  currentScore: number;
}

function CopyBtn({ copied, onClick, label = 'Kopiuj' }: { copied: boolean; onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', flexShrink: 0,
      background: copied ? 'var(--signal-green)' : 'var(--ink)',
      color: 'white', border: 'none', borderRadius: 6,
      fontSize: 11, fontFamily: 'var(--font-mono)',
      cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' as const,
    }}>
      {copied ? '✓ skopiowano' : label}
    </button>
  );
}

// ─── Fix blocks ───────────────────────────────────────────────────────────────

function FixBlock({ title, textContent, copyKey, copiedKey, onCopy }: {
  title: string;
  textContent: string;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (t: string, k: string) => void;
}) {
  return (
    <div style={{ border: '1px solid var(--ink-10)', borderRadius: 9, overflow: 'hidden', marginBottom: 6 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', background: 'var(--ink-5)',
        borderBottom: '1px solid var(--ink-10)',
      }}>
        <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600 }}>{title}</span>
        <CopyBtn
          copied={copiedKey === copyKey}
          onClick={() => onCopy(textContent, copyKey)}
        />
      </div>

      <div style={{ padding: '12px 14px' }}>
        <div style={{
          fontSize: 13, color: 'var(--ink)', lineHeight: 1.7,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          padding: '10px 12px',
          background: 'var(--ink-5)', borderRadius: 6,
          border: '1px solid var(--ink-10)',
        }}>
          {textContent}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function FixAllPanel({ fixAll, currentScore }: Props) {
  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  }

  const predictedScore = Math.max(currentScore, fixAll.predictedNewScore);
  const gain = predictedScore - currentScore;

  const faqText = fixAll.faqText;

  const headingsText = fixAll.headingsText.trim();
  const linksText = fixAll.internalLinksText.trim();

  return (
    <div>
      {/* CTA Button */}
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        background: open ? 'var(--ink-5)' : 'var(--ink)',
        color: open ? 'var(--ink)' : 'white',
        border: `1.5px solid ${open ? 'var(--ink-20)' : 'var(--ink)'}`,
        borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <div style={{ textAlign: 'left' as const }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>
              Napraw wszystko
            </div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 1 }}>
              Gotowe propozycje tekstów do skopiowania
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {gain > 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '4px 10px',
              background: open ? 'var(--signal-green-bg)' : 'rgba(255,255,255,0.15)',
              borderRadius: 6,
            }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: open ? 'var(--signal-green)' : 'white' }}>
                +{gain} pkt
              </span>
              <span style={{ fontSize: 9, opacity: 0.8, color: open ? 'var(--signal-green)' : 'white' }}>
                przewidywany wzrost
              </span>
            </div>
          )}
          <svg width={14} height={14} viewBox="0 0 14 14" fill="none"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
            <path d="M2 5l5 4 5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>

      {/* Expanded report */}
      {open && (
        <div className="animate-fade-up" style={{ marginTop: 8 }}>

          {/* Score prediction */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', marginBottom: 10,
            background: 'var(--signal-green-bg)',
            border: '1px solid #b7f5d4', borderRadius: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 700 }}>{currentScore}</span>
              <span style={{ fontSize: 16, color: 'var(--ink-40)' }}>→</span>
              <span style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--signal-green)' }}>{predictedScore}</span>
              <span style={{ fontSize: 12, color: 'var(--ink-60)' }}>/100</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-60)', lineHeight: 1.4 }}>
              {gain > 0
                ? 'Przewidywany wynik po zastosowaniu wszystkich poprawek.'
                : 'Wynik jest już bardzo wysoki. Poprawki porządkują tekst i SEO, ale nie powinny obniżyć oceny.'}
            </div>
          </div>

          <FixBlock
            title="SEO Title"
            textContent={fixAll.title}
            copyKey="fix-title" copiedKey={copiedKey} onCopy={copy}
          />

          <FixBlock
            title="Meta Description"
            textContent={fixAll.metaDescription}
            copyKey="fix-desc" copiedKey={copiedKey} onCopy={copy}
          />

          {faqText.trim() && (
            <FixBlock
              title="FAQ — pytania i odpowiedzi"
              textContent={faqText}
              copyKey="fix-faq" copiedKey={copiedKey} onCopy={copy}
            />
          )}

          {headingsText && (
            <FixBlock
              title="Brakujące nagłówki sekcji"
              textContent={headingsText}
              copyKey="fix-headings" copiedKey={copiedKey} onCopy={copy}
            />
          )}

          {linksText && (
            <FixBlock
              title="Linki wewnętrzne"
              textContent={linksText}
              copyKey="fix-links" copiedKey={copiedKey} onCopy={copy}
            />
          )}

        </div>
      )}
    </div>
  );
}
