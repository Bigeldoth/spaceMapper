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
4. Quand `staging` mérite d'être essayée : monter la version dans
   `apps/spacemapper-lite/src-tauri/tauri.conf.json` et
   `apps/spacemapper-lite/package.json`, committer, puis :

   ```bash
   git tag lite-v0.2.0-rc1 && git push origin lite-v0.2.0-rc1
   ```

   L'Action construit l'installateur et **publie** une pre-release. Elle est
   visible dans l'onglet Releases du dépôt public et téléchargeable par les
   testeurs, mais n'apparaît jamais comme « Latest » : personne ne l'installe
   par accident en cherchant la dernière version.
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
- le numéro annoncé par le tag ne correspond pas à la `version` de
  `tauri.conf.json` — sinon un installateur estampillé 0.1.0 circulerait sous
  le nom 0.2.0, ce qui est indétectable une fois le fichier chez un testeur.

Un `workflow_dispatch` manuel reste possible : il produit une pre-release
`lite-v<numéro de run>-dev`, sans contrôle de provenance.

## Note sur la visibilité

`Bigeldoth/spaceMapper` est public. Une pre-release y est **visible de tous**,
simplement signalée comme non stable. Si une version candidate doit rester
strictement confidentielle, ne la tague pas : lance le workflow en
`workflow_dispatch` et récupère l'installateur depuis l'exécution de l'Action.
