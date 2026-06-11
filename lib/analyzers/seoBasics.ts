import type { StructuredContent, CategoryResult, Finding } from '../types';

const CATEGORY = 'seo-basics' as const;
const LABEL = 'SEO Basics';

const TITLE = { MIN: 30, MAX: 60, IDEAL_MIN: 40, IDEAL_MAX: 55 };
const META_DESC = { MIN: 70, MAX: 160, IDEAL_MIN: 120, IDEAL_MAX: 155 };

function isHtmlFragment(content: StructuredContent): boolean {
  return content.analysisMode === 'html' && content.htmlScope === 'fragment';
}

function checkTitle(content: StructuredContent, findings: Finding[]): number {
  if (!content.metaTitle) {
    if (isHtmlFragment(content)) {
      findings.push({
        ruleId: 'seo.title-not-detected-in-html.not-applicable',
        category: CATEGORY,
        severity: 'info',
        title: 'Meta title nie został wykryty w przesłanym HTML',
        description: 'Kod może być fragmentem treści bez sekcji <head>, dlatego brak wykrycia nie obniża wyniku.',
        why: 'Meta title zwykle znajduje się w sekcji <head>, której często nie ma we wklejonym fragmencie artykułu.',
        recommendation: 'Skorzystaj z gotowej propozycji meta title w sekcji SEO Pack.',
      });
      return 100;
    }

    if (content.analysisMode === 'text') {
      findings.push({
        ruleId: 'seo.meta-title-not-provided',
        category: CATEGORY,
        severity: 'warning',
        title: 'Nie podano meta title do sprawdzenia',
        description: 'Wybrano sprawdzanie własnych meta danych, ale pole meta title pozostało puste.',
        why: 'ContentProof może ocenić tylko meta title, który został podany.',
        recommendation: 'Uzupełnij własny meta title albo użyj gotowej propozycji z sekcji SEO Pack.',
      });
      return 60;
    }

    findings.push({
      ruleId: 'seo.missing-title',
      category: CATEGORY,
      severity: 'error',
      title: 'Meta title wymaga uzupełnienia',
      description: 'Na opublikowanej stronie nie wykryto meta title.',
      why: 'Meta title jest głównym nagłówkiem wyniku wyszukiwania i pomaga określić temat strony.',
      recommendation: 'Skopiuj gotową propozycję meta title z sekcji SEO Pack.',
    });
    return 0;
  }

  const length = content.metaTitle.length;

  if (length < TITLE.MIN) {
    findings.push({
      ruleId: 'seo.title-too-short',
      category: CATEGORY,
      severity: 'warning',
      title: 'Meta title jest zbyt krótki',
      description: `Meta title ma ${length} znaków. Zalecane minimum to ${TITLE.MIN}.`,
      why: 'Krótki tytuł słabiej opisuje stronę i nie wykorzystuje dostępnego miejsca w wynikach wyszukiwania.',
      context: content.metaTitle,
      recommendation: `Rozbuduj tytuł do ${TITLE.IDEAL_MIN}-${TITLE.IDEAL_MAX} znaków albo użyj propozycji z SEO Pack.`,
    });
    return 55;
  }

  if (length > TITLE.MAX) {
    findings.push({
      ruleId: 'seo.title-too-long',
      category: CATEGORY,
      severity: 'warning',
      title: 'Meta title jest zbyt długi',
      description: `Meta title ma ${length} znaków. Zalecane maksimum to ${TITLE.MAX}.`,
      why: 'Zbyt długi tytuł może zostać skrócony w wynikach wyszukiwania.',
      context: content.metaTitle,
      recommendation: `Skróć tytuł do maksymalnie ${TITLE.IDEAL_MAX} znaków albo użyj propozycji z SEO Pack.`,
    });
    return 65;
  }

  return 100;
}

