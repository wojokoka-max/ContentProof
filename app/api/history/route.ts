import { NextRequest, NextResponse } from 'next/server';
import { getAccountAccess } from '@/lib/auth';
import { getDatabase, isDatabaseConfigured } from '@/lib/db';
import type { SaveAnalysisPayload } from '@/lib/history';

export const dynamic = 'force-dynamic';

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}

async function requirePremium() {
  const access = await getAccountAccess();
  if (!access.configured) return { error: errorResponse('Logowanie nie jest jeszcze skonfigurowane.', 503) };
  if (!access.signedIn || !access.userId) return { error: errorResponse('Zaloguj się, aby korzystać z historii.', 401) };
  if (!access.isPremium) return { error: errorResponse('Historia analiz jest dostępna w planie Premium.', 403) };
  if (!isDatabaseConfigured()) return { error: errorResponse('Baza historii nie jest jeszcze skonfigurowana.', 503) };
  return { userId: access.userId };
}

export async function GET() {
  const premium = await requirePremium();
  if ('error' in premium) return premium.error;

  const sql = getDatabase();
  const rows = await sql`
    SELECT
      id,
      analysis_id AS "analysisId",
      title,
      input_mode AS "inputMode",
      source_label AS "sourceLabel",
      overall_score AS "overallScore",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM analysis_history
    WHERE owner_id = ${premium.userId}
    ORDER BY updated_at DESC
    LIMIT 100
  `;

  return NextResponse.json(
    { items: rows },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(request: NextRequest) {
  const premium = await requirePremium();
  if ('error' in premium) return premium.error;

  const rawBody = await request.text();
  if (rawBody.length > 1_500_000) {
    return errorResponse('Analiza jest zbyt duża, aby ją zachować.', 413);
  }

  let payload: SaveAnalysisPayload;
  try {
    payload = JSON.parse(rawBody) as SaveAnalysisPayload;
  } catch {
    return errorResponse('Nieprawidłowe dane analizy.', 400);
  }

  const validMode = payload.inputMode === 'text' || payload.inputMode === 'html' || payload.inputMode === 'url';
  const resultMatches = payload.result?.analysisId === payload.analysisId;
  if (
    !payload.analysisId ||
    !payload.title?.trim() ||
    !payload.input?.trim() ||
    !validMode ||
    !resultMatches
  ) {
    return errorResponse('Analiza jest niekompletna i nie może zostać zapisana.', 400);
  }

  const sql = getDatabase();
  const id = crypto.randomUUID();
  const title = payload.title.trim().slice(0, 180);
  const sourceLabel = payload.sourceLabel?.trim().slice(0, 500) || null;
  const resultJson = JSON.stringify(payload.result);

  const rows = await sql`
    INSERT INTO analysis_history (
      id, owner_id, analysis_id, title, input_mode, source_label,
      input_content, result_json, overall_score
    )
    VALUES (
      ${id}, ${premium.userId}, ${payload.analysisId}, ${title}, ${payload.inputMode},
      ${sourceLabel}, ${payload.input}, CAST(${resultJson} AS jsonb), ${payload.result.overallScore}
    )
    ON CONFLICT (owner_id, analysis_id)
    DO UPDATE SET
      title = EXCLUDED.title,
      input_mode = EXCLUDED.input_mode,
      source_label = EXCLUDED.source_label,
      input_content = EXCLUDED.input_content,
      result_json = EXCLUDED.result_json,
      overall_score = EXCLUDED.overall_score,
      updated_at = now()
    RETURNING id, updated_at AS "updatedAt"
  `;

  return NextResponse.json(
    { saved: true, item: rows[0] },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

