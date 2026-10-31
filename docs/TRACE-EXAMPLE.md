# Deux traces, de bout en bout

Ce que chaque brique produit pour une question qui trouve sa réponse sur une autre fiche, puis pour une question que le guide ne traite pas. Sans modèle ; avec le modèle, s'ajoutent l'arbitrage (si la marge est plate), la rédaction sous contrat et le verdict du validateur, tous consignés dans `audit`.

## « Comment immatriculer ma voiture ? », page lue : fiche/bail

### Brique 2 : la question typée

```json
{
 "language": "fr",
 "shape": "procedure",
 "listing": false,
 "corrections": [],
 "direct": [
  "immatriculer",
  "voiture"
 ],
 "concepts": [],
 "patterns": [],
 "exclusions": [],
 "scope": {
  "type": "fiche",
  "fiche_id": "bail",
  "raw": "fiche/bail",
  "inherited": false
 },
 "smalltalk": null
}
```

### Brique 3 : le parcours et les candidats

```json
{
 "route": "site",
 "verdict": "ailleurs",
 "confidence": 0.71,
 "arbiter_needed": true,
 "margin": 0.21,
 "page_fiche": "bail",
 "faq": {
  "outcome": "miss",
  "best": {
   "qid": "faq#30",
   "score": 0.442
  }
 },
 "rungs": [
  {
   "rung": "faq",
   "outcome": "miss",
   "best": {
    "qid": "faq#30",
    "score": 0.442,
    "fiche_id": "vehicule"
   }
  },
  {
   "rung": "page",
   "fiche_id": "bail",
   "candidates": 0,
   "top": 0
  },
  {
   "rung": "site",
   "candidates": 27,
   "fiches": 6,
   "top": 2.25,
   "margin": 0.21
  }
 ],
 "primary": {
  "fiche_id": "vehicule",
  "section_id": "vehicule#s0",
  "span": {
   "bloc_start": "vehicule#b1",
   "bloc_end": "vehicule#b1",
   "best_bloc": "vehicule#b1"
  },
  "score": 2.25,
  "via": "detectors"
 },
 "sections": [
  {
   "section_id": "vehicule#s0",
   "fiche_id": "vehicule",
   "score": 2.25,
   "role": "primary",
   "methods": [
    "title",
    "fiche"
   ],
   "matched": [
    "Immatriculer son véhicule"
   ],
   "reason": null
  },
  {
   "section_id": "choisir_commune#s1",
   "fiche_id": "choisir_commune",
   "score": 2.04,
   "role": "supporting",
   "methods": [
    "keyword",
    "heading",
    "fiche"
   ],
   "matched": [
    "voiture"
   ],
   "reason": null
  },
  {
   "section_id": "choisir_commune#s4",
   "fiche_id": "choisir_commune",
   "score": 1.54,
   "role": "supporting",
   "methods": [
    "keyword",
    "fiche",
    "retenir"
   ],
   "matched": [
    "voiture"
   ],
   "reason": null
  },
  {
   "section_id": "assurance_auto#s4",
   "fiche_id": "assurance_auto",
   "score": 1.52,
   "role": "supporting",
   "methods": [
    "keyword",
    "fiche",
    "retenir"
   ],
   "matched": [
    "immatriculer"
   ],
   "reason": null
  },
  {
   "section_id": "assurance_auto#s2",
   "fiche_id": "assurance_auto",
   "score": 1.29,
   "role": "discarded",
   "methods": [
    "keyword",
    "fiche"
   ],
   "matched": [
    "voiture"
   ],
   "reason": null
  },
  {
   "section_id": "choisir_commune#s3",
   "fiche_id": "choisir_commune",
   "score": 1.29,
   "role": "discarded",
   "methods": [
    "keyword",
    "fiche"
   ],
   "matched": [
    "voiture"
   ],
   "reason": null
  },
  {
   "section_id": "vehicule#s6",
   "fiche_id": "vehicule",
   "score": 1.29,
   "role": "discarded",
   "methods": [
    "keyword",
    "fiche"
   ],
   "matched": [
    "voiture"
   ],
   "reason": null
  },
  {
   "section_id": "vehicule#s7",
   "fiche_id": "vehicule",
   "score": 1.29,
   "role": "discarded",
   "methods": [
    "keyword",
    "fiche"
   ],
   "matched": [
    "voiture"
   ],
   "reason": null
  }
 ],
 "n_candidates": 27,
 "sweep": [
  {
   "keyword": "immatricul",
   "hits": [
    {
     "fiche_id": "vehicule",
     "fiche": "Immatriculer son véhicule",
     "n": 10
    },
    {
     "fiche_id": "assurance_auto",
     "fiche": "Assurer son véhicule",
     "n": 3
    },
    {
     "fiche_id": "parcours",
     "fiche": "Parcours d'installation",
     "n": 2
    }
   ]
  },
  {
   "keyword": "voitur",
   "hits": [
    {
     "fiche_id": "choisir_commune",
     "fiche": "Choisir sa commune",
     "n": 3
    },
    {
     "fiche_id": "transport",
     "fiche": "Transports publics gratuits",
     "n": 3
    },
    {
     "fiche_id": "emmenagement",
     "fiche": "Emménager et meubler",
     "n": 2
    },
    {
     "fiche_id": "vehicule",
     "fiche": "Immatriculer son véhicule",
     "n": 2
    },
    {
     "fiche_id": "assurance_auto",
     "fiche": "Assurer son véhicule",
     "n": 1
    }
   ]
  }
 ]
}
```

