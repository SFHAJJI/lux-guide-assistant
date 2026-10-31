# Le fil de la démonstration, et la réponse à envoyer

## Six questions, dans l'ordre

Ouvrir https://sfhajji.github.io/lux-guide-assistant/#fiche/bail, puis le panneau « Assistant » (le bouton en bas à
droite, ou l'entrée « Assistant » de la barre). Sur un écran large, le panneau se met à côté de la fiche.

| # | question | ce qui se passe | ce que ça montre |
|---|---|---|---|
| 1 | Combien de mois de loyer pour la garantie locative ? | « Sur cette fiche », le paragraphe et le point à retenir surlignés, zéro appel au modèle | la page lue est la portée ; la FAQ et l'ancre nette se passent de modèle |
| 2 | Comment immatriculer ma voiture ? | « Sur une autre fiche », la fiche « Immatriculer son véhicule » s'ouvre, l'onglet s'active, le passage est surligné | la réponse est ailleurs : routage par la table des fiches et le dictionnaire |
| 3 | How do I get my social security number? | réponse en anglais, citation en français avec son chemin | le dictionnaire de l'expert porte les langues des nouveaux arrivants ; le passage reste celui du guide |
| 4 | Quels documents apporter à la commune ? | une liste, un passage par élément | le contrat typé : un item par élément, chacun avec sa preuve |
| 5 | Quel est le prix d'un abonnement de ski à Pétange ? | « Pas dans le guide » : lu, cherché (avec les variantes), le plus proche et pourquoi non, une suggestion | l'absence est prouvée par le balayage, pas affirmée |
| 6 | « Pourquoi ce passage » sur n'importe quelle carte | le tiroir d'audit : mots du lecteur, concepts, parcours, marge, sections candidates et leurs détecteurs, appels au modèle, validateur | chaque décision est lisible et rejouable |

Puis, si le temps le permet : « Ce n'est pas ça » (la question part dans le journal pour l'auteur), et le marque-page
(`assistant/bookmarklet.html`) sur le site original.

## Ce qu'on dit en une minute

Le guide est un corpus conçu : 36 fiches structurées, une FAQ, un parcours. On ne le découpe pas, on le lit comme il
est écrit, et l'unité de citation est le bloc de l'auteur. Quatre briques, des tables entre elles. La recherche filtre :
la FAQ, la fiche lue, le guide ; des détecteurs nommés ; un arbitre sur la marge, un seul appel au modèle quand elle est
plate. La réponse est un contrat typé, validé contre le guide avant affichage ; le passage surligné vient de la table,
jamais du modèle. L'absence vient avec quatre preuves. L'évaluation se lit par tranche. Le modèle est facultatif
partout : sans lui, le même pipeline répond dans le navigateur avec les phrases du guide.

Ce qui a été laissé de côté, et pourquoi : pas de base vectorielle ni de reclasseur (409 blocs, une milliseconde, et une
distance n'explique rien à l'auteur), pas d'agent (chaque décision est dans le code), pas de mémoire de conversation
libre (une seule règle de suite), pas de copie du guide dans le dépôt.

Ce qui a échoué en route, et ce qui a changé : les mots-clés seuls donnaient des faux positifs sur un mot générique
(« prix ») ; la règle « un mot ne suffit pas, il faut un concept ou deux mots, et les mots rares absents de la fiche
font tomber la réponse » a réglé la tranche hors-guide. La correction des fautes contre le vocabulaire du corpus
cassait l'anglais (« security » devenait « sécurité ») : elle ne s'applique qu'au français, le dictionnaire porte
les autres langues. Le questionnaire de profil du site se lançait avant le module : le module salue lui-même.

## La réponse à l'e-mail (en français)

> Bonjour,
>
> Merci pour votre message et pour la page, que j'ai lue avec attention. J'ai pris le sujet 3, le chatbot pour les
> nouveaux arrivants, et je l'ai construit dans votre guide plutôt qu'à côté : l'assistant reconnaît la fiche que le
> lecteur a sous les yeux et répond à partir d'elle, ouvre la bonne fiche quand la réponse est ailleurs, et surligne le
> passage qui la porte, cité mot pour mot.
>
> La démonstration : https://sfhajji.github.io/lux-guide-assistant/ (votre guide à un commit épinglé, avec l'assistant
> dans son panneau ; j'ai ajouté un bandeau qui le dit, et je retire la copie sur simple demande). Le code :
> https://github.com/SFHAJJI/lux-guide-assistant. Trois questions à essayer depuis la fiche « Signer un bail » :
> « Combien de mois de loyer pour la garantie locative ? », « Comment immatriculer ma voiture ? », puis
> « Quel est le prix d'un abonnement de ski à Pétange ? ».
>
> La construction suit les quatre briques : le guide devient des tables (fiche, section, bloc, FAQ), la question devient
> une ligne typée avec un dictionnaire en quatre langues, la recherche filtre (la FAQ comme cache, la fiche lue, puis le
> guide, un arbitre sur la marge), et la réponse est un contrat typé validé contre le guide avant affichage. L'absence
> vient avec ses preuves. L'évaluation se lit par tranche dans le README, et le modèle est facultatif sur chaque chemin.
>
> Ce que je n'ai pas fait, et pourquoi, est dans le README aussi. Je serai heureux d'en parler lundi.
>
> Bien à vous,
> Soufien Hajji
