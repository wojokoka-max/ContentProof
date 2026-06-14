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
const checkout = fs.readFileSync(path.join(root, 'app', 'api', 'billing', 'checkout', 'route.ts'), 'utf8');
const webhook = fs.readFileSync(path.join(root, 'app', 'api', 'billing', 'webhook', 'route.ts'), 'utf8');
const portal = fs.readFileSync(path.join(root, 'app', 'api', 'billing', 'portal', 'route.ts'), 'utf8');
const authSource = fs.readFileSync(path.join(__dirname, 'auth.ts'), 'utf8');
const billingSource = fs.readFileSync(path.join(__dirname, 'billing.ts'), 'utf8');
const pricingSource = fs.readFileSync(path.join(root, 'app', 'pricing', 'page.tsx'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'db', 'migrations', '003_billing_subscriptions.sql'), 'utf8');
const engineSource = fs.readFileSync(path.join(__dirname, 'engine.ts'), 'utf8');
const creditMigration = fs.readFileSync(
  path.join(root, 'db', 'migrations', '006_credit_limits_and_purchases.sql'),
  'utf8'
);

console.log('\nbilling security');

test('checkout requires a signed-in user and server-selected prices', () => {
  expect(checkout).toContain('!access.signedIn || !access.userId');
  expect(checkout).toContain('getStripePrice(period!)');
  expect(checkout).notToContain('body?.priceId');
  expect(checkout).toContain("mode: 'subscription'");
  expect(checkout).toContain("mode: 'payment'");
  expect(checkout).toContain('getCreditPackPrice()');
});

test('webhook verifies the raw signed payload', () => {
  expect(webhook).toContain('await request.text()');
  expect(webhook).toContain("request.headers.get('stripe-signature')");
  expect(webhook).toContain('webhooks.constructEvent');
  expect(webhook).notToContain('await request.json()');
});

test('webhook processing is idempotent and subscription records are unique', () => {
  expect(webhook).toContain('stripe_webhook_events');
  expect(webhook).toContain('ON CONFLICT (stripe_subscription_id)');
  expect(migration).toContain('stripe_subscription_id text PRIMARY KEY');
  expect(migration).toContain('stripe_event_id text PRIMARY KEY');
  expect(creditMigration).toContain('stripe_checkout_session_id text PRIMARY KEY');
  expect(webhook).toContain('saveCreditPurchase(session)');
});

test('Premium comes from an active database subscription, not the success page', () => {
  expect(authSource).toContain('billing.isSubscriber');
  expect(billingSource).toContain("status IN ('active', 'trialing')");
  expect(pricingSource).notToContain('setAccount({ isPremium: true');
});

test('customer portal is owner-authenticated', () => {
  expect(portal).toContain('!access.signedIn || !access.userId');
  expect(portal).toContain('getBillingAccess(access.userId)');
});

test('billing does not modify the analysis engine', () => {
  expect(engineSource).notToContain('stripe');
  expect(engineSource).notToContain('billing_subscriptions');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