### Brique 4 : la réponse sous contrat (sans modèle)

```json
{
 "answer_found": true,
 "complete_answer_found": true,
 "language": "fr",
 "items": [
  {
   "text": "Un ordre imposé, une pièce à obtenir à chaque étape, et six mois après la déclaration d'arrivée pour tout boucler.",
   "spans": [
    {
     "bloc_start": "vehicule#b1",
     "bloc_end": "vehicule#b1",
     "quote": "Un ordre imposé, une pièce à obtenir à chaque étape, et six mois après la déclaration d'arrivée pour tout boucler.",
     "path": {
      "fiche_id": "vehicule",
      "fiche": "Immatriculer son véhicule",
      "section_id": "vehicule#s0",
      "section": null,
      "tab": null,
      "kind": "guidee"
     },
     "blocs": [
      "vehicule#b1"
     ]
    }
   ]
  }
 ],
 "caveats": [],
 "conflicting_evidence": false,
 "suggested_clarification": null,
 "keywords_found": [],
 "discovered_keywords": [],
 "extraction_method": "verbatim",
 "confidence": 0.71,
 "source": "code"
}
```

### Ce que l'interface reçoit

```json
{
 "kind": "answer",
 "verdict": "ailleurs",
 "primary": {
  "fiche_id": "vehicule",
  "fiche": "Immatriculer son véhicule",
  "section_id": "vehicule#s0",
  "section": null,
  "tab": null,
  "span": {
   "bloc_start": "vehicule#b1",
   "bloc_end": "vehicule#b1",
   "best_bloc": "vehicule#b1"
  },
  "via": "detectors"
 },
 "items": [
  {
   "text": "Un ordre imposé, une pièce à obtenir à chaque étape, et six mois après la déclaration d'arrivée pour tout boucler.",
   "spans": [
    {
     "bloc": "vehicule#b1",
     "quote": "Un ordre imposé, une pièce à obtenir à chaque étape, et six mois après la déclaration d'arrivée pour tout boucler.",
     "path": {
      "fiche_id": "vehicule",
      "fiche": "Immatriculer son véhicule",
      "section_id": "vehicule#s0",
      "section": null,
      "tab": null,
      "kind": "guidee"
     }
    }
   ]
  }
 ],
 "model_calls": 0,
 "ms": 3
}
```

## « Quel est le prix d'un abonnement de ski à Pétange ? », page lue : fiche/bail

### Brique 2 : la question typée

```json
{
 "language": "fr",
 "shape": "amount",
 "listing": false,
 "corrections": [],
 "direct": [
  "prix",
  "abonnement",
  "ski",
  "petange"
 ],
 "concepts": [],
 "patterns": [],
 "exclusions": [],
 "scope": {
  "type": "fiche",
  "fiche_id": "bail",
  "raw": "fiche/bail",
  "inherited": false
 },
 "smalltalk": null
}
```

### Brique 3 : le parcours et les candidats

