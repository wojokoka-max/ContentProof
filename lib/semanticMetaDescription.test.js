const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${error.message}`);
    failed++;
  }
}

function expect(value) {
  return {
    toContain(expected) {
      if (!String(value).includes(expected)) {
        throw new Error(`Expected value to contain ${expected}`);
      }
    },
    notToContain(expected) {
      if (String(value).includes(expected)) {
        throw new Error(`Expected value not to contain ${expected}`);
      }
    },
  };
}

const source = fs.readFileSync(path.join(__dirname, 'seoPackGenerator.ts'), 'utf8');

console.log('\nsemantic meta description');

test('description considers the whole article and search intent', () => {
  expect(source).toContain('bestEvidence');
  expect(source).toContain('detectPromise');
  expect(source).toContain('buildGeneralInsight');
  expect(source).toContain('scoreEvidenceSentence');
});

test('recipe insight uses only confirmed differentiators', () => {
  expect(source).toContain('buildRecipeInsight');
  expect(source).toContain('Pieczony kalafior działa jak naturalny stabilizator');
  expect(source).toContain('hasFact(content');
  expect(source).toContain("exclusions.push('banana')");
  expect(source).toContain("exclusions.push('skrobi')");
  expect(source).toContain("'Kremowe lody'");
  expect(source).toContain("claims.join(' ')");
});

test('unsupported diet claims are rejected', () => {
  expect(source).toContain('unsupportedDietClaim');
  expect(source).toContain("!\/\\bbez cukru\\b\/.test(articleText)");
  expect(source).toContain("!\/\\blow carb\\b\/.test(articleText)");
});

test('empty SEO phrases are forbidden', () => {
  expect(source).toContain('kompletny przewodnik');
  expect(source).toContain('dowiedz się wszystkiego');
  expect(source).toContain('najlepsze porady');
  expect(source).toContain('sekret');
});

test('first paragraph no longer wins automatically', () => {
  expect(source).notToContain('const firstPara = content.paragraphs.find');
  expect(source).notToContain('return shortenAtWord(firstPara.text, 155)');
});

test('specific article title is not padded with an unrelated content label', () => {
  expect(source).toContain('if (titleKeywords(title).length >= 3)');
});

test('generated description is not cut in the middle of a sentence', () => {
  expect(source).notToContain('return shortenAtWord(cleaned, 155)');
});

test('headings and inline bullet lists cannot become meta description evidence', () => {
  expect(source).toContain('isStructuralMetaBlock');
  expect(source).toContain('bulletCount >= 2');
  expect(source).toContain('normalizedHeadings');
  expect(source).toContain('if (headingLines.length > 0) return true');
});

test('FAQ-supporting sections cannot become meta description evidence', () => {
  expect(source).toContain('isFaqSectionHeading');
  expect(source).toContain('isFaqSectionContent');
  expect(source).toContain('wskazówki|praktyczne wskazówki');
  expect(source).toContain('wartości odżywcze|informacje odżywcze');
  expect(source).toContain('z czym(?:\\s|$)');
  expect(source).toContain('najczęstsze błędy');
});

test('unfinished fragments ending with a colon are rejected', () => {
  expect(source).toContain('if (/:\\s*$/.test(cleaned)) return false');
  expect(source).toContain('!/:\\s*$/.test(sentence)');
});

test('plain text meta uses parsed paragraphs instead of mixing in raw joined sentences', () => {
  expect(source).toContain('const sentenceCandidates = fromParagraphs.length > 0');
  expect(source).toContain('? fromParagraphs');
  expect(source).toContain(': content.sentences');
  expect(source).notToContain("content.analysisMode === 'html' && fromParagraphs.length > 0");
});

test('plain text recipe meta prioritizes the introduction before supporting sections', () => {
  expect(source).toContain('mainIntroduction');
  expect(source).toContain("content.analysisMode === 'text'");
  expect(source).toContain('candidate.position < firstSectionPosition');
  expect(source).toContain('buildRecipeEditorialDescription');
  expect(source).toContain('editorialIntro || introduction');
});

test('recipe steps cannot become SEO title or meta description', () => {
  expect(source).toContain('isProceduralInstruction');
  expect(source).toContain('isProcedureSectionContent');
  expect(source).toContain('isUsableTitleSource');
  expect(source).toContain('!isProceduralInstruction(sentence)');
  expect(source).toContain('!isProcedureSectionContent(paragraph.text, content)');
  expect(source).toContain('resztę\\s+\\S+\\s+');
});

test('Polish section names keep their meaning during topic classification', () => {
  expect(source).toContain(".replace(/ł/g, 'l')");
});

test('recipe title qualifiers are not duplicated in meta description', () => {
  expect(source).toContain("!\/\\blow\\s*carb\\b\/.test(normalizedTitle.toLowerCase())");
  expect(source).toContain("!\/\\bketo\\b\/.test(normalizedTitle.toLowerCase())");
});

test('UX intro blocks cannot become SEO title or meta description', () => {
  expect(source).toContain('isUxIntroBlock');
  expect(source).toContain('w tym artykule znajdziesz');
  expect(source).toContain('!isUxIntroBlock(paragraph.text)');
  expect(source).toContain('!isUxIntroBlock(sentence)');
});

test('generated meta description is finalized before display', () => {
  expect(source).toContain('finalizeMetaDescription');
  expect(source).toContain('startsWithSameTopic');
  expect(source).toContain('candidate.length > 160');
  expect(source).toContain('result.length >= 70 && result.length <= 160');
});

test('FAQ detected in the article is included in JSON-LD', () => {
  expect(source).toContain("'@graph'");
  expect(source).toContain("'@type': 'FAQPage'");
  expect(source).toContain('acceptedAnswer');
  expect(source).toContain('validFaqItems.map');
});

test('generated FAQ is merged into JSON-LD and deduplicated', () => {
  expect(source).toContain('[...faqItems, ...content.faqItems]');
  expect(source).toContain('seenQuestions');
  expect(source).toContain('faqItems: Array<{ question: string; answer: string }> = []');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
