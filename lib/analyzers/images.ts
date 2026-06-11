/**
 * ContentProof — Images Analyzer v1.1
 */
import type { StructuredContent, CategoryResult, Finding } from '../types';

const CATEGORY = 'images' as const;
const LABEL = 'Obrazy';

function checkAltText(content: StructuredContent, findings: Finding[]): number {
  if (content.images.length === 0) return 100;

  const missingAlt = content.images.filter(img => !img.hasAlt);
  const emptyAlt = content.images.filter(img => img.hasAlt && img.alt === '');
  let score = 100;

  if (missingAlt.length > 0) {
    const pct = Math.round((missingAlt.length / content.images.length) * 100);
    findings.push({
      ruleId: 'images.missing-alt',
      category: CATEGORY,
      severity: 'error',
      title: 'Brakujący atrybut alt',
      description: `${missingAlt.length} z ${content.images.length} obrazów (${pct}%) nie ma atrybutu alt.`,
      why: 'Alt text to jedyny sposób dla Google na "zobaczenie" obrazu. Brak alt = obraz niewidoczny dla wyszukiwarki i niedostępny dla niewidomych użytkowników (WCAG 2.1).',
      context: missingAlt.map(i => i.filename).slice(0, 3).join(', '),
      recommendation: 'Dodaj opisowy alt do każdego obrazu treściowego. Obrazy dekoracyjne: alt="".',
      fixExample: 'Alt powinien opisywać co widać na obrazie, nie być nazwą pliku.',
      fixCode: `<!-- Błąd: -->\n<img src="pies.jpg">\n\n<!-- Poprawnie (obraz treściowy): -->\n<img src="labrador-czarny.jpg" alt="Czarny labrador bawiący się w ogrodzie">\n\n<!-- Poprawnie (dekoracyjny): -->\n<img src="divider.png" alt="">`,
    });
    score -= Math.min(70, pct * 0.8);
  }

  if (emptyAlt.length > 0 && emptyAlt.length === content.images.length) {
    findings.push({
      ruleId: 'images.all-empty-alt',
      category: CATEGORY,
      severity: 'warning',
      title: 'Wszystkie obrazy mają pusty alt',
      description: 'Każdy obraz ma alt="". Jeśli obrazy są treściowe, powinny mieć opisowy alt.',
      why: 'Obrazy treściowe z pustym alt są niewidoczne dla Google Images i użytkowników screen readerów.',
      recommendation: 'Dodaj opisowy alt do obrazów treściowych (nie dekoracyjnych).',
    });
    score = Math.min(score, 65);
  }

  return Math.max(0, score);
}

function checkFilenames(content: StructuredContent, findings: Finding[]): number {
  if (content.images.length === 0) return 100;
  const genericImages = content.images.filter(img => img.hasGenericFilename);
  if (genericImages.length === 0) return 100;

  const pct = Math.round((genericImages.length / content.images.length) * 100);
  findings.push({
    ruleId: 'images.generic-filename',
    category: CATEGORY,
    severity: pct > 50 ? 'warning' : 'info',
    title: 'Generyczne nazwy plików obrazów',
    description: `${genericImages.length} z ${content.images.length} obrazów (${pct}%) ma nieopisową nazwę pliku.`,
    why: 'Google używa nazwy pliku jako dodatkowego sygnału dla Google Images i SEO. "czarny-labrador-ogrod.jpg" rankuje — "IMG_1234.jpg" nie.',
    context: genericImages.map(i => i.filename).slice(0, 3).join(', '),
    recommendation: 'Zmień nazwy plików na opisowe slug-i przed uploadem.',
    fixExample: 'IMG_1234.jpg → czarny-labrador-bawicy-sie-w-ogrodzie.jpg',
    fixCode: `<!-- Zmień nazwę pliku przed uploadem -->\n<!-- Przed: IMG_1234.jpg -->\n<!-- Po:    czarny-labrador-ogrod.jpg -->\n<img src="czarny-labrador-ogrod.jpg" alt="Czarny labrador w ogrodzie">`,
  });

  return pct > 50 ? 65 : 85;
}

