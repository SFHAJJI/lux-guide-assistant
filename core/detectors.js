// Brick 3, part one: the detectors. Each one is cheap, deterministic and leaves its name on the candidate.
// keyword (the reader's words), dictionary (the expert's variants), coverage (all the reader's words together),
// heading (the section title), fiche (the fiche's title and tags), cooc (a value next to the concept, for value-shaped
// questions), retenir (the guide's own key points), faq (a bloc that backs a matching FAQ entry), page (the pinned page).
import { conceptInBloc } from "./dictionary.js";
import { phraseIndex, stems } from "./text.js";

export const WEIGHTS = { keyword: 1.0, dictionary: 0.7, coverage: 1.0, coverage_partial: 0.5, heading: 0.75, fiche: 0.5, cooc: 1.0, cooc_weak: 0.5, retenir: 0.25, faq_direct: 1.5, faq_adjacent: 0.75, page: 0.5 };

export function scoreBlocs(pq, T, D, { faq = null, pageFiche = null } = {}) {
  const direct = pq.direct;
  const directStems = new Set(direct.map((k) => k.stem));
  const concepts = pq.concepts.map((c) => D.byId.get(c.id)).filter(Boolean);
  const valueShape = ["amount", "delay", "date"].includes(pq.shape);
  const qStems = new Set([...direct.map((k) => k.stem), ...concepts.flatMap((c) => c.variants.filter((v) => v.lang === "fr").flatMap((v) => v.stems))]);

  const ficheBonus = new Map();
  for (const f of T.fiche) {
    let b = 0;
    for (const s of qStems) if (f._titleStems.has(s) || f._tagStems.has(s)) { b = WEIGHTS.fiche; break; }
    if (!b) for (const c of concepts) if (c.fiches.includes(f.id)) { b = WEIGHTS.fiche; break; }
    if (b) ficheBonus.set(f.id, b);
  }
  const sectionHit = new Map();
  for (const s of T.section) { if (s.level === 1) continue; for (const st of qStems) if (s._stems.has(st)) { sectionHit.set(s.section_id, true); break; } }

  const faqSpanIds = new Set();
  let faqWeight = 0;
  if (faq && faq.best && faq.outcome !== "miss" && faq.best.span && faq.best.fiche_id) {
    const blocs = T.blocsByFiche.get(faq.best.fiche_id) || [];
    for (const b of blocs) if (b.n >= faq.best.span.bloc_start && b.n <= faq.best.span.bloc_end) faqSpanIds.add(b.bloc_id);
    faqWeight = faq.outcome === "direct" ? WEIGHTS.faq_direct : WEIGHTS.faq_adjacent;
  }

  const candidates = [];
  const sweep = { concepts: new Map(), keywords: new Map() };
  for (const c of concepts) sweep.concepts.set(c.id, new Map());
  for (const k of direct) sweep.keywords.set(k.stem, new Map());

  for (const b of T.bloc) {
    let score = 0;
    const methods = [], matched = [];
    let directHits = 0, specific = false;
    for (const k of direct) {
      if (b._stems.has(k.stem)) {
        directHits++; score += WEIGHTS.keyword * k.weight; matched.push({ type: "keyword", text: k.text });
        if (k.idf >= 0.5) specific = true;
        const m = sweep.keywords.get(k.stem); m.set(b.fiche_id, (m.get(b.fiche_id) || 0) + 1);
      }
    }
    if (directHits) methods.push("keyword");
    // A fiche whose title the reader names is a candidate through its introduction, even before any bloc hit.
    if (!directHits && b.kind === "chapo" && ficheBonus.get(b.fiche_id)) {
      const f = T.ficheById.get(b.fiche_id);
      if ([...directStems].some((s) => f._titleStems.has(s))) { directHits = 1; specific = true; score += WEIGHTS.keyword + WEIGHTS.heading; methods.push("title"); matched.push({ type: "title", text: f.titre }); }
    }
    let conceptHits = 0;
    for (const c of concepts) {
      const v = conceptInBloc(c, b._fold, b._stems);
      if (v) {
        conceptHits++; matched.push({ type: "concept", id: c.id, text: v });
        const m = sweep.concepts.get(c.id); m.set(b.fiche_id, (m.get(b.fiche_id) || 0) + 1);
        // The reader's own word already counted this hit: the dictionary only adds what the reader did not say.
        if (!stems(v).every((s) => directStems.has(s))) score += WEIGHTS.dictionary;
      }
    }
    if (conceptHits) { methods.push("dictionary"); specific = true; }
    if (!directHits && !conceptHits) continue;
    // Specific evidence: a concept, two of the reader's words, or one rare word when the question has at most two.
    if (directHits >= 2) specific = true;
    if (specific && !conceptHits && directHits < 2 && direct.length > 2 && !methods.includes("title")) specific = false;

    if (direct.length >= 2 && directHits === direct.length) { score += WEIGHTS.coverage; methods.push("coverage"); }
    else if (direct.length >= 3 && directHits >= Math.ceil(direct.length * 2 / 3)) { score += WEIGHTS.coverage_partial; methods.push("coverage"); }
    if (sectionHit.get(b.section_id)) { score += WEIGHTS.heading; methods.push("heading"); }
    const fb = ficheBonus.get(b.fiche_id); if (fb) { score += fb; methods.push("fiche"); }
    // Co-occurrence: a value next to the concept, not a value next to one generic word.
    if (b._hasValue && specific && (valueShape || pq.shape === "yes_no")) { score += valueShape ? WEIGHTS.cooc : WEIGHTS.cooc_weak; methods.push("cooc"); }
    if (b.kind === "retenir") { score += WEIGHTS.retenir; methods.push("retenir"); }
    if (faqSpanIds.has(b.bloc_id)) { score += faqWeight; methods.push("faq"); }
    if (pageFiche && b.fiche_id === pageFiche) { score += WEIGHTS.page; methods.push("page"); }
    candidates.push({ bloc_id: b.bloc_id, fiche_id: b.fiche_id, section_id: b.section_id, n: b.n, score: Math.round(score * 100) / 100, methods, matched, direct_hits: directHits, concept_hits: conceptHits, specific });
  }
  candidates.sort((a, b) => b.score - a.score || a.n - b.n);
  return { candidates, sweep, ficheBonus };
}

export function conceptSweep(sweep, T) {
  const out = [];
  for (const [id, m] of sweep.concepts) out.push({ concept: id, hits: [...m.entries()].map(([f, n]) => ({ fiche_id: f, fiche: T.ficheById.get(f)?.titre, n })).sort((a, b) => b.n - a.n) });
  for (const [stem, m] of sweep.keywords) out.push({ keyword: stem, hits: [...m.entries()].map(([f, n]) => ({ fiche_id: f, fiche: T.ficheById.get(f)?.titre, n })).sort((a, b) => b.n - a.n) });
  return out;
}

export { phraseIndex };
