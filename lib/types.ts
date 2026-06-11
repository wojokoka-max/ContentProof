/**
 * ContentProof — Core Types v2.0
 * Platform contract. All modules import from here.
 *
 * Version history:
 *   1.0.0 — Phase 1 MVP
 *   1.1.0 — Extended Finding (why, fixExample, fixCode)
 *   2.0.0 — SEO Pack, Content Expansion Pack, Fix Impact scores
 */

export type SupportedLanguage = 'pl' | 'en';

// ─── Input Mode ───────────────────────────────────────────────────────────────

/** How the user provided the content */
export type InputMode = 'text' | 'html' | 'url';
export type MetaInputMode = 'generate' | 'provided';
export type HtmlScope = 'fragment' | 'document';

export interface MetaInput {
  mode: MetaInputMode;
  title: string;
  description: string;
}

// ─── Structured Content ───────────────────────────────────────────────────────

export interface StructuredContent {
  raw: string;
  analysisHtml: string | null;
  htmlScope: HtmlScope | null;
  inputType: 'html' | 'text';
  language: SupportedLanguage;
  plainText: string;
  wordCount: number;
  headings: Heading[];
  paragraphs: Paragraph[];
  links: Link[];
  images: Image[];
  faqItems: FaqItem[];
  metaTitle: string | null;
  metaDescription: string | null;
  metaInputMode: MetaInputMode | 'detected';
  canonical: string | null;
  sentences: string[];
  implicitH1: string | null;
  /** Analysis mode — determines which checks apply */
  analysisMode: InputMode;
  /** Plain text headings detected heuristically (for article mode) */
  textHeadings: TextHeading[];
  /** FAQ detected from plain text patterns */
  textFaqItems: FaqItem[];
}

export interface TextHeading {
  level: 1 | 2 | 3;
  text: string;
  lineIndex: number;
}

export interface Heading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  position: number;
}

export interface Paragraph {
  text: string;
  wordCount: number;
  sentenceCount: number;
}

export interface Link {
  href: string;
  anchorText: string;
  isInternal: boolean;
  rel: string[];
  isNofollow: boolean;
}

export interface Image {
  src: string;
  alt: string | null;
  hasAlt: boolean;
  filename: string;
  isLazy: boolean;
  hasGenericFilename: boolean;
}

export interface FaqItem {
  question: string;
  answer: string;
}

// ─── Findings ─────────────────────────────────────────────────────────────────

export type FindingSeverity = 'error' | 'warning' | 'info';

export type CategoryId =
  | 'structure'
  | 'seo-basics'
  | 'linking'
  | 'images'
  | 'faq'
  | 'readability'
  | 'ai-junk';

export interface Finding {
  ruleId: string;
  category: CategoryId;
  severity: FindingSeverity;
  title: string;
  description: string;
  why: string;
  recommendation?: string;
  fixExample?: string;
  fixCode?: string;
  context?: string;
  /** Predicted score improvement if this finding is fixed */
  impactPoints?: number;
}

// ─── Category Result ──────────────────────────────────────────────────────────

export interface CategoryResult {
  category: CategoryId;
  label: string;
  score: number;
  status: CategoryStatus;
  findings: Finding[];
  llmEnhanced: boolean;
}

export type CategoryStatus = 'pass' | 'warning' | 'fail';

// ─── Checklist ────────────────────────────────────────────────────────────────

export interface ChecklistItem {
  ruleId: string;
  category: CategoryId;
  label: string;
  status: 'pass' | 'fail' | 'warning';
  action?: string;
  impactPoints?: number;
}

// ─── Publication Status ───────────────────────────────────────────────────────

export type PublicationStatus =
  | 'ready-to-publish'
  | 'needs-improvement'
  | 'do-not-publish';

// ─── SEO Pack ─────────────────────────────────────────────────────────────────

export type ContentType = 'article' | 'blog-post' | 'faq-page' | 'how-to' | 'generic';

export interface SeoPack {
  contentType: ContentType;

  title: string;
  titleLength: number;

  metaDescription: string;
  metaDescriptionLength: number;

  canonical: string;

  ogTags: {
    title: string;
    description: string;
    type: string;
    imageAlt: string;
  };

  twitterCard: {
    card: string;
    title: string;
    description: string;
  };

  robotsMeta: string;

  jsonLd: string;

  /** Ready-to-paste full <head> block */
  headBlock: string;
}

// ─── Content Expansion Pack ───────────────────────────────────────────────────

export interface ContentExpansionPack {
  /** Suggested H2 sections missing from the article */
  missingSections: Array<{ heading: string; why: string }>;

  /** FAQ questions derived from article content */
  faqSuggestions: Array<{ question: string; answer: string }>;

  /** Suggested internal link anchor texts and slugs */
  internalLinkSuggestions: Array<{ anchorText: string; suggestedSlug: string }>;

  /** Content gaps — topics not covered */
  contentGaps: string[];

  /** Plain text FAQ ready to copy */
  faqText: string;

  /** Suggested section headings with creator-facing notes */
  headingsText: string;
}

// ─── Fix All Report ───────────────────────────────────────────────────────────

export interface FixAllReport {
  title: string;
  metaDescription: string;
  faqText: string;
  headingsText: string;
  internalLinksText: string;
  predictedNewScore: number;
}

// ─── Analysis Result ──────────────────────────────────────────────────────────

export interface AnalysisResult {
  analysisId: string;
  analyzedAt: string;
  overallScore: number;
  publicationStatus: PublicationStatus;
  categories: CategoryResult[];
  checklist: ChecklistItem[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
  fetchDebug?: FetchDebug;
  seoPack: SeoPack;
  expansionPack: ContentExpansionPack;
  fixAll: FixAllReport;
  meta: {
    wordCount: number;
    language: SupportedLanguage;
    inputType: 'html' | 'text';
    detectedH1: string | null;
    detectedTitle: string | null;
    detectedMetaDescription: string | null;
    metaInputMode: MetaInputMode | 'detected';
    analysisMode: InputMode;
    htmlScope: HtmlScope | null;
  };
}

// ─── Analyzer Interface ───────────────────────────────────────────────────────

export type Analyzer = (content: StructuredContent) => CategoryResult;

// ─── Scoring Input ────────────────────────────────────────────────────────────

export interface ScoringInput {
  categories: CategoryResult[];
  wordCount: number;
}

// ─── Fetch Debug ──────────────────────────────────────────────────────────────

export interface FetchDebug {
  fetchedUrl: string;
  httpStatus: number | null;
  contentType: string | null;
  htmlLength: number;
  textLength: number;
  detectedTitleRaw: string | null;
  detectedH1Count: number;
  detectedMetaDescriptionRaw: string | null;
  fetchDurationMs: number;
  error: string | null;
}
