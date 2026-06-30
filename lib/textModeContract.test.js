const fs = require('fs');
const path = require('path');
const ts = require('typescript');

require.extensions['.ts'] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  module._compile(output, filename);
};

const { analyze } = require(path.join(__dirname, 'engine.ts'));

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

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function parseJsonLd(jsonLd) {
  try {
    return JSON.parse(jsonLd);
  } catch (error) {
    throw new Error(`JSON-LD is not valid JSON: ${error.message}`);
  }
}

function faqSchemaCount(jsonLd) {
  const schema = parseJsonLd(jsonLd);
  const graph = Array.isArray(schema['@graph']) ? schema['@graph'] : [schema];
  const faq = graph.find(entity => entity['@type'] === 'FAQPage');
  return Array.isArray(faq?.mainEntity) ? faq.mainEntity.length : 0;
}

function sentenceCount(text) {
  return text.split(/(?<=[.!?…])\s+/).map(sentence => sentence.trim()).filter(Boolean).length;
}

const textModeSample = `Ciasto truskawkowe na mace orkiszowej

Ciasto truskawkowe na mace orkiszowej ma lekka, wilgotna strukture, duza ilosc owocow i maslano-waniliowy smak przypominajacy domowe letnie wypieki, ale bez klasycznego cukru.

W tym artykule znajdziesz

- jak zrobic lekkie ciasto z truskawkami na mace orkiszowej,
- dlaczego truskawki czesto powoduja zakalec,
- jak uzyskac wilgotne, ale stabilne ciasto,
- czym rozni sie maka orkiszowa od klasycznej pszennej.

Najwazniejsze informacje

- Czas przygotowania: okolo 20 minut
- Pieczenie: okolo 40-45 minut
- Temperatura: 175 stopni C
- Poziom trudnosci: latwy

Dlaczego ciasta z truskawkami bywaja trudne?

Truskawki zawieraja duzo wody, naturalne kwasy i miekki miazsz. Podczas pieczenia czesto puszczaja sok, dlatego moga rozmiekczac srodek i powodowac mokre miejsca w ciescie.

Maka orkiszowa dobrze sprawdza sie w takich wypiekach, poniewaz daje bardziej delikatna strukture, dobrze chlonie wilgoc i ma lekko orzechowy smak. W polaczeniu z jogurtem i maslem pomaga utrzymac miekkie ciasto takze nastepnego dnia.

Składniki

- 250 g maki orkiszowej
- 3 jajka
- 80-100 g allulozy
- 120 g miekkiego masla
- 150 g jogurtu naturalnego
- 350-400 g truskawek

Jak zrobic ciasto

Umyj i dokladnie osusz truskawki. Maslo utrzyj z alluloza i wanilia, a potem dodawaj kolejno jajka. Dodaj jogurt, make orkiszowa, proszek do pieczenia i sol. Przeloz ciasto do formy, rozloz truskawki na wierzchu i piecz do lekkiego zezlocenia.

FAQ

Czy truskawki trzeba osuszyc przed pieczeniem?

Tak, truskawki warto dokladnie osuszyc przed dodaniem do ciasta. Nadmiar wody moze rozmiekczyc srodek i zwiekszyc ryzyko zakalca.

Czy make orkiszowa mozna zastapic pszenna?

Tak, ale ciasto bedzie mialo troche inna strukture i mniej orzechowy smak. Maka orkiszowa lepiej pasuje do tego przepisu, bo dobrze chlonie wilgoc z owocow.

Czy ciasto nadaje sie na nastepny dzien?

Tak, ciasto pozostaje miekkie takze nastepnego dnia. Jogurt i maslo pomagaja utrzymac wilgotna strukture po wystudzeniu.`;

console.log('\nText mode contract');

test('text mode remains available and analyzes the whole plain-text article', () => {
  const result = analyze(textModeSample, 'text', 'text-mode-contract', { mode: 'generate', title: '', description: '' });

  expect(result.meta.analysisMode === 'text', `Expected text analysis mode, got ${result.meta.analysisMode}`);
  expect(result.meta.inputType === 'text', `Expected text input type, got ${result.meta.inputType}`);
  expect(result.meta.wordCount > 180, `Text mode did not count the full article: ${result.meta.wordCount}`);
  expect(result.meta.detectedH1 === 'Ciasto truskawkowe na mace orkiszowej', `Wrong detected title: ${result.meta.detectedH1}`);
});

test('text mode keeps complete creator-facing SEO, FAQ and schema output', () => {
  const result = analyze(textModeSample, 'text', 'text-mode-contract-output', { mode: 'generate', title: '', description: '' });
  const output = [
    result.seoPack.title,
    result.seoPack.metaDescription,
    result.expansionPack.faqText,
    result.seoPack.jsonLd,
    result.fixAll.faqText,
  ].join('\n').toLowerCase();

  expect(result.seoPack.title.length >= 20, `SEO title is too short: ${result.seoPack.title}`);
  expect(result.seoPack.metaDescription.length >= 70, `Meta description is too short: ${result.seoPack.metaDescription}`);
  expect(/[.!?]$/.test(result.seoPack.metaDescription), `Meta description is cut mid-sentence: ${result.seoPack.metaDescription}`);
  expect(result.expansionPack.faqSuggestions.length === 3, `Expected 3 FAQ items, got ${result.expansionPack.faqSuggestions.length}`);
  expect(faqSchemaCount(result.seoPack.jsonLd) === 3, `Expected 3 FAQ schema items, got ${faqSchemaCount(result.seoPack.jsonLd)}`);
  expect(result.seoPack.jsonLd.includes('"@type": "FAQPage"'), 'FAQPage schema is missing');

  for (const item of result.expansionPack.faqSuggestions) {
    expect(item.question.endsWith('?'), `FAQ question is not ready to publish: ${item.question}`);
    const count = sentenceCount(item.answer);
    expect(count >= 2 && count <= 3, `FAQ answer must have 2-3 sentences: ${item.answer}`);
  }

  for (const forbidden of ['brakujaca sekcja', 'dopasuj', 'uzupelnij', 'wymien', 'podaj konkretne', '<details', '<summary']) {
    expect(!output.includes(forbidden), `Text mode leaked forbidden placeholder/instruction: ${forbidden}`);
  }
});

test('text mode UI and API contract stay wired together', () => {
  const projectRoot = path.join(__dirname, '..');
  const inputSource = fs.readFileSync(path.join(projectRoot, 'components', 'ContentInput.tsx'), 'utf8');
  const pageSource = fs.readFileSync(path.join(projectRoot, 'app', 'page.tsx'), 'utf8');
  const routeSource = fs.readFileSync(path.join(projectRoot, 'app', 'api', 'analyze', 'route.ts'), 'utf8');

  expect(inputSource.includes("{ id: 'text', label: 'Tekst'"), 'Text tab was removed from ContentInput');
  expect(inputSource.includes("const [mode, setMode] = useState<InputMode>('text')"), 'Text mode is no longer the default input mode');
  expect(inputSource.includes("mode === 'text'"), 'Text-specific meta flow was removed');
  expect(pageSource.includes('metaInput?: MetaInput'), 'Page no longer forwards text meta input');
  expect(routeSource.includes("forcedMode === 'text' ? metaInput : undefined"), 'API no longer scopes meta input to text mode');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
