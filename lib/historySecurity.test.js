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
    toContain(expected) {
      if (!String(value).includes(expected)) throw new Error(`Expected value to contain ${expected}`);
    },
    notToContain(expected) {
      if (String(value).includes(expected)) throw new Error(`Expected value not to contain ${expected}`);
    },
  };
}

const root = path.join(__dirname, '..');
const historyRoute = fs.readFileSync(path.join(root, 'app', 'api', 'history', 'route.ts'), 'utf8');
const detailRoute = fs.readFileSync(path.join(root, 'app', 'api', 'history', '[id]', 'route.ts'), 'utf8');
const adminHistoryRoute = fs.readFileSync(path.join(root, 'app', 'api', 'admin', 'history', 'route.ts'), 'utf8');
const adminDetailRoute = fs.readFileSync(path.join(root, 'app', 'api', 'admin', 'history', '[id]', 'route.ts'), 'utf8');
const authSource = fs.readFileSync(path.join(__dirname, 'auth.ts'), 'utf8');
const pageSource = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const engineSource = fs.readFileSync(path.join(__dirname, 'engine.ts'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'db', 'migrations', '001_analysis_history.sql'), 'utf8');

console.log('\nhistory security');

test('history is protected by server-side Premium access', () => {
  expect(historyRoute).toContain('requirePremium');
  expect(historyRoute).toContain('!access.isPremium');
  expect(detailRoute).toContain('!access.isPremium');
});

test('every history query is scoped to the authenticated owner', () => {
  expect(historyRoute).toContain('WHERE owner_id = ${premium.userId}');
  expect(migration).toContain('UNIQUE (owner_id, analysis_id)');
  expect(detailRoute).toContain('WHERE id = ${params.id} AND owner_id = ${ownerId}');
});

test('admin access is explicit, server-side and automatically includes Premium', () => {
  expect(authSource).toContain('ADMIN_USER_IDS');
  expect(authSource).toContain('ADMIN_EMAILS');
  expect(authSource).toContain('ADMIN_GITHUB_USERNAMES');
  expect(authSource).toContain('PREMIUM_EMAILS');
  expect(authSource).toContain("metadata.role === 'admin'");
  expect(authSource).toContain('isAdmin ||');
  expect(adminHistoryRoute).toContain('!access.isAdmin');
  expect(adminDetailRoute).toContain('access.isAdmin');
});

test('admin routes can read all records without weakening private history', () => {
  expect(adminHistoryRoute).toContain('FROM analysis_history');
  expect(adminHistoryRoute).notToContain('WHERE owner_id =');
  expect(adminDetailRoute).toContain('WHERE id = ${params.id}');
  expect(historyRoute).toContain('WHERE owner_id = ${premium.userId}');
  expect(detailRoute).toContain('AND owner_id = ${ownerId}');
});

test('saved response must match the current analysis id', () => {
  expect(historyRoute).toContain('payload.result?.analysisId === payload.analysisId');
  expect(pageSource).toContain('analysisId: state.result.analysisId');
});

test('history is explicit and not automatic', () => {
  expect(pageSource).toContain('handleSaveAnalysis');
  expect(pageSource).toContain("method: 'POST'");
});

test('history work does not modify the analysis engine', () => {
  expect(engineSource).notToContain('analysis_history');
  expect(engineSource).notToContain('getDatabase');
  expect(engineSource).notToContain('@clerk/nextjs');
});

test('database stores independent immutable result snapshots', () => {
  expect(migration).toContain('result_json jsonb NOT NULL');
  expect(migration).toContain('input_content text NOT NULL');
  expect(migration).toContain('UNIQUE (owner_id, analysis_id)');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
