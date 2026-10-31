// The validator runs before anything reaches the reader. A typed answer is not a checked answer.
// Shape, evidence, format: every problem is reported, nothing invalid is shown.
import { normalizeForQuote } from "./text.js";
import { spanText } from "./tables.js";

export function validateAnswer(answer, { T, allowed = null, shape = null } = {}) {
  const errors = [];
  if (!answer || typeof answer !== "object") return ["answer is not an object"];
  const items = Array.isArray(answer.items) ? answer.items : (errors.push("items is not an array"), []);
  if (Boolean(items.length) !== Boolean(answer.answer_found)) errors.push(`answer_found=${answer.answer_found} but ${items.length} item(s)`);
  if (answer.answer_found && answer.extraction_method === "na") errors.push("extraction_method=na with an answer");
  if (!["fr", "en", "de", "pt"].includes(answer.language)) errors.push(`language ${answer.language} unknown`);
  if (typeof answer.confidence !== "number" || answer.confidence < 0 || answer.confidence > 1) errors.push("confidence out of [0,1]");

  items.forEach((it, i) => {
    if (!it.text || !String(it.text).trim()) errors.push(`item ${i}: empty text`);
    const spans = Array.isArray(it.spans) ? it.spans : [];
    if (!spans.length && !it.faq) errors.push(`item ${i}: no span`);
    spans.forEach((sp, j) => {
      const a = T.blocById.get(sp.bloc_start), b = T.blocById.get(sp.bloc_end);
      if (!a) { errors.push(`item ${i} span ${j}: unknown bloc ${sp.bloc_start}`); return; }
      if (!b) { errors.push(`item ${i} span ${j}: unknown bloc ${sp.bloc_end}`); return; }
      if (a.fiche_id !== b.fiche_id) { errors.push(`item ${i} span ${j}: blocs of two fiches`); return; }
      if (b.n < a.n) { errors.push(`item ${i} span ${j}: bloc_end before bloc_start`); return; }
      // A list or a procedure may cite a run of steps; a fact cites a few blocs at most.
      const maxWidth = ["list", "procedure"].includes(shape) ? 12 : 4;
      if (b.n - a.n > maxWidth) errors.push(`item ${i} span ${j}: span of ${b.n - a.n + 1} blocs, too wide`);
      if (allowed && (!allowed.has(a.bloc_id) || !allowed.has(b.bloc_id))) errors.push(`item ${i} span ${j}: bloc outside the passages provided`);
      const q = normalizeForQuote(sp.quote);
      if (!q) { errors.push(`item ${i} span ${j}: empty quote`); return; }
      const hay = normalizeForQuote(spanText(T, sp));
      if (!hay.includes(q)) errors.push(`item ${i} span ${j}: quote is not in the cited blocs`);
    });
  });
  if (answer.extraction_method === "verbatim" && items.some((it) => (it.spans || []).some((sp) => !sp.quote))) errors.push("verbatim without a quote");
  if (shape === "list" && answer.answer_found && items.length === 1 && items[0].spans.length === 1 && /\n|;|•/.test(items[0].text)) errors.push("listing answer in one item: one item per element");
  return errors;
}