function checkMetaDescription(content: StructuredContent, findings: Finding[]): number {
  if (!content.metaDescription) {
    if (isHtmlFragment(content)) {
      findings.push({
        ruleId: 'seo.description-not-detected-in-html.not-applicable',
        category: CATEGORY,
        severity: 'info',
        title: 'Meta description nie został wykryty w przesłanym HTML',
        description: 'Kod może być fragmentem artykułu bez sekcji <head>, dlatego brak wykrycia nie obniża wyniku.',
        why: 'Meta description znajduje się poza właściwą treścią artykułu i może nie być częścią wklejonego fragmentu HTML.',
        recommendation: 'Skorzystaj z gotowej propozycji meta description w sekcji SEO Pack.',
      });
      return 100;
    }

    if (content.analysisMode === 'text') {
      findings.push({
        ruleId: 'seo.meta-description-not-provided',
        category: CATEGORY,
        severity: 'warning',
        title: 'Nie podano meta description do sprawdzenia',
        description: 'Wybrano sprawdzanie własnych meta danych, ale pole meta description pozostało puste.',
        why: 'ContentProof może ocenić tylko opis, który został podany.',
        recommendation: 'Uzupełnij własny opis albo użyj gotowej propozycji z sekcji SEO Pack.',
      });
      return 60;
    }

    findings.push({
      ruleId: 'seo.missing-meta-description',
      category: CATEGORY,
      severity: 'warning',
      title: 'Meta description wymaga uzupełnienia',
      description: 'Na opublikowanej stronie nie wykryto meta description.',
      why: 'Dobry opis wyniku wyszukiwania pomaga użytkownikowi zdecydować, czy artykuł odpowiada na jego pytanie.',
      recommendation: 'Skopiuj gotową propozycję meta description z sekcji SEO Pack.',
    });
    return 40;
  }

  const length = content.metaDescription.length;

  if (length < META_DESC.MIN) {
    findings.push({
      ruleId: 'seo.meta-description-too-short',
      category: CATEGORY,
      severity: 'warning',
      title: 'Meta description jest zbyt krótki',
      description: `Meta description ma ${length} znaków. Zalecane minimum to ${META_DESC.MIN}.`,
      why: 'Zbyt krótki opis nie przekazuje wystarczająco jasno wartości artykułu.',
      context: content.metaDescription,
      recommendation: `Rozbuduj opis do ${META_DESC.IDEAL_MIN}-${META_DESC.IDEAL_MAX} znaków albo użyj propozycji z SEO Pack.`,
    });
    return 60;
  }

  if (length > META_DESC.MAX) {
    findings.push({
      ruleId: 'seo.meta-description-too-long',
      category: CATEGORY,
      severity: 'info',
      title: 'Meta description jest zbyt długi',
      description: `Meta description ma ${length} znaków. Zalecane maksimum to ${META_DESC.MAX}.`,
      why: 'Końcówka zbyt długiego opisu może nie być widoczna w wynikach wyszukiwania.',
      context: content.metaDescription,
      recommendation: `Skróć opis do maksymalnie ${META_DESC.IDEAL_MAX} znaków albo użyj propozycji z SEO Pack.`,
    });
    return 80;
  }

  return 100;
}

function checkCanonical(content: StructuredContent, findings: Finding[]): number {
  const hasCompleteDocument = content.analysisMode === 'url' ||
    (content.analysisMode === 'html' && content.htmlScope === 'document');
  if (!hasCompleteDocument) return 100;
  if (content.canonical) return 100;

  findings.push({
    ruleId: 'seo.missing-canonical',
    category: CATEGORY,
    severity: 'info',
    title: 'Adres canonical wymaga uzupełnienia',
    description: 'Na opublikowanej stronie nie wykryto adresu canonical.',
    why: 'Canonical wskazuje wyszukiwarce główną wersję strony i ogranicza problemy z duplikacją.',
    recommendation: 'Dodaj canonical wskazujący aktualny adres artykułu.',
  });
  return 75;
}

