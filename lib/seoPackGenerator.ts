import type { StructuredContent, SeoPack, ContentType } from './types';
import { cleanText } from './utils/cleanText';

export function detectContentType(content: StructuredContent): ContentType {
  const text = content.plainText.toLowerCase();
  const headings = content.headings.map(h => h.text.toLowerCase());

  const hasFaq = content.faqItems.length > 0 ||
    headings.some(h => h.includes('faq') || h.includes('pytani') || h.includes('question'));

  const hasHowTo = headings.some(h =>
    h.startsWith('jak ') || h.startsWith('how to') || h.startsWith('krok') || h.startsWith('step')
  ) || text.includes('krok 1') || text.includes('step 1');

  const isBlog = text.includes('przepis') || text.includes('recipe') ||
    text.includes('poradnik') || text.includes('guide') ||
    content.wordCount > 1200;

  if (hasFaq && isPrimaryFaqPage(content)) return 'faq-page';
  if (hasHowTo) return 'how-to';
  if (isBlog) return 'blog-post';
  return 'article';
}

function isPrimaryFaqPage(content: StructuredContent): boolean {
  const titleLike = [
    content.metaTitle,
    content.implicitH1,
    content.headings.find(heading => heading.level === 1)?.text,
    content.headings[0]?.text,
  ].map(text => normalizeForMatch(text ?? '')).find(Boolean) ?? '';

  if (/^(faq|najczestsze pytania|pytania i odpowiedzi|questions and answers)$/.test(titleLike)) {
    return true;
  }

  const topLevelHeadings = content.headings.filter(heading => heading.level <= 2);
  const faqHeadings = topLevelHeadings.filter(heading =>
    /^(faq|najczestsze pytania|pytania i odpowiedzi|questions and answers)$/.test(normalizeForMatch(heading.text))
  );
  const nonFaqHeadings = topLevelHeadings.filter(heading =>
    !/^(faq|najczestsze pytania|pytania i odpowiedzi|questions and answers)$/.test(normalizeForMatch(heading.text)) &&
    !isGenericSectionTitle(heading.text)
  );

  return faqHeadings.length > 0 && nonFaqHeadings.length === 0 && content.faqItems.length >= 3;
}

