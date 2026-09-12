# Mesure du diagnostic sur le profil réel — 10 septembre 2026

> Mise à jour : à la demande de Patrice, le filtre, le compteur et les mentions « À vérifier » ont été retirés de SpaceMapper. Les vérifications manuelles restent dans le carnet externe. Les chiffres correspondants ci-dessous décrivent l’audit technique initial, pas une fonction disponible dans le logiciel.

Le diagnostic passe de **543 assignations signalées à 20 conflits probables** sur les mêmes fichiers de jeu. **340 assignations** restent consultables dans « À vérifier ». Les **82 faux positifs déclarés sont écartés** et les **8 conflits déclarés sont conservés**.

## Méthode

Le harnais exécute les fonctions Rust `collect_editable`, `collect_overrides` et `colliding_contexts` extraites du véritable backend Premium, avec une copie de son crate partagé. Il applique ensuite les véritables fonctions TypeScript du diagnostic, transpilées sans réécrire leur logique. Les sources avant/après sont figées dans des dossiers temporaires et leurs empreintes sont enregistrées dans les rapports JSON.

Les deux mesures lisent les mêmes **471 surcharges**, les **1 103 actions par défaut** du profil extrait de `Data.p4k`, et les **90 observations** du carnet. Le profil du jeu et les observations sont lus sans modification.

L'ancien moteur compilé dans `dist/index.js` confirme également le total de 543. Le compteur de 550 observé dans une session antérieure n'a pas été reproduit avec ces entrées ; les chiffres ci-dessous sont donc une comparaison reproductible de fichiers et de sources précis, et non une reconstruction supposée de cette ancienne session.

## Résultats

| Mesure | Avant | Après |
|---|---:|---:|
| Lignes fusionnées | 1 356 | 1 414 |
| Surcharges utilisateur, assignées ou effacées | 471 | 471 |
| Lignes provenant des défauts | 885 | 943 |
| Assignations effectives | 1 080 | 1 138 |
| Lignes non assignées | 276 | 276 |
| Assignations signalées / conflits probables | 543 | 20 |
| Paires signalées / conflits probables | 1 246 | 14 |
| Assignations « À vérifier » | — | 340 |
| Paires « À vérifier » | — | 560 |

Les 58 lignes supplémentaires viennent de contrôles par défaut auparavant omis par le lecteur. Une assignation peut rencontrer un conflit probable avec une action et un partage incertain avec une autre : **une ligne figure dans les deux niveaux**. Les compteurs ne doivent donc pas être additionnés comme des ensembles disjoints.

### Origine des anciennes alertes

- **465** assignations signalées provenaient des défauts et **78** des surcharges.
- **1 140 paires** réunissaient deux défauts, **51** un défaut et une surcharge, et **55** deux surcharges.
- Aucun mode d'appui classé `unknown` n'était impliqué dans ces alertes ; en revanche, **216 lignes signalées avaient un mode d'activation absent**, assimilé par l'ancien diagnostic à un appui immédiat.
- Les contextes dominants étaient les commandes à pied (**225 lignes**), le pilotage (**137**) et l'interface/HUD (**131**).

### Répartition après correction

- Les **14 paires probables** comprennent les **8 observations de conflit réel** et **6 paires sans observation**, toutes mixtes surcharge/défaut.
- Les **20 assignations probables** comprennent **16 surcharges** et **4 défauts**.
- Parmi les **560 paires à vérifier**, **363** correspondent à des réglages par défaut préexistants et **197** à un déclencheur insuffisamment décrit.

Les six paires probables sans observation sont :

| Contrôle | Première action | Deuxième action |
|---|---|---|
| `js1_button2` | `seat_general/v_toggle_flight_mode` | `default/ui_hide_hint` |
| `js1_button2` | `seat_general/v_toggle_guns_mode` | `default/ui_hide_hint` |
| `js1_button2` | `seat_general/v_toggle_missile_mode` | `default/ui_hide_hint` |
| `kb1_ralt+k` | `spaceship_general/v_toggle_all_doors` | `spaceship_general/v_toggle_all_portlocks` |
| `js1_button1` | `spaceship_weapons/v_weapon_preset_fire_guns1` | `default/respawn` |
| `js1_button4` | `player_input_optical_tracking/foip_pushtotalk` | `default/flashui_kp_3` |

Ces paires restent des conflits **probables** : cette mesure ne démontre pas que les commandes concernées sont réellement actives simultanément dans le jeu.

## Conservation des retours

La validation retrouve les deux assignations de chaque observation avec le même contrôle et la même signature de déclenchement, puis vérifie que le moteur applique précisément la décision importée :

- **82 / 82 faux positifs** : motif `review_false_alarm`, aucune paire signalée.
- **8 / 8 conflits réels** : motif `review_real_conflict`, toutes les paires signalées, y compris le cas du véhicule terrestre auparavant exclu par catégorie.
- **0 signature divergente**, **0 observation perdue**.

## Fichiers reproductibles

- [Mesure avant](diagnostic-profile-baseline-2026-09-10.json)
- [Mesure après](diagnostic-profile-after-2026-09-10.json)
- [Harnais Rust et orchestration](../tools/diagnostic-profile-audit.py)
- [Exécution du moteur TypeScript](../tools/diagnostic-profile-audit.mjs)
- [Vérification de l'exécutable Premium isolé](../tools/premium-native-diagnostic-smoke.mjs)

## Vérification de l'exécutable réel

Le nouvel exécutable Premium a également été lancé dans une copie isolée, avec son propre dossier APPDATA et son propre profil WebView2. Le véritable backend IPC a chargé les données depuis l'installation du jeu : **1 414 lignes**, **90 observations**, **20 assignations probables** et **340 à vérifier**, conformément au harnais.

Les deux compteurs et leurs filtres ont été vérifiés dans l'interface embarquée. Les **90 signatures et verdicts** ont été reconnus. Aucun message d'erreur JavaScript n'a été relevé. Les empreintes du profil du jeu et du fichier réel d'observations sont restées identiques. L'instance de test a quitté proprement avec le code de sortie 0.

La dernière reconstruction a été revérifiée après l'ajout des attributs explicites : les 1 414 lignes exposent `explicit_trigger_attributes`, et l'action réelle F6 `v_engineering_assignment_engine_max` conserve bien `onHold=1` et `holdTriggerDelay=0.25`. Les compteurs restent à 20 et 340, avec les 90 observations reconnues.

Le résultat et les captures sont conservés dans `spaceMapper-premium/target/qa/premium-native-diagnostic-result.json`, `premium-native-diagnostic-probable.png` et `premium-native-diagnostic-uncertain.png`.
