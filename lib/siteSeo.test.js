const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  OK ${name}`);
    passed++;
  } catch (error) {
    console.error(`  FAIL ${name}`);
    console.error(`    ${error.message}`);
    failed++;
  }
}

function expectIncludes(source, expected) {
  if (!source.includes(expected)) {
    throw new Error(`Expected source to include: ${expected}`);
  }
}

const root = path.join(__dirname, '..');
const layout = fs.readFileSync(path.join(root, 'app', 'layout.tsx'), 'utf8');
const pricingLayout = fs.readFileSync(path.join(root, 'app', 'pricing', 'layout.tsx'), 'utf8');
const signInLayout = fs.readFileSync(path.join(root, 'app', 'sign-in', '[[...sign-in]]', 'layout.tsx'), 'utf8');
const signUpLayout = fs.readFileSync(path.join(root, 'app', 'sign-up', '[[...sign-up]]', 'layout.tsx'), 'utf8');
const robots = fs.readFileSync(path.join(root, 'app', 'robots.ts'), 'utf8');
const sitemap = fs.readFileSync(path.join(root, 'app', 'sitemap.ts'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'app', 'manifest.ts'), 'utf8');
const homePage = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const footer = fs.readFileSync(path.join(root, 'components', 'SiteFooter.tsx'), 'utf8');

console.log('\nSite SEO');

test('uses ContentProof as the product domain and NextDoor Studio as the parent organization', () => {
  expectIncludes(layout, "const SITE_URL = 'https://www.contentproof.pl'");
  expectIncludes(layout, "const STUDIO_URL = 'https://nextdoorstudio.pl'");
  expectIncludes(layout, "'@type': 'SoftwareApplication'");
  expectIncludes(layout, "'@type': 'WebSite'");
  expectIncludes(layout, "'@type': 'Organization'");
  expectIncludes(layout, "'@id': `${STUDIO_URL}/#organization`");
  expectIncludes(layout, "owns:");
  expectIncludes(layout, "provider:");
  expectIncludes(layout, "const CONTACT_EMAIL = 'kontakt@nextdoorstudio.pl'");
  expectIncludes(layout, 'email: CONTACT_EMAIL');
  expectIncludes(layout, "featureList:");
  expectIncludes(layout, "audience:");
});

test('publishes global contact and studio links', () => {
  expectIncludes(layout, '<SiteFooter />');
  expectIncludes(footer, 'mailto:kontakt@nextdoorstudio.pl');
  expectIncludes(footer, 'https://nextdoorstudio.pl');
  expectIncludes(footer, 'Built by');
  expectIncludes(footer, 'rel="noopener noreferrer"');
});

test('provides canonical and social metadata for public pages', () => {
  expectIncludes(layout, "canonical: '/'");
  expectIncludes(layout, 'openGraph:');
  expectIncludes(layout, 'twitter:');
  expectIncludes(layout, "manifest: '/manifest.webmanifest'");
  expectIncludes(layout, "'max-image-preview': 'large'");
  expectIncludes(pricingLayout, "canonical: '/pricing'");
});

test('keeps authentication pages out of search results', () => {
  for (const source of [signInLayout, signUpLayout]) {
    expectIncludes(source, 'index: false');
    expectIncludes(source, 'follow: false');
  }
  expectIncludes(signInLayout, "canonical: '/sign-in'");
  expectIncludes(signUpLayout, "canonical: '/sign-up'");
});

test('publishes robots and sitemap metadata routes', () => {
  expectIncludes(robots, "'/api/'");
  expectIncludes(robots, "'/sign-in/'");
  expectIncludes(robots, "'/sign-up/'");
  expectIncludes(robots, "'/admin/'");
  expectIncludes(robots, 'sitemap.xml');
  expectIncludes(sitemap, '`${SITE_URL}/pricing`');
  expectIncludes(sitemap, 'lastModified');
});

test('sitemap exposes only indexable public pages', () => {
  if (sitemap.includes('/sign-in') || sitemap.includes('/sign-up') || sitemap.includes('/api/')) {
    throw new Error('Sitemap must not include noindex or private routes');
  }
});

test('publishes a brand manifest for ContentProof', () => {
  expectIncludes(manifest, "name: 'ContentProof'");
  expectIncludes(manifest, "short_name: 'ContentProof'");
  expectIncludes(manifest, "src: '/favicon-contentproof.png'");
  expectIncludes(manifest, "lang: 'pl-PL'");
});

test('publishes visible homepage FAQ with matching FAQPage schema', () => {
  expectIncludes(homePage, 'const HOME_FAQ = [');
  expectIncludes(homePage, "'@type': 'FAQPage'");
  expectIncludes(homePage, 'Najczęstsze pytania o ContentProof');
  expectIncludes(homePage, 'Do czego służy ContentProof?');
  expectIncludes(homePage, 'Czy ContentProof jest tylko dla specjalistów SEO?');
  expectIncludes(homePage, 'Jakie treści można analizować?');
});

test('describes all three analysis modes on the public home page', () => {
  expectIncludes(homePage, 'Sprawdź treść');
  expectIncludes(homePage, 'przed publikacją.');
  expectIncludes(homePage, 'Analiza SEO treści, URL i HTML.');
  expectIncludes(homePage, 'Tekst i szkic');
  expectIncludes(homePage, 'Opublikowany URL');
  expectIncludes(homePage, 'Kod HTML');
  expectIncludes(homePage, 'href="/pricing"');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