```json
{
 "route": "none",
 "verdict": "pas_dans_le_guide",
 "confidence": 0.05,
 "arbiter_needed": false,
 "margin": 0,
 "page_fiche": "bail",
 "faq": {
  "outcome": "miss",
  "best": {
   "qid": "faq#42",
   "score": 0.25
  }
 },
 "rungs": [
  {
   "rung": "faq",
   "outcome": "miss",
   "best": {
    "qid": "faq#42",
    "score": 0.25,
    "fiche_id": "achat"
   }
  },
  {
   "rung": "page",
   "fiche_id": "bail",
   "candidates": 0,
   "top": 0
  },
  {
   "rung": "site",
   "candidates": 18,
   "fiches": 8,
   "top": 0,
   "margin": 0
  }
 ],
 "primary": null,
 "sections": [],
 "n_candidates": 18,
 "sweep": [
  {
   "keyword": "prix",
   "hits": [
    {
     "fiche_id": "achat",
     "fiche": "Acheter un logement",
     "n": 4
    },
    {
     "fiche_id": "logement_abordable",
     "fiche": "Logement abordable et à coût modéré",
     "n": 4
    },
    {
     "fiche_id": "frontalier",
     "fiche": "Habiter en France, en Belgique ou en Allemagne",
     "n": 2
    },
    {
     "fiche_id": "emmenagement",
     "fiche": "Emménager et meubler",
     "n": 2
    },
    {
     "fiche_id": "vehicule",
     "fiche": "Immatriculer son véhicule",
     "n": 2
    },
    {
     "fiche_id": "assurance_auto",
     "fiche": "Assurer son véhicule",
     "n": 2
    },
    {
     "fiche_id": "recherche_logement",
     "fiche": "Trouver un logement",
     "n": 1
    },
    {
     "fiche_id": "cout_vie",
     "fiche": "Salaire, coût de la vie et indexation",
     "n": 1
    }
   ]
  },
  {
   "keyword": "abonn",
   "hits": []
  },
  {
   "keyword": "ski",
   "hits": []
  },
  {
   "keyword": "petang",
   "hits": []
  }
 ]
}
```

### Brique 4 : l'absence justifiée

