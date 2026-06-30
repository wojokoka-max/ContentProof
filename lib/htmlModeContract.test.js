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

function graphEntities(jsonLd) {
  const schema = parseJsonLd(jsonLd);
  return Array.isArray(schema['@graph']) ? schema['@graph'] : [schema];
}

function faqSchemaCount(jsonLd) {
  const faq = graphEntities(jsonLd).find(entity => entity['@type'] === 'FAQPage');
  return Array.isArray(faq?.mainEntity) ? faq.mainEntity.length : 0;
}

function articleSchema(jsonLd) {
  return graphEntities(jsonLd).find(entity => ['Article', 'BlogPosting'].includes(entity['@type']));
}

function sentenceCount(text) {
  return text.split(/(?<=[.!?…])\s+/).map(sentence => sentence.trim()).filter(Boolean).length;
}

const fullHtmlDocument = `<!doctype html>
<html lang="pl">
  <head>
    <title>Jajecznica z boczkiem - prosty przepis</title>
    <meta name="description" content="Jajecznica z boczkiem to szybkie i sycace sniadanie z kremowymi jajkami, chrupiacym boczkiem i prostymi dodatkami.">
    <link rel="canonical" href="https://example.com/jajecznica-z-boczkiem">
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "Jajecznica z boczkiem - prosty przepis",
      "description": "Jajecznica z boczkiem to szybkie i sycace sniadanie z kremowymi jajkami, chrupiacym boczkiem i prostymi dodatkami.",
      "url": "https://example.com/jajecznica-z-boczkiem"
    }
    </script>
  </head>
  <body>
    <nav>Menu strony</nav>
    <article>
      <h1>Jajecznica z boczkiem - prosty i sycacy przepis</h1>
      <p>Jajecznica z boczkiem to klasyczne sniadanie, ktore jest szybkie do przygotowania, aromatyczne i bardzo sycace.</p>
      <h2>Wskazowki</h2>
      <p>Jajka w temperaturze pokojowej pozwalaja uzyskac delikatniejsza konsystencje. Warto smazyc je powoli na malym ogniu, poniewaz wtedy jajecznica nie robi sie sucha.</p>
      <h2>Z czym podawac</h2>
      <ul>
        <li>swiezymi warzywami</li>
        <li>ogorkiem kiszonym</li>
        <li>awokado</li>
      </ul>
      <h2>FAQ</h2>
      <h3>Czy boczek trzeba mocno podsmazyc?</h3>
      <p>Nie, boczek powinien byc chrupiacy, ale nie spalony. Zbyt dlugie smazenie daje gorzki smak i psuje delikatnosc jajek.</p>
      <h3>Czy jajecznice lepiej smazyc na malym ogniu?</h3>
      <p>Tak, maly ogien pomaga zachowac kremowa konsystencje. Dzieki temu jajka scinaja sie powoli i nie robia sie suche.</p>
      <h3>Z czym podac jajecznice z boczkiem?</h3>
      <p>Dobrze pasuja swieze warzywa, ogorek kiszony albo awokado. Takie dodatki rownowaza tlustosc boczku i odswiezaja smak.</p>
    </article>
    <footer>Stopka strony</footer>
  </body>
</html>`;

const htmlFragment = `<article>
  <h1>Prosty poradnik publikacji artykulu</h1>
  <p>Dobry artykul powinien miec jasny temat, logiczna strukture i konkretne odpowiedzi na pytania czytelnika.</p>
  <h2>Najwazniejsze elementy</h2>
  <p>Najpierw warto uporzadkowac naglowki, a potem sprawdzic, czy kazda sekcja wnosi nowa informacje. Dzieki temu tekst jest latwiejszy do czytania i lepiej odpowiada na intencje wyszukiwania.</p>
  <h2>FAQ</h2>
  <h3>Czy artykul musi miec FAQ?</h3>
  <p>Nie zawsze, ale FAQ pomaga dopowiedziec kwestie, ktore nie zmiescily sie w glownych sekcjach. Dobre pytania moga tez wzmacniac kontekst semantyczny tekstu.</p>
  <h3>Ile pytan FAQ wystarczy?</h3>
  <p>Najczesciej wystarcza kilka konkretnych pytan opartych na tresci artykulu. Lepiej dodac trzy dobre odpowiedzi niz dluga liste ogolnikow.</p>
  <h3>Czy FAQ powinno powtarzac artykul?</h3>
  <p>Nie, FAQ powinno uzupelniac artykul i porzadkowac najwazniejsze watpliwosci. Odpowiedzi musza byc gotowe do publikacji.</p>
</article>`;

