import type { DeviceFamily, Filters } from "./lib/filter";
import { isFiltering, NO_FILTERS } from "./lib/filter";
import type { Origin } from "./lib/api";

/**
 * Barre de recherche et de filtres.
 *
 * Les filtres sont des boutons plutôt que des listes déroulantes : ils sont
 * peu nombreux, et leur état doit se lire sans les ouvrir.
 */
export default function FilterBar({
  filters,
  onChange,
  shown,
  total,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
  shown: number;
  total: number;
}) {
  const origins: { id: Origin | "all"; label: string }[] = [
    { id: "all", label: "Tout" },
    { id: "override", label: "Mes réglages" },
    { id: "game_default", label: "Réglages d'origine" },
  ];

  const devices: { id: DeviceFamily | "all"; label: string }[] = [
    { id: "all", label: "Tous" },
    { id: "js", label: "Manche" },
    { id: "kb", label: "Clavier" },
    { id: "gp", label: "Manette" },
    { id: "mo", label: "Souris" },
  ];

  return (
    <div className="space-y-3 rounded-lg border border-ink-200 bg-white p-4">
      <div className="relative">
        <input
          type="search"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="Rechercher une commande, une touche, un bouton…"
          className="w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm placeholder:text-ink-400 focus:border-accent-500 focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Group label="Origine">
          {origins.map((o) => (
            <Chip
              key={o.id}
              active={filters.origin === o.id}
              onClick={() => onChange({ ...filters, origin: o.id })}
            >
              {o.label}
            </Chip>
          ))}
        </Group>

        <Group label="Appareil">
          {devices.map((d) => (
            <Chip
              key={d.id}
              active={filters.device === d.id}
              onClick={() => onChange({ ...filters, device: d.id })}
            >
              {d.label}
            </Chip>
          ))}
        </Group>

        <Chip
          active={filters.editableOnly}
          onClick={() =>
            onChange({ ...filters, editableOnly: !filters.editableOnly })
          }
        >
          Modifiables seulement
        </Chip>
      </div>

      <div className="flex items-center justify-between border-t border-ink-100 pt-2">
        <p className="text-xs text-ink-500">
          {shown === total
            ? `${total} commande${total > 1 ? "s" : ""}`
            : `${shown} sur ${total} commandes`}
        </p>
        {isFiltering(filters) && (
          <button
            onClick={() => onChange(NO_FILTERS)}
            className="text-xs font-medium text-accent-700 hover:text-accent-600"
          >
            Tout afficher
          </button>
        )}
      </div>
    </div>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-ink-500">{label}</span>
      <div className="flex gap-1">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full px-2.5 py-1 text-xs font-medium transition-colors " +
        (active
          ? "bg-accent-600 text-white"
          : "bg-ink-100 text-ink-600 hover:bg-ink-200")
      }
    >
      {children}
    </button>
  );
}
