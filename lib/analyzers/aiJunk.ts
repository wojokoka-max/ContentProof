/**
 * ContentProof — AI Junk Analyzer v1.1
 */
import type { StructuredContent, CategoryResult, Finding } from '../types';

const CATEGORY = 'ai-junk' as const;
const LABEL = 'AI Junk';

const HOLLOW_OPENERS_EN = ['in today\'s world','in today\'s fast-paced world','in the ever-evolving','in the world of','in today\'s digital age','it\'s important to note','it is worth noting','it goes without saying','needless to say','as we all know','at the end of the day','when all is said and done','in this article, we will','let\'s dive in','let\'s dive into','without further ado','in a nutshell'];
const HOLLOW_OPENERS_PL = ['w dzisiejszym świecie','w dzisiejszych czasach','w erze cyfrowej','nie da się ukryć','oczywistym jest','należy zauważyć','warto podkreślić','jak wszyscy wiemy','w tym artykule omówimy','zapraszam do lektury','zapraszamy do lektury','przyjrzyjmy się bliżej','jak sama nazwa wskazuje','krótko mówiąc','w skrócie','podsumowując powyższe'];
const HEDGE_EN = ['it\'s worth mentioning','it\'s important to remember','keep in mind','it\'s crucial to','it\'s essential to','it\'s vital to','one must consider','one should note'];
const HEDGE_PL = ['warto pamiętać','należy pamiętać','nie można zapomnieć','kluczowe jest','niezwykle ważne jest','istotnym jest','niezwykle istotne','nie sposób nie wspomnieć','należy podkreślić','trzeba podkreślić'];
const SYCO_EN = ['great question','excellent question','absolutely','certainly','i hope this helps','i hope this article has','feel free to','don\'t hesitate to'];
const SYCO_PL = ['świetne pytanie','doskonałe pytanie','absolutnie','mam nadzieję, że ten artykuł','mam nadzieję, że pomoże','nie wahaj się','zachęcam do','zapraszam do kontaktu'];
const BUZZWORD_PATTERNS = [/\bsynergy\b/gi,/\bleverage[sd]?\b/gi,/\bparadigm shift\b/gi,/\bgame.?changer\b/gi,/\bseamlessly\b/gi,/\brobust\b/gi,/\bcutting.?edge\b/gi,/\bstate.?of.?the.?art\b/gi,/\bholistic(ally)?\b/gi,/\bprzełomowy\b/gi,/\bsynergia\b/gi,/\bholistyczny\b/gi];

function findPatterns(text: string, patterns: string[]): string[] {
  const lower = text.toLowerCase();
  return patterns.filter(p => lower.includes(p.toLowerCase()));
}

function countBuzzwords(text: string): number {
  return BUZZWORD_PATTERNS.reduce((n, p) => n + (text.match(p)?.length ?? 0), 0);
}

function detectUniformSentenceLengths(sentences: string[]): boolean {
  if (sentences.length < 8) return false;
  const lengths = sentences.map(s => s.split(/\s+/).filter(Boolean).length);
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length;
  return Math.sqrt(variance) < 3.5 && avg > 10 && avg < 25;
}

function detectRepetitiveStarters(sentences: string[]): string[] {
  if (sentences.length < 6) return [];
  const starters = sentences.map(s => s.trim().split(/\s+/).slice(0, 2).join(' ').toLowerCase());
  const counts: Record<string, number> = {};
  starters.forEach(s => { counts[s] = (counts[s] ?? 0) + 1; });
  return Object.entries(counts).filter(([, c]) => c >= 3).map(([s]) => `"${s}"`);
}

