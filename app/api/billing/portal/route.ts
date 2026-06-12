import { NextResponse } from 'next/server';
import { getAccountAccess } from '@/lib/auth';
import { getBillingAccess, isBillingConfigured } from '@/lib/billing';
import { getStripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST() {
  const access = await getAccountAccess();
  if (!access.signedIn || !access.userId) {
    return NextResponse.json({ error: 'Zaloguj się, aby zarządzać subskrypcją.' }, { status: 401 });
  }
  if (!isBillingConfigured()) {
    return NextResponse.json({ error: 'Płatności nie są jeszcze skonfigurowane.' }, { status: 503 });
  }

  const billing = await getBillingAccess(access.userId);
  if (!billing.stripeCustomerId) {
    return NextResponse.json({ error: 'Nie znaleziono aktywnej subskrypcji.' }, { status: 404 });
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: billing.stripeCustomerId,
    locale: 'pl',
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
  });

  return NextResponse.json({ url: session.url }, { headers: { 'Cache-Control': 'no-store' } });
}
