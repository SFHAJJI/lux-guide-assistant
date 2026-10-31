// The FAQ as a cache in front of retrieval: a direct hit returns the guide's own answer and its backing passage with no
// model call; an adjacent hit becomes a candidate; a miss falls through to the fiches.
import { fold, phraseIndex } from "./text.js";

export const FAQ_DIRECT = 0.78;
export const FAQ_ADJACENT = 0.45;

export function matchFaq(pq, T) {
  const qs = new Set(pq.direct.map((k) => k.stem));
  const conceptFolds = pq.concepts.map((c) => fold(c.variant));
  const scored = [];
  for (const f of T.faq) {
    let inter = 0;
    for (const s of qs) if (f._stems.has(s)) inter++;
    const cov = qs.size ? inter / qs.size : 0;
    const rec = f._stems.size ? inter / f._stems.size : 0;
    let bonus = 0;
    for (const cf of conceptFolds) if (phraseIndex(f._fold, cf) >= 0) { bonus = 0.15; break; }
    const score = 0.65 * cov + 0.35 * rec + bonus;
    if (score > 0) scored.push({ qid: f.qid, score: Math.round(score * 1000) / 1000, cov: Math.round(cov * 100) / 100, rec: Math.round(rec * 100) / 100, fiche_id: f.fiche_id, span: f.span, q: f.q });
  }
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0] || null;
  let outcome = "miss";
  if (best && qs.size >= 2 && best.score >= FAQ_DIRECT && best.cov >= 0.8) outcome = "direct";
  else if (best && best.score >= FAQ_ADJACENT) outcome = "adjacent";
  return { best, outcome, candidates: scored.slice(0, 3) };
}
