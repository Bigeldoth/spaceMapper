/**
 * Filtrage et recherche des assignations.
 *
 * La fusion avec les valeurs par défaut du jeu fait passer la liste de
 * quelques dizaines d'entrées à plusieurs centaines. Sans moyen de la
 * restreindre, les réglages propres au joueur — précisément ce qu'il vient
 * consulter — s'y perdent.
 *
 * Les filtres sont **orientés tâche** et non taxonomiques : on ne demande pas
 * « montre-moi le clavier » mais « montre-moi ce qui reste à faire ». Deux
 * questions reviennent quand on configure : qu'est-ce qui n'est pas encore
 * assigné, et qu'est-ce qui se marche dessus.
 */
import type { EditableBinding } from "./api";
import { type ConflictIndex } from "./conflicts";
/**
 * Manière de piloter, et non famille de périphérique.
 *
 * On ne trie pas par appareil mais par **installation** : personne ne
 * configure une souris seule, elle accompagne toujours un clavier.
 */
export type SetupMode = "desk" | "gamepad" | "joystick";
export interface Filters {
    /** Texte libre : libellé, nom interne ou jeton d'assignation. */
    query: string;
    /** Sans touche assignée — ce qu'il reste à configurer. */
    unassignedOnly: boolean;
    /** Partagent un contrôle avec une autre commande. */
    conflictsOnly: boolean;
    /** Ne montrer que ce que cet éditeur peut modifier. */
    editableOnly: boolean;
}
export declare const NO_FILTERS: Filters;
export declare function isFiltering(filters: Filters): boolean;
/**
 * Mode auquel se rattache une assignation, ou `null` si le jeton est illisible.
 *
 * `kb` et `mo` retombent tous deux sur `desk` : c'est ce regroupement qui fait
 * tout l'intérêt du tri par mode.
 */
export declare function modeOf(binding: EditableBinding): SetupMode | null;
export declare function apply(bindings: EditableBinding[], filters: Filters, mode: SetupMode | "all", pending: Map<string, string | null>, conflicts: ConflictIndex): EditableBinding[];
