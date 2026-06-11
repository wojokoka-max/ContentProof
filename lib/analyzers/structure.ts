/**
 * ContentProof — Structure Analyzer v1.1
 * H1 detection aware of plain-text implicit H1.
 * All findings include why + fixExample + fixCode.
 */

import type { StructuredContent, CategoryResult, Finding } from '../types';

const CATEGORY = 'structure' as const;
const LABEL = 'Struktura';

function checkH1Presence(content: StructuredContent, findings: Finding[]): number {
  const h1s = content.headings.filter(h => h.level === 1);

  // Article mode: implicit H1 from plain text counts as present
  if (content.analysisMode === 'text' && content.implicitH1) {
    return 100;
  }

  if (h1s.length === 0) {
    const topic = content.plainText.split(/\s+/).slice(0, 5).join(' ');
    findings.push({
      ruleId: 'structure.missing-h1',
      category: CATEGORY,
      severity: 'error',
      title: 'Brak nagłówka H1',
      description: 'Dokument nie zawiera nagłówka H1.',
      why: 'H1 to najważniejszy sygnał dla Google informujący o temacie strony. Brak H1 utrudnia indeksowanie i obniża pozycję w wynikach wyszukiwania.',
      recommendation: 'Dodaj dokładnie jeden nagłówek H1 na początku treści — powinien opisywać główny temat strony.',
      fixExample: `Dobry H1: opisowy, zawierający główne słowo kluczowe, max 60 znaków.`,
      fixCode: `<h1>${topic || 'Twój główny temat strony'}</h1>`,
    });
    return 0;
  }

  if (h1s.length > 1) {
    findings.push({
      ruleId: 'structure.multiple-h1',
      category: CATEGORY,
      severity: 'warning',
      title: 'Wiele nagłówków H1',
      description: `Znaleziono ${h1s.length} nagłówki H1. Strona powinna mieć dokładnie jeden.`,
      why: 'Wiele H1 rozmywa sygnał SEO i dezorientuje czytnika ekranu — każda strona ma jeden główny temat.',
      context: h1s.map(h => `"${h.text}"`).join(', '),
      recommendation: 'Zostaw jeden H1 jako główny tytuł. Pozostałe zamień na H2.',
      fixExample: 'Przed: 3× <h1>. Po: 1× <h1> + 2× <h2>.',
      fixCode: `<!-- Zostaw jeden -->\n<h1>${h1s[0].text}</h1>\n\n<!-- Pozostałe zmień na h2 -->\n<h2>${h1s[1]?.text ?? 'Sekcja'}</h2>`,
    });
    return 50;
  }

  return 100;
}

function checkHeadingHierarchy(content: StructuredContent, findings: Finding[]): number {
  // Plain text does not carry real H2/H3 levels. Validating inferred levels
  // would create false hierarchy errors for correctly structured drafts.
  if (content.analysisMode === 'text') return 100;
  if (content.headings.length < 2) return 100;

  const skips: string[] = [];
  for (let i = 1; i < content.headings.length; i++) {
    const prev = content.headings[i - 1];
    const curr = content.headings[i];
    if (curr.level > prev.level + 1) {
      skips.push(`H${prev.level} → H${curr.level} ("${curr.text}")`);
    }
  }

  if (skips.length > 0) {
    findings.push({
      ruleId: 'structure.heading-skip',
      category: CATEGORY,
      severity: 'warning',
      title: 'Pominięte poziomy nagłówków',
      description: `Hierarchia nagłówków ma ${skips.length} przeskok(i).`,
      why: 'Poprawna hierarchia H1→H2→H3 pomaga robotom Google i czytnikom ekranu zrozumieć strukturę dokumentu. Skoki poziomów sugerują błędy strukturalne.',
      context: skips.slice(0, 3).join(' | '),
      recommendation: 'Zachowaj ciągłość: H1 → H2 → H3. Nie pomijaj poziomów.',
      fixExample: 'Przed: H1 → H3. Po: H1 → H2 → H3.',
      fixCode: `<!-- Błąd: -->\n<h1>Temat</h1>\n<h3>Podsekcja</h3>\n\n<!-- Poprawnie: -->\n<h1>Temat</h1>\n<h2>Sekcja</h2>\n<h3>Podsekcja</h3>`,
    });
    return Math.max(0, 100 - skips.length * 25);
  }

  return 100;
}

