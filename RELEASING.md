# Flux de livraison

Trois niveaux, du plus mouvant au plus figé. Rien n'atteint un client sans être
passé par une version candidate.

```
feature/xxx  ──PR──>  staging  ──PR──>  main
                         │                │
                         │                └─ tag lite-v0.2.0    -> release stable
                         │                                          (brouillon,
                         │                                           publiée à la main)
                         └─ tag lite-v0.2.0-rc1 -> pre-release publiée
                                                   (boucle de test)
```

## Les branches

| Branche | Rôle | Qui écrit dessus |
|---|---|---|
| `feature/…`, `fix/…` | Un chantier à la fois. | Toi, librement. |
| `staging` | **Pré-production.** Ce qui est prêt à être testé, pas encore livré. | Uniquement par PR, CI verte. |
| `main` | **Production.** Reflète ce que les clients ont, ou vont avoir. | Uniquement par PR depuis `staging`. Poussée directe refusée. |

## Une boucle de test

1. `git switch staging && git pull`, puis `git switch -c feature/mon-chantier`.
2. Travailler, committer, pousser. Ouvrir une PR vers `staging`.
3. La CI (Rust Windows + Frontend) doit passer. Fusionner.
4. Quand `staging` mérite d'être essayée : monter la même version dans
   `Cargo.toml` (`[workspace.package]`),
   `apps/spacemapper-lite/src-tauri/tauri.conf.json` et
   `apps/spacemapper-lite/package.json`. Régénérer ensuite les lockfiles avec
   `cargo check --workspace` et `npm install --package-lock-only`, puis
   committer et pousser cette branche de version par une PR vers `staging`.
   Une fois la PR fusionnée :

   ```bash
   git tag lite-v0.2.0-rc1 && git push origin lite-v0.2.0-rc1
   ```

   L'Action construit l'installateur avec l'identité **Staging** : nom et
   identifiant Windows distincts, bandeau de pré-release, réglages et
   sauvegardes sous `%APPDATA%\SpaceMapper-Staging`. Elle **publie** ensuite
   une pre-release, visible dans l'onglet Releases et téléchargeable par les
   testeurs, mais jamais marquée « Latest ».
5. Retours des testeurs -> correctifs sur `staging` -> `lite-v0.2.0-rc2`, etc.
   Autant de tours que nécessaire.

## Mise en production

1. PR `staging` -> `main`, CI verte, fusionner.
2. `git switch main && git pull`, puis :

   ```bash
   git tag lite-v0.2.0 && git push origin lite-v0.2.0
   ```

3. L'Action construit l'installateur et crée la release **en brouillon**. Rien
   n'est visible côté client à ce stade.
4. Relire les notes de version sur GitHub, puis « Publish release ». C'est ce
   geste-là, et lui seul, qui rend la version visible aux clients.
5. Supprimer les pre-releases `-rc` devenues obsolètes, pour ne pas laisser
   traîner d'installateurs de test.

## Garde-fous automatiques

Le workflow refuse de construire, avant même de compiler, si :

- un tag stable (`lite-v0.2.0`) est posé sur un commit absent de `main` ;
- un tag de candidate (`lite-v0.2.0-rc1`) est posé sur un commit absent de
  `staging` ;
- le numéro annoncé par le tag ne correspond pas aux versions de `Cargo.toml`,
  `package.json` et `tauri.conf.json` ;
- une PR vers `main` ne provient pas de `staging` : le statut CI obligatoire
  `Rust (Windows)` échoue avant même de récupérer le code.

La protection GitHub de `staging` impose par ailleurs une PR, une branche à
jour et les statuts `Rust (Windows)` et `Frontend` au vert.

Un `workflow_dispatch` manuel reste possible sans contrôle de provenance. Il
construit lui aussi une application isolée **Staging**, mais ne crée ni tag ni
Release : l'installateur est conservé sept jours dans les artifacts de
l'exécution.

## Note sur la visibilité

`Bigeldoth/spaceMapper` est public. Une pre-release est **visible de tous**,
simplement signalée comme non stable. Un artifact de `workflow_dispatch` est
moins exposé puisqu'il n'apparaît pas dans Releases et expire après sept jours,
mais les lecteurs du dépôt public peuvent encore le télécharger. Une candidate
strictement confidentielle doit être construite et stockée dans un espace
privé ; le dépôt public ne peut pas fournir cette garantie.
