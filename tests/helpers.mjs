import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTables } from "../core/tables.js";
import { loadDictionary } from "../core/dictionary.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let cache = null;
export function real() {
  if (!cache) {
    const T = loadTables(JSON.parse(readFileSync(join(root, "data", "index", "tables.json"), "utf8")));
    const dp = join(root, "data", "index", "dictionary.json");
    const D = loadDictionary(existsSync(dp) ? JSON.parse(readFileSync(dp, "utf8")) : { concepts: [], patterns: [] });
    cache = { T, D };
  }
  return cache;
}

// A small synthetic dictionary, so the tests do not depend on the hand-written one.
export function miniDictionary() {
  return loadDictionary({
    version: 0,
    concepts: [
      { id: "garantie_locative", label: "Garantie locative", shape: "amount", variants: { fr: ["caution", "dépôt de garantie"], en: ["rental deposit", "deposit"], de: ["Kaution"] }, fiches: ["bail"] },
      { id: "immatriculation", label: "Immatriculation", shape: "procedure", variants: { fr: ["immatriculer", "carte grise", "plaques"], en: ["register my car", "car registration"], de: ["Auto anmelden"] }, fiches: ["vehicule"] },
      { id: "matricule", label: "Matricule", variants: { fr: ["numéro d'identification national", "numéro de sécurité sociale"], en: ["social security number", "national identification number"] }, fiches: ["arrivee", "matricule"] }
    ],
    patterns: [
      { id: "montant_eur", regex: "\\d[\\d\\s.,]*\\s?(?:€|eur\\b|euros?)", shape: "amount" },
      { id: "delai", regex: "\\b\\d+\\s?(?:jours?|mois|semaines?|ans?)\\b", shape: "delay" }
    ]
  });
}