function checkHeadingDensity(content: StructuredContent, findings: Finding[]): number {
  if (content.wordCount < 300) return 100;

  const headingCount = content.headings.length;
  // For plain text, if we have implicitH1, count it
  const effectiveHeadingCount = content.analysisMode === 'text' && content.implicitH1
    ? headingCount + 1
    : headingCount;

  const wordsPerHeading = content.wordCount / Math.max(effectiveHeadingCount, 1);

  if (effectiveHeadingCount === 0) {
    findings.push({
      ruleId: 'structure.no-headings',
      category: CATEGORY,
      severity: 'error',
      title: 'Brak nagłówków strukturyzujących',
      description: `Treść liczy ${content.wordCount} słów bez żadnych nagłówków.`,
      why: 'Długi tekst bez podziału jest trudny w skanowaniu. Google używa nagłówków do rozumienia tematyki sekcji i generowania featured snippets.',
      recommendation: 'Dodaj nagłówki H2/H3 co 200–400 słów.',
      fixCode: `<h2>Pierwsza sekcja</h2>\n<p>Treść...</p>\n\n<h2>Druga sekcja</h2>\n<p>Treść...</p>`,
    });
    return 0;
  }

  if (wordsPerHeading > 500) {
    findings.push({
      ruleId: 'structure.low-heading-density',
      category: CATEGORY,
      severity: 'warning',
      title: 'Zbyt mało nagłówków',
      description: `Średnio ${Math.round(wordsPerHeading)} słów na nagłówek (zalecane: maks. 400).`,
      why: 'Rzadkie nagłówki tworzą "ściany tekstu", które użytkownicy pomijają. Czytelne sekcje zmniejszają bounce rate.',
      recommendation: 'Dodaj nagłówki H2 lub H3 co 300–400 słów.',
    });
    return 60;
  }

  if (content.analysisMode !== 'text' && wordsPerHeading < 50 && headingCount > 5) {
    findings.push({
      ruleId: 'structure.high-heading-density',
      category: CATEGORY,
      severity: 'info',
      title: 'Bardzo wysoka gęstość nagłówków',
      description: `Średnio ${Math.round(wordsPerHeading)} słów na nagłówek. Treść może być zbyt rozdrobniona.`,
      why: 'Nadmiar nagłówków fragmentuje treść i może sygnalizować thin content.',
      recommendation: 'Rozważ scalenie krótkich sekcji.',
    });
    return 80;
  }

  return 100;
}

function checkEmptyHeadings(content: StructuredContent, findings: Finding[]): number {
  const empty = content.headings.filter(h => h.text.trim().length === 0);
  if (empty.length > 0) {
    findings.push({
      ruleId: 'structure.empty-heading',
      category: CATEGORY,
      severity: 'error',
      title: 'Puste nagłówki',
      description: `Znaleziono ${empty.length} pusty/e nagłówek/i bez tekstu.`,
      why: 'Puste nagłówki to błąd strukturalny — mylą boty i czytniki ekranu.',
      recommendation: 'Usuń puste nagłówki lub uzupełnij je treścią.',
      fixCode: `<!-- Usuń lub uzupełnij: -->\n<!-- Błąd: <h2></h2> -->\n<h2>Tytuł sekcji</h2>`,
    });
    return 0;
  }
  return 100;
}

export function analyzeStructure(content: StructuredContent): CategoryResult {
  const findings: Finding[] = [];

  const scores = {
    h1:        checkH1Presence(content, findings),
    hierarchy: checkHeadingHierarchy(content, findings),
    density:   checkHeadingDensity(content, findings),
    empty:     checkEmptyHeadings(content, findings),
  };

  const score = Math.round(
    scores.h1        * 0.40 +
    scores.hierarchy * 0.25 +
    scores.density   * 0.30 +
    scores.empty     * 0.05
  );

  const status = score >= 80 ? 'pass' : score >= 50 ? 'warning' : 'fail';

  return { category: CATEGORY, label: LABEL, score, status, findings, llmEnhanced: false };
}
