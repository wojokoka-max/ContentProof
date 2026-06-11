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

function expect(value) {
  return {
    toBe(expected) {
      if (value !== expected) throw new Error(`Expected ${expected}, got ${value}`);
    },
    toContain(expected) {
      if (!String(value).includes(expected)) {
        throw new Error(`Expected value to contain ${expected}`);
      }
    },
    notToContain(expected) {
      if (String(value).includes(expected)) {
        throw new Error(`Expected value not to contain ${expected}`);
      }
    },
  };
}

function stripHtml(html) {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractBalancedElement(html, start, tagName) {
  const tokenRegex = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  tokenRegex.lastIndex = start;
  let depth = 0;
  let token;
  while ((token = tokenRegex.exec(html)) !== null) {
    if (token.index === start || depth > 0) {
      if (/^<\//.test(token[0])) {
        depth--;
        if (depth === 0) return html.slice(start, tokenRegex.lastIndex);
      } else if (!/\/>$/.test(token[0])) {
        depth++;
      }
    }
  }
  return null;
}

function collectCandidates(html, openTagRegex, priority) {
  const candidates = [];
  let match;
  while ((match = openTagRegex.exec(html)) !== null) {
    const candidate = extractBalancedElement(html, match.index, match[1].toLowerCase());
    if (!candidate || stripHtml(candidate).length < 40) continue;
    candidates.push({ html: candidate, score: stripHtml(candidate).length, priority });
  }
  return candidates;
}

function extractPrimaryContentHtml(html) {
  const candidates = [
    ...collectCandidates(html, /<(article)\b[^>]*>/gi, 5),
    ...collectCandidates(html, /<(main)\b[^>]*>/gi, 4),
    ...collectCandidates(
      html,
      /<(div|section)\b(?=[^>]*\bclass=["'][^"']*(?:entry-content|post-content|wp-block-post-content|elementor-widget-theme-post-content|single-content|text_content)[^"']*["'])[^>]*>/gi,
      3,
    ),
    ...collectCandidates(html, /<(div|section)\b(?=[^>]*\bdata-element-type=["']text["'])[^>]*>/gi, 2),
    ...collectCandidates(html, /<(body)\b[^>]*>/gi, 1),
  ];
  candidates.sort((a, b) => b.priority - a.priority || b.score - a.score);
  let primary = candidates[0]?.html ?? html;
  if (!/<h1\b/i.test(primary)) {
    const h1 = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i)?.[0];
    if (h1) primary = `${h1}\n${primary}`;
  }
  return primary;
}

function extractHeadingFaq(html) {
  const items = [];
  const faqHeading = /<h([2-4])\b[^>]*>\s*(?:<[^>]+>\s*)*(?:FAQ|Najczęstsze pytania|Pytania i odpowiedzi)\s*(?:<[^>]+>\s*)*<\/h\1>/gi;
  let match;
  while ((match = faqHeading.exec(html)) !== null) {
    const faqLevel = Number(match[1]);
    const start = faqHeading.lastIndex;
    const nextSection = new RegExp(`<h([1-${faqLevel}])\\b`, 'i').exec(html.slice(start));
    const section = html.slice(start, nextSection ? start + nextSection.index : html.length);
    const questionRegex = /<h([3-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
    const questions = [];
    let questionMatch;
    while ((questionMatch = questionRegex.exec(section)) !== null) {
      const question = stripHtml(questionMatch[2]);
      if (question.endsWith('?')) {
        questions.push({
          start: questionMatch.index,
          end: questionRegex.lastIndex,
          level: Number(questionMatch[1]),
          question,
        });
      }
    }
    questions.forEach((current, index) => {
      const next = questions.slice(index + 1).find(item => item.level <= current.level);
      const answer = stripHtml(section.slice(current.end, next?.start ?? section.length));
      if (answer) items.push({ question: current.question, answer });
    });
  }
  return items;
}

console.log('\nURL mode');

test('selects article content instead of navigation and footer', () => {
  const articleText = 'Treść artykułu '.repeat(30);
  const html = `<body>
    <nav>Menu Oferta Kontakt</nav>
    <div class="text_content"><h2>Sekcja</h2><p>${articleText}</p></div>
    <footer>Polityka prywatności i wszystkie kategorie</footer>
  </body>`;
  const selected = extractPrimaryContentHtml(html);
  expect(selected).toContain('Treść artykułu');
  expect(selected).notToContain('Polityka prywatności');
});

test('adds H1 kept outside the page-builder article block', () => {
  const html = `<body>
    <div data-element-type="simpleText"><h1>Tytuł artykułu</h1></div>
    <div class="text_content"><p>${'Właściwa treść '.repeat(30)}</p></div>
  </body>`;
  const selected = extractPrimaryContentHtml(html);
  expect(selected).toContain('<h1>Tytuł artykułu</h1>');
  expect(selected).toContain('Właściwa treść');
});

test('extracts questions only from the FAQ section', () => {
  const html = `
    <h2>Wprowadzenie</h2>
    <h3>Czy trzeba liczyć kalorie?</h3><p>To pytanie jest częścią artykułu.</p>
    <h2>FAQ</h2>
    <h3>Od czego zacząć ograniczanie cukru?</h3><p>Najpierw usuń słodzone napoje.</p>
    <h3>Dlaczego warto czytać etykiety?</h3><p>Pozwalają znaleźć cukier ukryty w składzie.</p>
    <h2>Podsumowanie</h2>`;
  const items = extractHeadingFaq(html);
  expect(items.length).toBe(2);
  expect(items[0].question).toBe('Od czego zacząć ograniczanie cukru?');
});

test('production parser uses full HTML for metadata and article HTML for content', () => {
  const source = fs.readFileSync(path.join(__dirname, 'parser', 'htmlParser.ts'), 'utf8');
  expect(source).toContain("const htmlScope = analysisMode === 'url' ? 'document' : detectHtmlScope(raw)");
  expect(source).toContain("analysisMode === 'url' || htmlScope === 'document'");
  expect(source).toContain('const { metaTitle, metaDescription, canonical: detectedCanonical } = extractMeta(raw)');
  expect(source).toContain('const faqItems = extractFaqItems(contentHtml)');
});

test('URL fetcher validates DNS, redirects and response size', () => {
  const source = fs.readFileSync(path.join(__dirname, 'fetcher.ts'), 'utf8');
  expect(source).toContain("from 'node:dns/promises'");
  expect(source).toContain('await assertPublicResolvedUrl(new URL(location, currentUrl).toString())');
  expect(source).toContain('MAX_RESPONSE_BYTES');
  expect(source).toContain('readResponseTextWithLimit(response)');
});

test('URL mode uses the same generated FAQ list in JSON-LD', () => {
  const engineSource = fs.readFileSync(path.join(__dirname, 'engine.ts'), 'utf8');
  expect(engineSource).toContain('generateSeoPack(content, expansionPack.faqSuggestions)');
});

test('URL route keeps the full fetched article URL for canonical', () => {
  const routeSource = fs.readFileSync(path.join(__dirname, '..', 'app', 'api', 'analyze', 'route.ts'), 'utf8');
  const engineSource = fs.readFileSync(path.join(__dirname, 'engine.ts'), 'utf8');
  expect(routeSource).toContain("debug.fetchedUrl || raw");
  expect(engineSource).toContain('sourceUrl?: string');
  expect(engineSource).toContain('parse(raw, forcedMode, metaInput, sourceUrl)');
});

test('short published URL without FAQ is still reported', () => {
  const source = fs.readFileSync(path.join(__dirname, 'analyzers', 'faq.ts'), 'utf8');
  expect(source).notToContain('content.faqItems.length > 0 || content.wordCount < 400');
  expect(source).toContain("content.analysisMode === 'html'");
  expect(source).toContain("severity: 'warning'");
  expect(source).toContain('Na opublikowanej stronie nie wykryto sekcji FAQ.');
});

test('existing FAQ always suppresses the missing FAQ warning', () => {
  const source = fs.readFileSync(path.join(__dirname, 'analyzers', 'faq.ts'), 'utf8');
  expect(source).toContain('if (content.faqItems.length > 0) return 100');
});

test('URL-only FAQ fallback uses concrete article evidence', () => {
  const source = fs.readFileSync(path.join(__dirname, 'expansionPackGenerator.ts'), 'utf8');
  expect(source).toContain('generateUrlFaqFallback');
  expect(source).toContain("content.analysisMode !== 'url'");
  expect(source).toContain('Czy krem trzeba schładzać?');
  expect(source).toContain("content.analysisMode === 'url' && /^wykonanie$/i.test(h2)");
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
