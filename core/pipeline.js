// The pipeline, brick by brick: parse the question, retrieve by filtering, arbitrate if the margin is flat,
// generate under the contract (model or code), validate, and justify absence. Every decision lands in `audit`.
// Bounded loops only: one arbiter call at most, one generation retry at most, one widening at most.
import { parseQuestion } from "./question.js";
import { retrieve, MIN_SCORE } from "./ladder.js";
import { extractiveAnswer, ANSWER_SCHEMA } from "./contract.js";
import { validateAnswer } from "./validate.js";
import { justifyAbsence } from "./absence.js";
import { buildGenerationPrompt, buildArbiterPrompt, ARBITER_SCHEMA } from "./prompts.js";
import { blocsOfSpan, pathOf, sectionsBlocs } from "./tables.js";
import { normalizeForQuote, sentences, stems } from "./text.js";

const SMALLTALK = {
  greeting: { fr: "Bonjour. Posez votre question sur votre installation : démarches, logement, impôts, école, véhicule. Je réponds à partir des fiches du guide et je vous montre le passage.", en: "Hello. Ask about settling in: formalities, housing, taxes, school, your car. I answer from the guide's pages and show you the passage.", de: "Hallo. Fragen Sie zu Ihrer Ankunft: Formalitäten, Wohnen, Steuern, Schule, Auto. Ich antworte aus den Seiten des Guides und zeige die Stelle.", pt: "Olá. Pergunte sobre a sua instalação: formalidades, habitação, impostos, escola, carro. Respondo a partir das fichas do guia e mostro a passagem." },
  thanks: { fr: "Avec plaisir. Autre chose ?", en: "You're welcome. Anything else?", de: "Gern geschehen. Noch etwas?", pt: "De nada. Mais alguma coisa?" },
  bye: { fr: "Bonne installation au Luxembourg. Le guide reste là.", en: "Good luck settling in. The guide stays here.", de: "Alles Gute für Ihre Ankunft. Der Guide bleibt hier.", pt: "Boa instalação no Luxemburgo. O guia fica aqui." }
};

