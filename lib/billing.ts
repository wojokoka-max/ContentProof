import { getDatabase, isDatabaseConfigured } from './db';

export type BillingPeriod = 'monthly' | 'yearly';

export interface BillingAccess {
  configured: boolean;
  isSubscriber: boolean;
  billingPeriod: BillingPeriod | null;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
}

interface BillingRow {
  billingPeriod: BillingPeriod;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  stripeCustomerId: string;
}

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing'];

export function isBillingConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.STRIPE_PRICE_MONTHLY &&
    process.env.STRIPE_PRICE_YEARLY &&
    process.env.NEXT_PUBLIC_APP_URL
  );
}

export async function getBillingAccess(ownerId: string): Promise<BillingAccess> {
  const configured = isBillingConfigured() && isDatabaseConfigured();
  if (!configured) return emptyBillingAccess(false);

  const sql = getDatabase();
  const rows = await sql`
    SELECT
      billing_period AS "billingPeriod",
      status,
      cancel_at_period_end AS "cancelAtPeriodEnd",
      current_period_end AS "currentPeriodEnd",
      stripe_customer_id AS "stripeCustomerId"
    FROM billing_subscriptions
    WHERE owner_id = ${ownerId}
      AND status IN ('active', 'trialing')
      AND (current_period_end IS NULL OR current_period_end > now())
    ORDER BY current_period_end DESC NULLS FIRST
    LIMIT 1
  ` as BillingRow[];
  const subscription = rows[0];

  if (!subscription) return emptyBillingAccess(true);

  return {
    configured: true,
    isSubscriber: ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status),
    billingPeriod: subscription.billingPeriod,
    subscriptionStatus: subscription.status,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    currentPeriodEnd: subscription.currentPeriodEnd,
    stripeCustomerId: subscription.stripeCustomerId,
  };
}

function emptyBillingAccess(configured: boolean): BillingAccess {
  return {
    configured,
    isSubscriber: false,
    billingPeriod: null,
    subscriptionStatus: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    stripeCustomerId: null,
  };
}
