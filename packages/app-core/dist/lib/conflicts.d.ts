/**
 * Commandes qui occupent le même usage d'un contrôle.
 *
 * La combinaison complète comprend le périphérique, le contrôle, ses
 * modificateurs et le type d'appui. Réutiliser un bouton avec Ctrl, Maj,
 * un double-appui ou un appui prolongé crée un usage distinct.
 */
import type { ConflictReview, Context, EditableBinding } from "./api";
/**
 * Contextes autorisés à produire un conflit dans le diagnostic.
 *
 * Fournie par le backend, où elle est testée, plutôt que réécrite ici. Tant
 * qu'elle n'est pas chargée, on considère que tout se heurte : mieux vaut une
 * fausse alerte visible qu'un conflit tu, qui ne se découvrirait qu'en vol.
 */
export declare class ContextRules {
    private readonly pairs;
    private readonly loaded;
    constructor(pairs: [Context, Context][] | null);
    canCollide(a: Context, b: Context): boolean;
}
/**
 * Clé stable d'une ligne, indépendante de l'ordre du fichier — commande
 * **et** assignation précise.
 *
 * Une action peut porter deux lignes à la fois — une au clavier, une au
 * manche. Les confondre sous la seule paire (actionmap, action) faisait
 * déteindre l'édition ou le signalement de conflit d'une ligne sur l'autre :
 * modifier le manche marquait aussi le clavier comme en attente.
 *
 * On distingue sur `input_raw` plutôt que sur `device` : `device` vaut
 * `null` pour toute surcharge à contrôle blanc (`jsN_ `, la forme que le jeu
 * écrit en masse) ou illisible — précisément les lignes que ce correctif
 * visait à distinguer. `input_raw`, lui, reste unique même dans ce cas
 * (`"js3_ "` diffère de `"mo1_ "`), et c'est aussi la valeur que le
 * back-end utilise pour retrouver le `<rebind>` exact à réécrire — voir
 * `spacemapper_edit::writer::BindingEdit::original_input`.
 */
export declare function keyOf(binding: Pick<EditableBinding, "actionmap" | "action" | "input_raw">): string;
/**
 * Jeton réellement en vigueur, modification en attente comprise.
 *
 * Une modification non enregistrée doit compter : sinon l'utilisateur
 * n'apprendrait qu'il vient de créer un conflit qu'après avoir écrit dans son
 * profil.
 */
export declare function effectiveToken(binding: EditableBinding, pending: Map<string, string | null>): string | null;
/** Une commande est-elle assignée, modification en attente comprise ? */
export declare function isAssigned(binding: EditableBinding, pending: Map<string, string | null>): boolean;
/**
 * Index des jetons partagés par au moins deux commandes.
 *
 * Construit une fois par rendu et passé aux filtres comme au détail : le
 * recalculer par ligne serait quadratique sur 451 assignations.
 * Le regroupement reste physique (`byToken`), puis chaque paire est filtrée
 * par contexte **et** par geste d'activation : court, long et double-appui
 * peuvent partager un contrôle sans se disputer son déclenchement.
 */
export interface ConflictIndex {
    /** Commandes partageant un jeton, sans distinction de situation. */
    readonly byToken: Map<string, EditableBinding[]>;
    readonly rules: ContextRules;
    /** Clés des commandes dont l'usage fait doublon dans un contexte compatible. */
    readonly flagged: Set<string>;
    /** Partages non évalués ou dont le déclencheur n'est pas complètement connu. */
    readonly uncertain: Set<string>;
    readonly reviews: readonly ConflictReview[];
    readonly probableRivals: Map<string, EditableBinding[]>;
    readonly uncertainRivals: Map<string, EditableBinding[]>;
}
/**
 * Deux lignes d'une même action décrivent plusieurs façons de déclencher la
 * même commande ; elles ne sont donc jamais rivales entre elles. Cette règle
 * doit rester identique pour le badge calculé par l'index et le détail rendu
 * par `rivalsOf`, même si les lignes ont des `input_raw` distincts.
 */
/** Casse et ordre des modificateurs sont normalisés, leurs côtés restent distincts. */
export declare function canonicalControlToken(raw: string): string;
export type ConflictLevel = "none" | "probable" | "uncertain";
export type ConflictReason = "different_controls" | "same_action" | "review_false_alarm" | "review_real_conflict" | "different_triggers" | "separate_contexts" | "unknown_trigger" | "preexisting_default" | "same_usage";
export interface ConflictAssessment {
    level: ConflictLevel;
    reason: ConflictReason;
}
/** Même décision pour le compteur, la fiche, la capture et le choix de geste. */
export declare function assessConflictPair(left: EditableBinding, right: EditableBinding, pending: Map<string, string | null>, rules: ContextRules, reviews?: readonly ConflictReview[]): ConflictAssessment;
export declare function classifyConflictPair(left: EditableBinding, right: EditableBinding, pending: Map<string, string | null>, rules: ContextRules, reviews?: readonly ConflictReview[]): ConflictLevel;
export declare function indexConflicts(bindings: EditableBinding[], pending: Map<string, string | null>, rules: ContextRules, reviews?: readonly ConflictReview[]): ConflictIndex;
/** Les autres commandes qui occupent le même usage dans un contexte compatible. */
export declare function rivalsOf(binding: EditableBinding, pending: Map<string, string | null>, conflicts: ConflictIndex): EditableBinding[];
export declare function uncertainRivalsOf(binding: EditableBinding, pending: Map<string, string | null>, conflicts: ConflictIndex): EditableBinding[];
export declare function hasUncertainConflict(binding: EditableBinding, _pending: Map<string, string | null>, conflicts: ConflictIndex): boolean;
export declare function hasConflict(binding: EditableBinding, _pending: Map<string, string | null>, conflicts: ConflictIndex): boolean;
