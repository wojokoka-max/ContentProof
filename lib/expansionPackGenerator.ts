/**
 * ContentProof — Content Expansion Pack Generator v1.0
 * Generates missing sections, FAQ, internal links, content gaps.
 * Deterministic — no LLM. LLM enhancement ready via Phase 7.
 */

import type { StructuredContent, ContentExpansionPack, ContentType } from './types';
import { cleanText } from './utils/cleanText';

// ─── Topic-based section templates ───────────────────────────────────────────

const SECTION_TEMPLATES_PL: Record<string, string[]> = {
  recipe: ['Składniki', 'Przygotowanie krok po kroku', 'Wartości odżywcze', 'Warianty i modyfikacje', 'Jak przechowywać', 'Najczęstsze błędy', 'FAQ'],
  diet: ['Co to jest?', 'Dla kogo jest odpowiedni?', 'Przykładowy jadłospis', 'Co jeść, a czego unikać', 'Efekty i rezultaty', 'Najczęstsze błędy', 'FAQ'],
  howto: ['Czego będziesz potrzebować', 'Krok po kroku', 'Najczęstsze błędy', 'Alternatywne metody', 'Kiedy szukać pomocy specjalisty', 'FAQ'],
  product: ['Co to jest?', 'Główne zalety', 'Wady i ograniczenia', 'Dla kogo?', 'Alternatywy', 'Jak wybrać?', 'FAQ'],
  generic: ['Wprowadzenie', 'Główne zagadnienia', 'Praktyczne wskazówki', 'Najczęstsze błędy', 'Podsumowanie', 'FAQ'],
};

const SECTION_TEMPLATES_EN: Record<string, string[]> = {
  recipe: ['Ingredients', 'Step-by-Step Instructions', 'Nutritional Information', 'Variations', 'How to Store', 'Common Mistakes', 'FAQ'],
  diet: ['What Is It?', 'Who Is It For?', 'Sample Meal Plan', 'What to Eat and Avoid', 'Results and Effects', 'Common Mistakes', 'FAQ'],
  howto: ['What You\'ll Need', 'Step by Step', 'Common Mistakes', 'Alternative Methods', 'When to Seek Help', 'FAQ'],
  product: ['What Is It?', 'Main Benefits', 'Drawbacks', 'Who Is It For?', 'Alternatives', 'How to Choose', 'FAQ'],
  generic: ['Introduction', 'Main Topics', 'Practical Tips', 'Common Mistakes', 'Summary', 'FAQ'],
};

const SAFE_AUTO_SECTION_CATEGORIES = new Set(['recipe']);

// ─── Content category detection ───────────────────────────────────────────────

function detectArticleCategory(content: StructuredContent): string {
  const text = content.plainText.toLowerCase();
  const h1 = (content.headings.find(h => h.level === 1)?.text ?? content.implicitH1 ?? '').toLowerCase();
  const h2s = content.headings.filter(h => h.level === 2).map(h => h.text.toLowerCase());

  // H1 intent is the strongest signal — check it first
  if (h1.startsWith('jak ') || h1.startsWith('how to ')) return 'howto';
  if (/przepis na|recipe for/.test(h1)) return 'recipe';
  if (/recenzja|opinia|review|ranking|porównan/.test(h1)) return 'product';

  // H2 patterns — if most H2s look like recipe steps, it's a recipe
  const recipeH2s = h2s.filter(h => /^(składniki|przygotowanie|krok \d|step \d|ingredients|instructions)/.test(h));
  if (recipeH2s.length >= 2) return 'recipe';

  // Body keywords — but only if H1 doesn't suggest otherwise
  const isLifestyle = /jak (zacząć|żyć|wprowadzić|ograniczyć|zmienić|przejść)|porady|wskazówki|praktyczne|how to (start|live|reduce|change)/.test(h1);
  if (isLifestyle) return 'howto';

  if (/dieta|low.?carb|keto|odchudzanie|diet/.test(text) && !isLifestyle) return 'diet';
  if (/przepis|składniki|recipe|ingredients/.test(text)) return 'recipe';
  if (/krok po kroku|step by step/.test(text)) return 'howto';
  if (/recenzja|opinia|review|porównanie/.test(text)) return 'product';
  return 'generic';
}

// ─── Missing sections ─────────────────────────────────────────────────────────

function findMissingSections(
  content: StructuredContent,
  category: string
): Array<{ heading: string; why: string }> {
  const lang = content.language;
  if (!SAFE_AUTO_SECTION_CATEGORIES.has(category)) return [];

  const templates = lang === 'pl' ? SECTION_TEMPLATES_PL : SECTION_TEMPLATES_EN;
  const expected = templates[category] ?? templates['generic'];

  const existingH2 = content.headings
    .filter(h => h.level === 2)
    .map(h => h.text.toLowerCase());

  const missing: Array<{ heading: string; why: string }> = [];

  for (const section of expected) {
    const sectionLower = section.toLowerCase();
    const exists = existingH2.some(h =>
      h.includes(sectionLower) ||
      sectionLower.includes(h.slice(0, 8))
    );

    if (!exists) {
      const whyMap: Record<string, string> = {
        'FAQ': lang === 'pl'
          ? 'Zwiększa szanse na rich snippets i odpowiada na pytania użytkowników'
          : 'Increases chances of rich snippets and answers user questions',
        'Składniki': lang === 'pl' ? 'Kluczowa sekcja dla przepisów — oczekiwana przez czytelników' : 'Key section for recipes',
        'Ingredients': 'Key section for recipes — expected by readers',
        'Krok po kroku': lang === 'pl' ? 'Poprawia czytelność i pozwala na schema HowTo' : 'Improves readability',
        'Step by Step': 'Improves readability and enables HowTo schema',
        'Najczęstsze błędy': lang === 'pl' ? 'Wysoko ceniony przez Google — odpowiada na intent użytkownika' : 'Highly valued by Google',
        'Common Mistakes': 'Highly valued by Google — answers user intent',
      };

      missing.push({
        heading: section,
        why: whyMap[section] ?? (lang === 'pl'
          ? 'Brakująca sekcja — oczekiwana dla tego typu treści'
          : 'Missing section — expected for this content type'),
      });
    }
  }

  return missing.slice(0, 5);
}

