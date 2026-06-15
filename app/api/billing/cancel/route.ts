import { NextResponse } from 'next/server';
import { getAccountAccess } from '@/lib/auth';
import { getBillingAccess, isBillingConfigured } from '@/lib/billing';
import { getDatabase, isDatabaseConfigured } from '@/lib/db';
import { getStripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const access = await getAccountAccess();
    if (!access.signedIn || !access.userId) {
      return NextResponse.json(
        { error: 'Zaloguj się, aby anulować subskrypcję.' },
        { status: 401 }
      );
    }
    if (!isBillingConfigured() || !isDatabaseConfigured()) {
      return NextResponse.json(
        { error: 'Płatności nie są jeszcze skonfigurowane.' },
        { status: 503 }
      );
    }

    const billing = await getBillingAccess(access.userId);
    if (!billing.stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'Nie znaleziono aktywnej subskrypcji do anulowania.' },
        { status: 404 }
      );
    }
    if (billing.cancelAtPeriodEnd) {
      return NextResponse.json({
        status: 'already_cancelled',
        currentPeriodEnd: billing.currentPeriodEnd,
      });
    }

    const subscription = await getStripe().subscriptions.update(
      billing.stripeSubscriptionId,
      { cancel_at_period_end: true }
    );

    const sql = getDatabase();
    await sql`
      UPDATE billing_subscriptions
      SET cancel_at_period_end = true, updated_at = now()
      WHERE stripe_subscription_id = ${subscription.id}
        AND owner_id = ${access.userId}
    `;

    return NextResponse.json(
      {
        status: 'cancelled',
        currentPeriodEnd: billing.currentPeriodEnd,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[/api/billing/cancel]', error);
    return NextResponse.json(
      { error: 'Nie udało się anulować odnowienia. Spróbuj ponownie za chwilę.' },
      { status: 500 }
    );
  }
}