export async function answerQuestion(input, deps) {
  const { T, D, llm = null, coverage = null, options = {} } = deps;
  const t0 = now();
  const audit = { model_calls: [], prompt_version: null, timings: {} };
  const pq = parseQuestion(input.question, { T, D, page: input.page, profile: input.profile, previous: input.previous });
  audit.question = summarizeQuestion(pq);

  if (pq.smalltalk) return finish({ kind: "smalltalk", text: SMALLTALK[pq.smalltalk][pq.language] || SMALLTALK[pq.smalltalk].fr, pq, audit }, t0);
  if ((!pq.direct.length && !pq.concepts.length) || pq.vague) {
    return finish({ kind: "precisez", text: pq.language === "en" ? "Could you say a little more? One topic word is enough: deposit, car, school, tax class…" : "Pouvez-vous préciser ? Un mot de sujet suffit : caution, voiture, école, classe d'impôt…", pq, audit }, t0);
  }

  const R = retrieve(pq, T, D);
  audit.timings.retrieve = now() - t0;
  audit.retrieval = summarizeRetrieval(R);

  // One arbiter call, only when the margin is flat and a model is available.
  if (R.arbiter_needed && llm && R.sections.length > 1 && !options.noArbiter) {
    const p = buildArbiterPrompt(pq, R, T);
    const call = await safeCall(llm, { ...p, schema: ARBITER_SCHEMA, name: "arbiter", purpose: "arbiter" }, audit);
    if (call && call.json) applyArbiter(R, call.json, T, pq);
  }

  if (R.verdict === "pas_dans_le_guide" || !R.primary) {
    const absence = justifyAbsence(pq, R, T, D, coverage);
    return finish({ kind: "absence", pq, R, absence, audit }, t0);
  }

  // Generation: fast path without a model for FAQ direct hits and clear anchors; otherwise the model under the contract.
  const fast = R.route === "faq_direct" || (!R.arbiter_needed && ["fact", "amount", "delay"].includes(pq.shape) && R.primary.score >= MIN_SCORE + 1 && pq.language === "fr");
  let answer = null, validation = { status: "n/a", errors: [] }, generated_by = "code";
  const contextBlocs = contextFor(R, T);
  if (llm && !fast && !options.noGeneration) {
    const allowed = new Set(contextBlocs.map((b) => b.bloc_id));
    const p = buildGenerationPrompt(pq, R, T, contextBlocs);
    audit.prompt_version = p.prompt_version; audit.fragments_applied = p.fragments_applied;
    const maxTokens = ["list", "procedure"].includes(pq.shape) || pq.listing ? 2500 : 1400;
    let call = await safeCall(llm, { ...p, schema: ANSWER_SCHEMA, name: "answer", purpose: "generation", maxTokens }, audit);
    let errors = call && call.json ? validateAnswer(call.json, { T, allowed, shape: pq.shape }) : ["no model output"];
    // A quote the model shortened or smoothed is replaced by the sentence of the cited bloc it overlaps most:
    // the snippet the reader sees is always the guide's, never the model's. A quote that matches nothing stays an error.
    if (errors.length && call && call.json) { repairQuotes(call.json, T, audit); errors = validateAnswer(call.json, { T, allowed, shape: pq.shape }); }
    if (errors.length && call && call.json) {
      const retry = await safeCall(llm, { system: p.system, user: p.user + `\n\nTa réponse précédente a été refusée par le validateur : ${errors.join(" ; ")}. Corrige : les identifiants de bloc doivent être ceux de la colonne BLOC et chaque quote doit être copiée mot pour mot depuis ces blocs.`, schema: ANSWER_SCHEMA, name: "answer", purpose: "generation_retry", maxTokens }, audit);
      if (retry && retry.json) { call = retry; repairQuotes(call.json, T, audit); errors = validateAnswer(retry.json, { T, allowed, shape: pq.shape }); }
    }
    if (call && call.json && !errors.length) { answer = call.json; generated_by = "model"; validation = { status: "ok", errors: [] }; }
    else { validation = { status: "rejected", errors }; }
  }
  if (!answer) {
    answer = extractiveAnswer(pq, R, T);
    const errors = validateAnswer(answer, { T });
    validation = { status: errors.length ? "code_invalid" : validation.status === "rejected" ? "rejected_then_code" : "ok_code", errors: [...validation.errors, ...errors] };
    if (errors.length) answer.items = answer.items.filter((it) => !validateAnswer({ ...answer, items: [it] }, { T }).length);
    if (!answer.items.length) { answer.answer_found = false; }
  }
  audit.validation = validation; audit.generated_by = generated_by;

  if (!answer.answer_found) {
    // The model read the passages and found no answer there: that is evidence too.
    const absence = justifyAbsence(pq, R, T, D, coverage);
    absence.model_caveats = answer.caveats || [];
    absence.reason = "passages_lus_sans_reponse";
    return finish({ kind: "absence", pq, R, absence, answer, audit }, t0);
  }
  return finish({ kind: "answer", pq, R, answer: resolve(answer, T), audit }, t0);
}

function repairQuotes(answer, T, audit) {
  let repaired = 0;
  for (const it of answer.items || []) {
    for (const sp of it.spans || []) {
      const blocs = blocsOfSpan(T, sp);
      if (!blocs.length || !sp.quote) continue;
      const hay = normalizeForQuote(blocs.map((b) => b.text).join(" "));
      if (hay.includes(normalizeForQuote(sp.quote))) continue;
      const want = new Set(stems(sp.quote));
      let best = null;
      for (const b of blocs) for (const s of sentences(b.text)) {
        const have = new Set(stems(s));
        let inter = 0; for (const w of want) if (have.has(w)) inter++;
        const score = want.size ? inter / want.size : 0;
        if (score >= 0.6 && (!best || score > best.score)) best = { s, score };
      }
      if (best) { sp.quote = best.s; repaired++; }
    }
  }
  if (repaired) audit.quotes_repaired = (audit.quotes_repaired || 0) + repaired;
}

