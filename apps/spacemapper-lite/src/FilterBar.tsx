import { Tag } from "@spacemapper/ui";
import type { Filters } from "./lib/filter";
import { isFiltering, NO_FILTERS } from "./lib/filter";
import { useT } from "./lib/i18nContext";

/**
 * Recherche et filtres.
 *
 * Trois interrupteurs, pas de taxonomie. Ils répondent aux seules questions
 * qu'on se pose en configurant : qu'est-ce qui n'est pas encore assigné,
 * qu'est-ce qui se marche dessus, et qu'est-ce que je peux réellement changer.
 */
export default function FilterBar({
  filters,
  onChange,
  shown,
  total,
  conflictCount,
  unassignedCount,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
  shown: number;
  total: number;
  conflictCount: number;
  unassignedCount: number;
}) {
  const t = useT();

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <input
        type="search"
        value={filters.query}
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
        placeholder={t("filter.placeholder")}
        className="min-w-56 flex-1 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-2)] px-[var(--sp-6)] py-[var(--sp-4)] text-[length:var(--fs-body-sm)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:border-[var(--border-accent)] focus-visible:shadow-[var(--ring-focus)] focus:outline-none"
      />

      <Toggle
        active={filters.unassignedOnly}
        count={unassignedCount}
        onClick={() =>
          onChange({ ...filters, unassignedOnly: !filters.unassignedOnly })
        }
      >
        {t("filter.unassigned")}
      </Toggle>

      <Toggle
        active={filters.conflictsOnly}
        count={conflictCount}
        warn
        onClick={() =>
          onChange({ ...filters, conflictsOnly: !filters.conflictsOnly })
        }
      >
        {t("filter.conflicts")}
      </Toggle>

      <Toggle
        active={filters.editableOnly}
        onClick={() =>
          onChange({ ...filters, editableOnly: !filters.editableOnly })
        }
      >
        {t("filter.editableOnly")}
      </Toggle>

      <span className="ml-auto whitespace-nowrap text-[length:var(--fs-caption)] text-[var(--text-tertiary)]">
        {shown === total ? `${total}` : `${shown} / ${total}`}
      </span>

      {isFiltering(filters) && (
        <button
          onClick={() => onChange(NO_FILTERS)}
          className="whitespace-nowrap text-[length:var(--fs-caption)] font-medium text-[var(--text-accent)] hover:text-[var(--accent-hover)]"
        >
          {t("filter.showAll")}
        </button>
      )}
    </div>
  );
}

/**
 * Interrupteur portant son propre compteur.
 *
 * Le nombre est là avant même qu'on clique : savoir qu'il reste 12 commandes
 * non assignées est une information en soi, et évite d'activer un filtre pour
 * découvrir qu'il ne montre rien.
 */
function Toggle({
  active,
  count,
  warn,
  onClick,
  children,
}: {
  active: boolean;
  count?: number;
  /** Teinte d'alerte : réservée aux conflits, qui sont un défaut. */
  warn?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const empty = count === 0;
  // `Tag` ne connaît que la sélection ; l'alerte conflit est une teinte à part,
  // superposée par-dessus quand elle est à la fois active et pertinente.
  const warnActiveClasses =
    warn && active
      ? "!border-[var(--danger)] !bg-[var(--danger-soft)] !text-[var(--danger-text)]"
      : "";

  return (
    <Tag
      selected={active}
      onClick={onClick}
      disabled={empty && !active}
      className={`${empty && !active ? "opacity-[0.42]" : ""} ${warnActiveClasses}`}
    >
      {children}
      {count !== undefined && (
        <span className="tabular-nums text-[length:var(--fs-caption)] opacity-80">
          {count}
        </span>
      )}
    </Tag>
  );
}
