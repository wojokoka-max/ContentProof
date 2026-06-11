/**
 * ContentProof — Plain Text Parser
 * Extracts structure from raw article text without any HTML.
 * This is the PRIMARY parser for content creators.
 *
 * Detects:
 * - Title / H1 (first standalone short line)
 * - Section headings (H2/H3 by heuristics)
 * - Paragraphs
 * - FAQ (question + answer patterns)
 * - Lists (bullet / numbered)
 * - Word count, sentence count
 */

import type { TextHeading, FaqItem, Paragraph } from '../types';

// ─── Heading detection heuristics ─────────────────────────────────────────────

/** Lines that are almost certainly NOT headings */
const NOT_HEADING_PATTERNS = [
  /^https?:\/\//i,                    // URLs
  /^[-•*·]\s/,                         // bullet list items
  /^\d+[.)]\s/,                        // numbered list items
  /,\s*$/,                             // ends with comma
  /^(oraz|i\s|a\s|ale\s|więc\s)/i,    // starts with conjunction (PL)
  /^(and|but|or|so|yet|nor)\s/i,      // starts with conjunction (EN)
];

const SECTION_KEYWORDS_PL = new Set([
  'składniki', 'przygotowanie', 'krok', 'kroki', 'wariant', 'warianty',
  'linkowanie', 'podsumowanie', 'wstęp', 'wprowadzenie', 'wnioski',
  'zalety', 'wady', 'FAQ', 'pytania', 'odpowiedzi', 'przepis',
  'materiały', 'narzędzia', 'efekty', 'wyniki', 'porady', 'wskazówki',
  'przykłady', 'przykład', 'historia', 'kontekst', 'tło', 'opis',
  'informacje', 'dane', 'statystyki', 'metoda', 'metody', 'techniki',
]);

const SECTION_KEYWORDS_EN = new Set([
  'ingredients', 'preparation', 'steps', 'instructions', 'variants',
  'summary', 'introduction', 'conclusion', 'benefits', 'drawbacks',
  'faq', 'questions', 'answers', 'recipe', 'materials', 'tools',
  'results', 'tips', 'examples', 'example', 'history', 'context',
  'information', 'data', 'statistics', 'method', 'methods', 'techniques',
]);

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function isLikelyHeading(line: string, nextLine: string | null, lang: 'pl' | 'en'): boolean {
  if (line.length < 2) return false;
  if (line.length > 80) return false;  // too long for a heading

  const words = countWords(line);
  if (words > 12) return false;         // too many words

  // Must not match any "not heading" pattern
  if (NOT_HEADING_PATTERNS.some(p => p.test(line))) return false;

  // Ends with period = likely a sentence, not a heading
  if (/\.$/.test(line)) return false;

  // Has multiple sentences = paragraph, not heading
  if (/[.!?]\s+[A-ZŁŚĆĄÓĘŹŻŃ]/u.test(line)) return false;

  // Known section keyword (standalone)
  const lower = line.toLowerCase().trim();
  const keywords = lang === 'pl' ? SECTION_KEYWORDS_PL : SECTION_KEYWORDS_EN;
  if (keywords.has(lower)) return true;

  // A longer line ending with a colon usually introduces a quote or list.
  // It is prose, not a section heading.
  if (/:$/.test(line) && words > 3) return false;

  // Starts with capital letter
  if (!/^[A-ZŁŚĆĄÓĘŹŻŃ]/u.test(line)) return false;

  // 2–12 words
  if (words >= 2 && words <= 12) return true;

  // Single word section titles
  if (words === 1 && line.length >= 4) return true;

  return false;
}

// ─── Title / H1 detection ─────────────────────────────────────────────────────

/** Find the most likely H1 candidate in plain text */
export function detectTextH1(lines: string[], lang: 'pl' | 'en'): string | null {
  // Skip metadata prefix lines
  const META_PREFIX = /^(seo\s*title|title|meta\s*description|meta|h1|h2|opis|nagłówek|keyword|tag|frazy|linkowanie)\s*:/i;
  const LABEL_ONLY  = /^[\w\s]{1,40}:$/;           // "Frazy kluczowe:"
  const LABEL_VALUE = /^[\w\s]{1,40}:\s*\S/;        // "SEO Title: ..."
  const KEYWORD_LINE = /^[a-ząćęłńóśźż][\w\s-]{2,40}$/i; // likely keyword phrase

  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i].trim();
    if (!line || line.length < 3) continue;
    if (META_PREFIX.test(line)) continue;
    if (LABEL_ONLY.test(line)) continue;
    if (LABEL_VALUE.test(line)) continue;
    if (/^https?:\/\//i.test(line)) continue;
    if (/^[-•*·\d]/.test(line)) continue;  // bullet or numbered

    // Must start with capital
    if (!/^[A-ZŁŚĆĄÓĘŹŻŃ]/u.test(line)) continue;

    const words = countWords(line);
    if (words < 2 || words > 15) continue;
    if (line.length > 100) continue;

    // Looks like a single keyword phrase? Skip.
    // Keyword phrases tend to be lowercase + short + no capital after first word
    const secondWordCapital = /^[A-ZŁŚĆĄÓĘŹŻŃ]\S+\s+[A-ZŁŚĆĄÓĘŹŻŃ]/u.test(line);
    const hasPreposition = /\s+(i\s|z\s|w\s|na\s|do\s|po\s|bez\s|od\s|ze\s)/i.test(line);

    if (words >= 3 || secondWordCapital || hasPreposition) {
      return line.replace(/[.!?]$/, '').trim();
    }
  }

  return null;
}

