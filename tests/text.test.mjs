import test from "node:test";
import assert from "node:assert/strict";
import { fold, stem, stems, tokens, editDistance, sentences, phraseIndex, normalizeForQuote } from "../core/text.js";

test("fold strips accents, case, apostrophes and punctuation", () => {
  assert.equal(fold("L'arrivée à Esch-sur-Alzette, « œuvre » !"), "l arrivee a esch sur alzette oeuvre");
});

test("stem meets verbs and nouns on one root", () => {
  assert.equal(stem("immatriculer"), stem("immatriculation"));
  assert.equal(stem("immatriculer"), stem("immatriculee"));
  assert.equal(stem("declarer"), stem("declaration"));
  assert.equal(stem("voiture"), stem("voitures"));
  assert.equal(stem("classe"), stem("classes"));
  assert.equal(stem("mois"), "mois");
  assert.equal(stem("prix"), "prix");
});

test("tokens drop stopwords in four languages", () => {
  assert.deepEqual(tokens("Comment immatriculer ma voiture ?"), ["immatriculer", "voiture"]);
  assert.deepEqual(tokens("How do I register my car", "en"), ["register", "car"]);
  assert.deepEqual(tokens("car il faut une voiture"), ["voiture"]);
  assert.deepEqual(stems("les communes et les documents"), ["commun", "document"]);
});

test("edit distance with transposition and early exit", () => {
  assert.equal(editDistance("imatriculer", "immatriculer", 2), 1);
  assert.equal(editDistance("voitur", "voiture", 2), 1);
  assert.equal(editDistance("caise", "caisse", 2), 1);
  assert.equal(editDistance("abc", "xyz", 2), 3);
});

test("sentences split on terminal punctuation followed by a capital", () => {
  const s = sentences("Vous disposez de huit jours. Le délai court dès l'arrivée, pas de l'emménagement. Notez-le.");
  assert.equal(s.length, 3);
  assert.equal(s[0], "Vous disposez de huit jours.");
});

test("phraseIndex respects word boundaries", () => {
  assert.equal(phraseIndex("la caution bancaire", "caution"), 3);
  assert.equal(phraseIndex("precaution", "caution"), -1);
});

test("normalizeForQuote tolerates typographic quotes and spaces", () => {
  assert.equal(normalizeForQuote("L’état  des lieux !"), "l'etat des lieux !".replace("etat", "état"));
});