// ─── FAQ generation from headings ─────────────────────────────────────────────

// ─── Topic keyword extractor ──────────────────────────────────────────────────

/**
 * Extract a SHORT topic keyword from H1/title — NOT the full sentence.
 * "Ciasto z truskawkami i pianką low carb" → "ciasto z truskawkami"
 * "Jak zacząć żyć z ograniczoną ilością cukru" → "ograniczenie cukru"
 * "Low carb dla początkujących" → "low carb"
 */
function extractTopicKeyword(h1: string, lang: 'pl' | 'en'): string {
  // Remove leading "Jak ", "Co to jest ", "Czym jest " etc.
  let topic = h1
    .replace(/^(jak|co to jest|czym jest|dlaczego|kiedy|gdzie|how to|what is|why|when)\s+/i, '')
    .replace(/^(zacząć|zaczać|zaczynać|nauczyć się|dowiedzieć się|zrozumieć)\s+/i, '')
    .trim();

  // Take first meaningful noun phrase — split at " - ", " – ", " | ", " — "
  const dashSplit = topic.split(/\s[–\-|—]\s/);
  if (dashSplit[0].length < 50) topic = dashSplit[0].trim();

  // Remove trailing qualifiers: "krok po kroku", "poradnik", "kompletny", "dla początkujących"
  topic = topic
    .replace(/\s+(krok po kroku|poradnik|przewodnik|kompletny|dla początkujących|dla każdego|na co dzień|w praktyce|step by step|guide|complete|for beginners)$/i, '')
    .trim();

  // Max 5 words — take first 5
  const words = topic.split(/\s+/);
  if (words.length > 5) topic = words.slice(0, 5).join(' ');

  return topic.toLowerCase();
}

// ─── FAQ cleanup ──────────────────────────────────────────────────────────────

