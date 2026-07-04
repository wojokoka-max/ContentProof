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

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const projectRoot = path.join(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const textContract = fs.readFileSync(path.join(__dirname, 'textModeContract.test.js'), 'utf8');
const htmlContract = fs.readFileSync(path.join(__dirname, 'htmlModeContract.test.js'), 'utf8');
const lockDoc = fs.readFileSync(path.join(projectRoot, 'docs', 'locked-modes.md'), 'utf8');

console.log('\nLocked Text and HTML modes');

test('full test suite keeps Text and HTML contract tests wired in', () => {
  expect(packageJson.scripts['test:text-contract'] === 'node lib/textModeContract.test.js', 'Text contract script is missing');
  expect(packageJson.scripts['test:html-contract'] === 'node lib/htmlModeContract.test.js', 'HTML contract script is missing');
  expect(packageJson.scripts.test.includes('npm run test:text-contract'), 'Full npm test does not run Text contract');
  expect(packageJson.scripts.test.includes('npm run test:html-contract'), 'Full npm test does not run HTML contract');
});

test('Text mode contract protects complete creator-facing output', () => {
  expect(textContract.includes('analyzes the whole plain-text article'), 'Text contract no longer checks whole-article analysis');
  expect(textContract.includes('Expected 3 FAQ items'), 'Text contract no longer requires three FAQ items');
  expect(textContract.includes('FAQPage schema is missing'), 'Text contract no longer checks FAQ schema');
  expect(textContract.includes('Meta description is cut mid-sentence'), 'Text contract no longer blocks cut meta descriptions');
});

test('HTML mode contract protects metadata, fragments, FAQ and schema', () => {
  expect(htmlContract.includes('keeps detected head metadata'), 'HTML contract no longer checks detected metadata');
  expect(htmlContract.includes('fragment'), 'HTML contract no longer checks HTML fragments');
  expect(htmlContract.includes('Expected 3 generated FAQ items'), 'HTML contract no longer requires three generated FAQ items');
  expect(htmlContract.includes('Expected 3 generated FAQ schema items'), 'HTML contract no longer requires generated FAQ in schema');
});

test('project documentation marks Text and HTML as complete modes', () => {
  expect(lockDoc.includes('Tekst and HTML modes are considered complete'), 'Locked modes document does not mark modes as complete');
  expect(lockDoc.includes('Reopening Rule'), 'Locked modes document does not define the reopening rule');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
