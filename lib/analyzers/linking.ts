/**
 * ContentProof — Linking Analyzer v1.1
 */
import type { StructuredContent, CategoryResult, Finding } from '../types';

const CATEGORY = 'linking' as const;
const LABEL = 'Linkowanie';

const GENERIC_ANCHORS = new Set([
  'kliknij tutaj','click here','tutaj','here','więcej','more',
  'czytaj więcej','read more','sprawdź','check','link','url',
  'strona','page','kliknij','click','pobierz','download',
  'przejdź','go','visit','odwiedź',
]);

function isGenericAnchor(text: string): boolean {
  return GENERIC_ANCHORS.has(text.toLowerCase().trim());
}

function checkInternalLinks(content: StructuredContent, findings: Finding[]): number {
  if (content.inputType !== 'html') return 100;
  const internal = content.links.filter(l => l.isInternal);

  if (content.wordCount >= 300 && internal.length === 0) {
    findings.push({
      ruleId: 'linking.no-internal-links',
      category: CATEGORY,
      severity: 'warning',
      title: 'Brak linków wewnętrznych',
      description: 'Treść nie zawiera żadnych linków wewnętrznych.',
      why: 'Linki wewnętrzne przekazują PageRank, pomagają Googlebot odkrywać strony i zwiększają czas sesji użytkownika. Artykuł bez linków wewnętrznych jest "wyspą" w strukturze serwisu.',
      recommendation: 'Dodaj 2–5 linków do powiązanych stron w serwisie.',
      fixExample: 'Link do powiązanego artykułu, kategorii lub strony produktu.',
      fixCode: `<p>Więcej o tym temacie: <a href="/powiazany-artykul">Tytuł powiązanego artykułu</a>.</p>`,
    });
    return 30;
  }

  if (content.wordCount >= 1000 && internal.length < 2) {
    findings.push({
      ruleId: 'linking.few-internal-links',
      category: CATEGORY,
      severity: 'info',
      title: 'Mało linków wewnętrznych',
      description: `Długa treść (${content.wordCount} słów) zawiera tylko ${internal.length} link(i) wewnętrzny/e.`,
      why: 'Długi artykuł powinien linkować do powiązanych treści — zwiększa to czas na stronie i pomaga Google zrozumieć strukturę serwisu.',
      recommendation: 'Dodaj 1 link wewnętrzny na każde 300 słów treści.',
    });
    return 70;
  }

  return 100;
}

function checkExternalLinks(content: StructuredContent, findings: Finding[]): number {
  if (content.inputType !== 'html') return 100;
  const external = content.links.filter(l => !l.isInternal);

  if (content.wordCount >= 500 && external.length === 0) {
    findings.push({
      ruleId: 'linking.no-external-links',
      category: CATEGORY,
      severity: 'info',
      title: 'Brak linków zewnętrznych',
      description: 'Treść nie zawiera linków do zewnętrznych źródeł.',
      why: 'Linki do wiarygodnych źródeł (badania, raporty, Wikipedia) sygnalizują Google, że treść jest dobrze ugruntowana merytorycznie. E-E-A-T wymaga oparcia twierdzeń o źródła.',
      recommendation: 'Dodaj 1–3 linki do wiarygodnych źródeł zewnętrznych.',
      fixCode: `<a href="https://wiarygodne-zrodlo.pl/raport" rel="noopener">Nazwa źródła</a>`,
    });
    return 80;
  }

  return 100;
}

