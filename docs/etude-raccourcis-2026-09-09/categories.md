# Classement des 50 actionmaps

Annexe à l’[étude du 9 septembre 2026](C:/Users/patri/Project/spaceMapper/docs/etude-raccourcis-2026-09-09.md). Inventaire : **1 103 actions** du profil local `sc-alpha-4.10.0-hotfix`.

Le tableau décrit un **classement recommandé à partir des données**, pas une matrice d’activation intégralement prouvée en jeu. Les commandes internes à un même état doivent rester comparables. Une exclusion entre états n’est valable que pour les actions réellement limitées à ces états ; les transitions et fonctions communes doivent être traitées séparément.

| Actionmap | Actions | Portée à retenir pour l’étude et décision proposée |
|---|---:|---|
| `seat_general` | 27 | Sortie/éjection, changement de mode et entrée en tourelle distante. Actions de siège et de transition ; disponibilité selon poste/équipement. Ne pas les exclure du mode de départ. |
| `spaceship_general` | 19 | Mise en route, autodestruction, portes/ports et fonctions générales. Vérifier l’accès depuis les postes ; aucune exclusion globale contre les tourelles. |
| `vehicle_mfd` | 55 | Interaction et navigation MFD. Conditions de poste, écran et focus à établir ; ne pas assimiler automatiquement à la locomotion du pilote. |
| `spaceship_view` | 28 | Vue extérieure, regard libre, caméra et commandes associées. Distinguer déplacement du regard et commande de vol, ainsi que les modes de caméra. |
| `spaceship_movement` | 103 | Pilotage, axes et réglages de vol. Extraire une liste de locomotion pure partageable avec marche/EVA/conduite ; ne pas appliquer la même exclusion aux transitions et réglages. |
| `spaceship_quantum` | 1 | `v_toggle_qdrive_engagement`. Dépend du mode/poste et du geste ; partage avec d’autres fonctions du bouton seulement si conditions exclusives établies. |
| `spaceship_docking` | 2 | Procédures d’amarrage. État et accès à vérifier ; elles peuvent accompagner des commandes générales de pilotage. |
| `spaceship_targeting` | 25 | Acquisition/sélection de cibles. Fonction de combat à qualifier par poste, pas simplement « pilote ». |
| `spaceship_targeting_advanced` | 22 | Ciblage avancé et pins. Potentiellement utile à plusieurs postes ; ne pas exclure face à la tourelle par préfixe. |
| `spaceship_target_hailing` | 1 | Communication avec une cible. À comparer avec les fonctions de siège/communication disponibles. |
| `spaceship_radar` | 1 | Fonction radar. Distinguer ping/radar et écran de scan ; ne pas imposer une exclusion avec le minage à partir du nom. |
| `spaceship_scanning` | 11 | Scan actif et navigation de ses résultats. Vérifier le mode/focus pour les actions internes ; garder distinctes acquisition, ping et transition vers le scan. |
| `spaceship_mining` | 10 | Laser, puissance, consommables et cargaison. Poste minier spatial ou terrestre selon équipement ; état outil et poste sont deux dimensions. |
| `spaceship_salvage` | 31 | Faisceaux, têtes et commandes de récupération. Séparer leurs modes internes et les fonctions partagées de tracteur ; vérifier les commandes pouvant rester simultanées. |
| `turret_movement` | 17 | Visée, souris, sortie et changement de tourelle. Les axes purs peuvent être séparés du pilotage ; les transitions demandent des règles propres. |
| `turret_advanced` | 9 | Recentrage, ESP, limiteur et position. Conflits internes possibles ; ne pas exclure tir, ciblage, MFD ou outil du même poste. |
| `spaceship_weapons` | 49 | Armement et tirs. La portée dépend du poste et des armes contrôlées ; nom `spaceship` insuffisant pour exclure une tourelle. |
| `spaceship_missiles` | 14 | Missiles et réglages associés. Mode opérateur et accès depuis le poste à qualifier. |
| `spaceship_defensive` | 12 | Défense et contre-mesures. Disponibilité dépendante des systèmes/modes ; ne pas en déduire une séparation de tous les autres contrôles du véhicule. |
| `spaceship_auto_weapons` | 1 | Commande d’armement automatique. Accès du poste à vérifier, conservation des conflits possibles. |
| `spaceship_power` | 29 | Énergie et réglages des systèmes. Reconnaître les six partages tap/maintien de F5/F6/F7 et Alt ; garder comparables les autres commandes disponibles ensemble. |
| `spaceship_hud` | 27 | Mélange HUD vaisseau, mobiGlas, carte, chat, visière. Séparer les actions réellement personnelles des actions propres au HUD du véhicule. |
| `lights_controller` | 5 | Éclairage. Portée et équipement à vérifier, sans inférer un poste pilote exclusif. |
| `vehicle_mobiglas` | 28 | Interface 3D, navigation et focus. Fonctions semblables à certaines de `player`; distinguer affichage/focus et actions d’ouverture. |
| `stopwatch` | 2 | Chronomètre. Fonction transversale présumée ; vérifier la graphie atypique `ActivationMode` et la portée. |
| `player` | 144 | Mélange locomotion, armes, mêlée, interaction, mobiGlas, carte et interface 3D. **Découpage par action indispensable.** |
| `prone` | 2 | Actions spécifiques à la position couchée. Séparation des locomotions assises probable ; conserver les commandes personnelles simultanées. |
| `mapui` | 19 | Commandes internes à la carte. Conflits internes possibles ; exclusion face au gameplay seulement après vérification de la capture de l’entrée concernée. |
| `hacking` | 22 | Interface/activité de piratage. Qualifier son focus et les actions personnelles/globales encore accessibles. |
| `tractor_beam` | 10 | Outil tracteur personnel. État de l’outil, visée et EVA à examiner ; ne pas l’exclure de toute EVA. |
| `mining` | 1 | Minage personnel, distinct du laser véhicule. Qualifier outil/état ; ne pas confondre avec une locomotion. |
| `incapacitated` | 1 | État d’incapacité. Exclusions possibles avec locomotion active ; interface, secours et transitions à garder séparés. |
| `zero_gravity_eva` | 23 | Propulsion, rotation, freinage, boost et regard EVA. Séparer la locomotion des autres postes, garder conflits internes et fonctions personnelles compatibles. |
| `zero_gravity_traversal` | 4 | Traversée et impulsions en apesanteur. Qualifier transition/surface/EVA libre ; ne pas considérer automatiquement tout l’actionmap exclusif d’EVA. |
| `vehicle_general` | 27 | Vue, klaxon, mobiGlas, carte, portes/ports et fonctions communes du véhicule terrestre. Séparer ces fonctions de la seule conduite. |
| `vehicle_driver` | 20 | Déplacement et conduite. Comparer les actions internes, ainsi que vue libre et fonctions générales selon leur mode. |
| `debug` | 14 | Commandes techniques. Vérifier si elles sont actives dans le client public ; « non pertinente pour ce profil » n’est pas « impossible à faire entrer en conflit ». |
| `IFCS_controls` | 4 | Réglages IFCS. Fonctions de pilotage à qualifier, avec disponibilité simultanée aux autres réglages. |
| `spectator` | 28 | Déplacement/caméra/sélection propres au spectateur. Séparer du contrôle du personnage vivant, conserver conflits internes et vérifier les fonctions UI communes. |
| `default` | 57 | UI, chat, sortie de siège, réapparition, cinématiques et commandes techniques. **Aucun contexte global unique n’est suffisamment précis.** |
| `ui_textfield` | 6 | Saisie de texte et édition. Focus de texte nécessaire ; vérifier les entrées réellement capturées et les commandes globales conservées. |
| `ui_notification` | 3 | Interaction avec les notifications. Disponible selon notification/focus, potentiellement avec plusieurs locomotions/postes. |
| `player_emotes` | 40 | Émotes. Restrictions d’animation/position à qualifier ; le préfixe ne prouve pas une exclusion universelle avec un siège. |
| `player_input_optical_tracking` | 13 | Suivi de tête, recentrage, voix et FOIP. Fonctions transversales ; **ne pas les limiter à la marche**. |
| `player_choice` | 39 | Menus d’interaction incluant systèmes de vol, véhicule et tourelles. Focus et cible d’interaction ; **ne pas les limiter à la marche**. |
| `flycam` | 19 | Caméra libre. Vérifier mode de caméra/outil et disponibilité en client public ; conserver conflits internes si active. |
| `view_director_mode` | 32 | Caméra extérieure, cadrage, vues et activation. **Ce n’est pas automatiquement le mode spectateur.** |
| `character_customizer` | 28 | Éditeur de personnage. Généralement distinct du contrôle du monde, mais navigation UI et commandes internes restent comparables. |
| `RemoteRigidEntityController` | 17 | Contrôle spécialisé d’entité. Portée non démontrée par l’extrait ; classer à vérifier/hors usage courant, avec raison explicite. |
| `server_renderer` | 1 | Commande technique. Disponibilité locale non établie ; ne pas inventer un contexte joueur. |

## Lecture des données brutes

L’[inventaire JSON](C:/Users/patri/Project/spaceMapper/docs/etude-raccourcis-2026-09-09/inventaire.json) fournit les 1 103 actions avec leur identifiant complet `actionmap/action`, attributs, enfants XML, déclarations de contrôles et modes. Il fournit séparément les 471 surcharges du joueur, y compris les 276 contrôles blancs.

La colonne de contexte `current_diagnostic_context` du JSON photographie **le logiciel actuel**, pas le classement recommandé dans ce tableau. Les échantillons `pair_samples` sont des paires candidates à étudier ; les champs `resolved_trigger_attributes` décrivent l’héritage analysé sans simuler l’arbitrage interne du jeu.

Pour reproduire l’inventaire, lancer Python 3 avec le [script d’audit](C:/Users/patri/Project/spaceMapper/tools/audit-shortcuts.py) et les arguments `--defaults`, `--overrides`, `--build-manifest` et `--output`. Seul le fichier JSON demandé est écrit. Les XML du jeu restent en lecture seule.