const htmlGuideWithoutFaq = `<article>
  <header>
    <h1>Jak zaczac spokojniej korzystac z internetu?</h1>
    <p>Internet moze inspirowac, uczyc i pomagac w pracy. Moze tez meczyc, rozpraszac i zabierac wiecej energii, niz powinien.</p>
  </header>
  <section>
    <h2>1. Zrob porzadek z powiadomieniami</h2>
    <p>Nie kazda aplikacja musi natychmiast domagac sie Twojej uwagi. Wylacz powiadomienia, ktore nie sa naprawde potrzebne, bo to zmniejsza liczbe przerw w ciagu dnia.</p>
  </section>
  <section>
    <h2>2. Wybieraj miejsca, ktore dobrze na Ciebie dzialaja</h2>
    <p>Obserwuj, po ktorych stronach i aplikacjach czujesz sie spokojniej, a po ktorych bardziej zmeczona. Taka prosta obserwacja pomaga lepiej dobrac zrodla informacji i rozrywki.</p>
  </section>
  <section>
    <h2>3. Nie musisz reagowac od razu</h2>
    <p>Wiadomosc, komentarz czy powiadomienie nie zawsze wymagaja natychmiastowej odpowiedzi. Daj sobie czas na spokojna reakcje, poniewaz wtedy latwiej zachowac uwage i dystans.</p>
  </section>
</article>`;

console.log('\nHTML mode contract');

test('complete HTML document keeps detected head metadata and article canonical', () => {
  const result = analyze(fullHtmlDocument, 'html', 'html-contract-document');
  const article = articleSchema(result.seoPack.jsonLd);

  expect(result.meta.analysisMode === 'html', `Expected html analysis mode, got ${result.meta.analysisMode}`);
  expect(result.meta.inputType === 'html', `Expected html input type, got ${result.meta.inputType}`);
  expect(result.meta.htmlScope === 'document', `Expected document scope, got ${result.meta.htmlScope}`);
  expect(result.seoPack.title === 'Jajecznica z boczkiem - prosty przepis', `Wrong HTML title: ${result.seoPack.title}`);
  expect(result.seoPack.metaDescription.includes('szybkie i sycace sniadanie'), `Wrong HTML description: ${result.seoPack.metaDescription}`);
  expect(result.seoPack.canonical === 'https://example.com/jajecznica-z-boczkiem', `Wrong canonical: ${result.seoPack.canonical}`);
  expect(article?.url === 'https://example.com/jajecznica-z-boczkiem', 'Schema should use the detected HTML canonical URL');
});

test('HTML FAQ is preserved as three ready answers and included in schema', () => {
  const result = analyze(fullHtmlDocument, 'html', 'html-contract-faq');

  expect(result.expansionPack.faqSuggestions.length === 3, `Expected 3 FAQ items, got ${result.expansionPack.faqSuggestions.length}`);
  expect(faqSchemaCount(result.seoPack.jsonLd) === 3, `Expected 3 FAQ schema items, got ${faqSchemaCount(result.seoPack.jsonLd)}`);
  expect(result.seoPack.jsonLd.includes('"@type": "FAQPage"'), 'FAQPage schema is missing');

  for (const item of result.expansionPack.faqSuggestions) {
    expect(item.question.endsWith('?'), `FAQ question is not ready to publish: ${item.question}`);
    const count = sentenceCount(item.answer);
    expect(count >= 2 && count <= 3, `FAQ answer must have 2-3 sentences: ${item.answer}`);
  }
});

test('HTML fragment is analyzed as content without requiring head metadata', () => {
  const result = analyze(htmlFragment, 'html', 'html-contract-fragment');

  expect(result.meta.htmlScope === 'fragment', `Expected fragment scope, got ${result.meta.htmlScope}`);
  expect(result.meta.detectedH1 === 'Prosty poradnik publikacji artykulu', `Wrong fragment H1: ${result.meta.detectedH1}`);
  expect(result.expansionPack.faqSuggestions.length === 3, `Expected 3 fragment FAQ items, got ${result.expansionPack.faqSuggestions.length}`);
  expect(faqSchemaCount(result.seoPack.jsonLd) === 3, 'Fragment FAQ should still be included in generated schema');
});

test('HTML guide without explicit FAQ still gets three article-based FAQ items in schema', () => {
  const result = analyze(htmlGuideWithoutFaq, 'html', 'html-contract-generated-faq');

  expect(result.expansionPack.faqSuggestions.length === 3, `Expected 3 generated FAQ items, got ${result.expansionPack.faqSuggestions.length}`);
  expect(faqSchemaCount(result.seoPack.jsonLd) === 3, `Expected 3 generated FAQ schema items, got ${faqSchemaCount(result.seoPack.jsonLd)}`);

  for (const item of result.expansionPack.faqSuggestions) {
    expect(item.question.endsWith('?'), `FAQ question is not ready to publish: ${item.question}`);
    expect(!/zrob porzadek z zrob porzadek/i.test(item.question), `FAQ question repeats the source heading: ${item.question}`);
    expect(sentenceCount(item.answer) >= 2, `FAQ answer should be developed, got: ${item.answer}`);
  }
});

test('HTML mode does not leak placeholders or technical instructions into creator-facing output', () => {
  const result = analyze(fullHtmlDocument, 'html', 'html-contract-clean-output');
  const output = [
    result.seoPack.title,
    result.seoPack.metaDescription,
    result.expansionPack.faqText,
    result.fixAll.faqText,
    result.seoPack.jsonLd,
  ].join('\n').toLowerCase();

  for (const forbidden of ['brakujaca sekcja', 'dopasuj', 'uzupelnij', 'wymien', 'podaj konkretne', '<details', '<summary']) {
    expect(!output.includes(forbidden), `HTML mode leaked forbidden placeholder/instruction: ${forbidden}`);
  }
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
