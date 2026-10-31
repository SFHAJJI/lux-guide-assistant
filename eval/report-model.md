# Évaluation par tranche

Générée le 2026-10-31T18:39:53.334Z sur l'index `6f23b48371bb` (37 fiches, 409 blocs, dictionnaire 57 concepts), avec modèle azure/gpt-4.1-mini.

96 questions ; 98 % conformes à l'attendu ; 40 appels modèle au total (0.42 par question) ; médiane 2 ms.

| tranche | n | conforme | fiche | verdict | span | appels modèle / q | médiane ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| on-page | 4 | 100 % | 100 % | 100 % | – | 0.50 | 8 |
| elsewhere | 4 | 100 % | 100 % | 100 % | – | 1.25 | 5836 |
| typo | 3 | 100 % | 100 % | – | – | 0.67 | 4 |
| en | 4 | 100 % | 100 % | – | – | 2.00 | 6686 |
| de | 2 | 100 % | 100 % | – | – | 2.00 | 9963 |
| pt | 2 | 100 % | 100 % | – | – | 2.00 | 12503 |
| list | 4 | 75 % | 75 % | – | – | 2.00 | 5770 |
| amount | 3 | 100 % | 100 % | – | – | 0.00 | 3 |
| delay | 2 | 100 % | 100 % | – | – | 1.00 | 4680 |
| yes_no | 3 | 100 % | 100 % | – | – | 0.33 | 5 |
| vague | 2 | 100 % | – | 100 % | – | 0.00 | 0 |
| compound | 1 | 100 % | 100 % | – | – | 2.00 | 4843 |
| out-of-scope | 5 | 80 % | – | 80 % | – | 0.40 | 1 |
| smalltalk | 2 | 100 % | – | – | – | 0.00 | 1 |
| faq | 55 | 100 % | 100 % | – | 100 % | 0.00 | 2 |

## Les écarts

| id | tranche | question | obtenu | attendu |
|---|---|---|---|---|
| l02 | list | quels documents pour ouvrir un compte bancaire | absence · trouve · bail bail#s1 | banque |
| o03 | out-of-scope | comment déclarer mes impôts en Belgique ? | answer · trouve · parcours parcours#s5 | pas_dans_le_guide |

## Toutes les questions

