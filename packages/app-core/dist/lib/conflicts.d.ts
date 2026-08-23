/**
 * Commandes qui se disputent le même contrôle.
 *
 * Star Citizen n'interdit pas d'assigner deux commandes au même bouton, et ne
 * le signale nulle part : le joueur découvre en vol que sa postcombustion
 * déclenche aussi autre chose. C'est l'un des rares défauts de configuration
 * qu'on peut détecter sans le jeu, et il mérite mieux qu'un compteur.
 */
import type { Context, EditableBinding } from "./api";
/**
 * Relation « ces deux situations peuvent coexister ».
 *
 * Fournie par le backend, où elle est testée, plutôt que réécrite ici. Tant
 * qu'elle n'est pas chargée, on considère que tout se heurte : mieux vaut une
 * fausse alerte visible qu'un conflit tu, qui ne se découvrirait qu'en vol.
 */
export declare class ContextRules {
    private readonly pairs;
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
 */
export interface ConflictIndex {
    /** Commandes partageant un jeton, sans distinction de situation. */
    readonly byToken: Map<string, EditableBinding[]>;
    readonly rules: ContextRules;
    /** Clés des commandes réellement en conflit, situation comprise. */
    readonly flagged: Set<string>;
}
export declare function indexConflicts(bindings: EditableBinding[], pending: Map<string, string | null>, rules: ContextRules): ConflictIndex;
/** Les *autres* commandes qui occupent le même contrôle au même moment. */
export declare function rivalsOf(binding: EditableBinding, pending: Map<string, string | null>, conflicts: ConflictIndex): EditableBinding[];
export declare function hasConflict(binding: EditableBinding, _pending: Map<string, string | null>, conflicts: ConflictIndex): boolean;