function checkHollowOpeners(content: StructuredContent, findings: Finding[]): number {
  const openers = content.language === 'pl' ? [...HOLLOW_OPENERS_PL, ...HOLLOW_OPENERS_EN] : [...HOLLOW_OPENERS_EN, ...HOLLOW_OPENERS_PL];
  const found = findPatterns(content.plainText, openers);

  if (found.length >= 3) {
    findings.push({
      ruleId: 'ai-junk.hollow-openers',
      category: CATEGORY,
      severity: 'error',
      title: 'Wiele pustych zwrotów otwierających',
      description: `Znaleziono ${found.length} charakterystycznych zwrotów AI.`,
      why: 'Zwroty jak "w dzisiejszym świecie" czy "warto podkreślić" to sygnatura generatywnego AI. Google Helpful Content Update penalizuje treści, które są evidentnie "machine-generated".',
      context: found.slice(0, 4).join(' | '),
      recommendation: 'Usuń ogólnikowe wstępy. Zacznij od konkretnej informacji lub tezy.',
      fixCode: `<!-- Przed (AI): -->\nW dzisiejszym świecie niezwykle ważne jest zrozumienie...\n\n<!-- Po (człowiek): -->\nLabrador kosztuje od 3000 do 6000 zł — oto jak wybrać dobrą hodowlę.`,
    });
    return 20;
  }

  if (found.length >= 1) {
    findings.push({
      ruleId: 'ai-junk.some-hollow-openers',
      category: CATEGORY,
      severity: 'warning',
      title: 'Puste zwroty otwierające',
      description: `Znaleziono ${found.length} ogólnikowy/e zwrot(y) typowe dla AI.`,
      why: 'Nawet pojedyncze AI-isms obniżają postrzeganą jakość treści.',
      context: found.join(' | '),
      recommendation: 'Zastąp ogólne wstępy konkretnymi informacjami wartościowymi dla czytelnika.',
    });
    return 65;
  }

  return 100;
}

function checkHedgePhrases(content: StructuredContent, findings: Finding[]): number {
  const hedges = content.language === 'pl' ? [...HEDGE_PL, ...HEDGE_EN] : [...HEDGE_EN, ...HEDGE_PL];
  const found = findPatterns(content.plainText, hedges);

  if (found.length >= 4) {
    findings.push({
      ruleId: 'ai-junk.hedge-overload',
      category: CATEGORY,
      severity: 'warning',
      title: 'Nadmiar wypełniaczy i ostrożnych zwrotów',
      description: `${found.length} fraz typu "warto pamiętać", "należy podkreślić" itp.`,
      why: 'Wypełniacze zwiększają liczbę słów bez dodawania wartości. Algorytm Helpful Content aktywnie szuka treści pisanych "dla ludzi, nie dla wyszukiwarek".',
      context: found.slice(0, 3).join(' | '),
      recommendation: 'Usuń zbędne wtrącenia. Przekaż informację bezpośrednio.',
      fixCode: `<!-- Przed: -->\nWarto pamiętać, że labradory wymagają dużo ruchu.\n\n<!-- Po: -->\nLabradory potrzebują minimum 2 godzin aktywności dziennie.`,
    });
    return 55;
  }

  return 100;
}

function checkSycophancy(content: StructuredContent, findings: Finding[]): number {
  const patterns = content.language === 'pl' ? [...SYCO_PL, ...SYCO_EN] : [...SYCO_EN, ...SYCO_PL];
  const found = findPatterns(content.plainText, patterns);

  if (found.length > 0) {
    findings.push({
      ruleId: 'ai-junk.sycophantic-phrases',
      category: CATEGORY,
      severity: 'warning',
      title: 'Frazy charakterystyczne dla chatbotów AI',
      description: `Znaleziono zwroty typowe dla asystentów AI: "${found.slice(0, 2).join('", "')}".`,
      why: 'Frazy jak "mam nadzieję, że ten artykuł pomoże" to typowe "tells" chatbota, które sygnalizują machine-generated content.',
      context: found.slice(0, 3).join(' | '),
      recommendation: 'Usuń frazy asystenckie. Pisz jako ekspert, a nie jako chatbot.',
    });
    return 50;
  }

  return 100;
}

