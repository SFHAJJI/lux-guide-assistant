import test from "node:test";
import assert from "node:assert/strict";
import { parseQuestion } from "../core/question.js";
import { retrieve } from "../core/ladder.js";
import { extractiveAnswer } from "../core/contract.js";
import { validateAnswer } from "../core/validate.js";
import { justifyAbsence } from "../core/absence.js";
import { answerQuestion } from "../core/pipeline.js";
import { toReply } from "../core/reply.js";
import { real, miniDictionary } from "./helpers.mjs";

const { T } = real();
const D = miniDictionary();

test("the extractive answer quotes the guide verbatim and passes the validator", () => {
  const pq = parseQuestion("Combien de mois de loyer pour la garantie locative ?", { T, D, page: "fiche/bail" });
  const R = retrieve(pq, T, D);
  const a = extractiveAnswer(pq, R, T);
  assert.equal(a.answer_found, true);
  assert.ok(a.items[0].spans.length >= 1);
  assert.deepEqual(validateAnswer(a, { T }), []);
});

test("the validator refuses a quote that is not in the cited blocs", () => {
  const bad = { answer_found: true, complete_answer_found: true, language: "fr", items: [{ text: "x", spans: [{ bloc_start: "bail#b2", bloc_end: "bail#b2", quote: "la caution est de douze mois" }] }], caveats: [], conflicting_evidence: false, suggested_clarification: null, keywords_found: [], discovered_keywords: [], extraction_method: "verbatim", confidence: 0.9 };
  const errors = validateAnswer(bad, { T });
  assert.ok(errors.some((e) => /quote is not in the cited blocs/.test(e)));
});

test("the validator refuses spans outside the passages provided, unknown blocs, and inconsistent flags", () => {
  const a = { answer_found: false, complete_answer_found: false, language: "fr", items: [{ text: "x", spans: [{ bloc_start: "nope#b1", bloc_end: "nope#b1", quote: "x" }] }], caveats: [], conflicting_evidence: false, suggested_clarification: null, keywords_found: [], discovered_keywords: [], extraction_method: "na", confidence: 0.5 };
  const errors = validateAnswer(a, { T, allowed: new Set(["bail#b1"]) });
  assert.ok(errors.some((e) => /unknown bloc/.test(e)));
  assert.ok(errors.some((e) => /answer_found=false but 1 item/.test(e)));
});

test("a verbatim answer must carry a quote", () => {
  const a = { answer_found: true, complete_answer_found: true, language: "fr", items: [{ text: "x", spans: [{ bloc_start: "bail#b2", bloc_end: "bail#b2", quote: "" }] }], caveats: [], conflicting_evidence: false, suggested_clarification: null, keywords_found: [], discovered_keywords: [], extraction_method: "verbatim", confidence: 0.9 };
  assert.ok(validateAnswer(a, { T }).some((e) => /empty quote/.test(e)));
});

test("absence carries four kinds of evidence", () => {
  const pq = parseQuestion("Quel est le prix d'un abonnement de ski à Pétange ?", { T, D, page: "fiche/bail" });
  const R = retrieve(pq, T, D);
  const a = justifyAbsence(pq, R, T, D);
  assert.ok(a.read.page && a.read.page.fiche_id === "bail");
  assert.ok(a.searched.some((s) => s.label === "ski" && s.total === 0));
  assert.ok(a.suggestion);
  assert.ok(["concept_absent", "concept_present_hors_sujet"].includes(a.reason));
});

test("the pipeline without a model answers, refuses, and chats, in milliseconds", async () => {
  const deps = { T, D };
  const r1 = await answerQuestion({ question: "Combien de mois de loyer pour la garantie locative ?", page: "fiche/bail" }, deps);
  assert.equal(r1.kind, "answer");
  assert.equal(r1.audit.model_calls_count, 0);
  const rep = toReply(r1, T);
  assert.equal(rep.verdict, "sur_cette_fiche");
  assert.ok(rep.items[0].spans[0].path.fiche);
  const r2 = await answerQuestion({ question: "ski à Pétange" }, deps);
  assert.equal(r2.kind, "absence");
  const r3 = await answerQuestion({ question: "bonjour" }, deps);
  assert.equal(r3.kind, "smalltalk");
  assert.ok(r1.audit.timings.total < 200);
});

test("a fake model that cites a wrong quote is rejected and the code answers instead", async () => {
  const llm = { complete: async ({ schema }) => ({ json: schema.properties.rankings ? { rankings: [], not_found: false } : { answer_found: true, complete_answer_found: true, language: "fr", items: [{ text: "Invention", spans: [{ bloc_start: "bail#b2", bloc_end: "bail#b2", quote: "texte qui n'existe pas" }] }], caveats: [], conflicting_evidence: false, suggested_clarification: null, keywords_found: [], discovered_keywords: [], extraction_method: "verbatim", confidence: 0.99 }, model: "fake" }) };
  const r = await answerQuestion({ question: "Quels meubles peut-on installer dans un logement loué ?", page: "fiche/bail" }, { T, D, llm });
  assert.equal(r.kind, "answer");
  assert.equal(r.audit.generated_by, "code");
  assert.equal(r.audit.validation.status, "rejected_then_code");
  assert.ok(r.audit.model_calls.length >= 1);
});
