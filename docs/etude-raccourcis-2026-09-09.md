# Étude des raccourcis Star Citizen et des conflits — 9 septembre 2026

**Conclusion : les exclusions fiables doivent porter sur des actions précises et leurs conditions d’activation. Aucune des catégories « carte », « EVA », « véhicule » ou « spectateur » ne peut être déclarée entièrement sans conflits, notamment entre ses propres commandes.**

Les règles récemment appliquées dans SpaceMapper traduisent les préférences de diagnostic demandées. Les tests ont validé leur application dans le logiciel ; ils n’ont pas démontré que les commandes correspondantes sont toujours exclusives dans Star Citizen. Cette étude distingue donc **absence de conflit d’entrée**, **partage prévu**, **conflit possible** et **comportement restant à vérifier**.

## Périmètre et niveau de preuve

L’analyse porte sur **50 actionmaps et 1 103 actions par défaut**, ainsi que **471 surcharges `<rebind>` portant sur 465 actions dans 38 actionmaps** du profil local. Une action et une assignation sont deux choses différentes : une action peut recevoir plusieurs contrôles, ou aucun.

Le manifeste de l’installation indique `sc-alpha-4.10.0-hotfix`, changelist `12572603`, compilation du 3 septembre 2026. Le fichier par défaut a été extrait localement le 9 septembre. L’inventaire joint conserve les attributs, les contrôles, les modes et les empreintes des sources.

Sources de travail :

- [Profil par défaut extrait de Data.p4k](C:/Users/patri/AppData/Local/Temp/defaultProfile.decoded.xml), notamment les déclarations `ActivationModes` aux lignes 14–31.
- [Surcharges du profil joueur](<C:/Program Files/Roberts Space Industries/StarCitizen/LIVE/user/client/0/Profiles/default/actionmaps.xml>), photographiées par l’inventaire à la date de l’étude.
- [Règles de contexte de SpaceMapper](C:/Users/patri/Project/spaceMapper/crates/spacemapper-core/src/context.rs), [lecture des défauts](C:/Users/patri/Project/spaceMapper/crates/spacemapper-core/src/defaults.rs) et [classification des appuis](C:/Users/patri/Project/spaceMapper/packages/app-core/src/lib/activation.ts).
- Documentation officielle CIG et documentation CRYENGINE, citées près des conclusions concernées.

Les défauts et les surcharges sont inventoriés séparément. Leur union brute ne constitue pas le profil effectif : les suppressions, les familles de périphériques, les contrôles enfants et les remappages doivent être résolus. Les nombres de paires partageant une entrée dans l’inventaire sont des **candidats d’analyse**, jamais un nombre de conflits confirmés.

| Mesure dans chaque jeu de données indépendant | Défauts | Surcharges explicites |
|---|---:|---:|
| Assignations non vides distinctes | 984 | 195 |
| Déclarations de contrôles blancs | 1 945 | 276 |
| Paires d’actions partageant un token exact | 4 125 | 219 |
| Parmi elles, paires de même usage selon la règle actuelle | 3 655 | 186 |
| Parmi ces paires de même usage, exclues par le contexte actuel | 2 248 | 131 |

Ces chiffres ne sont pas ceux du compteur affiché par l’application : le script inventorie aussi les formes XML imbriquées et ne fusionne pas les deux jeux. Les tokens exacts n’intègrent pas encore une normalisation physique des alias souris/clavier, de l’ordre des modificateurs ou de leur casse.

