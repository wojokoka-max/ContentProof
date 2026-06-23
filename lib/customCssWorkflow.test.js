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
const engine = fs.readFileSync(path.join(root, 'lib', 'engine.ts'), 'utf8');

expect(
  seoPackPanel.includes('Ustawienia zaawansowane SEO'),
  'SEO Pack should keep specialist options under advanced SEO settings.'
);

expect(
  seoPackPanel.includes('Open Graph') &&
    seoPackPanel.includes('Twitter Card') &&
    seoPackPanel.includes('Robots') &&
    seoPackPanel.includes('JSON-LD Schema'),
  'Advanced SEO settings should keep Open Graph, Twitter Card, robots and schema.'
);

expect(
  !seoPackPanel.includes('Custom CSS artyku') &&
    !seoPackPanel.includes('contentproof-custom-css') &&
    !seoPackPanel.includes('CodeWorkflowPanel'),
  'SEO Pack should not expose the removed HEAD and Custom CSS workflow.'
);

expect(
  !analysisReport.includes("label: 'Kod CSS'") && !analysisReport.includes('CustomCssPanel'),
  'The old standalone CSS tab should not be exposed in AnalysisReport.'
);

expect(
  !fs.existsSync(path.join(root, 'components', 'CustomCssPanel.tsx')),
  'The old CustomCssPanel file should be removed.'
);

expect(
  engine.includes('Math.max(currentScore, Math.min(100, currentScore + totalImpact))'),
  'Fix All prediction should improve up to 100 and must never lower the current score.'
);

console.log('advanced SEO workflow regression checks passed');
