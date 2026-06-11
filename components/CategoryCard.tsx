'use client';

import { useState } from 'react';
import type { CategoryResult, Finding } from '@/lib/types';

const STATUS_COLOR = {
  pass:    { bar: '#1a7a4a', bg: 'var(--signal-green-bg)', text: 'var(--signal-green)' },
  warning: { bar: '#92580a', bg: 'var(--signal-amber-bg)', text: 'var(--signal-amber)' },
  fail:    { bar: '#9b1c1c', bg: 'var(--signal-red-bg)',   text: 'var(--signal-red)' },
};

const SEVERITY_ICON: Record<Finding['severity'], string> = {
  error: '✕', warning: '⚠', info: '·',
};
const SEVERITY_COLOR: Record<Finding['severity'], string> = {
  error: 'var(--signal-red)', warning: 'var(--signal-amber)', info: 'var(--ink-40)',
};

interface Props {
  result: CategoryResult;
  animationDelay?: number;
}

export function CategoryCard({ result, animationDelay = 0 }: Props) {
  const [open, setOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const colors = STATUS_COLOR[result.status];
  const actionableFindings = result.findings.filter(
    f => !f.ruleId.endsWith('.not-applicable') && !f.ruleId.endsWith('.too-short-to-analyze')
  );
  const hasFindings = actionableFindings.length > 0;

  function copyCode(code: string, id: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  return (
    <div className="animate-fade-up" style={{ animationDelay: `${animationDelay}ms` }}>
      {/* Header card */}
      <div
        className="card-sm"
        style={{ cursor: hasFindings ? 'pointer' : 'default' }}
        onClick={() => hasFindings && setOpen(o => !o)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{
            minWidth: 44, textAlign: 'center',
            background: colors.bg, color: colors.text,
            borderRadius: 6, padding: '2px 8px',
            fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 13,
          }}>
            {result.score}
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, flex: 1 }}>
            {result.label}
          </span>
          {hasFindings && (
            <span style={{ fontSize: 11, color: 'var(--ink-60)', background: 'var(--ink-5)', padding: '2px 7px', borderRadius: 20 }}>
              {actionableFindings.length} {actionableFindings.length === 1 ? 'uwaga' : 'uwagi'}
            </span>
          )}
          {hasFindings && (
            <svg width={14} height={14} viewBox="0 0 14 14" fill="none"
              style={{ color: 'var(--ink-40)', transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>
              <path d="M2 5l5 4 5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        <div style={{ height: 4, background: 'var(--ink-10)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${result.score}%`, background: colors.bar, borderRadius: 2, transition: 'width 0.9s cubic-bezier(.16,1,.3,1)' }} />
        </div>
      </div>

      {/* Findings panel */}
      {open && hasFindings && (
        <div className="animate-fade-in" style={{ marginTop: 4, background: 'var(--ink-5)', borderRadius: 'var(--radius-md)' }}>
          {actionableFindings.map((finding, i) => (
            <FindingBlock
              key={finding.ruleId}
              finding={finding}
              isLast={i === actionableFindings.length - 1}
              animationDelay={i * 40}
              copiedId={copiedId}
              onCopy={copyCode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FindingBlock ──────────────────────────────────────────────────────────────

function FindingBlock({ finding, isLast, animationDelay, copiedId, onCopy }: {
  finding: Finding;
  isLast: boolean;
  animationDelay: number;
  copiedId: string | null;
  onCopy: (code: string, id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const severityColor = {
    error: 'var(--signal-red)', warning: 'var(--signal-amber)', info: 'var(--ink-40)',
  }[finding.severity];

  const hasDetails = !!(finding.why || finding.fixExample || finding.fixCode);

  return (
    <div
      className="animate-slide-in"
      style={{
        padding: '16px 16px',
        borderBottom: isLast ? 'none' : '1px solid var(--ink-10)',
        animationDelay: `${animationDelay}ms`,
      }}
    >
      {/* Top row: icon + title */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 12,
          color: severityColor, fontWeight: 700,
          marginTop: 1, flexShrink: 0, width: 14, textAlign: 'center',
        }}>
          {SEVERITY_ICON[finding.severity]}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Title */}
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', marginBottom: 6 }}>
            {finding.title}
          </div>

          {/* Problem section */}
          <Section label="Problem">
            <p style={prose}>{finding.description}</p>
          </Section>

          {/* Why section */}
          {finding.why && (
            <Section label="Dlaczego to ważne">
              <p style={prose}>{finding.why}</p>
            </Section>
          )}

          {/* Context chip */}
          {finding.context && (
            <div style={{
              margin: '8px 0',
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--ink-60)', background: 'var(--ink-10)',
              borderRadius: 4, padding: '4px 8px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {finding.context}
            </div>
          )}

          {/* Recommendation */}
          {finding.recommendation && (
            <Section label="Jak naprawić">
              <p style={{ ...prose, color: 'var(--ink)' }}>
                <span style={{ color: 'var(--ink-60)' }}>→ </span>
                {finding.recommendation}
              </p>
            </Section>
          )}

          {/* Fix example */}
          {finding.fixExample && (
            <Section label="Przykład">
              <p style={prose}>{finding.fixExample}</p>
            </Section>
          )}

          {/* Fix code */}
          {finding.fixCode && (
            <Section label="Gotowy kod">
              <div style={{ position: 'relative' }}>
                <pre style={{
                  margin: 0,
                  padding: '10px 12px',
                  background: 'var(--ink)',
                  color: '#e4e2e0',
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  lineHeight: 1.6,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {finding.fixCode}
                </pre>
                <button
                  onClick={() => onCopy(finding.fixCode!, finding.ruleId)}
                  style={{
                    position: 'absolute', top: 6, right: 6,
                    padding: '3px 8px',
                    background: copiedId === finding.ruleId ? 'var(--signal-green)' : 'rgba(255,255,255,0.12)',
                    color: copiedId === finding.ruleId ? 'white' : '#ccc',
                    border: 'none', borderRadius: 4,
                    fontSize: 10, fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {copiedId === finding.ruleId ? '✓ skopiowano' : 'kopiuj'}
                </button>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
        textTransform: 'uppercase' as const,
        color: 'var(--ink-40)', marginBottom: 3,
        fontFamily: 'var(--font-mono)',
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const prose: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: 'var(--ink-60)',
  lineHeight: 1.55,
};
