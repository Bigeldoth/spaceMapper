# SpaceMapper

Gestion et optimisation des contrôles pour **Star Citizen**. Détecte vos périphériques par GUID matériel, lit vos assignations et les rend enfin lisibles.

> Édité par [Padek-interactive](https://padek-interactive.tech) — écosystème SpaceDrive.

---

## Ce dépôt

Ce dépôt public contient l'**édition Lite** et les crates partagés :

| Composant | Rôle |
|---|---|
| `crates/spacemapper-core` | Énumération DirectInput, modèle et **lecture** de `actionmaps.xml`, catalogue d'actions |
| `crates/spacemapper-edit` | Écriture sûre : périmètre restreint et sauvegarde obligatoire |
| `apps/spacemapper-lite` | Application de bureau Lite (Tauri + React) |

L'édition **Premium** (export, import, synchronisation, réparation de l'ordre des périphériques, linter avec correction, studio visuel, presets communautaires) est développée dans un dépôt privé et distribuée sous licence.

## Éditions

|  | Lite (gratuit) | Premium (15 €) |
|---|---|---|
| Détection des périphériques par GUID | ✅ | ✅ |
| Lecture et aperçu de toutes les assignations | ✅ | ✅ |
| Points de restauration et restauration | ✅ | ✅ |
| **Modifier le pilotage** (`spaceship_movement`) | ✅ | ✅ |
| **Modifier le déplacement à pied** (`player`) | ✅ | ✅ |
| Conduite, EVA, émotes, menu d'interaction | Affichés, verrouillés | ✅ |
| Combat, ciblage, énergie, systèmes, tourelles | — | ✅ |
| Modificateurs et modes d'activation | — | ✅ |
| Profils nommés et commutables | — | ✅ |
| Synchronisation entre machines | — | ✅ |
| Adaptation d'un preset à un autre matériel | — | ✅ |
| Réparation de l'ordre des périphériques | — | ✅ |
| Linter XML avec correction automatique | — | ✅ |
| Presets communautaires | Aperçu | Application 1 clic |
| Studio visuel, assistant pas-à-pas | — | ✅ |

### Ce que Lite garantit

**Lite fonctionne intégralement hors-ligne.** Ce n'est pas une promesse mais une propriété vérifiable : son arbre de dépendances ne contient **aucun client HTTP** — ni `reqwest`, ni `hyper`, ni `ureq`, ni `rustls`. Le binaire est techniquement incapable d'émettre une requête réseau. Pas de télémétrie, pas de compte, pas de mise à jour silencieuse. Vous pouvez le vérifier avec `cargo tree`.

**Lite ne modifie que le pilotage et la marche.** Le périmètre est appliqué dans la couche d'écriture en Rust, pas dans l'interface — une catégorie hors périmètre est refusée quoi qu'affiche l'écran. Les assignations portant un modificateur ou un mode d'activation sont présentées en lecture seule plutôt que modifiées à l'aveugle.

**Rien n'est écrit sans votre accord.** Vos modifications s'accumulent à l'écran ; un bandeau vous rappelle qu'elles ne sont pas enregistrées. Au moment d'enregistrer, vous pouvez relire la liste de ce qui va changer et choisir de créer un point de restauration au préalable.

**Vos sauvegardes vous appartiennent.** Les points de restauration sont du XML en clair dans `%APPDATA%\SpaceMapper\Backups`, hors du dossier du jeu. Ils restent lisibles et réutilisables même si vous désinstallez SpaceMapper. Nous ne chiffrons pas vos données pour vous forcer à rester.

> ⚠️ Fermez Star Citizen avant de modifier vos contrôles : le jeu réécrit `actionmaps.xml` en quittant et écraserait vos changements.

## Sécurité anti-triche

SpaceMapper fonctionne exclusivement **hors-processus**. Il ne lit ni n'écrit dans la mémoire de `StarCitizen.exe` et n'injecte aucun code. Les seules interactions passent par les fichiers de configuration `.xml` — aucun risque vis-à-vis d'Easy Anti-Cheat.

## Prérequis de développement

- [Rust](https://rustup.rs/) (stable) + Build Tools MSVC
- Node.js 20+
- Windows 10/11 (DirectInput)

```bash
npm install
npm run tauri dev
```

## Licence

Source disponible, **pas open source** — voir [LICENSE](LICENSE). Le code est
publié pour que chacun puisse vérifier ce que l'application fait ; la
redistribution et l'usage commercial par des tiers ne sont pas autorisés.

## État du projet

Phase 1 en cours. Le socle de lecture (`spacemapper-core`) et l'interface Lite
sont en place. La compilation Rust n'a pas encore été validée sur cette machine
faute de toolchain MSVC — voir les prérequis ci-dessus.

---

*« Star Citizen » et « Roberts Space Industries » sont des marques de Cloud
Imperium Rights LLC. SpaceMapper est un outil indépendant, sans affiliation.*
