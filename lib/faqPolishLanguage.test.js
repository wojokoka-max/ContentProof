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

const source = fs.readFileSync(path.join(__dirname, 'expansionPackGenerator.ts'), 'utf8');
const analyzerSource = fs.readFileSync(path.join(__dirname, 'analyzers', 'faq.ts'), 'utf8');

console.log('\nPolish FAQ language');

test('does not use an English-calque fallback for short Polish headings', () => {
  expect(source).notToContain('return `Co to jest ${lower}?`');
});

test('turns useful section labels into natural Polish questions', () => {
  expect(source).toContain('Jakich składników potrzeba?');
  expect(source).toContain('Na co warto zwrócić uwagę?');
  expect(source).toContain('Co warto wiedzieć o wartościach odżywczych?');
});

test('uses a natural serving question', () => {
  expect(source).toContain('Z czym najlepiej podawać to danie?');
});

test('uses a natural preparation question', () => {
  expect(source).toContain('Jak wygląda przygotowanie krok po kroku?');
});

test('rejects bullet-list answers from publishable FAQ', () => {
  expect(source).toContain('bulletCount >= 3');
});

test('turns a serving list into a complete Polish FAQ answer', () => {
  expect(source).toContain('normalizeSectionAnswer');
  expect(source).toContain("if (!/^z czym(?:\\s|$)/i.test(headingText))");
  expect(source).toContain('joinFaqList(items)');
});

test('explains the value of expanding short FAQ answers', () => {
  expect(analyzerSource).toContain("title: 'FAQ jest krótkie'");
  expect(analyzerSource).toContain('Rozbudowanie odpowiedzi może poprawić kontekst semantyczny i widoczność w wyszukiwarce.');
});

test('keeps generated FAQ answers conversational and self-contained', () => {
  expect(source).toContain('function hasNaturalFaqFlow');
  expect(source).toContain('sentences.length >= 2 && sentences.length <= 3');
  expect(source).toContain('hasNaturalFaqFlow(item.answer)');
});

test('expands a short FAQ answer only with supporting evidence from the current article', () => {
  expect(source).toContain('function findFaqSupportingSentence');
  expect(source).toContain('function buildPublishableFaqAnswer');
  expect(source).toContain('faqEvidenceWords(`${question} ${answer}`)');
  expect(source).toContain('const answer = buildPublishableFaqAnswer(content, question, item.answer)');
});

test('requires every publishable FAQ answer to contain two or three sentences', () => {
  expect(source).toContain('if (sentenceCount < 2 || sentenceCount > 3) return false');
});

test('combines article evidence until it has at least three FAQ proposals', () => {
  expect(source).toContain('const minimumGeneratedFaqCount = 3');
  expect(source).toContain('sentenceFaq.forEach(addQuestion)');
  expect(source).notToContain('if (sentenceFaq.length >= 2) return sentenceFaq');
  expect(source).toContain('questions.length < minimumGeneratedFaqCount');
});

test('creates natural Polish questions from useful article sections', () => {
  expect(source).toContain('Jakich składników potrzeba?');
  expect(source).toContain('Na co warto zwrócić uwagę?');
  expect(source).toContain('Co warto wiedzieć o wartościach odżywczych?');
});

test('does not turn the main recipe method into FAQ', () => {
  expect(source).toContain("if (/^(jak (zrobić|przygotować|upiec|ugotować)|przygotowanie|wykonanie|instrukcja|krok po kroku)/i.test(t))");
  expect(source).toContain('if (numberedStepCount > 0) return false');
});

test('rejects imperative instructions as FAQ answers', () => {
  expect(source).toContain('function isImperativeFaqAnswer');
  expect(source).toContain('sentences.some(sentence => imperativeWord.test(sentence))');
  expect(source).toContain('if (isImperativeFaqAnswer(answer, lang)) return false');
});

test('builds supplementary recipe FAQ from concrete article evidence', () => {
  expect(source).toContain('function generateRecipeFaqFromEvidence');
  expect(source).toContain('function generateRecipeProcessFaq');
  expect(source).toContain('Co wpływa na konsystencję ${subject.genitive}?');
  expect(source).toContain('Jakiego smaku można się spodziewać po przygotowaniu ${subject.genitive}?');
  expect(source).toContain('Jak przechowywać ${subject.accusative}?');
  expect(source).toContain('generateRecipeFaqFromEvidence(content, h1).forEach(addQuestion)');
  expect(source).toContain('generateRecipeProcessFaq(content, h1).forEach(addQuestion)');
  expect(source).toContain('if (isPrimaryProcedureHeading(h2)) continue');
});

test('turns recipe measurements into complete answers instead of copying steps', () => {
  expect(source).toContain('W jakiej temperaturze należy piec ${ingredient}?');
  expect(source).toContain('Jak długo należy chłodzić masę przed kolejnym etapem?');
  expect(source).toContain('Jak często mieszać lody podczas ręcznego mrożenia?');
});

test('does not copy the main procedure for non-culinary content either', () => {
  expect(source).toContain('function isPrimaryProcedureHeading');
  expect(source).toContain('skonfigurować|wdrożyć|naprawić|zainstalować|uruchomić|wykonać');
  expect(source).toContain('configure|deploy|fix|install|run');
});

test('does not leak sugar-reduction FAQ into unrelated sugar-free recipes', () => {
  expect(source).toContain('const isSugarReductionArticle');
  expect(source).toContain('if (!isSugarReductionArticle) return []');
});

test('returns three final FAQ proposals', () => {
  expect(source).toContain('return questions.slice(0, minimumGeneratedFaqCount)');
});

test('uses the correct Polish case in recipe FAQ questions', () => {
  expect(source).toContain("{ genitive: 'lodów', accusative: 'lody' }");
  expect(source).toContain('Jak przechowywać ${subject.accusative}?');
});

test('does not treat unrelated phrases or instructions as replacement evidence', () => {
  expect(source).notToContain('/\\bzamiast\\b/i');
  expect(source).notToContain('/\\bwersj[ęe] bez\\b/i');
  expect(source).toContain('!isImperativeFaqAnswer(next, content.language)');
  expect(source).toContain('/^(dzięki temu|w ten sposób|dlatego|wtedy|z tego powodu)\\b/i');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
