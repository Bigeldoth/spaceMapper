/**
 * Traduction de la manière dont le jeu déclenche une assignation.
 *
 * `activationMode`/`multiTap` existent aussi bien côté surcharges (l'attribut
 * brut du joueur) que côté valeurs par défaut du jeu (voir `defaults.rs`) :
 * une esquive jamais surchargée est un double-appui *par défaut*, et rien
 * dans `actionmaps.xml` ne le dit. Les valeurs listées ici ont été relevées
 * sur le profil par défaut réel du jeu (`defaultProfile.xml` extrait de
 * `Data.p4k`, août 2026) — `press` et `tap` dominent largement (plus de 500
 * occurrences à eux deux). `press` réagit immédiatement ; `tap` attend un
 * relâchement bref. Le badge rend visible cette différence lors du mapping.
 */
import type { Translate } from "./i18nContext";
export type ActivationKind = "tap" | "hold" | "other";
export interface ActivationBadge {
    label: string;
    kind: ActivationKind;
}
/**
 * Geste physique attendu par Star Citizen pour déclencher une assignation.
 *
 * Les variantes d'un même geste (`hold_toggle`, `hold_no_retrigger`, etc.)
 * changent ce que fait le jeu après le déclenchement, pas ce que le joueur
 * doit faire avec le contrôle. Elles partagent donc la même famille pour la
 * détection des conflits.
 *
 * Cette famille sert à l'affichage et aux anciens appelants sans attributs
 * résolus. Le diagnostic utilise `triggerSignatureOf` : un déclencheur inconnu
 * apparaît dans « À vérifier », sans être traité comme un conflit probable.
 */
export type ActivationGesture = "immediate" | "short_press" | "long_press" | `multi_tap:${number}` | "unknown";
export interface ActivationSource {
    activation_mode: string | null | undefined;
    multi_tap: string | null | undefined;
    trigger_attributes?: Record<string, string>;
    input_raw?: string;
    device?: string | null;
    control?: string | null;
}
/** Même contrat que les signatures du carnet : événements, seuils et délais. */
export type TriggerSignature = {
    kind: "continuous_axis";
} | {
    kind: "button";
    onpress: boolean;
    onhold: boolean;
    onrelease: boolean;
    multitap: number;
    presstriggerthreshold: number;
    releasetriggerthreshold: number;
    holdtriggerdelay: number;
    releasetriggerdelay: number;
};
/**
 * Aucun mode implicite n'est inventé : sans événements résolus, le bouton
 * reste inconnu. Les modes nommés sont développés par le backend à partir
 * des définitions de la version installée du jeu.
 */
export declare function triggerSignatureOf(source: ActivationSource, effectiveInput?: string | null): TriggerSignature | null;
/** Stable malgré l'ordre des propriétés JSON ; refuse les observations mal formées. */
export declare function triggerSignatureKey(value: unknown): string | null;
/**
 * Normalise les deux représentations du jeu (`activationMode` et `multiTap`)
 * en geste comparable. Un `multiTap` explicite prime, comme pour le badge.
 */
export declare function activationGestureOf(source: ActivationSource): ActivationGesture;
/**
 * Deux assignations occupent-elles le même usage configuré du contrôle ?
 *
 * Un appui simple, un appui prolongé et un multi-appui sont des usages
 * distincts. `press` et `tap` occupent tous deux l'usage simple : le moment
 * du déclenchement ne crée pas une combinaison supplémentaire.
 * Lorsque les attributs résolus sont fournis, les événements et délais exacts
 * priment sur cette famille historique. Sans eux, ce helper conserve sa
 * comparaison de familles ; l'index de diagnostic utilise toujours les
 * signatures résolues et distingue les résultats inconnus.
 */
export declare function activationGesturesOverlap(left: ActivationSource, right: ActivationSource): boolean;
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
