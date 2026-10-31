# L'assistant du guide « Vivre au Luxembourg »

Un assistant documentaire intégré au guide public pour les personnes qui s'installent au Luxembourg
([lux-guide.github.io](https://lux-guide.github.io/)). Il fait trois choses, et les montre :

1. **il reconnaît la fiche que le lecteur a sous les yeux** et répond d'abord à partir d'elle ;
2. **il ouvre la bonne fiche quand la réponse est ailleurs** ;
3. **il surligne le passage qui porte la réponse**, cité mot pour mot avec son chemin « Fiche › Section ».

Et quand le guide ne répond pas, il le dit avec ses preuves : ce qu'il a lu, ce qu'il a cherché, la mention la plus
proche et pourquoi elle ne répond pas, et où aller.

**La démonstration : https://sfhajji.github.io/lux-guide-assistant/** (le guide à un commit épinglé, avec l'assistant
dans son panneau latéral). Ouvrez une fiche, par exemple `#fiche/bail`, et demandez :

- « Combien de mois de loyer pour la garantie locative ? » : sur cette fiche, passage surligné, sans appel au modèle ;
- « Comment immatriculer ma voiture ? » : sur une autre fiche, qui s'ouvre, onglet activé, passage surligné ;
- « How do I get my social security number? » : réponse en anglais, citation en français ;
- « Quels documents apporter à la commune ? » : une liste, un passage par élément ;
- « Quel est le prix d'un abonnement de ski à Pétange ? » : pas dans le guide, quatre preuves, une suggestion.

*An assistant inside a public newcomer guide to Luxembourg: it recognises the page being read, opens the right page when
the answer lies elsewhere, and highlights the verbatim passage. Four bricks, no vector store, a typed answer validated
against the guide before it is shown; the model is optional on every path.*

## Comment il est construit

Quatre briques, et entre elles des tables et des objets typés, jamais des chaînes.

| brique | ce qu'elle fait | où |
|---|---|---|
| 1. Analyse du document | Le guide (à un commit épinglé, empreintes vérifiées) devient des tables : `fiche`, `section`, `bloc` (l'unité de citation, 409 blocs), `faq` (55 entrées, chacune avec le passage qui la porte), `link`, `parcours`. Rien du guide n'est copié dans ce dépôt. | `build/build-index.mjs` |
| 2. Analyse de la question | Langue, fautes corrigées contre le vocabulaire du corpus, mots du lecteur pondérés par leur spécificité, concepts du **dictionnaire de l'expert** (FR/EN/DE/PT) avec la variante qui a touché, forme attendue, portée (la fiche lue, prise dans l'adresse), exclusions. Deux fiches de route : pour la recherche, pour la rédaction. | `core/question.js`, `data/dictionary.yaml` |
| 3. Recherche | Filtrer, pas chercher : la FAQ comme cache, puis la fiche lue (ses blocs restent candidats), puis le guide routé par la table des fiches. Des détecteurs nommés (mots, dictionnaire, couverture, titre, co-occurrence d'une valeur, point à retenir, FAQ) signent chaque candidat. Ancre petite, contexte large. Arbitre déterministe sur la marge ; un seul appel au modèle quand la marge est plate. Le balayage par fiche prouve l'absence. | `core/detectors.js`, `core/ladder.js` |
| 4. Rédaction | Un contrat typé : des éléments avec leurs passages (identifiants de blocs, citation), `answer_found`, `complete_answer_found`, réserves, contradiction, clarification, mots découverts. Le modèle remplit le contrat à température zéro ; le **validateur** vérifie chaque citation contre les blocs avant tout affichage ; une reprise, puis la réponse extraite par le code. FAQ directes et ancres nettes se passent de modèle. | `core/contract.js`, `core/prompts.js`, `core/validate.js` |

L'absence est un verdict avec sa défense (`core/absence.js`). La restitution (`assistant/`) vit dans le panneau du site :
verdict, réponse courte dans la langue du lecteur, citation avec son chemin, « Voir le passage », « Source officielle »,
« Pourquoi ce passage » (le tiroir d'audit : détecteurs, marge, appels, validateur), « Ce n'est pas ça ». Le surlignage
est calculé à partir des blocs cités, jamais à partir de la prose du modèle. Le détail des choix est dans
[docs/DESIGN.md](docs/DESIGN.md).

## Ce que ça donne

L'évaluation se lit par tranche, jamais en moyenne : [eval/report.md](eval/report.md) (sans modèle, rejoué à chaque
construction) et [eval/report-model.md](eval/report-model.md) (avec le modèle). Les 55 questions de la FAQ du guide
servent de jeu de référence (fiche et passage attendus) ; 41 questions étiquetées couvrent les autres tranches : sur la
fiche lue, ailleurs, fautes de frappe, anglais, allemand, portugais, liste, montant, délai, oui-non, vague, composée,
hors du guide.

<!-- eval:start -->
Sans modèle (96 questions, index `c80af274bccc`, 2026-10-31) : 88 % conformes, 0.00 appel modèle par question, médiane 0 ms.

| tranche | n | conforme | fiche | verdict | span | appels modèle / q | médiane ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| on-page | 4 | 100 % | 100 % | 100 % | – | 0.00 | 1 |
| elsewhere | 4 | 75 % | 75 % | 100 % | – | 0.00 | 1 |
| typo | 3 | 100 % | 100 % | – | – | 0.00 | 2 |
| en | 4 | 0 % | 0 % | – | – | 0.00 | 1 |
| de | 2 | 0 % | 0 % | – | – | 0.00 | 1 |
| pt | 2 | 0 % | 0 % | – | – | 0.00 | 0 |
| list | 4 | 50 % | 50 % | – | – | 0.00 | 0 |
| amount | 3 | 100 % | 100 % | – | – | 0.00 | 1 |
| delay | 2 | 100 % | 100 % | – | – | 0.00 | 0 |
| yes_no | 3 | 100 % | 100 % | – | – | 0.00 | 1 |
| vague | 2 | 100 % | – | 100 % | – | 0.00 | 0 |
| compound | 1 | 100 % | 100 % | – | – | 0.00 | 0 |
| out-of-scope | 5 | 80 % | – | 80 % | – | 0.00 | 1 |
| smalltalk | 2 | 100 % | – | – | – | 0.00 | 0 |
| faq | 55 | 100 % | 100 % | – | 100 % | 0.00 | 0 |
<!-- eval:end -->

<!-- eval-model:start -->
_Le tableau avec modèle est inséré par `node eval/run.mjs --model`._
<!-- eval-model:end -->

Ce qui a échoué et ce qui a changé, en cours de route, est consigné dans le rapport et dans l'historique du dépôt.

## Ce qui n'est délibérément pas là

Pas de base vectorielle (409 blocs se balaient en une milliseconde, et une distance n'explique rien à l'auteur), pas de
reclasseur, pas de boucle d'agent, pas d'ajustement de modèle, pas de questionnaire de profil avant la première
réponse, pas de mémoire de conversation libre, pas de copie du guide dans le dépôt. Le modèle est facultatif sur
chaque chemin : sans clé, sans réseau, ou plafond atteint, le même pipeline répond dans le navigateur avec les phrases
du guide.

## Lancer

```bash
npm install                 # une seule dépendance de construction (yaml)
npm run fetch               # le guide, au commit épinglé, dans upstream/ (ignoré par git), empreintes vérifiées
npm run build:index         # les tables et le dictionnaire compilé dans data/index/
npm test                    # les tests unitaires (node --test)
node eval/run.mjs           # l'évaluation sans modèle, par tranche : eval/report.md
npm run build:site          # site/ : le guide + l'assistant (PROXY_URL ou build/proxy-url.txt)
npm run serve:site          # http://localhost:8941/
npm run serve               # le proxy sur :8787 (LLM_PROVIDER=azure|openai|mistral, LLM_API_KEY, LLM_ENDPOINT, LLM_MODEL)
node eval/run.mjs --model   # l'évaluation avec le modèle configuré : eval/report-model.md
```

Le proxy tient la clé, assemble les consignes côté serveur, limite par visiteur, plafonne les appels par jour, et
consigne chaque question sans donnée personnelle. Il tourne en conteneur (`proxy/Dockerfile`, `infra/azure.ps1`).
`build/journey.mjs` rejoue les trois comportements dans un vrai navigateur ; la CI l'exécute et publie les captures.

## Le dépôt

```
build/      fetch-upstream (commit épinglé, empreintes), build-index (brique 1), build-site (le guide + le module), journey
core/       les briques, isomorphes : text, tables, dictionary, question, faq, detectors, ladder, contract, prompts, validate, absence, pipeline, reply
assistant/  le module dans le navigateur : assistant (entrée), client (proxy ou local), render (les cartes), highlight (le surlignage), assistant.css
proxy/      server (HTTP, limites, journal), llm (un client pour les fournisseurs compatibles), Dockerfile
data/       dictionary.yaml (le vocabulaire de l'expert), index/ (les tables générées)
eval/       questions.yaml, run.mjs, les rapports
tests/      node --test
docs/       DESIGN.md
```

Le site assemblé ne modifie que deux fonctions du guide (`envoyer`, `demarrerChat`, par remplacement exact de chaînes
dans `build/build-site.mjs`) et ajoute une feuille de style et un script. Tout le reste du guide est intact.

## Attribution et licence

Le guide « Vivre au Luxembourg » est l'œuvre de son auteur et reste la source de chaque réponse ; cette démonstration en
sert une copie à un commit épinglé, avec un bandeau qui le dit, et sera retirée sur simple demande. La méthode suit la
série d'articles *Enterprise Document Intelligence* (Towards Data Science, 2026) ; rien de son code n'est repris. Le code
de ce dépôt est sous licence MIT.
