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
const {
  enhanceMetaAndFaqWithOpenAI,
  validateEditorialPayload,
} = require(path.join(__dirname, 'openAiEditorialEnhancer.ts'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`  OK ${name}`);
      passed++;
    })
    .catch(error => {
      console.error(`  FAIL ${name}`);
      console.error(`    ${error.message}`);
      failed++;
    });
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function parseJsonLd(jsonLd) {
  return JSON.parse(jsonLd);
}

function faqSchemaCount(jsonLd) {
  const schema = parseJsonLd(jsonLd);
  const graph = Array.isArray(schema['@graph']) ? schema['@graph'] : [schema];
  const faq = graph.find(entity => entity['@type'] === 'FAQPage');
  return Array.isArray(faq?.mainEntity) ? faq.mainEntity.length : 0;
}

const article = `Ciasto truskawkowe na mące orkiszowej

Ciasto truskawkowe na mące orkiszowej ma lekką, wilgotną strukturę, dużą ilość owoców i maślano-waniliowy smak przypominający domowe letnie wypieki, ale bez klasycznego cukru.

Truskawki zawierają dużo wody i naturalne kwasy. Podczas pieczenia mogą puszczać sok, rozmiękczać środek i powodować mokre miejsca w cieście.

Mąka orkiszowa dobrze sprawdza się w takich wypiekach, ponieważ daje bardziej delikatną strukturę, dobrze chłonie wilgoć i ma lekko orzechowy smak.

Alluloza poprawia wilgotność, rumienienie i daje bardziej naturalny smak niż erytrytol. Jogurt oraz masło pomagają uzyskać miękkie, stabilne ciasto.`;

function validPayload() {
  return {
    metaTitle: 'Ciasto truskawkowe na mące orkiszowej bez cukru',
    metaDescription: 'Wilgotne ciasto truskawkowe na mące orkiszowej bez cukru. Sprawdź, jak uniknąć zakalca i uzyskać lekki, maślano-waniliowy wypiek.',
    faqItems: [
      {
        question: 'Dlaczego truskawki mogą powodować zakalec w cieście?',
        answer: 'Truskawki mają dużo wody i podczas pieczenia łatwo puszczają sok. Dlatego mogą rozmiękczyć środek ciasta, zwłaszcza gdy owoce są duże albo zbyt mocno wciśnięte w masę.',
      },
      {
        question: 'Po co używać mąki orkiszowej w cieście z truskawkami?',
        answer: 'Mąka orkiszowa dobrze chłonie wilgoć i daje delikatniejszą strukturę niż klasyczna mąka pszenna. Dzięki temu ciasto pozostaje miękkie, ale łatwiej utrzymuje stabilny środek.',
      },
      {
        question: 'Jaką rolę pełni alluloza w tym wypieku?',
        answer: 'Alluloza poprawia wilgotność i pomaga uzyskać bardziej naturalne rumienienie ciasta. Ma też łagodniejszy smak niż wiele innych słodzików, dlatego dobrze pasuje do truskawek i wanilii.',
      },
    ],
  };
}

test('rejects editorial payload with placeholders or too few FAQ items', () => {
  const rejected = validateEditorialPayload({
    metaTitle: 'Ciasto truskawkowe na mące orkiszowej',
    metaDescription: 'Uzupełnij opis i dopasuj szczegóły do treści artykułu.',
    faqItems: [{
      question: 'Co podać?',
      answer: 'Podaj konkretne przykłady produktów.',
    }],
  }, article, 'pl');

  expect(rejected === null, 'Placeholder payload should be rejected');
});

test('keeps deterministic result when OpenAI key is missing', async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  const result = analyze(article, 'text', 'openai-missing-key');
  const enhanced = await enhanceMetaAndFaqWithOpenAI(result, article, async () => {
    throw new Error('fetch should not run without key');
  });

  expect(enhanced === result, 'Result should be unchanged without OPENAI_API_KEY');

  if (previousKey) process.env.OPENAI_API_KEY = previousKey;
});

test('applies valid OpenAI meta and FAQ to SEO Pack, Fix All and schema', async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';

  const result = analyze(article, 'text', 'openai-valid-payload');
  const payload = validPayload();
  const enhanced = await enhanceMetaAndFaqWithOpenAI(result, article, async () => ({
    ok: true,
    status: 200,
    json: async () => ({ output_text: JSON.stringify(payload) }),
  }));

  expect(enhanced.seoPack.title === payload.metaTitle, `SEO title was not replaced: ${enhanced.seoPack.title}`);
  expect(enhanced.fixAll.metaDescription === payload.metaDescription, 'Fix All meta description was not updated');
  expect(enhanced.expansionPack.faqSuggestions.length === 3, 'Expansion FAQ should have 3 items');
  expect(faqSchemaCount(enhanced.seoPack.jsonLd) === 3, 'Schema should contain 3 FAQ items');
  expect(enhanced.seoPack.canonical.includes('/ciasto-truskawkowe-na-mace-orkiszowej'), `Canonical should stay title-based: ${enhanced.seoPack.canonical}`);

  if (previousKey) process.env.OPENAI_API_KEY = previousKey;
  else delete process.env.OPENAI_API_KEY;
});

test('rejects OpenAI response that copies a procedure fragment as FAQ answer', async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';

  const result = analyze(article, 'text', 'openai-bad-procedure');
  const bad = validPayload();
  bad.faqItems[1].answer = 'Rozgrzej piekarnik do 175°C i przełóż ciasto do formy. Piecz około 40 minut, aż wierzch będzie złoty.';

  const enhanced = await enhanceMetaAndFaqWithOpenAI(result, article, async () => ({
    ok: true,
    status: 200,
    json: async () => ({ output_text: JSON.stringify(bad) }),
  }));

  expect(enhanced === result, 'Bad procedure-like FAQ should be rejected');

  if (previousKey) process.env.OPENAI_API_KEY = previousKey;
  else delete process.env.OPENAI_API_KEY;
});

setTimeout(() => {
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}, 0);