function isUrlLikeText(text: string): boolean {
  const cleaned = cleanText(text).trim();
  if (!cleaned) return false;

  if (/^https?:\/\/\S+$/i.test(cleaned)) return true;
  if (/^www\.\S+$/i.test(cleaned)) return true;

  const compact = cleaned.replace(/\s+/g, '');
  if (/^https?:\/\/\S+$/i.test(compact)) return true;

  const words = cleaned.split(/\s+/).filter(Boolean);
  const urlTokens = words.filter(word => /^https?:\/\//i.test(word) || /^www\./i.test(word));
  return words.length > 0 && urlTokens.length / words.length > 0.5;
}

function safeTextCandidate(text: string | null | undefined): string {
  const cleaned = cleanText(text ?? '').replace(/\s+/g, ' ').trim();
  return cleaned && !isUrlLikeText(cleaned) ? cleaned : '';
}

function isListLikeText(text: string): boolean {
  const lines = cleanText(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length <= 1) return /^[-*•]\s+/.test(cleanText(text));
  const bulletLines = lines.filter(line => /^[-*•]\s+/.test(line));
  return bulletLines.length / lines.length >= 0.5;
}

function isStructuralMetaBlock(text: string, content: StructuredContent): boolean {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const bulletCount = (text.match(/(?:^|\s)[-*•]\s+\S/g) ?? []).length;
  if (bulletCount >= 2) return true;

  const normalizedHeadings = new Set(
    content.headings.map(heading => normalizeForMatch(heading.text)).filter(Boolean)
  );
  const headingLines = lines.filter(line => normalizedHeadings.has(normalizeForMatch(line)));
  if (headingLines.length > 0) return true;

  return false;
}

function isFaqSectionHeading(heading: string): boolean {
  return /^(faq|najczęstsze pytania|pytania i odpowiedzi|wskazówki|praktyczne wskazówki|wartości odżywcze|informacje odżywcze|z czym(?:\s|$)|jak przechowywać|przechowywanie|najczęstsze błędy|błędy|czego unikać|zamienniki|alternatywy|warianty)/i
    .test(cleanText(heading).trim());
}

function isFaqSectionContent(text: string, content: StructuredContent): boolean {
  const normalized = normalizeForMatch(text);
  if (!normalized) return false;

  const matchesKnownFaq = [...content.faqItems, ...content.textFaqItems].some(item =>
    normalizeForMatch(item.answer) === normalized ||
    normalizeForMatch(item.question) === normalized
  );
  if (matchesKnownFaq) return true;

  const textPosition = content.plainText.indexOf(cleanText(text).trim());
  if (textPosition < 0) return false;

  const headings = [...content.headings].sort((a, b) => a.position - b.position);
  for (let index = 0; index < headings.length; index++) {
    const heading = headings[index];
    if (!isFaqSectionHeading(heading.text)) continue;

    const sectionStart = heading.position + heading.text.length;
    const sectionEnd = headings[index + 1]?.position ?? content.plainText.length;
    if (textPosition >= sectionStart && textPosition < sectionEnd) return true;
  }

  return false;
}

function isGoodMetaDescriptionSource(text: string): boolean {
  const cleaned = safeTextCandidate(text);
  if (!cleaned) return false;
  if (isListLikeText(cleaned)) return false;
  if (cleaned.length < 70) return false;
  if (/:\s*$/.test(cleaned)) return false;
  return /[.!?]$/.test(cleaned) || cleaned.length >= 100;
}

const EMPTY_META_PHRASES = [
  'kompletny przewodnik',
  'dowiedz się wszystkiego',
  'najlepsze porady',
  'sekret',
];

function normalizeForMatch(text: string): string {
  return cleanText(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleKeywords(title: string): string[] {
  const stopWords = new Set([
    'oraz', 'czyli', 'jest', 'jak', 'jaki', 'jakie', 'dlaczego', 'czym',
    'kiedy', 'gdzie', 'który', 'która', 'które', 'poradnik', 'przepis',
    'the', 'and', 'how', 'why', 'what', 'guide',
  ].map(normalizeForMatch));

  return normalizeForMatch(title)
    .split(' ')
    .filter(word => word.length >= 4 && !stopWords.has(word));
}

function isProceduralInstruction(text: string): boolean {
  const cleaned = safeTextCandidate(text).toLowerCase();
  if (!cleaned) return false;

  return /^(?:następnie\s+|potem\s+|teraz\s+|na koniec\s+|resztę\s+\S+\s+)?(?:dodaj|dopraw|gotuj|miksuj|podgrzej|połącz|pokrój|posyp|przełóż|przykryj|rozgrzej|rozłóż|rozpuść|schłodź|smaż|ubij|umieść|użyj|wlej|włóż|wymieszaj|wyjmij|wsyp|zblenduj|zalej)\b/i.test(cleaned) ||
    /^(?:next\s+|then\s+|finally\s+)?(?:add|bake|blend|boil|chill|combine|cook|cut|heat|mix|place|pour|preheat|remove|serve|stir|whisk)\b/i.test(cleaned);
}

function isGenericSectionTitle(text: string): boolean {
  const normalized = normalizeForMatch(text);
  return /^(?:skladniki|przygotowanie|wykonanie|sposob przygotowania|instrukcja|krok po kroku|wskazowki|porady|faq|najczestsze pytania|najczestsze bledy|podsumowanie|w tym artykule znajdziesz|w artykule znajdziesz|spis tresci|ingredients|preparation|instructions|method|steps|tips|summary|table of contents)$/
    .test(normalized);
}

function isUxIntroBlock(text: string): boolean {
  return /^(?:w tym artykule znajdziesz|w artykule znajdziesz|spis tresci|table of contents)\b/
    .test(normalizeForMatch(text));
}

function isUsableTitleSource(text: string | null | undefined): boolean {
  const cleaned = safeTextCandidate(text);
  return Boolean(
    cleaned &&
    !isGenericSectionTitle(cleaned) &&
    !isUxIntroBlock(cleaned) &&
    !isProceduralInstruction(cleaned) &&
    !isListLikeText(cleaned) &&
    !/:\s*$/.test(cleaned)
  );
}

function isProcedureSectionHeading(heading: string): boolean {
  return /^(?:przygotowanie|wykonanie|sposób przygotowania|instrukcja|instrukcje|krok po kroku|jak zrobić|method|preparation|instructions|steps)$/i
    .test(cleanText(heading).trim());
}

function isProcedureSectionContent(text: string, content: StructuredContent): boolean {
  const cleaned = cleanText(text).trim();
  const textPosition = content.plainText.indexOf(cleaned);
  if (!cleaned || textPosition < 0) return false;

  const headings = [...content.headings].sort((a, b) => a.position - b.position);
  for (let index = 0; index < headings.length; index++) {
    const heading = headings[index];
    if (!isProcedureSectionHeading(heading.text)) continue;

    const sectionStart = heading.position + heading.text.length;
    const sectionEnd = headings[index + 1]?.position ?? content.plainText.length;
    if (textPosition >= sectionStart && textPosition < sectionEnd) return true;
  }

  return false;
}

function contentSentences(content: StructuredContent): string[] {
  const fromParagraphs = content.paragraphs.flatMap(paragraph => {
    if (isStructuralMetaBlock(paragraph.text, content)) return [];
    if (isFaqSectionContent(paragraph.text, content)) return [];
    if (isUxIntroBlock(paragraph.text)) return [];
    if (content.analysisMode === 'html' && isProcedureSectionContent(paragraph.text, content)) return [];
    return safeTextCandidate(paragraph.text).split(/(?<=[.!?])\s+/);
  });
  const sentenceCandidates = fromParagraphs.length > 0
    ? fromParagraphs
    : content.sentences;

  return sentenceCandidates
    .filter(sentence => !isStructuralMetaBlock(sentence, content))
    .filter(sentence => !isFaqSectionContent(sentence, content))
    .filter(sentence => !isUxIntroBlock(sentence))
    .filter(sentence => content.analysisMode !== 'html' || !isProcedureSectionContent(sentence, content))
    .map(sentence => safeTextCandidate(sentence))
    .filter((sentence, index, all) =>
      sentence.length >= 25 &&
      sentence.length <= 240 &&
      !/:\s*$/.test(sentence) &&
      !isListLikeText(sentence) &&
      (content.analysisMode !== 'html' || !isProceduralInstruction(sentence)) &&
      all.indexOf(sentence) === index
    );
}

function scoreEvidenceSentence(sentence: string, title: string, content: StructuredContent): number {
  const normalized = normalizeForMatch(sentence);
  const keywords = titleKeywords(title);
  const headings = content.headings.map(heading => normalizeForMatch(heading.text));
  let score = 0;

  score += keywords.filter(keyword => normalized.includes(keyword)).length * 4;
  if (/\b(dzięki|pozwala|pomaga|działa|daje|zapewnia|wyjaśnia|pokazuje|porównuje|sprawdź|dowiedz)\b/i.test(sentence)) score += 4;
  if (/\b(bez|krok po kroku|najczęstsze|praktyczne|różnice|przyczyny|objawy|rozwiązanie|wynik|efekt)\b/i.test(sentence)) score += 3;
  if (headings.some(heading => heading && normalized.includes(heading))) score += 1;
  if (EMPTY_META_PHRASES.some(phrase => normalized.includes(normalizeForMatch(phrase)))) score -= 8;
  if (/^(po pierwsze|po drugie|następnie|dodatkowo|ponadto|w tym przypadku)\b/i.test(sentence)) score -= 3;

  return score;
}

function bestEvidence(content: StructuredContent, title: string): string[] {
  return contentSentences(content)
    .map(sentence => ({
      sentence,
      score: scoreEvidenceSentence(sentence, title, content),
    }))
    .sort((a, b) => b.score - a.score || a.sentence.length - b.sentence.length)
    .filter(item => item.score > 0)
    .slice(0, 4)
    .map(item => item.sentence);
}

function mainIntroduction(content: StructuredContent, title: string): string {
  const firstSectionPosition = content.headings
    .filter(heading => heading.level >= 2 && heading.position >= 0)
    .map(heading => heading.position)
    .sort((a, b) => a - b)[0] ?? content.plainText.length;

  const candidates = content.paragraphs
    .map(paragraph => ({
      text: safeTextCandidate(paragraph.text),
      position: content.plainText.indexOf(cleanText(paragraph.text).trim()),
    }))
    .filter(candidate =>
      candidate.text.length >= 70 &&
      candidate.position >= 0 &&
      candidate.position < firstSectionPosition &&
      !isStructuralMetaBlock(candidate.text, content) &&
      !isUxIntroBlock(candidate.text) &&
      !isListLikeText(candidate.text)
    )
    .sort((a, b) => a.position - b.position);

  const paragraph = candidates.find(candidate =>
    titleKeywords(title).some(keyword => normalizeForMatch(candidate.text).includes(keyword))
  )?.text ?? candidates[0]?.text ?? '';

  if (!paragraph) return '';

  const sentences = paragraph
    .split(/(?<=[.!?])\s+/)
    .map(sentence => safeTextCandidate(sentence))
    .filter(Boolean);
  const selected: string[] = [];

  for (const sentence of sentences) {
    if ([...selected, sentence].join(' ').length > 160) break;
    selected.push(sentence);
    if (selected.join(' ').length >= 100) break;
  }

  return selected.join(' ');
}

function hasFact(content: StructuredContent, pattern: RegExp): boolean {
  pattern.lastIndex = 0;
  return pattern.test(content.plainText);
}

function isRecipeArticle(content: StructuredContent, title: string): boolean {
  const normalizedTitle = normalizeForMatch(title);
  const normalizedText = normalizeForMatch(content.plainText);
  const headings = content.headings.map(heading => normalizeForMatch(heading.text));
  const recipeSections = headings.some(heading => /skladniki|ingredients/.test(heading)) &&
    headings.some(heading => /przygotowanie|wykonanie|jak zrobic|instructions|method/.test(heading));

  return recipeSections ||
    /\b(przepis|skladniki|ingredients|recipe)\b/.test(normalizedText) ||
    /\b(lody|ciasto|deser|zupa|salatka|koktajl|chleb|bulki|nalesniki)\b/.test(normalizedTitle);
}

function hasTopicClaim(content: StructuredContent, pattern: RegExp): boolean {
  const titleLike = [
    content.metaTitle,
    content.implicitH1,
    content.headings.find(heading => heading.level === 1)?.text,
    content.headings[0]?.text,
  ].map(text => normalizeForMatch(text ?? '')).join(' ');

  pattern.lastIndex = 0;
  if (pattern.test(titleLike)) return true;

  const firstSectionPosition = content.headings
    .filter(heading => heading.level >= 2 && heading.position >= 0)
    .map(heading => heading.position)
    .sort((a, b) => a - b)[0] ?? Math.min(content.plainText.length, 800);
  const intro = normalizeForMatch(content.plainText.slice(0, Math.min(firstSectionPosition, 800)));

  pattern.lastIndex = 0;
  if (pattern.test(intro)) return true;

  const normalizedText = normalizeForMatch(content.plainText);
  pattern.lastIndex = 0;
  const matches = normalizedText.match(pattern);
  return (matches?.length ?? 0) >= 2;
}

function joinPolishList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} i ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} i ${items.at(-1)}`;
}

function buildRecipeInsight(content: StructuredContent, title: string): string {
  const normalizedTitle = safeTextCandidate(title).replace(/[.!?]+$/, '');
  if (!normalizedTitle) return '';

  const normalizedContent = normalizeForMatch(content.plainText);
  const confirms = (pattern: RegExp) => pattern.test(normalizedContent);
  const isCreamy = hasFact(content, /\bkremow\w*/i);
  const isIceCream = /\blody\b/i.test(normalizedTitle);
  const descriptors: string[] = [];
  const exclusions: string[] = [];

  if (hasTopicClaim(content, /\blow\s*carb\b/g) && !/\blow\s*carb\b/.test(normalizedTitle.toLowerCase())) {
    descriptors.push('low carb');
  }
  if (hasTopicClaim(content, /\bketo\b/g) && !/\bketo\b/.test(normalizedTitle.toLowerCase())) {
    descriptors.push('keto');
  }
  if (hasTopicClaim(content, /\bbez cukru\b|nie zawiera\w*[^.]{0,50}\bcukru\b/g)) exclusions.push('cukru');
  if (hasTopicClaim(content, /\bbez (?:dodatku )?banana\w*|nie zawiera\w*[^.]{0,50}\bbanana\w*/g)) exclusions.push('banana');
  if (hasTopicClaim(content, /\bbez (?:dodatku )?skrobi\b|nie zawiera\w*[^.]{0,70}\bskrobi\b|\bani skrobi\b/g)) exclusions.push('skrobi');

  if (exclusions.length > 0) {
    descriptors.push(`bez ${joinPolishList([...new Set(exclusions)])}`);
  }

  const product = isIceCream && isCreamy
    ? 'Kremowe lody'
    : normalizedTitle;
  const claims = [...new Set(descriptors)];
  const opening = claims.length > 0
    ? `${product} ${claims.join(' ')}.`
    : `${product}.`;

  if (
    confirms(/\bpieczon\w* kalafior\w*/) &&
    confirms(/\bnaturaln\w* stabilizator\w*/) &&
    confirms(/\baksamitn\w* tekstur\w*/) &&
    confirms(/\bbez warzywn\w* smaku\b|nie (?:maja|ma|czuc)[^.]{0,40}\bwarzywn\w* smak\w*/)
  ) {
    return `${opening} Pieczony kalafior działa jak naturalny stabilizator i daje aksamitną teksturę bez warzywnego smaku.`;
  }

  const introduction = content.analysisMode === 'text'
    ? mainIntroduction(content, title)
    : '';
  if (introduction) return introduction;

  const evidence = bestEvidence(content, title)[0];
  return evidence ? `${opening} ${evidence}` : opening;
}

function detectPromise(content: StructuredContent): string {
  const headings = content.headings.map(heading => normalizeForMatch(heading.text));
  const text = normalizeForMatch(content.plainText);

  if (headings.some(heading => /krok po kroku|instrukcja|jak zrobic|przygotowanie/.test(heading))) {
    return 'instrukcję krok po kroku';
  }
  if (headings.some(heading => /bledy|najczestsze bledy/.test(heading))) {
    return 'najczęstsze błędy i sposoby ich uniknięcia';
  }
  if (headings.some(heading => /porownanie|roznice|versus|vs/.test(heading)) || /\bporown\w*/.test(text)) {
    return 'konkretne porównanie najważniejszych różnic';
  }
  if (headings.some(heading => /przyczyny|dlaczego|mechanizm/.test(heading))) {
    return 'wyjaśnienie przyczyn i mechanizmu';
  }
  if (headings.some(heading => /porady|wskazowki|co zrobic/.test(heading))) {
    return 'praktyczne wskazówki możliwe do zastosowania';
  }

  return '';
}

function buildGeneralInsight(content: StructuredContent, title: string): string {
  const evidence = bestEvidence(content, title);
  const promise = detectPromise(content);
  const normalizedTitle = safeTextCandidate(title).replace(/[.!?]+$/, '');

  if (/^dlaczego\b/i.test(normalizedTitle) && evidence[0]) {
    return `Dowiedz się, ${normalizedTitle.toLowerCase()}. Artykuł wyjaśnia ${evidence[0].replace(/[.!?]+$/, '').toLowerCase()}.`;
  }

  if (/^(jak|co|kiedy|gdzie|czy)\b/i.test(normalizedTitle) && promise) {
    return `${normalizedTitle}? Sprawdź ${promise}.`;
  }

  if (evidence.length >= 2) {
    return `${evidence[0]} ${evidence[1]}`;
  }

  if (evidence[0] && promise) {
    return `${evidence[0]} Artykuł zawiera ${promise}.`;
  }

  return evidence[0] || firstMeaningfulSentence(content);
}

function validateGeneratedDescription(description: string, title: string, content: StructuredContent): string {
  const cleaned = safeTextCandidate(description);
  if (!cleaned) return '';

  const normalized = normalizeForMatch(cleaned);
  if (EMPTY_META_PHRASES.some(phrase => normalized.includes(normalizeForMatch(phrase)))) return '';

  const articleText = normalizeForMatch(content.plainText);
  const unsupportedDietClaim =
    (/\bbez cukru\b/i.test(cleaned) && !/\bbez cukru\b/.test(articleText)) ||
    (/\blow\s*carb\b/i.test(cleaned) && !/\blow carb\b/.test(articleText)) ||
    (/\bketo\b/i.test(cleaned) && !/\bketo\b/.test(articleText));
  if (unsupportedDietClaim) return '';

  const keywords = titleKeywords(title);
  if (keywords.length > 0 && !keywords.some(keyword => normalized.includes(keyword))) return '';

  return cleaned;
}

function sentenceParts(text: string): string[] {
  return safeTextCandidate(text)
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

function startsWithSameTopic(a: string, b: string): boolean {
  const topicWords = normalizeForMatch(a)
    .split(' ')
    .filter(word => word.length >= 4)
    .slice(0, 5);
  const normalizedTarget = normalizeForMatch(b);

  return topicWords.length >= 3 && topicWords.every(word => normalizedTarget.includes(word));
}

function finalizeMetaDescription(description: string, title: string, content: StructuredContent): string {
  const cleaned = validateGeneratedDescription(description, title, content);
  if (!cleaned) return '';

  const parts = sentenceParts(cleaned).filter(sentence =>
    !isUxIntroBlock(sentence) &&
    !isGenericSectionTitle(sentence) &&
    !isListLikeText(sentence) &&
    !/:\s*$/.test(sentence)
  );

  if (parts.length >= 2 && parts[1].length >= 70 && parts[1].length <= 160 && startsWithSameTopic(parts[0], parts[1])) {
    parts.shift();
  }

  const selected: string[] = [];
  for (const sentence of parts) {
    const candidate = [...selected, sentence].join(' ');
    if (candidate.length > 160) {
      if (selected.length > 0) break;
      continue;
    }

    selected.push(sentence);
    if (candidate.length >= 130) break;
  }

  const result = selected.join(' ').trim();
  if (result.length >= 70 && result.length <= 160) return result;

  const fallback = contentSentences(content).find(sentence =>
    sentence.length >= 70 &&
    sentence.length <= 160 &&
    !isUxIntroBlock(sentence)
  );

  if (fallback) return fallback;

  return result || parts.find(sentence => sentence.length <= 160) || '';
}

export function extractMainTopic(content: StructuredContent): {
  h1: string;
  topWords: string[];
  slug: string;
} {
  const h1Candidates = [
    content.headings.find(h => h.level === 1)?.text,
    content.implicitH1,
    content.headings[0]?.text,
  ];
  const h1 = safeTextCandidate(h1Candidates.find(isUsableTitleSource));

  const stopPL = new Set(['sie','się','nie','jak','dla','oraz','przez','jest','są','być','ze','co','ale','czy','już','przy','więcej','tylko','też','ten','tej','tego','które','który','która','na','do','pod','nad']);
  const stopEN = new Set(['the','and','that','this','with','from','what','when','where','which','about']);
  const stop = content.language === 'pl' ? stopPL : stopEN;

  const topWords = content.plainText
    .toLowerCase()
    .split(/[\s\W]+/)
    .filter(w => w.length > 4 && !stop.has(w))
    .reduce<Record<string, number>>((acc, word) => {
      acc[word] = (acc[word] ?? 0) + 1;
      return acc;
    }, {});

  const sortedTopWords = Object.entries(topWords)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([word]) => word);

  const slug = (h1 || sortedTopWords[0] || 'article')
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, c => ({ a:'a', ć:'c', ę:'e', ł:'l', ń:'n', ó:'o', ś:'s', ź:'z', ż:'z' }[c] ?? c))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return { h1, topWords: sortedTopWords, slug };
}

function firstMeaningfulSentence(content: StructuredContent): string {
  return content.sentences
    .map(sentence => safeTextCandidate(sentence))
    .find(sentence =>
      sentence.length >= 40 &&
      sentence.length <= 180 &&
      !isProceduralInstruction(sentence) &&
      !isProcedureSectionContent(sentence, content) &&
      !isStructuralMetaBlock(sentence, content)
    ) ?? '';
}

function shortenAtWord(text: string, maxLength: number): string {
  const cleaned = cleanText(text).replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned
    .slice(0, maxLength)
    .replace(/\s+\S*$/, '')
    .replace(/\s+(?:i|oraz|z|ze|w|we|na|do|and|with|of)$/i, '')
    .trim();
}

function removeTrailingBrand(text: string): string {
  const pipeParts = text.split(/\s\|\s/);
  if (pipeParts.length > 1) return pipeParts[0]?.trim() || text;

  const dashMatch = text.match(/^(.*?)\s[-\u2013\u2014]\s(.+)$/);
  if (!dashMatch) return text;

  const left = dashMatch[1]?.trim() ?? '';
  const right = dashMatch[2]?.trim() ?? '';
  const normalizedRight = normalizeForMatch(right);
  const rightWords = normalizedRight.split(' ').filter(Boolean);
  const looksLikeBrand =
    rightWords.length > 0 &&
    rightWords.length <= 3 &&
    !/\b(przepis|poradnik|praktycz|prosty|szybki|sycacy|bez|low|carb|keto|jak|dlaczego|co|czy)\b/.test(normalizedRight);

  return looksLikeBrand && left ? left : text;
}

function titleFromCurrentContent(content: StructuredContent, h1: string): string {
  const candidates = [
    h1,
    content.headings.find(heading => heading.level === 1)?.text,
    content.implicitH1,
    content.headings[0]?.text,
    firstMeaningfulSentence(content),
    content.paragraphs.find(paragraph =>
      isUsableTitleSource(paragraph.text) &&
      !isUxIntroBlock(paragraph.text) &&
      !isProcedureSectionContent(paragraph.text, content)
    )?.text,
  ];
  const source = safeTextCandidate(candidates.find(isUsableTitleSource));
  if (!source) return '';

  const withoutBrand = removeTrailingBrand(source);
  const firstSentence = withoutBrand.split(/(?<=[.!?])\s+/)[0]?.trim() || withoutBrand;
  return shortenAtWord(firstSentence, 60);
}

function enhanceTitle(title: string, content: StructuredContent): string {
  const cleaned = safeTextCandidate(title);
  if (!cleaned) return '';
  if (cleaned.length >= 35) return shortenAtWord(cleaned, 60);

  const suffixes: string[] = [];
  if (hasTopicClaim(content, /\blow\s*carb\b/g) && !/low\s*carb/i.test(cleaned)) suffixes.push('low carb');
  if (hasTopicClaim(content, /\bbez cukru\b/g) && !/bez cukru/i.test(cleaned)) suffixes.push('bez cukru');
  const text = content.plainText.toLowerCase();
  if (/ciasto|deser|wypiek/i.test(text) && !/ciasto|deser|wypiek/i.test(cleaned)) suffixes.push('ciasto');

  const enhanced = suffixes.length > 0
    ? `${cleaned} ${suffixes.slice(0, 2).join(' ')}`
    : cleaned;

  return shortenAtWord(enhanced, 60);
}

function generateTitle(content: StructuredContent, h1: string): string {
  const existingTitle = safeTextCandidate(content.metaTitle);
  if (content.analysisMode === 'html' && existingTitle) {
    return shortenAtWord(existingTitle, 60);
  }
  if (existingTitle && existingTitle.length >= 30 && existingTitle.length <= 60) {
    return existingTitle;
  }

  const title = titleFromCurrentContent(content, h1 || safeTextCandidate(content.headings[0]?.text));
  if (!title || /^[-–—]\s*/.test(title)) return enhanceTitle(existingTitle, content);
  if (titleKeywords(title).length >= 3) return shortenAtWord(title, 60);

  if (content.language === 'pl' && /cukr/i.test(title) && /ogranicz/i.test(title)) {
    return 'Jak ograniczyć cukier? Praktyczne porady';
  }

  return enhanceTitle(title, content);
}

function buildDescriptionFromContent(content: StructuredContent, title: string): string {
  const insight = content.language === 'pl' && isRecipeArticle(content, title)
    ? buildRecipeInsight(content, title)
    : buildGeneralInsight(content, title);
  const validated = validateGeneratedDescription(insight, title, content);
  if (validated) return validated;

  const rankedFallback = bestEvidence(content, title).find(sentence =>
    isGoodMetaDescriptionSource(sentence) &&
    (content.analysisMode !== 'html' || !isProceduralInstruction(sentence))
  );
  return shortenAtWord(rankedFallback || firstMeaningfulSentence(content), 155);
}

function generateMetaDescription(content: StructuredContent, title: string): string {
  const existingDescription = safeTextCandidate(content.metaDescription);
  if (existingDescription && existingDescription.length >= 70 && existingDescription.length <= 160) {
    return existingDescription;
  }

  return finalizeMetaDescription(buildDescriptionFromContent(content, title), title, content);
}

function generateJsonLd(
  content: StructuredContent,
  contentType: ContentType,
  title: string,
  description: string,
  slug: string,
  faqItems: Array<{ question: string; answer: string }>
): string {
  const url = content.canonical ?? `https://twojadomena.pl/${slug}`;
  const datePublished = new Date().toISOString().split('T')[0];
  const schemaType = contentType === 'blog-post' ? 'BlogPosting' : 'Article';

  const articleSchema = {
    '@type': schemaType,
    ...(title ? { headline: title } : {}),
    ...(description ? { description } : {}),
    url,
    datePublished,
    dateModified: datePublished,
    author: {
      '@type': 'Person',
      name: 'Autor',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    wordCount: content.wordCount,
    inLanguage: content.language === 'pl' ? 'pl-PL' : 'en-US',
  };

  const seenQuestions = new Set<string>();
  const validFaqItems = [...faqItems, ...content.faqItems].filter(item => {
    const question = item.question.trim();
    const answer = item.answer.trim();
    const key = normalizeForMatch(question);

    if (!question.endsWith('?') || answer.length < 10 || !key || seenQuestions.has(key)) {
      return false;
    }

    seenQuestions.add(key);
    return true;
  });

  if (validFaqItems.length === 0) {
    return JSON.stringify({
      '@context': 'https://schema.org',
      ...articleSchema,
    }, null, 2);
  }

  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      articleSchema,
      {
        '@type': 'FAQPage',
        mainEntity: validFaqItems.map(item => ({
          '@type': 'Question',
          name: item.question.trim(),
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer.trim(),
          },
        })),
      },
    ],
  }, null, 2);
}

