import { NextRequest, NextResponse } from 'next/server';
import { analyze } from '@/lib/engine';
import { isUrl, fetchUrl } from '@/lib/fetcher';
import { enhanceMetaAndFaqWithOpenAI } from '@/lib/openAiEditorialEnhancer';
import type { InputMode, MetaInput } from '@/lib/types';
import { detectInputMode } from '@/lib/parser/htmlParser';
import { getAccountAccess } from '@/lib/auth';
import {
  completeQuota,
  quotaErrorMessage,
  releaseQuota,
  reserveQuota,
  type QuotaReservation,
} from '@/lib/usageLimits';

function normalizeInputMode(mode: unknown): InputMode | undefined {
  if (mode === 'article') return 'text';
  if (mode === 'text' || mode === 'html' || mode === 'url') return mode;
  return undefined;
}

function jsonNoStore(body: unknown, init?: ResponseInit, guestId?: string) {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  const response = NextResponse.json(body, { ...init, headers });
  if (guestId) {
    response.cookies.set('cp_guest_id', guestId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }
  return response;
}

function normalizeMetaInput(value: unknown): MetaInput | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const candidate = value as Record<string, unknown>;
  if (candidate.mode !== 'generate' && candidate.mode !== 'provided') return undefined;

  return {
    mode: candidate.mode,
    title: typeof candidate.title === 'string' ? candidate.title.trim() : '',
    description: typeof candidate.description === 'string' ? candidate.description.trim() : '',
  };
}

export async function POST(req: NextRequest) {
  let reservation: QuotaReservation | null = null;
  let analysisId = crypto.randomUUID();
  try {
    const body = await req.json();
    const raw: string = (body?.content ?? '').trim();
    const forcedMode = normalizeInputMode(body?.mode);
    const metaInput = normalizeMetaInput(body?.metaInput);
    analysisId = typeof body?.analysisId === 'string' && body.analysisId
      ? body.analysisId
      : crypto.randomUUID();
    const guestId = req.cookies.get('cp_guest_id')?.value || crypto.randomUUID();

    if (!raw) {
      return jsonNoStore({ error: 'Treść nie może być pusta.', analysisId }, { status: 400 });
    }

    if (!isUrl(raw) && raw.length > 200_000) {
      return jsonNoStore(
        { error: 'Treść jest zbyt długa (max 200 000 znaków).', analysisId },
        { status: 400 }
      );
    }

    const detectedMode = isUrl(raw) ? 'url' : detectInputMode(raw);
    const effectiveMode: InputMode = detectedMode === 'html'
      ? 'html'
      : (forcedMode ?? detectedMode);
    const access = await getAccountAccess();
    reservation = await reserveQuota(access, guestId, analysisId, effectiveMode);

    if (!reservation.allowed) {
      return jsonNoStore({
        error: quotaErrorMessage(reservation.reason, reservation.plan),
        code: reservation.reason,
        plan: reservation.plan,
        remaining: reservation.remaining,
        analysisId,
      }, { status: 403 }, guestId);
    }

    // ── URL mode ───────────────────────────────────────────────────────────────
    if (isUrl(raw)) {
      const { html, debug } = await fetchUrl(raw);

      // Hard fail: zero content and an unrecoverable error (DNS, timeout, total block)
      const isUnrecoverable = (
        html.length === 0 &&
        debug.error !== null &&
        !debug.error.includes('JavaScript') // JS-rendering is "soft" — we got some HTML
      );

      if (isUnrecoverable) {
        await releaseQuota(reservation.subjectId, analysisId, reservation.plan);
        return jsonNoStore({
          error: debug.error ?? 'Nie udało się pobrać treści strony.',
          fetchDebug: debug,
          isUrlFetchError: true,
          analysisId,
        }, { status: 422 }, guestId);
      }

      // Soft case: got some HTML but very little text (bot-blocked or JS-only shell)
      if (html.length > 0) {
        // If we got HTML but essentially no text content, don't generate a misleading report
        const plainText = html
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ').trim();

        if (plainText.length < 200) {
          await releaseQuota(reservation.subjectId, analysisId, reservation.plan);
          // Too little content — return error with debug instead of a fake report
          return jsonNoStore({
            error: debug.error ?? 'Strona zwróciła zbyt mało treści do analizy. Serwer prawdopodobnie blokuje automatyczne pobieranie.',
            fetchDebug: debug,
            isUrlFetchError: true,
            analysisId,
          }, { status: 422 }, guestId);
        }

        let result = analyze(html, 'url', analysisId, undefined, debug.fetchedUrl || raw);
        result = await enhanceMetaAndFaqWithOpenAI(result, html);
        result.fetchDebug = debug;
        await completeQuota(reservation.subjectId, analysisId, reservation.plan);
        return jsonNoStore({
          ...result,
          usage: {
            plan: reservation.plan,
            remaining: reservation.remaining,
            limit: reservation.limit,
            purchasedCredits: reservation.purchasedCredits,
          },
        }, undefined, guestId);
      }

      // Fallback: empty html, no specific error
      await releaseQuota(reservation.subjectId, analysisId, reservation.plan);
      return jsonNoStore({
        error: 'Nie udało się pobrać treści strony. Spróbuj wkleić HTML ręcznie.',
        fetchDebug: debug,
        isUrlFetchError: true,
        analysisId,
      }, { status: 422 }, guestId);
    }

    // ── Manual content mode ────────────────────────────────────────────────────
    let result = analyze(raw, forcedMode, analysisId, forcedMode === 'text' ? metaInput : undefined);
    result = await enhanceMetaAndFaqWithOpenAI(result, raw);
    await completeQuota(reservation.subjectId, analysisId, reservation.plan);
    return jsonNoStore({
      ...result,
      usage: {
        plan: reservation.plan,
        remaining: reservation.remaining,
        limit: reservation.limit,
        purchasedCredits: reservation.purchasedCredits,
      },
    }, undefined, guestId);

  } catch (err) {
    console.error('[/api/analyze]', err);
    if (reservation?.allowed) {
      await releaseQuota(reservation.subjectId, analysisId, reservation.plan).catch(() => undefined);
    }
    return jsonNoStore({ error: 'Błąd analizy. Spróbuj ponownie.', analysisId }, { status: 500 });
  }
}