function checkBuzzwords(content: StructuredContent, findings: Finding[]): number {
  const count = countBuzzwords(content.plainText);
  if (count === 0) return 100;

  const per1000 = content.wordCount > 0 ? Math.round((count / content.wordCount) * 1000) : 0;

  if (per1000 >= 5 || count >= 5) {
    findings.push({
      ruleId: 'ai-junk.buzzwords',
      category: CATEGORY,
      severity: 'warning',
      title: 'Wysoka koncentracja buzzwordów',
      description: `${count} pustych buzzwordów na ${content.wordCount} słów.`,
      why: 'Buzzwordy (synergy, leverage, holistic, przełomowy) wypełniają tekst bez konkretnej wartości. Google preferuje treści z precyzyjnymi faktami i danymi.',
      recommendation: 'Zastąp buzzwordy konkretnymi faktami, liczbami lub przykładami.',
      fixCode: `<!-- Przed: -->\nNasze holistyczne podejście zapewnia synergię przełomowych rozwiązań.\n\n<!-- Po: -->\nNasze rozwiązanie skraca czas wdrożenia o 40% i redukuje koszty o 25%.`,
    });
    return 60;
  }

  return 100;
}

function checkSentenceUniformity(content: StructuredContent, findings: Finding[]): number {
  if (!detectUniformSentenceLengths(content.sentences)) return 100;

  findings.push({
    ruleId: 'ai-junk.uniform-sentence-length',
    category: CATEGORY,
    severity: 'warning',
    title: 'Nadmiernie jednolita długość zdań',
    description: 'Zdania mają wyjątkowo podobną długość — typowy wzorzec tekstu AI.',
    why: 'LLM-y generują tekst z charakterystycznie niską wariancją długości zdań. Ludzkie teksty naturalnie mieszają krótkie i długie zdania. Detektory AI sprawdzają tę metrykę.',
    recommendation: 'Urozmaicaj rytm tekstu: dodaj kilka bardzo krótkich zdań (3–6 słów) i kilka dłuższych.',
    fixCode: `<!-- Przed (AI-like, monotonne): -->\nLabradorы są popularnymi psami. Wymagają dużo ruchu. Lubią zabawę z dziećmi.\n\n<!-- Po (zróżnicowane): -->\nLabradorу to jedne z najlepszych psów rodzinnych. Są aktywne, inteligentne i — co kluczowe dla rodzin z dziećmi — niezwykle cierpliwe. Wymagają ruchu. Dużo ruchu.`,
  });

  return 60;
}

function checkRepetitiveStarters(content: StructuredContent, findings: Finding[]): number {
  const repeated = detectRepetitiveStarters(content.sentences);
  if (repeated.length === 0) return 100;

  findings.push({
    ruleId: 'ai-junk.repetitive-starters',
    category: CATEGORY,
    severity: 'info',
    title: 'Powtarzające się początki zdań',
    description: `Zdania wielokrotnie zaczynają się od: ${repeated.slice(0, 3).join(', ')}.`,
    why: 'Repetytywne struktury zdań to kolejna sygnatura AI. Utrudniają też czytanie przez monotonny rytm.',
    recommendation: 'Urozmaicaj początki zdań — używaj różnych struktur gramatycznych i podmiotów.',
  });

  return 80;
}

export function analyzeAiJunk(content: StructuredContent): CategoryResult {
  const findings: Finding[] = [];

  if (content.wordCount < 80) {
    return {
      category: CATEGORY, label: LABEL, score: 100, status: 'pass',
      findings: [{ ruleId: 'ai-junk.too-short-to-analyze', category: CATEGORY, severity: 'info',
        title: 'Treść zbyt krótka do analizy AI Junk',
        description: 'Analiza AI Junk wymaga minimum 80 słów.',
        why: 'Wzorce AI potrzebują wystarczającej próbki tekstu.',
      }],
      llmEnhanced: false,
    };
  }

  const scores = {
    openers:    checkHollowOpeners(content, findings),
    hedges:     checkHedgePhrases(content, findings),
    syco:       checkSycophancy(content, findings),
    buzzwords:  checkBuzzwords(content, findings),
    uniformity: checkSentenceUniformity(content, findings),
    starters:   checkRepetitiveStarters(content, findings),
  };

  const score = Math.round(
    scores.openers * 0.25 + scores.hedges * 0.20 + scores.syco * 0.20 +
    scores.buzzwords * 0.15 + scores.uniformity * 0.15 + scores.starters * 0.05
  );

  const status = score >= 80 ? 'pass' : score >= 50 ? 'warning' : 'fail';
  return { category: CATEGORY, label: LABEL, score, status, findings, llmEnhanced: false };
}
