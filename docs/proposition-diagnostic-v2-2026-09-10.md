# Proposition : diagnostic V2 des raccourcis

Proposition du 10 septembre 2026, fondée sur l’[étude des 1 103 actions](C:/Users/patri/Project/spaceMapper/docs/etude-raccourcis-2026-09-09.md) et le retour du joueur : configuration utilisée sans problème de conflit perceptible dans les activités pratiquées, avec des activités restant à essayer. Le profil lu aujourd’hui a la même empreinte que celui de l’étude.

**Objectif : réserver les alertes principales aux conflits probables et rendre les réutilisations de boutons compréhensibles.** La configuration actuelle fournit une base de travail ; l’absence de problème rapporté devient une information sur les usages testés.

Ce document propose le comportement d’une prochaine version. Il n’installe pas de nouvelle règle et ne modifie aucune assignation.

## 1. Trois résultats pour chaque paire d’actions

| Résultat | Critère | Présentation |
|---|---|---|
| **Conflit probable** | Même entrée physique canonique, deux fonctions distinctes, disponibles dans une même situation identifiée, avec des déclenchements qui se recouvrent avec une bonne confiance. | Badge rouge ; inclus dans le compteur principal. Une explication précise nomme la situation et l’autre action. |
| **À vérifier** | Une entrée est partagée, mais le focus, le regard libre, le blocage des appuis, l’héritage ou la disponibilité d’une action reste incertain. | Indicateur ambre discret ; liste repliée et compteur secondaire. Aucune alerte rouge automatique. |
| **Partage prévu** | Les données étayent une séparation des états, un partage d’appuis ou une coexistence intentionnelle. | Aucun badge de conflit ; raison consultable dans le détail du contrôle. |

Les contrôles indépendants, les assignations supprimées et les lignes d’une même action ne produisent aucune paire rivale. « Partage prévu » reste une conclusion documentée ; la simple présence de deux actions sur le même bouton dans les défauts ne suffit pas à l’accorder automatiquement.

Les relations sont évaluées **par paire**, puis regroupées par contrôle dans le détail. Le compteur principal compte les commandes concernées, sans doubler une commande ayant plusieurs rivales. Un contrôle peut avoir plusieurs partages prévus et une seule paire à vérifier : seules les actions de cette paire reçoivent ce statut.

Si aucun conflit probable n’est détecté mais que des cas restent incertains, l’interface l’indique explicitement : « Aucun conflit probable détecté — des partages restent à vérifier ». Elle n’affiche pas une validation générale du profil.

## 2. Règles concrètes

### Combinaisons et appuis

- Bouton seul, Ctrl + bouton et Maj + bouton restent des usages distincts. La normalisation traite la casse et l’ordre d’écriture, tout en conservant le côté gauche/droite du modificateur et l’instance du périphérique.
- Les seuils réels, les flags de pression/relâchement/maintien et les modes propres au périphérique sont lus. Le partage court/long de F5/F6/F7 et Alt est reconnu.
- Un mode inconnu ou incomplet passe dans « À vérifier ». Il n’est pas converti en appui simple.
- `hold` est distingué du maintien retardé. La variante double appui non bloquante, les seuils pouvant se recouvrir et la pression immédiate suivie d’un maintien demandent une règle documentée ou restent à vérifier.
- Pour les axes, comparer aussi les domaines, le sens et les éventuels seuils. Une valeur analogique ne doit pas être diagnostiquée comme un simple bouton.
- Touche nue contre combinaison modifiée : pas d’alerte rouge seulement parce que le bouton de base est commun. Une incertitude de masquage ou de priorité reste consultable dans « À vérifier ».

### Situations de jeu

- Autoriser les partages entre les **actions de locomotion précises** de marche, EVA, pilotage et conduite relevées par l’étude.
- Séparer les axes de pilotage et les axes de tourelle quand le poste contrôlé établit leur exclusivité. Garder les transitions et les commandes communes à part.
- Comparer les actions internes à la carte, à l’EVA, à la conduite et au spectateur lorsqu’elles peuvent répondre dans le même état. Les oppositions gauche/droite ou avancer/reculer ne bénéficient pas d’une exclusion générale.
- Traiter par action l’ouverture mobiGlas/carte, le chat, la voix, le suivi de tête, les interactions et les MFD. Les noms `player_*`, `vehicle_*` ou `spaceship_*` ne suffisent pas à définir leur disponibilité.
- Minage, récupération, scan, ping et changements de mode : appliquer uniquement les exclusions documentées pour la fonction et le poste concernés. Toute condition manquante conduit à « À vérifier ».

## 3. Résultat attendu sur les exemples de l’étude

Ce tableau décrit le classement proposé, pas le résultat d’un nouveau moteur déjà exécuté sur un profil fusionné.

