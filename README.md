# SpaceMapper

Gestion et optimisation des contrôles pour **Star Citizen**. Détecte vos périphériques par GUID matériel, lit vos assignations et les rend enfin lisibles.

> Édité par [Padek-interactive](https://padek-interactive.tech) — écosystème SpaceDrive.

---

## Ce dépôt

Ce dépôt public contient l'**édition Lite** et les crates partagés :

| Composant | Rôle |
|---|---|
| `crates/spacemapper-core` | Énumération DirectInput, modèle et **lecture** de `actionmaps.xml`, catalogue d'actions |
| `crates/spacemapper-edit` | Écriture des assignations avec périmètre vérifié en Rust ; points de restauration explicites |
| `apps/spacemapper-lite` | Application de bureau Lite (Tauri + React) |

L'édition **Premium** est développée dans un dépôt privé. Elle comprend l'édition complète, l'assistant par activité et le **remapper joystick → clavier/souris (JoyMapper)**. Le moteur du remapper, ses profils et l'import JoyToKey appartiennent exclusivement à Premium.

## Éditions

|  | Lite (gratuit) | Premium (15 €) |
|---|---|---|
| Détection des périphériques par GUID | ✅ | ✅ |
| Lecture et aperçu de toutes les assignations | ✅ | ✅ |
| **Identifier une commande** en actionnant un contrôle | ✅ | ✅ |
| Assignation par appui direct (touche, bouton, axe) | ✅ | ✅ |
| Points de restauration et restauration | ✅ | ✅ |
| **Configurer un vol complet** : décoller, se déplacer, se poser | ✅ | ✅ |
| **Modifier le déplacement à pied** | ✅ | ✅ |
| Conduite, EVA, émotes, portes, HUD | Affichés, verrouillés | ✅ |
| Combat, ciblage, contre-mesures, tourelles, minage | — | ✅ |
| Actions irréversibles (autodestruction, éjection) | Affichées, verrouillées | ✅ |
| Assignation avec modificateur clavier | Dans les catégories autorisées | ✅ |
| Choix explicite du geste : court, double, prolongé | — | ✅ |
| Remapper joystick → clavier/souris (JoyMapper) | — | ✅ |
| Profils nommés du remapper et import JoyToKey | — | ✅ |
| Remapper en arrière-plan et démarrage automatique sur choix explicite | — | ✅ |
| Lecture des profils partagés | ✅ | ✅ |
| Assistant par activité et visualisation des manches | Aperçu verrouillé | ✅ |

La synchronisation entre machines, l'adaptation automatique des presets, la réparation de l'ordre des périphériques, le linter avec correction et l'application de presets communautaires restent des fonctionnalités prévues pour Premium.

### Répondre à « ce bouton, il sert à quoi ? »

Actionnez n'importe quel bouton, axe, chapeau ou touche : SpaceMapper reconnaît le périphérique concerné et **met en surbrillance les commandes qui l'utilisent**. Il vous dit aussi quand aucune commande ne l'utilise — ce qui, face à une configuration héritée d'un profil communautaire, est souvent la réponse qu'on cherchait.

Pour assigner, même geste : vous appuyez, SpaceMapper écrit. Tous vos manches sont écoutés simultanément, donc vous n'avez pas à désigner le bon au préalable — indispensable en HOSAS, où deux exemplaires du même modèle sont indiscernables dans une liste.

La lecture des contrôles passe par **DirectInput, la même interface que Star Citizen**. L'éditeur écrit les assignations du jeu dans `actionmaps.xml`. Le remapper Premium est une fonction distincte : il reste actif en arrière-plan pour convertir les contrôles du joystick en événements clavier ou souris Windows.

### Ce que Lite garantit

**Lite fonctionne hors ligne**, sans compte, télémétrie ni mise à jour silencieuse. L'application ne configure aucun service réseau. Les liens externes sont ouverts dans le navigateur du système sur clic explicite.

**Lite couvre le vol, en entier.** Allumer le vaisseau, piloter, orienter la vue, sauter en quantique, sortir le train, se poser — et rejoindre son vaisseau à pied. Le combat, les contre-mesures, les tourelles et les spécialisations relèvent du Premium.

Le périmètre est appliqué dans la couche d'écriture en Rust : une catégorie hors périmètre est refusée quoi qu'affiche l'écran. Les actions irréversibles — autodestruction, éjection — restent verrouillées même dans une catégorie autorisée. Lite peut réassigner un contrôle avec modificateur dans son périmètre ; le choix explicite d'un geste d'activation est réservé à Premium.

> ℹ️ **Ce que SpaceMapper voit.** `actionmaps.xml` est un fichier de **surcharges** : il ne contient que ce que vous avez modifié. SpaceMapper complète ces surcharges avec les valeurs par défaut de `Data.p4k` lorsque l'archive est accessible ; une erreur de lecture est signalée dans l'éditeur.

**Rien n'est écrit sans votre accord.** Vos modifications s'accumulent à l'écran ; un bandeau vous rappelle qu'elles ne sont pas enregistrées. Au moment d'enregistrer, vous pouvez relire la liste de ce qui va changer et choisir de créer un point de restauration au préalable.

**Vos sauvegardes vous appartiennent.** Les points de restauration sont du XML en clair dans `%APPDATA%\SpaceMapper\Backups`, hors du dossier du jeu. Ils restent lisibles et réutilisables même si vous désinstallez SpaceMapper. Nous ne chiffrons pas vos données pour vous forcer à rester.

> ⚠️ Fermez Star Citizen avant de modifier vos contrôles : le jeu réécrit `actionmaps.xml` en quittant et écraserait vos changements.

## Fonctionnement local

SpaceMapper fonctionne **hors-processus** : il ne lit ni n'écrit dans la mémoire de `StarCitizen.exe` et n'y injecte aucun code. Lite lit les périphériques et édite les fichiers de configuration. Le remapper Premium ajoute l'émission d'événements clavier/souris via Windows, sans injection de code dans le jeu.

## Prérequis de développement

- [Rust](https://rustup.rs/) (stable) + Build Tools MSVC
- Node.js 22.18+
- Windows 10/11 (DirectInput)

```bash
npm install
npm run build -w packages/ui
npm run build -w packages/app-core
node tools/check-lite-boundary.mjs
npm run tauri -w apps/spacemapper-lite -- dev
```

Pour un exécutable local autonome, construire ensuite l'interface Lite avec
`npm run build -w apps/spacemapper-lite`, puis lancer
`cargo build -p spacemapper-lite --release`. L'interface est embarquée dans le
binaire. Pour les tests Rust sans frontend construit, utiliser
`cargo test --workspace --no-default-features`.

Le travail se fait sur des branches de chantier fusionnées dans `staging` (la
pré-production), jamais directement sur `main`. Le cheminement complet, du
commit à l'installateur chez le client, est décrit dans
[RELEASING.md](RELEASING.md).

## Licence

Source disponible, **pas open source** — voir [LICENSE](LICENSE). Le code est
publié pour que chacun puisse vérifier ce que l'application fait ; la
redistribution et l'usage commercial par des tiers ne sont pas autorisés.

## État du projet

Lite et les packages partagés sont construits et vérifiés par la CI. La garde
`tools/check-lite-boundary.mjs` contrôle que les sources et packages distribués
avec Lite ne contiennent ni le remapper Premium ni son chemin d'émission Windows,
et que les écritures passent toujours par le périmètre Lite. Elle s'exécute sur
les sources, puis sur le bundle JavaScript construit avant l'installateur.

---

*« Star Citizen » et « Roberts Space Industries » sont des marques de Cloud
Imperium Rights LLC. SpaceMapper est un outil indépendant, sans affiliation.*