```json
{
 "reason": "concept_present_hors_sujet",
 "read": {
  "page": {
   "fiche_id": "bail",
   "fiche": "Signer un bail",
   "sections": 5,
   "blocs": 8
  },
  "guide": {
   "fiches": 37,
   "sections": 154,
   "blocs": 409,
   "verifie": "2026-08"
  }
 },
 "searched": [
  {
   "kind": "mot",
   "label": "prix",
   "variants": [],
   "hits": [
    {
     "fiche_id": "achat",
     "fiche": "Acheter un logement",
     "n": 4
    },
    {
     "fiche_id": "logement_abordable",
     "fiche": "Logement abordable et à coût modéré",
     "n": 4
    },
    {
     "fiche_id": "frontalier",
     "fiche": "Habiter en France, en Belgique ou en Allemagne",
     "n": 2
    },
    {
     "fiche_id": "emmenagement",
     "fiche": "Emménager et meubler",
     "n": 2
    },
    {
     "fiche_id": "vehicule",
     "fiche": "Immatriculer son véhicule",
     "n": 2
    },
    {
     "fiche_id": "assurance_auto",
     "fiche": "Assurer son véhicule",
     "n": 2
    },
    {
     "fiche_id": "recherche_logement",
     "fiche": "Trouver un logement",
     "n": 1
    },
    {
     "fiche_id": "cout_vie",
     "fiche": "Salaire, coût de la vie et indexation",
     "n": 1
    }
   ],
   "total": 18
  },
  {
   "kind": "mot",
   "label": "abonnement",
   "variants": [],
   "hits": [],
   "total": 0
  },
  {
   "kind": "mot",
   "label": "ski",
   "variants": [],
   "hits": [],
   "total": 0
  },
  {
   "kind": "mot",
   "label": "petange",
   "variants": [],
   "hits": [],
   "total": 0
  }
 ],
 "closest": {
  "bloc_id": "logement_abordable#b6",
  "fiche_id": "logement_abordable",
  "fiche": "Logement abordable et à coût modéré",
  "section": "Une revente à prix encadré",
  "snippet": "Ces logements sont assortis d'un droit de rachat inscrit dans l'acte authentique. Le prix de revente correspond au prix payé, réindexé sur l'indice du coût de la construction et minoré de l'usure. Autrement dit, il n'…",
  "score": 1.51,
  "why": "ce passage parle de « prix » mais pas de « abonnement », « ski », « petange »"
 },
 "suggestion": {
  "type": "fiche",
  "label": "Logement abordable et à coût modéré",
  "hash": "#fiche/logement_abordable"
 },
 "coverage": {
  "built_at": "2026-10-31T17:31:30.630Z",
  "upstream_commit": "8de7372818adf9cbdffded53530791ffbffec930",
  "index_sha256": "c80af274bccc",
  "fiches": 37,
  "sections": 154,
  "blocs": 409,
  "words": 12613,
  "faq": 55,
  "faq_with_span": 54,
  "faq_unresolved_fiche": [],
  "parcours_steps": 37,
  "links": 94,
  "sources": 64,
  "dictionary": null,
  "per_fiche": [
   {
    "id": "arrivee",
    "kind": "article",
    "sections": 5,
    "blocs": 12,
    "words": 421
   },
   {
    "id": "matricule",
    "kind": "article",
    "sections": 4,
    "blocs": 8,
    "words": 247
   },
   {
    "id": "assurance_sante",
    "kind": "article",
    "sections": 5,
    "blocs": 10,
    "words": 331
   },
   {
    "id": "administration",
    "kind": "article",
    "sections": 5,
    "blocs": 10,
    "words": 346
   },
   {
    "id": "luxtrust",
    "kind": "article",
    "sections": 4,
    "blocs": 7,
    "words": 207
   },
   {
    "id": "recherche_logement",
    "kind": "article",
    "sections": 5,
    "blocs": 9,
    "words": 286
   },
   {
    "id": "choisir_commune",
    "kind": "article",
    "sections": 5,
    "blocs": 11,
    "words": 446
   },
   {
    "id": "frontalier",
    "kind": "article",
    "sections": 6,
    "blocs": 17,
    "words": 840
   },
   {
    "id": "reclamation",
    "kind": "article",
    "sections": 4,
    "blocs": 7,
    "words": 193
   },
   {
    "id": "emmenagement",
    "kind": "article",
    "sections": 4,
    "blocs": 6,
    "words": 220
   },
   {
    "id": "bail",
    "kind": "article",
    "sections": 5,
    "blocs": 8,
    "words": 300
   },
   {
    "id": "assurance_habitation",
    "kind": "article",
    "sections": 6,
    "blocs": 10,
    "words": 383
   },
   {
    "id": "achat",
    "kind": "article",
    "sections": 3,
    "blocs": 8,
    "words": 325
   },
   {
    "id": "logement_abordable",
    "kind": "article",
    "sections": 6,
    "blocs": 15,
    "words": 444
   },
   {
    "id": "impots_classes",
    "kind": "article",
    "sections": 6,
    "blocs": 16,
    "words": 677
   },
   {
    "id": "deductions",
    "kind": "article",
    "sections": 5,
    "blocs": 10,
    "words": 286
   },
   {
    "id": "conseil_fiscal",
    "kind": "article",
    "sections": 6,
    "blocs": 11,
    "words": 528
   },
   {
    "id": "impatries",
    "kind": "article",
    "sections": 4,
    "blocs": 10,
    "words": 348
   },
   {
    "id": "interets",
    "kind": "article",
    "sections": 4,
    "blocs": 12,
    "words": 358
   },
   {
    "id": "independant",
    "kind": "article",
    "sections": 4,
    "blocs": 8,
    "words": 270
   },
   {
    "id": "allocations",
    "kind": "article",
    "sections": 3,
    "blocs": 12,
    "words": 266
   },
   {
    "id": "conges",
    "kind": "article",
    "sections": 3,
    "blocs": 7,
    "words": 221
   },
   {
    "id": "emploi",
    "kind": "article",
    "sections": 2,
    "blocs": 7,
    "words": 200
   },
   {
    "id": "banque",
    "kind": "article",
    "sections": 2,
    "blocs": 7,
    "words": 190
   },
   {
    "id": "cout_vie",
    "kind": "article",
    "sections": 3,
    "blocs": 8,
    "words": 233
   },
   {
    "id": "ecole",
    "kind": "article",
    "sections": 5,
    "blocs": 8,
    "words": 268
   },
   {
    "id": "garde",
    "kind": "article",
    "sections": 2,
    "blocs": 7,
    "words": 196
   },
   {
    "id": "sante_pratique",
    "kind": "article",
    "sections": 2,
    "blocs": 7,
    "words": 172
   },
   {
    "id": "permis",
    "kind": "article",
    "sections": 2,
    "blocs": 7,
    "words": 213
   },
   {
    "id": "vehicule",
    "kind": "guidee",
    "sections": 9,
    "blocs": 46,
    "words": 1200
   },
   {
    "id": "assurance_auto",
    "kind": "article",
    "sections": 5,
    "blocs": 12,
    "words": 464
   },
   {
    "id": "transport",
    "
```

### Ce que l'interface reçoit

```json
{
 "kind": "absence",
 "verdict": "pas_dans_le_guide",
 "absence": {
  "reason": "concept_present_hors_sujet",
  "suggestion": {
   "type": "fiche",
   "label": "Logement abordable et à coût modéré",
   "hash": "#fiche/logement_abordable"
  }
 },
 "model_calls": 0,
 "ms": 3
}
```