| Exemple | Classement proposé | Explication affichée |
|---|---|---|
| W/A/S/D pour marcher, se propulser en EVA, piloter ou conduire | **Partage prévu** | « Commandes de déplacement utilisées dans des états distincts. » |
| Les quatre locomotions sur `js2_y` dans ton profil | **Partage prévu** pour ces paires de locomotion | Même logique, sur un axe analogique. |
| F6 augmenter/maximiser énergie moteurs ; équivalents F5/F7 et Alt | **Partage prévu** | « Appui bref / maintien retardé prévus dans les données du jeu. » |
| Autodestruction et éjection sur `js2_rctrl+button5` | **À vérifier**, sans rouge | « Maintien 0,5 s / double appui. L’arbitrage des deux gestes reste à confirmer. » |
| Entrée en tourelle distante et ports sur `js1_rctrl+button5` | **À vérifier**, sans rouge | « Appui simple / double appui. Le blocage de l’appui simple reste à confirmer. » |
| Vue verticale et déplacement du véhicule sur `js2_y` | **À vérifier** | « Le partage dépend de l’activation du regard libre. » |
| Deux directions EVA affectées au même bouton et au même appui | **Conflit probable** | « Deux directions différentes peuvent répondre dans le même état EVA. » Ce cas est illustratif, pas un défaut affirmé de ton profil. |

Pour les deux combinaisons `Ctrl + bouton 5`, le statut reste distinct de leur importance pratique. Leur détail peut rappeler les fonctions concernées, sans transformer l’incertitude en conflit confirmé.

## 4. Tenir compte de ce que tu as réellement testé

Une commande **« Partage testé en jeu »** permettrait d’annoter une paire après vérification. La validation préciserait le profil, le contrôle, les gestes, la situation testée et la version du jeu. Le statut afficherait alors « Partage testé — pilotage », par exemple, avec la provenance « retour utilisateur ».

La déclaration générale « ma configuration fonctionne » ne validerait pas automatiquement toutes les paires. Les confirmations resteraient précises et révocables. Un changement de contrôle, de geste, de règle de contexte, de périphérique ou de version du jeu rendrait la paire à réexaminer ; une modification sans rapport dans le profil ne supprimerait pas toutes les validations.

Les activités pourraient être filtrées pour préparer une session : pilotage, à pied, tourelle, minage, récupération, conduite, EVA. Le filtre afficherait aussi les commandes transversales pertinentes — UI, voix, systèmes et transitions. Une vue « Toutes les activités » conserverait les cas que tu n’as pas encore testés. Aucune activité ne serait considérée comme pratiquée sans ton indication.

Ces annotations appartiendraient aux données de SpaceMapper. Elles n’auraient pas à être écrites dans le XML du jeu.

## 5. Comportement de l’interface

- Vue principale : compteur **« Conflits probables »** et badges rouges uniquement pour ce niveau.
- À côté : compteur secondaire **« À vérifier »**, avec liste repliée par défaut. Pas de fenêtre surgissante à l’ouverture pour des cas incertains.
- Détail d’un contrôle : actions regroupées par situation et par appui, avec raison du classement.
- Pendant une modification : diagnostic du résultat en attente, y compris si seul le type d’appui change.
- Enregistrement : avertissement explicatif lorsqu’une modification crée un conflit probable ; possibilité de conserver un partage voulu.
- Un même classement alimente la liste, les compteurs, les filtres, le sélecteur d’appui et l’assistant de configuration.

## 6. Mise en œuvre proposée

1. **Fiabiliser les données lues** : flags et délais bruts, assignations dans les enfants XML, modes propres au périphérique, surcharges et suppressions. L’étude a relevé 254 actions avec déclencheurs bruts et 58 assignations uniques supplémentaires dans les enfants.
2. **Remplacer la réponse binaire par un classement argumenté** : statut, raison, paire concernée et qualité de la preuve. Définir les exceptions par action avant d’appliquer une règle de famille.
3. **Adapter les badges et filtres** aux trois niveaux, en conservant une seule source de diagnostic pour tous les écrans.
4. **Ajouter les validations utilisateur et filtres d’activité**, sans généralisation automatique à des gameplays non testés.

La première livraison devrait comprendre les trois premières étapes : elles réduisent déjà les fausses alertes à partir des données disponibles. La mémorisation des essais utilisateur complète ensuite ce diagnostic.

## 7. Critères de validation de cette version

| Cas de vérification | Résultat attendu |
|---|---|
| Six paires d’énergie F5/F6/F7 et Alt avec les vrais attributs XML | Partages prévus, sans badge rouge. |
| Les deux paires `Ctrl + bouton 5` du profil | À vérifier, distinctes d’un doublon de même appui. |
| `js2_y` partagé entre locomotions et vue du véhicule | Locomotions expliquées ; seule la paire vue/conduite dépendante du regard libre reste à vérifier. |
| Deux actions opposées dans le même état sur la même entrée | Conflit probable, y compris carte/EVA/conduite/spectateur. |
| Mode absent avec flags connus / mode réellement inconnu | Interpréter les premiers ; classer le second à vérifier. |
| Réécriture de la casse ou de l’ordre des modificateurs | Identité de combinaison inchangée. |
| Modification du seul appui ou suppression en attente | Recalcul cohérent avant enregistrement. |
| Partage confirmé pour un poste puis changement du geste | Confirmation à réexaminer ; pas de validation automatique du nouveau geste. |

L’objectif mesurable est de diminuer les **alertes rouges injustifiées** sur ces cas. Le nombre final ne peut pas être annoncé avant exécution du nouveau diagnostic sur le profil effectif : les compteurs de paires de l’étude ne sont pas des compteurs de conflits. La version actuelle exclut déjà très largement certains contextes ; une comparaison utile peut donc réapparaître en « À vérifier » ou en « Conflit probable » tout en améliorant la précision globale.
