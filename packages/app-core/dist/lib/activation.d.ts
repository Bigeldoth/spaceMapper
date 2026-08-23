/**
 * Traduction de la manière dont le jeu déclenche une assignation.
 *
 * `activationMode`/`multiTap` existent aussi bien côté surcharges (l'attribut
 * brut du joueur) que côté valeurs par défaut du jeu (voir `defaults.rs`) :
 * une esquive jamais surchargée est un double-appui *par défaut*, et rien
 * dans `actionmaps.xml` ne le dit. Les valeurs listées ici ont été relevées
 * sur le profil par défaut réel du jeu (`defaultProfile.xml` extrait de
 * `Data.p4k`, août 2026) — `press` et `tap` dominent largement (plus de 500
 * occurrences à eux deux) et correspondent à « une pression suffit », le
 * fonctionnement qu'un joueur attend sans qu'on le lui dise. Tout le reste
 * mérite un badge : c'est précisément ce qui surprend en jeu si on ne le
 * découvre qu'en ratant une esquive.
 */
import type { Translate } from "./i18nContext";
export type ActivationKind = "tap" | "hold" | "other";
export interface ActivationBadge {
    label: string;
    kind: ActivationKind;
}
/**
 * Badge à afficher pour une assignation, ou `null` si rien ne mérite de
 * l'être — `press` (l'absence de l'attribut y compris) est la manière
 * normale d'actionner une touche, la signaler partout noierait les cas qui
 * comptent vraiment.
 *
 * Un `multiTap` numérique prime sur `activationMode` quand les deux
 * coexistent : c'est un compte de frappes précis, plus parlant que le mode
 * qui l'accompagne parfois côté surcharges utilisateur.
 */
export declare function activationBadge(activationMode: string | null, multiTap: string | null, t: Translate): ActivationBadge | null;
