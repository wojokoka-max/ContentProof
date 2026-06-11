'use client';

import { useState } from 'react';
import type { SeoPack } from '@/lib/types';

interface Props {
  seoPack: SeoPack;
}

const CONTENT_TYPE_LABEL: Record<string, string> = {
  'article':   'Artykuł',
  'blog-post': 'Blog Post',
  'faq-page':  'FAQ Page',
  'how-to':    'How-To',
  'generic':   'Strona',
};

type RowTab = 'tekst' | 'html';

function CopyBtn({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '3px 10px', flexShrink: 0,
      background: copied ? 'var(--signal-green-bg)' : 'var(--ink-5)',
      color: copied ? 'var(--signal-green)' : 'var(--ink-60)',
      border: `1px solid ${copied ? 'var(--signal-green)' : 'var(--ink-10)'}`,
      borderRadius: 5, fontSize: 11, fontFamily: 'var(--font-mono)',
      cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' as const,
    }}>
      {copied ? '✓' : 'Kopiuj'}
    </button>
  );
}

function SeoRow({ label, textValue, htmlCode, badge, badgeOk, copyKey, copiedKey, onCopy, mono }: {
  label: string;
  textValue: string;
  htmlCode: string;
  badge?: string;
  badgeOk?: boolean;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (t: string, k: string) => void;
  mono?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<RowTab>('tekst');

  return (
    <div style={{ border: '1px solid var(--ink-10)', borderRadius: 8, overflow: 'hidden' }}>
      {/* Collapsed header */}
      <div onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', cursor: 'pointer',
        background: open ? 'var(--ink-5)' : 'white',
        transition: 'background 0.15s',
      }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-60)', width: 120, flexShrink: 0 }}>
          {label}
        </span>
        <span style={{
          fontSize: 12, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
          color: 'var(--ink)',
        }}>
          {textValue}
        </span>
        {badge && (
          <span style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 4, flexShrink: 0,
            background: badgeOk === undefined ? 'var(--ink-5)' : badgeOk ? 'var(--signal-green-bg)' : 'var(--signal-amber-bg)',
            color: badgeOk === undefined ? 'var(--ink-60)' : badgeOk ? 'var(--signal-green)' : 'var(--signal-amber)',
            fontFamily: 'var(--font-mono)',
          }}>
            {badge}
          </span>
        )}
        <div onClick={e => { e.stopPropagation(); onCopy(tab === 'html' ? htmlCode : textValue, copyKey); }}>
          <CopyBtn copied={copiedKey === copyKey} onClick={() => {}} />
        </div>
        <svg width={12} height={12} viewBox="0 0 12 12" fill="none"
          style={{ color: 'var(--ink-40)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Expanded */}
      {open && (
        <div style={{ borderTop: '1px solid var(--ink-10)', padding: '12px 14px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 10 }}>
            {(['tekst', 'html'] as RowTab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '4px 11px',
                background: tab === t ? 'var(--ink)' : 'var(--ink-5)',
                color: tab === t ? 'white' : 'var(--ink-60)',
                border: '1px solid', borderColor: tab === t ? 'var(--ink)' : 'var(--ink-10)',
                borderRadius: 5, fontSize: 11, fontFamily: 'var(--font-sans)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {t === 'tekst' ? '✦ Tekst' : '</> HTML'}
              </button>
            ))}
          </div>

          {tab === 'tekst' && (
            <div style={{
              fontSize: 13, color: 'var(--ink)', lineHeight: 1.7,
              padding: '10px 12px',
              background: 'var(--ink-5)', borderRadius: 6,
              border: '1px solid var(--ink-10)',
              fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
              wordBreak: 'break-all',
            }}>
              {textValue}
            </div>
          )}

          {tab === 'html' && (
            <div style={{ position: 'relative' }}>
              <pre style={{
                margin: 0, padding: '10px 12px',
                background: '#0f0f0f', color: '#e4e2e0',
                borderRadius: 6, fontSize: 11,
                fontFamily: 'var(--font-mono)', lineHeight: 1.7,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                maxHeight: 150, overflowY: 'auto',
              }}>
                {htmlCode}
              </pre>
              <button onClick={() => onCopy(htmlCode, `${copyKey}-html`)} style={{
                position: 'absolute', top: 7, right: 7,
                padding: '3px 8px',
                background: copiedKey === `${copyKey}-html` ? 'var(--signal-green)' : 'rgba(255,255,255,0.12)',
                color: copiedKey === `${copyKey}-html` ? 'white' : '#ccc',
                border: 'none', borderRadius: 4, fontSize: 10,
                fontFamily: 'var(--font-mono)', cursor: 'pointer',
              }}>
                {copiedKey === `${copyKey}-html` ? '✓' : 'kopiuj'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SeoPackPanel({ seoPack }: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  }

  const titleOk = seoPack.titleLength >= 30 && seoPack.titleLength <= 60;
  const descOk  = seoPack.metaDescriptionLength >= 70 && seoPack.metaDescriptionLength <= 160;
  const schemaType = (() => {
    try {
      const parsed = JSON.parse(seoPack.jsonLd) as { '@type'?: string };
      return parsed['@type'] ?? 'Schema';
    } catch {
      return 'Schema';
    }
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>SEO Pack</span>
          <span style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 4,
            background: 'var(--ink-5)', color: 'var(--ink-60)',
            fontFamily: 'var(--font-mono)',
          }}>
            {CONTENT_TYPE_LABEL[seoPack.contentType]}
          </span>
        </div>
        <button onClick={() => copy(seoPack.headBlock, 'all')} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 14px',
          background: copiedKey === 'all' ? 'var(--signal-green)' : 'var(--ink)',
          color: 'white', border: 'none', borderRadius: 8,
          fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-display)',
          cursor: 'pointer', transition: 'all 0.2s',
        }}>
          {copiedKey === 'all' ? '✓ Skopiowano' : 'Kopiuj cały blok <head>'}
        </button>
      </div>

      <SeoRow label="SEO Title"        textValue={seoPack.title}           htmlCode={`<title>${seoPack.title}</title>`}                              badge={`${seoPack.titleLength} zn.`} badgeOk={titleOk} copyKey="title"    copiedKey={copiedKey} onCopy={copy} />
      <SeoRow label="Meta Description" textValue={seoPack.metaDescription} htmlCode={`<meta name="description" content="${seoPack.metaDescription}">`} badge={`${seoPack.metaDescriptionLength} zn.`} badgeOk={descOk}  copyKey="desc"     copiedKey={copiedKey} onCopy={copy} />
      <SeoRow label="Canonical URL"    textValue={seoPack.canonical}       htmlCode={`<link rel="canonical" href="${seoPack.canonical}">`}             copyKey="canonical" copiedKey={copiedKey} onCopy={copy} mono />
      <SeoRow label="Open Graph"       textValue={`${seoPack.ogTags.title} | ${seoPack.ogTags.type}`} htmlCode={`<meta property="og:type" content="${seoPack.ogTags.type}">\n<meta property="og:title" content="${seoPack.ogTags.title}">\n<meta property="og:description" content="${seoPack.ogTags.description}">\n<meta property="og:url" content="${seoPack.canonical}">`} copyKey="og" copiedKey={copiedKey} onCopy={copy} />
      <SeoRow label="Twitter Card"     textValue={seoPack.twitterCard.title} htmlCode={`<meta name="twitter:card" content="${seoPack.twitterCard.card}">\n<meta name="twitter:title" content="${seoPack.twitterCard.title}">\n<meta name="twitter:description" content="${seoPack.twitterCard.description}">`} copyKey="twitter" copiedKey={copiedKey} onCopy={copy} />
      <SeoRow label="Robots"           textValue={seoPack.robotsMeta}      htmlCode={`<meta name="robots" content="${seoPack.robotsMeta}">`}          copyKey="robots"    copiedKey={copiedKey} onCopy={copy} mono />

      {/* Schema — special: has JSON tab */}
      <div style={{ border: '1px solid var(--ink-10)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', background: 'var(--ink-5)',
          borderBottom: '1px solid var(--ink-10)',
        }}>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-60)' }}>JSON-LD Schema</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--ink-60)' }}>
              @type: {schemaType}
            </span>
            <button onClick={() => copy(`<script type="application/ld+json">\n${seoPack.jsonLd}\n</script>`, 'schema')} style={{
              padding: '3px 10px',
              background: copiedKey === 'schema' ? 'var(--signal-green)' : 'var(--ink)',
              color: 'white', border: 'none', borderRadius: 5,
              fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer',
            }}>
              {copiedKey === 'schema' ? '✓' : 'Kopiuj'}
            </button>
          </div>
        </div>
        <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--ink-60)', lineHeight: 1.5 }}>
          {'Dodaj poniższy kod do sekcji '}
          <code style={{ background: 'var(--ink-5)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 11 }}>&lt;head&gt;</code>
          {' swojej strony lub w panelu CMS w polu "nagłówek strony".'}
        </div>
        <div style={{ position: 'relative', margin: '0 14px 14px' }}>
          <pre style={{
            margin: 0, padding: '10px 12px',
            background: '#0f0f0f', color: '#e4e2e0',
            borderRadius: 6, fontSize: 11,
            fontFamily: 'var(--font-mono)', lineHeight: 1.6,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            maxHeight: 260, overflowY: 'auto',
          }}>
            {`<script type="application/ld+json">\n${seoPack.jsonLd}\n</script>`}
          </pre>
        </div>
      </div>
    </div>
  );
}
