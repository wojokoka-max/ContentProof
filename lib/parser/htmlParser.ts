/**
 * ContentProof — Main Parser v3.0
 * Handles three input modes: text, html, url-fetched.
 * Plain text is the PRIMARY mode for content creators.
 */

import type {
  StructuredContent, Heading, Paragraph, Link,
  Image, FaqItem, SupportedLanguage, InputMode,
  MetaInput, HtmlScope,
} from '../types';

import {
  detectTextH1, extractTextHeadings, extractTextFaq,
  extractTextParagraphs, splitSentencesFromText,
} from './plainTextParser';
import { cleanText } from '../utils/cleanText';

// ─── Input Mode Detection ─────────────────────────────────────────────────────

export function detectInputMode(raw: string): InputMode {
  const trimmed = raw.trim();

  // URL
  if (/^https?:\/\//i.test(trimmed)) return 'url';

  // HTML — contains actual tags
  if (isHtmlContent(trimmed)) return 'html';

  return 'text';
}

function isHtmlContent(raw: string): boolean {
  return /<(h[1-6]|p|img|div|span|article|section|header|footer|nav|ul|ol|li|details|summary)\b[^>]*>/i.test(raw);
}

export function detectHtmlScope(raw: string): HtmlScope {
  const hasHtmlTag = /<html\b/i.test(raw);
  const hasHead = /<head\b/i.test(raw);
  const hasBody = /<body\b/i.test(raw);
  return hasHtmlTag || (hasHead && hasBody) ? 'document' : 'fragment';
}

// ─── Language Detection ───────────────────────────────────────────────────────

const PL_INDICATORS = ['się','nie','jak','dla','oraz','przez','jest','są','być','że','co','ale','czy','już','przy','więcej','tylko','też'];
const EN_INDICATORS = ['the','and','for','that','with','are','this','have','from','not','but','they','what','can','been','more'];

export function detectLanguage(text: string): SupportedLanguage {
  const words = text.toLowerCase().split(/\s+/);
  const wordSet = new Set(words);
  const plScore = PL_INDICATORS.filter(w => wordSet.has(w)).length;
  const enScore = EN_INDICATORS.filter(w => wordSet.has(w)).length;
  return plScore >= enScore ? 'pl' : 'en';
}

// ─── Plain Text Utilities ─────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

// ─── HTML Stripping ───────────────────────────────────────────────────────────

export function extractPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ').trim();
}

interface HtmlCandidate {
  html: string;
  score: number;
  priority: number;
}

function extractBalancedElement(html: string, start: number, tagName: string): string | null {
  const tokenRegex = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  tokenRegex.lastIndex = start;
  let depth = 0;
  let token: RegExpExecArray | null;

  while ((token = tokenRegex.exec(html)) !== null) {
    if (token.index === start || depth > 0) {
      if (/^<\//.test(token[0])) {
        depth--;
        if (depth === 0) return html.slice(start, tokenRegex.lastIndex);
      } else if (!/\/>$/.test(token[0])) {
        depth++;
      }
    }
  }

  return null;
}

function collectCandidates(html: string, openTagRegex: RegExp, priority: number): HtmlCandidate[] {
  const candidates: HtmlCandidate[] = [];
  let match: RegExpExecArray | null;

  while ((match = openTagRegex.exec(html)) !== null) {
    const tagName = match[1].toLowerCase();
    const candidateHtml = extractBalancedElement(html, match.index, tagName);
    if (!candidateHtml) continue;

    const visibleText = extractPlainText(candidateHtml);
    if (visibleText.length < 200) continue;
    candidates.push({ html: candidateHtml, score: visibleText.length, priority });
  }

  return candidates;
}

