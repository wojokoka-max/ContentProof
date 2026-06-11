const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  OK ${name}`);
    passed++;
  } catch (error) {
    console.error(`  FAIL ${name}`);
    console.error(`    ${error.message}`);
    failed++;
  }
}

function expect(value) {
  return {
    toBe(expected) {
      if (value !== expected) throw new Error(`Expected ${expected}, got ${value}`);
    },
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

function detectHtmlScope(raw) {
  const hasHtmlTag = /<html\b/i.test(raw);
  const hasHead = /<head\b/i.test(raw);
  const hasBody = /<body\b/i.test(raw);
  return hasHtmlTag || (hasHead && hasBody) ? 'document' : 'fragment';
}

console.log('\nHTML mode');

test('recognizes an article fragment', () => {
  expect(detectHtmlScope('<h1>Tytuł</h1><p>Treść artykułu.</p>')).toBe('fragment');
});

test('recognizes a complete HTML document', () => {
  expect(detectHtmlScope('<!doctype html><html><head></head><body></body></html>')).toBe('document');
});

test('recognizes head and body as a complete source without html tag', () => {
  expect(detectHtmlScope('<head><title>Tytuł</title></head><body><h1>Tytuł</h1></body>')).toBe('document');
});

test('parser narrows only URL and complete HTML documents', () => {
  const source = fs.readFileSync(path.join(__dirname, 'parser', 'htmlParser.ts'), 'utf8');
  expect(source).toContain("const htmlScope = analysisMode === 'url' ? 'document' : detectHtmlScope(raw)");
  expect(source).toContain("analysisMode === 'url' || htmlScope === 'document'");
  expect(source).toContain('raw, analysisHtml: contentHtml, htmlScope');
});

test('HTML fragment is not penalized for metadata outside the fragment', () => {
  const source = fs.readFileSync(path.join(__dirname, 'analyzers', 'seoBasics.ts'), 'utf8');
  expect(source).toContain("content.analysisMode === 'html' && content.htmlScope === 'fragment'");
  expect(source).toContain('if (isHtmlFragment(content))');
});

test('complete HTML source is checked for canonical', () => {
  const source = fs.readFileSync(path.join(__dirname, 'analyzers', 'seoBasics.ts'), 'utf8');
  expect(source).toContain("content.analysisMode === 'html' && content.htmlScope === 'document'");
});

test('fragment FAQ is not penalized for schema outside the fragment', () => {
  const source = fs.readFileSync(path.join(__dirname, 'analyzers', 'faq.ts'), 'utf8');
  expect(source).toContain("content.analysisMode === 'html' && content.htmlScope === 'fragment'");
});

test('readability uses selected article HTML instead of the whole document', () => {
  const source = fs.readFileSync(path.join(__dirname, 'analyzers', 'readability.ts'), 'utf8');
  expect(source).toContain('content.analysisHtml ?? content.raw');
});

test('report distinguishes fragment from complete HTML source', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'components', 'AnalysisReport.tsx'), 'utf8');
  expect(source).toContain("result.meta.analysisMode === 'html' && result.meta.htmlScope === 'fragment'");
  expect(source).notToContain("const htmlFragment = result.meta.analysisMode === 'html';");
});

test('HTML meta description uses real paragraphs instead of flattened headings', () => {
  const source = fs.readFileSync(path.join(__dirname, 'seoPackGenerator.ts'), 'utf8');
  expect(source).toContain('const sentenceCandidates = fromParagraphs.length > 0');
  expect(source).toContain('? fromParagraphs');
  expect(source).toContain(': content.sentences');
});

test('HTML reads title, description and canonical from Recipe JSON-LD', () => {
  const parserSource = fs.readFileSync(path.join(__dirname, 'parser', 'htmlParser.ts'), 'utf8');
  const seoSource = fs.readFileSync(path.join(__dirname, 'seoPackGenerator.ts'), 'utf8');
  expect(parserSource).toContain('extractJsonLdMeta');
  expect(parserSource).toContain("const priority = ['Recipe', 'Article', 'BlogPosting'");
  expect(parserSource).toContain('detectedMeta.canonical ?? schemaMeta.canonical');
  expect(parserSource).toContain("analysisMode === 'html' ? schemaMeta.title : null");
  expect(parserSource).toContain('/^[\\[{]/.test(trimmed)');
  expect(seoSource).toContain("content.analysisMode === 'html' && existingTitle");
});

test('HTML meta fallback rejects recipe instructions', () => {
  const source = fs.readFileSync(path.join(__dirname, 'seoPackGenerator.ts'), 'utf8');
  expect(source).toContain('isProceduralInstruction');
  expect(source).toContain('isProcedureSectionContent');
  expect(source).toContain("content.analysisMode !== 'html' || !isProceduralInstruction(sentence)");
});

test('engine passes generated FAQ to schema for HTML and every other mode', () => {
  const source = fs.readFileSync(path.join(__dirname, 'engine.ts'), 'utf8');
  expect(source).toContain('const expansionPack = generateExpansionPack(content)');
  expect(source).toContain('generateSeoPack(content, expansionPack.faqSuggestions)');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
