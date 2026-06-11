/**
 * ContentProof — URL Fetcher v1.2
 *
 * Limitations (documented):
 *  - Cannot render JavaScript (no headless browser)
 *  - Some sites block automated requests (bot detection, Cloudflare, etc.)
 *  - SSR/SSG pages work fine; CSR/SPA pages return empty shells
 */

import type { FetchDebug } from './types';
import { extractMeta } from './parser/htmlParser';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

// ─── URL Detection ────────────────────────────────────────────────────────────

const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/i;
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 5;

export function isUrl(input: string): boolean {
  return URL_REGEX.test(input.trim());
}

export function normalizeUrl(input: string): string {
  const t = input.trim();
  return t.startsWith('http://') || t.startsWith('https://') ? t : 'https://' + t;
}

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local')
  ) {
    return true;
  }

  if (normalized === '0.0.0.0') return true;

  const ipv4 = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [, aRaw, bRaw] = ipv4;
    const a = Number(aRaw);
    const b = Number(bRaw);

    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    );
  }

  if (normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }

  return false;
}

function isPrivateIpAddress(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0];

  if (isIP(normalized) === 4) {
    const [a, b] = normalized.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  if (isIP(normalized) === 6) {
    const mappedIpv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    if (mappedIpv4) return isPrivateIpAddress(mappedIpv4);

    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith('2001:db8:')
    );
  }

  return true;
}

function assertPublicHttpUrl(rawUrl: string): string {
  const url = new URL(normalizeUrl(rawUrl));

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Obsługiwane są tylko adresy HTTP i HTTPS.');
  }

  if (url.username || url.password) {
    throw new Error('Adres URL nie może zawierać danych logowania.');
  }

  if (isPrivateHostname(url.hostname)) {
    throw new Error('Nie można pobierać adresów lokalnych ani prywatnych.');
  }

  return url.toString();
}

async function assertPublicResolvedUrl(rawUrl: string): Promise<string> {
  const validatedUrl = assertPublicHttpUrl(rawUrl);
  const hostname = new URL(validatedUrl).hostname;

  if (isIP(hostname)) {
    if (isPrivateIpAddress(hostname)) {
      throw new Error('Nie można pobierać adresów lokalnych ani prywatnych.');
    }
    return validatedUrl;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateIpAddress(address))) {
    throw new Error('Domena prowadzi do lokalnego lub prywatnego adresu IP.');
  }

  return validatedUrl;
}

async function readResponseTextWithLimit(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > MAX_RESPONSE_BYTES) {
    throw new Error('Strona jest zbyt duża do analizy (limit 3 MB).');
  }

  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    receivedBytes += value.byteLength;
    if (receivedBytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('Strona jest zbyt duża do analizy (limit 3 MB).');
    }
    result += decoder.decode(value, { stream: true });
  }

  return result + decoder.decode();
}

// ─── JS-rendered page detection ───────────────────────────────────────────────

/**
 * Heuristics to detect pages that render content via JavaScript.
 * These return near-empty HTML shells that can't be analysed by static fetch.
 */
function detectJsRendering(html: string): {
  isJsRendered: boolean;
  framework: string | null;
} {
  const lower = html.toLowerCase();

  // Visible text after stripping tags/scripts/styles
  const textContent = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const textRatio = html.length > 0 ? textContent.length / html.length : 1;

  // Framework fingerprints
  const isNext   = lower.includes('_next/static') || lower.includes('__next_data__');
  const isGatsby = lower.includes('___gatsby') || lower.includes('gatsby-focus-wrapper');
  const isNuxt   = lower.includes('__nuxt') && lower.includes('_nuxt/');
  const isReact  = lower.includes('data-reactroot') && !lower.includes('wp-content');
  const isWp     = lower.includes('wp-content') || lower.includes('wp-json') || lower.includes('woocommerce');

  const framework =
    isNext   ? 'Next.js'   :
    isGatsby ? 'Gatsby'    :
    isNuxt   ? 'Nuxt.js'   :
    isReact  ? 'React'     :
    isWp     ? 'WordPress' : null;

  // WordPress always serves full HTML — never flag
  if (isWp) return { isJsRendered: false, framework: 'WordPress' };

  // Next.js/Gatsby do SSG — they often have full content in HTML.
  // Only flag as JS-rendered if the page has virtually no text content
  // (empty shell: <div id="__next"></div> pattern) AND no h1 tags.
  const hasH1 = /<h1[\s\S]*?<\/h1>/i.test(html);
  const hasBodyContent = textContent.length > 200;

  // It's a JS shell if: recognized SPA framework + no real content extracted
  const isJsRendered = (isNext || isGatsby || isNuxt || isReact)
    && !hasBodyContent
    && !hasH1
    && textRatio < 0.10;

  return { isJsRendered, framework };
}

// ─── Bot-block detection ──────────────────────────────────────────────────────

function detectBotBlock(html: string, status: number): boolean {
  if (status === 403 || status === 429 || status === 503) return true;
  const lower = html.toLowerCase();
  return (
    lower.includes('cloudflare') && lower.includes('ray id') ||
    lower.includes('access denied') ||
    lower.includes('bot detection') ||
    lower.includes('captcha') ||
    (html.length < 500 && status === 200)
  );
}

// ─── Fetch Result ─────────────────────────────────────────────────────────────

export interface FetchResult {
  html: string;
  debug: FetchDebug;
}

// ─── User-Agent pool — rotate to improve success rate ────────────────────────

