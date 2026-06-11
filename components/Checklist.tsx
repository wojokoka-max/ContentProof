'use client';

import type { ChecklistItem, CategoryId } from '@/lib/types';

const CATEGORY_LABELS: Record<CategoryId, string> = {
  'structure':   'Struktura',
  'seo-basics':  'SEO',
  'linking':     'Linkowanie',
  'images':      'Obrazy',
  'faq':         'FAQ',
  'readability': 'Czytelność',
  'ai-junk':     'AI Junk',
};

const STATUS_STYLES = {
  fail: {
    icon: '✕',
    iconColor: 'var(--signal-red)',
    iconBg: 'var(--signal-red-bg)',
  },
  warning: {
    icon: '⚠',
    iconColor: 'var(--signal-amber)',
    iconBg: 'var(--signal-amber-bg)',
  },
  pass: {
    icon: '✓',
    iconColor: 'var(--signal-green)',
    iconBg: 'var(--signal-green-bg)',
  },
};

interface Props {
  items: ChecklistItem[];
  /** Show only non-pass items by default */
  showAll?: boolean;
}

export function Checklist({ items, showAll = false }: Props) {
  const visible = showAll ? items : items.filter(i => i.status !== 'pass');
  const passCount = items.filter(i => i.status === 'pass').length;

  if (visible.length === 0 && passCount > 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 0',
        gap: 8,
        color: 'var(--signal-green)',
      }}>
        <span style={{ fontSize: 32 }}>✓</span>
        <span style={{ fontWeight: 600, fontSize: 15 }}>Wszystkie reguły spełnione</span>
        <span style={{ fontSize: 13, color: 'var(--ink-60)' }}>{passCount} sprawdzonych punktów</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {visible.map((item, i) => {
        const s = STATUS_STYLES[item.status];
        return (
          <div
            key={item.ruleId}
            className="animate-slide-in"
            style={{
              display: 'grid',
              gridTemplateColumns: '28px 1fr',
              gap: 12,
              alignItems: 'flex-start',
              padding: '11px 0',
              borderBottom: i < visible.length - 1 ? '1px solid var(--ink-10)' : 'none',
              animationDelay: `${i * 30}ms`,
            }}
          >
            {/* Icon */}
            <div style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: s.iconBg,
              color: s.iconColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
              marginTop: 1,
            }}>
              {s.icon}
            </div>

            {/* Content */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</span>
                <span style={{
                  fontSize: 10,
                  color: 'var(--ink-40)',
                  background: 'var(--ink-5)',
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.03em',
                }}>
                  {CATEGORY_LABELS[item.category]}
                </span>
              </div>
              {item.action && (
                <div style={{
                  marginTop: 4,
                  fontSize: 12,
                  color: 'var(--ink-60)',
                  lineHeight: 1.5,
                }}>
                  {item.action}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Pass summary */}
      {!showAll && passCount > 0 && (
        <div style={{
          marginTop: 12,
          fontSize: 12,
          color: 'var(--ink-40)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{ color: 'var(--signal-green)', fontSize: 13 }}>✓</span>
          {passCount} {passCount === 1 ? 'reguła spełniona' : 'reguł spełnionych'}
        </div>
      )}
    </div>
  );
}
