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
    toBe(expected) {
      if (value !== expected) throw new Error(`Expected ${expected}, got ${value}`);
    },
    toContain(expected) {
      if (!String(value).includes(expected)) throw new Error(`Expected value to contain ${expected}`);
    },
    notToContain(expected) {
      if (String(value).includes(expected)) throw new Error(`Expected value not to contain ${expected}`);
    },
  };
}

function applyAnalysisResponse(currentAnalysisId, response, previousState) {
  if (response.analysisId !== currentAnalysisId) return previousState;
  return {
    phase: 'result',
    result: response,
  };
}

const projectRoot = path.join(__dirname, '..');
const pageSource = fs.readFileSync(path.join(projectRoot, 'app', 'page.tsx'), 'utf8');
const routeSource = fs.readFileSync(path.join(projectRoot, 'app', 'api', 'analyze', 'route.ts'), 'utf8');

console.log('\nanalysis isolation');

test('new analysis response cannot be overwritten by older response', () => {
  const textA = 'ALPHA_UNIQUE_OLD_TEXT previous URL and FAQ should never leak';
  const textB = 'BETA_UNIQUE_NEW_TEXT current analysis only';
  const responseA = { analysisId: 'analysis-a', seoPack: { title: textA }, expansionPack: { faqText: textA } };
  const responseB = { analysisId: 'analysis-b', seoPack: { title: textB }, expansionPack: { faqText: textB } };

  let currentAnalysisId = 'analysis-a';
  let state = applyAnalysisResponse(currentAnalysisId, responseA, { phase: 'input' });

  currentAnalysisId = 'analysis-b';
  state = { phase: 'loading', result: null };
  state = applyAnalysisResponse(currentAnalysisId, responseB, state);
  state = applyAnalysisResponse(currentAnalysisId, responseA, state);

  const serialized = JSON.stringify(state);
  expect(serialized).toContain('BETA_UNIQUE_NEW_TEXT');
  expect(serialized).notToContain('ALPHA_UNIQUE_OLD_TEXT');
});

test('frontend sends and verifies analysisId', () => {
  expect(pageSource).toContain('currentAnalysisIdRef');
  expect(pageSource).toContain('responseAnalysisId !== analysisId');
  expect(pageSource).toContain("cache: 'no-store'");
});

test('api echoes analysisId and disables response cache', () => {
  expect(routeSource).toContain('analysisId');
  expect(routeSource).toContain('Cache-Control');
  expect(routeSource).toContain('no-store');
});

test('project does not persist analysis results in browser storage', () => {
  const files = [];
  function collect(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.next'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) collect(full);
      else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && entry.name !== 'analysisIsolation.test.js') files.push(full);
    }
  }

  collect(projectRoot);
  const source = files.map(file => fs.readFileSync(file, 'utf8')).join('\n');
  expect(source).notToContain('localStorage');
  expect(source).notToContain('sessionStorage');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
