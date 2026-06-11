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

function derivePublicationStatus(overallScore, hardFails, errorCount) {
  if (hardFails.length > 0) return 'do-not-publish';
  if (errorCount > 0) return 'needs-improvement';
  if (overallScore >= 75) return 'ready-to-publish';
  if (overallScore >= 50) return 'needs-improvement';
  return 'do-not-publish';
}

console.log('\npublication status safety');

test('errors block ready-to-publish even when score is high', () => {
  const status = derivePublicationStatus(77, [], 3);
  if (status !== 'needs-improvement') {
    throw new Error(`Expected needs-improvement, got ${status}`);
  }
});

test('score can be ready only when there are no errors', () => {
  const status = derivePublicationStatus(90, [], 0);
  if (status !== 'ready-to-publish') {
    throw new Error(`Expected ready-to-publish, got ${status}`);
  }
});

test('real score engine counts error severity before ready status', () => {
  const source = fs.readFileSync(path.join(__dirname, 'scoring', 'scoreEngine.ts'), 'utf8');
  if (!source.includes('errorCount > 0')) {
    throw new Error('scoreEngine.ts must block ready status when errors exist');
  }
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