export function extractPrimaryContentHtml(html: string): string {
  const candidates = [
    ...collectCandidates(html, /<(article)\b[^>]*>/gi, 5),
    ...collectCandidates(html, /<(main)\b[^>]*>/gi, 4),
    ...collectCandidates(
      html,
      /<(div|section)\b(?=[^>]*\bclass=["'][^"']*(?:entry-content|post-content|wp-block-post-content|elementor-widget-theme-post-content|single-content|text_content)[^"']*["'])[^>]*>/gi,
      3,
    ),
    ...collectCandidates(
      html,
      /<(div|section)\b(?=[^>]*\bdata-element-type=["']text["'])[^>]*>/gi,
      2,
    ),
    ...collectCandidates(html, /<(body)\b[^>]*>/gi, 1),
  ];

  if (candidates.length === 0) return html;

  candidates.sort((a, b) => b.priority - a.priority || b.score - a.score);

  let primaryHtml = candidates[0].html;
  if (!/<h1\b/i.test(primaryHtml)) {
    const h1 = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i)?.[0];
    if (h1) primaryHtml = `${h1}\n${primaryHtml}`;
  }

  return primaryHtml;
}

// ─── HTML-specific extractors ─────────────────────────────────────────────────

function extractHeadings(html: string, plainText: string): Heading[] {
  const headings: Heading[] = [];
  const regex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1]) as Heading['level'];
    const text = extractPlainText(match[2]).trim();
    if (!text) continue;
    const position = plainText.indexOf(text);
    headings.push({ level, text, position: position >= 0 ? position : 0 });
  }
  return headings;
}

function extractParagraphs(html: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match: RegExpExecArray | null;
  while ((match = pRegex.exec(html)) !== null) {
    const text = extractPlainText(match[1]).trim();
    if (text.length < 10) continue;
    paragraphs.push({ text, wordCount: countWords(text), sentenceCount: text.split(/(?<=[.!?])\s+/).length });
  }
  if (paragraphs.length === 0) {
    const blocks = html.split(/\n{2,}/).map(b => b.trim()).filter(b => b.length > 10);
    for (const b of blocks) paragraphs.push({ text: b, wordCount: countWords(b), sentenceCount: 1 });
  }
  return paragraphs;
}

