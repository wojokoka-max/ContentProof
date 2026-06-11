/**
 * ContentProof — Engine Orchestrator v2.0
 * Runs analyzers, generates SEO Pack, Expansion Pack, Fix All report.
 */

import { parse } from './parser/htmlParser';
import { analyzeStructure }   from './analyzers/structure';
import { analyzeSeoBasics }   from './analyzers/seoBasics';
import { analyzeLinking }     from './analyzers/linking';
import { analyzeImages }      from './analyzers/images';
import { analyzeFaq }         from './analyzers/faq';
import { analyzeReadability } from './analyzers/readability';
import { analyzeAiJunk }      from './analyzers/aiJunk';
import { calculateScore }     from './scoring/scoreEngine';
import { generateSeoPack }    from './seoPackGenerator';
import { generateExpansionPack } from './expansionPackGenerator';

import type {
  AnalysisResult, CategoryResult, ChecklistItem,
  Finding, Analyzer, FixAllReport, StructuredContent,
  MetaInput,
} from './types';

const ANALYZERS: Analyzer[] = [
  analyzeStructure, analyzeSeoBasics, analyzeLinking,
  analyzeImages, analyzeFaq, analyzeReadability, analyzeAiJunk,
];

// ─── Impact Points ────────────────────────────────────────────────────────────

/** Category weights used in scoring — mirrors scoreEngine.ts */
const CATEGORY_WEIGHTS: Record<string, number> = {
  'structure':   0.20,
  'seo-basics':  0.25,
  'linking':     0.15,
  'images':      0.15,
  'faq':         0.10,
  'readability': 0.10,
  'ai-junk':     0.05,
};

/** Estimate score impact of fixing a finding */
function estimateImpact(finding: Finding, categoryScore: number): number {
  const weight = CATEGORY_WEIGHTS[finding.category] ?? 0.10;
  const severityMultiplier = finding.severity === 'error' ? 1.0 : finding.severity === 'warning' ? 0.5 : 0.2;
  // Rough formula: how much would category improve × weight
  const categoryImpact = finding.severity === 'error'
    ? Math.min(40, 100 - categoryScore) // errors can fix a lot
    : finding.severity === 'warning'
    ? Math.min(20, 100 - categoryScore)
    : Math.min(10, 100 - categoryScore);

  const globalImpact = Math.round(categoryImpact * weight * severityMultiplier);
  return Math.max(1, Math.min(globalImpact, 15)); // cap at 15 pts per finding
}

function attachImpactPoints(categories: CategoryResult[]): CategoryResult[] {
  return categories.map(cat => ({
    ...cat,
    findings: cat.findings.map(finding => ({
      ...finding,
      impactPoints: finding.ruleId.endsWith('.not-applicable') || finding.ruleId.endsWith('.too-short-to-analyze')
        ? undefined
        : estimateImpact(finding, cat.score),
    })),
  }));
}

// ─── Checklist ────────────────────────────────────────────────────────────────

function buildChecklist(categories: CategoryResult[]): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  for (const cat of categories) {
    const actionable = cat.findings.filter(finding =>
      finding.severity !== 'info' &&
      !finding.ruleId.endsWith('.not-applicable') &&
      !finding.ruleId.endsWith('.too-short-to-analyze')
    );

    for (const finding of actionable) {
      items.push({
        ruleId: finding.ruleId,
        category: cat.category,
        label: finding.title,
        status: finding.severity === 'error' ? 'fail' : 'warning',
        action: finding.recommendation,
        impactPoints: finding.impactPoints,
      });
    }

    if (actionable.length === 0) {
      items.push({
        ruleId: `${cat.category}.all-pass`,
        category: cat.category,
        label: `${cat.label} — wszystkie reguły spełnione`,
        status: 'pass',
      });
    }
  }

  const order = { fail: 0, warning: 1, pass: 2 };
  items.sort((a, b) => order[a.status] - order[b.status]);
  return items;
}

// ─── Fix All Report ───────────────────────────────────────────────────────────

function buildFixAll(
  content: StructuredContent,
  seoPack: ReturnType<typeof generateSeoPack>,
  expansion: ReturnType<typeof generateExpansionPack>,
  currentScore: number,
  categories: CategoryResult[]
): FixAllReport {
  // Predict new score: fix all errors and warnings
  const totalImpact = categories
    .flatMap(c => c.findings)
    .filter(f => f.impactPoints && (f.severity === 'error' || f.severity === 'warning'))
    .reduce((sum, f) => sum + (f.impactPoints ?? 0), 0);

  const predictedNewScore = Math.min(98, currentScore + totalImpact);

  const internalLinksText = expansion.internalLinkSuggestions
    .map(l => `${l.anchorText} → ${l.suggestedSlug}`)
    .join('\n');

  return {
    title: seoPack.title,
    metaDescription: seoPack.metaDescription,
    faqText: expansion.faqText,
    headingsText: expansion.headingsText,
    internalLinksText,
    predictedNewScore,
  };
}

// ─── Summary ──────────────────────────────────────────────────────────────────

function buildSummary(findings: Finding[]) {
  return {
    errors:   findings.filter(f => f.severity === 'error').length,
    warnings: findings.filter(f => f.severity === 'warning').length,
    infos:    findings.filter(f => f.severity === 'info').length,
  };
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export function analyze(
  raw: string,
  forcedMode?: import('./types').InputMode,
  analysisId = crypto.randomUUID(),
  metaInput?: MetaInput,
  sourceUrl?: string
): AnalysisResult {
  const content = parse(raw, forcedMode, metaInput, sourceUrl);

  let categories: CategoryResult[] = ANALYZERS.map(analyzer => {
    try {
      return analyzer(content);
    } catch (err) {
      console.error('Analyzer failed:', err);
      return {
        category: 'structure' as const, label: 'Unknown',
        score: 50, status: 'warning' as const, findings: [], llmEnhanced: false,
      };
    }
  });

  categories = attachImpactPoints(categories);

  const scoreResult = calculateScore({ categories, wordCount: content.wordCount });
  const allFindings = categories.flatMap(cat => cat.findings);

  const expansionPack = generateExpansionPack(content);
  const seoPack = generateSeoPack(content, expansionPack.faqSuggestions);
  const fixAll = buildFixAll(content, seoPack, expansionPack, scoreResult.overallScore, categories);

  const implicitH1Safe = content.implicitH1 && /^https?:\/\//i.test(content.implicitH1)
    ? null : content.implicitH1;

  const detectedH1 = content.headings.find(h => h.level === 1)?.text ?? implicitH1Safe ?? null;

  return {
    analysisId,
    analyzedAt: new Date().toISOString(),
    overallScore: scoreResult.overallScore,
    publicationStatus: scoreResult.publicationStatus,
    categories,
    checklist: buildChecklist(categories),
    summary: buildSummary(allFindings),
    seoPack,
    expansionPack,
    fixAll,
    meta: {
      wordCount: content.wordCount,
      language: content.language,
      inputType: content.inputType,
      detectedH1,
      detectedTitle: content.metaTitle,
      detectedMetaDescription: content.metaDescription,
      metaInputMode: content.metaInputMode,
      analysisMode: content.analysisMode,
      htmlScope: content.htmlScope,
    },
  };
}