function checkLazyLoading(content: StructuredContent, findings: Finding[]): number {
  if (content.images.length <= 1) return 100;

  const belowFoldImages = content.images.slice(1);
  const notLazy = belowFoldImages.filter(img => !img.isLazy);
  if (notLazy.length === 0) return 100;

  const pct = Math.round((notLazy.length / belowFoldImages.length) * 100);

  if (pct > 50) {
    findings.push({
      ruleId: 'images.no-lazy-loading',
      category: CATEGORY,
      severity: 'warning',
      title: 'Brak lazy loading na obrazach',
      description: `${notLazy.length} z ${belowFoldImages.length} obrazów poniżej fold nie ma loading="lazy".`,
      why: 'Lazy loading odkłada ładowanie obrazów spoza widoku, zmniejszając LCP i czas ładowania strony. Google uwzględnia Core Web Vitals w rankingu.',
      context: notLazy.map(i => i.filename).slice(0, 3).join(', '),
      recommendation: 'Dodaj loading="lazy" do wszystkich obrazów z wyjątkiem pierwszego (LCP hero image).',
      fixCode: `<!-- Pierwszy obraz (LCP) — BEZ lazy: -->\n<img src="hero.jpg" alt="...">\n\n<!-- Pozostałe obrazy — Z lazy: -->\n<img src="sekcja2.jpg" alt="..." loading="lazy">`,
    });
    return 70;
  }

  findings.push({
    ruleId: 'images.partial-lazy-loading',
    category: CATEGORY,
    severity: 'info',
    title: 'Niekompletny lazy loading',
    description: `${notLazy.length} obraz(y) poniżej fold bez loading="lazy".`,
    why: 'Każdy nieoptymalizowany obraz spowalnia stronę.',
    recommendation: 'Dodaj loading="lazy" do pozostałych obrazów.',
    fixCode: `<img src="obraz.jpg" alt="Opis" loading="lazy">`,
  });

  return 85;
}

function checkImageCount(content: StructuredContent, findings: Finding[]): number {
  if (content.inputType !== 'html') return 100;

  if (content.wordCount >= 600 && content.images.length === 0) {
    findings.push({
      ruleId: 'images.no-images',
      category: CATEGORY,
      severity: 'info',
      title: 'Brak obrazów w długiej treści',
      description: `Treść liczy ${content.wordCount} słów, ale nie zawiera żadnych obrazów.`,
      why: 'Artykuły z obrazami mają średnio 94% więcej wyświetleń. Obrazy zmniejszają bounce rate i pomagają w rankingu Google Images.',
      recommendation: 'Dodaj co najmniej 1 obraz na każde 500 słów treści.',
    });
    return 75;
  }

  return 100;
}

export function analyzeImages(content: StructuredContent): CategoryResult {
  const findings: Finding[] = [];

  if (content.analysisMode === 'text') {
    return {
      category: CATEGORY, label: LABEL, score: 100, status: 'pass',
      findings: [{ ruleId: 'images.article-mode', category: CATEGORY, severity: 'info',
        title: 'Obrazy — analiza po dodaniu do CMS',
        description: 'Obrazy są dodawane przy publikacji w CMS. Zadbaj o opisowe nazwy plików i atrybuty alt przed uploadem.',
        why: 'Alt text i nazwy plików obrazów to elementy strony dodawane po opublikowaniu artykułu.',
      }],
      llmEnhanced: false,
    };
  }

  const scores = {
    alt:      checkAltText(content, findings),
    filename: checkFilenames(content, findings),
    lazy:     checkLazyLoading(content, findings),
    count:    checkImageCount(content, findings),
  };

  const score = Math.round(
    scores.alt * 0.45 + scores.filename * 0.25 + scores.lazy * 0.20 + scores.count * 0.10
  );

  const status = score >= 80 ? 'pass' : score >= 50 ? 'warning' : 'fail';
  return { category: CATEGORY, label: LABEL, score, status, findings, llmEnhanced: false };
}
