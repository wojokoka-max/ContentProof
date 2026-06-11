'use client';

import { useEffect, useState } from 'react';
import type { PublicationStatus } from '@/lib/types';

interface Props {
  score: number;
  status: PublicationStatus;
  size?: number;
}

const STATUS_COLOR: Record<PublicationStatus, string> = {
  'ready-to-publish': '#1a7a4a',
  'needs-improvement': '#92580a',
  'do-not-publish':   '#9b1c1c',
};

const STATUS_LABEL: Record<PublicationStatus, string> = {
  'ready-to-publish': 'Gotowy do publikacji',
  'needs-improvement': 'Wymaga poprawy',
  'do-not-publish':   'Nie publikuj',
};

const STATUS_BG: Record<PublicationStatus, string> = {
  'ready-to-publish': 'var(--signal-green-bg)',
  'needs-improvement': 'var(--signal-amber-bg)',
  'do-not-publish':   'var(--signal-red-bg)',
};

export function ScoreRing({ score, status, size = 140 }: Props) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, [score]);

  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = animated ? score / 100 : 0;
  const offset = circumference * (1 - progress);
  const color = STATUS_COLOR[status];
  const cx = size / 2;

  return (
    <div className="flex flex-col items-center gap-4">
      <div style={{ width: size, height: size, position: 'relative' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle
            cx={cx} cy={cx} r={radius}
            fill="none"
            stroke="var(--ink-10)"
            strokeWidth={stroke}
          />
          {/* Fill */}
          <circle
            cx={cx} cy={cx} r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1)' }}
          />
        </svg>
        {/* Center label */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 2,
        }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: size * 0.22,
            fontWeight: 700,
            color: 'var(--ink)',
            lineHeight: 1,
          }}>
            {score}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-60)',
            letterSpacing: '0.05em',
          }}>
            /100
          </span>
        </div>
      </div>

      {/* Status badge */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 14px',
        borderRadius: 100,
        background: STATUS_BG[status],
        color,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase' as const,
      }}>
        <span style={{
          width: 6, height: 6,
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
        }} />
        {STATUS_LABEL[status]}
      </div>
    </div>
  );
}
