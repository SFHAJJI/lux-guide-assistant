// Brick 4, the contract. An answer is a typed object whose every claim points at blocs of the guide.
// The same contract is filled by the model (through the proxy) or by code alone (the extractive path):
// a FAQ direct hit, or a clear anchor, needs no model at all.
import { sentences } from "./text.js";
import { blocsOfSpan } from "./tables.js";

export const ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer_found: { type: "boolean" },
    complete_answer_found: { type: "boolean" },
    language: { type: "string", enum: ["fr", "en", "de", "pt"] },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string", description: "Une phrase ou deux, dans la langue du lecteur, qui répond. Rien qui ne soit porté par les passages cités." },
          spans: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                bloc_start: { type: "string", description: "Identifiant du premier bloc cité, tel qu'il figure dans la colonne BLOC." },
                bloc_end: { type: "string", description: "Identifiant du dernier bloc cité (le même que bloc_start pour un seul bloc)." },
                quote: { type: "string", description: "Citation textuelle, copiée mot pour mot depuis les blocs cités, en français." }
              },
              required: ["bloc_start", "bloc_end", "quote"]
            }
          }
        },
        required: ["text", "spans"]
      }
    },
    caveats: { type: "array", items: { type: "string" } },
    conflicting_evidence: { type: "boolean" },
    suggested_clarification: { type: ["string", "null"] },
    keywords_found: { type: "array", items: { type: "string" } },
    discovered_keywords: { type: "array", items: { type: "string" } },
    extraction_method: { type: "string", enum: ["verbatim", "computed", "inferred", "na"] },
    confidence: { type: "number" }
  },
  required: ["answer_found", "complete_answer_found", "language", "items", "caveats", "conflicting_evidence", "suggested_clarification", "keywords_found", "discovered_keywords", "extraction_method", "confidence"]
};

// The answer code can write without a model: the guide's own sentences, chosen by the detectors.
export function extractiveAnswer(pq, R, T) {
  if (!R.primary) return { answer_found: false, complete_answer_found: false, language: "fr", items: [], caveats: ["Aucun passage du guide ne porte la réponse."], conflicting_evidence: false, suggested_clarification: null, keywords_found: [], discovered_keywords: [], extraction_method: "na", confidence: R.confidence, source: "code" };

  if (R.primary.via === "faq") {
    const f = T.faqById.get(R.primary.qid);
    const spans = R.primary.span ? [{ bloc_start: R.primary.span.bloc_start, bloc_end: R.primary.span.bloc_end, quote: bestQuote(blocsOfSpan(T, R.primary.span), pq) }] : [];
    return { answer_found: true, complete_answer_found: true, language: "fr", items: [{ text: f.a, spans, faq: f.qid }], caveats: [], conflicting_evidence: false, suggested_clarification: null, keywords_found: pq.direct.map((k) => k.text), discovered_keywords: [], extraction_method: "verbatim", confidence: R.confidence, source: "faq" };
  }

  const blocs = blocsOfSpan(T, R.primary.span);
  const stemsWanted = new Set([...pq.direct.map((k) => k.stem), ...pq.keywords.filter((k) => k.source === "dictionary" && k.stem).map((k) => k.stem)]);
  const spans = [];
  const whole = pq.listing || ["list", "procedure", "explain"].includes(pq.shape);
  for (const b of blocs) {
    const sents = sentences(b.text);
    const hit = sents.filter((s) => { const f = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); return [...stemsWanted].some((st) => f.includes(st)); });
    const chosen = (whole && b.text.length <= 480) || b.text.length <= 200 ? [b.text] : hit.length ? hit.slice(0, 2) : sents.slice(0, 1);
    for (const s of chosen) spans.push({ bloc_start: b.bloc_id, bloc_end: b.bloc_id, quote: s });
    if (spans.length >= 3) break;
  }
  let text = spans.map((s) => s.quote).join(" ");
  // The guide's own key point, when it carries the reader's words, is the crispest answer: it becomes the text, and the
  // paragraph stays the quoted passage. For a list or a procedure, the passage itself is the answer.
  const retenir = (T.blocsByFiche.get(R.primary.fiche_id) || []).filter((b) => b.kind === "retenir").find((b) => [...stemsWanted].filter((st) => b._stems.has(st)).length >= Math.min(2, stemsWanted.size));
  if (retenir && !blocs.some((b) => b.bloc_id === retenir.bloc_id)) {
    if (!whole) text = retenir.text;
    spans.push({ bloc_start: retenir.bloc_id, bloc_end: retenir.bloc_id, quote: retenir.text });
  }
  const items = [{ text, spans }];
  return { answer_found: true, complete_answer_found: !pq.listing, language: "fr", items, caveats: pq.listing ? ["Réponse extraite sans modèle : la liste peut être incomplète, ouvrez la fiche."] : [], conflicting_evidence: false, suggested_clarification: null, keywords_found: pq.direct.filter((k) => blocs.some((b) => b._stems.has(k.stem))).map((k) => k.text), discovered_keywords: [], extraction_method: "verbatim", confidence: R.confidence, source: "code" };
}

function bestQuote(blocs, pq) {
  const stemsWanted = new Set(pq.direct.map((k) => k.stem));
  for (const b of blocs) {
    const s = sentences(b.text).find((x) => { const f = x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); return [...stemsWanted].some((st) => f.includes(st)); });
    if (s) return s;
  }
  return blocs[0] ? sentences(blocs[0].text)[0] || blocs[0].text : "";
}
