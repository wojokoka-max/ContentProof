import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getAccountAccess } from '@/lib/auth';
import { getDatabase, isDatabaseConfigured } from '@/lib/db';
import { isBillingConfigured } from '@/lib/billing';
import { getCreditPackPrice, getStripe, getStripePrice } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const access = await getAccountAccess();
  if (!access.signedIn || !access.userId) {
    return NextResponse.json({ error: 'Zaloguj się, aby wybrać Premium.' }, { status: 401 });
  }
  if (access.isAdmin) {
    return NextResponse.json({ error: 'Konto administratora ma już pełny dostęp.' }, { status: 400 });
  }
  if (!isBillingConfigured() || !isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Płatności nie są jeszcze skonfigurowane.' }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as {
    period?: unknown;
    purchase?: unknown;
  } | null;
  const creditPurchase = body?.purchase === 'credits_5';
  const period = body?.period === 'yearly' ? 'yearly' : body?.period === 'monthly' ? 'monthly' : null;
  if (!creditPurchase && !period) {
    return NextResponse.json({ error: 'Wybierz plan miesięczny albo roczny.' }, { status: 400 });
  }
  if (
    !creditPurchase &&
    (access.subscriptionStatus === 'active' || access.subscriptionStatus === 'trialing')
  ) {
    return NextResponse.json({ error: 'Masz już aktywną subskrypcję Premium.' }, { status: 409 });
  }
  if (creditPurchase && !process.env.STRIPE_PRICE_CREDITS_5) {
    return NextResponse.json(
      { error: 'Pakiet dodatkowych kredytów nie jest jeszcze skonfigurowany.' },
      { status: 503 }
    );
  }

  const sql = getDatabase();
  const customerRows = await sql`
    SELECT stripe_customer_id AS "stripeCustomerId"
    FROM billing_customers
    WHERE owner_id = ${access.userId}
    LIMIT 1
  ` as Array<{ stripeCustomerId: string }>;
  const stripe = getStripe();
  let customerId = customerRows[0]?.stripeCustomerId;

  if (!customerId) {
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress;
    const customer = await stripe.customers.create({
      email,
      preferred_locales: ['pl'],
      metadata: { ownerId: access.userId },
    });
    customerId = customer.id;

    await sql`
      INSERT INTO billing_customers (owner_id, stripe_customer_id)
      VALUES (${access.userId}, ${customerId})
      ON CONFLICT (owner_id)
      DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id, updated_at = now()
    `;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  if (creditPurchase) {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'pl',
      customer: customerId,
      client_reference_id: access.userId,
      line_items: [{ price: getCreditPackPrice(), quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${appUrl}/pricing?credits=success`,
      cancel_url: `${appUrl}/pricing?credits=cancelled`,
      metadata: {
        ownerId: access.userId,
        purchaseType: 'credits_5',
        credits: '5',
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe nie zwrócił adresu płatności.' }, { status: 502 });
    }

    return NextResponse.json({ url: session.url }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    locale: 'pl',
    customer: customerId,
    client_reference_id: access.userId,
    line_items: [{ price: getStripePrice(period!), quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    success_url: `${appUrl}/pricing?checkout=success`,
    cancel_url: `${appUrl}/pricing?checkout=cancelled`,
    metadata: {
      ownerId: access.userId,
      billingPeriod: period!,
    },
    subscription_data: {
      metadata: {
        ownerId: access.userId,
        billingPeriod: period!,
      },
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: 'Stripe nie zwrócił adresu płatności.' }, { status: 502 });
  }

  return NextResponse.json({ url: session.url }, { headers: { 'Cache-Control': 'no-store' } });
}
