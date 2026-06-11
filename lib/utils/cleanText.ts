/**
 * ContentProof — Text Cleaning Utilities
 * No imports. No dependencies. Safe to import from anywhere.
 */

/** Decode HTML entities and normalize whitespace for clean text output */
export function cleanText(text: string): string {
  if (!text) return text;
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/gi, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '...')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/[\u00a0\u2002\u2003\u2009\u200b\ufeff]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
