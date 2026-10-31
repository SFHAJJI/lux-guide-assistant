// Prompts are assembled per call from a fixed base and the fragments this question needs. The base never changes
// between calls (it is cached by the provider); the context arrives as compact JSON and labelled rows.
// Temperature 0 everywhere: generation is extraction, not writing.

export const PROMPT_VERSION = "2026-10-31.1";

export const BASE = `Tu es l'assistant documentaire du guide « Vivre au Luxembourg ». Tu réponds UNIQUEMENT à partir des passages fournis, jamais de mémoire.
Règles :
1. Chaque élément de « items » porte au moins un « span » : bloc_start et bloc_end sont des identifiants de la colonne BLOC, et « quote » est une citation copiée mot pour mot (en français) depuis ces blocs. Plusieurs spans si la preuve est dispersée.
2. « text » est une réponse courte (une à trois phrases) dans la langue du lecteur, fidèle aux passages, sans rien ajouter que les passages ne disent pas. Pas de formule de politesse.
3. Si les passages ne contiennent pas la réponse : items = [], answer_found = false, et explique dans « caveats » ce que les passages traitent et ce qui manque.
4. complete_answer_found = false si la réponse n'est que partielle (par exemple une liste dont il manque des éléments).
5. conflicting_evidence = true si deux passages se contredisent ; cite les deux, ne tranche pas.
6. suggested_clarification : une seule question courte si la réponse dépend d'une information que le lecteur n'a pas donnée (citoyen de l'UE ou non, salarié ou indépendant, locataire ou propriétaire), sinon null.
7. keywords_found : les mots de la question effectivement présents dans les passages. discovered_keywords : les termes du guide qui désignent ce que le lecteur a nommé autrement (par exemple le lecteur dit « caution », le guide dit « garantie locative »).
8. extraction_method : « verbatim » si la réponse reprend les passages, « computed » si tu as calculé à partir de valeurs citées, « inferred » si tu as déduit, « na » si rien n'est trouvé.
9. Ne jamais inventer une adresse, un montant, un délai ou un organisme absent des passages.`;

export const FRAGMENTS = {
  fact: "Forme attendue : un fait précis. Un seul item, une ou deux phrases.",
  amount: "Forme attendue : un montant. Reprends le chiffre exactement comme écrit dans le passage (unité, période, conditions). Si plusieurs montants s'appliquent selon la situation, un item par cas.",
  delay: "Forme attendue : un délai ou une date. Reprends la durée exactement comme écrite et dis à partir de quel événement elle court. Si le délai dépend de la situation (citoyen de l'UE ou non, par exemple), un item par cas.",
  yes_no: "Forme attendue : oui ou non, puis la condition ou l'exception si le passage en donne une. Les réserves vont dans caveats.",
  list: "Forme attendue : une liste. UN item par élément de la liste, chacun avec son propre span. complete_answer_found = false si le passage dit « notamment », « par exemple » ou si la liste semble tronquée.",
  procedure: "Forme attendue : des étapes, dans l'ordre du guide. Un item par étape, chacun avec son span. Garde les noms d'organismes tels quels.",
  explain: "Forme attendue : une explication brève, en restant près de la formulation du guide."
};

export function languageFragment(lang) {
  return { fr: "Le lecteur écrit en français : réponds en français.", en: "The reader writes in English: write « text » in English; quotes stay in French, verbatim.", de: "Der Leser schreibt Deutsch: schreibe « text » auf Deutsch; Zitate bleiben wörtlich auf Französisch.", pt: "O leitor escreve em português: escreve « text » em português; as citações ficam em francês, literais." }[lang] || "";
}

export function contextBlock(pq, R, T) {
  const page = R.page_fiche ? T.ficheById.get(R.page_fiche) : null;
  const ctx = {
    page_lue: page ? { id: page.id, titre: page.titre, categorie: page.cat } : null,
    verdict_retrieval: R.verdict,
    forme: pq.shape,
    langue: pq.language,
    exclusions: pq.generation.exclusions.length ? pq.exclusions : undefined,
    guide_verifie: T.verifie || undefined
  };
  return JSON.stringify(ctx);
}

