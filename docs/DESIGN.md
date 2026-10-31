# Conception

Ce document dit pourquoi l'assistant est construit ainsi. Le README dit ce qu'il fait ; `eval/report.md` dit ce que ça donne.

## Le problème, dans les mots de l'exercice

Un chatbot « réellement utile » pour les personnes qui s'installent au Luxembourg, sur un site d'information existant :
il reconnaît la page que le lecteur a sous les yeux et répond en s'appuyant dessus, il ouvre la bonne fiche quand la
réponse est ailleurs, et il surligne le passage qui la porte. Deux choses comptent plus que le reste : la restitution et
le déploiement.

## Ce qu'est le corpus

Le guide n'est pas un site de pages : c'est une application à panneaux dont le contenu est une base de connaissances
structurée (`app/kb.js`) : 36 fiches avec titre, catégorie, résumé, mots-clés, paragraphes et sous-titres, points
« à retenir », sources officielles ; 55 questions-réponses rattachées chacune à une fiche ; un parcours de 37 étapes
conditionnées par le profil. Une fiche fait 300 mots en moyenne. Le tout fait 12 600 mots.

C'est un **corpus conçu**, pas un dossier hérité. On ne le découpe pas en morceaux de 512 jetons : on le lit comme il est
écrit, et l'unité de citation est le bloc que l'auteur a écrit (un paragraphe, un point à retenir, une ligne de tableau,
une étape). La FAQ est une mémoire de réponses déjà validées par l'auteur : elle passe avant toute recherche.

## Les quatre briques, et ce qui circule entre elles

Entre les briques, des tables et des objets typés, jamais des chaînes.

1. **Analyse du document** (`build/build-index.mjs`). Les fichiers de données du guide, à un commit épinglé, sont lus dans
   un bac à sable et deviennent `fiche`, `section`, `bloc`, `faq` (avec le passage qui porte chaque réponse, retrouvé par
   recouvrement de phrases), `link`, `parcours`. Chaque bloc porte un identifiant stable (`bail#b3`), sa section, et de quoi
   le retrouver dans la page rendue. Le fichier `coverage.json` dit ce qui a été lu : c'est la première preuve en cas
   d'absence.
