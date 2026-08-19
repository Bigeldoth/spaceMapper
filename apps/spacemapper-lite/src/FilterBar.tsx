import type { DeviceFamily, Filters } from "./lib/filter";
import { isFiltering, NO_FILTERS } from "./lib/filter";
import type { Origin } from "./lib/api";
import type { Key } from "./lib/i18n";
import { useT } from "./lib/i18nContext";

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
  const t = useT();

  const origins: { id: Origin | "all"; label: Key }[] = [
    { id: "all", label: "filter.origin.all" },
    { id: "override", label: "filter.origin.override" },
    { id: "game_default", label: "filter.origin.default" },
  ];

  const devices: { id: DeviceFamily | "all"; label: Key }[] = [
    { id: "all", label: "filter.device.all" },
    { id: "js", label: "filter.device.joystick" },
    { id: "kb", label: "filter.device.keyboard" },
    { id: "gp", label: "filter.device.gamepad" },
    { id: "mo", label: "filter.device.mouse" },
  ];

  return (
    <div className="space-y-3 rounded-lg border border-ink-200 bg-white p-4">
      <input
        type="search"
        value={filters.query}
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
        placeholder={t("filter.placeholder")}
        className="w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm placeholder:text-ink-400 focus:border-accent-500 focus:outline-none"
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Group label={t("filter.origin")}>
          {origins.map((o) => (
            <Chip
              key={o.id}
              active={filters.origin === o.id}
              onClick={() => onChange({ ...filters, origin: o.id })}
            >
              {t(o.label)}
            </Chip>
          ))}
        </Group>

        <Group label={t("filter.device")}>
          {devices.map((d) => (
            <Chip
              key={d.id}
              active={filters.device === d.id}
              onClick={() => onChange({ ...filters, device: d.id })}
            >
              {t(d.label)}
            </Chip>
          ))}
        </Group>

        <Chip
          active={filters.editableOnly}
          onClick={() =>
            onChange({ ...filters, editableOnly: !filters.editableOnly })
          }
        >
          {t("filter.editableOnly")}
        </Chip>
      </div>

      <div className="flex items-center justify-between border-t border-ink-100 pt-2">
        <p className="text-xs text-ink-500">
          {shown === total ? `${total}` : `${shown} / ${total}`}
        </p>
        {isFiltering(filters) && (
          <button
            onClick={() => onChange(NO_FILTERS)}
            className="text-xs font-medium text-accent-700 hover:text-accent-600"
          >
            {t("filter.showAll")}
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
