// Brick 3, part two: retrieval as filtering. A scope ladder, not a search.
//   0. the FAQ as a cache (a direct hit needs no model),
//   1. the page the reader is on (its blocs are candidates even with no hit: the reader pinned it),
//   2. the rest of the guide, routed by the fiche table,
// and a deterministic arbiter: when one section wins by a clear margin, no model is consulted ("the signal is the margin").
// Everything it decides is written in the result, with the method that produced each candidate.
import { matchFaq } from "./faq.js";
import { scoreBlocs, conceptSweep } from "./detectors.js";

export const MIN_SCORE = 1.25;     // below this, nothing in the guide carries the answer; a hit must also be specific
export const CLEAR_TOP = 2.5;      // a top score at or above this, with a clear margin, needs no arbiter
export const CLEAR_MARGIN = 1.0;   // margin between the best section and the best section of another fiche
export const ON_PAGE_RATIO = 0.75; // the page wins unless another fiche beats it by more than this ratio

// Keywords prove absence: when a third or more of the reader's rare words appear nowhere in the best fiche, the fiche
// is about something else, however well its other words matched ("abonnement de salle de sport" is not housing).
function rareWordsMissing(pq, top, T) {
  const rare = pq.direct.filter((k) => (k.idf ?? 0) >= 0.6);
  if (pq.direct.length < 3 || !rare.length) return false;
  // A word the dictionary already explains (a variant of a matched concept) is not a missing subject.
  const explained = new Set(pq.keywords.filter((k) => k.source === "dictionary").flatMap((k) => k.stems || []));
  const blocs = T.blocsByFiche.get(top.fiche_id) || [];
  const f = T.ficheById.get(top.fiche_id);
  const missing = rare.filter((k) => !explained.has(k.stem) && !blocs.some((b) => b._stems.has(k.stem)) && !f._titleStems.has(k.stem) && !f._tagStems.has(k.stem));
  return missing.length / pq.direct.length >= 0.34;
}

export function retrieve(pq, T, D) {
  const pageFiche = pq.scope.fiche_id || pq.scope.inherited_fiche_id || null;
  const faq = matchFaq(pq, T);
  const { candidates, sweep } = scoreBlocs(pq, T, D, { faq, pageFiche });

  // Sections: the best bloc of each, then the span around it.
  const bySection = new Map();
  for (const c of candidates) {
    if (!c.specific) continue; // one generic word is not evidence; it still counts in the sweep and as closest mention
    const s = bySection.get(c.section_id);
    if (!s || c.score > s.score) bySection.set(c.section_id, { section_id: c.section_id, fiche_id: c.fiche_id, score: c.score, best: c });
  }
  const sections = [...bySection.values()].sort((a, b) => b.score - a.score);
  const top = sections[0] || null;
  const otherFiche = sections.find((s) => top && s.fiche_id !== top.fiche_id) || null;
  const margin = top ? Math.round((top.score - (otherFiche ? otherFiche.score : 0)) * 100) / 100 : 0;

  const rungs = [];
  rungs.push({ rung: "faq", outcome: faq.outcome, best: faq.best ? { qid: faq.best.qid, score: faq.best.score, fiche_id: faq.best.fiche_id } : null });
  let pageTop = null;
  if (pageFiche) {
    pageTop = sections.find((s) => s.fiche_id === pageFiche) || null;
    rungs.push({ rung: "page", fiche_id: pageFiche, candidates: candidates.filter((c) => c.fiche_id === pageFiche).length, top: pageTop ? pageTop.score : 0 });
  }
  rungs.push({ rung: "site", candidates: candidates.length, fiches: new Set(candidates.map((c) => c.fiche_id)).size, top: top ? top.score : 0, margin });

  const spanOf = (sec) => {
    const blocs = candidates.filter((c) => c.section_id === sec.section_id).sort((a, b) => a.n - b.n);
    const best = sec.best;
    let start = best.n, end = best.n;
    const floor = Math.max(MIN_SCORE * 0.6, best.score * 0.6);
    const byN = new Map(blocs.map((b) => [b.n, b]));
    while (byN.has(start - 1) && byN.get(start - 1).score >= floor && end - start < 2) start--;
    while (byN.has(end + 1) && byN.get(end + 1).score >= floor && end - start < 2) end++;
    return { bloc_start: `${sec.fiche_id}#b${start}`, bloc_end: `${sec.fiche_id}#b${end}`, best_bloc: best.bloc_id };
  };

  let route, verdict, primary = null, arbiter_needed = false, confidence = 0;

  if (faq.outcome === "direct" && faq.best.fiche_id) {
    route = "faq_direct";
    const f = faq.best;
    const span = f.span ? { bloc_start: `${f.fiche_id}#b${f.span.bloc_start}`, bloc_end: `${f.fiche_id}#b${f.span.bloc_end}`, best_bloc: `${f.fiche_id}#b${f.span.bloc_start}` } : null;
    const sec = span ? T.blocById.get(span.bloc_start)?.section_id : T.sectionsByFiche.get(f.fiche_id)?.[0]?.section_id;
    primary = { fiche_id: f.fiche_id, section_id: sec, span, score: f.score, via: "faq", qid: f.qid };
    verdict = !pageFiche ? "trouve" : f.fiche_id === pageFiche ? "sur_cette_fiche" : "ailleurs";
    confidence = Math.min(0.95, 0.6 + f.score / 3);
  } else if (top && top.score >= MIN_SCORE && !rareWordsMissing(pq, top, T)) {
    let chosen = top;
    if (pageTop && pageTop.score >= MIN_SCORE && pageTop.score >= top.score * ON_PAGE_RATIO) chosen = pageTop;
    primary = { fiche_id: chosen.fiche_id, section_id: chosen.section_id, span: spanOf(chosen), score: chosen.score, via: "detectors" };
    route = chosen === pageTop ? "page" : "site";
    verdict = !pageFiche ? "trouve" : chosen.fiche_id === pageFiche ? "sur_cette_fiche" : "ailleurs";
    const competitor = sections.find((s) => s.fiche_id !== chosen.fiche_id);
    const m = chosen.score - (competitor ? competitor.score : 0);
    arbiter_needed = !(chosen.score >= CLEAR_TOP && m >= CLEAR_MARGIN);
    confidence = Math.max(0.3, Math.min(0.95, 0.4 + chosen.score / 8 + Math.min(m, 2) / 8));
  } else {
    route = "none";
    verdict = "pas_dans_le_guide";
    confidence = top ? 0.2 : 0.05;
  }

  if (route === "none" && top) rungs.push({ rung: "absence", reason: top.score >= MIN_SCORE ? "rare words of the question absent from the best fiche" : "no specific candidate above the minimum" });

  // Roles, deterministically: the chosen section is primary; the next sections of other fiches are supporting.
  const roles = [];
  for (const s of sections.slice(0, 8)) {
    const role = primary && s.section_id === primary.section_id ? "primary" : roles.filter((r) => r.role === "supporting").length < 3 && s.score >= MIN_SCORE * 0.8 ? "supporting" : "discarded";
    roles.push({ section_id: s.section_id, fiche_id: s.fiche_id, score: s.score, best_bloc: s.best.bloc_id, methods: s.best.methods, matched: s.best.matched, role, reason: null });
  }

  return {
    route, verdict, primary, confidence: Math.round(confidence * 100) / 100, arbiter_needed, margin,
    page_fiche: pageFiche, faq, rungs, sections: roles, candidates: candidates.slice(0, 12), n_candidates: candidates.length,
    sweep: conceptSweep(sweep, T)
  };
}
