/**
 * ContentProof - Readability Analyzer v1.2
 */
import type { StructuredContent, CategoryResult, Finding } from '../types';

const CATEGORY = 'readability' as const;
const LABEL = 'Czytelność';

function countSyllablesEN(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function countSyllablesPL(word: string): number {
  const vowels = word.toLowerCase().match(/[aąeęioóuy]/g);
  return vowels ? vowels.length : 1;
}

function countSyllables(word: string, lang: 'pl' | 'en'): number {
  return lang === 'pl' ? countSyllablesPL(word) : countSyllablesEN(word);
}

function computeFlesch(content: StructuredContent): number {
  const narrativeSentences = splitNarrativeSentences(content);
  if (narrativeSentences.length === 0) return 80;

  const words = narrativeSentences
    .join(' ')
    .split(/\s+/)
    .map(word => word.replace(/[^\p{L}-]/gu, ''))
    .filter(Boolean);
  if (words.length === 0) return 80;

  const avgSentenceLength = words.length / narrativeSentences.length;

  // The English Flesch formula systematically underrates normal Polish prose.
  // For Polish, use a conservative web-readability estimate based only on
  // narrative paragraphs, sentence length and genuinely complex words.
  if (content.language === 'pl') {
    const complexWords = words.filter(word => countSyllablesPL(word) >= 5).length;
    const complexWordPct = (complexWords / words.length) * 100;
    const sentencePenalty = Math.max(0, avgSentenceLength - 14) * 2.2;
    const vocabularyPenalty = Math.max(0, complexWordPct - 12) * 0.8;
    return Math.min(100, Math.max(0, Math.round(88 - sentencePenalty - vocabularyPenalty)));
  }

  const syllableCount = words.reduce((sum, w) => sum + countSyllables(w, content.language), 0);
  const avgSyllablesPerWord = syllableCount / words.length;
  const raw = 206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord;

  return Math.min(100, Math.max(0, Math.round(raw)));
}

function fleschLabel(score: number, lang: 'pl' | 'en'): string {
  if (lang === 'pl') {
    if (score >= 70) return 'łatwa do czytania';
    if (score >= 50) return 'przeciętnie trudna';
    if (score >= 30) return 'trudna';
    return 'bardzo trudna';
  }

  if (score >= 70) return 'easy to read';
  if (score >= 50) return 'fairly difficult';
  return 'difficult';
}

const PASSIVE_EN = [
  /\b(is|are|was|were|be|been|being)\s+\w+ed\b/gi,
  /\b(has|have|had)\s+been\s+\w+ed\b/gi,
];

const PASSIVE_PL = [
  /\b(jest|są|był|była|zostało|zostały|zostanie)\s+\w+(ny|na|ne|ni|nych)\b/gi,
  /\b\w+(owany|owana|owane|owani)\b/gi,
];

function countPassiveSentences(sentences: string[], lang: 'pl' | 'en'): number {
  const patterns = lang === 'pl' ? PASSIVE_PL : PASSIVE_EN;
  return sentences.filter(sentence =>
    patterns.some(pattern => {
      pattern.lastIndex = 0;
      return pattern.test(sentence);
    })
  ).length;
}

const TRANSITIONS_EN = [
  'however',
  'therefore',
  'furthermore',
  'moreover',
  'additionally',
  'consequently',
  'nevertheless',
  'in addition',
  'as a result',
  'for example',
  'for instance',
  'in contrast',
  'similarly',
  'meanwhile',
  'subsequently',
  'finally',
  'first',
  'second',
  'also',
  'although',
];

const TRANSITIONS_PL = [
  'jednak',
  'dlatego',
  'ponadto',
  'dodatkowo',
  'w rezultacie',
  'niemniej',
  'na przykład',
  'tymczasem',
  'następnie',
  'wreszcie',
  'po pierwsze',
  'po drugie',
  'również',
  'chociaż',
  'co więcej',
  'innymi słowy',
  'zatem',
  'czyli',
  'bowiem',
  'natomiast',
];

function countTransitionSentences(sentences: string[], lang: 'pl' | 'en'): number {
  const transitions = lang === 'pl' ? TRANSITIONS_PL : TRANSITIONS_EN;
  return sentences.filter(sentence => {
    const lower = sentence.toLowerCase();
    return transitions.some(transition => lower.includes(transition));
  }).length;
}

const SCANNABLE_SECTION_RE =
  /^(składniki|skladniki|najważniejsze|najwazniejsze|w tym artykule znajdziesz|checklista|lista|faq|pytania|recipeingredient|ingredients|key points|in this article|you will learn|checklist)$/i;

function stripHtml(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function isScannableHtmlBlock(raw: string): boolean {
  return (
    /<(ul|ol|li|table|tr|td|th|details|summary)\b/i.test(raw) ||
    /itemprop=["']recipeIngredient["']/i.test(raw) ||
    /property=["']recipeIngredient["']/i.test(raw)
  );
}

function isScannableTextBlock(text: string): boolean {
  const cleaned = text.trim();
  if (!cleaned) return true;

  const lines = cleaned.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

  if (lines.length > 1) {
    const heading = lines[0].replace(/:$/, '');
    const bulletLines = lines.filter(line => /^([-*•]|\d+[.)])\s+/.test(line));
    const shortLines = lines.filter(line => line.split(/\s+/).filter(Boolean).length <= 8);

    if (SCANNABLE_SECTION_RE.test(heading)) return true;
    if (bulletLines.length / lines.length >= 0.4) return true;
    if (shortLines.length / lines.length >= 0.75) return true;
  }

  if (/^([-*•]|\d+[.)])\s+/.test(cleaned)) return true;
  if (SCANNABLE_SECTION_RE.test(cleaned.replace(/:$/, ''))) return true;

  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  return wordCount <= 8 && !/[.!?…]$/.test(cleaned);
}

function extractNarrativeHtmlBlocks(raw: string): string[] {
  const blocks: string[] = [];
  const skippedRanges: Array<[number, number]> = [];
  const scannableRegex =
    /<(ul|ol|table|details)\b[\s\S]*?<\/\1>|<li\b[\s\S]*?<\/li>|<[^>]*(itemprop|property)=["']recipeIngredient["'][^>]*>[\s\S]*?<\/[^>]+>/gi;

  let scannableMatch: RegExpExecArray | null;
  while ((scannableMatch = scannableRegex.exec(raw)) !== null) {
    skippedRanges.push([scannableMatch.index, scannableRegex.lastIndex]);
  }

  const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let paragraphMatch: RegExpExecArray | null;

  while ((paragraphMatch = pRegex.exec(raw)) !== null) {
    const full = paragraphMatch[0];
    const insideSkippedRange = skippedRanges.some(
      ([start, end]) => paragraphMatch !== null && paragraphMatch.index >= start && paragraphMatch.index < end
    );

    if (insideSkippedRange || isScannableHtmlBlock(full)) continue;

    const text = stripHtml(full);
    if (text.length >= 40 && !isScannableTextBlock(text)) blocks.push(text);
  }

  return blocks;
}

function extractNarrativeTextBlocks(content: StructuredContent): string[] {
  if (content.inputType === 'html') {
    const htmlBlocks = extractNarrativeHtmlBlocks(content.analysisHtml ?? content.raw);
    if (htmlBlocks.length > 0) return htmlBlocks;
  }

  return content.paragraphs
    .map(paragraph => paragraph.text.trim())
    .filter(text => text.length >= 40 && !isScannableTextBlock(text));
}

function splitNarrativeSentences(content: StructuredContent): string[] {
  return extractNarrativeTextBlocks(content).flatMap(block => {
    const protectedText = block
      .replace(/\b(dr|prof|mgr|inż|tzw|itp|itd|np|m\.in|ok|ww|vs|mr|mrs|ms|jr|sr)\./gi, match =>
        match.replace('.', '§DOT§')
      )
      .replace(/(\d+)\./g, '$1§DOT§');

    const sentences = protectedText
      .split(/(?<=[.!?…])\s+(?=[A-ZŁŚĆĄÓĘŹŻŃ])/u)
      .map(sentence => sentence.replace(/§DOT§/g, '.').trim())
      .filter(Boolean);

    return sentences.length > 0 ? sentences : [block];
  });
}

function checkFleschScore(content: StructuredContent, findings: Finding[]): number {
  const score = computeFlesch(content);
  const label = fleschLabel(score, content.language);

  if (score < 30) {
    findings.push({
      ruleId: 'readability.very-hard',
      category: CATEGORY,
      severity: 'error',
      title: 'Treść bardzo trudna w odbiorze',
      description: `Wynik czytelności: ${score}/100 — treść ${label}.`,
      why: 'W akapitach narracyjnych występuje dużo długich zdań lub wielosylabowych słów, co może spowalniać czytanie.',
      recommendation: 'Przejrzyj najdłuższe zdania narracyjne i uprość tylko te fragmenty, które rzeczywiście utrudniają zrozumienie.',
    });
    return 20;
  }

  if (score < 50) {
    findings.push({
      ruleId: 'readability.hard',
      category: CATEGORY,
      severity: 'warning',
      title: 'Treść trudna w odbiorze',
      description: `Wynik czytelności: ${score}/100 — treść ${label}.`,
      why: 'Niektóre akapity narracyjne mogą wymagać więcej uwagi ze względu na długość zdań lub złożone słownictwo.',
      recommendation: 'Uprość tylko wskazane akapity narracyjne. Listy, składniki, instrukcje i FAQ nie wymagają przerabiania.',
    });
    return 55;
  }

  return score >= 70 ? 100 : 80;
}

function checkSentenceLength(content: StructuredContent, findings: Finding[]): number {
  const narrativeSentences = splitNarrativeSentences(content);

  if (narrativeSentences.length === 0) {
    if (content.sentences.length > 0) {
      findings.push({
        ruleId: 'readability.scannable-lists-skipped',
        category: CATEGORY,
        severity: 'info',
        title: 'Lista wykryta — pominięto analizę długości zdań',
        description: 'Treść ma charakter listy, checklisty, FAQ albo bloku UX, więc nie jest oceniana jak zwykły akapit narracyjny.',
        why: 'Elementy list i składników są projektowane do skanowania. Traktowanie ich jak długich zdań dawałoby fałszywy wynik czytelności.',
      });
    }
    return 100;
  }

  const MAX = content.language === 'pl' ? 25 : 20;
  const wordCounts = narrativeSentences.map(sentence => sentence.split(/\s+/).filter(Boolean).length);
  const longSentences = wordCounts.filter(count => count > MAX);
  const longPct = Math.round((longSentences.length / narrativeSentences.length) * 100);
  const avg = Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length);

  if (longPct > 40) {
    findings.push({
      ruleId: 'readability.long-sentences',
      category: CATEGORY,
      severity: 'warning',
      title: 'Długie zdanie w akapicie narracyjnym',
      description: `${longPct}% zdań w akapitach narracyjnych przekracza ${MAX} słów. Średnia: ${avg} słów/zdanie.`,
      why: 'Długie zdania wymagają więcej pamięci roboczej od czytelnika. W internecie ludzie skanują, a nie czytają — krótkie zdania lepiej trafiają w ten styl odbioru.',
      recommendation: `Skróć zdania narracyjne do max ${MAX} słów. Rozbijaj złożone zdania na dwa proste.`,
    });
    return 50;
  }

  if (longPct > 20) {
    findings.push({
      ruleId: 'readability.some-long-sentences',
      category: CATEGORY,
      severity: 'info',
      title: 'Długie zdanie w akapicie narracyjnym',
      description: `${longPct}% zdań w akapitach narracyjnych przekracza ${MAX} słów.`,
      why: 'Zbyt długie zdania spowalniają czytanie i mogą mylić czytelnika.',
      recommendation: 'Przejrzyj najdłuższe zdania narracyjne i rozważ ich podział.',
    });
    return 80;
  }

  return 100;
}

function checkParagraphLength(content: StructuredContent, findings: Finding[]): number {
  if (content.paragraphs.length === 0) return 100;

  const longParas = content.paragraphs.filter(paragraph => paragraph.wordCount > 150);
  if (longParas.length === 0) return 100;

  const pct = Math.round((longParas.length / content.paragraphs.length) * 100);
  findings.push({
    ruleId: 'readability.long-paragraphs',
    category: CATEGORY,
    severity: pct > 40 ? 'warning' : 'info',
    title: 'Zbyt długie akapity',
    description: `${longParas.length} akapit(ów) (${pct}%) przekracza 150 słów.`,
    why: 'Na ekranie długi akapit to ściana tekstu, którą użytkownicy często pomijają. Krótsze akapity są bardziej czytelne i lepiej wspierają skanowanie treści.',
    recommendation: 'Podziel długie akapity na krótsze — max 100-150 słów.',
  });

  return pct > 40 ? 60 : 80;
}

function checkPassiveVoice(content: StructuredContent, findings: Finding[]): number {
  if (content.sentences.length < 5) return 100;

  const passivePct = Math.round(
    (countPassiveSentences(content.sentences, content.language) / content.sentences.length) * 100
  );

  if (passivePct > 30) {
    findings.push({
      ruleId: 'readability.passive-voice',
      category: CATEGORY,
      severity: 'warning',
      title: 'Wysoki udział strony biernej',
      description: `Około ${passivePct}% zdań zawiera stronę bierną.`,
      why: 'Strona bierna jest mniej bezpośrednia i trudniejsza w czytaniu. Narzędzia SEO często oznaczają ją jako problem czytelności.',
      recommendation: 'Przepisz zdania w stronie czynnej.',
    });
    return 65;
  }

  return 100;
}

function checkTransitionWords(content: StructuredContent, findings: Finding[]): number {
  if (content.sentences.length < 10) return 100;

  const pct = Math.round(
    (countTransitionSentences(content.sentences, content.language) / content.sentences.length) * 100
  );

  if (pct < 10) {
    findings.push({
      ruleId: 'readability.few-transitions',
      category: CATEGORY,
      severity: 'info',
      title: 'Mało słów przejściowych',
      description: `Tylko ${pct}% zdań zawiera słowa łączące (jednak, dlatego, ponadto...).`,
      why: 'Słowa przejściowe nadają tekstowi płynność i pomagają czytelnikowi śledzić tok myślenia.',
      recommendation: 'Dodaj słowa łączące między zdaniami i akapitami: "jednak", "dlatego", "co więcej", "na przykład".',
    });
    return 80;
  }

  return 100;
}

export function analyzeReadability(content: StructuredContent): CategoryResult {
  const findings: Finding[] = [];

  if (content.wordCount < 50) {
    return {
      category: CATEGORY,
      label: LABEL,
      score: 100,
      status: 'pass',
      findings: [
        {
          ruleId: 'readability.too-short-to-analyze',
          category: CATEGORY,
          severity: 'info',
          title: 'Treść zbyt krótka do analizy czytelności',
          description: 'Analiza czytelności wymaga minimum 50 słów.',
          why: 'Metryki czytelności są statystyczne i potrzebują wystarczającej próbki tekstu.',
        },
      ],
      llmEnhanced: false,
    };
  }

  const scores = {
    flesch: checkFleschScore(content, findings),
    sentences: checkSentenceLength(content, findings),
    paragraphs: checkParagraphLength(content, findings),
    passive: checkPassiveVoice(content, findings),
    transitions: checkTransitionWords(content, findings),
  };

  const score = Math.round(
    scores.flesch * 0.3 +
      scores.sentences * 0.25 +
      scores.paragraphs * 0.2 +
      scores.passive * 0.15 +
      scores.transitions * 0.1
  );

  const status = score >= 80 ? 'pass' : score >= 50 ? 'warning' : 'fail';

  return {
    category: CATEGORY,
    label: LABEL,
    score,
    status,
    findings,
    llmEnhanced: false,
  };
}
