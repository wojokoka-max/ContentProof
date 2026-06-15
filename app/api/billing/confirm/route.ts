import { NextRequest, NextResponse } from 'next/server';
import { getAccountAccess } from '@/lib/auth';
import { recordCreditPurchase } from '@/lib/creditPurchases';
import { getDatabase, isDatabaseConfigured } from '@/lib/db';
import { getStripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const access = await getAccountAccess();
    if (!access.signedIn || !access.userId) {
      return NextResponse.json({ error: 'Zaloguj się, aby potwierdzić zakup.' }, { status: 401 });
    }
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: 'Baza kredytów nie jest skonfigurowana.' }, { status: 503 });
    }

    const body = await request.json().catch(() => null) as { sessionId?: unknown } | null;
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
    if (!sessionId.startsWith('cs_')) {
      return NextResponse.json({ error: 'Brak prawidłowego potwierdzenia płatności.' }, { status: 400 });
    }

    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const ownerId = session.metadata?.ownerId || session.client_reference_id;
    if (ownerId !== access.userId) {
      return NextResponse.json({ error: 'Ta płatność należy do innego konta.' }, { status: 403 });
    }
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ status: 'pending' }, { status: 202 });
    }

    const recorded = await recordCreditPurchase(session);
    if (!recorded) {
      return NextResponse.json({ error: 'Nie rozpoznano pakietu kredytów.' }, { status: 400 });
    }

    const sql = getDatabase();
    const balanceRows = await sql`
      SELECT GREATEST(limit_value - used, 0) AS balance
      FROM analysis_quota_buckets
      WHERE subject_id = ${access.userId}
        AND bucket_key = 'credits:purchased'
      LIMIT 1
    ` as Array<{ balance: number }>;
    return NextResponse.json(
      {
        status: 'confirmed',
        addedCredits: 5,
        purchasedCredits: balanceRows[0]?.balance ?? 0,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[/api/billing/confirm]', error);
    return NextResponse.json(
      { error: 'Nie udało się potwierdzić zakupu. Odśwież stronę za chwilę.' },
      { status: 500 }
    );
  }
}