// ─── Heading extraction ───────────────────────────────────────────────────────

export function extractTextHeadings(lines: string[], h1Text: string | null, lang: 'pl' | 'en'): TextHeading[] {
  const headings: TextHeading[] = [];

  if (h1Text) {
    headings.push({ level: 1, text: h1Text, lineIndex: -1 });
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line === h1Text) continue;  // already captured as H1

    const nextLine = lines[i + 1]?.trim() ?? null;

    if (!isLikelyHeading(line, nextLine, lang)) continue;

    // Plain text has no technical H2/H3 markup. Treat detected sections as H2;
    // exact hierarchy can only be validated for HTML or a published URL.
    const level: 2 = 2;

    headings.push({ level, text: line, lineIndex: i });
  }

  return headings;
}

// ─── FAQ detection from plain text ───────────────────────────────────────────

const PL_Q_WORDS = ['czy', 'jak', 'co', 'kiedy', 'gdzie', 'dlaczego', 'ile', 'kto', 'które', 'czym', 'po co', 'skąd'];
const EN_Q_WORDS = ['what', 'how', 'why', 'when', 'where', 'who', 'which', 'can', 'does', 'is', 'are', 'do', 'will'];

function looksLikeQuestion(line: string, lang: 'pl' | 'en'): boolean {
  const trimmed = line.trim();
  if (trimmed.endsWith('?')) return true;
  const lower = trimmed.toLowerCase();
  const qWords = lang === 'pl' ? PL_Q_WORDS : EN_Q_WORDS;
  return qWords.some(w => lower.startsWith(w + ' '));
}

export function extractTextFaq(lines: string[], lang: 'pl' | 'en'): FaqItem[] {
  const items: FaqItem[] = [];
  const faqHeadingIndex = lines.findIndex(line =>
    /^(faq|najczęstsze pytania|pytania i odpowiedzi)$/i.test(line.trim())
  );
  let i = faqHeadingIndex >= 0 ? faqHeadingIndex + 1 : 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (looksLikeQuestion(line, lang)) {
      // Collect the answer — next non-empty lines until next question or blank-blank
      const answerLines: string[] = [];
      let j = i + 1;
      let blanks = 0;

      while (j < lines.length && blanks < 2) {
        const nextLine = lines[j].trim();
        if (!nextLine) {
          blanks++;
          j++;
          continue;
        }
        // Stop if we hit another question
        if (looksLikeQuestion(nextLine, lang)) break;
        // Stop if we hit a heading-like line with blank before it
        if (blanks > 0 && isLikelyHeading(nextLine, null, lang) && !looksLikeQuestion(nextLine, lang)) break;

        blanks = 0;
        answerLines.push(nextLine);
        j++;
      }

      const answer = answerLines.join(' ').trim();
      if (answer.length > 0) {
        items.push({ question: line, answer });
        i = j;
        continue;
      }
    }

    i++;
  }

  return items.slice(0, 15);
}

// ─── Paragraph extraction from plain text ────────────────────────────────────

export function extractTextParagraphs(text: string): Paragraph[] {
  const blocks = text.split(/\n{2,}/).map(b => b.trim()).filter(b => b.length > 20);
  return blocks.map(b => {
    const wordCount = countWords(b);
    const sentenceCount = b.split(/(?<=[.!?])\s+/).filter(s => s.length > 0).length;
    return { text: b, wordCount, sentenceCount };
  });
}

// ─── Sentence splitter ────────────────────────────────────────────────────────

export function splitSentencesFromText(text: string): string[] {
  const protected_ = text
    .replace(/\b(dr|prof|mgr|inż|tzw|itp|itd|np|m\.in|ok|ww|vs|mr|mrs|ms|jr|sr)\./gi,
      m => m.replace('.', '§DOT§'))
    .replace(/(\d+)\./g, '$1§DOT§');

  return protected_
    .split(/(?<=[.!?…])\s+(?=[A-ZŁŚĆĄÓĘŹŻŃ])/u)
    .map(s => s.replace(/§DOT§/g, '.').trim())
    .filter(s => s.length > 0);
}
