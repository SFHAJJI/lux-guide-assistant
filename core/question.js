// Brick 2, question parsing: the reader's string becomes a typed row before anything is searched.
// Two briefs come out of it: what retrieval needs (keywords, concepts, scope) and what generation needs
// (the original wording, the language, the exclusions). Deterministic; a model is not involved.
import { fold, rawTokens, stem, STOP, isQuestionWord, editDistance } from "./text.js";
import { matchConcepts, matchPatterns } from "./dictionary.js";

const LANG_MARKERS = {
  en: "the what how where when which can do does is are my your you please thanks need get register should must of many much to for with and or it there any from about i".split(" "),
  de: "der die das wie wo wann welche ich kann muss ist sind mein und nicht fur mit brauche".split(" "),
  pt: "os as como onde quando qual quais posso preciso tenho meu minha para com nao sim obrigado quanto custa documentos".split(" "),
  fr: "le la les comment quand quel quelle quels quelles est je dois faut pour avec mon ma mes des une un du combien".split(" ")
};
const NEGATION = new Set("pas non sans ne jamais aucun aucune not no without never nicht kein keine nao não sem nunca".split(" "));

const SHAPES = [
  ["amount", /\b(combien (ca )?coute|combien (de )?(euros|eur)|cout|couts|prix|tarif|montant|frais|plafond|how much|cost|price|fee|wie ?viel kostet|kosten|preis|quanto custa|preco|valor)\b/],
  ["delay", /\b(delai|delais|combien de temps|combien de jours|combien de mois|sous quel delai|dans quel delai|quand|how long|how many days|when|deadline|wie lange|wann|frist|quanto tempo|quando|prazo)\b/],
  ["list", /\b(quels|quelles|lesquels|lesquelles|liste|listez|quels sont|what documents|which documents|what are|which|list|welche|was brauche|quais|que documentos)\b/],
  ["yes_no", /^(est ce que|est ce qu|puis je|peut on|peux tu|faut il|dois je|doit on|suis je|ai je|y a t il|is it|can i|do i|must i|should i|am i|are|is|does|kann ich|muss ich|darf ich|ist|posso|preciso|devo|tenho que)\b/],
  ["procedure", /\b(comment|how do|how to|how can|wie|como|quelles etapes|quelles demarches|que faire|what should i do|procedure)\b/]
];

// French is the guide's language and the default: another language needs two distinct markers and more than French.
function detectLanguage(toks) {
  const score = {};
  for (const [lang, words] of Object.entries(LANG_MARKERS)) score[lang] = new Set(toks.filter((t) => words.includes(t))).size;
  const best = Object.entries(score).filter(([l]) => l !== "fr").sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 2 && best[1] > score.fr ? best[0] : "fr";
}

function correct(token, T) {
  if (token.length < 4 || /\d/.test(token) || T.vocab.has(token)) return null;
  const max = token.length >= 7 ? 2 : 1;
  let best = null;
  for (const [w, freq] of T.vocab) {
    if (Math.abs(w.length - token.length) > max || w[0] !== token[0]) continue;
    const d = editDistance(token, w, max);
    if (d <= max && (!best || d < best.d || (d === best.d && freq > best.freq))) best = { w, d, freq };
  }
  return best && best.freq >= 2 ? best.w : null;
}

