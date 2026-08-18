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
| Sauvegarde automatique avant écriture | ✅ | ✅ |
| **Modifier les déplacements** (vol et à pied) | ✅ | ✅ |
| Modifier le combat, l'énergie, les systèmes | — | ✅ |
| Modificateurs et modes d'activation | — | ✅ |
| Export, import, synchronisation | — | ✅ |
| Réparation de l'ordre des périphériques | — | ✅ |
| Linter XML avec correction automatique | — | ✅ |
| Presets communautaires | Aperçu | Application 1 clic |
| Studio visuel, assistant pas-à-pas | — | ✅ |

### Ce que Lite garantit

**Lite n'effectue aucun appel réseau.** Pas de télémétrie, pas de compte, pas de mise à jour silencieuse.

**Lite sauvegarde toujours avant d'écrire.** Une copie horodatée est déposée dans `%APPDATA%\SpaceMapper\Backups` avant chaque modification. Si la sauvegarde échoue, la modification n'a pas lieu. Ce comportement n'est pas désactivable, et n'est pas une fonctionnalité payante : c'est la condition pour avoir le droit d'écrire dans vos fichiers.

**Lite ne touche qu'aux déplacements.** Le périmètre est appliqué dans la couche d'écriture en Rust, pas dans l'interface — une catégorie hors périmètre est refusée quoi qu'affiche l'écran. Les assignations portant un modificateur ou un mode d'activation sont présentées en lecture seule plutôt que modifiées à l'aveugle.

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
