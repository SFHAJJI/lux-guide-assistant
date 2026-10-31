import test from "node:test";
import assert from "node:assert/strict";
import { parseQuestion } from "../core/question.js";
import { retrieve, MIN_SCORE } from "../core/ladder.js";
import { matchFaq } from "../core/faq.js";
import { real, miniDictionary } from "./helpers.mjs";

const { T } = real();
const D = miniDictionary();
const ask = (q, page = null) => retrieve(parseQuestion(q, { T, D, page }), T, D);

test("the page the reader is on wins when it carries the answer", () => {
  const R = ask("Combien de mois de loyer pour la garantie locative ?", "fiche/bail");
  assert.equal(R.verdict, "sur_cette_fiche");
  assert.equal(R.primary.fiche_id, "bail");
  assert.ok(R.candidates[0].methods.includes("page"));
});

test("the answer elsewhere opens another fiche, with the dictionary routing it", () => {
  const R = ask("Comment immatriculer ma voiture ?", "fiche/bail");
  assert.equal(R.verdict, "ailleurs");
  assert.equal(R.primary.fiche_id, "vehicule");
});

test("a question the guide does not treat is an absence with a sweep", () => {
  const R = ask("Quel est le prix d'un abonnement de ski à Pétange ?");
  assert.equal(R.verdict, "pas_dans_le_guide");
  assert.equal(R.primary, null);
  assert.ok(R.sweep.some((s) => s.keyword === "ski" && s.hits.length === 0));
});

test("every candidate carries its methods and its matched words", () => {
  const R = ask("combien de jours pour déclarer son arrivée", "fiche/arrivee");
  assert.ok(R.candidates.length > 0);
  for (const c of R.candidates) { assert.ok(c.methods.length > 0); assert.ok(c.matched.length > 0); }
  assert.ok(R.candidates[0].methods.includes("keyword"));
});

test("a clear margin needs no arbiter; a flat one asks for it", () => {
  const clear = ask("Combien de mois de loyer pour la garantie locative ?", "fiche/bail");
  assert.equal(clear.arbiter_needed, false);
  const flat = ask("documents");
  assert.equal(flat.arbiter_needed, true);
});

test("the FAQ cache answers a question the guide already lists", () => {
  const f = T.faq[0];
  const pq = parseQuestion(f.q, { T, D });
  const m = matchFaq(pq, T);
  assert.equal(m.outcome, "direct");
  assert.equal(m.best.qid, f.qid);
  const R = retrieve(pq, T, D);
  assert.equal(R.route, "faq_direct");
  assert.equal(R.primary.fiche_id, f.fiche_id);
});

test("the sweep counts hits per fiche for every concept and word", () => {
  const R = ask("caution");
  const sw = R.sweep.find((s) => s.concept === "garantie_locative");
  assert.ok(sw && sw.hits.some((h) => h.fiche_id === "bail"));
});

test("MIN_SCORE: one generic word is not evidence", () => {
  const R = ask("quel est le prix ?");
  assert.ok(!R.primary || R.primary.score >= MIN_SCORE);
});
