const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function expect(value) {
  return {
    toContain(expected) {
      if (!String(value).includes(expected)) throw new Error(`Expected value to contain ${expected}`);
    },
    notToContain(expected) {
      if (String(value).includes(expected)) throw new Error(`Expected value not to contain ${expected}`);
    },
  };
}

const source = fs.readFileSync(path.join(__dirname, 'seoPackGenerator.ts'), 'utf8');

console.log('\nseo fallback safety');

test('seo generator does not create fake generic titles from empty topic', () => {
  expect(source).notToContain('— kompletny przewodnik');
  expect(source).notToContain('— Complete Guide');
});

test('seo generator does not create fake generic descriptions from empty topic', () => {
  expect(source).notToContain('Kompletny przewodnik po temacie: ${topic}');
  expect(source).notToContain('Complete guide to ${topic}');
});

test('seo generator derives title and description from current content', () => {
  expect(source).toContain('firstMeaningfulSentence');
  expect(source).toContain('titleFromCurrentContent');
  expect(source).toContain('safeTextCandidate(content.plainText)');
  expect(source).toContain('bestEvidence');
  expect(source).toContain('buildGeneralInsight');
});

test('seo generator rejects URL-like text as title or description source', () => {
  expect(source).toContain('isUrlLikeText');
  expect(source).toContain('safeTextCandidate');
  expect(source).toContain('cleaned && !isUrlLikeText(cleaned)');
});

test('seo generator rejects list-like fragments as meta description source', () => {
  expect(source).toContain('isListLikeText');
  expect(source).toContain('!isListLikeText(p.text)');
  expect(source).toContain('buildDescriptionFromContent');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