2. **Analyse de la question** (`core/question.js`). Langue, correction des fautes contre le vocabulaire du corpus (jamais
   contre l'imagination d'un modèle), mots du lecteur pondérés par leur spécificité dans le guide, concepts du dictionnaire
   avec la variante qui a touché, forme attendue (fait, montant, délai, oui-non, liste, procédure), portée (la fiche lue,
   prise dans l'adresse de la page), exclusions. Deux fiches de route en sortent : ce que la recherche a besoin de savoir,
   et ce que la rédaction a besoin de savoir. Les négations vont à la seconde, jamais à la première.
3. **Recherche** (`core/detectors.js`, `core/ladder.js`). Filtrer, pas chercher. Une échelle de portée : la FAQ, puis la
   fiche lue (ses blocs restent candidats même sans correspondance : le lecteur l'a épinglée), puis le reste du guide routé
   par la table des fiches. Des détecteurs bon marché et nommés : mots du lecteur, dictionnaire, couverture, titre de
   section, titre de fiche, co-occurrence d'une valeur à côté du concept, point à retenir, bloc qui porte une entrée de la
   FAQ. Chaque candidat porte les méthodes qui l'ont trouvé et les mots qui ont touché. L'ancre est petite (un à trois
   blocs), le contexte est large (la fiche entière). L'arbitre est déterministe quand une section gagne avec une marge
   nette ; quand la marge est plate et qu'un modèle est disponible, un seul appel classe les candidats avec une raison par
   candidat. Les mots-clés prouvent l'absence : un balayage compte les occurrences de chaque concept et de chaque mot dans
   chaque fiche, et les mots rares de la question absents de la meilleure fiche font tomber la réponse.
4. **Rédaction** (`core/contract.js`, `core/prompts.js`, `core/validate.js`). Un contrat typé : des éléments, chacun avec
   ses passages (identifiants de blocs et citation mot pour mot), `answer_found`, `complete_answer_found`, réserves,
   contradiction, clarification suggérée, mots trouvés, mots découverts, méthode d'extraction, confiance. Le modèle, quand
   il intervient, lit des lignes `BLOC FICHE SECTION TEXTE` et remplit le contrat à température zéro ; le validateur vérifie
   avant tout affichage que chaque citation est bien dans les blocs cités, que les blocs font partie des passages fournis,
   que les drapeaux sont cohérents. Un refus donne une reprise avec les erreurs du validateur, puis la réponse extraite par
   le code. Le passage affiché est toujours retrouvé dans la table par identifiant, jamais pris dans la prose du modèle.
   La réponse extraite sans modèle (phrases du bloc ancre, point à retenir) sert aux FAQ directes et aux ancres nettes :
   la plupart des questions ne paient aucun appel.

L'absence est un verdict qui vient avec sa défense (`core/absence.js`) : ce qui a été lu, ce qui a été cherché (concepts
et variantes, mots), le balayage par fiche, la mention la plus proche et pourquoi elle ne répond pas, une suggestion
(autre fiche, outil du site, source officielle).

## La restitution

Dans le panneau du site, rien de plus : un verdict (« Sur cette fiche », « Sur une autre fiche », « Pas dans le guide »,
« Question déjà traitée par le guide »), une réponse courte dans la langue du lecteur, la citation en français avec son
chemin « Fiche › Section », les actions (voir le passage, source officielle, pourquoi ce passage, ce n'est pas ça), et
un tiroir d'audit qui montre la ligne de la question, le parcours, les sections candidates avec leurs détecteurs, les
appels au modèle et le verdict du validateur. Le surlignage est calculé à partir des blocs cités : la citation est
cherchée dans la fiche telle que le site l'a rendue, l'onglet qui la contient est activé, et la plage de texte est
entourée d'une marque. Si le texte n'est pas retrouvé, rien n'est marqué et la carte le dit.

## Ce que le modèle fait et ne fait pas

Il choisit et il rédige, il ne sait rien. Il n'est appelé que pour arbitrer une marge plate et pour rédiger la réponse
quand l'extraction ne suffit pas ; il ne voit que les blocs fournis ; ce qu'il cite est vérifié ; ce qu'il affirme sans
citation n'est pas affiché. Sans modèle (clé absente, plafond atteint, proxy injoignable), le même pipeline tourne dans le
navigateur et répond avec les phrases du guide.

## Boucles

Bornées, et chaque reprise change quelque chose : un seul arbitrage, une seule reprise de rédaction (avec les erreurs du
validateur dans la demande), un seul élargissement de portée (la fiche lue, puis le guide). Pas d'agent.

## Journal et mesure

Le proxy consigne chaque question sans donnée personnelle (pas d'adresse IP, un identifiant de visiteur haché par jour
pour la limite de débit) : verdict, parcours, fiche et section, appels au modèle, statut du validateur, mots découverts,
durée, version de l'index et des consignes. C'est la matière de la boucle de l'expert : les mots découverts proposent des
entrées au dictionnaire, les « ce n'est pas ça » désignent les questions à relire. L'évaluation se lit par tranche
(`eval/run.mjs`), jamais en moyenne.

## Ce qui n'est pas là, et pourquoi

Pas de base vectorielle : 409 blocs se balaient en moins d'une milliseconde, et une distance cosinus n'explique rien à
l'auteur du guide. Pas de reclasseur : l'ensemble des candidats est déjà petit et typé. Pas de boucle d'agent : chaque
décision est lisible dans le code et rejouable depuis le journal. Pas d'ajustement de modèle : le vocabulaire est dans le
dictionnaire, que l'auteur peut relire. Pas de mémoire de conversation libre : une seule règle, une question sans sujet
garde la fiche de la réponse précédente. Pas de copie du guide dans ce dépôt : il est lu à la construction, au commit
épinglé, et ses empreintes sont vérifiées.
