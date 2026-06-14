import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getDatabase, isDatabaseConfigured } from '@/lib/db';
import { getStripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');
  if (!webhookSecret || !signature || !isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Webhook nie jest skonfigurowany.' }, { status: 503 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy podpis webhooka.' }, { status: 400 });
  }

  const sql = getDatabase();
  const existing = await sql`
    SELECT stripe_event_id
    FROM stripe_webhook_events
    WHERE stripe_event_id = ${event.id}
    LIMIT 1
  `;
  if (existing[0]) return NextResponse.json({ received: true, duplicate: true });

  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    await saveSubscription(event.data.object as Stripe.Subscription);
  } else if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode === 'payment' && session.metadata?.purchaseType === 'credits_5') {
      await saveCreditPurchase(session);
    }
    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;
    if (subscriptionId) {
      const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
      await saveSubscription(subscription);
    }
  }

  await sql`
    INSERT INTO stripe_webhook_events (stripe_event_id, event_type)
    VALUES (${event.id}, ${event.type})
    ON CONFLICT (stripe_event_id) DO NOTHING
  `;

  return NextResponse.json({ received: true });
}

async function saveCreditPurchase(session: Stripe.Checkout.Session) {
  const ownerId = session.metadata?.ownerId || session.client_reference_id;
  if (!ownerId || session.payment_status !== 'paid') return;

  const credits = Number(session.metadata?.credits);
  if (credits !== 5) return;

  const sql = getDatabase();
  await sql`
    WITH saved_purchase AS (
      INSERT INTO credit_purchases (
        stripe_checkout_session_id,
        owner_id,
        credits,
        amount_total,
        currency
      )
      VALUES (
        ${session.id},
        ${ownerId},
        ${credits},
        ${session.amount_total},
        ${session.currency}
      )
      ON CONFLICT (stripe_checkout_session_id) DO NOTHING
      RETURNING owner_id, credits
    ),
    updated_balance AS (
      UPDATE analysis_quota_buckets AS quota_bucket
      SET
        limit_value = quota_bucket.limit_value + saved_purchase.credits,
        updated_at = now()
      FROM saved_purchase
      WHERE quota_bucket.subject_id = saved_purchase.owner_id
        AND quota_bucket.bucket_key = 'credits:purchased'
      RETURNING saved_purchase.owner_id
    )
    INSERT INTO analysis_quota_buckets (
      subject_id,
      bucket_key,
      plan,
      used,
      limit_value
    )
    SELECT owner_id, 'credits:purchased', 'free', 0, credits
    FROM saved_purchase
    WHERE NOT EXISTS (
      SELECT 1
      FROM updated_balance
      WHERE updated_balance.owner_id = saved_purchase.owner_id
    )
    ON CONFLICT DO NOTHING
  `;
}

async function saveSubscription(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;
  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) return;

  const sql = getDatabase();
  const customerRows = await sql`
    SELECT owner_id AS "ownerId"
    FROM billing_customers
    WHERE stripe_customer_id = ${customerId}
    LIMIT 1
  ` as Array<{ ownerId: string }>;
  const ownerId = subscription.metadata.ownerId || customerRows[0]?.ownerId;
  if (!ownerId) return;

  const configuredPeriod = subscription.metadata.billingPeriod;
  const billingPeriod = configuredPeriod === 'yearly' || priceId === process.env.STRIPE_PRICE_YEARLY
    ? 'yearly'
    : 'monthly';
  const periodEnd = subscription.items.data
    .map(item => item.current_period_end)
    .filter(Boolean)
    .sort((a, b) => b - a)[0];
  const periodEndIso = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;

  await sql`
    INSERT INTO billing_subscriptions (
      stripe_subscription_id,
      owner_id,
      stripe_customer_id,
      stripe_price_id,
      billing_period,
      status,
      current_period_end,
      cancel_at_period_end
    )
    VALUES (
      ${subscription.id},
      ${ownerId},
      ${customerId},
      ${priceId},
      ${billingPeriod},
      ${subscription.status},
      ${periodEndIso},
      ${subscription.cancel_at_period_end}
    )
    ON CONFLICT (stripe_subscription_id)
    DO UPDATE SET
      owner_id = EXCLUDED.owner_id,
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_price_id = EXCLUDED.stripe_price_id,
      billing_period = EXCLUDED.billing_period,
      status = EXCLUDED.status,
      current_period_end = EXCLUDED.current_period_end,
      cancel_at_period_end = EXCLUDED.cancel_at_period_end,
      updated_at = now()
  `;
}
