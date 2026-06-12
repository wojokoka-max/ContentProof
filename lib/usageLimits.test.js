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
const usageSource = fs.readFileSync(path.join(__dirname, 'usageLimits.ts'), 'utf8');
const routeSource = fs.readFileSync(path.join(root, 'app', 'api', 'analyze', 'route.ts'), 'utf8');
const inputSource = fs.readFileSync(path.join(root, 'components', 'ContentInput.tsx'), 'utf8');
const reportSource = fs.readFileSync(path.join(root, 'components', 'AnalysisReport.tsx'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'db', 'migrations', '002_analysis_limits.sql'), 'utf8');
const quotaFixMigration = fs.readFileSync(
  path.join(root, 'db', 'migrations', '004_fix_analysis_quota_ambiguity.sql'),
  'utf8'
);
const quotaConflictFixMigration = fs.readFileSync(
  path.join(root, 'db', 'migrations', '005_fix_analysis_quota_conflict_target.sql'),
  'utf8'
);
const engineSource = fs.readFileSync(path.join(__dirname, 'engine.ts'), 'utf8');

console.log('\nusage limits');

test('plans have the approved limits', () => {
  expect(migration).toContain("v_bucket_key := 'guest:lifetime'");
  expect(migration).toContain('v_limit := 1');
  expect(migration).toContain("'free:starter', 'free', 0, 3");
  expect(migration).toContain('v_limit := 30');
});

test('free accounts cannot analyze HTML or URL', () => {
  expect(usageSource).toContain("mode !== 'text'");
  expect(usageSource).toContain("reason: 'premium_mode'");
  expect(inputSource).toContain('canUseAdvancedModes');
  expect(inputSource).toContain('Funkcja Premium');
});

test('quota is reserved server-side and released after failures', () => {
  expect(routeSource).toContain('reserveQuota');
  expect(routeSource).toContain('completeQuota');
  expect(routeSource).toContain('releaseQuota');
  expect(migration).toContain('FOR UPDATE');
});

test('quota SQL qualifies bucket columns that conflict with function output names', () => {
  expect(quotaFixMigration).toContain('FROM analysis_quota_buckets AS quota_bucket');
  expect(quotaFixMigration).toContain('quota_bucket.bucket_key');
  expect(quotaFixMigration).toContain('quota_bucket.limit_value');
  expect(quotaFixMigration).notToContain('WHERE subject_id = p_subject_id AND bucket_key');
});

test('quota SQL uses the primary-key constraint instead of an ambiguous bucket conflict target', () => {
  expect(quotaConflictFixMigration).toContain(
    'ON CONFLICT ON CONSTRAINT analysis_quota_buckets_pkey DO NOTHING'
  );
  expect(quotaConflictFixMigration).notToContain(
    'ON CONFLICT (subject_id, bucket_key) DO NOTHING'
  );
});

test('administrator is unlimited', () => {
  expect(usageSource).toContain("if (plan === 'admin')");
  expect(usageSource).toContain('remaining: null');
});

test('history and PDF remain Premium features', () => {
  expect(usageSource).toContain('canSaveHistory: premium');
  expect(usageSource).toContain('canExport: premium');
  expect(reportSource).toContain('PDF · Premium');
  expect(reportSource).toContain('hasFullSeoPack');
});

test('usage limits do not modify the analysis engine', () => {
  expect(engineSource).notToContain('reserveQuota');
  expect(engineSource).notToContain('analysis_quota');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