export function parsePage(page) {
  const h = String(page || "").replace(/^#/, "").trim();
  if (!h) return { type: null, fiche_id: null, raw: h };
  const m = h.match(/^fiche\/([a-z0-9_]+)/i);
  if (m) return { type: "fiche", fiche_id: m[1], raw: h };
  const name = h.split(/[/?]/)[0];
  return { type: name || null, fiche_id: null, raw: h };
}

export function parseQuestion(raw, { T, D, page = null, profile = null, previous = null } = {}) {
  const original = String(raw || "").trim();
  const folded0 = fold(original);
  const toks0 = rawTokens(original);

  // Smalltalk is answered without a search: a greeting alone, not a greeting followed by a question.
  let smalltalk = null;
  if (toks0.length <= 3) {
    if (/^(bonjour|salut|hello|hi|hey|bonsoir|coucou|bjr|moien|hallo|ola|bom dia|boa tarde|good morning)\b/.test(folded0)) smalltalk = "greeting";
    else if (/^(merci|thanks|thank you|danke|obrigad[oa]|super merci|parfait merci|top)\b/.test(folded0)) smalltalk = "thanks";
    else if (/^(au revoir|bye|bonne journee|bonne soiree|a bientot|ciao|tschuss|adeus|goodbye)\b/.test(folded0)) smalltalk = "bye";
  }

  // Typo correction against the corpus vocabulary (never against the model's imagination), for French questions:
  // an English or German word is not a misspelt French one; the dictionary carries those languages.
  const language = detectLanguage(toks0);
  const stop = STOP[language] || STOP.fr;
  const corrections = [];
  const toks = toks0.map((t) => {
    if (stop.has(t) || language !== "fr") return t;
    const c = T ? correct(t, T) : null;
    if (c) { corrections.push({ from: t, to: c }); return c; }
    return t;
  });
  const folded = toks.join(" ");

  // Exclusions stay out of retrieval and go to the generation brief.
  const negation = toks.filter((t) => NEGATION.has(t));
  const content = toks.filter((t) => t.length > 1 && !stop.has(t) && !isQuestionWord(t) && !NEGATION.has(t));
  // The reader's own words, weighted by how specific they are in the guide (a rare word says more than "prix").
  const direct = [];
  const seen = new Set();
  for (const t of content) {
    const s = stem(t);
    if (seen.has(s)) continue;
    seen.add(s);
    const idf = T ? T.idfOf(s) : 1;
    direct.push({ text: t, stem: s, weight: Math.round((0.5 + 0.5 * idf) * 100) / 100, idf: Math.round(idf * 100) / 100, source: "direct" });
  }
  const stemList = direct.map((k) => k.stem);

  const concepts = D ? matchConcepts(D, folded, stemList) : [];
  const patterns = D ? matchPatterns(D, original.toLowerCase()) : [];

  let shape = "fact";
  for (const [name, re] of SHAPES) if (re.test(folded)) { shape = name; break; }
  if (shape === "fact") { const ps = patterns.find((p) => p.shape); const cs = concepts.find((c) => c.shape); if (ps) shape = ps.shape; else if (cs && ["amount", "delay"].includes(cs.shape)) shape = cs.shape; }
  const listing = shape === "list" || /\b(tous|toutes|chaque|all|alle|todos|todas)\b/.test(folded);

  const scope = parsePage(page);
  let inherited = false;
  if (!scope.fiche_id && previous && previous.fiche_id && direct.length <= 2 && concepts.length === 0 && /\b(et|and|und|e)\b/.test(folded)) {
    scope.inherited_fiche_id = previous.fiche_id; inherited = true;
  }

  // Keywords for retrieval: the reader's own words, then the French variants of each matched concept (lower weight).
  const keywords = [...direct];
  for (const c of concepts) {
    const concept = D.byId.get(c.id);
    for (const v of concept.variants) if (v.lang === "fr") keywords.push({ text: v.text, stem: v.stems.length === 1 ? v.stems[0] : null, fold: v.fold, stems: v.stems, weight: 0.7, source: "dictionary", concept: c.id });
  }

  const status = profile?.statut || null; // "ue" | "hors_ue" | null

  // One ordinary word alone ("aide", "document") is not a question yet: ask for a subject rather than guess.
  const titleWord = T && direct.length === 1 && T.fiche.some((f) => f._titleStems.has(direct[0].stem));
  const vague = !smalltalk && direct.length === 1 && concepts.length === 0 && !titleWord && (direct[0].idf ?? 1) < 0.75;

  return {
    original, folded, language, corrections, smalltalk, vague,
    keywords, direct, concepts, patterns, shape, listing,
    negation, exclusions: negation.length ? original : null,
    scope: { ...scope, inherited },
    profile: { statut: status },
    retrieval: { keywords, concepts: concepts.map((c) => c.id), fiche_hints: [...new Set(concepts.flatMap((c) => c.fiches))], scope },
    generation: { original, language, shape, listing, exclusions: negation.length ? negation : [] }
  };
}
