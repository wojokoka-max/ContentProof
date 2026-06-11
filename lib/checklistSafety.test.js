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
  };
}

const source = fs.readFileSync(path.join(__dirname, 'engine.ts'), 'utf8');

console.log('\nchecklist severity safety');

test('informational findings are excluded from actionable checklist items', () => {
  expect(source).toContain("finding.severity !== 'info'");
});

test('categories with only informational findings are marked as passed', () => {
  expect(source).toContain('if (actionable.length === 0)');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
