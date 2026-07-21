export const CRAWLER_UA_PATTERN =
  /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|pinterest|crawler|spider|bot/i;

export function isCrawlerUserAgent(userAgent: string): boolean {
  return CRAWLER_UA_PATTERN.test(userAgent);
}
