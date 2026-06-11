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

const projectRoot = path.join(__dirname, '..');
const inputSource = fs.readFileSync(path.join(projectRoot, 'components', 'ContentInput.tsx'), 'utf8');
const pageSource = fs.readFileSync(path.join(projectRoot, 'app', 'page.tsx'), 'utf8');
const routeSource = fs.readFileSync(path.join(projectRoot, 'app', 'api', 'analyze', 'route.ts'), 'utf8');
const parserSource = fs.readFileSync(path.join(__dirname, 'parser', 'htmlParser.ts'), 'utf8');
const seoSource = fs.readFileSync(path.join(__dirname, 'analyzers', 'seoBasics.ts'), 'utf8');
const faqSource = fs.readFileSync(path.join(__dirname, 'analyzers', 'faq.ts'), 'utf8');
const reportSource = fs.readFileSync(path.join(projectRoot, 'components', 'AnalysisReport.tsx'), 'utf8');

console.log('\nmeta input flow');

test('text mode asks whether the author already has meta data', () => {
  expect(inputSource).toContain('Masz już meta dane?');
  expect(inputSource).toContain('Nie, przygotuj propozycje');
  expect(inputSource).toContain('Tak, chcę je sprawdzić');
});

test('provided meta is sent with the current analysis request', () => {
  expect(pageSource).toContain('metaInput?: MetaInput');
  expect(pageSource).toContain('JSON.stringify({ content, mode, analysisId, metaInput })');
  expect(routeSource).toContain('normalizeMetaInput');
  expect(routeSource).toContain("forcedMode === 'text' ? metaInput : undefined");
});

test('generate mode ignores old meta labels embedded in plain text', () => {
  expect(parserSource).toContain("metaInput?.mode === 'generate'");
  expect(parserSource).toContain("? null");
});

test('plain text without provided meta is not reported as missing meta', () => {
  expect(seoSource).toContain("content.analysisMode === 'text' && content.metaInputMode !== 'provided'");
  expect(seoSource).toContain('Meta dane zostaną przygotowane na podstawie tekstu');
});

test('html fragment without head is not penalized as a published page', () => {
  expect(seoSource).toContain("content.analysisMode === 'html' && content.htmlScope === 'fragment'");
  expect(seoSource).toContain('dlatego brak wykrycia nie obniża wyniku');
});

test('published URL still reports meta that really requires completion', () => {
  expect(seoSource).toContain('Na opublikowanej stronie nie wykryto meta title');
  expect(seoSource).toContain('Na opublikowanej stronie nie wykryto meta description');
});

test('short plain text without FAQ still reports the missing section', () => {
  expect(faqSource).toContain("content.analysisMode === 'html'");
  expect(faqSource).toContain('W przesłanym tekście nie wykryto sekcji FAQ.');
  expect(faqSource).notToContain('content.faqItems.length > 0 || content.wordCount < 400');
});

test('meta result explains generated proposals and does not truncate values', () => {
  expect(reportSource).toContain('Gotowa propozycja znajduje się w SEO Pack');
  expect(reportSource).toContain("overflowWrap: 'anywhere'");
  expect(reportSource).notToContain("textOverflow: 'ellipsis', whiteSpace: 'nowrap'");
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
