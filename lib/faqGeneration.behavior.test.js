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

function assertThreeFaqForMode(raw, mode, label) {
  const result = analyze(raw, mode, `faq-${label}-test`, undefined, 'https://example.com/artykul-testowy');
  assertPublishableFaq(result);
  expect(result.expansionPack.faqText.split('\n\n').length === 3, `${label}: FAQ text should contain exactly 3 items`);
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

test('expands a short existing FAQ into three publishable items', () => {
  const html = `<article>
    <h1>Jak przygotowac lokalna strone uslugowa pod SEO?</h1>
    <p>Lokalna strona uslugowa powinna od razu pokazac, czym zajmuje sie firma, gdzie dziala i jak mozna sie z nia skontaktowac. Uzytkownik porownuje kilka podobnych firm, dlatego potrzebuje konkretow bez szukania ich w calej witrynie.</p>
    <h2>Najwazniejsze elementy</h2>
    <p>Najwazniejsze sa opis uslugi, obslugiwany obszar, dane kontaktowe, opinie klientow i jasne wezwanie do kontaktu. Taki zestaw pomaga klientowi szybko ocenic, czy firma pasuje do jego potrzeby.</p>
    <h2>Najczestsze bledy</h2>
    <p>Czestym bledem jest ogolnikowy opis bez lokalizacji, zakresu uslugi i konkretnej korzysci dla klienta. Problemem bywa takze ukryty numer telefonu albo kilka podstron z prawie taka sama trescia.</p>
    <h2>Wskazowki</h2>
    <p>Warto pisac prostym jezykiem i odpowiadac na pytania, ktore klient zadaje przed pierwszym kontaktem. Pomagaja krotkie akapity, lokalne przyklady i widoczne dane kontaktowe.</p>
    <h2>FAQ</h2>
    <h3>Czy warto dodac numer telefonu?</h3>
    <p>Tak, poniewaz numer telefonu skraca droge do kontaktu. Klient nie musi wtedy szukac danych w kilku miejscach i szybciej podejmuje decyzje.</p>
  </article>`;

  assertThreeFaqForMode(html, 'html', 'html-short-existing-faq');
});

test('existing single FAQ item is completed to three ready FAQ items', () => {
  const html = `<article>
    <h1>Ciasto truskawkowe na mace orkiszowej</h1>
    <p>Ciasto truskawkowe na mace orkiszowej ma lekka, wilgotna strukture, duza ilosc owocow i maslano-waniliowy smak przypominajacy domowe letnie wypieki bez klasycznego cukru.</p>
    <h2>Dlaczego ciasta z truskawkami bywaja trudne?</h2>
    <p>Truskawki zawieraja duzo wody, naturalne kwasy i miekki miazsz. Podczas pieczenia czesto puszczaja sok, rozmiekczaja srodek i powoduja mokre miejsca w ciescie.</p>
    <h2>Najwazniejsze</h2>
    <p>Najlepiej uzywac malych, aromatycznych truskawek, bo oddaja mniej wody i maja wyrazniejszy smak. Wanilia lagodzi kwasowosc owocow, a jogurt poprawia wilgotnosc ciasta.</p>
    <h2>Jak zmienic skladniki</h2>
    <p>Czesc masla mozna zastapic jogurtem, jesli ciasto ma byc lżejsze. Jogurt grecki daje bardziej kremowy srodek, a czesc truskawek mozna wymienic na maliny.</p>
    <h2>FAQ</h2>
    <h3>Czy mozna uzyc mrożonych truskawek?</h3>
    <p>Tak, ale trzeba je dobrze odsaczyc, poniewaz nadmiar wody moze rozmiekczyc ciasto.</p>
  </article>`;

  const result = analyze(html, 'html', 'faq-single-existing-item-test');
  assertPublishableFaq(result);
  expect(result.expansionPack.faqSuggestions.length === 3, 'Existing FAQ must be completed to exactly 3 items');
  expect(result.expansionPack.faqText.split('\n\n').length === 3, 'Ready FAQ text must contain 3 copyable items');
});

test('creates three FAQ items for HTML without an existing FAQ section', () => {
  const html = `<article>
    <h1>Jak przygotowac lokalna strone uslugowa pod SEO?</h1>
    <p>Lokalna strona uslugowa powinna jasno pokazywac, co firma robi, gdzie dziala i jak klient moze sie skontaktowac. Najwazniejsze informacje musza byc widoczne od razu, poniewaz uzytkownik zwykle porownuje kilka podobnych firm.</p>
    <h2>Najwazniejsze elementy</h2>
    <p>Strona powinna zawierac konkretny opis uslugi, obslugiwany obszar, dane kontaktowe i opinie klientow. Taki zestaw pomaga zarowno uzytkownikowi, jak i wyszukiwarce szybciej zrozumiec temat strony.</p>
    <h2>Najczestsze bledy</h2>
    <p>Najwiekszym bledem jest ogolnikowy opis, ktory nie pokazuje lokalizacji ani zakresu uslugi. Problemem jest takze ukryty numer telefonu, brak jasnego wezwania do kontaktu i powtarzanie tej samej tresci na wielu podstronach.</p>
    <h2>Wskazowki</h2>
    <p>Warto pisac prostym jezykiem i uzywac nazw miejscowosci tam, gdzie sa naturalnie potrzebne. Dobrze dziala rowniez krotka sekcja z odpowiedziami na pytania klientow przed pierwszym kontaktem.</p>
  </article>`;

  assertThreeFaqForMode(html, 'html', 'html-without-faq');
});

test('creates three FAQ items for URL mode without an existing FAQ section', () => {
  const html = `<!doctype html>
  <html lang="pl">
    <head>
      <title>Jak przygotowac lokalna strone uslugowa pod SEO?</title>
      <link rel="canonical" href="https://example.com/lokalna-strona-uslugowa-seo">
    </head>
    <body>
      <main>
        <article>
          <h1>Jak przygotowac lokalna strone uslugowa pod SEO?</h1>
          <p>Lokalna strona uslugowa powinna jasno pokazywac, co firma robi, gdzie dziala i jak klient moze sie skontaktowac. Najwazniejsze informacje musza byc widoczne od razu, poniewaz uzytkownik zwykle porownuje kilka podobnych firm.</p>
          <h2>Najwazniejsze elementy</h2>
          <p>Strona powinna zawierac konkretny opis uslugi, obslugiwany obszar, dane kontaktowe i opinie klientow. Taki zestaw pomaga zarowno uzytkownikowi, jak i wyszukiwarce szybciej zrozumiec temat strony.</p>
          <h2>Najczestsze bledy</h2>
          <p>Najwiekszym bledem jest ogolnikowy opis, ktory nie pokazuje lokalizacji ani zakresu uslugi. Problemem jest takze ukryty numer telefonu, brak jasnego wezwania do kontaktu i powtarzanie tej samej tresci na wielu podstronach.</p>
          <h2>Wskazowki</h2>
          <p>Warto pisac prostym jezykiem i uzywac nazw miejscowosci tam, gdzie sa naturalnie potrzebne. Dobrze dziala rowniez krotka sekcja z odpowiedziami na pytania klientow przed pierwszym kontaktem.</p>
        </article>
      </main>
    </body>
  </html>`;

  assertThreeFaqForMode(html, 'url', 'url-without-faq');
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
  expect(mistakes || result.expansionPack.faqSuggestions.some(item => /b.{0,8}d/i.test(item.question)), 'Missing FAQ item about preparation mistakes');
  const mistakeAnswer = mistakes?.answer ?? result.expansionPack.faqSuggestions.find(item => /b.{0,8}d/i.test(item.question))?.answer ?? '';
  expect(!/awokado|ogorkiem|ogĂłrkiem|warzywami/i.test(mistakeAnswer), 'Serving suggestions leaked into the mistakes answer');
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

test('plain recipe text without FAQ still gets three publishable FAQ items in schema', () => {
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
- maslo daje bardziej maslany smak.

Jak zmienic skladniki

- czesc masla mozna zastapic jogurtem,
- jogurt grecki daje bardziej kremowy srodek,
- czesc truskawek mozna wymienic na maliny,
- alluloze mozna zastapic erytrytolem.

Kiedy sprawdza sie najlepiej?

- latem,
- do kawy,
- na weekend,
- jako lekkie ciasto sniadaniowe.`;

  const result = analyze(text, 'text', 'faq-spelt-cake-test');
  assertPublishableFaq(result);
  expect(result.expansionPack.faqSuggestions.length === 3, 'Expected exactly 3 FAQ suggestions');
  expect(result.seoPack.jsonLd.includes('"@type": "FAQPage"'), 'Generated FAQ is missing from schema');
});

test('short existing plain-text FAQ is expanded to three publishable items', () => {
  const text = `Mrozony napoj rabarbarowo-hibiskusowy low carb

Mrozony napoj rabarbarowo-hibiskusowy low carb ma intensywnie rubinowy kolor, lekko owocowy smak i delikatnie winny aromat, przypominajacy letnie napoje z restauracji premium.

W tym artykule znajdziesz

- jak polaczyc rabarbar z hibiskusem,
- dlaczego hibiskus swietnie podbija kolor,
- jak zrobic wersje bardziej owocowa,
- czym dosladzac napoje na bazie hibiskusa,
- jak uzyskac efekt granity.

Skladniki

- 400 g rabarbaru
- 700 ml wody
- 2 lyzki hibiskusa
- 50-70 g allulozy
- garsc malin
- sok z 1/2 limonki
- duzo lodu
- mieta

Jak zrobic

1. Zagotuj wode z hibiskusem.
2. Dodaj rabarbar i gotuj okolo 10 minut.
3. Dodaj maliny i slodzik.
4. Przecedz i schlodz.
5. Zblenduj z lodem.

Jak zmienic skladniki

- maliny mozna zastapic porzeczka,
- limonke cytryna,
- hibiskus mozna zrobic mocniejszy dla bardziej winnego efektu.

Kiedy sprawdza sie najlepiej

- w upalne dni,
- jako granita low carb,
- do letnich rolek i zdjec.

FAQ

Czy hibiskus jest bardzo kwasny?

Tak, dlatego warto polaczyc go z alluloza lub malinami.

Czy mozna zrobic wersje gazowana?

Tak, po schlodzeniu mozna dodac wode gazowana.

Czy napoj mozna zamrozic?

Tak. Swietnie sprawdza sie jako granita.`;

  const result = analyze(text, 'text', 'faq-short-beverage-test');
  assertPublishableFaq(result);
  expect(result.expansionPack.faqSuggestions.length === 3, 'Short existing FAQ must be completed to exactly 3 items');
  expect(result.expansionPack.faqText.split('\n\n').length === 3, 'Ready FAQ text must contain 3 copyable items');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