const USER_AGENTS = [
  // Chrome Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  // Chrome Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  // Safari Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  // Googlebot — many sites allow this explicitly
  'Googlebot/2.1 (+http://www.google.com/bot.html)',
  // Facebookbot — some sites allow social crawlers
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
];

// ─── Main Fetcher ─────────────────────────────────────────────────────────────

export async function fetchUrl(rawUrl: string): Promise<FetchResult> {
  const startMs = Date.now();

  const debug: FetchDebug = {
    fetchedUrl: rawUrl.trim(),
    httpStatus: null,
    contentType: null,
    htmlLength: 0,
    textLength: 0,
    detectedTitleRaw: null,
    detectedH1Count: 0,
    detectedMetaDescriptionRaw: null,
    fetchDurationMs: 0,
    error: null,
  };

  let url: string;
  try {
    url = await assertPublicResolvedUrl(rawUrl);
    debug.fetchedUrl = url;
  } catch (err) {
    debug.fetchDurationMs = Date.now() - startMs;
    debug.error = err instanceof Error ? err.message : 'Nieprawidłowy adres URL.';
    return { html: '', debug };
  }

  // Try multiple user-agents before giving up
  const agents = [USER_AGENTS[0], USER_AGENTS[3], USER_AGENTS[2], USER_AGENTS[4]]; // Chrome, Googlebot, Safari, FB

  for (const ua of agents) {
    const result = await attemptFetch(url, ua, debug, startMs);
    if (result !== null) return result;
    // If first attempt blocked, try Googlebot UA
  }

  // All attempts failed
  debug.fetchDurationMs = Date.now() - startMs;
  return { html: '', debug };
}

async function attemptFetch(
  url: string,
  ua: string,
  debug: FetchDebug,
  startMs: number
): Promise<FetchResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let currentUrl = url;

    let response: Response | null = null;
    try {
      for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
        response = await fetch(currentUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Upgrade-Insecure-Requests': '1',
          },
          redirect: 'manual',
        });

        if (![301, 302, 303, 307, 308].includes(response.status)) break;

        const location = response.headers.get('location');
        if (!location) break;

        if (redirects === MAX_REDIRECTS) {
          throw new Error(`Przekroczono limit przekierowań (${MAX_REDIRECTS}).`);
        }

        currentUrl = await assertPublicResolvedUrl(new URL(location, currentUrl).toString());
        debug.fetchedUrl = currentUrl;
      }
    } finally {
      clearTimeout(timeout);
    }

    if (!response) {
      debug.error = 'Nie udało się pobrać odpowiedzi serwera.';
      return { html: '', debug };
    }

    debug.httpStatus = response.status;
    debug.contentType = response.headers.get('content-type');
    debug.fetchDurationMs = Date.now() - startMs;

    if (!response.ok) {
      // Try next UA
      debug.error = `HTTP ${response.status}`;
      return null;
    }

    const ct = debug.contentType ?? '';
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
      debug.error = `Nieobsługiwany typ treści: ${ct}`;
      return { html: '', debug };
    }

    const html = await readResponseTextWithLimit(response);
    debug.htmlLength = html.length;
    debug.fetchDurationMs = Date.now() - startMs;

    // Extract metadata
    const metadata = extractMeta(html);
    debug.detectedTitleRaw = metadata.metaTitle;
    debug.detectedH1Count = countH1s(html);
    debug.detectedMetaDescriptionRaw = metadata.metaDescription;

    const plainText = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    debug.textLength = plainText.length;

    // Detect bot block — but only if we got very little content
    // Some sites return 200 with a CAPTCHA page (small HTML), others return real content
    if (detectBotBlock(html, response.status)) {
      // If we got real HTML content despite the "block", use it
      if (html.length > 5000 && debug.detectedTitleRaw) {
        debug.error = null; // not actually blocked — got real content
      } else {
        debug.error = 'Strona blokuje automatyczne pobieranie (bot detection / Cloudflare). Pobierz HTML ręcznie i wklej go do analizatora.';
        return null; // try next UA
      }
    }

    // Detect JS-rendered content
    const { isJsRendered, framework } = detectJsRendering(html);
    if (isJsRendered) {
      debug.error = `Strona renderuje treść przez JavaScript (${framework ?? 'nieznany framework'}). Statyczny fetcher nie może pobrać pełnej zawartości. Otwórz stronę w przeglądarce, kliknij prawym przyciskiem → "Wyświetl źródło strony" i wklej HTML do analizatora.`;

      // Still return the HTML — it has meta tags/title even if no body content
      // This allows at least partial analysis
      return { html, debug };
    }

    if (html.length < 100) {
      debug.error = 'Pobrana treść jest zbyt krótka (< 100 znaków). Strona mogła zwrócić pustą odpowiedź.';
      return { html, debug };
    }

    return { html, debug };

  } catch (err: unknown) {
    debug.fetchDurationMs = Date.now() - startMs;
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        debug.error = 'Timeout: strona nie odpowiedziała w ciągu 15 sekund.';
        return { html: '', debug };
      }
      if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
        debug.error = `DNS: nie można rozwiązać nazwy domeny "${new URL(url).hostname}".`;
        return { html: '', debug };
      }
      debug.error = err.message;
    } else {
      debug.error = 'Nieznany błąd podczas pobierania.';
    }
    return { html: '', debug };
  }
}

// ─── Metadata extractors ──────────────────────────────────────────────────────

function countH1s(html: string): number {
  return (html.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi) ?? []).length;
}
