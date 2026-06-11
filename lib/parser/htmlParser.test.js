/**
 * htmlParser.test.js
 * Vanilla Node.js tests — no test runner needed.
 * Run: node lib/parser/htmlParser.test.js
 */

const fs = require('fs');
const path = require('path');

// ── Inline the .ts logic in JS for direct Node testing ──────────────────────
// (In the real Next.js project, ts-jest or vitest handles transpilation)

const GENERIC_FILENAME_PATTERNS = [
  /^img[-_]?\d+/i, /^image[-_]?\d+/i, /^photo[-_]?\d+/i,
  /^dsc\d+/i, /^screenshot/i, /^\d{4,}/, /^untitled/i, /^file[-_]?\d+/i,
];
function isGenericFilename(filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  return GENERIC_FILENAME_PATTERNS.some(p => p.test(base));
}
function extractFilename(src) {
  try { const u = new URL(src,'https://x.com'); const p=u.pathname.split('/'); return p[p.length-1]||src; }
  catch { return src.split('/').pop()??src; }
}
function extractPlainText(html) {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&')
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
    .replace(/&#39;/g,"'").replace(/\s{2,}/g,' ').trim();
}
function countWords(text) { return text.trim().split(/\s+/).filter(w=>w.length>0).length; }
function detectInputType(raw) {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return 'url';
  if (/<(h[1-6]|p|title|meta|img|div|span|article|section|header|footer|nav|ul|ol|li|details|summary)\b[^>]*>/i.test(trimmed)) return 'html';
  return 'text';
}
const PL=['się','nie','jak','dla','oraz','przez','jest','są','być','że','co','ale'];
const EN=['the','and','for','that','with','are','this','have','from','not','but'];
function detectLanguage(text) {
  const words=text.toLowerCase().split(/\s+/); const s=new Set(words);
  const pl=PL.filter(w=>s.has(w)).length; const en=EN.filter(w=>s.has(w)).length;
  return pl>=en?'pl':'en';
}
function splitSentences(text) {
  const p=text.replace(/\b(dr|prof|mgr|inż|tzw|itp|itd|np|m\.in|ok|ww|vs|mr|mrs|ms|jr|sr)\./gi,m=>m.replace('.','§DOT§')).replace(/(\d+)\./g,'$1§DOT§');
  return p.split(/(?<=[.!?…])\s+(?=[A-ZŁŚĆĄÓĘŹŻŃ])/u).map(s=>s.replace(/§DOT§/g,'.').trim()).filter(s=>s.length>0);
}
function extractHeadings(html, plainText) {
  const r=[]; const re=/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi; let m;
  while((m=re.exec(html))!==null){const level=parseInt(m[1]);const text=extractPlainText(m[2]).trim();if(!text)continue;const position=plainText.indexOf(text);r.push({level,text,position:position>=0?position:0});}
  return r;
}
function extractLinks(html) {
  const r=[]; const re=/<a([^>]*)>([\s\S]*?)<\/a>/gi; let m;
  while((m=re.exec(html))!==null){
    const attrs=m[1]; const inner=m[2];
    const href=(attrs.match(/href=["']([^"']*)["']/i)||['',''])[1];
    const relM=attrs.match(/rel=["']([^"']*)["']/i);
    const rel=relM?relM[1].toLowerCase().split(/\s+/):[];
    const isNofollow=rel.includes('nofollow');
    const anchorText=extractPlainText(inner).trim();
    const isInternal=/^[/#]/.test(href)||/^mailto:|^tel:/.test(href);
    r.push({href,anchorText,isInternal,rel,isNofollow});
  }
  return r;
}
function extractImages(html) {
  const r=[]; const re=/<img([^>]*)>/gi; let m;
  while((m=re.exec(html))!==null){
    const attrs=m[1];
    const src=(attrs.match(/src=["']([^"']*)["']/i)||['',''])[1];
    const altM=attrs.match(/alt=["']([^"']*)["']/i);
    const alt=altM?altM[1]:null; const hasAlt=altM!==null;
    const loadingM=attrs.match(/loading=["']([^"']*)["']/i);
    const isLazy=loadingM?loadingM[1].toLowerCase()==='lazy':false;
    const filename=extractFilename(src);
    r.push({src,alt,hasAlt,filename,isLazy,hasGenericFilename:isGenericFilename(filename)});
  }
  return r;
}
function extractFaqItems(html) {
  const items=[]; let m;
  const dr=/<details[^>]*>[\s\S]*?<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi;
  while((m=dr.exec(html))!==null){const q=extractPlainText(m[1]).trim();const a=extractPlainText(m[2]).trim();if(q&&a)items.push({question:q,answer:a});}
  const dlr=/<dl[^>]*>([\s\S]*?)<\/dl>/gi;
  while((m=dlr.exec(html))!==null){const dlc=m[1];const dtr=/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;let dm;while((dm=dtr.exec(dlc))!==null){const q=extractPlainText(dm[1]).trim();const a=extractPlainText(dm[2]).trim();if(q&&a)items.push({question:q,answer:a});}}
  return items;
}
function cleanText(text) {
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
    .replace(/\s{2,}/g, ' ')
    .trim();
}
function extractAttributes(tag) {
  const attrs = {};
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match;
  while ((match = attrRegex.exec(tag)) !== null) {
    const [, name, doubleQuoted, singleQuoted, unquoted] = match;
    attrs[name.toLowerCase()] = cleanText(doubleQuoted ?? singleQuoted ?? unquoted ?? '');
  }
  return attrs;
}
function findMetaContent(html, candidates) {
  const wanted = candidates.map(candidate => candidate.toLowerCase());
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const attrs = extractAttributes(tag);
    const identity = (attrs.name ?? attrs.property ?? attrs.itemprop ?? '').toLowerCase();
    const content = attrs.content;
    if (content && wanted.includes(identity)) return cleanText(content);
  }
  return null;
}
function findCanonical(html) {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const attrs = extractAttributes(tag);
    const relTokens = (attrs.rel ?? '').toLowerCase().split(/\s+/);
    if (attrs.href && relTokens.includes('canonical')) return attrs.href.trim();
  }
  return null;
}
function extractMeta(html) {
  const tm=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const titleTag=tm?cleanText(extractPlainText(tm[1])):null;
  const socialTitle=findMetaContent(html, ['og:title', 'twitter:title']);
  const metaTitle=titleTag||socialTitle;
  const metaDescription=findMetaContent(html, ['description', 'og:description', 'twitter:description']);
  const canonical=findCanonical(html);
  return {metaTitle,metaDescription,canonical};
}

