# SpaceMapper

Gestion et optimisation des contrôles pour **Star Citizen**. Détecte vos périphériques par GUID matériel, lit vos assignations et les rend enfin lisibles.

> Édité par [Padek-interactive](https://padek-interactive.tech) — écosystème SpaceDrive.

---

## Ce dépôt

Ce dépôt public contient l'**édition Lite** et le cœur de lecture partagé :

| Composant | Rôle |
|---|---|
| `crates/spacemapper-core` | Énumération DirectInput, modèle et **lecture** de `actionmaps.xml`, catalogue d'actions |
| `apps/spacemapper-lite` | Application de bureau Lite (Tauri + React) |

L'édition **Premium** (réparation automatique, linter avec correction, sauvegardes, studio visuel, presets communautaires, exports) est développée dans un dépôt privé et distribuée sous licence.

## Éditions

|  | Lite (gratuit) | Premium (15 €) |
|---|---|---|
| Détection des périphériques par GUID | ✅ | ✅ |
| Lecture et aperçu des assignations de vol | ✅ | ✅ |
| Réparation de l'ordre des périphériques | — | ✅ |
| Linter XML avec correction automatique | — | ✅ |
| Sauvegardes et injection dans le jeu | — | ✅ |
| Presets communautaires | Aperçu | Application 1 clic |
| Studio visuel, exports, assistant pas-à-pas | — | ✅ |

**Lite ne modifie jamais vos fichiers de jeu et n'effectue aucun appel réseau.** Il lit, il affiche, c'est tout.

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