function contextFor(R, T) {
  // Anchor small, context large: the whole primary fiche (300 words on average) plus the best supporting section.
  const blocs = [...(T.blocsByFiche.get(R.primary.fiche_id) || [])];
  const sup = R.sections.find((s) => s.role === "supporting" && s.fiche_id !== R.primary.fiche_id);
  if (sup) for (const b of sectionsBlocs(T, sup.section_id)) blocs.push(b);
  return blocs;
}

function applyArbiter(R, out, T, pq) {
  const byId = new Map(R.sections.map((s) => [s.section_id, s]));
  let primary = null;
  for (const r of out.rankings || []) {
    const s = byId.get(r.section_id);
    if (!s) continue;
    s.role = r.role; s.reason = r.reason;
    if (r.role === "primary" && !primary) primary = s;
  }
  R.arbiter = { applied: true, not_found: !!out.not_found, primary: primary ? primary.section_id : null };
  if (out.not_found && !primary) { R.verdict = "pas_dans_le_guide"; R.primary = null; R.route = "none"; return; }
  if (primary && (!R.primary || primary.section_id !== R.primary.section_id)) {
    const sec = T.sectionById.get(primary.section_id);
    const cands = R.candidates.filter((c) => c.section_id === primary.section_id).sort((a, b) => b.score - a.score);
    const best = cands[0] || { n: sec.start_bloc, bloc_id: primary.best_bloc };
    R.primary = { fiche_id: primary.fiche_id, section_id: primary.section_id, span: { bloc_start: best.bloc_id, bloc_end: best.bloc_id, best_bloc: best.bloc_id }, score: primary.score, via: "arbiter" };
    R.route = primary.fiche_id === R.page_fiche ? "page" : "site";
    R.verdict = !R.page_fiche ? "trouve" : primary.fiche_id === R.page_fiche ? "sur_cette_fiche" : "ailleurs";
    for (const s of R.sections) if (s.role === "primary" && s.section_id !== primary.section_id) s.role = "supporting";
  }
}

async function safeCall(llm, req, audit) {
  const t = now();
  try {
    const r = await llm.complete(req);
    audit.model_calls.push({ purpose: req.purpose, ms: Math.round(now() - t), model: r.model || null, ok: true, usage: r.usage || null });
    return r;
  } catch (e) {
    audit.model_calls.push({ purpose: req.purpose, ms: Math.round(now() - t), ok: false, error: String(e.message || e).slice(0, 200) });
    return null;
  }
}

function resolve(answer, T) {
  const items = answer.items.map((it) => ({
    ...it,
    spans: (it.spans || []).map((sp) => ({ ...sp, path: pathOf(T, sp.bloc_start), blocs: blocsOfSpan(T, sp).map((b) => b.bloc_id) }))
  }));
  return { ...answer, items };
}

function summarizeQuestion(pq) {
  return { language: pq.language, shape: pq.shape, listing: pq.listing, corrections: pq.corrections, direct: pq.direct.map((k) => k.text), concepts: pq.concepts.map((c) => ({ id: c.id, variant: c.variant, lang: c.lang })), patterns: pq.patterns.map((p) => p.id), exclusions: pq.generation.exclusions, scope: pq.scope, smalltalk: pq.smalltalk };
}

function summarizeRetrieval(R) {
  return { route: R.route, verdict: R.verdict, confidence: R.confidence, arbiter_needed: R.arbiter_needed, margin: R.margin, page_fiche: R.page_fiche, faq: { outcome: R.faq.outcome, best: R.faq.best ? { qid: R.faq.best.qid, score: R.faq.best.score } : null }, rungs: R.rungs, primary: R.primary, sections: R.sections.map((s) => ({ section_id: s.section_id, fiche_id: s.fiche_id, score: s.score, role: s.role, methods: s.methods, matched: s.matched.map((m) => m.text), reason: s.reason })), n_candidates: R.n_candidates, sweep: R.sweep };
}

function finish(result, t0) {
  result.audit.timings.total = Math.round(now() - t0);
  result.audit.model_calls_count = result.audit.model_calls.length;
  return result;
}

function now() { return typeof performance !== "undefined" ? performance.now() : Date.now(); }
