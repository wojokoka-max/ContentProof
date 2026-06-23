'use client';

import { useState } from 'react';
import type { AnalysisResult } from '@/lib/types';
import { ScoreRing }          from './ScoreRing';
import { CategoryCard }       from './CategoryCard';
import { Checklist }          from './Checklist';
import { FetchDebugPanel }    from './FetchDebugPanel';
import { SeoPackPanel }       from './SeoPackPanel';
import { ExpansionPackPanel } from './ExpansionPackPanel';
import { FixAllPanel }        from './FixAllPanel';

interface Props {
  result: AnalysisResult;
  onReset: () => void;
  onSave: () => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  canSave: boolean;
  saveHint: string;
  canExport: boolean;
  hasFullSeoPack: boolean;
}

const LANG_LABEL: Record<string, string> = { pl: 'Polski', en: 'Angielski' };
const MODE_LABEL: Record<string, string> = { article: 'Artykuł', html: 'HTML', url: 'URL' };
const MODE_COLOR: Record<string, string> = { text: 'var(--signal-green)', html: 'var(--ink-60)', url: 'var(--ink-60)' };

type MainTab = 'overview' | 'seo-pack' | 'expansion' | 'checklist';

export function AnalysisReport({
  result,
  onReset,
  onSave,
  saveStatus,
  canSave,
  saveHint,
  canExport,
  hasFullSeoPack,
}: Props) {
  const [mainTab, setMainTab] = useState<MainTab>('overview');

  const issueCount = result.checklist.filter(i => i.status !== 'pass').length;
  const totalImpact = result.checklist
    .filter(i => i.status !== 'pass' && i.impactPoints)
    .reduce((s, i) => s + (i.impactPoints ?? 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingBottom: 20, borderBottom: '1px solid var(--ink-10)', marginBottom: 20,
        flexWrap: 'wrap' as const, gap: 10,
      }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>
            Wynik analizy
          </h2>
          <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--ink-60)', fontFamily: 'var(--font-mono)', flexWrap: 'wrap' as const }}>
            <span>{result.meta.wordCount} słów</span>
            <span>·</span>
            <span style={{ color: MODE_COLOR[result.meta.analysisMode ?? 'text'], fontWeight: 500 }}>
              {result.meta.analysisMode === 'text' ? 'Tekst' : MODE_LABEL[result.meta.analysisMode ?? 'html']}
            </span>
            <span>·</span>
            <span>{LANG_LABEL[result.meta.language]}</span>
            <span>·</span>
            <span>{new Date(result.analyzedAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
        <div className="report-actions no-print">
          <button
            type="button"
            onClick={() => canExport && window.print()}
            disabled={!canExport}
            title={canExport ? 'Drukuj lub zapisz raport jako PDF' : 'Eksport PDF jest dostępny w Premium'}
            className="report-action-button"
          >
            {canExport ? 'Drukuj / PDF' : 'PDF · Premium'}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave || saveStatus === 'saving'}
            title={saveHint}
            className="report-action-button report-save-button"
          >
            {saveStatus === 'saving'
              ? 'Zapisywanie...'
              : saveStatus === 'saved'
                ? 'Zachowano'
                : saveStatus === 'error'
                  ? 'Spróbuj ponownie'
                  : 'Zachowaj analizę'}
          </button>
          <button type="button" onClick={onReset} className="report-action-button">
            ← Nowa analiza
          </button>
        </div>
      </div>

      {/* ── Fetch debug ─────────────────────────────────────────────────────── */}
      {result.fetchDebug && <FetchDebugPanel debug={result.fetchDebug} />}

      {/* ── Score strip ──────────────────────────────────────────────────────── */}
      <div className="animate-fade-up" style={{
        display: 'flex', alignItems: 'center', gap: 28,
        padding: '20px 24px', background: 'var(--ink-5)',
        borderRadius: 12, marginBottom: 20, flexWrap: 'wrap' as const,
      }}>
        <ScoreRing score={result.overallScore} status={result.publicationStatus} size={120} />
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' as const }}>
            <Pill count={result.summary.errors}   label="Błędy"       color="var(--signal-red)"   bg="var(--signal-red-bg)" />
            <Pill count={result.summary.warnings} label="Ostrzeżenia" color="var(--signal-amber)" bg="var(--signal-amber-bg)" />
            <Pill count={result.summary.infos}    label="Informacje"  color="var(--ink-60)"       bg="var(--ink-10)" />
            {totalImpact > 0 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--signal-green)', lineHeight: 1 }}>
                  +{totalImpact}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-60)', marginTop: 2 }}>możliwy wzrost</div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.categories.map(cat => (
              <MiniBar key={cat.category} label={cat.label} score={cat.score} status={cat.status} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Detected meta strip ──────────────────────────────────────────────── */}
      <MetaStrip result={result} />

      {/* ── Fix All ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <FixAllPanel key={result.analysisId} fixAll={result.fixAll} currentScore={result.overallScore} />
      </div>

      {/* ── Main tabs ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' as const }}>
        {([
          { id: 'overview',  label: 'Kategorie',  badge: null },
          { id: 'seo-pack',  label: 'SEO Pack',   badge: null },
          { id: 'expansion', label: 'Content Expansion', badge: null },
          { id: 'checklist', label: 'Checklista', badge: issueCount > 0 ? String(issueCount) : null },
        ] as const).map(tab => {
          const premiumLocked = !hasFullSeoPack && (tab.id === 'seo-pack' || tab.id === 'expansion');
          return (
          <button
            key={tab.id}
            onClick={() => !premiumLocked && setMainTab(tab.id)}
            disabled={premiumLocked}
            title={premiumLocked ? 'Pełny SEO Pack i rozbudowa treści są dostępne w Premium' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px',
              background: mainTab === tab.id ? 'var(--ink)' : 'var(--ink-5)',
              color: mainTab === tab.id ? 'white' : 'var(--ink-60)',
              border: '1px solid', borderColor: mainTab === tab.id ? 'var(--ink)' : 'var(--ink-10)',
              borderRadius: 7, fontSize: 13, fontFamily: 'var(--font-sans)',
              cursor: premiumLocked ? 'not-allowed' : 'pointer',
              opacity: premiumLocked ? 0.72 : 1,
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
            {premiumLocked && <span className="premium-mode-badge">Premium</span>}
            {tab.badge && (
              <span style={{
                fontSize: 10, padding: '1px 5px', borderRadius: 10,
                background: mainTab === tab.id ? 'rgba(255,255,255,0.2)' : 'var(--signal-red-bg)',
                color: mainTab === tab.id ? 'white' : 'var(--signal-red)',
              }}>
                {tab.badge}
              </span>
            )}
          </button>
          );
        })}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────────── */}
      {mainTab === 'overview' && (
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {result.categories.map((cat, i) => (
            <CategoryCard key={cat.category} result={cat} animationDelay={i * 50} />
          ))}
        </div>
      )}

      {mainTab === 'seo-pack' && (
        <div className="animate-fade-in">
          <SeoPackPanel key={result.analysisId} seoPack={result.seoPack} />
        </div>
      )}

      {mainTab === 'expansion' && (
        <div className="animate-fade-in">
          <ExpansionPackPanel key={result.analysisId} pack={result.expansionPack} />
        </div>
      )}

      {mainTab === 'checklist' && (
        <div className="animate-fade-in card">
          <Checklist items={result.checklist} showAll={false} />
        </div>
      )}

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetaStrip({ result }: { result: AnalysisResult }) {
  const generatedFromText = result.meta.analysisMode === 'text' && result.meta.metaInputMode === 'generate';
  const htmlFragment = result.meta.analysisMode === 'html' && result.meta.htmlScope === 'fragment';
  const missingMetaText = generatedFromText
    ? 'Gotowa propozycja znajduje się w SEO Pack'
    : htmlFragment
      ? 'Nie znaleziono w tym fragmencie HTML — propozycja znajduje się w SEO Pack'
      : 'Nie wykryto na stronie — propozycja znajduje się w SEO Pack';

  const items = [
    { label: 'H1', value: result.meta.detectedH1, icon: 'H1' },
    { label: 'Title', value: result.meta.detectedTitle, icon: 'T', fallback: missingMetaText },
    { label: 'Meta description', value: result.meta.detectedMetaDescription, icon: 'M', fallback: missingMetaText },
  ];

  return (
    <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-40)', letterSpacing: '0.05em', textTransform: 'uppercase' as const, marginBottom: 2 }}>
        Wykryte elementy
      </div>
      {items.map(item => (
        <div key={item.label} style={{
          display: 'grid', gridTemplateColumns: '90px 1fr',
          gap: 10, padding: '7px 12px',
          background: item.value ? 'var(--ink-5)' : 'transparent',
          border: '1px solid var(--ink-10)', borderRadius: 7,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 20, height: 20, borderRadius: 4,
              background: item.value ? 'var(--ink)' : 'var(--ink-10)',
              color: item.value ? 'white' : 'var(--ink-40)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700, flexShrink: 0,
            }}>
              {item.icon}
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink-60)', fontFamily: 'var(--font-mono)' }}>
              {item.label}
            </span>
          </div>
          <div style={{
            fontSize: 12, color: item.value ? 'var(--ink)' : 'var(--ink-40)',
            fontStyle: item.value ? 'normal' : 'italic',
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
            lineHeight: 1.5,
          }}>
            {item.value ?? item.fallback ?? '— nie wykryto'}
          </div>
        </div>
      ))}
    </div>
  );
}

function Pill({ count, label, color, bg }: { count: number; label: string; color: string; bg: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 12px', background: count > 0 ? bg : 'transparent', borderRadius: 8 }}>
      <div style={{ fontSize: 24, fontFamily: 'var(--font-display)', fontWeight: 700, color: count > 0 ? color : 'var(--ink-20)', lineHeight: 1 }}>
        {count}
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-60)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function MiniBar({ label, score, status }: { label: string; score: number; status: string }) {
  const color = status === 'pass' ? 'var(--signal-green)' : status === 'warning' ? 'var(--signal-amber)' : 'var(--signal-red)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--ink-60)', width: 76, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 3, background: 'var(--ink-10)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 2, transition: 'width 1s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-60)', width: 24, textAlign: 'right', flexShrink: 0 }}>
        {score}
      </span>
    </div>
  );
}
