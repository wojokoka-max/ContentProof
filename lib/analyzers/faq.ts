/**
 * ContentProof — FAQ Analyzer v1.1
 */
import type { StructuredContent, CategoryResult, Finding } from '../types';

const CATEGORY = 'faq' as const;
const LABEL = 'FAQ';

const PL_Q = ['jak','co','czy','kiedy','gdzie','dlaczego','ile','kto','które','czym','po co'];
const EN_Q = ['what','how','why','when','where','who','which','can','does','is','are','do'];

function looksLikeQuestion(text: string): boolean {
  if (text.trim().endsWith('?')) return true;
  const lower = text.toLowerCase();
  return [...PL_Q, ...EN_Q].some(w => lower.startsWith(w + ' '));
}

function hasSchemaMarkup(raw: string): boolean {
  return raw.includes('"@type":"FAQPage"') || raw.includes('"@type": "FAQPage"') || raw.includes('FAQPage');
}

function checkFaqPresence(content: StructuredContent, findings: Finding[]): number {
  if (content.faqItems.length > 0) return 100;

  const shortHtmlFragment = content.analysisMode === 'html' &&
    content.htmlScope === 'fragment' &&
    content.wordCount < 400;
  if (shortHtmlFragment) return 100;

  findings.push({
    ruleId: 'faq.no-faq',
    category: CATEGORY,
    severity: 'warning',
    title: 'Brak sekcji FAQ',
    description: content.analysisMode === 'url'
      ? 'Na opublikowanej stronie nie wykryto sekcji FAQ.'
      : 'W przesłanym tekście nie wykryto sekcji FAQ.',
    why: 'FAQ zwiększa szanse na pojawienie się w "People Also Ask" w Google i rich snippets. Strony z FAQ mają wyższy CTR o 20–30% dzięki rozszerzonemu snippetowi.',
    recommendation: 'Dodaj 3–8 konkretnych pytań, które czytelnik naprawdę może zadać po lekturze artykułu. Pod każdym pytaniem napisz krótką odpowiedź w 2–3 zdaniach.',
    fixExample: 'Przykład tekstu: „Ile czasu zajmuje wdrożenie tej zmiany? Najczęściej pierwsze efekty widać po kilku dniach, ale pełny rezultat zależy od skali działań i regularności. Warto zacząć od jednego kroku i sprawdzić, co wymaga poprawy.”',
  });

  return 70;
}

function checkQuestionQuality(content: StructuredContent, findings: Finding[]): number {
  if (content.faqItems.length === 0) return 100;
  const nonQ = content.faqItems.filter(item => !looksLikeQuestion(item.question));

  if (nonQ.length > 0) {
    findings.push({
      ruleId: 'faq.non-question-items',
      category: CATEGORY,
      severity: 'warning',
      title: 'Elementy FAQ nie wyglądają jak pytania',
      description: `${nonQ.length} z ${content.faqItems.length} elementów FAQ nie ma formy pytania.`,
      why: 'Google schema FAQPage wymaga, żeby każdy element był pytaniem. Pytania bez znaku "?" mogą nie zostać wyświetlone jako rich snippet.',
      context: nonQ.map(q => `"${q.question}"`).slice(0, 2).join(', '),
      recommendation: 'Sformułuj każdy element FAQ jako normalne pytanie czytelnika zakończone znakiem zapytania.',
      fixExample: 'Zamiast „Cena produktu” napisz „Ile kosztuje produkt?”. Zamiast „Dostawa” napisz „Jak długo trwa dostawa?”.',
    });
    return 70;
  }
  return 100;
}

function checkAnswerLength(content: StructuredContent, findings: Finding[]): number {
  if (content.faqItems.length === 0) return 100;

  const tooShort = content.faqItems.filter(i => i.answer.split(/\s+/).filter(Boolean).length < 20);
  const tooLong  = content.faqItems.filter(i => i.answer.split(/\s+/).filter(Boolean).length > 300);
  let score = 100;

  if (tooShort.length > 0) {
    findings.push({
      ruleId: 'faq.answer-too-short',
      category: CATEGORY,
      severity: 'warning',
      title: 'FAQ jest krótkie',
      description: `${tooShort.length} odpowiedź/odpowiedzi ma mniej niż 20 słów.`,
      why: 'Krótkie odpowiedzi mogą nie wyjaśniać tematu wystarczająco jasno ani nie dostarczać wyszukiwarce pełnego kontekstu.',
      context: tooShort.map(q => `"${q.question}"`).slice(0, 2).join(', '),
      recommendation: 'Rozbudowanie odpowiedzi może poprawić kontekst semantyczny i widoczność w wyszukiwarce.',
    });
    score -= 20 * tooShort.length;
  }

  if (tooLong.length > 0) {
    findings.push({
      ruleId: 'faq.answer-too-long',
      category: CATEGORY,
      severity: 'info',
      title: 'Zbyt długie odpowiedzi FAQ',
      description: `${tooLong.length} odpowiedź/odpowiedzi przekracza 300 słów.`,
      why: 'Google preferuje zwięzłe odpowiedzi w FAQ schema (do 300 słów). Dłuższe treści powinny być w głównym artykule.',
      context: tooLong.map(q => `"${q.question}"`).slice(0, 2).join(', '),
      recommendation: 'Skróć odpowiedzi do max 300 słów.',
    });
    score -= 10;
  }

  return Math.max(0, score);
}

