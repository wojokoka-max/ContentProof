import { NextRequest, NextResponse } from 'next/server';
import { getAccountAccess } from '@/lib/auth';
import { getDatabase, isDatabaseConfigured } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function premiumOwner() {
  const access = await getAccountAccess();
  if (!access.configured || !isDatabaseConfigured()) return null;
  if (!access.signedIn || !access.userId || !access.isPremium) return null;
  return access.userId;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ownerId = await premiumOwner();
  if (!ownerId) {
    return NextResponse.json({ error: 'Brak dostępu do historii.' }, { status: 403 });
  }

  const sql = getDatabase();
  const rows = await sql`
    SELECT
      id,
      analysis_id AS "analysisId",
      title,
      input_mode AS "inputMode",
      source_label AS "sourceLabel",
      input_content AS input,
      result_json AS result,
      overall_score AS "overallScore",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM analysis_history
    WHERE id = ${params.id} AND owner_id = ${ownerId}
    LIMIT 1
  `;

  if (!rows[0]) {
    return NextResponse.json({ error: 'Nie znaleziono zapisanej analizy.' }, { status: 404 });
  }

  return NextResponse.json({ item: rows[0] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ownerId = await premiumOwner();
  if (!ownerId) {
    return NextResponse.json({ error: 'Brak dostępu do historii.' }, { status: 403 });
  }

  const sql = getDatabase();
  const rows = await sql`
    DELETE FROM analysis_history
    WHERE id = ${params.id} AND owner_id = ${ownerId}
    RETURNING id
  `;

  if (!rows[0]) {
    return NextResponse.json({ error: 'Nie znaleziono zapisanej analizy.' }, { status: 404 });
  }

  return NextResponse.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
}

