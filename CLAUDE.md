# Avant de travailler ici

Ce dépôt répond au sujet 3 de https://lux-guide.github.io/recrutement-ia/ en suivant la méthode de la série
« Enterprise Document Intelligence » (Angela et Kezhan Shi). Avant toute conception ou modification :

1. Lire `C:\lex-v3\foyer-articles\READ-FIRST.md` et les articles qu'il liste, dans cet ordre (dossier local, hors dépôt).
2. Pour chaque étape conçue ou modifiée, dire explicitement si c'est du code déterministe ou un appel au modèle,
   et ce que le modèle a le droit de faire là.
3. Le modèle lit et rédige ; il ne décide pas, ne calcule pas, ne classe pas des nombres. Tout entre les briques est
   une table. Chaque réponse cite sa preuve, récupérée par identifiant. L'absence est prouvée par balayage.
   L'évaluation se lit par tranche. Chaque appel au modèle est consigné, borné, vérifié par le validateur.
4. Aucune personne n'est nommée dans le dépôt ni sur la page. Rien du guide n'est copié dans le dépôt.

Commandes : `npm run fetch`, `npm run build:index`, `npm test`, `node eval/run.mjs`, `npm run build:site`.
Le proxy se déploie avec `infra/azure.ps1 -DeployTag <sha>`. Le site se déploie par la CI à chaque push sur main.
