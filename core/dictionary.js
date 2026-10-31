// The expert dictionary: concepts, their variants in the newcomers' languages, the patterns for value-shaped answers.
// It is the first retrieval signal, before any model. The author of the guide owns it; the model may only propose entries.
import { fold, phraseIndex, stems } from "./text.js";

export function loadDictionary(raw) {
  const D = { concepts: [], byId: new Map(), patterns: [], version: raw?.version || 0 };
  for (const c of raw?.concepts || []) {
    const variants = [];
    const seen = new Set();
    const add = (text, lang) => {
      const f = fold(text);
      if (!f || seen.has(f)) return;
      seen.add(f);
      variants.push({ text, lang, fold: f, stems: stems(text) });
    };
    add(c.label, "fr");
    for (const [lang, list] of Object.entries(c.variants || {})) for (const v of list || []) add(String(v), lang);
    const concept = { id: c.id, label: c.label, shape: c.shape || null, fiches: c.fiches || [], variants, frFolds: variants.filter((v) => v.lang === "fr").map((v) => v.fold) };
    D.concepts.push(concept);
    D.byId.set(c.id, concept);
  }
  for (const p of raw?.patterns || []) {
    try { D.patterns.push({ id: p.id, shape: p.shape || null, re: new RegExp(p.regex, "giu") }); } catch (e) { /* a bad pattern is skipped, not fatal */ }
  }
  return D;
}

// Which concepts does a folded question mention? Phrase match first (word boundaries), then bag-of-stems for multi-word
// variants whose words appear in another order. One hit per concept: the longest variant wins.
export function matchConcepts(D, folded, stemList) {
  const stemSet = new Set(stemList);
  const hits = [];
  for (const c of D.concepts) {
    let best = null;
    for (const v of c.variants) {
      let kind = null;
      if (phraseIndex(folded, v.fold) >= 0) kind = "phrase";
      else if (v.stems.length === 1 && stemSet.has(v.stems[0])) kind = "stem";
      else if (v.stems.length > 1 && v.stems.every((s) => stemSet.has(s))) kind = "bag";
      if (!kind) continue;
      const weight = kind === "phrase" ? 1 : kind === "stem" ? 0.9 : 0.7;
      if (!best || v.fold.length > best.variant.fold.length) best = { variant: v, kind, weight };
    }
    if (best) hits.push({ id: c.id, label: c.label, shape: c.shape, fiches: c.fiches, variant: best.variant.text, lang: best.variant.lang, match: best.kind, weight: best.weight });
  }
  return hits;
}

export function matchPatterns(D, text) {
  const out = [];
  for (const p of D.patterns) {
    p.re.lastIndex = 0;
    const m = text.match(p.re);
    if (m) out.push({ id: p.id, shape: p.shape, values: [...new Set(m.map((x) => x.trim()))] });
  }
  return out;
}

// Does a bloc (folded text + stem set) mention a concept? Returns the French variant that matched, or null.
export function conceptInBloc(concept, blocFold, blocStems) {
  for (const v of concept.variants) {
    if (v.lang !== "fr") continue;
    if (v.stems.length === 1 ? blocStems.has(v.stems[0]) : phraseIndex(blocFold, v.fold) >= 0) return v.text;
  }
  return null;
}
