// "Pas dans le guide" is a verdict that comes with its defence: four kinds of evidence, one from each brick.
//   1. what was read (coverage), 2. what was searched (the concepts and their variants, the reader's words),
//   3. the sweep (hits per fiche, not top-k) and the closest mention with why it is not the answer,
//   4. a suggestion: another fiche, a tool of the site, or the official source.
import { pathOf } from "./tables.js";

export function justifyAbsence(pq, R, T, D, coverage = null) {
  const page = R.page_fiche ? T.ficheById.get(R.page_fiche) : null;
  const read = {
    page: page ? { fiche_id: page.id, fiche: page.titre, sections: page.n_sections, blocs: page.n_blocs } : null,
    guide: { fiches: T.fiche.filter((f) => f.kind !== "parcours").length, sections: T.section.length, blocs: T.bloc.length, verifie: T.verifie }
  };

  const searched = [];
  for (const c of pq.concepts) {
    const concept = D.byId.get(c.id);
    const sw = R.sweep.find((s) => s.concept === c.id);
    searched.push({ kind: "concept", label: concept.label, variants: concept.variants.filter((v) => v.lang === "fr").map((v) => v.text).slice(0, 6), hits: sw ? sw.hits : [], total: sw ? sw.hits.reduce((a, h) => a + h.n, 0) : 0 });
  }
  for (const k of pq.direct) {
    if (pq.concepts.some((c) => D.byId.get(c.id).variants.some((v) => v.stems.includes(k.stem)))) continue;
    const sw = R.sweep.find((s) => s.keyword === k.stem);
    searched.push({ kind: "mot", label: k.text, variants: [], hits: sw ? sw.hits : [], total: sw ? sw.hits.reduce((a, h) => a + h.n, 0) : 0 });
  }
  const anyHit = searched.some((s) => s.total > 0);
  const reason = !pq.direct.length && !pq.concepts.length ? "question_vide" : !anyHit ? "concept_absent" : "concept_present_hors_sujet";

  let closest = null;
  const best = R.candidates[0];
  if (best) {
    const b = T.blocById.get(best.bloc_id);
    const p = pathOf(T, best.bloc_id);
    const missing = pq.direct.filter((k) => !b._stems.has(k.stem)).map((k) => k.text);
    closest = { bloc_id: best.bloc_id, fiche_id: p.fiche_id, fiche: p.fiche, section: p.section, snippet: b.text.length > 220 ? b.text.slice(0, 217) + "…" : b.text, score: best.score, specific: !!best.specific,
      why: missing.length ? `ce passage parle de ${best.matched.map((m) => `« ${m.text} »`).slice(0, 2).join(" et ")} mais pas de ${missing.map((m) => `« ${m} »`).join(", ")}` : "ce passage effleure le sujet sans y répondre" };
  }

  let suggestion = null;
  const folded = pq.folded;
  if (/\b(salaire|net|brut|impot|classe)\b/.test(folded) && /\d/.test(pq.original)) suggestion = { type: "outil", label: "Le simulateur de salaire net", hash: "#simulateur" };
  else if (/\b(assurance|contrat|garantie|sinistre|franchise)\b/.test(folded)) suggestion = { type: "outil", label: "Le comparateur d'assurances", hash: "#comparateur" };
  else if (closest && closest.specific) suggestion = { type: "fiche", label: closest.fiche, hash: `#fiche/${closest.fiche_id}` };
  else if (page && page.sources?.length) suggestion = { type: "source", label: page.sources[0].t, url: page.sources[0].u };
  else suggestion = { type: "source", label: "Guichet.lu, le portail officiel des démarches", url: "https://guichet.public.lu/fr.html" };

  return { reason, read, searched, closest, suggestion, coverage };
}
