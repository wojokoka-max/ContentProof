const fs = require('fs');
const path = require('path');

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const root = path.join(__dirname, '..');
const seoPackPanel = fs.readFileSync(path.join(root, 'components', 'SeoPackPanel.tsx'), 'utf8');
const analysisReport = fs.readFileSync(path.join(root, 'components', 'AnalysisReport.tsx'), 'utf8');

expect(
  seoPackPanel.includes('Custom CSS artykułu'),
  'SEO Pack should expose a separate Custom CSS field.'
);

expect(
  seoPackPanel.includes('Dodaj indywidualny CSS tylko dla tego artykułu.'),
  'Custom CSS field should explain that CSS is article-specific.'
);

expect(
  seoPackPanel.includes('<style id="contentproof-custom-css">'),
  'Custom CSS should be wrapped in a dedicated style tag.'
);

expect(
  seoPackPanel.includes('Sekcja HEAD służy do dodawania metadanych, schema.org, Open Graph, skryptów i kodów SEO. Nie wklejaj tutaj zwykłego CSS artykułu.'),
  'SEO Pack should clearly explain what belongs in HEAD.'
);

expect(
  seoPackPanel.includes('Ten kod wygląda jak CSS. Czy chcesz przenieść go do sekcji Custom CSS?'),
  'SEO Pack should warn when HEAD draft looks like CSS.'
);

expect(
  seoPackPanel.includes('Reguły CSS') && seoPackPanel.includes('Rozmiar'),
  'Custom CSS field should show rule count and code size.'
);

expect(
  !analysisReport.includes("label: 'Kod CSS'") && !analysisReport.includes('CustomCssPanel'),
  'The old standalone CSS tab should not be exposed in AnalysisReport.'
);

expect(
  !fs.existsSync(path.join(root, 'components', 'CustomCssPanel.tsx')),
  'The old CustomCssPanel file should be removed.'
);

console.log('custom CSS workflow regression checks passed');