function extractLinks(html: string): Link[] {
  const links: Link[] = [];
  const regex = /<a([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const attrs = match[1];
    const href = (attrs.match(/href=["']([^"']*)["']/i) ?? ['',''])[1];
    const relMatch = attrs.match(/rel=["']([^"']*)["']/i);
    const rel = relMatch ? relMatch[1].toLowerCase().split(/\s+/) : [];
    const anchorText = extractPlainText(match[2]).trim();
    const isInternal = /^[/#]/.test(href) || /^mailto:|^tel:/.test(href);
    links.push({ href, anchorText, isInternal, rel, isNofollow: rel.includes('nofollow') });
  }
  return links;
}

function extractImages(html: string): Image[] {
  const images: Image[] = [];
  const GENERIC = [/^img[-_]?\d+/i,/^image[-_]?\d+/i,/^photo[-_]?\d+/i,/^dsc\d+/i,/^screenshot/i,/^\d{4,}/,/^untitled/i];
  const regex = /<img([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const attrs = match[1];
    const src = (attrs.match(/src=["']([^"']*)["']/i) ?? ['',''])[1];
    const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
    const filename = src.split('/').pop() ?? src;
    images.push({
      src, alt: altMatch ? altMatch[1] : null, hasAlt: altMatch !== null,
      filename, isLazy: /loading=["']lazy["']/i.test(attrs),
      hasGenericFilename: GENERIC.some(p => p.test(filename.replace(/\.[^.]+$/, ''))),
    });
  }
  return images;
}

function extractFaqItems(html: string): FaqItem[] {
  const items: FaqItem[] = [];
  let match: RegExpExecArray | null;
  const dr = /<details[^>]*>[\s\S]*?<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi;
  while ((match = dr.exec(html)) !== null) {
    const q = extractPlainText(match[1]).trim();
    const a = extractPlainText(match[2]).trim();
    if (q && a) items.push({ question: q, answer: a });
  }
  const dlr = /<dl[^>]*>([\s\S]*?)<\/dl>/gi;
  while ((match = dlr.exec(html)) !== null) {
    const dtr = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
    let dm: RegExpExecArray | null;
    while ((dm = dtr.exec(match[1])) !== null) {
      const q = extractPlainText(dm[1]).trim();
      const a = extractPlainText(dm[2]).trim();
      if (q && a) items.push({ question: q, answer: a });
    }
  }

  const faqHeading = /<h([2-4])\b[^>]*>\s*(?:<[^>]+>\s*)*(?:FAQ|Najczęstsze pytania|Pytania i odpowiedzi)\s*(?:<[^>]+>\s*)*<\/h\1>/gi;
  while ((match = faqHeading.exec(html)) !== null) {
    const faqLevel = Number(match[1]);
    const sectionStart = faqHeading.lastIndex;
    const followingHeading = new RegExp(`<h([1-${faqLevel}])\\b`, 'i').exec(html.slice(sectionStart));
    const sectionEnd = followingHeading ? sectionStart + followingHeading.index : html.length;
    const sectionHtml = html.slice(sectionStart, sectionEnd);
    const questionRegex = /<h([3-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
    const questions: Array<{ start: number; end: number; level: number; question: string }> = [];
    let questionMatch: RegExpExecArray | null;

    while ((questionMatch = questionRegex.exec(sectionHtml)) !== null) {
      const question = extractPlainText(questionMatch[2]).trim();
      if (!question.endsWith('?')) continue;
      questions.push({
        start: questionMatch.index,
        end: questionRegex.lastIndex,
        level: Number(questionMatch[1]),
        question,
      });
    }

    for (let index = 0; index < questions.length; index++) {
      const current = questions[index];
      const next = questions
        .slice(index + 1)
        .find(candidate => candidate.level <= current.level);
      const answerEnd = next?.start ?? sectionHtml.length;
      const answer = extractPlainText(sectionHtml.slice(current.end, answerEnd)).trim();
      if (answer) items.push({ question: current.question, answer });
    }
  }

  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.question.toLocaleLowerCase('pl-PL').replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(tag)) !== null) {
    const [, name, doubleQuoted, singleQuoted, unquoted] = match;
    attrs[name.toLowerCase()] = cleanText(doubleQuoted ?? singleQuoted ?? unquoted ?? '');
  }

  return attrs;
}

function findMetaContent(html: string, candidates: string[]): string | null {
  const wanted = candidates.map(candidate => candidate.toLowerCase());
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];

  for (const tag of tags) {
    const attrs = extractAttributes(tag);
    const identity = (attrs.name ?? attrs.property ?? attrs.itemprop ?? '').toLowerCase();
    const content = attrs.content;

    if (content && wanted.includes(identity)) return cleanText(content);
  }

  return null;
}

function findCanonical(html: string): string | null {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];

  for (const tag of tags) {
    const attrs = extractAttributes(tag);
    const relTokens = (attrs.rel ?? '').toLowerCase().split(/\s+/);
    if (attrs.href && relTokens.includes('canonical')) return attrs.href.trim();
  }

  return null;
}

export function extractMeta(html: string): { metaTitle: string | null; metaDescription: string | null; canonical: string | null } {
  const tm = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const titleTag = tm ? cleanText(extractPlainText(tm[1])) : null;
  const socialTitle = findMetaContent(html, ['og:title', 'twitter:title']);
  const metaTitle = titleTag || socialTitle;
  const metaDescription = findMetaContent(html, [
    'description',
    'og:description',
    'twitter:description',
  ]);
  const canonical = findCanonical(html);
  return { metaTitle, metaDescription, canonical };
}

// ─── Plain Text Meta Extraction ───────────────────────────────────────────────

export function extractPlainTextMeta(text: string): {
  metaTitle: string | null;
  metaDescription: string | null;
  implicitH1Override: string | null;
} {
  const lines = text.split('\n').map(l => l.trim());
  let metaTitle: string | null = null;
  let metaDescription: string | null = null;
  let implicitH1Override: string | null = null;

  for (const line of lines.slice(0, 20)) {
    const titleMatch = line.match(/^(?:seo\s*title|title|tytuł\s*seo|tytuł)\s*:\s*(.+)$/i);
    if (titleMatch && !metaTitle) { metaTitle = cleanText(titleMatch[1]); continue; }
    const descMatch = line.match(/^(?:meta\s*description|opis\s*meta|description|meta\s*opis)\s*:\s*(.+)$/i);
    if (descMatch && !metaDescription) { metaDescription = cleanText(descMatch[1]); continue; }
    const h1Match = line.match(/^(?:h1|nagłówek\s*h1|główny\s*nagłówek|headline)\s*:\s*(.+)$/i);
    if (h1Match && !implicitH1Override) { implicitH1Override = h1Match[1].trim(); }
  }
  return { metaTitle, metaDescription, implicitH1Override };
}

// ─── Main Parser ──────────────────────────────────────────────────────────────

function canonicalForUrl(detectedCanonical: string | null, sourceUrl?: string): string | null {
  if (!sourceUrl) return detectedCanonical;

  try {
    const source = new URL(sourceUrl);
    if (!detectedCanonical) return source.toString();

    const detected = new URL(detectedCanonical, source);
    const detectedIsHomepage = detected.pathname === '/' && source.pathname !== '/';
    return detectedIsHomepage ? source.toString() : detected.toString();
  } catch {
    return detectedCanonical || sourceUrl;
  }
}

export function parse(
  raw: string,
  forcedMode?: InputMode,
  metaInput?: MetaInput,
  sourceUrl?: string
): StructuredContent {
  if (!raw || raw.trim().length === 0) return emptyContent(raw ?? '');

  const analysisMode = forcedMode ?? detectInputMode(raw);

  // ── HTML mode ────────────────────────────────────────────────────────────────
  if (analysisMode === 'html' || analysisMode === 'url') {
    const htmlScope = analysisMode === 'url' ? 'document' : detectHtmlScope(raw);
    const contentHtml = analysisMode === 'url' || htmlScope === 'document'
      ? extractPrimaryContentHtml(raw)
      : raw;
    const plainText = extractPlainText(contentHtml);
    const language = detectLanguage(plainText);
    const wordCount = countWords(plainText);
    const sentences = splitSentencesFromText(plainText);
    const headings = extractHeadings(contentHtml, plainText);
    const paragraphs = extractParagraphs(contentHtml);
    const links = extractLinks(contentHtml);
    const images = extractImages(contentHtml);
    const faqItems = extractFaqItems(contentHtml);
    const { metaTitle, metaDescription, canonical: detectedCanonical } = extractMeta(raw);
    const canonical = analysisMode === 'url'
      ? canonicalForUrl(detectedCanonical, sourceUrl)
      : detectedCanonical;
    const implicitH1 = headings.find(h => h.level === 1)?.text ?? null;

    return {
      raw, analysisHtml: contentHtml, htmlScope,
      inputType: 'html', analysisMode,
      language, plainText, wordCount, sentences,
      headings, paragraphs, links, images, faqItems,
      metaTitle, metaDescription, canonical,
      metaInputMode: 'detected',
      implicitH1,
      textHeadings: [], textFaqItems: [],
    };
  }

  // ── Article (plain text) mode ────────────────────────────────────────────────
  const plainText = raw.trim();
  const language = detectLanguage(plainText);
  const wordCount = countWords(plainText);
  const sentences = splitSentencesFromText(plainText);
  const paragraphs = extractTextParagraphs(plainText);

  // Extract metadata from brief-style prefixes
  const briefMeta = extractPlainTextMeta(plainText);
  const lines = plainText.split('\n');

  // Detect H1
  const implicitH1 = briefMeta.implicitH1Override ?? detectTextH1(lines, language);

  // Detect headings
  const textHeadings = extractTextHeadings(lines, implicitH1, language);

  // Detect FAQ
  const textFaqItems = extractTextFaq(lines, language);

  // Convert textHeadings to Heading[] for compatibility with analyzers
  const headings: Heading[] = textHeadings.map((h, i) => ({
    level: h.level as Heading['level'],
    text: h.text,
    position: plainText.indexOf(h.text),
  }));

  // FAQ items from text
  const faqItems: FaqItem[] = textFaqItems;

  const providedMeta = metaInput?.mode === 'provided';

  return {
    raw, analysisHtml: null, htmlScope: null,
    inputType: 'text', analysisMode,
    language, plainText, wordCount, sentences,
    headings, paragraphs,
    links: [], images: [],
    faqItems,
    metaTitle: metaInput?.mode === 'generate'
      ? null
      : providedMeta
        ? cleanText(metaInput.title) || null
        : briefMeta.metaTitle,
    metaDescription: metaInput?.mode === 'generate'
      ? null
      : providedMeta
        ? cleanText(metaInput.description) || null
        : briefMeta.metaDescription,
    metaInputMode: metaInput?.mode ?? (briefMeta.metaTitle || briefMeta.metaDescription ? 'provided' : 'generate'),
    canonical: null,
    implicitH1,
    textHeadings,
    textFaqItems,
  };
}

function emptyContent(raw: string): StructuredContent {
  return {
    raw, analysisHtml: null, htmlScope: null,
    inputType: 'text', analysisMode: 'text',
    language: 'en', plainText: '', wordCount: 0,
    sentences: [], headings: [], paragraphs: [],
    links: [], images: [], faqItems: [],
    metaTitle: null, metaDescription: null, metaInputMode: 'generate', canonical: null,
    implicitH1: null, textHeadings: [], textFaqItems: [],
  };
}

// ─── Legacy exports ───────────────────────────────────────────────────────────
export { splitSentencesFromText as splitSentences };
export const detectInputType = (raw: string) => detectInputMode(raw) === 'html' ? 'html' : 'text';