function checkFaqCount(content: StructuredContent, findings: Finding[]): number {
  if (content.faqItems.length === 0) return 100;
  const count = content.faqItems.length;

  if (count < 3) {
    findings.push({
      ruleId: 'faq.too-few-items',
      category: CATEGORY,
      severity: 'info',
      title: 'Mało elementów FAQ',
      description: `Sekcja FAQ zawiera tylko ${count} pytanie/pytania.`,
      why: 'Google wyświetla najczęściej 3–8 pytań jako rich snippet. Mniej niż 3 to za mało, by wypełnić rozwinięty wynik wyszukiwania.',
      recommendation: 'Dodaj więcej pytań (minimum 3, optymalnie 5–8).',
    });
    return 75;
  }

  if (count > 15) {
    findings.push({
      ruleId: 'faq.too-many-items',
      category: CATEGORY,
      severity: 'info',
      title: 'Bardzo dużo elementów FAQ',
      description: `Sekcja FAQ zawiera ${count} pytań.`,
      why: 'Google i tak wyświetli tylko kilka z nich. Nadmiar może rozmyć relevantność i wydłużyć stronę.',
      recommendation: 'Ogranicz FAQ do 8–12 najważniejszych pytań.',
    });
    return 85;
  }

  return 100;
}

function checkSchemaMarkup(content: StructuredContent, findings: Finding[]): number {
  const schemaOutsideProvidedScope = content.analysisMode === 'text' ||
    (content.analysisMode === 'html' && content.htmlScope === 'fragment');
  if (content.faqItems.length === 0 || schemaOutsideProvidedScope) return 100;

  if (!hasSchemaMarkup(content.raw)) {
    findings.push({
      ruleId: 'faq.missing-schema',
      category: CATEGORY,
      severity: 'warning',
      title: 'FAQ nie jest oznaczone dla wyszukiwarki',
      description: 'Sekcja FAQ istnieje w treści, ale nie ma technicznego oznaczenia FAQPage.',
      why: 'Dobre pytania i odpowiedzi są najważniejsze dla czytelnika. Oznaczenie techniczne może dodatkowo pomóc wyszukiwarce zrozumieć, że ta część strony jest FAQ.',
      recommendation: 'Najpierw dopracuj pytania i odpowiedzi jako normalny tekst dla czytelnika. Dopiero później osoba techniczna może oznaczyć tę sekcję jako FAQPage w CMS lub szablonie strony.',
      fixExample: 'Dobra odpowiedź FAQ powinna być samodzielna: czytelnik ma zrozumieć ją bez szukania dodatkowego kontekstu w całym artykule.',
    });
    return 60;
  }

  return 100;
}

export function analyzeFaq(content: StructuredContent): CategoryResult {
  const findings: Finding[] = [];

  // In article mode, use text-detected FAQ items (merged into faqItems by parser)
  // faqItems already includes textFaqItems from parser

  const scores = {
    presence: checkFaqPresence(content, findings),
    quality:  checkQuestionQuality(content, findings),
    length:   checkAnswerLength(content, findings),
    count:    checkFaqCount(content, findings),
    schema:   checkSchemaMarkup(content, findings),
  };

  const hasFaq = content.faqItems.length > 0;
  const score = hasFaq
    ? Math.round(scores.presence * 0.15 + scores.quality * 0.25 + scores.length * 0.25 + scores.count * 0.15 + scores.schema * 0.20)
    : scores.presence;

  const status = score >= 80 ? 'pass' : score >= 50 ? 'warning' : 'fail';
  return { category: CATEGORY, label: LABEL, score, status, findings, llmEnhanced: false };
}
