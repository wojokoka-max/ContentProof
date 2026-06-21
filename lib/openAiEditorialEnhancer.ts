import type { AnalysisResult, CategoryResult, FaqItem, SupportedLanguage } from './types';
import { applySeoTextOverrides } from './seoPackGenerator';
import { cleanText } from './utils/cleanText';

type FetchLike = (input: string, init?: RequestInit) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text?: () => Promise<string>;
}>;

interface EditorialPayload {
  metaTitle: string;
  metaDescription: string;
  faqItems: FaqItem[];
}

const FORBIDDEN_PHRASES = [
  'dopasuj szczegóły',
  'dopasuj szczegoly',
  'uzupełnij',
  'uzupelnij',
  'wymień',
  'wymien',
  'podaj',
  'warto dodać',
  'warto dodac',
  'na podstawie artykułu',
  'na podstawie artykulu',
  'dostosuj do treści',
  'dostosuj do tresci',
  'placeholder',
  'kompletny przewodnik',
  'dowiedz się wszystkiego',
  'dowiedz sie wszystkiego',
  'najlepsze porady',
  'sekret',
];

const STOP_WORDS = new Set([
  'oraz', 'jest', 'jako', 'jakie', 'jaki', 'ktore', 'które', 'ktory', 'który',
  'przez', 'takie', 'tego', 'tych', 'taki', 'taka', 'moze', 'może', 'mozna',
  'można', 'warto', 'najlepiej', 'poniewaz', 'ponieważ', 'dlatego', 'jednak',
  'takze', 'także', 'the', 'and', 'with', 'from', 'that', 'this',
]);

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

function meaningfulWords(text: string): Set<string> {
  return new Set(
    normalizeForMatch(text)
      .split(' ')
      .filter(word => word.length >= 4 && !STOP_WORDS.has(word))
  );
}

function overlapCount(text: string, sourceWords: Set<string>): number {
  return [...meaningfulWords(text)].filter(word => sourceWords.has(word)).length;
}

function hasForbiddenText(text: string): boolean {
  const normalized = normalizeForMatch(text);
  return FORBIDDEN_PHRASES.some(phrase => normalized.includes(normalizeForMatch(phrase))) ||
    /<[^>]+>/.test(text) ||
    /\[[^\]]*(uzupelnij|uzupełnij|placeholder|wstaw)[^\]]*\]/i.test(text);
}

function sentenceCount(text: string): number {
  return cleanText(text)
    .split(/(?<=[.!?…])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean).length;
}

function looksLikeProcedureCopy(text: string): boolean {
  const cleaned = normalizeForMatch(text);
  return /^(upiecz|rozgrzej|posiekaj|pokroj|wymieszaj|zblenduj|dodaj|wlej|smaz|schlodz|przeloz|podgrzej|utrzyj|rozbij|dopraw)\b/.test(cleaned) ||
    /\b(rozgrzej piekarnik|papierze do pieczenia|piecz okolo|piecz około|wlej do|przeloz do|przełóż do)\b/.test(cleaned);
}

function cleanFaqItems(items: FaqItem[]): FaqItem[] {
  const seen = new Set<string>();
  const cleaned: FaqItem[] = [];

  for (const item of items) {
    const question = cleanText(item.question).replace(/\s+/g, ' ').trim();
    const answer = cleanText(item.answer).replace(/\s+/g, ' ').trim();
    const key = normalizeForMatch(question);
    if (!question || !answer || seen.has(key)) continue;
    seen.add(key);
    cleaned.push({ question, answer });
  }

  return cleaned;
}

export function validateEditorialPayload(
  value: unknown,
  sourceText: string,
  language: SupportedLanguage
): EditorialPayload | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const metaTitle = typeof candidate.metaTitle === 'string'
    ? cleanText(candidate.metaTitle).replace(/\s+/g, ' ').trim()
    : '';
  const metaDescription = typeof candidate.metaDescription === 'string'
    ? cleanText(candidate.metaDescription).replace(/\s+/g, ' ').trim()
    : '';
  const faqSource = Array.isArray(candidate.faqItems) ? candidate.faqItems : [];
  const faqItems = cleanFaqItems(faqSource.map(item => {
    if (!item || typeof item !== 'object') return { question: '', answer: '' };
    const faq = item as Record<string, unknown>;
    return {
      question: typeof faq.question === 'string' ? faq.question : '',
      answer: typeof faq.answer === 'string' ? faq.answer : '',
    };
  }));

  const sourceWords = meaningfulWords(sourceText);
  const minTitleOverlap = language === 'pl' ? 1 : 1;

  if (
    metaTitle.length < 25 ||
    metaTitle.length > 65 ||
    /^https?:\/\//i.test(metaTitle) ||
    /[:;,]$/.test(metaTitle) ||
    hasForbiddenText(metaTitle) ||
    overlapCount(metaTitle, sourceWords) < minTitleOverlap
  ) {
    return null;
  }

  if (
    metaDescription.length < 80 ||
    metaDescription.length > 160 ||
    /[:;,]$/.test(metaDescription) ||
    /^https?:\/\//i.test(metaDescription) ||
    /^[-*•]/.test(metaDescription) ||
    hasForbiddenText(metaDescription) ||
    sentenceCount(metaDescription) > 2 ||
    overlapCount(metaDescription, sourceWords) < 2
  ) {
    return null;
  }

  if (faqItems.length !== 3) return null;

  for (const item of faqItems) {
    const answerSentences = sentenceCount(item.answer);
    if (
      !item.question.endsWith('?') ||
      item.question.length < 18 ||
      item.question.length > 110 ||
      item.answer.length < 80 ||
      item.answer.length > 420 ||
      answerSentences < 2 ||
      answerSentences > 3 ||
      /^[-*•]|\n\s*[-*•]/.test(item.answer) ||
      hasForbiddenText(`${item.question} ${item.answer}`) ||
      looksLikeProcedureCopy(item.answer) ||
      overlapCount(`${item.question} ${item.answer}`, sourceWords) < 2
    ) {
      return null;
    }
  }

  return { metaTitle, metaDescription, faqItems };
}

