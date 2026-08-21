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
/** Clé stable d'une commande, indépendante de l'ordre du fichier. */
export declare function keyOf(actionmap: string, action: string): string;
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
