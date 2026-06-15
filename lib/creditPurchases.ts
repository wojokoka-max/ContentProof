import type Stripe from 'stripe';
import { getDatabase } from './db';

export async function recordCreditPurchase(session: Stripe.Checkout.Session): Promise<boolean> {
  const ownerId = session.metadata?.ownerId || session.client_reference_id;
  if (!ownerId || session.payment_status !== 'paid') return false;

  const credits = Number(session.metadata?.credits);
  if (session.metadata?.purchaseType !== 'credits_5' || credits !== 5) return false;

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

  return true;
}
