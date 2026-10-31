// What the interface receives: the result of the pipeline, resolved against the tables and trimmed.
// The same shape comes from the proxy (model available) and from the browser's local mode (no model).
import { pathOf, spanText } from "./tables.js";

export function toReply(result, T, { mode = "local" } = {}) {
  const base = { kind: result.kind, mode, language: result.pq?.language || "fr", audit: result.audit, model_calls: result.audit?.model_calls_count || 0 };
  if (result.kind === "smalltalk" || result.kind === "precisez") return { ...base, text: result.text };

  const R = result.R;
  const page = R.page_fiche ? T.ficheById.get(R.page_fiche) : null;
  const common = { ...base, verdict: R.verdict, confidence: R.confidence, page: page ? { fiche_id: page.id, titre: page.titre } : null };

  if (result.kind === "absence") {
    const a = result.absence;
    return { ...common, verdict: "pas_dans_le_guide", absence: {
      reason: a.reason, read: a.read,
      searched: a.searched.map((s) => ({ kind: s.kind, label: s.label, variants: s.variants, total: s.total, hits: s.hits.slice(0, 3) })),
      closest: a.closest, suggestion: a.suggestion, model_caveats: a.model_caveats || []
    } };
  }

  const ans = result.answer;
  const primaryPath = R.primary ? pathOf(T, R.primary.span ? R.primary.span.bloc_start : (T.sectionsByFiche.get(R.primary.fiche_id)[0] && `${R.primary.fiche_id}#b1`)) : null;
  const fiche = R.primary ? T.ficheById.get(R.primary.fiche_id) : null;
  const items = ans.items.map((it) => ({
    text: it.text,
    faq: it.faq || null,
    spans: (it.spans || []).map((sp) => ({ bloc_start: sp.bloc_start, bloc_end: sp.bloc_end, quote: sp.quote, text: spanText(T, sp), path: sp.path || pathOf(T, sp.bloc_start) }))
  }));
  const supporting = R.sections.filter((s) => s.role === "supporting" && s.fiche_id !== R.primary?.fiche_id).slice(0, 2).map((s) => { const p = pathOf(T, s.best_bloc); return { fiche_id: s.fiche_id, fiche: p.fiche, section: p.section, reason: s.reason }; });
  return { ...common,
    generated_by: result.audit.generated_by,
    primary: R.primary ? { fiche_id: R.primary.fiche_id, fiche: fiche?.titre, section_id: R.primary.section_id, section: primaryPath?.section || null, tab: primaryPath?.tab || null, span: R.primary.span, via: R.primary.via } : null,
    items, supporting,
    complete: ans.complete_answer_found, caveats: ans.caveats || [], conflicting: !!ans.conflicting_evidence, clarification: ans.suggested_clarification || null,
    discovered_keywords: ans.discovered_keywords || [], extraction_method: ans.extraction_method,
    sources: fiche ? (fiche.sources || []).slice(0, 2) : [],
    verifie: T.verifie
  };
}
