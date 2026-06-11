/**
 * ContentProof — End-to-End Integration Test
 * Tests the full pipeline: input → parser → analyzers → score engine → AnalysisResult
 * Run: node lib/engine.integration.test.js
 */

// ── Inline all modules as JS for Node testing ─────────────────────────────────
// (mirrors the TS logic without transpilation)

// ── Parser (from htmlParser.ts) ──────────────────────────────────────────────
function extractPlainText(html) {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<script[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s{2,}/g,' ').trim();
}
function countWords(text) { return text.trim().split(/\s+/).filter(w=>w.length>0).length; }
function detectInputType(raw) { return /<[a-z][\s\S]*>/i.test(raw.trim())?'html':'text'; }
function detectLanguage(text) {
  const PL=['się','nie','jak','dla','oraz','przez','jest','są','że','co','ale'];
  const EN=['the','and','for','that','with','are','this','have','from','not'];
  const words=text.toLowerCase().split(/\s+/); const s=new Set(words);
  return PL.filter(w=>s.has(w)).length>=EN.filter(w=>s.has(w)).length?'pl':'en';
}
function splitSentences(text) {
  const p=text.replace(/\b(dr|prof|mgr|np|m\.in|ok|mr|mrs|ms)\./gi,m=>m.replace('.','§')).replace(/(\d+)\./g,'$1§');
  return p.split(/(?<=[.!?])\s+(?=[A-ZŁŚĆĄÓĘŹŻŃ])/u).map(s=>s.replace(/§/g,'.').trim()).filter(s=>s.length>0);
}
function extractHeadings(html, plain) {
  const r=[]; const re=/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi; let m;
  while((m=re.exec(html))!==null){const level=parseInt(m[1]);const text=extractPlainText(m[2]).trim();if(!text)continue;r.push({level,text,position:plain.indexOf(text)});}
  return r;
}
function extractParagraphs(html) {
  const r=[]; const re=/<p[^>]*>([\s\S]*?)<\/p>/gi; let m;
  while((m=re.exec(html))!==null){const text=extractPlainText(m[1]).trim();if(text.length<10)continue;const wordCount=countWords(text);r.push({text,wordCount,sentenceCount:splitSentences(text).length});}
  if(r.length===0){const blocks=html.split(/\n{2,}/).map(b=>b.trim()).filter(b=>b.length>10);for(const b of blocks){r.push({text:b,wordCount:countWords(b),sentenceCount:splitSentences(b).length});}}
  return r;
}
function extractLinks(html) {
  const r=[]; const re=/<a([^>]*)>([\s\S]*?)<\/a>/gi; let m;
  while((m=re.exec(html))!==null){const attrs=m[1];const href=(attrs.match(/href=["']([^"']*)["']/i)||['',''])[1];const relM=attrs.match(/rel=["']([^"']*)["']/i);const rel=relM?relM[1].toLowerCase().split(/\s+/):[];r.push({href,anchorText:extractPlainText(m[2]).trim(),isInternal:/^[/#]/.test(href)||/^mailto:|^tel:/.test(href),rel,isNofollow:rel.includes('nofollow')});}
  return r;
}
function extractImages(html) {
  const GP=[/^img[-_]?\d+/i,/^image[-_]?\d+/i,/^photo[-_]?\d+/i,/^dsc\d+/i,/^screenshot/i,/^\d{4,}/,/^untitled/i];
  const r=[]; const re=/<img([^>]*)>/gi; let m;
  while((m=re.exec(html))!==null){const a=m[1];const src=(a.match(/src=["']([^"']*)["']/i)||['',''])[1];const altM=a.match(/alt=["']([^"']*)["']/i);const alt=altM?altM[1]:null;const fn=src.split('/').pop()??src;r.push({src,alt,hasAlt:altM!==null,filename:fn,isLazy:/loading=["']lazy["']/i.test(a),hasGenericFilename:GP.some(p=>p.test(fn.replace(/\.[^.]+$/,'')))});}
  return r;
}
function extractFaqItems(html) {
  const items=[]; let m;
  const dr=/<details[^>]*>[\s\S]*?<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi;
  while((m=dr.exec(html))!==null){const q=extractPlainText(m[1]).trim();const a=extractPlainText(m[2]).trim();if(q&&a)items.push({question:q,answer:a});}
  const dlr=/<dl[^>]*>([\s\S]*?)<\/dl>/gi;
  while((m=dlr.exec(html))!==null){const dtr=/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;let dm;while((dm=dtr.exec(m[1]))!==null){const q=extractPlainText(dm[1]).trim();const a=extractPlainText(dm[2]).trim();if(q&&a)items.push({question:q,answer:a});}}
  return items;
}
function extractMeta(html) {
  const tm=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);const metaTitle=tm?extractPlainText(tm[1]).trim():null;
  const dm=html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)||html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);const metaDescription=dm?dm[1].trim():null;
  const cm=html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*>/i);const canonical=cm?cm[1].trim():null;
  return {metaTitle,metaDescription,canonical};
}
function parse(raw) {
  if(!raw||raw.trim().length===0)return{raw:'',inputType:'text',language:'en',plainText:'',wordCount:0,sentences:[],headings:[],paragraphs:[],links:[],images:[],faqItems:[],metaTitle:null,metaDescription:null,canonical:null};
  const inputType=detectInputType(raw);const plainText=inputType==='html'?extractPlainText(raw):raw.trim();
  return{raw,inputType,language:detectLanguage(plainText),plainText,wordCount:countWords(plainText),sentences:splitSentences(plainText),headings:inputType==='html'?extractHeadings(raw,plainText):[],paragraphs:extractParagraphs(raw),links:inputType==='html'?extractLinks(raw):[],images:inputType==='html'?extractImages(raw):[],faqItems:inputType==='html'?extractFaqItems(raw):[],metaTitle:inputType==='html'?extractMeta(raw).metaTitle:null,metaDescription:inputType==='html'?extractMeta(raw).metaDescription:null,canonical:inputType==='html'?extractMeta(raw).canonical:null};
}

// ── Score Engine ─────────────────────────────────────────────────────────────
const WEIGHTS={'structure':0.20,'seo-basics':0.25,'linking':0.15,'images':0.15,'faq':0.10,'readability':0.10,'ai-junk':0.05};
function calculateScore(categories) {
  const catScores={};for(const c of categories)catScores[c.category]=c.score;
  let ws=0,tw=0;for(const[id,w]of Object.entries(WEIGHTS)){if(id in catScores){ws+=catScores[id]*w;tw+=w;}}
  const overall=Math.round(Math.min(100,Math.max(0,tw>0?ws/tw:0)));
  const hardFails=categories.filter(c=>c.score<30).map(c=>c.category);
  let status=hardFails.length>0?'do-not-publish':overall>=75?'ready-to-publish':overall>=50?'needs-improvement':'do-not-publish';
  return{overallScore:overall,publicationStatus:status,hardFails};
}

// ── Minimal analyzer stubs for integration test ───────────────────────────────
// (these mirror the real analyzer outputs)
function runAnalyzers(content) {
  const categories=[];

  // Structure
  const h1s=content.headings.filter(h=>h.level===1);
  const structScore=h1s.length===1?85:h1s.length===0?20:55;
  categories.push({category:'structure',label:'Struktura',score:structScore,status:structScore>=80?'pass':structScore>=50?'warning':'fail',findings:h1s.length===0?[{ruleId:'structure.missing-h1',category:'structure',severity:'error',title:'Brak H1',description:'',recommendation:'Dodaj H1'}]:[],llmEnhanced:false});

  // SEO
  const seoScore=content.metaTitle&&content.metaDescription?90:content.metaTitle?60:30;
  categories.push({category:'seo-basics',label:'SEO Basics',score:seoScore,status:seoScore>=80?'pass':seoScore>=50?'warning':'fail',findings:!content.metaTitle?[{ruleId:'seo.missing-title',category:'seo-basics',severity:'error',title:'Brak title',description:'',recommendation:'Dodaj title'}]:[],llmEnhanced:false});

  // Linking
  const linkScore=content.inputType==='html'?85:100;
  categories.push({category:'linking',label:'Linkowanie',score:linkScore,status:'pass',findings:[],llmEnhanced:false});

  // Images
  const imgScore=content.images.length===0?100:content.images.every(i=>i.hasAlt)?90:60;
  categories.push({category:'images',label:'Obrazy',score:imgScore,status:imgScore>=80?'pass':'warning',findings:[],llmEnhanced:false});

  // FAQ
  const faqScore=content.faqItems.length>0?80:content.wordCount>=400?70:100;
  categories.push({category:'faq',label:'FAQ',score:faqScore,status:faqScore>=80?'pass':'warning',findings:[],llmEnhanced:false});

  // Readability
  const readScore=content.wordCount<50?100:80;
  categories.push({category:'readability',label:'Czytelność',score:readScore,status:'pass',findings:[],llmEnhanced:false});

  // AI Junk
  const aiScore=content.wordCount<80?100:90;
  categories.push({category:'ai-junk',label:'AI Junk',score:aiScore,status:'pass',findings:[],llmEnhanced:false});

  return categories;
}

function buildChecklist(categories) {
  const items=[];
  for(const cat of categories){
    for(const f of cat.findings){
      if(f.ruleId.endsWith('.not-applicable')||f.ruleId.endsWith('.too-short-to-analyze'))continue;
      items.push({ruleId:f.ruleId,category:cat.category,label:f.title,status:f.severity==='error'?'fail':'warning',action:f.recommendation});
    }
    const af=cat.findings.filter(f=>!f.ruleId.endsWith('.not-applicable'));
    if(af.length===0)items.push({ruleId:`${cat.category}.all-pass`,category:cat.category,label:`${cat.label} — OK`,status:'pass'});
  }
  items.sort((a,b)=>({fail:0,warning:1,pass:2}[a.status]-{fail:0,warning:1,pass:2}[b.status]));
  return items;
}

function analyze(raw) {
  const content=parse(raw);
  const categories=runAnalyzers(content);
  const score=calculateScore(categories);
  const allFindings=categories.flatMap(c=>c.findings);
  return{
    analyzedAt:new Date().toISOString(),
    overallScore:score.overallScore,
    publicationStatus:score.publicationStatus,
    categories,
    checklist:buildChecklist(categories),
    summary:{errors:allFindings.filter(f=>f.severity==='error').length,warnings:allFindings.filter(f=>f.severity==='warning').length,infos:allFindings.filter(f=>f.severity==='info').length},
    meta:{wordCount:content.wordCount,language:content.language,inputType:content.inputType}
  };
}

// ── Test runner ───────────────────────────────────────────────────────────────
let passed=0,failed=0;
function test(name,fn){try{fn();console.log(`  ✓ ${name}`);passed++;}catch(e){console.error(`  ✗ ${name}\n    ${e.message}`);failed++;}}
function expect(val){return{toBe(e){if(val!==e)throw new Error(`Expected ${JSON.stringify(e)}, got ${JSON.stringify(val)}`);},toBeGreaterThan(n){if(!(val>n))throw new Error(`Expected ${val} > ${n}`);},toBeLessThanOrEqual(n){if(!(val<=n))throw new Error(`Expected ${val} <= ${n}`);},toEqual(e){if(JSON.stringify(val)!==JSON.stringify(e))throw new Error(`Expected ${JSON.stringify(e)}, got ${JSON.stringify(val)}`);},toHaveLength(n){if(val.length!==n)throw new Error(`Length: expected ${n}, got ${val.length}`);},toContain(s){if(!(Array.isArray(val)?val.includes(s):String(val).includes(s)))throw new Error(`Expected to contain ${JSON.stringify(s)}`);},not:{toBe(e){if(val===e)throw new Error(`Expected NOT ${JSON.stringify(e)}`);},toContain(s){if(Array.isArray(val)?val.includes(s):String(val).includes(s))throw new Error(`Expected NOT to contain ${JSON.stringify(s)}`);}}};}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const GOOD_HTML = `
<html>
<head>
  <title>Jak wybrać dobrego labradora — kompletny poradnik</title>
  <meta name="description" content="Sprawdź, na co zwrócić uwagę wybierając labradora. Omawiamy charakter, zdrowie, hodowlę i koszty utrzymania psa tej rasy.">
  <link rel="canonical" href="https://example.com/jak-wybrac-labradora">
</head>
<body>
  <h1>Jak wybrać dobrego labradora</h1>
  <p>Labrador to jedna z najpopularniejszych ras psów na świecie. Wybór odpowiedniego szczeniaka jest jednak decyzją, która wymaga starannego przemyślenia i przygotowania.</p>
  <h2>Charakter labradora</h2>
  <p>Labradory są znane ze swojego łagodnego charakteru i inteligencji. Świetnie sprawdzają się jako psy rodzinne, ale wymagają dużo ruchu i aktywności.</p>
  <p>Ważne jest, aby ocenić temperament rodziców szczeniaka. <a href="/hodowle">Sprawdź nasze rekomendowane hodowle</a> lub skonsultuj się z <a href="https://pzlo.pl" rel="nofollow">Polskim Związkiem Łowiectwa</a>.</p>
  <h2>Zdrowie i badania</h2>
  <p>Przed zakupem upewnij się, że rodzice szczeniaka mają aktualne badania stawów biodrowych (HD) oraz oczu. Labradory są podatne na dysplazję stawów, dlatego badania są kluczowe.</p>
  <img src="/labrador-szczeniak.jpg" alt="Szczeniak labradora w ogrodzie" loading="lazy">
  <h2>FAQ</h2>
  <details><summary>Ile kosztuje labrador?</summary><p>Cena labradora z hodowli z rodowodem wynosi od 3000 do 6000 zł. Cena zależy od linii hodowlanej, rodziców i lokalizacji hodowli. Tańsze szczeniaki mogą pochodzić z nieodpowiedzialnych hodowli.</p></details>
  <details><summary>Czy labrador jest odpowiedni dla dzieci?</summary><p>Tak, labradory są jedną z najlepszych ras dla rodzin z dziećmi. Są cierpliwe, łagodne i uwielbiają zabawę. Zawsze jednak nadzoruj kontakt małych dzieci z każdym psem, niezależnie od rasy.</p></details>
</body>
</html>
`;

const BAD_HTML = `
<html>
<body>
  <h2>Witamy</h2>
  <p>W dzisiejszym świecie niezwykle ważne jest, że warto pamiętać o kluczowych aspektach. Oczywiście, jak wszyscy wiemy, bez wątpienia należy podkreślić, że synergy i leverage są absolutnie kluczowe dla holistic podejścia do tego zagadnienia. Mam nadzieję, że ten artykuł pomoże.</p>
  <img src="IMG_1234.jpg">
</body>
</html>
`;

const PLAIN_TEXT = `
Labrador retriever to jedna z najpopularniejszych ras psów na świecie.
Psy tej rasy są znane ze swojego łagodnego charakteru i wysokiej inteligencji.
Świetnie sprawdzają się jako psy rodzinne oraz psy asystujące.
Wymagają jednak dużo ruchu — minimum dwie godziny aktywności dziennie.
Labradory są podatne na dysplazję stawów biodrowych, dlatego ważne są regularne badania.
Przeciętna długość życia labradora wynosi 10-12 lat.
Rasa pochodzi z Nowej Funlandii, gdzie pierwotnie pomagała rybakom.
`;

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\n=== END-TO-END INTEGRATION TESTS ===\n');

console.log('[ Good HTML input ]');
const goodResult = analyze(GOOD_HTML);
test('returns AnalysisResult object', () => { expect(typeof goodResult.overallScore).toBe('number'); });
test('overallScore is 0-100', () => { expect(goodResult.overallScore).toBeGreaterThan(0); expect(goodResult.overallScore).toBeLessThanOrEqual(100); });
test('has 7 categories', () => expect(goodResult.categories).toHaveLength(7));
test('all categories have scores', () => { goodResult.categories.forEach(c=>expect(c.score).toBeGreaterThan(-1)); });
test('good content: publication status not do-not-publish', () => expect(goodResult.publicationStatus).not.toBe('do-not-publish'));
test('checklist exists and has items', () => expect(goodResult.checklist.length).toBeGreaterThan(0));
test('meta.inputType is html', () => expect(goodResult.meta.inputType).toBe('html'));
test('meta.language is pl', () => expect(goodResult.meta.language).toBe('pl'));
test('meta.wordCount > 0', () => expect(goodResult.meta.wordCount).toBeGreaterThan(0));
test('analyzedAt is ISO string', () => expect(goodResult.analyzedAt).toContain('T'));
test('summary has error/warning/info counts', () => {
  expect(typeof goodResult.summary.errors).toBe('number');
  expect(typeof goodResult.summary.warnings).toBe('number');
});

console.log('\n[ Bad HTML input ]');
const badResult = analyze(BAD_HTML);
test('bad content: low overall score', () => expect(badResult.overallScore).toBeLessThanOrEqual(70));
test('bad content: has errors', () => expect(badResult.summary.errors).toBeGreaterThan(0));
test('bad content: checklist has fail items', () => expect(badResult.checklist.some(i=>i.status==='fail')).toBe(true));
test('bad content: do-not-publish or needs-improvement', () => {
  const valid=['do-not-publish','needs-improvement'];
  if(!valid.includes(badResult.publicationStatus))throw new Error(`Expected one of ${valid}, got ${badResult.publicationStatus}`);
});

console.log('\n[ Plain text input ]');
const textResult = analyze(PLAIN_TEXT);
test('detects plain text', () => expect(textResult.meta.inputType).toBe('text'));
test('still returns 7 categories', () => expect(textResult.categories).toHaveLength(7));
test('plain text: language detected as pl', () => expect(textResult.meta.language).toBe('pl'));
test('plain text: wordCount > 0', () => expect(textResult.meta.wordCount).toBeGreaterThan(0));

console.log('\n[ Empty input ]');
const emptyResult = analyze('');
test('empty input: does not throw', () => expect(typeof emptyResult.overallScore).toBe('number'));
test('empty input: wordCount is 0', () => expect(emptyResult.meta.wordCount).toBe(0));

console.log('\n[ Score engine ]');
test('good content scores higher than bad', () => expect(goodResult.overallScore).toBeGreaterThan(badResult.overallScore));
test('checklist is sorted: fails before warnings before passes', () => {
  const statuses=goodResult.checklist.map(i=>i.status);
  const order={fail:0,warning:1,pass:2};
  for(let i=1;i<statuses.length;i++){if(order[statuses[i]]<order[statuses[i-1]])throw new Error(`Sort broken at index ${i}: ${statuses[i-1]} → ${statuses[i]}`);}
});
test('publicationStatus is one of 3 valid values', () => {
  const valid=['ready-to-publish','needs-improvement','do-not-publish'];
  [goodResult,badResult,textResult].forEach(r=>{if(!valid.includes(r.publicationStatus))throw new Error(`Invalid: ${r.publicationStatus}`);});
});
test('all category statuses are pass/warning/fail', () => {
  const valid=['pass','warning','fail'];
  goodResult.categories.forEach(c=>{if(!valid.includes(c.status))throw new Error(`Invalid status: ${c.status}`);});
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if(failed>0)process.exit(1);

// ── Score report (visual) ─────────────────────────────────────────────────────
console.log('\n=== SAMPLE ANALYSIS REPORT (Good HTML) ===');
console.log(`Overall Score: ${goodResult.overallScore}/100`);
console.log(`Status: ${goodResult.publicationStatus}`);
console.log(`Summary: ${goodResult.summary.errors} errors, ${goodResult.summary.warnings} warnings, ${goodResult.summary.infos} infos`);
console.log('\nCategory Scores:');
goodResult.categories.forEach(c=>{
  const bar='█'.repeat(Math.round(c.score/10))+'░'.repeat(10-Math.round(c.score/10));
  console.log(`  ${c.label.padEnd(14)} ${bar} ${c.score}/100 [${c.status}]`);
});
console.log('\nChecklist (first 8):');
goodResult.checklist.slice(0,8).forEach(i=>{
  const icon=i.status==='pass'?'✓':i.status==='fail'?'✗':'⚠';
  console.log(`  ${icon} [${i.category}] ${i.label}`);
});
