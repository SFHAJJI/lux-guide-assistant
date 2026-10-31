// Text folding, tokens, light stemming, sentences and edit distance. Shared by every brick, in Node and in the browser.
// Folding is for matching only: what the reader sees is always the guide's original text.

// Stopwords per language: "car" is a conjunction in French and a vehicle in English, so the list follows the
// language of the text (the guide is French; a question carries its own language).
const COMMON = "a e o l d s c n m t y svp merci bonjour salut ok".split(" ");
export const STOP = {
  fr: new Set(COMMON.concat((
    "le la les un une des de du au aux et ou en pour dans sur par avec est sont il elle ils elles je tu nous vous on que qui quoi " +
    "ce cette ces cet son sa ses mon ma mes ton ta tes notre nos votre vos leur leurs ne pas plus moins tres donc or ni car mais " +
    "si se me te lui eux etre avoir ai as avons avez ont suis es sommes etes fait faire faut dois doit peux peut peuvent " +
    "puis comment quand combien pourquoi quel quelle quels quelles lequel laquelle esque ca cela ceci aussi encore deja tout tous " +
    "toute toutes chaque autre autres meme memes bien peu beaucoup entre vers chez sans sous apres avant pendant depuis jusqu jusque"
  ).split(/\s+/))),
  en: new Set(COMMON.concat((
    "the an of to in on for with and or is are am be been do does did i you he she it we they my your his her its our their what which " +
    "who whom how when where why can could should would will shall may might must have has had this that these those there here if then " +
    "not no yes please thanks hello get"
  ).split(/\s+/))),
  de: new Set(COMMON.concat((
    "der die das ein eine einer eines dem den des und oder ist sind ich du er sie es wir ihr mein meine dein wie wann wo warum was welche " +
    "welcher welches kann muss soll darf nicht kein keine zu von mit fur fuer auf in im am bei nach vor uber ueber"
  ).split(/\s+/))),
  pt: new Set(COMMON.concat((
    "os as um uma uns umas de do da dos das em no na nos nas para por com ou que quem qual quais como quando onde porque eu tu ele " +
    "ela voces eles elas meu minha seu sua ser estar tem tenho posso pode deve preciso nao sim"
  ).split(/\s+/)))
};
export const STOPWORDS = STOP.fr;

const QUESTION_WORDS = new Set("quel quelle quels quelles lequel laquelle what which who how when where why wie welche wann wo qual quais como quando onde".split(" "));

export function fold(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[’'`´]/g, " ")
    .replace(/[^a-z0-9%€]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// A light French stemmer: one suffix stripped, the root keeps at least four letters. "immatriculer", "immatriculation"
// and "immatriculé" meet on "immatricul"; "déclarer" and "déclaration" on "declar". Over-merging is accepted at this size.
const SUFFIXES = ["issement", "ation", "ement", "ance", "ence", "ique", "euse", "eur", "iere", "ier", "ee", "er", "ir", "e"];
export function stem(t) {
  if (t.length <= 3 || /^\d/.test(t)) return t;
  if (t.endsWith("aux") && t.length > 5) return t.slice(0, -3) + "al";
  if (/[sx]$/.test(t) && !/ss$/.test(t) && t.length > 4) t = t.slice(0, -1);   // plural first
  for (const suf of SUFFIXES) {
    if (t.endsWith(suf) && t.length - suf.length >= 4) return t.slice(0, -suf.length);
  }
  return t;
}

export function rawTokens(s) { return fold(s).split(" ").filter((t) => t.length > 0); }

export function tokens(s, lang = "fr") { const stop = STOP[lang] || STOP.fr; return rawTokens(s).filter((t) => t.length > 1 && !stop.has(t)); }

export function stems(s, lang = "fr") { return tokens(s, lang).map(stem); }

export function isQuestionWord(t) { return QUESTION_WORDS.has(t); }

// Word-boundary phrase match on folded text. Returns the index of the first match or -1.
export function phraseIndex(foldedHay, foldedNeedle) {
  if (!foldedNeedle) return -1;
  let from = 0;
  for (;;) {
    const i = foldedHay.indexOf(foldedNeedle, from);
    if (i < 0) return -1;
    const before = i === 0 || foldedHay[i - 1] === " ";
    const after = i + foldedNeedle.length === foldedHay.length || foldedHay[i + foldedNeedle.length] === " ";
    if (before && after) return i;
    from = i + 1;
  }
}

export function sentences(text) {
  const t = String(text).replace(/\s+/g, " ").trim();
  const parts = t.split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÝŒ«(\d])/);
  return parts.filter((p) => p.trim());
}

// Damerau-Levenshtein (optimal string alignment) with an early exit above `max`.
export function editDistance(a, b, max = 2) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length;
  let prev2 = null, prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[n];
}

// Normalisation used by the validator: the quote must be a substring of the cited blocs up to whitespace and quote marks.
export function normalizeForQuote(s) {
  return String(s || "")
    .replace(/[  ]/g, " ")
    .replace(/[’'`´]/g, "'")
    .replace(/[«»"“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