Les noms de catégorie, `UICategory`, `UILabel` et `Category` sont des indices. Le fichier étudié ne contient aucune table d’activation exclusive des actionmaps ni aucun élément `actionfilter`. La documentation de l’ascendance CRYENGINE confirme que les cartes d’actions et leurs filtres peuvent être activés par le code à l’exécution ; elle ne décrit pas l’arbitrage exact de Star Citizen 4.10. [CRYENGINE — Action Maps](https://www.cryengine.com/docs/static/engines/cryengine-3/categories/1638401/pages/1933340)

## 1. Ce qui peut être retiré du diagnostic avec une justification solide

| Situation | Décision | Condition nécessaire |
|---|---|---|
| Deux contrôles physiques indépendants | Aucun doublon de la même entrée | Identité réellement distincte après normalisation ; tenir compte d’un éventuel remappeur qui émet aussi une touche clavier. |
| Une assignation explicitement supprimée | Aucune concurrence produite par cette assignation | La suppression neutralise bien le contrôle hérité concerné. Les autres assignations de l’action peuvent subsister. |
| Plusieurs lignes de la même action, dans le même actionmap | Pas de conflit entre deux fonctions | Ne pas étendre cette règle à tous les identifiants identiques présents dans des actionmaps différents sans vérifier leur sens. |
| Deux commandes de locomotion réservées à des états personnels exclusifs | Partage de contrôle acceptable | États stabilisés, action limitée à cette locomotion : marche, propulsion EVA, pilotage du vaisseau ou conduite au sol. |
| Deux plages analogiques explicitement disjointes | Pas de déclenchement simultané pour une même valeur | Comparer seuils, sens, domaine de l’axe et événements de relâchement ; un nom « gauche/droite » ne suffit pas. |

« Deux contrôles différents » signifie absence de doublon d’entrée. Cela n’interdit évidemment pas au joueur d’actionner deux boutons ensemble ni aux commandes de produire des effets opposés.

### Les partages de locomotion les mieux étayés

Le profil du jeu réutilise délibérément les quatre mêmes touches :

| Touche dans les défauts | Marche — `player` | EVA — `zero_gravity_eva` | Vaisseau — `spaceship_movement` | Véhicule terrestre — `vehicle_driver` |
|---|---|---|---|---|
| W | `moveforward` | `eva_strafe_forward` | `v_strafe_forward` | `v_move_forward` |
| S | `moveback` | `eva_strafe_back` | `v_strafe_back` | `v_move_back` |
| A | `moveleft` | `eva_strafe_left` | `v_strafe_left` | `v_yaw_left` |
| D | `moveright` | `eva_strafe_right` | `v_strafe_right` | `v_yaw_right` |

**Décision : forte confiance pour autoriser les partages entre ces fonctions dans leurs états respectifs.** Le guide CIG utilise lui-même WASD pour marcher puis pour manœuvrer le vaisseau. L’extension aux autres colonnes est corroborée par les défauts locaux et la séparation des fonctions de locomotion ; elle reste une inférence sur le fonctionnement normal, pas une mesure du moteur pendant une transition de siège. [CIG — Getting Started](https://support.robertsspaceindustries.com/hc/en-us/articles/360025028633-Getting-Started-in-the-Verse)

Cette table ne permet **pas** d’exclure tout `player` face à tout `spaceship_*`, ni les deux commandes gauche/droite à l’intérieur de la même colonne.

Pour les joysticks, le même raisonnement s’applique aux **axes de pilotage purs** et aux **axes de visée de tourelle purs**, sous réserve du poste effectivement contrôlé. Il ne s’étend pas automatiquement au tir, au ciblage, aux communications, aux MFD ou aux changements de poste.

## 2. Les partages d’appui prévus par les données du jeu

### Exemples à reconnaître pour éviter les fausses alertes

| Contrôle par défaut | Appui bref | Maintien | Conclusion |
|---|---|---|---|
| F6 | `v_engineering_assignment_engine_increase` | `v_engineering_assignment_engine_max` | Partage prévu : augmenter / maximiser énergie moteurs. |
| Alt gauche + F6 | `v_engineering_assignment_engine_decrease` | `v_engineering_assignment_engine_min` | Partage prévu : diminuer / minimiser. |
| F7 | `v_engineering_assignment_shields_increase` | `v_engineering_assignment_shields_max` | Même principe pour les boucliers. |
| Alt gauche + F7 | `v_engineering_assignment_shields_decrease` | `v_engineering_assignment_shields_min` | Même principe pour les boucliers. |
| F5 | `v_engineering_assignment_weapons_increase` | `v_engineering_assignment_weapons_max` | Même principe pour les armes. |
| Alt gauche + F5 | `v_engineering_assignment_weapons_decrease` | `v_engineering_assignment_weapons_min` | Même principe pour les armes. |

Ces **six paires** sont déclarées dans `spaceship_power` : `tap` pour le bref, `onHold="1" holdTriggerDelay="0.25"` pour le maintien. Les attributs bruts sont essentiels : le second membre n’a pas de `activationMode` nommé. Source : [défauts, ligne 883](C:/Users/patri/AppData/Local/Temp/defaultProfile.decoded.xml:883).

Le combat de mêlée fournit aussi deux paires attaque légère / lourde, gauche et droite, avec `tap` et `delayed_press` sur le même bouton. Leur partage est prévu par la configuration du jeu. Source : [défauts, ligne 1009](C:/Users/patri/AppData/Local/Temp/defaultProfile.decoded.xml:1009).

Pour le diagnostic, ces paires doivent être présentées comme **partages prévus par les seuils d’appui**, avec les conditions conservées. Une simple étiquette « court » ou « long » ne constitue pas un modèle complet des événements.

### Ce que les modes signifient réellement

Le profil déclare 18 modes. Les différences utiles sont :

| Mode | Déclaration observée | Conséquence pour l’analyse |
|---|---|---|
| `press` | Événement dès la pression, sans seuil positif | Peut aussi se produire au début d’un maintien. |
| `tap` / `tap_quicker` | Relâchement bref, seuil 0,25 / 0,15 s | Candidats au partage avec un maintien dont la fenêtre est séparée. |
| `hold` | Pression et relâchement, sans seuil positif | **Ce n’est pas un appui long retardé.** |
| `delayed_press*` | Seuils 0,15 / 0,25 / 0,5 / 1,5 s | Comparer les seuils réels, pas seulement leur famille. |
| `delayed_hold*` | Pression retardée et relâchement | Décrire les deux phases. |
| `double_tap` | `multiTap=2`, `multiTapBlock=1` | Partage simple/double plausible ; dépend du blocage appliqué par le jeu. |
| `double_tap_nonblocking` | `multiTap=2`, `multiTapBlock=0` | Un geste distinct peut coexister avec l’action simple. |
| `all`, `smart_toggle`, variantes de `hold` | Plusieurs phases ou retard de relâchement | Une classification en trois cases perd de l’information. |

Deux maintiens de seuils différents ne sont pas automatiquement exclusifs : un maintien long franchit plusieurs seuils. `tap` à 0,25 s et `delayed_press_quicker` à 0,15 s présentent même une zone de chevauchement potentiel. À l’inverse, le jeu peut arbitrer volontairement deux événements compatibles. On ne doit donc pas confondre **co-déclenchement** et **conflit gênant**.

### Les deux exemples de ton profil

| Actions | Configuration observée | Verdict de l’étude |
|---|---|---|
| `v_self_destruct` / `v_eject` | Même `js2_rctrl+button5` ; autodestruction hérite `delayed_press_medium` (0,5 s), éjection surchargée en `double_tap` | Usages différents, pas un doublon de geste. Partage plausible ; vérifier l’arbitrage, notamment un double appui dont le second est maintenu, avant de promettre une impossibilité absolue. |
| `v_enter_remote_turret_1` / `v_toggle_all_portlocks` | Même `js1_rctrl+button5` ; entrée `press`, ports `double_tap` | Partage simple/double intentionnel. L’absence de co-déclenchement dépend du traitement de `multiTapBlock`. L’entrée en tourelle est une transition depuis un siège, pas une action déjà réservée à la visée en tourelle. |

Le cas déplacement / esquive est différent : `moveleft` utilise `hold`, `melee_dodgeLeft` utilise `double_tap_nonblocking`, tous deux sur A. Le jeu prévoit des usages différents **sans déclarer leur exclusivité**. Cela justifie un statut « partage prévu », plutôt qu’une alerte de doublon systématique ou une garantie absolue.

## 3. Modificateurs : conserver les usages supplémentaires, normaliser les entrées

Ctrl + bouton, Maj + bouton et bouton seul sont des combinaisons différentes à présenter séparément. Il faut cependant analyser l’identité réelle du contrôle :

- Le fichier contient `ralt+K`, `u+lshift` et `f6+lalt`. La casse et la place du modificateur ne doivent pas fabriquer des entrées distinctes.
- `keyboard="mouse3"` apparaît dans le profil. Un contrôle souris rangé dans un attribut clavier n’est pas nécessairement un autre bouton physique.
- `noModifiers` existe dans le schéma. La documentation CRYENGINE lui donne explicitement le sens d’absence de Ctrl/Maj/Alt/Windows ; les règles exactes de priorité de Star Citizen restent à vérifier. Une différence de chaîne ne suffit donc pas à démontrer qu’une touche nue ne répondra jamais à une combinaison modifiée. [CRYENGINE — Action Maps](https://www.cryengine.com/docs/static/engines/cryengine-3/categories/1638401/pages/1933340)

**Décision proposée :** garder les combinaisons modifiées comme usages distincts, avec une identité canonique et une règle de masquage vérifiée. Ne pas revenir à une alerte sur tout bouton partagé. Les interactions périphérique/entrée doivent néanmoins rester un cas séparé : CIG signale lui-même des problèmes possibles entre certaines configurations joystick et souris. [CIG — Configuration des périphériques](https://support.robertsspaceindustries.com/hc/en-us/articles/360000134267-Set-up-keybindings-for-your-peripherals)

## 4. Les exclusions de contexte à corriger dans le raisonnement

| Règle générale | Ce que les données permettent réellement de conclure |
|---|---|
| « Tout ce qui est à pied est séparé du reste » | Valable pour une liste de locomotions exclusives. Faux comme règle globale : `player` contient `mobiglas`, `v_starmap` et des commandes `ui_3d_display_*`. Les fonctions personnelles ne disparaissent pas nécessairement en EVA. |
| « Tout véhicule terrestre est sans conflit » | La conduite peut partager les contrôles d’une autre locomotion. Deux actions de conduite ou deux fonctions du véhicule peuvent se concurrencer entre elles. `vehicle_general` contient aussi mobiGlas, carte, vue, portes et ports. |
| « Toute tourelle est séparée de tout le vol » | Distinguer les axes de pilotage et de tourelle. Les postes partagent potentiellement ciblage, systèmes, menus et commandes de transition. Une tourelle peut aussi être un poste minier. |
| « La carte ne peut produire aucun conflit » | La carte peut avoir un mode d’entrée propre. Ses actions internes restent comparables, et les commandes d’ouverture/fermeture doivent rester accessibles depuis plusieurs états. |
| « L’EVA ne peut produire aucun conflit » | Sa locomotion est distincte de la marche/pilotage, mais ses propres axes/boutons se comparent entre eux. Ne pas exclure les fonctions personnelles et l’interface. |
| « Le spectateur ne peut produire aucun conflit » | Séparer ses déplacements de ceux du personnage contrôlé. Vérifier les doublons internes et les commandes d’interface encore disponibles. |
| « Interface/HUD = un seul contexte global » | `spaceship_hud` mélange mobiGlas, chat, essuyage visière et HUD du vaisseau. `default` mélange UI, sortie de siège, réapparition et commandes techniques. Il faut les séparer par action. |

Exemples de **conflits possibles** si les deux actions reçoivent le même contrôle et le même déclenchement :

| Situation active | Paire à ne pas masquer automatiquement |
|---|---|
| Carte | `mapui_pan_left` / `mapui_pan_right` ; ou planifier / effacer une route |
| EVA | `eva_strafe_left` / `eva_strafe_right` ; ou propulsion / freinage |
| Conduite | `v_move_forward` / `v_move_back` |
| Spectateur | `spectate_next_target` / `spectate_prev_target` |

Ce sont des contre-exemples de principe, pas l’affirmation que ces paires sont actuellement mal assignées dans ton profil.

Un cas concret existe toutefois dans tes **surcharges** : `js2_y` est affecté à `vehicle_general/v_view_pitch` et `vehicle_driver/v_move`. L’exclusion véhicule masque toute comparaison de ces deux axes. Le bon verdict dépend de la condition de regard libre ; c’est un **partage à vérifier**, pas un conflit avéré.

Dans les **défauts**, le bouton joystick 8 est partagé par klaxon (`v_horn`) et boost (`v_boost`), et F4 par `spectate_gen_nextmode` et `spectate_toggle_thirdperson`. Le spectateur comporte sept paires internes de même usage ; certaines peuvent être des alias prévus. À l’inverse, aucune paire interne n’apparaît actuellement dans `mapui` ou `zero_gravity_eva` pris isolément. L’absence de doublon dans les défauts ne prouve pas qu’une réassignation future serait sans risque. EVA et traversal partagent notamment Espace entre `eva_strafe_up` et `zgt_launch`, ce qui demande de qualifier leurs états respectifs.

### Exceptions transversales particulièrement importantes

**mobiGlas et carte.** CIG décrit l’ouverture de la carte depuis le mobiGlas et son usage en vol. Il faut distinguer l’action qui ouvre la carte de la navigation à l’intérieur de celle-ci. Une exclusion de `mapui` ne doit pas masquer `v_starmap`, les actions `ui_3d_display_*` et les autres commandes d’interface concernées. [CIG — Quantum Travel](https://support.robertsspaceindustries.com/hc/en-us/articles/360019449994-How-to-Quantum-Travel)

**Voix, suivi de tête et interaction.** `player_input_optical_tracking` contient `headtrack_recenter_device`, `foip_pushtotalk` et `foip_pushtotalk_proximity`. `player_choice` contient des entrées `pc_pit_ship_systems`, `pc_pit_flight_systems`, `pc_pit_vehicle_actions` et `pc_pit_remote_turrets`. Leur préfixe `player` ne prouve pas une restriction à la marche. Le guide CIG décrit la voix et le regard comme fonctions de communication et d’observation dans le jeu. [CIG — FOIP, VOIP et Freelook](https://support.robertsspaceindustries.com/hc/en-us/articles/360009579674-FOIP-VOIP-and-Freelook-Guide)

**Minage, scan et tourelles.** Le guide industriel CIG couvre les outils portatifs, les véhicules ROC/ROC-DS et les vaisseaux miniers ; il décrit aussi le ping en SCM/NAV et l’analyse du gisement avant le laser. Une séparation globale « minage contre scan » ou « minage contre véhicule/tourelle » serait donc trop grossière. Distinguer laser, scan actif, ping, acquisition de données et changement de mode. La page officielle est disponible via son contenu indexé ; sa date exacte de mise à jour n’est pas fournie. [CIG — Industrial Gameplay Guide](https://robertsspaceindustries.com/en/comm-link/transmission/20050-Industrial-Gameplay-Guide)

**Les bugs ne sont pas des règles de contexte.** Par exemple, CIG classe l’impossibilité de poser certains gadgets miniers en EVA dans les problèmes connus de 4.10. Cela ne justifie pas une exclusion permanente entre tous les outils personnels et l’EVA. [CIG — Known Issues 4.10](https://support.robertsspaceindustries.com/hc/en-us/articles/360056254754-Star-Citizen-Alpha-4-10-Known-Issues)

## 5. Ce qui manque au diagnostic actuel de SpaceMapper

| Observation dans les données | Conséquence | Correction à prévoir |
|---|---|---|
| **254 actions** n’ont pas de `activationMode` exact, mais ont des flags `onPress`, `onHold`, `onRelease` ou `always` | Leur comportement n’est pas forcément un appui simple. Les six paires d’énergie en sont un exemple concret. | Conserver les flags, délais et seuils, puis calculer le déclenchement effectif. |
| **59 déclarations non vides imbriquées**, soit 58 assignations uniques supplémentaires, sont dans les enfants `<gamepad input="…">` ou `<inputdata>` | La lecture des seuls attributs de l’action perd des assignations. | Lire les formes imbriquées, leurs héritages et leur priorité. |
| `double_tap_nonblocking` est ramené au même usage que `double_tap` | Le caractère non bloquant disparaît. | Séparer la forme du geste de sa capacité à bloquer un autre événement. |
| Les modes à plusieurs phases et les seuils sont ramenés à trois usages | Certains recouvrements temporels deviennent invisibles. | Comparer les conditions d’activation complètes. |
| Les jetons sont comparés comme chaînes exactes | Ordre, casse ou famille d’attribut peuvent fausser l’identité. | Normaliser sans perdre les côtés gauche/droite des modificateurs ni l’instance physique. |
| Les contextes sont attribués à l’actionmap entier | Des commandes de voix, UI, carte ou systèmes héritent d’une exclusion incorrecte. | Définir des exceptions par action et des conditions de poste/écran/mode. |

Le fichier comporte aussi des graphies atypiques `ActivationMode` et `activationmode`. Le parseur actuel ne les lit pas comme `activationMode`. Leur acceptation par le jeu n’est pas établie : les conserver comme anomalies documentées, sans leur attribuer arbitrairement un comportement.

## 6. Règle de décision recommandée

Le diagnostic devrait répondre successivement à ces questions :

1. Les deux assignations existent-elles réellement après application des surcharges et suppressions ?
2. Reçoivent-elles une même entrée physique canonique, y compris un éventuel remappage ?
3. S’agit-il de deux fonctions distinctes ?
4. Existe-t-il un état du même joueur où les deux fonctions sont disponibles ?
5. Leurs conditions de modificateurs, de durée, de répétition, de phase et d’axe peuvent-elles se recouvrir ?
6. Le jeu prévoit-il un partage ou un blocage qui rend ce recouvrement acceptable ?

Utiliser quatre résultats lisibles :

| Résultat | Sens |
|---|---|
| **Aucun conflit d’entrée** | Une exclusion est établie et sa raison est connue. |
| **Partage prévu** | Le jeu distingue les usages ou prévoit leur coexistence ; conserver la condition explicative. |
| **Conflit possible** | Même entrée, actions distinctes, disponibilité et déclenchement pouvant se recouvrir. |
| **À vérifier** | Une information de filtre, de mode, d’héritage ou de blocage manque. |

Les contextes à modéliser sont des dimensions combinables : locomotion, poste contrôlé, mode de l’outil, écran/interface, interaction et situation de jeu. « Pilote avec mobiGlas ouvert » doit rester représentable ; « mode minage » ne remplace pas à lui seul le poste occupé.

### Vérifications ciblées nécessaires pour lever les derniers doutes

Les cas déterminants sont : pression immédiate contre maintien retardé ; simple contre double bloquant ; double non bloquant ; touche nue contre combinaison Ctrl/Maj ; transition vers une tourelle distante ; carte ouverte depuis marche, EVA et siège ; tir/ciblage dans les différents postes ; scan/ping en mode minage.

Pour les gestes, mesurer les événements avec des actions inoffensives de même déclaration dans un profil d’essai, y compris les limites 0,15/0,25/0,5 s et le maintien du second appui. Les deux actions dangereuses de ton exemple n’ont pas besoin d’être déclenchées pour comparer leurs règles. Une validation doit être associée au numéro de build et aux périphériques utilisés.

**L’étude n’a pas changé les règles du logiciel ni écrit dans le profil du jeu.** Elle fournit le classement et les limites à utiliser pour une prochaine correction fondée sur les données, avec un inventaire exhaustif des déclarations disponibles.

## Annexes

- [Inventaire des actions, contrôles, modes et groupes d’entrées partagées](C:/Users/patri/Project/spaceMapper/docs/etude-raccourcis-2026-09-09/inventaire.json).
- [Classement des 50 actionmaps](C:/Users/patri/Project/spaceMapper/docs/etude-raccourcis-2026-09-09/categories.md).