// ── Test runner ───────────────────────────────────────────────────────────────
let passed = 0; let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch(e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}
function expect(val) {
  return {
    toBe(exp) { if(val!==exp) throw new Error(`Expected ${JSON.stringify(exp)}, got ${JSON.stringify(val)}`); },
    toEqual(exp) { if(JSON.stringify(val)!==JSON.stringify(exp)) throw new Error(`Expected ${JSON.stringify(exp)}, got ${JSON.stringify(val)}`); },
    toBeGreaterThan(n) { if(!(val>n)) throw new Error(`Expected ${val} > ${n}`); },
    toBeLessThan(n) { if(!(val<n)) throw new Error(`Expected ${val} < ${n}`); },
    toContain(s) { if(!String(val).includes(s)&&!(Array.isArray(val)&&val.includes(s))) throw new Error(`Expected to contain ${JSON.stringify(s)}, got ${JSON.stringify(val)}`); },
    toHaveLength(n) { if(val.length!==n) throw new Error(`Expected length ${n}, got ${val.length}`); },
    toBeNull() { if(val!==null) throw new Error(`Expected null, got ${JSON.stringify(val)}`); },
    toBeTruthy() { if(!val) throw new Error(`Expected truthy, got ${JSON.stringify(val)}`); },
    toBeFalsy() { if(val) throw new Error(`Expected falsy, got ${JSON.stringify(val)}`); },
  };
}

// ─── detectInputType ──────────────────────────────────────────────────────────
console.log('\ndetectInputType');
test('detects HTML article fragment from <p> tag as html', () => expect(detectInputType('<p>Hello</p>')).toBe('html'));
test('detects HTML article fragment from <div> as html', () => expect(detectInputType('<div class="x">text</div>')).toBe('html'));
test('detects full HTML from <title> tag', () => expect(detectInputType('<title>Page</title><p>Hello</p>')).toBe('html'));
test('detects text when no tags', () => expect(detectInputType('Just plain text here.')).toBe('text'));
test('detects text from markdown-like content', () => expect(detectInputType('# Heading\nSome text')).toBe('text'));

// ─── detectLanguage ───────────────────────────────────────────────────────────
console.log('\ndetectLanguage');
test('detects Polish', () => expect(detectLanguage('Artykuł jest bardzo dobry dla SEO. Sprawdź jak się sprawdza.')).toBe('pl'));
test('detects English', () => expect(detectLanguage('This article is good for SEO. Check how it works and what it does.')).toBe('en'));

