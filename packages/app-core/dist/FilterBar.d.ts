import type { Filters } from "./lib/filter";
/**
 * Recherche et filtres.
 *
 * Trois interrupteurs, pas de taxonomie. Ils répondent aux seules questions
 * qu'on se pose en configurant : qu'est-ce qui n'est pas encore assigné,
 * qu'est-ce qui se marche dessus, et qu'est-ce que je peux réellement changer.
 */
export default function FilterBar({ filters, onChange, shown, total, conflictCount, unassignedCount, }: {
    filters: Filters;
    onChange: (filters: Filters) => void;
    shown: number;
    total: number;
    conflictCount: number;
    unassignedCount: number;
}): import("react").JSX.Element;
