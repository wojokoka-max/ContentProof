/**
 * ContentProof — Score Engine
 * Calculates category scores, global Content Score, and publication status.
 * Completely independent from analyzers — takes CategoryResult[], returns scores.
 */

import type {
  CategoryResult,
  CategoryId,
  PublicationStatus,
  ScoringInput,
} from '../types';

// ─── Category Weights ─────────────────────────────────────────────────────────

/**
 * Weights must sum to 1.0.
 * Structure and SEO are highest — they're the most impactful on search performance.
 * AI Junk is penalizing but secondary.
 */
const CATEGORY_WEIGHTS: Record<CategoryId, number> = {
  'structure':   0.20,
  'seo-basics':  0.25,
  'linking':     0.15,
  'images':      0.15,
  'faq':         0.10,
  'readability': 0.10,
  'ai-junk':     0.05,
};

// ─── Thresholds ───────────────────────────────────────────────────────────────

const THRESHOLDS = {
  /** Category score below this = hard fail regardless of global score */
  CATEGORY_HARD_FAIL: 30,

  /** Global score for "ready to publish" */
  READY_TO_PUBLISH: 75,

  /** Global score for "needs improvement" */
  NEEDS_IMPROVEMENT: 50,

  /** Category status thresholds */
  CATEGORY_PASS: 80,
  CATEGORY_WARNING: 50,
};

// ─── Scoring ──────────────────────────────────────────────────────────────────

export interface ScoreResult {
  overallScore: number;
  publicationStatus: PublicationStatus;
  categoryScores: Record<CategoryId, number>;
  /** Categories that independently block publication */
  hardFails: CategoryId[];
}

/**
 * Calculate overall Content Score and publication status.
 * Pure function — no side effects.
 */
export function calculateScore(input: ScoringInput): ScoreResult {
  const { categories } = input;

  // Build category score map
  const categoryScores = {} as Record<CategoryId, number>;
  for (const cat of categories) {
    categoryScores[cat.category] = cat.score;
  }

  // Weighted overall score
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [categoryId, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    const id = categoryId as CategoryId;
    if (id in categoryScores) {
      weightedSum += categoryScores[id] * weight;
      totalWeight += weight;
    }
  }

  const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const overallScore = Math.round(Math.min(100, Math.max(0, rawScore)));

  // Hard fail detection — categories that block publication regardless of overall score
  const hardFails: CategoryId[] = categories
    .filter(cat => cat.score < THRESHOLDS.CATEGORY_HARD_FAIL)
    .map(cat => cat.category);

  const errorCount = categories
    .flatMap(cat => cat.findings)
    .filter(finding => finding.severity === 'error')
    .length;

  // Publication status
  const publicationStatus = derivePublicationStatus(overallScore, hardFails, errorCount);

  return {
    overallScore,
    publicationStatus,
    categoryScores,
    hardFails,
  };
}

function derivePublicationStatus(
  overallScore: number,
  hardFails: CategoryId[],
  errorCount: number
): PublicationStatus {
  // Any hard-failing category = do not publish
  if (hardFails.length > 0) return 'do-not-publish';
  if (errorCount > 0) return 'needs-improvement';

  if (overallScore >= THRESHOLDS.READY_TO_PUBLISH) return 'ready-to-publish';
  if (overallScore >= THRESHOLDS.NEEDS_IMPROVEMENT) return 'needs-improvement';
  return 'do-not-publish';
}

// ─── Category Status ──────────────────────────────────────────────────────────

export function deriveCategoryStatus(score: number): CategoryResult['status'] {
  if (score >= THRESHOLDS.CATEGORY_PASS) return 'pass';
  if (score >= THRESHOLDS.CATEGORY_WARNING) return 'warning';
  return 'fail';
}

// ─── Human-readable labels ────────────────────────────────────────────────────

export function publicationStatusLabel(status: PublicationStatus): string {
  switch (status) {
    case 'ready-to-publish': return 'Gotowy do publikacji';
    case 'needs-improvement': return 'Wymaga poprawy';
    case 'do-not-publish': return 'Nie publikuj';
  }
}

export function scoreGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}