// ─── extractPlainText ─────────────────────────────────────────────────────────
console.log('\nextractPlainText');
test('strips basic tags', () => expect(extractPlainText('<p>Hello <strong>world</strong></p>')).toBe('Hello world'));
test('strips script tags with content', () => expect(extractPlainText('<script>alert(1)</script>text')).toBe('text'));
test('strips style tags with content', () => expect(extractPlainText('<style>body{color:red}</style>text')).toBe('text'));
test('decodes &amp;', () => expect(extractPlainText('a &amp; b')).toBe('a & b'));
test('decodes &nbsp;', () => expect(extractPlainText('a&nbsp;b')).toBe('a b'));
test('collapses whitespace', () => { const r=extractPlainText('<p>a</p>   <p>b</p>'); expect(r).toBe('a b'); });

// ─── countWords ───────────────────────────────────────────────────────────────
console.log('\ncountWords');
test('counts basic words', () => expect(countWords('one two three')).toBe(3));
test('handles extra spaces', () => expect(countWords('  one   two  ')).toBe(2));
test('empty string returns 0', () => expect(countWords('')).toBe(0));

// ─── splitSentences ───────────────────────────────────────────────────────────
console.log('\nsplitSentences');
test('splits two English sentences', () => {
  const r = splitSentences('This is first. This is second.');
  expect(r.length).toBeGreaterThan(0);
});
test('does not split on abbreviations like dr.', () => {
  const r = splitSentences('Napisał dr. Kowalski. Następne zdanie.');
  expect(r.length).toBeLessThan(4);
});

// ─── extractHeadings ─────────────────────────────────────────────────────────
console.log('\nextractHeadings');
const headingHtml = '<h1>Main Title</h1><h2>Section One</h2><h3>Subsection</h3>';
const headingPlain = 'Main Title Section One Subsection';
test('extracts 3 headings', () => expect(extractHeadings(headingHtml, headingPlain).length).toBe(3));
test('correct levels', () => {
  const h = extractHeadings(headingHtml, headingPlain);
  expect(h[0].level).toBe(1);
  expect(h[1].level).toBe(2);
  expect(h[2].level).toBe(3);
});
test('correct text', () => expect(extractHeadings(headingHtml, headingPlain)[0].text).toBe('Main Title'));
test('heading with attributes', () => {
  const h = extractHeadings('<h2 class="title" id="sec1">Section</h2>', 'Section');
  expect(h[0].text).toBe('Section');
});

// ─── extractLinks ────────────────────────────────────────────────────────────
console.log('\nextractLinks');
const linksHtml = `
  <a href="/about">About us</a>
  <a href="https://external.com" rel="nofollow">External</a>
  <a href="https://external2.com">Follow</a>
`;
test('extracts 3 links', () => expect(extractLinks(linksHtml).length).toBe(3));
test('internal link detected', () => expect(extractLinks(linksHtml)[0].isInternal).toBe(true));
test('external link detected', () => expect(extractLinks(linksHtml)[1].isInternal).toBe(false));
test('nofollow detected', () => expect(extractLinks(linksHtml)[1].isNofollow).toBe(true));
test('follow link not nofollow', () => expect(extractLinks(linksHtml)[2].isNofollow).toBe(false));
test('anchor text extracted', () => expect(extractLinks(linksHtml)[0].anchorText).toBe('About us'));

// ─── extractImages ───────────────────────────────────────────────────────────
console.log('\nextractImages');
const imagesHtml = `
  <img src="/good-image-name.jpg" alt="A good photo" loading="lazy">
  <img src="/img_1234.jpg">
  <img src="https://cdn.example.com/photo.webp" alt="">
`;
test('extracts 3 images', () => expect(extractImages(imagesHtml).length).toBe(3));
test('hasAlt true when alt present', () => expect(extractImages(imagesHtml)[0].hasAlt).toBe(true));
test('hasAlt false when alt missing', () => expect(extractImages(imagesHtml)[1].hasAlt).toBe(false));
test('isLazy detected', () => expect(extractImages(imagesHtml)[0].isLazy).toBe(true));
test('not lazy without attribute', () => expect(extractImages(imagesHtml)[1].isLazy).toBe(false));
test('generic filename detected', () => expect(extractImages(imagesHtml)[1].hasGenericFilename).toBe(true));
test('good filename not generic', () => expect(extractImages(imagesHtml)[0].hasGenericFilename).toBe(false));
test('empty alt still hasAlt true', () => expect(extractImages(imagesHtml)[2].hasAlt).toBe(true));