| id | tranche | page | question | verdict | fiche › section | appels | ms | ok |
|---|---|---|---|---|---|---:|---:|:-:|
| p01 | on-page | fiche/bail | Combien de mois de loyer pour la garantie locative ? | sur_cette_fiche | bail bail#s0 | 0 | 8 | ✓ |
| p02 | on-page | fiche/bail | et l'état des lieux, il est obligatoire ? | sur_cette_fiche | bail bail#s2 | 0 | 3 | ✓ |
| p03 | on-page | fiche/arrivee | combien de jours pour déclarer son arrivée | sur_cette_fiche | arrivee arrivee#s1 | 0 | 3 | ✓ |
| p04 | on-page | fiche/vehicule | quel délai pour immatriculer après l'arrivée ? | sur_cette_fiche | vehicule vehicule#s1 | 2 | 4746 | ✓ |
| e01 | elsewhere | fiche/bail | Comment immatriculer ma voiture ? | ailleurs | vehicule vehicule#s3 | 2 | 10572 | ✓ |
| e02 | elsewhere | fiche/transport | comment obtenir mon matricule ? | ailleurs | arrivee arrivee#s2 | 1 | 3630 | ✓ |
| e03 | elsewhere | fiche/bail | les transports publics sont-ils gratuits ? | ailleurs | transport transport#s0 | 0 | 3 | ✓ |
| e04 | elsewhere | fiche/ecole | quelle classe d'impôt pour un couple marié ? | ailleurs | impots_classes impots_classes#s0 | 2 | 5836 | ✓ |
| t01 | typo |  | comment imatriculer ma voitur | trouve | vehicule vehicule#s0 | 2 | 9729 | ✓ |
| t02 | typo |  | garanti locativ plafonée à combien de mois | trouve | bail bail#s0 | 0 | 4 | ✓ |
| t03 | typo |  | alocations familliales montant | trouve | allocations allocations#s0 | 0 | 3 | ✓ |
| en01 | en |  | How do I register my car? | trouve | vehicule vehicule#s3 | 2 | 11318 | ✓ |
| en02 | en |  | How do I get my social security number? | trouve | arrivee arrivee#s2 | 2 | 6686 | ✓ |
| en03 | en |  | Is public transport free? | trouve | transport transport#s0 | 2 | 5590 | ✓ |
| en04 | en |  | How many days of annual leave? | trouve | conges conges#s2 | 2 | 4688 | ✓ |
| de01 | de |  | Wie melde ich mein Auto an? | trouve | vehicule vehicule#s2 | 2 | 9963 | ✓ |
| de02 | de |  | Ist der öffentliche Verkehr kostenlos? | trouve | transport transport#s0 | 2 | 5294 | ✓ |
| pt01 | pt |  | Como registar o meu carro no Luxemburgo? | trouve | vehicule vehicule#s3 | 2 | 12503 | ✓ |
| pt02 | pt |  | Quais documentos levar à comuna? | trouve | arrivee arrivee#s3 | 2 | 4247 | ✓ |
| l01 | list |  | Quels documents apporter à la commune ? | trouve | arrivee arrivee#s3 | 1 | 2412 | ✓ |
| l02 | list |  | quels documents pour ouvrir un compte bancaire | trouve | bail bail#s1 | 2 | 4307 | ✗ |
| l03 | list |  | quelles sont les étapes pour immatriculer un véhicule importé | trouve | vehicule vehicule#s3 | 3 | 12781 | ✓ |
| l04 | list |  | quelles démarches avant le départ ? | trouve | parcours parcours#s0 | 2 | 5770 | ✓ |
| a01 | amount |  | combien coûte l'immatriculation ? | trouve | vehicule vehicule#s3 | 0 | 5 | ✓ |
| a02 | amount |  | montant de base des allocations familiales | trouve | allocations allocations#s0 | 0 | 3 | ✓ |
| a03 | amount |  | plafond de la TVA à 3 % pour un logement | trouve | achat achat#s1 | 0 | 2 | ✓ |
| d01 | delay |  | délai pour l'installation d'internet | trouve | telecom telecom#s1 | 2 | 4680 | ✓ |
| d02 | delay |  | depuis quand les transports publics sont gratuits ? | trouve | transport transport#s0 | 0 | 2 | ✓ |
| y01 | yes_no |  | est-ce que la double nationalité est admise ? | trouve | nationalite nationalite#s1 | 1 | 2055 | ✓ |
| y02 | yes_no |  | est-ce qu'un permis de conduire européen reste valable ? | trouve | permis permis#s0 | 0 | 5 | ✓ |
| y03 | yes_no |  | l'assurance responsabilité civile est-elle obligatoire pour une voiture ? | trouve | assurance_auto assurance_auto#s3 | 0 | 3 | ✓ |
| v01 | vague |  | aide | precisez |  | 0 | 0 | ✓ |
| v02 | vague |  | ? | precisez |  | 0 | 0 | ✓ |
| c01 | compound |  | quel délai pour la déclaration d'arrivée et pour immatriculer ma voiture ? | trouve | arrivee arrivee#s1 | 2 | 4843 | ✓ |
| o01 | out-of-scope |  | Quel est le prix d'un abonnement de ski à Pétange ? | pas_dans_le_guide |  | 0 | 1 | ✓ |
| o02 | out-of-scope |  | quelle est la meilleure pizzeria d'Esch ? | pas_dans_le_guide |  | 0 | 1 | ✓ |
| o03 | out-of-scope |  | comment déclarer mes impôts en Belgique ? | trouve | parcours parcours#s5 | 2 | 5190 | ✗ |
| o04 | out-of-scope |  | what is the capital of Portugal | pas_dans_le_guide |  | 0 | 1 | ✓ |
| o05 | out-of-scope |  | combien coûte un abonnement de salle de sport ? | pas_dans_le_guide |  | 0 | 1 | ✓ |
| s01 | smalltalk |  | bonjour | smalltalk |  | 0 | 1 | ✓ |
| s02 | smalltalk |  | merci beaucoup ! | smalltalk |  | 0 | 1 | ✓ |
| faq#1 | faq |  | Faut-il un relevé d'information pour assurer sa voiture au Luxembourg ? | trouve | assurance_auto assurance_auto#s2 | 0 | 3 | ✓ |
| faq#2 | faq |  | J'ai conduit la voiture d'un proche sans être inscrit au contrat, est-ce que ça compte ? | trouve | assurance_auto assurance_auto#s2 | 0 | 4 | ✓ |
| faq#3 | faq |  | La carte grise n'est pas au nom du vendeur, est-ce bloquant ? | trouve | vehicule vehicule#s7 | 0 | 4 | ✓ |
| faq#4 | faq |  | Faut-il repasser le contrôle technique en arrivant au Luxembourg ? | trouve | vehicule vehicule#s7 | 0 | 3 | ✓ |
| faq#5 | faq |  | Dans quel délai immatriculer un véhicule qu'on amène avec soi ? | trouve | vehicule vehicule#s3 | 0 | 3 | ✓ |
| faq#6 | faq |  | Puis-je travailler au Luxembourg et habiter en France, en Belgique ou en Allemagne ? | trouve | frontalier frontalier#s1 | 0 | 3 | ✓ |
| faq#7 | faq |  | Combien de jours de télétravail un frontalier peut-il faire ? | trouve | frontalier frontalier#s2 | 0 | 2 | ✓ |
| faq#8 | faq |  | Qu'est-ce qui coûte moins cher de l'autre côté de la frontière ? | trouve | frontalier frontalier#s4 | 0 | 2 | ✓ |
| faq#9 | faq |  | Sur quels critères choisir sa commune ? | trouve | choisir_commune choisir_commune#s1 | 0 | 1 | ✓ |
| faq#10 | faq |  | Vers qui se tourner en cas de litige avec un professionnel ? | trouve | reclamation reclamation#s1 | 0 | 1 | ✓ |
| faq#11 | faq |  | Une complémentaire santé est-elle utile ? | trouve | assurance_sante assurance_sante#s1 | 0 | 2 | ✓ |
| faq#12 | faq |  | Comment comparer deux contrats d'assurance ? | trouve | assurance_habitation assurance_habitation#s3 | 0 | 1 | ✓ |
| faq#13 | faq |  | Comment l'impôt est-il prélevé quand on est deux à travailler ? | trouve | impots_classes impots_classes#s1 | 0 | 2 | ✓ |
| faq#14 | faq |  | Pourquoi la déclaration se solde-t-elle souvent par un montant à payer ? | trouve | impots_classes impots_classes#s1 | 0 | 0 | ✓ |
| faq#15 | faq |  | Les délais d'arrivée sont-ils les mêmes hors Union européenne ? | trouve | arrivee arrivee#s1 | 0 | 3 | ✓ |
| faq#16 | faq |  | La déclaration à la commune suffit-elle ? | trouve | arrivee arrivee#s1 | 0 | 2 | ✓ |
| faq#17 | faq |  | Un compte bancaire étranger peut-il servir à recevoir le salaire ? | trouve | banque banque#s0 | 0 | 2 | ✓ |
| faq#18 | faq |  | Que faut-il pour ouvrir un compte bancaire ? | trouve | banque banque#s0 | 0 | 2 | ✓ |
| faq#19 | faq |  | Qui déclare l'entrée à la sécurité sociale ? | trouve | matricule matricule#s0 | 0 | 1 | ✓ |
| faq#20 | faq |  | Le luxembourgeois est-il nécessaire pour travailler ? | trouve | langues langues#s0 | 0 | 1 | ✓ |
| faq#21 | faq |  | Combien de temps faut-il pour obtenir la nationalité ? | trouve | nationalite nationalite#s0 | 0 | 2 | ✓ |
| faq#22 | faq |  | Le salaire luxembourgeois compense-t-il le coût de la vie ? | trouve | cout_vie cout_vie#s0 | 0 | 3 | ✓ |
| faq#23 | faq |  | Dans quel délai faut-il se déclarer à la commune ? | trouve | arrivee arrivee#s0 | 0 | 2 | ✓ |
| faq#24 | faq |  | Comment obtient-on le matricule ? | trouve | arrivee arrivee#s1 | 0 | 2 | ✓ |
| faq#25 | faq |  | Un compte bancaire luxembourgeois est-il obligatoire ? | trouve | banque banque#s0 | 0 | 2 | ✓ |
| faq#26 | faq |  | Quelle garantie locative un bailleur peut-il demander ? | trouve | bail bail#s0 | 0 | 2 | ✓ |
| faq#27 | faq |  | Comment se cherche un logement au Luxembourg ? | trouve | recherche_logement recherche_logement#s0 | 0 | 1 | ✓ |
| faq#28 | faq |  | À quel moment souscrire l'assurance habitation ? | trouve | assurance_habitation assurance_habitation#s0 | 0 | 3 | ✓ |
| faq#29 | faq |  | Un permis de conduire européen reste-t-il valable ? | trouve | permis permis#s0 | 0 | 1 | ✓ |
| faq#30 | faq |  | Comment s'immatricule un véhicule importé ? | trouve | vehicule vehicule#s6 | 0 | 3 | ✓ |
| faq#31 | faq |  | Les transports publics sont-ils vraiment gratuits ? | trouve | transport transport#s0 | 0 | 2 | ✓ |
| faq#32 | faq |  | Qu'est-ce que le régime des impatriés ? | trouve | impatries impatries#s0 | 0 | 1 | ✓ |
| faq#33 | faq |  | Existe-t-il une classe d'impôt 1b ? | trouve | impots_classes impots_classes#s0 | 0 | 2 | ✓ |
| faq#34 | faq |  | Qui relève de la classe 1a ? | trouve | impots_classes impots_classes#s0 | 0 | 1 | ✓ |
| faq#35 | faq |  | Un divorce ou un décès fait-il changer de classe d'impôt immédiatement ? | trouve | impots_classes impots_classes#s0 | 0 | 2 | ✓ |
| faq#36 | faq |  | Le régime des impatriés dépend-il de la classe d'impôt ? | trouve | impatries impatries#s0 | 0 | 3 | ✓ |
| faq#37 | faq |  | Quelle différence entre classe 1 et classe 2 ? | trouve | impots_classes impots_classes#s3 | 0 | 1 | ✓ |
| faq#38 | faq |  | Qu'est-ce qui se déduit des impôts ? | trouve | deductions deductions#s2 | 0 | 1 | ✓ |
| faq#39 | faq |  | Comment faire corriger une classe d'impôt inexacte ? | trouve | conseil_fiscal conseil_fiscal#s1 | 0 | 3 | ✓ |
| faq#40 | faq |  | Comment obtient-on sa fiche de retenue d'impôt ? | trouve | conseil_fiscal conseil_fiscal#s1 | 0 | 2 | ✓ |
| faq#41 | faq |  | Les intérêts d'un prêt immobilier sont-ils déductibles ? | trouve | interets interets#s3 | 0 | 3 | ✓ |
| faq#42 | faq |  | Quelle part du prix une banque finance-t-elle ? | trouve | achat achat#s0 | 0 | 3 | ✓ |
| faq#43 | faq |  | La TVA sur un logement neuf est-elle toujours de 3 % ? | trouve | achat achat#s1 | 0 | 2 | ✓ |
| faq#44 | faq |  | Qui peut prétendre à un logement à coût modéré ? | trouve | logement_abordable logement_abordable#s0 | 0 | 1 | ✓ |
| faq#45 | faq |  | Peut-on exercer une activité indépendante en plus d'un emploi salarié ? | trouve | independant independant#s0 | 0 | 1 | ✓ |
| faq#46 | faq |  | Comment se fait l'inscription à l'école ? | trouve | ecole ecole#s2 | 0 | 2 | ✓ |
| faq#47 | faq |  | Existe-t-il une aide pour la crèche ? | trouve | garde garde#s0 | 0 | 1 | ✓ |
| faq#48 | faq |  | Quel est le montant des allocations familiales ? | trouve | allocations allocations#s0 | 0 | 1 | ✓ |
| faq#49 | faq |  | Combien de jours de congé donne la loi ? | trouve | conges conges#s0 | 0 | 2 | ✓ |
| faq#50 | faq |  | Combien de temps pour avoir internet ? | trouve | telecom telecom#s1 | 0 | 1 | ✓ |
| faq#51 | faq |  | Faut-il apprendre le luxembourgeois ? | trouve | langues langues#s0 | 0 | 1 | ✓ |
| faq#52 | faq |  | Quel numéro d'urgence appeler ? | trouve | sante_pratique sante_pratique#s0 | 0 | 1 | ✓ |
| faq#53 | faq |  | Comment fonctionne le tri des déchets ? | trouve | dechets dechets#s0 | 0 | 0 | ✓ |
| faq#54 | faq |  | Peut-on avoir la double nationalité ? | trouve | nationalite nationalite#s0 | 0 | 1 | ✓ |
| faq#55 | faq |  | Qu'est-ce que l'indexation des salaires ? | trouve | cout_vie cout_vie#s0 | 0 | 2 | ✓ |
