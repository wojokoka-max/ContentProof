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

const source = fs.readFileSync(path.join(__dirname, 'expansionPackGenerator.ts'), 'utf8');

console.log('\ninternal link safety');

test('internal link suggestions use only verified existing links', () => {
  expect(source).toContain('generateVerifiedInternalLinks');
  expect(source).toContain('link.isInternal');
  expect(source).toContain('link.href');
});

test('main expansion pack does not use heading-derived link suggestions', () => {
  expect(source).toContain('const internalLinkSuggestions = generateVerifiedInternalLinks(content);');
  expect(source).notToContain('const internalLinkSuggestions = generateInternalLinks(content);');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
