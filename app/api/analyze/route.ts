import { NextRequest, NextResponse } from 'next/server';
import { analyze } from '@/lib/engine';
import { isUrl, fetchUrl } from '@/lib/fetcher';
import type { InputMode, MetaInput } from '@/lib/types';

function normalizeInputMode(mode: unknown): InputMode | undefined {
  if (mode === 'article') return 'text';
  if (mode === 'text' || mode === 'html' || mode === 'url') return mode;
  return undefined;
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return NextResponse.json(body, { ...init, headers });
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
  try {
    const body = await req.json();
    const raw: string = (body?.content ?? '').trim();
    const forcedMode = normalizeInputMode(body?.mode);
    const metaInput = normalizeMetaInput(body?.metaInput);
    const analysisId: string = typeof body?.analysisId === 'string' && body.analysisId
      ? body.analysisId
      : crypto.randomUUID();

    if (!raw) {
      return jsonNoStore({ error: 'Treść nie może być pusta.', analysisId }, { status: 400 });
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
        return jsonNoStore({
          error: debug.error ?? 'Nie udało się pobrać treści strony.',
          fetchDebug: debug,
          isUrlFetchError: true,
          analysisId,
        }, { status: 422 });
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
          // Too little content — return error with debug instead of a fake report
          return jsonNoStore({
            error: debug.error ?? 'Strona zwróciła zbyt mało treści do analizy. Serwer prawdopodobnie blokuje automatyczne pobieranie.',
            fetchDebug: debug,
            isUrlFetchError: true,
            analysisId,
          }, { status: 422 });
        }

        const result = analyze(html, 'url', analysisId, undefined, debug.fetchedUrl || raw);
        result.fetchDebug = debug;
        return jsonNoStore(result);
      }

      // Fallback: empty html, no specific error
      return jsonNoStore({
        error: 'Nie udało się pobrać treści strony. Spróbuj wkleić HTML ręcznie.',
        fetchDebug: debug,
        isUrlFetchError: true,
        analysisId,
      }, { status: 422 });
    }

    // ── Manual content mode ────────────────────────────────────────────────────
    if (raw.length > 200_000) {
      return jsonNoStore(
        { error: 'Treść jest zbyt długa (max 200 000 znaków).', analysisId },
        { status: 400 }
      );
    }

    const result = analyze(raw, forcedMode, analysisId, forcedMode === 'text' ? metaInput : undefined);
    return jsonNoStore(result);

  } catch (err) {
    console.error('[/api/analyze]', err);
    return jsonNoStore({ error: 'Błąd analizy. Spróbuj ponownie.' }, { status: 500 });
  }
}
