'use client';

import { useState } from 'react';

const CUSTOM_CSS = `/* ContentProof - Custom CSS do artykulu */
:where(.entry-content, .elementor-widget-theme-post-content, .contentproof-content) {
  color: #151515;
  font-size: 18px;
  line-height: 1.75;
}

:where(.entry-content, .elementor-widget-theme-post-content, .contentproof-content) h1,
:where(.entry-content, .elementor-widget-theme-post-content, .contentproof-content) h2,
:where(.entry-content, .elementor-widget-theme-post-content, .contentproof-content) h3 {
  color: #0a0a0a;
  line-height: 1.18;
  letter-spacing: 0;
  margin: 1.8em 0 0.65em;
}

:where(.entry-content, .elementor-widget-theme-post-content, .contentproof-content) h1 {
  font-size: clamp(34px, 5vw, 56px);
}

:where(.entry-content, .elementor-widget-theme-post-content, .contentproof-content) h2 {
  font-size: clamp(26px, 3.5vw, 38px);
}

:where(.entry-content, .elementor-widget-theme-post-content, .contentproof-content) h3 {
  font-size: clamp(21px, 2.5vw, 28px);
}

:where(.entry-content, .elementor-widget-theme-post-content, .contentproof-content) p,
:where(.entry-content, .elementor-widget-theme-post-content, .contentproof-content) li {
  max-width: 72ch;
}

:where(.entry-content, .elementor-widget-theme-post-content, .contentproof-content) ul,
:where(.entry-content, .elementor-widget-theme-post-content, .contentproof-content) ol {
  padding-left: 1.25em;
  margin: 0.8em 0 1.4em;
}

:where(.entry-content, .elementor-widget-theme-post-content, .contentproof-content) li + li {
  margin-top: 0.35em;
}

:where(.entry-content, .elementor-widget-theme-post-content, .contentproof-content) a {
  color: #1e63ff;
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.18em;
}

:where(.entry-content, .elementor-widget-theme-post-content, .contentproof-content) img {
  max-width: 100%;
  height: auto;
  border-radius: 12px;
}

:where(.entry-content, .elementor-widget-theme-post-content, .contentproof-content) table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.4em 0;
  font-size: 16px;
}

:where(.entry-content, .elementor-widget-theme-post-content, .contentproof-content) th,
:where(.entry-content, .elementor-widget-theme-post-content, .contentproof-content) td {
  border: 1px solid #e9e9e7;
  padding: 0.75em;
  text-align: left;
  vertical-align: top;
}

:where(.entry-content, .elementor-widget-theme-post-content, .contentproof-content) details {
  border: 1px solid #e9e9e7;
  border-radius: 10px;
  padding: 1em 1.1em;
  margin: 0.8em 0;
  background: #f7f7f5;
}

:where(.entry-content, .elementor-widget-theme-post-content, .contentproof-content) summary {
  cursor: pointer;
  font-weight: 700;
  color: #0a0a0a;
}

:where(.entry-content, .elementor-widget-theme-post-content, .contentproof-content) details p:last-child {
  margin-bottom: 0;
}

@media (max-width: 640px) {
  :where(.entry-content, .elementor-widget-theme-post-content, .contentproof-content) {
    font-size: 16px;
    line-height: 1.68;
  }
}`;

export function CustomCssPanel() {
  const [copied, setCopied] = useState(false);

  function copyCss() {
    navigator.clipboard.writeText(CUSTOM_CSS).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, margin: 0 }}>
            Kod CSS
          </h3>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-60)', fontSize: 12, lineHeight: 1.5 }}>
            Gotowy styl do wklejenia w Custom CSS motywu, Elementora albo panelu CMS.
          </p>
        </div>
        <button
          type="button"
          onClick={copyCss}
          style={{
            padding: '7px 14px',
            background: copied ? 'var(--signal-green)' : 'var(--ink)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {copied ? 'Skopiowano' : 'Kopiuj CSS'}
        </button>
      </div>

      <pre
        style={{
          margin: 0,
          padding: '14px 16px',
          background: '#0f0f0f',
          color: '#e4e2e0',
          borderRadius: 8,
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          lineHeight: 1.65,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: 520,
          overflowY: 'auto',
          border: '1px solid var(--ink-10)',
        }}
      >
        {CUSTOM_CSS}
      </pre>
    </section>
  );
}