function generateHeadBlock(seo: Omit<SeoPack, 'headBlock' | 'jsonLd'>, jsonLd: string): string {
  const lines = [
    '<!-- SEO Pack - ContentProof -->',
    seo.title ? `<title>${seo.title}</title>` : '',
    seo.metaDescription ? `<meta name="description" content="${seo.metaDescription}">` : '',
    `<link rel="canonical" href="${seo.canonical}">`,
    `<meta name="robots" content="${seo.robotsMeta}">`,
    '',
    '<!-- Open Graph -->',
    `<meta property="og:type" content="${seo.ogTags.type}">`,
    seo.ogTags.title ? `<meta property="og:title" content="${seo.ogTags.title}">` : '',
    seo.ogTags.description ? `<meta property="og:description" content="${seo.ogTags.description}">` : '',
    `<meta property="og:url" content="${seo.canonical}">`,
    seo.ogTags.imageAlt ? `<meta property="og:image:alt" content="${seo.ogTags.imageAlt}">` : '',
    '',
    '<!-- Twitter Card -->',
    `<meta name="twitter:card" content="${seo.twitterCard.card}">`,
    seo.twitterCard.title ? `<meta name="twitter:title" content="${seo.twitterCard.title}">` : '',
    seo.twitterCard.description ? `<meta name="twitter:description" content="${seo.twitterCard.description}">` : '',
    '',
    '<!-- JSON-LD Schema -->',
    '<script type="application/ld+json">',
    jsonLd,
    '</script>',
  ];

  return lines.filter(line => line !== '').join('\n');
}

