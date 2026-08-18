# Développement

## Modèle de branches

| Branche | Rôle |
|---|---|
| `main` | Reçoit le travail quotidien. Les releases de production y sont taguées (`v0.1.0`). |
| `staging` | Pré-release détachée. Synchronisée depuis `main` avant chaque cycle de test. |

Le code source est **identique** entre les deux : ce qui change est la
configuration de build. Une pré-release s'installe donc **à côté** de la
production, avec son propre identifiant, son propre nom et surtout son propre
dossier de données.

```
%APPDATA%\SpaceMapper           ← production
%APPDATA%\SpaceMapper-Staging   ← pré-release
```

Cette isolation n'est pas cosmétique : quand l'édition Premium écrira dans
`actionmaps.xml`, un bug de pré-release ne devra en aucun cas pouvoir abîmer
les vrais profils d'un testeur.

### Préparer un cycle de test

```bash
git checkout staging && git merge --ff-only main && git push
```

### Publier une release

```bash
git checkout main && git tag -a v0.1.0 -m "Première release" && git push --tags
```

---

## Prérequis

- **Rust** stable — `scoop install rustup && rustup default stable`
- **Workload C++ MSVC** — voir ci-dessous, c'est le seul point délicat
- **Node.js 20+**
- Windows 10/11 (DirectInput)

### Installer le workload C++

Rust cible `x86_64-pc-windows-msvc` par défaut et a besoin du linker
`link.exe`. Installer Visual Studio **ne suffit pas** : il faut explicitement
le workload C++, qui n'est pas coché par défaut.

**Via l'interface** (le plus fiable) : ouvrir *Visual Studio Installer* →
*Modifier* sur **Visual Studio Build Tools 2022** → cocher **Développement
Desktop en C++** → *Modifier*. Compter 3 à 5 Go.

**En ligne de commande**, dans un PowerShell **administrateur** :

```powershell
& "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vs_installer.exe" `
  modify `
  --installPath "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\BuildTools" `
  --add Microsoft.VisualStudio.Workload.VCTools `
  --includeRecommended --passive --norestart
```

`--includeRecommended` embarque le Windows SDK, également requis.

**Vérifier** (session normale, après installation) :

```powershell
& "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" `
  -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
```

Une ligne de chemin = c'est bon. Aucune sortie = le workload manque toujours.

> **Piège :** ne lancez pas `cargo` depuis Git Bash. Le `link` de coreutils y
> masque le `link.exe` de MSVC, et l'erreur qui en résulte
> (`link: extra operand`) n'a aucun rapport apparent avec la cause. Utilisez
> PowerShell ou `cmd`.

---

## Commandes

```powershell
cargo test --workspace          # tests Rust
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --all

cd apps/spacemapper-lite
npm install
npm run tauri dev               # lancer l'app
```

### Construire une pré-release

Le canal est injecté à la compilation ; sans variable, on obtient une build de
production.

```powershell
$env:SPACEMAPPER_CHANNEL = "staging"
npm run tauri build -- --config src-tauri/tauri.staging.conf.json
```

### Construire une release de production

```powershell
Remove-Item Env:\SPACEMAPPER_CHANNEL -ErrorAction SilentlyContinue
npm run tauri build
```

> Les deux commandes nécessitent les icônes de `src-tauri/icons/`, qui ne sont
> pas encore créées. `npm run tauri dev` fonctionne sans elles.
