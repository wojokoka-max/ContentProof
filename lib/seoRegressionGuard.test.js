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
    throw new Error(`Schema is not valid JSON: ${error.message}`);
  }
}

function schemaFaqCount(jsonLd) {
  const schema = parseJsonLd(jsonLd);
  const graph = Array.isArray(schema['@graph']) ? schema['@graph'] : [schema];
  const faq = graph.find(entity => entity['@type'] === 'FAQPage');
  return Array.isArray(faq?.mainEntity) ? faq.mainEntity.length : 0;
}

function assertNoForbiddenFragments(result, forbiddenFragments) {
  const output = [
    result.seoPack.title,
    result.seoPack.metaDescription,
    result.seoPack.canonical,
    result.expansionPack.faqText,
    result.seoPack.jsonLd,
  ].join('\n').toLowerCase();

  for (const fragment of forbiddenFragments) {
    expect(!output.includes(fragment.toLowerCase()), `Output leaked forbidden fragment: ${fragment}`);
  }
}

function assertSeoContract(result, expected) {
  expect(result.seoPack.title.includes(expected.titlePart), `Wrong title: ${result.seoPack.title}`);
  expect(result.seoPack.metaDescription.length >= 70, `Meta description too short: ${result.seoPack.metaDescription}`);
  expect(result.seoPack.metaDescription.length <= 160, `Meta description too long: ${result.seoPack.metaDescription}`);
  expect(result.seoPack.metaDescription.includes(expected.descriptionPart), `Wrong meta description: ${result.seoPack.metaDescription}`);
  expect(!/[,:;]$/.test(result.seoPack.metaDescription), `Meta description ends with punctuation fragment: ${result.seoPack.metaDescription}`);
  expect(result.seoPack.canonical.includes(expected.slug), `Wrong canonical: ${result.seoPack.canonical}`);
  expect(result.expansionPack.faqSuggestions.length === 3, `Expected 3 FAQ items, received ${result.expansionPack.faqSuggestions.length}`);
  expect(schemaFaqCount(result.seoPack.jsonLd) === 3, `Expected 3 FAQ schema items, got ${schemaFaqCount(result.seoPack.jsonLd)}`);

  for (const item of result.expansionPack.faqSuggestions) {
    expect(item.question.endsWith('?'), `FAQ question is not a question: ${item.question}`);
    const sentences = item.answer.split(/(?<=[.!?…])\s+/).filter(Boolean);
    expect(sentences.length >= 2 && sentences.length <= 3, `FAQ answer should have 2-3 sentences: ${item.answer}`);
    expect(!/(^|\s)[-*•]\s+/.test(item.answer), `FAQ answer copied a bullet list: ${item.answer}`);
  }
}

console.log('\nSEO regression guard');

test('plain text recipe keeps stable SEO Pack, FAQ and schema contract', () => {
  const text = `Ciasto truskawkowe na mace orkiszowej

Ciasto truskawkowe na mace orkiszowej ma lekka, wilgotna strukture, duza ilosc owocow i maslano-waniliowy smak przypominajacy domowe letnie wypieki, ale bez klasycznego cukru.

W tym artykule znajdziesz

- jak zrobic lekkie ciasto z truskawkami na mace orkiszowej,
- dlaczego truskawki czesto powoduja zakalec,
- jak uzyskac wilgotne, ale stabilne ciasto.

Dlaczego ciasta z truskawkami bywaja trudne?

Truskawki zawieraja:

- duzo wody,
- naturalne kwasy,
- miekki miazsz.

Podczas pieczenia czesto:

- puszczaja sok,
- rozmiekczaja srodek,
- powoduja mokre miejsca w ciescie.

Maka orkiszowa dobrze sprawdza sie w takich wypiekach, poniewaz:

- daje bardziej delikatna strukture,
- dobrze chlonie wilgoc,
- ma lekko orzechowy smak.

Najwazniejsze

- najlepiej uzywac malych, aromatycznych truskawek,
- wanilia lagodzi kwasowosc owocow,
- jogurt poprawia wilgotnosc,
- maslo daje bardziej maslany smak.`;

  const result = analyze(text, 'text', 'guard-text-recipe');

  assertSeoContract(result, {
    titlePart: 'Ciasto truskawkowe',
    descriptionPart: 'Sprawd',
    slug: '/ciasto-truskawkowe-na-mace-orkiszowej',
  });
  assertNoForbiddenFragments(result, [
    'W tym artykule znajdziesz',
    'Brakujaca sekcja',
    'dopasuj',
    'uzupelnij',
    'wymien',
    'podaj',
  ]);
});

test('HTML recipe keeps title, description, canonical and generated FAQ schema from current article', () => {
  const html = `<article>
    <h1>Jajecznica z boczkiem - prosty i sycacy przepis</h1>
    <p>Jajecznica z boczkiem to klasyczne sniadanie, ktore jest szybkie do przygotowania, aromatyczne i bardzo sycace. Chrupiący boczek dobrze laczy sie z kremowymi jajkami.</p>
    <h2>Wskazowki</h2>
    <p>Jajka w temperaturze pokojowej pozwalaja uzyskac delikatniejsza konsystencje. Warto smazyc je powoli na malym ogniu, poniewaz wtedy jajecznica nie robi sie sucha.</p>
    <h2>Z czym podawac</h2>
    <ul><li>swiezymi warzywami</li><li>ogorkiem kiszonym</li><li>awokado</li><li>pieczywem low carb</li></ul>
    <h2>Najczestsze bledy</h2>
    <p>Zbyt wysoka temperatura sprawia, ze jajecznica staje sie sucha i gumowata. Dlatego najlepiej zdjac ja z patelni przed calkowitym scieciem.</p>
  </article>`;

  const result = analyze(html, 'html', 'guard-html-recipe');

  assertSeoContract(result, {
    titlePart: 'Jajecznica z boczkiem',
    descriptionPart: 'klasyczne sniadanie',
    slug: '/jajecznica-z-boczkiem',
  });
  assertNoForbiddenFragments(result, [
    'Co to jest skladniki',
    'Co to jest wskazowki',
    'Brakujaca sekcja',
  ]);
});

test('URL mode never replaces a real article URL with a generated placeholder', () => {
  const html = `<html>
    <head>
      <title>Pieczone jablko z twarozkiem i wanilia bez cukru | LowStyleLife</title>
      <meta name="description" content="Pieczone jablko z twarozkiem i wanilia to prosty deser bez cukru dodanego, dobry dla dzieci i doroslych.">
      <link rel="canonical" href="https://lowstylelife.art/">
    </head>
    <body>
      <article>
        <h1>Pieczone jablko z twarozkiem i wanilia bez cukru</h1>
        <p>Pieczone jablko z twarozkiem i wanilia jest prostym deserem bez cukru dodanego. Sprawdza sie, gdy potrzeba cieplego, delikatnego deseru z kilku skladnikow.</p>
      </article>
    </body>
  </html>`;

  const url = 'https://lowstylelife.art/pieczone-jablko-z-twarozkiem-i-wanilia-bez-cukru';
  const result = analyze(html, 'url', 'guard-url-canonical', undefined, url);

  expect(result.seoPack.canonical === url, `URL canonical should use analyzed article URL: ${result.seoPack.canonical}`);
  expect(result.seoPack.jsonLd.includes(`"url": "${url}"`), 'Schema should use analyzed article URL');
  expect(!result.seoPack.jsonLd.includes('twojadomena.pl'), 'URL mode schema should not contain placeholder domain');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