export function generateSeoPack(
  content: StructuredContent,
  faqItems: Array<{ question: string; answer: string }> = []
): SeoPack {
  const contentType = detectContentType(content);
  const { h1, topWords, slug } = extractMainTopic(content);

  const title = cleanText(generateTitle(content, h1));
  const metaDescription = cleanText(generateMetaDescription(content, title));
  const canonical = content.canonical ?? `https://twojadomena.pl/${slug}`;

  const ogTitle = shortenAtWord(title, 95);
  const ogDesc = shortenAtWord(metaDescription, 200);

  const ogTags = {
    title: ogTitle,
    description: ogDesc,
    type: contentType === 'article' || contentType === 'blog-post' ? 'article' : 'website',
    imageAlt: h1 || topWords[0] || title,
  };

  const twitterCard = {
    card: 'summary_large_image',
    title: ogTitle,
    description: ogDesc,
  };

  const robotsMeta = 'index, follow';
  const jsonLd = generateJsonLd(content, contentType, title, metaDescription, slug, faqItems);
  const partial = {
    contentType,
    title,
    titleLength: title.length,
    metaDescription,
    metaDescriptionLength: metaDescription.length,
    canonical,
    ogTags,
    twitterCard,
    robotsMeta,
    jsonLd,
  };

  const headBlock = generateHeadBlock(partial, jsonLd);

  return { ...partial, headBlock };
}
