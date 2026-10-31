import test from "node:test";
import assert from "node:assert/strict";
import { parseQuestion, parsePage } from "../core/question.js";
import { real, miniDictionary } from "./helpers.mjs";

const { T } = real();
const D = miniDictionary();

test("the reader's words carry provenance and specificity", () => {
  const pq = parseQuestion("Combien de mois de loyer pour la garantie locative ?", { T, D });
  assert.deepEqual(pq.direct.map((k) => k.text), ["mois", "loyer", "garantie", "locative"]);
  assert.ok(pq.direct.every((k) => k.source === "direct" && k.weight >= 0.5 && k.weight <= 1));
  assert.equal(pq.shape, "delay");
  assert.equal(pq.language, "fr");
});

test("typos are corrected against the corpus vocabulary, not invented", () => {
  const pq = parseQuestion("comment imatriculer ma voitur", { T, D });
  assert.deepEqual(pq.corrections, [{ from: "imatriculer", to: "immatriculer" }, { from: "voitur", to: "voiture" }]);
  assert.equal(pq.concepts[0].id, "immatriculation");
  assert.equal(pq.shape, "procedure");
});

test("a concept is found through an English variant", () => {
  const pq = parseQuestion("How do I get my social security number?", { T, D });
  assert.equal(pq.language, "en");
  assert.ok(pq.concepts.some((c) => c.id === "matricule" && c.lang === "en"));
});

test("the page is a structural hint read from the hash", () => {
  assert.deepEqual(parsePage("#fiche/bail").fiche_id, "bail");
  assert.equal(parsePage("faq").type, "faq");
  assert.equal(parsePage("").type, null);
  const pq = parseQuestion("et la caution ?", { T, D, page: "fiche/bail" });
  assert.equal(pq.scope.fiche_id, "bail");
});

test("negation goes to the generation brief, never to retrieval", () => {
  const pq = parseQuestion("qu'est-ce qui n'est pas couvert par l'assurance habitation ?", { T, D });
  assert.ok(pq.generation.exclusions.includes("pas"));
  assert.ok(!pq.direct.some((k) => k.text === "pas"));
});

test("shapes: list, yes/no, amount", () => {
  assert.equal(parseQuestion("Quels documents apporter à la commune ?", { T, D }).shape, "list");
  assert.equal(parseQuestion("Est-ce que les transports sont gratuits ?", { T, D }).shape, "yes_no");
  assert.equal(parseQuestion("Combien coûte le contrôle technique ?", { T, D }).shape, "amount");
});

test("smalltalk is recognised and nothing is searched", () => {
  assert.equal(parseQuestion("Bonjour !", { T, D }).smalltalk, "greeting");
  assert.equal(parseQuestion("merci beaucoup", { T, D }).smalltalk, "thanks");
  assert.equal(parseQuestion("bonjour, comment immatriculer ma voiture ?", { T, D }).smalltalk, null);
});