function extractResponseText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const response = value as Record<string, unknown>;
  if (typeof response.output_text === 'string') return response.output_text;

  const output = Array.isArray(response.output) ? response.output : [];
  const parts: string[] = [];
  for (const outputItem of output) {
    if (!outputItem || typeof outputItem !== 'object') continue;
    const content = (outputItem as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== 'object') continue;
      const text = (contentItem as Record<string, unknown>).text;
      if (typeof text === 'string') parts.push(text);
    }
  }
  return parts.join('\n').trim();
}

function parsePayloadFromResponse(value: unknown): unknown {
  const text = extractResponseText(value);
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function faqTextFromItems(items: FaqItem[]): string {
  return items
    .map(item => `${item.question}\n${item.answer}`)
    .join('\n\n');
}

function updateFaqFindings(categories: CategoryResult[], faqText: string): CategoryResult[] {
  const faqRules = new Set(['faq.no-faq', 'faq.answer-too-short', 'faq.too-few-items']);

  return categories.map(category => {
    if (category.category !== 'faq') return category;
    return {
      ...category,
      findings: category.findings.map(finding => {
        if (!faqRules.has(finding.ruleId)) return finding;
        return {
          ...finding,
          recommendation: 'FAQ jest krótkie. Rozbudowanie odpowiedzi może poprawić kontekst semantyczny i widoczność w wyszukiwarce.',
          fixExample: faqText,
        };
      }),
    };
  });
}

function applyEditorialPayload(result: AnalysisResult, payload: EditorialPayload): AnalysisResult {
  const faqText = faqTextFromItems(payload.faqItems);
  const expansionPack = {
    ...result.expansionPack,
    faqSuggestions: payload.faqItems,
    faqText,
  };
  const seoPack = applySeoTextOverrides(result.seoPack, {
    title: payload.metaTitle,
    metaDescription: payload.metaDescription,
    faqItems: payload.faqItems,
  });

  return {
    ...result,
    categories: updateFaqFindings(result.categories, faqText),
    seoPack,
    expansionPack,
    fixAll: {
      ...result.fixAll,
      title: seoPack.title,
      metaDescription: seoPack.metaDescription,
      faqText,
    },
  };
}

function sourceExcerpt(sourceText: string): string {
  return cleanText(sourceText)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000);
}

function buildPromptInput(result: AnalysisResult, sourceText: string) {
  return {
    language: result.meta.language,
    analysisMode: result.meta.analysisMode,
    detectedTitle: result.meta.detectedH1 ?? result.meta.detectedTitle ?? result.seoPack.title,
    currentMetaTitle: result.seoPack.title,
    currentMetaDescription: result.seoPack.metaDescription,
    currentFaqItems: result.expansionPack.faqSuggestions,
    articleText: sourceExcerpt(sourceText),
  };
}

export async function enhanceMetaAndFaqWithOpenAI(
  result: AnalysisResult,
  sourceText: string,
  fetcher: FetchLike = fetch
): Promise<AnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || sourceText.trim().length < 300) return result;

  const model = process.env.OPENAI_META_FAQ_MODEL || 'gpt-5.5-mini';
  const systemPrompt = [
    'Jesteś redaktorem SEO ContentProof.',
    'Poprawiasz wyłącznie meta title, meta description i FAQ.',
    'Nie zmieniasz canonical, schema typu, scoringu ani zaleceń technicznych.',
    'FAQ musi mieć dokładnie 3 pytania i 3 odpowiedzi, każda odpowiedź 2-3 zdania.',
    'Wynik ma być gotowym tekstem do publikacji, bez placeholderów i instrukcji dla autora.',
    'Nie kopiuj fragmentów przepisu ani instrukcji krok po kroku jako odpowiedzi FAQ.',
    'Meta description ma wynikać z całej treści, odpowiadać na intencję użytkownika i mieć jedną główną myśl.',
  ].join(' ');

  try {
    const response = await fetcher('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: systemPrompt }],
          },
          {
            role: 'user',
            content: [{
              type: 'input_text',
              text: JSON.stringify(buildPromptInput(result, sourceText)),
            }],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'contentproof_meta_faq',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['metaTitle', 'metaDescription', 'faqItems'],
              properties: {
                metaTitle: { type: 'string' },
                metaDescription: { type: 'string' },
                faqItems: {
                  type: 'array',
                  minItems: 3,
                  maxItems: 3,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['question', 'answer'],
                    properties: {
                      question: { type: 'string' },
                      answer: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    });

    if (!response.ok) return result;
    const json = await response.json();
    const payload = validateEditorialPayload(parsePayloadFromResponse(json), sourceText, result.meta.language);
    return payload ? applyEditorialPayload(result, payload) : result;
  } catch {
    return result;
  }
}