function cleanQuestion(q: string): string {
  return q
    // Remove duplicated words (e.g. "low carb low carb")
    .replace(/(\w+(?:\s+\w+){0,3})\s+/gi, '$1')
    // Normalize multiple spaces
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isQuestionValid(q: string, h1: string): boolean {
  const lower = q.toLowerCase();
  const h1Lower = h1.toLowerCase();

  // Reject if question IS essentially the h1
  if (lower.replace(/[?]/g, '').trim() === h1Lower) return false;

  // Reject malformed starts
  if (/^czy jak\s/i.test(q)) return false;
  if (/^jak jak\s/i.test(q)) return false;
  if (/^co co\s/i.test(q)) return false;

  // Reject if longer than 80 chars (too verbose)
  if (q.length > 80) return false;

  // Reject if it contains the full h1 verbatim (more than 5 words overlap)
  if (h1.split(' ').length > 4) {
    const h1Words = new Set(h1Lower.split(/\s+/));
    const qWords = lower.split(/\s+/);
    const overlap = qWords.filter(w => w.length > 3 && h1Words.has(w)).length;
    if (overlap > 4) return false;
  }

  return true;
}

function summarizeFaqAnswer(text: string): string | null {
  const cleaned = cleanText(text)
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length < 80) return null;

  const sentences = cleaned
    .split(/(?<=[.!?…])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  const selectedSentences: string[] = [];
  for (const sentence of sentences) {
    const candidate = [...selectedSentences, sentence].join(' ');
    if (candidate.length > 360) break;
    selectedSentences.push(sentence);
    if (selectedSentences.length >= 3 || candidate.length >= 220) break;
  }

  const answer = (selectedSentences.length > 0 ? selectedSentences.join(' ') : cleaned)
    .slice(0, 360)
    .trim();

  const trimmedAnswer = answer.length >= 360 ? answer.replace(/\s+\S*$/, '') : answer;
  return trimmedAnswer.length >= 80 ? trimmedAnswer : null;
}

function hasNaturalFaqFlow(answer: string, lang: 'pl' | 'en'): boolean {
  const sentences = answer
    .split(/(?<=[.!?…])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);

  if (sentences.length >= 2) return true;

  const conversationalConnector = lang === 'pl'
    ? /\b(ale|bo|chociaż|dlatego|dzięki temu|gdy|jeśli|jednak|kiedy|który|która|które|ponieważ|więc|żeby|że)\b/i
    : /\b(although|because|but|if|however|so|that|therefore|when|which|while)\b/i;

  return conversationalConnector.test(answer);
}

function isImperativeFaqAnswer(answer: string, lang: 'pl' | 'en'): boolean {
  const sentences = answer
    .split(/(?<=[.!?…])\s+/)
    .map(sentence => sentence.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);

  if (sentences.length === 0) return false;

  const imperativeWord = lang === 'pl'
    ? /\b(dodaj|dopraw|gotuj|kliknij|odstaw|otwórz|pamiętaj|piecz|podgrzej|połącz|pokrój|porównaj|przelej|przełóż|przemieszaj|przygotuj|rozgrzej|rozłóż|schłódź|skróć|smaż|sprawdź|upewnij się|ugotuj|unikaj|ustaw|usuń|utrzyj|użyj|wlej|wymieszaj|wybierz|zblenduj|zacznij|zamroź|zastosuj|zmień|zrób)\b/i
    : /\b(add|bake|blend|boil|choose|click|combine|compare|cook|cool|cut|freeze|heat|mix|open|pour|prepare|remember|remove|roast|set|stir|use|wait|warm|whisk)\b/i;

  return sentences.some(sentence => imperativeWord.test(sentence));
}

function joinFaqList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} lub ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} lub ${items.at(-1)}`;
}

function normalizeSectionAnswer(sectionText: string, headingText: string): string {
  if (!/^z czym(?:\s|$)/i.test(headingText)) return sectionText;

  const parts = sectionText
    .split(/\s+[-*•]\s+/)
    .map(part => cleanText(part).replace(/[,.]+$/, '').trim())
    .filter(Boolean);

  if (parts.length < 3) return sectionText;

  const introduction = parts[0].replace(/:\s*$/, '').trim();
  const items = parts.slice(1);
  return `${introduction} ${joinFaqList(items)}.`;
}

function answerFromSection(content: StructuredContent, headingText: string): string | null {
  const heading = content.headings.find(h => h.level === 2 && h.text === headingText);
  if (!heading || heading.position < 0) return null;

  const nextHeading = content.headings
    .filter(h => h.position > heading.position)
    .sort((a, b) => a.position - b.position)[0];

  const start = heading.position + heading.text.length;
  const end = nextHeading ? nextHeading.position : content.plainText.length;
  const sectionText = content.plainText
    .slice(start, end)
    .replace(headingText, '')
    .trim();

  return summarizeFaqAnswer(normalizeSectionAnswer(sectionText, headingText));
}

function answerFromArticleSentences(content: StructuredContent, patterns: RegExp[]): string | null {
  const sentences = content.sentences
    .map(sentence => cleanText(sentence).replace(/\s+/g, ' ').trim())
    .filter(sentence => {
      if (sentence.length < 35 || sentence.length > 260) return false;
      const lower = sentence.toLowerCase();
      const navigationHits = [
        'start',
        'narzędzia',
        'kalkulator',
        'generator',
        'przepisy',
        'poradniki',
        'kontakt',
        'encyklopedia',
      ].filter(word => lower.includes(word)).length;

      return navigationHits < 3;
    });

  const selected: string[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    if (!patterns.some(pattern => pattern.test(sentence))) continue;
    if (/^(dzięki temu|w ten sposób|dlatego|wtedy|z tego powodu)\b/i.test(sentence)) continue;
    if (isImperativeFaqAnswer(sentence, content.language)) continue;

    selected.push(sentence);
    const next = sentences[i + 1];
    if (
      next &&
      next.length >= 35 &&
      !/^\d+\./.test(next) &&
      !isImperativeFaqAnswer(next, content.language) &&
      !/^(dzięki temu|w ten sposób|dlatego|wtedy|z tego powodu)\b/i.test(next) &&
      selected.join(' ').length < 180
    ) {
      selected.push(next);
    }
    break;
  }

  return summarizeFaqAnswer(selected.join(' '));
}

function isPrimaryProcedureHeading(heading: string): boolean {
  return /^(składniki|lista składników|potrzebne składniki|jak (zrobić|przygotować|upiec|ugotować|skonfigurować|wdrożyć|naprawić|zainstalować|uruchomić|wykonać)|przygotowanie|wykonanie|instrukcja|procedura|proces|krok po kroku|ingredients|how to (make|prepare|bake|cook|configure|deploy|fix|install|run)|preparation|method|instructions?|procedure|process|step by step)\b/i.test(
    heading.trim()
  );
}

function generateUrlFaqFallback(
  content: StructuredContent,
  h1: string
): Array<{ question: string; answer: string }> {
  if (content.analysisMode !== 'url' || content.language !== 'pl') return [];

  const candidates: Array<{ question: string; patterns: RegExp[] }> = [];

  if (/\bkrem\b/i.test(h1) && /\bnie trzeba\b[^.]{0,60}\bsch[łl]adza[ćc]/i.test(content.plainText)) {
    candidates.push({
      question: 'Czy krem trzeba schładzać?',
      patterns: [/\bnie trzeba\b[^.]{0,60}\bsch[łl]adza[ćc]/i],
    });
  }

  return candidates
    .map(candidate => ({
      question: candidate.question,
      answer: answerFromArticleSentences(content, candidate.patterns) ?? '',
    }))
    .filter(item =>
      item.answer &&
      isQuestionValid(item.question, h1) &&
      isPublishableFaqItem(item) &&
      hasNaturalFaqFlow(item.answer, content.language)
    );
}

function generateFaqFromArticleSentences(
  content: StructuredContent,
  h1: string
): Array<{ question: string; answer: string }> {
  if (content.language !== 'pl') return [];
  const topicText = `${h1} ${content.plainText.slice(0, 900)}`;
  const isSugarReductionArticle = /\b(ograniczanie|ograniczyć|odstawić|zmniejszyć|rezygnować z)\b[^.!?]{0,80}\b(cukier|słodycze|słodzone napoje)\b/i.test(topicText) ||
    /\bjak (zacząć )?(żyć )?z ograniczoną ilością cukru\b/i.test(h1);
  if (!isSugarReductionArticle) return [];

  const candidates = [
    {
      question: 'Od czego zacząć ograniczanie cukru?',
      patterns: [/słodzonych napoj/i, /energetyk/i, /nie słodź/i, /płynny cukier/i],
    },
    {
      question: 'Dlaczego warto odstawić słodzone napoje?',
      patterns: [/płynny cukier/i, /poziom glukozy/i, /nie daje sytości/i, /apetyt na słodkie/i],
    },
    {
      question: 'Czy trzeba całkowicie rezygnować ze słodyczy?',
      patterns: [/pojedynczy deser/i, /ciągłe podjadanie/i, /po posiłku/i, /osobną przekąsk/i],
    },
    {
      question: 'Co pomaga utrzymać sytość przy ograniczaniu cukru?',
      patterns: [/białk/i, /zdrowych tłuszcz/i, /warzyw/i, /sytość/i],
    },
    {
      question: 'Jak ograniczyć skoki glukozy w codziennym jedzeniu?',
      patterns: [/glukoz/i, /biała mąk/i, /węglowodan/i, /stabiliz/i],
    },
  ];

  const seenAnswers = new Set<string>();

  return candidates
    .map(candidate => ({
      question: candidate.question,
      answer: answerFromArticleSentences(content, candidate.patterns) ?? '',
    }))
    .filter(item => {
      if (
        !item.answer ||
        !isQuestionValid(item.question, h1) ||
        !isPublishableFaqItem(item) ||
        !hasNaturalFaqFlow(item.answer, content.language)
      ) return false;
      const answerKey = item.answer.toLowerCase().replace(/\W+/g, ' ').trim().slice(0, 120);
      if (seenAnswers.has(answerKey)) return false;
      seenAnswers.add(answerKey);
      return true;
    })
    .slice(0, 4);
}

function generateRecipeFaqFromEvidence(
  content: StructuredContent,
  h1: string
): Array<{ question: string; answer: string }> {
  if (content.language !== 'pl') return [];

  const headingText = content.headings.map(heading => heading.text).join(' ');
  const looksLikeRecipe = /\b(składniki|przygotowanie|pieczenie|gotowanie|przepis)\b/i.test(headingText) ||
    /\bskładniki\b/i.test(content.plainText);
  if (!looksLikeRecipe) return [];

  const subject = /\blod(y|ów|ami)?\b/i.test(h1)
    ? { genitive: 'lodów', accusative: 'lody' }
    : /\bciast(o|a|em)?\b/i.test(h1)
      ? { genitive: 'ciasta', accusative: 'ciasto' }
      : /\bkrem(u|em)?\b/i.test(h1)
        ? { genitive: 'kremu', accusative: 'krem' }
        : { genitive: 'dania', accusative: 'danie' };

  const candidates = [
    {
      question: 'Czy można zmienić niektóre składniki?',
      patterns: [/\bzastąpi[ćc]\b/i, /\bzamieni[ćc]\b/i, /\bwymieni[ćc]\b/i, /\bmożna użyć\b/i],
    },
    {
      question: `Co wpływa na konsystencję ${subject.genitive}?`,
      patterns: [/\bkremow/i, /\bkonsystenc/i, /\btekstur/i, /\btwardn/i, /\bkryształ/i, /\bgęst/i],
    },
    {
      question: `Jakiego smaku można się spodziewać po przygotowaniu ${subject.genitive}?`,
      patterns: [/\bsmak/i, /\baromat/i, /\borzechow/i, /\bkarmelow/i, /\bwanili/i],
    },
    {
      question: `Jak przechowywać ${subject.accusative}?`,
      patterns: [/\bprzechow/i, /\bzamrażar/i, /\blodówce\b/i, /\bszczeln\w*\s+pojemnik/i, /\bdo \d+ dni\b/i],
    },
    {
      question: 'Jakich błędów unikać podczas przygotowania?',
      patterns: [/\buważaj\b/i, /\bnie doprowadzaj\b/i, /\bzbyt (wysok|dług|krótk)/i, /\bnie spal/i],
    },
  ];
  return candidates
    .map(candidate => ({
      question: candidate.question,
      answer: answerFromArticleSentences(content, candidate.patterns) ?? '',
    }))
    .filter(item =>
      item.answer &&
      isQuestionValid(item.question, h1) &&
      isPublishableFaqItem(item) &&
      hasNaturalFaqFlow(item.answer, content.language)
    );
}

function generateRecipeProcessFaq(
  content: StructuredContent,
  h1: string
): Array<{ question: string; answer: string }> {
  if (content.language !== 'pl') return [];

  const text = content.plainText.replace(/\s+/g, ' ').trim();
  const headingText = content.headings.map(heading => heading.text).join(' ');
  const looksLikeRecipe = /\b(składniki|przygotowanie|pieczenie|gotowanie|przepis)\b/i.test(headingText) ||
    /\bskładniki\b/i.test(text);
  if (!looksLikeRecipe) return [];

  const items: Array<{ question: string; answer: string }> = [];

  const bakedIngredient = text.match(
    /(?:upiecz|piecz)\s+([a-ząćęłńóśźż][a-ząćęłńóśźż\s-]{2,45}?)(?=\s+(?:rozgrzej|w temperaturze|przez|około)|[.!?])/i
  );
  const ovenTemperature = text.match(/(?:piekarnik|piecz)[^.!?]{0,100}?(\d{2,3})\s*°\s*C/i);
  if (bakedIngredient && ovenTemperature) {
    const ingredient = cleanText(bakedIngredient[1]).replace(/\s+/g, ' ').trim().toLowerCase();
    const nearbyTime = text.match(
      new RegExp(`(?:${ingredient.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|piek)[^.!?]{0,180}?(?:przez|około)\\s+(\\d+(?:[–-]\\d+)?)\\s*(minut|godzin)`, 'i')
    );
    const timePart = nearbyTime
      ? ` Zwykle trwa to około ${nearbyTime[1]} ${nearbyTime[2]}.`
      : '';

    items.push({
      question: `W jakiej temperaturze należy piec ${ingredient}?`,
      answer: `${ingredient.charAt(0).toUpperCase()}${ingredient.slice(1)} należy piec w temperaturze ${ovenTemperature[1]}°C.${timePart} Niższa temperatura pozwala kontrolować ten etap bez gwałtownego przypalania składnika.`,
    });
  }

  const chilling = text.match(
    /sch[łl][oó]d[źz]?(?:\s+\w+){0,4}\s+(?:minimum|co najmniej|przez)\s+(\d+(?:[–-]\d+)?)\s*(minut|godzin)([^.!?]{0,70})/i
  );
  if (chilling) {
    const overnight = /ca[łl][ąa]\s+noc/i.test(chilling[3]);
    items.push({
      question: 'Jak długo należy chłodzić masę przed kolejnym etapem?',
      answer: `Masę należy chłodzić przez minimum ${chilling[1]} ${chilling[2]}${overnight ? ', a najlepiej pozostawić ją na całą noc' : ''}. Odpowiednie schłodzenie pomaga ustabilizować konsystencję przed dalszym przygotowaniem.`,
    });
  }

  const manualFreezing = text.match(
    /(?:przy ręcznym mrożeniu|bez maszynki)[^.!?]{0,140}?(\d+(?:[–-]\d+)?)\s*razy[^.!?]{0,80}?co\s+(?:około\s+)?(\d+)\s*minut/i
  );
  if (manualFreezing) {
    items.push({
      question: 'Jak często mieszać lody podczas ręcznego mrożenia?',
      answer: `Podczas ręcznego mrożenia masę należy przemieszać ${manualFreezing[1]} razy, mniej więcej co ${manualFreezing[2]} minut. Regularne mieszanie ogranicza tworzenie dużych kryształków lodu i pomaga zachować gładszą konsystencję.`,
    });
  }

  const doNotBoil = text.match(/nie doprowadzaj(?:\s+\w+){0,5}\s+do wrzenia/i);
  if (doNotBoil) {
    items.push({
      question: 'Na co uważać podczas podgrzewania masy?',
      answer: 'Masy nie należy doprowadzać do wrzenia. Najlepiej podgrzewać ją na małym ogniu i stale kontrolować konsystencję, aby składniki połączyły się bez przegrzania.',
    });
  }

  return items.filter(item =>
    isQuestionValid(item.question, h1) &&
    isPublishableFaqItem(item) &&
    hasNaturalFaqFlow(item.answer, content.language)
  );
}

// ─── H2 to question converter ────────────────────────────────────────────────

/**
 * Convert any H2 heading into a natural question — universal, topic-agnostic.
 * Works for: technology, finance, health, law, marketing, cooking, travel, anything.
 *
 * Strategy:
 * 1. Already a question → use as-is
 * 2. Skip nav/meta sections (Podsumowanie, Wstęp, Kontakt...)
 * 3. Starts with question word (Jak, Dlaczego, Co...) → append "?"
 * 4. Known semantic patterns (zalety, wady, błędy, koszty...) → natural template
 * 5. Verbal noun (instalacja, konfiguracja, analiza...) → "Jak przebiega X?"
 * 6. Short noun phrase → "Co to jest X?"
 * 7. Long phrase → append "?"
 */
function isPublishableFaqItem(item: { question: string; answer: string }): boolean {
  const question = cleanText(item.question).trim();
  const answer = cleanText(item.answer).trim();
  const combined = `${question} ${answer}`.toLowerCase();

  if (!question.endsWith('?')) return false;
  if (answer.length < 80) return false;
  if (/\b\d+\.$/.test(answer)) return false;
  const bulletCount = (answer.match(/(?:^|\s)[-*•]\s+\S/g) ?? []).length;
  if (bulletCount >= 3) return false;
  const numberedStepCount = (answer.match(/(?:^|\s)\d+[.)]\s+\S/g) ?? []).length;
  if (numberedStepCount > 0) return false;
  const lang = /[ąćęłńóśźż]/i.test(combined) ||
    /\b(czy|jak|jest|można|nie|się|oraz|który|która|które)\b/i.test(combined)
    ? 'pl'
    : 'en';
  if (isImperativeFaqAnswer(answer, lang)) return false;

  const editorialPatterns = [
    /dopasuj szczeg[oó]ły/,
    /\buzupe[łl]nij\b/,
    /\bwymie[ńn]\b/,
    /\bpodaj\b/,
    /warto doda[ćc]/,
    /na podstawie artyku[łl]u/,
    /dostosuj do tre[śs]ci/,
    /sprawd[źz] za[łl]o[żz]enia/,
    /wymaga r[ęe]cznego dopracowania/,
    /\bplaceholder\b/,
    /\badd 2-3\b/,
    /adapt the details/,
    /\bfill in\b/,
    /based on the article/,
  ];

  return !editorialPatterns.some(pattern => pattern.test(combined));
}

function h2ToQuestion(h2: string, lang: 'pl' | 'en'): string | null {
  const t = h2.trim();
  if (!t || t.length < 3 || t.length > 90) return null;
  const lower = t.toLowerCase();

  // Skip navigation/meta sections
  const SKIP_PL = /^(podsumowanie|wstęp|wprowadzenie|kontakt|o autorze|bibliografia|źródła|spis treści|nawigacja|stopka)$/i;
  const SKIP_EN = /^(summary|conclusion|introduction|contact|about( us)?|references|bibliography|table of contents|navigation|footer)$/i;
  if (lang === 'pl' && SKIP_PL.test(t)) return null;
  if (lang === 'en' && SKIP_EN.test(t)) return null;

  // Already a question — use as-is
  if (t.endsWith('?')) {
    return t;
  }

  if (lang === 'pl') {
    if (/^(jak (zrobić|przygotować|upiec|ugotować)|przygotowanie|wykonanie|instrukcja|krok po kroku)/i.test(t))
      return null;
    if (/^(składniki|lista składników|potrzebne składniki)$/i.test(t))
      return 'Jakich składników potrzeba?';
    if (/^(wskazówki|praktyczne wskazówki)$/i.test(t))
      return 'Na co warto zwrócić uwagę?';
    if (/^wartości odżywcze$/i.test(t))
      return 'Co warto wiedzieć o wartościach odżywczych?';
    if (/^najważniejsze$/i.test(t))
      return 'Co jest najważniejsze w tym temacie?';

    // Pozostałe etykiety bloków skanowalnych nie dają dość kontekstu,
    // żeby tworzyć z nich naturalne pytania.
    const NON_QUESTION_SECTIONS_PL =
      /^(spis|lista|informacje dodatkowe)$/i;
    if (NON_QUESTION_SECTIONS_PL.test(t)) return null;

    // 1. Starts with question word → just append "?"
    if (/^(jak |dlaczego |kiedy |gdzie |skąd |po co |ile |kto |czym |co |czy )/i.test(t))
      return `${t}?`;
    if (/^z czym(?:\s|$)/i.test(t))
      return 'Z czym najlepiej podawać to danie?';

    // 2. Universal semantic patterns — work for ANY topic domain
    if (/^(zalety|korzyści|plusy)/i.test(t))
      return `Jakie są ${lower}?`;
    if (/^(wady|minusy|ograniczenia|problemy z)/i.test(t))
      return `Jakie są ${lower}?`;
    if (/^(błędy|najczęstsze błędy|pułapki|czego unikać)/i.test(t))
      return 'Jakich błędów unikać?';
    if (/^(wymagania|wymogi|warunki|co jest potrzebne)/i.test(t))
      return `Jakie są ${lower}?`;
    if (/^(koszt|cena|koszty|cennik|ile kosztuje)/i.test(t))
      return 'Ile to kosztuje?';
    if (/^(alternatywy?|zamienniki?|inne opcje|inne metody)/i.test(t))
      return 'Jakie są alternatywy?';
    if (/^(dla kogo|kto powinien|kto może)/i.test(t))
      return 'Dla kogo to jest?';
    if (/^(wyniki|efekty|rezultaty|skutki)/i.test(t))
      return 'Jakich efektów można się spodziewać?';
    if (/^(narzędzia?|zasoby|materiały|sprzęt)/i.test(t))
      return 'Czego będę potrzebować?';
    if (/^(czas|czas trwania|jak długo)/i.test(t))
      return 'Ile czasu to zajmuje?';
    if (/^(bezpieczeństwo|ryzyko|zagrożenia|skutki uboczne)/i.test(t))
      return 'Czy to jest bezpieczne?';
    if (/^(przykłady?|case study|studia przypadku)/i.test(t))
      return 'Jakie są przykłady?';
    if (/^(porównanie|różnica|.+ a .+|.+ vs\.? .+)/i.test(t))
      return `${t}?`;
    if (/^(historia|geneza|skąd pochodzi|początki)/i.test(t))
      return `${t}?`;
    if (/^(poradnik|instrukcja|przewodnik)/i.test(t))
      return null; // generic section headers, skip
    if (/^(faq|często zadawane pytania)/i.test(t))
      return null;

    // 3. Verbal nouns common across all domains
    const VERBAL_NOUNS_PL = /^(instalacja|konfiguracja|uruchomienie|wdrożenie|implementacja|budowa|tworzenie|projektowanie|planowanie|analiza|ocena|wybór|przejście|zmiana|optymalizacja|testowanie|zarządzanie|obsługa|użytkowanie|stosowanie|rejestracja|logowanie|integracja|migracja|aktualizacja|naprawa|rozwiązywanie|diagnoza|montaż|demontaż|przygotowanie|gotowanie|pieczenie|gotowanie|serwowanie|pakowanie|wysyłka|dostawa|zwrot)/i;
    if (/^(przygotowanie|gotowanie|pieczenie|serwowanie)/i.test(t))
      return 'Jak wygląda przygotowanie krok po kroku?';
    if (VERBAL_NOUNS_PL.test(t))
      return `Jak przebiega ${lower}?`;

    // Krótka polska etykieta sekcji nie daje dość kontekstu,
    // żeby utworzyć naturalne pytanie gotowe do publikacji.
    const words = t.split(/\s+/);
    if (words.length <= 4)
      return null;

    // 5. Long complex H2 — try to extract a shorter question from it
    // e.g. "Lista prostych zaleceń, jak zacząć być low carb" → "Jak zacząć być low carb?"
    const jakMatch = t.match(/jak\s+(.{10,50})$/i);
    if (jakMatch) return `Jak ${jakMatch[1].replace(/[?.]$/, '')}?`;
    const coMatch = t.match(/co\s+(.{10,50})$/i);
    if (coMatch) return `Co ${coMatch[1].replace(/[?.]$/, '')}?`;
    // Too long and complex → skip (don't generate ugly questions)
    if (t.split(' ').length > 8) return null;
    return `${t}?`;

  } else {
    if (/^(how to (make|prepare|bake|cook)|preparation|method|instructions?|step by step)/i.test(t))
      return null;

    // English — same universal logic

    // 1. Starts with question word
    if (/^(how |why |when |where |what |who |can |is |are |does |do |should |will )/i.test(t))
      return `${t}?`;

    // 2. Universal semantic patterns
    if (/^(benefits?|advantages?|pros)/i.test(t))
      return `What are the ${lower}?`;
    if (/^(drawbacks?|disadvantages?|cons|limitations?)/i.test(t))
      return `What are the ${lower}?`;
    if (/^(mistakes?|common mistakes?|pitfalls?|what to avoid|errors?)/i.test(t) || /common mistakes/i.test(t))
      return 'What mistakes should I avoid?';
    if (/^(requirements?|prerequisites?|conditions?)/i.test(t))
      return `What are the ${lower}?`;
    if (/^(cost|price|pricing|how much)/i.test(t))
      return 'How much does it cost?';
    if (/^(alternatives?|options?|substitutes?|other methods)/i.test(t))
      return 'What are the alternatives?';
    if (/^(who (should|is|can)|for whom|target)/i.test(t))
      return 'Who is this for?';
    if (/^(results?|effects?|outcomes?|impact)/i.test(t))
      return 'What results can I expect?';
    if (/^(tools?|resources?|materials?|equipment)/i.test(t))
      return 'What do I need?';
    if (/^(time|duration|how long|timeline)/i.test(t))
      return 'How long does it take?';
    if (/^(safety|risk|danger|side effects)/i.test(t))
      return 'Is it safe?';
    if (/^(examples?|case stud|use cases?)/i.test(t))
      return 'What are some examples?';
    if (/^(comparison|difference|.+ vs\.? .+)/i.test(t))
      return `${t}?`;
    if (/^(history|background|origin)/i.test(t))
      return `${t}?`;
    if (/^(faq|frequently asked)/i.test(t))
      return null;

    // 3. Verbal nouns
    const VERBAL_NOUNS_EN = /^(installation|configuration|setup|deployment|implementation|building|creating|designing|planning|analysis|evaluation|selection|migration|transition|optimization|testing|management|usage|operation|registration|login|integration|update|repair|troubleshooting|diagnosis|assembly|preparation|cooking|baking|serving|packaging|shipping|delivery|return)/i;
    if (VERBAL_NOUNS_EN.test(t))
      return `How does ${lower} work?`;

    // 4. Short noun phrase
    const words = t.split(/\s+/);
    if (words.length <= 4)
      return `What is ${lower}?`;

    // 5. Long complex H2 — try to extract core question
    const howMatch = t.match(/how\s+(.{10,50})$/i);
    if (howMatch) return `How ${howMatch[1].replace(/[?.]$/, '')}?`;
    // Too long → skip
    if (t.split(' ').length > 8) return null;
    return `${t}?`;
  }
}

// ─── Main FAQ generator ───────────────────────────────────────────────────────

function generateFaqFromContent(content: StructuredContent): Array<{ question: string; answer: string }> {
  const minimumGeneratedFaqCount = 3;
  const lang = content.language;
  const h1 = content.headings.find(h => h.level === 1)?.text ?? content.implicitH1 ?? '';
  const questions: Array<{ question: string; answer: string }> = [];
  const seenQuestions = new Set<string>();
  const seenAnswers = new Set<string>();

  const addQuestion = (item: { question: string; answer: string }): void => {
    const question = cleanText(cleanQuestion(item.question));
    const answer = summarizeFaqAnswer(item.answer) ?? cleanText(item.answer);
    const normalized = { question, answer };
    if (!isQuestionValid(question, h1) || !isPublishableFaqItem(normalized)) return;

    const questionKey = question.toLowerCase();
    const answerKey = answer.toLowerCase().replace(/\W+/g, ' ').trim().slice(0, 120);
    if (seenQuestions.has(questionKey) || seenAnswers.has(answerKey)) return;

    seenQuestions.add(questionKey);
    seenAnswers.add(answerKey);
    questions.push(normalized);
  };

  // 1. Existing FAQ items in article — best quality, keep before suggestions.
  content.faqItems.slice(0, 6).forEach(f => {
    addQuestion({
      question: cleanText(cleanQuestion(f.question)),
      answer: summarizeFaqAnswer(f.answer) ?? cleanText(f.answer),
    });
  });

  // 2. Text-detected FAQ from plain text parser
  content.textFaqItems?.slice(0, 6).forEach(f => {
    addQuestion({
      question: cleanText(cleanQuestion(f.question)),
      answer: summarizeFaqAnswer(f.answer) ?? cleanText(f.answer),
    });
  });

  // 3. Generate from article sentences when concrete advice is present.
  const sentenceFaq = generateFaqFromArticleSentences(content, h1);
  sentenceFaq.forEach(addQuestion);

  // 4. Recipes need supplementary questions, never a copy of the main method.
  generateRecipeFaqFromEvidence(content, h1).forEach(addQuestion);
  generateRecipeProcessFaq(content, h1).forEach(addQuestion);

  // 5. Generate from H2 headings, but answer only with nearby article content.
  const h2s = content.headings.filter(h => h.level === 2).map(h => h.text);

  for (const h2 of h2s) {
    if (isPrimaryProcedureHeading(h2)) continue;
    const result = content.analysisMode === 'url' && /^wykonanie$/i.test(h2)
      ? (/\bkrem jogurtowo-mascarpone\b/i.test(h1)
          ? 'Jak przygotować krem jogurtowo-mascarpone?'
          : 'Jak wygląda wykonanie krok po kroku?')
      : h2ToQuestion(h2, lang);
    if (!result) continue;
    const q = cleanQuestion(result);
    if (!isQuestionValid(q, h1)) continue;
    if (seenQuestions.has(q.toLowerCase())) continue;
    const answer = answerFromSection(content, h2);
    if (!answer) continue;
    const item = { question: q, answer };
    if (!isPublishableFaqItem(item) || !hasNaturalFaqFlow(item.answer, lang)) continue;
    addQuestion(item);
    if (questions.length >= 6) break;
  }

  if (content.analysisMode === 'url' && questions.length < minimumGeneratedFaqCount) {
    const urlFallback = generateUrlFaqFallback(content, h1);
    for (const item of urlFallback) {
      const key = item.question.toLowerCase();
      if (seenQuestions.has(key)) continue;
      addQuestion(item);
      if (questions.length >= 6) break;
    }
  }

  return questions.slice(0, minimumGeneratedFaqCount);
}

// ─── Internal link suggestions ────────────────────────────────────────────────

function generateVerifiedInternalLinks(content: StructuredContent): Array<{ anchorText: string; suggestedSlug: string }> {
  return content.links
    .filter(link => link.isInternal && link.anchorText.trim().length > 0 && link.href.trim().length > 0)
    .map(link => ({
      anchorText: cleanText(link.anchorText),
      suggestedSlug: link.href,
    }))
    .slice(0, 5);
}

function generateInternalLinks(content: StructuredContent): Array<{ anchorText: string; suggestedSlug: string }> {
  const h2s = content.headings.filter(h => h.level === 2).map(h => h.text);

  const suggestions: Array<{ anchorText: string; suggestedSlug: string }> = [];

  for (const h2 of h2s.slice(0, 2)) {
    if (h2.split(/\s+/).length > 7) continue;

    const slug = h2
      .toLowerCase()
      .replace(/[ąćęłńóśźż]/g, c => ({ ą:'a',ć:'c',ę:'e',ł:'l',ń:'n',ó:'o',ś:'s',ź:'z',ż:'z' }[c] ?? c))
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    suggestions.push({
      anchorText: h2,
      suggestedSlug: `/${slug}`,
    });
  }

  return suggestions;
}

// ─── Content gaps ─────────────────────────────────────────────────────────────

function detectContentGaps(content: StructuredContent, category: string): string[] {
  const lang = content.language;
  const text = content.plainText.toLowerCase();
  const gaps: string[] = [];

  const checks = lang === 'pl' ? [
    { keyword: ['przykład', 'na przykład', 'case study'], gap: 'Brak konkretnych przykładów lub case studies' },
    { keyword: ['dane', 'statystyk', 'badani', '%', 'procent'], gap: 'Brak danych statystycznych lub badań' },
    { keyword: ['wideo', 'video', 'film', 'youtube'], gap: 'Brak osadzonych materiałów wideo' },
    { keyword: ['tabela', 'porównan', 'zestawie'], gap: 'Brak tabeli porównawczej' },
    { keyword: ['źródł', 'literatura', 'przypisy'], gap: 'Brak cytowanych źródeł i literatury' },
    { keyword: ['ekspert', 'specjalist', 'autor', 'doktor'], gap: 'Brak informacji o autorze (E-E-A-T)' },
  ] : [
    { keyword: ['example', 'case study', 'for instance'], gap: 'No concrete examples or case studies' },
    { keyword: ['data', 'statistic', 'research', '%', 'percent'], gap: 'No statistical data or research cited' },
    { keyword: ['video', 'youtube', 'watch'], gap: 'No embedded video content' },
    { keyword: ['table', 'comparison', 'versus', 'vs'], gap: 'No comparison table' },
    { keyword: ['source', 'reference', 'study'], gap: 'No cited sources or references' },
    { keyword: ['expert', 'author', 'doctor', 'specialist'], gap: 'No author information (E-E-A-T)' },
  ];

  for (const check of checks) {
    const hasKeyword = check.keyword.some(k => text.includes(k));
    if (!hasKeyword) gaps.push(check.gap);
  }

  return gaps.slice(0, 4);
}

// ─── Text generators ──────────────────────────────────────────────────────────

function generateFaqText(faqs: Array<{ question: string; answer: string }>): string {
  return faqs.map(f => `${f.question}\n${f.answer}`).join('\n\n');
}

function generateHeadingsText(missing: Array<{ heading: string; why: string }>): string {
  if (missing.length === 0) return '';
  return missing.map(m => `${m.heading}\n${m.why}`).join('\n\n');
}

// ─── Main Generator ───────────────────────────────────────────────────────────

export function generateExpansionPack(content: StructuredContent): ContentExpansionPack {
  const category = detectArticleCategory(content);
  const missingSections = findMissingSections(content, category);
  const faqSuggestions = generateFaqFromContent(content);
  const internalLinkSuggestions = generateVerifiedInternalLinks(content);
  const contentGaps = detectContentGaps(content, category);

  const faqText = generateFaqText(faqSuggestions);
  const headingsText = generateHeadingsText(missingSections);

  return {
    missingSections,
    faqSuggestions,
    internalLinkSuggestions,
    contentGaps,
    faqText,
    headingsText,
  };
}