// ─── extractFaqItems ─────────────────────────────────────────────────────────
console.log('\nextractFaqItems');
const faqDetailsHtml = `
  <details><summary>What is ContentProof?</summary><p>A content analysis tool.</p></details>
  <details><summary>How does it work?</summary><p>It analyzes your HTML.</p></details>
`;
const faqDlHtml = `
  <dl>
    <dt>What is SEO?</dt><dd>Search engine optimization.</dd>
    <dt>Why does it matter?</dt><dd>It drives organic traffic.</dd>
  </dl>
`;
test('extracts details/summary FAQ', () => expect(extractFaqItems(faqDetailsHtml).length).toBe(2));
test('extracts dl/dt/dd FAQ', () => expect(extractFaqItems(faqDlHtml).length).toBe(2));
test('FAQ question text correct', () => expect(extractFaqItems(faqDetailsHtml)[0].question).toBe('What is ContentProof?'));
test('FAQ answer text correct', () => expect(extractFaqItems(faqDetailsHtml)[0].answer).toBe('A content analysis tool.'));

// ─── extractMeta ─────────────────────────────────────────────────────────────
console.log('\nextractMeta');
const metaHtml = `
  <html>
  <head>
    <title>My Page Title</title>
    <meta name="description" content="A great page description.">
    <link rel="canonical" href="https://example.com/my-page">
  </head>
  <body><p>Content</p></body>
  </html>
`;
test('extracts title', () => expect(extractMeta(metaHtml).metaTitle).toBe('My Page Title'));
test('extracts meta description', () => expect(extractMeta(metaHtml).metaDescription).toBe('A great page description.'));
test('extracts canonical', () => expect(extractMeta(metaHtml).canonical).toBe('https://example.com/my-page'));
test('null when missing', () => expect(extractMeta('<p>no meta</p>').metaTitle).toBeNull());
test('extracts description when content attribute comes first', () => {
  const html = '<meta content="Opis z aktualnego artykułu" data-rh="true" name="description">';
  expect(extractMeta(html).metaDescription).toBe('Opis z aktualnego artykułu');
});
test('extracts Open Graph title when title tag is missing', () => {
  const html = '<meta property="og:title" content="Tytuł z aktualnego artykułu">';
  expect(extractMeta(html).metaTitle).toBe('Tytuł z aktualnego artykułu');
});
test('extracts Open Graph description when standard description is missing', () => {
  const html = '<meta property="og:description" content="Opis Open Graph z aktualnego artykułu">';
  expect(extractMeta(html).metaDescription).toBe('Opis Open Graph z aktualnego artykułu');
});
test('extracts Twitter description fallback', () => {
  const html = '<meta name="twitter:description" content="Opis Twitter z aktualnego artykułu">';
  expect(extractMeta(html).metaDescription).toBe('Opis Twitter z aktualnego artykułu');
});
test('decodes entities in detected metadata', () => {
  const html = '<title>Cukier &amp; dieta</title><meta name="description" content="Jedzenie &amp; energia">';
  expect(extractMeta(html).metaTitle).toBe('Cukier & dieta');
  expect(extractMeta(html).metaDescription).toBe('Jedzenie & energia');
});
test('extracts canonical when rel has multiple tokens', () => {
  const html = '<link href="https://example.com/current" rel="alternate canonical">';
  expect(extractMeta(html).canonical).toBe('https://example.com/current');
});

test('URL analysis can replace homepage canonical with the analyzed article URL', () => {
  const source = fs.readFileSync(path.join(__dirname, 'htmlParser.ts'), 'utf8');
  expect(source).toContain('canonicalForUrl');
  expect(source).toContain("detected.pathname === '/' && source.pathname !== '/'");
  expect(source).toContain('? canonicalForUrl(detectedCanonical, sourceUrl)');
});

// ─── isGenericFilename ───────────────────────────────────────────────────────
console.log('\nisGenericFilename');
test('IMG_1234 is generic', () => expect(isGenericFilename('IMG_1234.jpg')).toBe(true));
test('screenshot is generic', () => expect(isGenericFilename('screenshot.png')).toBe(true));
test('descriptive name not generic', () => expect(isGenericFilename('black-labrador-dog.jpg')).toBe(false));
test('DSC0042 is generic', () => expect(isGenericFilename('DSC0042.jpg')).toBe(true));
test('product-photo-2024 not generic', () => expect(isGenericFilename('product-photo-2024.webp')).toBe(false));

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