function checkAnchorText(content: StructuredContent, findings: Finding[]): number {
  if (content.links.length === 0) return 100;

  const emptyAnchors = content.links.filter(l => l.anchorText.trim().length === 0);
  const genericAnchors = content.links.filter(l =>
    !l.anchorText.trim().length === false && isGenericAnchor(l.anchorText)
  );

  let score = 100;

  if (emptyAnchors.length > 0) {
    findings.push({
      ruleId: 'linking.empty-anchor',
      category: CATEGORY,
      severity: 'error',
      title: 'Puste teksty kotwicy',
      description: `${emptyAnchors.length} link(i) nie ma tekstu kotwicy.`,
      why: 'Puste anchory są niedostępne (screen readery czytają "link" bez kontekstu) i nie przekazują sygnału słowa kluczowego do Google.',
      context: emptyAnchors.map(l => l.href).slice(0, 3).join(', '),
      recommendation: 'Każdy link musi mieć opisowy tekst kotwicy.',
      fixCode: `<!-- Błąd: -->\n<a href="/artykul"></a>\n\n<!-- Poprawnie: -->\n<a href="/artykul">Jak wybrać hosting WordPress</a>`,
    });
    score -= 30 * emptyAnchors.length;
  }

  if (genericAnchors.length > 0) {
    findings.push({
      ruleId: 'linking.generic-anchor',
      category: CATEGORY,
      severity: 'warning',
      title: 'Generyczne teksty kotwicy',
      description: `${genericAnchors.length} link(i) używa generycznego tekstu ("kliknij tutaj", "więcej" itp.).`,
      why: 'Google używa tekstu kotwicy jako sygnału słowa kluczowego dla linkowanej strony. "Kliknij tutaj" nie przekazuje żadnej informacji semantycznej.',
      context: genericAnchors.map(l => `"${l.anchorText}"`).slice(0, 3).join(', '),
      recommendation: 'Zamień generyczne anchory na opisowe frazy kluczowe.',
      fixCode: `<!-- Błąd: -->\n<a href="/hosting">Kliknij tutaj</a>\n\n<!-- Poprawnie: -->\n<a href="/hosting">Porównanie hostingów WordPress</a>`,
    });
    score -= 15 * genericAnchors.length;
  }

  return Math.max(0, score);
}

function checkNofollowRatio(content: StructuredContent, findings: Finding[]): number {
  const external = content.links.filter(l => !l.isInternal);
  if (external.length < 2) return 100;

  const nofollowCount = external.filter(l => l.isNofollow).length;
  if (nofollowCount / external.length === 1) {
    findings.push({
      ruleId: 'linking.all-nofollow',
      category: CATEGORY,
      severity: 'info',
      title: 'Wszystkie linki zewnętrzne mają nofollow',
      description: 'Każdy link zewnętrzny ma rel="nofollow".',
      why: 'Linki do renomowanych źródeł warto zostawić dofollow — Google traktuje je jako sygnał wiarygodności treści (E-E-A-T).',
      recommendation: 'Usuń nofollow z linków do wiarygodnych źródeł.',
      fixCode: `<!-- Do wiarygodnych źródeł bez nofollow: -->\n<a href="https://wikipedia.org/...">Źródło: Wikipedia</a>\n\n<!-- Do stron komercyjnych zostaw nofollow: -->\n<a href="https://partner.pl" rel="nofollow noopener">Partner</a>`,
    });
    return 80;
  }

  return 100;
}

function checkLinkDensity(content: StructuredContent, findings: Finding[]): number {
  if (content.links.length === 0 || content.wordCount === 0) return 100;
  const linksPerHundred = (content.links.length / content.wordCount) * 100;

  if (linksPerHundred > 5) {
    findings.push({
      ruleId: 'linking.high-density',
      category: CATEGORY,
      severity: 'warning',
      title: 'Zbyt wysoka gęstość linków',
      description: `${content.links.length} linków na ${content.wordCount} słów (${linksPerHundred.toFixed(1)} na 100 słów).`,
      why: 'Bardzo wysoka gęstość linków może być traktowana przez Google jako spam. Użytkownik też gubi się w tekście z nadmierną liczbą linków.',
      recommendation: 'Ogranicz do 1–3 linków na 100 słów. Zostaw tylko najważniejsze.',
    });
    return 60;
  }

  return 100;
}

export function analyzeLinking(content: StructuredContent): CategoryResult {
  const findings: Finding[] = [];

  if (content.analysisMode === 'text') {
    return {
      category: CATEGORY, label: LABEL, score: 100, status: 'pass',
      findings: [{ ruleId: 'linking.article-mode', category: CATEGORY, severity: 'info',
        title: 'Linkowanie — analiza po publikacji',
        description: 'Linki wewnętrzne i zewnętrzne są dodawane w CMS przy publikacji. ContentProof wygeneruje propozycje linków w sekcji Content Expansion.',
        why: 'Struktura linków jest elementem strony, nie surowego artykułu.',
      }],
      llmEnhanced: false,
    };
  }

  const scores = {
    internal: checkInternalLinks(content, findings),
    external: checkExternalLinks(content, findings),
    anchor:   checkAnchorText(content, findings),
    nofollow: checkNofollowRatio(content, findings),
    density:  checkLinkDensity(content, findings),
  };

  const score = Math.round(
    scores.internal * 0.30 + scores.external * 0.20 +
    scores.anchor   * 0.30 + scores.nofollow * 0.10 + scores.density * 0.10
  );

  const status = score >= 80 ? 'pass' : score >= 50 ? 'warning' : 'fail';
  return { category: CATEGORY, label: LABEL, score, status, findings, llmEnhanced: false };
}
