import { NextResponse } from 'next/server';
import { getAccountAccess } from '@/lib/auth';
import { getDatabase, isDatabaseConfigured } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const access = await getAccountAccess();
  if (!access.configured) {
    return { error: NextResponse.json({ error: 'Logowanie nie jest skonfigurowane.' }, { status: 503 }) };
  }
  if (!access.signedIn || !access.userId) {
    return { error: NextResponse.json({ error: 'Zaloguj się jako administrator.' }, { status: 401 }) };
  }
  if (!access.isAdmin) {
    return { error: NextResponse.json({ error: 'Brak uprawnień administratora.' }, { status: 403 }) };
  }
  if (!isDatabaseConfigured()) {
    return { error: NextResponse.json({ error: 'Baza historii nie jest skonfigurowana.' }, { status: 503 }) };
  }
  return { userId: access.userId };
}

export async function GET() {
  const admin = await requireAdmin();
  if ('error' in admin) return admin.error;

  const sql = getDatabase();
  const rows = await sql`
    SELECT
      id,
      owner_id AS "ownerId",
      analysis_id AS "analysisId",
      title,
      input_mode AS "inputMode",
      source_label AS "sourceLabel",
      overall_score AS "overallScore",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM analysis_history
    ORDER BY updated_at DESC
    LIMIT 200
  `;

  return NextResponse.json(
    { items: rows },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
