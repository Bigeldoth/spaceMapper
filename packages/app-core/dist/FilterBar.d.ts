import type { Filters } from "./lib/filter";
/**
 * Recherche et filtres.
 *
 * Trois interrupteurs, pas de taxonomie. Ils répondent aux seules questions
 * qu'on se pose en configurant : qu'est-ce qui n'est pas encore assigné,
 * qu'est-ce qui se marche dessus, et qu'est-ce que je peux réellement changer.
 */
export default function FilterBar({ filters, onChange, shown, total, conflictCount, unassignedCount, showEditableFilter, }: {
    filters: Filters;
    onChange: (filters: Filters) => void;
    shown: number;
    total: number;
    conflictCount: number;
    unassignedCount: number;
    /**
     * L'interrupteur « Modifiables seulement » n'a de sens que si une partie
     * des commandes est verrouillée — le cas de Lite. Premium ne verrouille
     * jamais rien : montrer un filtre qui ne distingue jamais deux états
     * n'aide personne. `true` par défaut pour ne rien changer à Lite.
     */
    showEditableFilter?: boolean;
}): import("react").JSX.Element;
