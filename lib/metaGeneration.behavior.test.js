const fs = require('fs');
const ts = require('typescript');

require.extensions['.ts'] = function registerTs(module, filename) {
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

const { analyze } = require('./engine.ts');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ok ${name}`);
    passed++;
  } catch (error) {
    console.error(`  fail ${name}`);
    console.error(`    ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log('\nmeta generation behavior');

test('FAQ section enriches schema without changing an article into FAQ page', () => {
  const html = `<article>
    <h1>Pistacjowy deser low carb z malinowa galaretka</h1>
    <p>Pistacjowy deser low carb laczy kremowa warstwe smietankowo-pistacjowa, lekko kwaskowe owoce i chrupiace pistacje bez cukru.</p>
    <h2>Skladniki</h2>
    <ul><li>pistacje</li><li>smietanka</li><li>maliny</li></ul>
    <h2>FAQ</h2>
    <h3>Czy mozna uzyc mrozonych malin?</h3>
    <p>Tak, ale trzeba je dobrze rozmrozic i odsaczyc przed dodaniem do deseru.</p>
  </article>`;

  const result = analyze(html, 'html', 'meta-behavior-html');
  assert(result.seoPack.contentType !== 'faq-page', `Expected article/blog content type, got ${result.seoPack.contentType}`);
  assert(result.seoPack.ogTags.type === 'article', `Expected article OG type, got ${result.seoPack.ogTags.type}`);
  assert(result.seoPack.jsonLd.includes('"@type": "FAQPage"'), 'Expected FAQPage schema to remain present');
});

test('supporting low carb mention does not get appended to plain text title', () => {
  const text = `Jajecznica z boczkiem - prosty i sycacy przepis

Jajecznica z boczkiem to klasyczne sniadanie, ktore nigdy sie nie nudzi. Jest szybka do przygotowania, aromatyczna i bardzo sycaca. Chrupiący boczek swietnie laczy sie z kremowymi jajkami, tworzac prosty posilek idealny na poczatek dnia.

Skladniki

- 4 jajka
- 100 g wedzonego boczku
- 1 mala cebula
- 1 lyzka masla
- sol
- swiezo mielony pieprz

Przygotowanie

Boczek pokroj w cienkie paski. Cebule obierz i drobno posiekaj.
Na patelni rozgrzej maslo i wrzuc boczek. Smaz kilka minut, az stanie sie lekko chrupiacy.

Z czym podawac

Jajecznica z boczkiem dobrze smakuje z warzywami, ogorkiem kiszonym, awokado, pieczywem low carb albo salatka z pomidorow.`;

  const result = analyze(text, 'text', 'meta-behavior-text');
  assert(/prosty/i.test(result.seoPack.title), `Title should keep descriptive subtitle: ${result.seoPack.title}`);
  assert(!/\blow carb\b/i.test(result.seoPack.title), `Title should not contain low carb: ${result.seoPack.title}`);
  assert(!/^Boczek pokroj|^Na patelni rozgrzej/i.test(result.seoPack.metaDescription), `Description should not start with recipe steps: ${result.seoPack.metaDescription}`);
});

test('manual text and HTML use title-based canonical suggestions in SEO Pack and schema', () => {
  const textResult = analyze(
    'Prosty poradnik o planowaniu publikacji. Artykul pokazuje, jak uporzadkowac szkic, naglowki i najwazniejsze poprawki przed publikacja.',
    'text',
    'canonical-text'
  );
  assert(textResult.seoPack.canonical.includes('/prosty-poradnik-o-planowaniu-publikacji'), `Unexpected text canonical: ${textResult.seoPack.canonical}`);
  assert(textResult.seoPack.jsonLd.includes('"url": "https://twojadomena.pl/prosty-poradnik-o-planowaniu-publikacji"'), 'Text schema should use the title-based canonical');

  const htmlResult = analyze(
    '<article><h1>Prosty poradnik o publikacji</h1><p>Artykul pokazuje, jak uporzadkowac szkic, naglowki i najwazniejsze poprawki przed publikacja.</p></article>',
    'html',
    'canonical-html'
  );
  assert(htmlResult.seoPack.canonical.includes('/prosty-poradnik-o-publikacji'), `Unexpected HTML canonical: ${htmlResult.seoPack.canonical}`);
  assert(htmlResult.seoPack.jsonLd.includes('"@id": "https://twojadomena.pl/prosty-poradnik-o-publikacji"'), 'HTML schema should use the title-based canonical');
});

test('URL mode keeps the analyzed article URL in canonical and schema', () => {
  const html = '<article><h1>Prosty poradnik o publikacji</h1><p>Artykul pokazuje, jak uporzadkowac szkic, naglowki i najwazniejsze poprawki przed publikacja.</p></article>';
  const result = analyze(html, 'url', 'canonical-url', undefined, 'https://example.com/prosty-poradnik-o-publikacji');
  assert(result.seoPack.canonical === 'https://example.com/prosty-poradnik-o-publikacji', `Unexpected URL canonical: ${result.seoPack.canonical}`);
  assert(result.seoPack.jsonLd.includes('"url": "https://example.com/prosty-poradnik-o-publikacji"'), 'URL schema should use the analyzed URL');
  assert(!result.seoPack.jsonLd.includes('twojadomena.pl'), 'Schema should not contain fake canonical domains');
});

test('long plain-text recipe introduction is shortened instead of replaced by a later detail', () => {
  const text = `Ciasto truskawkowe na mace orkiszowej

Ciasto truskawkowe na mace orkiszowej ma lekka, wilgotna strukture, duza ilosc owocow i maslano-waniliowy smak przypominajacy domowe letnie wypieki, ale bez klasycznego cukru.

Blok kontekstu

Maka orkiszowa daje bardziej delikatny i lekko orzechowy smak niz klasyczna maka pszenna. W polaczeniu z jogurtem i maslem dobrze utrzymuje wilgoc.`;

  const result = analyze(text, 'text', 'meta-long-intro-test');
  assert(/^Sprawd/i.test(result.seoPack.metaDescription), `Description should be written as meta copy: ${result.seoPack.metaDescription}`);
  assert(!/^Ciasto truskawkowe.+\bma\b/i.test(result.seoPack.metaDescription), `Description should not be a declarative article sentence: ${result.seoPack.metaDescription}`);
  assert(!/^Maka orkiszowa/i.test(result.seoPack.metaDescription), `Description should not use later detail: ${result.seoPack.metaDescription}`);
  assert(result.seoPack.metaDescription.length <= 160, `Description is too long: ${result.seoPack.metaDescription.length}`);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
