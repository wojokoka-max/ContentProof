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

function sentenceCount(text) {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean)
    .length;
}

function assertPublishableFaq(result) {
  const items = result.expansionPack.faqSuggestions;
  expect(
    items.length === 3,
    `Expected 3 FAQ items, received ${items.length}: ${items.map(item => `${item.question} => ${item.answer}`).join(' | ')}`
  );

  for (const item of items) {
    const count = sentenceCount(item.answer);
    expect(item.question.endsWith('?'), `Question is malformed: ${item.question}`);
    expect(count >= 2 && count <= 3, `Answer should have 2-3 sentences: ${item.answer}`);
    expect(!/dopasuj|uzupełnij|wymień|podaj|placeholder/i.test(item.answer), `Editorial instruction leaked: ${item.answer}`);
  }

  const schema = JSON.parse(result.seoPack.jsonLd);
  const graph = Array.isArray(schema['@graph']) ? schema['@graph'] : [];
  const faqSchema = graph.find(entity => entity['@type'] === 'FAQPage');
  expect(faqSchema, 'FAQPage is missing from schema');
  expect(faqSchema.mainEntity.length >= 3, 'Schema does not contain all generated FAQ items');
}

console.log('\nFAQ generation behavior');

test('creates three article-grounded FAQ items for plain educational text', () => {
  const text = `Jak ograniczyć cukier bez restrykcyjnej diety

Ograniczanie cukru najlepiej zacząć od słodzonych napojów, ponieważ dostarczają dużo cukru i nie dają sytości. Następnie warto sprawdzać etykiety gotowych sosów, płatków i jogurtów.

Od czego zacząć

Woda, niesłodzona herbata i kawa mogą zastąpić słodkie napoje. Regularne posiłki oparte na białku, warzywach i zdrowych tłuszczach pomagają ograniczyć ochotę na słodycze.

Co pomaga utrzymać sytość

Białko, warzywa i zdrowe tłuszcze wydłużają uczucie sytości. Dzięki temu łatwiej ograniczyć podjadanie słodkich produktów między posiłkami.

Najczęstsze błędy

Nie trzeba usuwać wszystkich węglowodanów. Zbyt gwałtowne restrykcje często utrudniają utrzymanie nowych nawyków.`;

  assertPublishableFaq(analyze(text, 'text', 'faq-text-test'));
});

test('keeps and expands three existing HTML FAQ items', () => {
  const html = `<article>
    <h1>Ile kosztuje pozycjonowanie lokalnej firmy?</h1>
    <p>Cena zależy od konkurencji, zakresu strony i liczby lokalizacji. Mała firma usługowa zwykle potrzebuje optymalizacji wizytówki, stron usług i lokalnych treści.</p>
    <h2>FAQ</h2>
    <h3>Kiedy pojawią się pierwsze efekty?</h3>
    <p>Pierwsze zmiany mogą być widoczne po kilku tygodniach, ale stabilny wzrost zwykle wymaga kilku miesięcy.</p>
    <h3>Czy potrzebna jest wizytówka Google?</h3>
    <p>Tak, ponieważ pomaga klientom znaleźć adres, telefon i opinie o firmie.</p>
    <h3>Czy jedna strona wystarczy?</h3>
    <p>To zależy od liczby usług i lokalizacji, jednak osobne podstrony zwykle lepiej odpowiadają na konkretne zapytania.</p>
  </article>`;

  assertPublishableFaq(analyze(html, 'html', 'faq-html-test'));
});

test('does not mix preparation mistakes with serving suggestions in recipe FAQ', () => {
  const text = `Jajecznica z boczkiem - prosty i sycący przepis

Jajecznica z boczkiem to szybkie, aromatyczne śniadanie. Chrupiący boczek łączy się z kremowymi jajkami, dlatego danie jest sycące i wyraziste.

Wskazówki

Jajka w temperaturze pokojowej pozwalają uzyskać delikatniejszą konsystencję. Warto także smażyć je powoli na małym ogniu.

Z czym podawać

Jajecznica dobrze smakuje ze świeżymi warzywami, awokado lub ogórkiem kiszonym. Takie dodatki równoważą wyrazisty smak boczku.

Najczęstsze błędy

Zbyt wysoka temperatura sprawia, że jajecznica staje się sucha i gumowata. Dlatego najlepiej smażyć ją powoli i zdjąć z patelni przed całkowitym ścięciem.`;

  const result = analyze(text, 'text', 'faq-recipe-test');
  assertPublishableFaq(result);

  const mistakes = result.expansionPack.faqSuggestions.find(item => /błędów/i.test(item.question));
  expect(mistakes, 'Missing FAQ item about preparation mistakes');
  expect(!/awokado|ogórkiem|warzywami/i.test(mistakes.answer), 'Serving suggestions leaked into the mistakes answer');
});

test('shows the ready FAQ inside the FAQ warning', () => {
  const text = `Jak bezpiecznie rozpocząć naukę biegania

Początkująca osoba powinna zacząć od spokojnego marszobiegu. Krótsze treningi pozwalają organizmowi stopniowo przyzwyczaić się do wysiłku.

Od czego zacząć

Na początku wystarczą trzy krótkie treningi tygodniowo. Dni odpoczynku pomagają mięśniom i stawom się regenerować.

Jak dobrać tempo

Tempo powinno pozwalać na swobodną rozmowę. Jeśli oddech staje się bardzo szybki, warto zwolnić lub przejść do marszu.

Najczęstsze błędy

Zbyt szybkie zwiększanie dystansu sprzyja przeciążeniom. Dlatego tygodniowy dystans należy zwiększać stopniowo.`;

  const result = analyze(text, 'text', 'faq-warning-test');
  const faqCategory = result.categories.find(category => category.category === 'faq');
  const warning = faqCategory.findings.find(finding => finding.ruleId === 'faq.no-faq');
  expect(warning.fixExample === result.expansionPack.faqText, 'FAQ warning does not show the ready replacement text');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