function checkH1TitleAlignment(content: StructuredContent, findings: Finding[]): number {
  const h1Text = content.headings.find(heading => heading.level === 1)?.text ?? content.implicitH1 ?? null;
  if (!h1Text || !content.metaTitle) return 100;

  const titleWords = new Set(content.metaTitle.toLowerCase().split(/\s+/).filter(word => word.length > 3));
  const h1Words = new Set(h1Text.toLowerCase().split(/\s+/).filter(word => word.length > 3));
  const overlap = [...titleWords].filter(word => h1Words.has(word)).length;
  const overlapRatio = titleWords.size > 0 ? overlap / titleWords.size : 1;

  if (overlapRatio < 0.3 && titleWords.size > 2) {
    findings.push({
      ruleId: 'seo.h1-title-mismatch',
      category: CATEGORY,
      severity: 'info',
      title: 'H1 i meta title opisują różne tematy',
      description: 'Nagłówek artykułu i meta title mają niewiele wspólnych słów.',
      why: 'Oba elementy powinny jasno wskazywać ten sam główny temat strony.',
      context: `Meta title: "${content.metaTitle}" | H1: "${h1Text}"`,
      recommendation: 'Zachowaj w obu elementach te same najważniejsze słowa opisujące artykuł.',
    });
    return 75;
  }

  return 100;
}

function checkContentLength(content: StructuredContent, findings: Finding[]): number {
  if (content.wordCount < 100) {
    findings.push({
      ruleId: 'seo.content-too-short',
      category: CATEGORY,
      severity: 'error',
      title: 'Treść jest zbyt krótka',
      description: `Treść liczy tylko ${content.wordCount} słów.`,
      why: 'Bardzo krótki materiał zwykle nie wyczerpuje tematu i może nie odpowiadać na potrzeby czytelnika.',
      recommendation: 'Rozbuduj najważniejsze sekcje, przykłady i odpowiedzi na pytania odbiorców.',
    });
    return 20;
  }

  if (content.wordCount < 300) {
    findings.push({
      ruleId: 'seo.content-short',
      category: CATEGORY,
      severity: 'warning',
      title: 'Treść jest krótka',
      description: `Treść liczy ${content.wordCount} słów.`,
      why: 'Krótki artykuł może nie obejmować wszystkich informacji potrzebnych użytkownikowi.',
      recommendation: 'Sprawdź, czy tekst zawiera konkretne przykłady, odpowiedzi na pytania i pełne wyjaśnienie tematu.',
    });
    return 60;
  }

  return 100;
}

function resultFromScores(findings: Finding[], scores: number[], weights: number[]): CategoryResult {
  const score = Math.round(scores.reduce((sum, value, index) => sum + value * weights[index], 0));
  const status = score >= 80 ? 'pass' : score >= 50 ? 'warning' : 'fail';
  return { category: CATEGORY, label: LABEL, score, status, findings, llmEnhanced: false };
}

export function analyzeSeoBasics(content: StructuredContent): CategoryResult {
  const findings: Finding[] = [];

  if (content.analysisMode === 'text' && content.metaInputMode !== 'provided') {
    findings.push({
      ruleId: 'seo.meta-will-be-generated.not-applicable',
      category: CATEGORY,
      severity: 'info',
      title: 'Meta dane zostaną przygotowane na podstawie tekstu',
      description: 'Szkic nie musi zawierać meta title ani meta description.',
      why: 'Meta dane należą do ustawień publikacji, a nie do samej treści artykułu. Gotowe propozycje znajdziesz w sekcji SEO Pack.',
    });

    return resultFromScores(
      findings,
      [checkContentLength(content, findings)],
      [1]
    );
  }

  if (content.analysisMode === 'text') {
    return resultFromScores(
      findings,
      [
        checkTitle(content, findings),
        checkMetaDescription(content, findings),
        checkH1TitleAlignment(content, findings),
        checkContentLength(content, findings),
      ],
      [0.25, 0.25, 0.2, 0.3]
    );
  }

  return resultFromScores(
    findings,
    [
      checkTitle(content, findings),
      checkMetaDescription(content, findings),
      checkCanonical(content, findings),
      checkH1TitleAlignment(content, findings),
      checkContentLength(content, findings),
    ],
    [0.3, 0.25, 0.15, 0.15, 0.15]
  );
}
