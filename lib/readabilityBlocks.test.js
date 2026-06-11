const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function expect(value) {
  return {
    toBe(expected) {
      if (value !== expected) throw new Error(`Expected ${expected}, got ${value}`);
    },
    toContain(expected) {
      if (!String(value).includes(expected)) throw new Error(`Expected value to contain ${expected}`);
    },
    notToContain(expected) {
      if (String(value).includes(expected)) throw new Error(`Expected value not to contain ${expected}`);
    },
  };
}

const SCANNABLE_SECTION_RE =
  /^(składniki|skladniki|najważniejsze|najwazniejsze|w tym artykule znajdziesz|checklista|lista|faq|pytania|recipeingredient|ingredients|key points|in this article|you will learn|checklist)$/i;

function stripHtml(raw) {
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function isScannableHtmlBlock(raw) {
  return (
    /<(ul|ol|li|table|tr|td|th|details|summary)\b/i.test(raw) ||
    /itemprop=["']recipeIngredient["']/i.test(raw) ||
    /property=["']recipeIngredient["']/i.test(raw)
  );
}

function isScannableTextBlock(text) {
  const cleaned = text.trim();
  if (!cleaned) return true;

  const lines = cleaned.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

  if (lines.length > 1) {
    const heading = lines[0].replace(/:$/, '');
    const bulletLines = lines.filter(line => /^([-*•]|\d+[.)])\s+/.test(line));
    const shortLines = lines.filter(line => line.split(/\s+/).filter(Boolean).length <= 8);

    if (SCANNABLE_SECTION_RE.test(heading)) return true;
    if (bulletLines.length / lines.length >= 0.4) return true;
    if (shortLines.length / lines.length >= 0.75) return true;
  }

  if (/^([-*•]|\d+[.)])\s+/.test(cleaned)) return true;
  if (SCANNABLE_SECTION_RE.test(cleaned.replace(/:$/, ''))) return true;

  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  return wordCount <= 8 && !/[.!?…]$/.test(cleaned);
}

function extractNarrativeHtmlBlocks(raw) {
  const blocks = [];
  const skippedRanges = [];
  const scannableRegex =
    /<(ul|ol|table|details)\b[\s\S]*?<\/\1>|<li\b[\s\S]*?<\/li>|<[^>]*(itemprop|property)=["']recipeIngredient["'][^>]*>[\s\S]*?<\/[^>]+>/gi;

  let scannableMatch;
  while ((scannableMatch = scannableRegex.exec(raw)) !== null) {
    skippedRanges.push([scannableMatch.index, scannableRegex.lastIndex]);
  }

  const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let paragraphMatch;

  while ((paragraphMatch = pRegex.exec(raw)) !== null) {
    const full = paragraphMatch[0];
    const insideSkippedRange = skippedRanges.some(([start, end]) => paragraphMatch.index >= start && paragraphMatch.index < end);

    if (insideSkippedRange || isScannableHtmlBlock(full)) continue;

    const text = stripHtml(full);
    if (text.length >= 40 && !isScannableTextBlock(text)) blocks.push(text);
  }

  return blocks;
}

function splitNarrativeSentencesFromBlocks(blocks) {
  return blocks.flatMap(block => {
    const protectedText = block
      .replace(/\b(dr|prof|mgr|inż|tzw|itp|itd|np|m\.in|ok|ww|vs|mr|mrs|ms|jr|sr)\./gi, match =>
        match.replace('.', '§DOT§')
      )
      .replace(/(\d+)\./g, '$1§DOT§');

    const sentences = protectedText
      .split(/(?<=[.!?…])\s+(?=[A-ZŁŚĆĄÓĘŹŻŃ])/u)
      .map(sentence => sentence.replace(/§DOT§/g, '.').trim())
      .filter(Boolean);

    return sentences.length > 0 ? sentences : [block];
  });
}

function classifySentenceLength(input, inputType = 'text') {
  const blocks = inputType === 'html'
    ? extractNarrativeHtmlBlocks(input)
    : input.split(/\n\s*\n/).map(block => block.trim()).filter(block => block.length >= 40 && !isScannableTextBlock(block));

  const narrativeSentences = splitNarrativeSentencesFromBlocks(blocks);
  if (narrativeSentences.length === 0) return 'skipped';

  const longSentences = narrativeSentences.filter(sentence => sentence.split(/\s+/).filter(Boolean).length > 25);
  return longSentences.length > 0 ? 'long-narrative' : 'ok';
}

console.log('\nreadability scannable blocks');

test('skips ingredient list without periods', () => {
  const html = `
    <h2>Składniki</h2>
    <ul>
      <li>mąka migdałowa</li>
      <li>jajka</li>
      <li>masło</li>
      <li>erytrytol</li>
    </ul>
  `;

  expect(classifySentenceLength(html, 'html')).toBe('skipped');
});

test('skips "W tym artykule znajdziesz" UX block without periods', () => {
  const text = `W tym artykule znajdziesz:
jak zrobić rabarbarowe ciasto low carb
dlaczego kruszonka powinna być chłodna
co zrobić, żeby krem był gęsty
jak dopracować smak bez cukru`;

  expect(classifySentenceLength(text)).toBe('skipped');
});

test('detects ordinary long narrative paragraph', () => {
  const text = 'Rabarbarowe ciasto low carb warto dobrze schłodzić przed krojeniem, ponieważ krem z mascarpone i jogurtu greckiego potrzebuje czasu, żeby uzyskać stabilną konsystencję, a kruszonka po odpoczynku staje się wyraźniejsza i łatwiej zachowuje chrupkość.';

  expect(classifySentenceLength(text)).toBe('long-narrative');
});

test('skips FAQ block', () => {
  const html = `
    <h2>FAQ</h2>
    <details>
      <summary>Czy rabarbar pasuje do low carb?</summary>
      <p>Tak. Sam rabarbar ma mało cukru.</p>
    </details>
  `;

  expect(classifySentenceLength(html, 'html')).toBe('skipped');
});

test('skips numbered instruction list', () => {
  const html = `
    <h2>Jak zrobić</h2>
    <ol>
      <li>Pokrój rabarbar i wymieszaj z erytrytolem</li>
      <li>Wymieszaj składniki spodu i wylep formę</li>
      <li>Podpiecz 10 minut w 175°C</li>
      <li>Wylej krem na spód i dodaj rabarbar</li>
    </ol>
  `;

  expect(classifySentenceLength(html, 'html')).toBe('skipped');
});

test('source uses creator-facing readability messages', () => {
  const source = fs.readFileSync(path.join(__dirname, 'analyzers', 'readability.ts'), 'utf8');
  expect(source).toContain('Długie zdanie w akapicie narracyjnym');
  expect(source).toContain('Lista wykryta — pominięto analizę długości zdań');
  expect(source).toContain('const narrativeSentences = splitNarrativeSentences(content)');
  expect(source).toContain("if (content.language === 'pl')");
  expect(source).notToContain('Wynik Flesch:');
  expect(source).notToContain('Zbyt wiele d');
});

test('plain text heading detection does not invent H3 hierarchy', () => {
  const parserSource = fs.readFileSync(path.join(__dirname, 'parser', 'plainTextParser.ts'), 'utf8');
  const structureSource = fs.readFileSync(path.join(__dirname, 'analyzers', 'structure.ts'), 'utf8');
  expect(parserSource).toContain("if (/:$/.test(line) && words > 3) return false");
  expect(parserSource).toContain('const level: 2 =');
  expect(structureSource).toContain("if (content.analysisMode === 'text') return 100");
  expect(structureSource).toContain("if (content.analysisMode !== 'text' && wordsPerHeading < 50");
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