export function rows(blocs, T) {
  const lines = ["BLOC\tFICHE\tSECTION\tTEXTE"];
  for (const b of blocs) {
    const s = T.sectionById.get(b.section_id), f = T.ficheById.get(b.fiche_id);
    lines.push(`${b.bloc_id}\t${f.titre}\t${s.level === 1 ? "(introduction)" : s.titre}\t${b.text.replace(/\t/g, " ")}`);
  }
  return lines.join("\n");
}

export function buildGenerationPrompt(pq, R, T, blocs) {
  const fragments = [pq.shape in FRAGMENTS ? pq.shape : "fact"];
  if (pq.listing && pq.shape !== "list") fragments.push("list");
  const parts = [BASE, "", ...fragments.map((f) => FRAGMENTS[f]), languageFragment(pq.language)];
  if (pq.generation.exclusions.length) { parts.push("La question contient une négation ou une exclusion : réponds sur ce qui est demandé, pas sur son contraire."); fragments.push("exclusion"); }
  const system = parts.join("\n");
  const user = `Contexte : ${contextBlock(pq, R, T)}\n\nQuestion du lecteur : ${pq.original}\n\nPassages du guide (une ligne par bloc) :\n${rows(blocs, T)}\n\nRéponds au format demandé.`;
  return { system, user, fragments_applied: fragments, prompt_version: PROMPT_VERSION };
}

export const ARBITER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    rankings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          section_id: { type: "string" },
          role: { type: "string", enum: ["primary", "supporting", "discarded"] },
          reason: { type: "string" }
        },
        required: ["section_id", "role", "reason"]
      }
    },
    not_found: { type: "boolean" }
  },
  required: ["rankings", "not_found"]
};

export const ARBITER_BASE = `Tu arbitres entre des candidats trouvés par des détecteurs (mots-clés, dictionnaire, titres de sections) dans un guide pour les nouveaux arrivants au Luxembourg. Tu ne cherches pas toi-même : tu classes les candidats fournis.
Donne à chaque candidat un rôle : « primary » pour la section qui porte le plus probablement la réponse (une seule), « supporting » pour celles qui la complètent, « discarded » pour les autres. Une raison d'une phrase par candidat, en français, qui s'appuie sur l'extrait.
Si aucun candidat ne porte la réponse, not_found = true et aucun primary. Si la page lue porte la réponse, préfère-la.`;

export function buildArbiterPrompt(pq, R, T) {
  const page = R.page_fiche ? T.ficheById.get(R.page_fiche) : null;
  const cands = R.sections.slice(0, 8).map((s) => {
    const b = T.blocById.get(s.best_bloc), sec = T.sectionById.get(s.section_id), f = T.ficheById.get(s.fiche_id);
    return `- ${s.section_id} | fiche « ${f.titre} » › ${sec.level === 1 ? "introduction" : sec.titre} | méthodes : ${s.methods.join(", ")} | mots trouvés : ${s.matched.map((m) => m.text).join(", ")}${s.fiche_id === R.page_fiche ? " | PAGE LUE" : ""}\n  extrait : ${b.text.length > 260 ? b.text.slice(0, 257) + "…" : b.text}`;
  }).join("\n");
  const map = T.fiche.filter((f) => f.kind !== "parcours").map((f) => `${f.id} : ${f.titre}`).join(" ; ");
  const user = `Question : ${pq.original}\nForme attendue : ${pq.shape}\nPage lue : ${page ? page.titre : "aucune"}\n\nCandidats :\n${cands}\n\nCarte du guide (identifiant : titre) : ${map}`;
  return { system: ARBITER_BASE, user, prompt_version: PROMPT_VERSION };
}
