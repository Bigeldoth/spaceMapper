import { useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  type DeviceView,
  type EditableBinding,
  type LockReason,
  type PendingEdit,
} from "@spacemapper/app-core";
import { bindingLabel, categoryLabel } from "@spacemapper/app-core";
import {
  controlLabel,
  controlsFor,
  devicePrefix,
  groupLabel,
  type ControlGroup,
  type ControlOption,
} from "@spacemapper/app-core";
import {
  build,
  captureErrorMessage,
  describe,
  fromKeyPress,
  fromMouse,
  fromWheel,
  modifierOf,
  type CaptureError,
  type CaptureResult,
} from "@spacemapper/app-core";
import {
  EditorToolbar,
  FilterBar,
  filters as filter,
  type SetupMode,
} from "@spacemapper/app-core";
import {
  ContextRules,
  hasConflict,
  indexConflicts,
  isAssigned,
  keyOf,
  rivalsOf,
  type ConflictIndex,
} from "@spacemapper/app-core";
import { capturedToken, useCapture, type CaptureFeed } from "@spacemapper/app-core";
import { useT } from "@spacemapper/app-core";

/**
 * Identité d'une **ligne**, jeton compris.
 *
 * Distincte de [`keyOf`], qui identifie une commande : une action peut porter
 * plusieurs assignations — une au clavier et une au manche. Les confondre
 * donnait deux lignes de même clé React, que React rendait à l'identique.
 */
function rowKey(binding: EditableBinding): string {
  return `${keyOf(binding.actionmap, binding.action)}/${binding.input_raw}`;
}

export default function BindingEditor({
  profilePath,
  devices,
}: {
  profilePath: string;
  devices: DeviceView[];
}) {
  const t = useT();
  const [bindings, setBindings] = useState<EditableBinding[]>([]);
  const [editing, setEditing] = useState<EditableBinding | null>(null);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upsell, setUpsell] = useState<LockReason | null>(null);
  /** Les valeurs par défaut du jeu n'ont pas pu être lues. */
  const [defaultsError, setDefaultsError] = useState<string | null>(null);
  /** Règles de coexistence des situations, fournies par le backend. */
  const [rules, setRules] = useState<ContextRules>(() => new ContextRules(null));
  const [filters, setFilters] = useState<filter.Filters>(filter.NO_FILTERS);
  /** Contexte de configuration, et non filtre : « qu'est-ce que je règle ». */
  const [mode, setMode] = useState<SetupMode | "all">("all");
  /** Ligne dont le détail est affiché, par [`rowKey`]. */
  const [selected, setSelected] = useState<string | null>(null);

  /**
   * Modifications non enregistrées, par clé d'assignation. `null` signifie
   * « effacer ». Rien n'est écrit sur disque tant que l'utilisateur n'a pas
   * validé : c'est ce qui rend le bandeau du bas nécessaire.
   */
  const [pending, setPending] = useState<Map<string, string | null>>(new Map());

  // Session de capture unique, partagée par la mise en évidence et le
  // sélecteur. Elle reste ouverte tant que l'onglet d'édition est affiché.
  const capture = useCapture(devices, true);
  const activeToken = capturedToken(capture.last, devices, (d) =>
    devicePrefix(devices, d),
  );

  async function reload() {
    try {
      const merged = await api.listEditableBindings(profilePath);
      setBindings(merged.bindings);
      setDefaultsError(merged.defaults_error);
      setRules(new ContextRules(merged.colliding_contexts));
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilePath]);

  function stage(binding: EditableBinding, input: string | null) {
    setPending((previous) => {
      const next = new Map(previous);
      next.set(keyOf(binding.actionmap, binding.action), input);
      return next;
    });
    setEditing(null);
    setStatus(null);
  }

  function discardOne(key: string) {
    setPending((previous) => {
      const next = new Map(previous);
      next.delete(key);
      return next;
    });
  }

  async function save(createRestorePoint: boolean) {
    setSaving(true);
    setReviewing(false);
    try {
      const edits: PendingEdit[] = [...pending].map(([key, input]) => {
        const separator = key.indexOf("/");
        return {
          actionmap: key.slice(0, separator),
          action: key.slice(separator + 1),
          input,
        };
      });

      const backup = await api.saveBindings(profilePath, edits, createRestorePoint);
      setPending(new Map());
      setStatus(
        backup
          ? `${edits.length} modification${edits.length > 1 ? "s" : ""} enregistrée${edits.length > 1 ? "s" : ""}, point de restauration créé.`
          : `${edits.length} modification${edits.length > 1 ? "s" : ""} enregistrée${edits.length > 1 ? "s" : ""}.`,
      );
      setError(null);
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const conflicts = useMemo(
    () => indexConflicts(bindings, pending, rules),
    [bindings, pending, rules],
  );

  // Les modifications en attente restent visibles quoi qu'affichent les
  // filtres : les masquer laisserait le bandeau du bas annoncer des
  // changements introuvables à l'écran.
  const visible = useMemo(() => {
    const kept = filter.apply(bindings, filters, mode, pending, conflicts);
    const shown = new Set(kept.map((b) => rowKey(b)));
    const staged = bindings.filter(
      (b) => pending.has(keyOf(b.actionmap, b.action)) && !shown.has(rowKey(b)),
    );
    return [...kept, ...staged];
  }, [bindings, filters, mode, pending, conflicts]);

  const grouped = useMemo(() => {
    const map = new Map<string, EditableBinding[]>();
    for (const b of visible) {
      const list = map.get(b.actionmap);
      if (list) list.push(b);
      else map.set(b.actionmap, [b]);
    }
    return [...map.entries()];
  }, [visible]);

  /**
   * Libellés portés par plusieurs commandes différentes.
   *
   * Le jeu définit parfois deux commandes distinctes sous le même nom et sur
   * la même touche — `player/mobiglas` et `spaceship_hud/mobiglas` sont tous
   * deux « mobiGlas (ON/OFF) » sur F1. On affiche alors la catégorie, seul
   * élément qui les sépare.
   */
  const ambiguous = useMemo(() => {
    const seen = new Map<string, number>();
    for (const b of visible) {
      const label = bindingLabel(b);
      seen.set(label, (seen.get(label) ?? 0) + 1);
    }
    return new Set(
      [...seen.entries()].filter(([, n]) => n > 1).map(([label]) => label),
    );
  }, [visible]);

  // Compteurs affichés sur les interrupteurs eux-mêmes : savoir qu'il reste
  // douze commandes à assigner est une information avant d'être un filtre.
  const unassignedCount = useMemo(
    () => bindings.filter((b) => !isAssigned(b, pending)).length,
    [bindings, pending],
  );
  const conflictCount = useMemo(
    () => bindings.filter((b) => hasConflict(b, pending, conflicts)).length,
    [bindings, pending, conflicts],
  );

  const selectedBinding =
    visible.find((b) => rowKey(b) === selected) ??
    bindings.find((b) => rowKey(b) === selected) ??
    null;

  // Ce que la sonde a relevé, mis en mots pour la barre d'outils.
  const probedDevice = capture.last
    ? devices.find((d) => d.instance_guid === capture.last!.guid)
    : undefined;
  const probe =
    activeToken && capture.last && probedDevice
      ? {
          device: devicePrefix(devices, probedDevice),
          control: controlLabel(capture.last.control, t),
          matches: bindings.filter((b) => b.input_raw === activeToken).length,
        }
      : null;

  return (
    <div className="flex flex-col gap-3 pb-4">
      <EditorToolbar
        profilePath={profilePath}
        mode={mode}
        onModeChange={setMode}
        listening={capture.listening}
        deviceCount={devices.length}
        captureError={capture.error}
        probe={probe}
        onClearProbe={capture.reset}
        onRestored={() => void reload()}
      />

      {defaultsError && (
        <Notice tone="warn" title={t("defaults.unavailable")}>
          {t("defaults.unavailableHint")}
        </Notice>
      )}
      {status && <Notice tone="accent">{status}</Notice>}
      {error && <Notice tone="warn">{error}</Notice>}

      <FilterBar
        filters={filters}
        onChange={setFilters}
        shown={visible.length}
        total={bindings.length}
        conflictCount={conflictCount}
        unassignedCount={unassignedCount}
      />

      {/* Deux volets : on navigue dans les catégories plutôt que de dérouler
          451 lignes. Le détail est collant, il reste sous les yeux pendant
          qu'on parcourt la liste. */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <CategoryTree
          groups={grouped}
          selected={selected}
          onSelect={setSelected}
          pending={pending}
          conflicts={conflicts}
          activeToken={activeToken}
          ambiguous={ambiguous}
          empty={visible.length === 0 && bindings.length > 0}
          filtering={filter.isFiltering(filters)}
        />

        <DetailPane
          binding={selectedBinding}
          pending={pending}
          conflicts={conflicts}
          ambiguous={ambiguous}
          onEdit={(b) => setEditing(b)}
          onClear={(b) => stage(b, null)}
          onRevert={(key) => discardOne(key)}
          onLockedClick={(reason) => setUpsell(reason)}
          onSelect={setSelected}
        />
      </div>

      {editing && (
        <ControlPicker
          binding={editing}
          devices={devices}
          capture={capture}
          onCancel={() => setEditing(null)}
          onPick={(input) => stage(editing, input)}
        />
      )}

      {reviewing && (
        <SaveDialog
          pending={pending}
          bindings={bindings}
          onCancel={() => setReviewing(false)}
          onConfirm={(withBackup) => void save(withBackup)}
          onDiscardOne={discardOne}
        />
      )}

      {upsell && <UpsellDialog reason={upsell} onClose={() => setUpsell(null)} />}

      {pending.size > 0 && (
        <UnsavedBar
          count={pending.size}
          saving={saving}
          onReview={() => setReviewing(true)}
          onDiscardAll={() => setPending(new Map())}
        />
      )}
    </div>
  );
}

/**
 * Bandeau des modifications non enregistrées.
 *
 * `sticky bottom-0` plutôt que `fixed` : il reste dans le flux de la zone
 * défilante, donc il suit le scroll sans recouvrir la dernière ligne de la
 * liste ni déborder sur les autres onglets.
 */
function UnsavedBar({
  count,
  saving,
  onReview,
  onDiscardAll,
}: {
  count: number;
  saving: boolean;
  onReview: () => void;
  onDiscardAll: () => void;
}) {
  const t = useT();
  return (
    <div className="sticky bottom-0 z-[5] -mx-2 mt-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-4 py-3 shadow-[var(--shadow-2)]">
        <p className="text-sm font-medium text-[var(--danger-text)]">
          {count} {t(count > 1 ? "save.unsavedPlural" : "save.unsaved")}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onDiscardAll}
            disabled={saving}
            className="rounded-[var(--radius-control)] px-2.5 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--danger-text)] disabled:text-[var(--text-disabled)]"
          >
            {t("save.discardAll")}
          </button>
          <button
            onClick={onReview}
            disabled={saving}
            className="rounded-[var(--radius-control)] bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:bg-[var(--border-default)]"
          >
            {t(saving ? "save.saving" : "save.open")}
          </button>
        </div>
      </div>
    </div>
  );
}

function SaveDialog({
  pending,
  bindings,
  onCancel,
  onConfirm,
  onDiscardOne,
}: {
  pending: Map<string, string | null>;
  bindings: EditableBinding[];
  onCancel: () => void;
  onConfirm: (createRestorePoint: boolean) => void;
  onDiscardOne: (key: string) => void;
}) {
  const t = useT();
  const [withBackup, setWithBackup] = useState(true);
  const [showDetail, setShowDetail] = useState(false);

  const rows = [...pending].map(([key, input]) => {
    const binding = bindings.find(
      (b) => keyOf(b.actionmap, b.action) === key,
    );
    return { key, input, binding };
  });

  return (
    <Modal onCancel={onCancel} title={t("save.title")}>
      <p className="text-sm text-[var(--text-secondary)]">
        {rows.length}{" "}
        {t(rows.length > 1 ? "save.unsavedPlural" : "save.unsaved")}
      </p>

      <button
        onClick={() => setShowDetail((v) => !v)}
        className="mt-2 text-sm font-medium text-[var(--text-accent)] hover:text-[var(--accent-hover)]"
      >
        {t(showDetail ? "save.hideReview" : "save.review")}
      </button>

      {showDetail && (
        <ul className="mt-3 max-h-60 divide-y divide-[var(--border-subtle)] overflow-y-auto rounded-[var(--radius-control)] border border-[var(--border-subtle)]">
          {rows.map(({ key, input, binding }) => (
            <li
              key={key}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-[var(--text-primary)]">
                  {binding ? bindingLabel(binding) : key}
                </p>
                <p className="technical mt-0.5 truncate text-[var(--text-disabled)]">
                  {binding?.control
                    ? `${binding.device}_${binding.control}`
                    : t("binding.unassigned")}
                  {" → "}
                  <span className="text-[var(--text-accent)]">
                    {input ?? t("binding.clear")}
                  </span>
                </p>
              </div>
              <button
                onClick={() => onDiscardOne(key)}
                className="shrink-0 rounded px-2 py-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--danger-text)]"
              >
                {t("save.remove")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="mt-4 flex items-start gap-2">
        <input
          type="checkbox"
          checked={withBackup}
          onChange={(e) => setWithBackup(e.target.checked)}
          className="mt-0.5"
        />
        <span className="text-sm text-[var(--text-primary)]">
          {t("save.restorePoint")}
          <span className="mt-0.5 block text-xs text-[var(--text-tertiary)]">
            {t("save.restorePointHint")}
          </span>
        </span>
      </label>

      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
        >
          {t("save.cancel")}
        </button>
        <button
          onClick={() => onConfirm(withBackup)}
          className="rounded-[var(--radius-control)] bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
        >
          {t("save.confirm")}
        </button>
      </div>
    </Modal>
  );
}

/** Message court, aux deux seules tonalités dont l'éditeur a besoin. */
function Notice({
  tone,
  title,
  children,
}: {
  tone: "accent" | "warn";
  title?: string;
  children: React.ReactNode;
}) {
  const skin =
    tone === "warn"
      ? "border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[var(--danger-text)]"
      : "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--text-accent)]";
  return (
    <div className={`rounded-[var(--radius-control)] border px-3 py-2 text-sm ${skin}`}>
      {title && <p className="font-medium">{title}</p>}
      <p className={title ? "mt-0.5 text-[var(--text-secondary)]" : ""}>{children}</p>
    </div>
  );
}

/**
 * Colonne de gauche : catégories repliables, commandes à l'intérieur.
 *
 * Repliées par défaut. Dérouler 451 lignes d'un coup ne sert personne — on
 * cherche une commande précise, ou on parcourt une catégorie. Dès qu'un filtre
 * est actif, en revanche, tout s'ouvre : masquer les résultats d'une recherche
 * derrière un chevron serait absurde.
 */
function CategoryTree({
  groups,
  selected,
  onSelect,
  pending,
  conflicts,
  activeToken,
  ambiguous,
  empty,
  filtering,
}: {
  groups: [string, EditableBinding[]][];
  selected: string | null;
  onSelect: (key: string) => void;
  pending: Map<string, string | null>;
  conflicts: ConflictIndex;
  activeToken: string | null;
  ambiguous: Set<string>;
  empty: boolean;
  filtering: boolean;
}) {
  const t = useT();
  const [openMap, setOpenMap] = useState<Set<string>>(new Set());

  if (empty) {
    return (
      <p className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-10 text-center text-sm text-[var(--text-tertiary)]">
        {t("filter.noMatch")}
      </p>
    );
  }

  return (
    // La liste défile en interne pour que le volet de détail reste visible.
    // Plus courte en fenêtre étroite, où les deux volets s'empilent : sans
    // cela il faudrait franchir un écran entier de liste pour lire le détail.
    <div className="max-h-[45vh] divide-y divide-[var(--border-subtle)] overflow-y-auto rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] lg:max-h-[62vh]">
      {groups.map(([actionmap, items]) => {
        const open = filtering || openMap.has(actionmap);
        const teaser = items[0]!.access === "premium_teaser";
        const flagged = items.filter((b) =>
          hasConflict(b, pending, conflicts),
        ).length;

        return (
          <div key={actionmap}>
            <button
              onClick={() =>
                setOpenMap((previous) => {
                  const next = new Set(previous);
                  if (next.has(actionmap)) next.delete(actionmap);
                  else next.add(actionmap);
                  return next;
                })
              }
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--surface-hover)]"
            >
              <span className="w-3 text-xs text-[var(--text-disabled)]">
                {open ? "▾" : "▸"}
              </span>
              <span className="flex-1 truncate text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                {categoryLabel(actionmap)}
              </span>
              {teaser && <PremiumBadge />}
              {flagged > 0 && (
                <span className="rounded-full bg-[var(--danger-soft)] px-1.5 text-[0.6875rem] font-medium text-[var(--danger-text)]">
                  {flagged}
                </span>
              )}
              <span className="tabular-nums text-xs text-[var(--text-disabled)]">
                {items.length}
              </span>
            </button>

            {open && (
              <ul>
                {items.map((b) => (
                  <CommandRow
                    key={rowKey(b)}
                    binding={b}
                    selected={selected === rowKey(b)}
                    disambiguate={ambiguous.has(bindingLabel(b))}
                    pending={
                      pending.has(keyOf(b.actionmap, b.action))
                        ? pending.get(keyOf(b.actionmap, b.action))!
                        : undefined
                    }
                    hasPending={pending.has(keyOf(b.actionmap, b.action))}
                    conflicting={hasConflict(b, pending, conflicts)}
                    live={activeToken !== null && b.input_raw === activeToken}
                    onSelect={() => onSelect(rowKey(b))}
                  />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Une ligne de commande, réduite à ce qui se lit d'un coup d'œil.
 *
 * Les boutons d'action ont quitté la ligne pour le volet de détail : les
 * répéter sur 451 lignes chargeait l'écran sans rien apporter, puisqu'on doit
 * de toute façon sélectionner une commande pour la modifier.
 */
function CommandRow({
  binding,
  selected,
  disambiguate,
  pending,
  hasPending,
  conflicting,
  live,
  onSelect,
}: {
  binding: EditableBinding;
  selected: boolean;
  disambiguate: boolean;
  pending: string | null | undefined;
  hasPending: boolean;
  conflicting: boolean;
  live: boolean;
  onSelect: () => void;
}) {
  const t = useT();
  const assigned = binding.control !== null && binding.control !== "";

  return (
    <li>
      <button
        onClick={onSelect}
        className={
          "flex w-full items-center justify-between gap-3 border-l-2 py-2 pl-8 pr-3 text-left transition-colors " +
          (live
            ? "border-[var(--border-accent)] bg-[var(--accent-soft)]"
            : selected
              ? "border-[var(--border-accent)] bg-[var(--accent-soft)]"
              : hasPending
                ? "border-transparent bg-[var(--accent-soft)]/50 hover:bg-[var(--surface-hover)]"
                : "border-transparent hover:bg-[var(--surface-hover)]")
        }
      >
        <span className="min-w-0">
          <span className="block truncate text-sm text-[var(--text-primary)]">
            {bindingLabel(binding)}
          </span>
          {disambiguate && (
            <span className="block truncate text-xs text-[var(--text-disabled)]">
              {categoryLabel(binding.actionmap)}
            </span>
          )}
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          {conflicting && (
            <span
              title={t("conflict.badge")}
              className="rounded bg-[var(--danger-soft)] px-1.5 py-0.5 text-[0.6875rem] font-medium text-[var(--danger-text)]"
            >
              !
            </span>
          )}
          {hasPending ? (
            <Key accent>{pending ?? t("binding.clear")}</Key>
          ) : assigned ? (
            <TokenChips binding={binding} />
          ) : (
            <span className="text-xs italic text-[var(--text-disabled)]">
              {t("binding.unassigned")}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

/** Représentation compacte d'un jeton : périphérique, modificateur, contrôle. */
function TokenChips({ binding }: { binding: EditableBinding }) {
  const t = useT();
  return (
    <span className="technical flex items-center gap-1">
      {/* Une valeur par défaut ne porte pas d'index de périphérique : le jeu
          l'applique au premier de la famille. L'afficher comme une surcharge
          laisserait croire qu'elle est écrite quelque part. */}
      {binding.origin === "game_default" ? (
        <span
          title={t("binding.defaultTitle")}
          className="rounded border border-[var(--border-subtle)] px-1.5 py-0.5 text-[0.6875rem] font-medium text-[var(--text-tertiary)]"
        >
          {t("binding.default")}
        </span>
      ) : (
        <Key>{binding.device}</Key>
      )}
      {binding.modifier && (
        <>
          <Key>{binding.modifier}</Key>
          <span className="text-[var(--text-disabled)]">+</span>
        </>
      )}
      <Key>{binding.control}</Key>
    </span>
  );
}

/**
 * Rappelle qu'un modificateur ou un mode d'activation accompagne le contrôle.
 *
 * Purement informatif : `spacemapper_edit::writer` préserve ces attributs
 * qu'on édite ou non le contrôle lui-même, donc rien n'empêche l'édition —
 * mais un joueur qui change le bouton sans savoir que « double-appui » est
 * aussi en jeu risque de ne plus comprendre le comportement en vol.
 */
function ActivationModeNote({ binding }: { binding: EditableBinding }) {
  const t = useT();
  return (
    <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">
      {binding.activation_mode && (
        <span className="technical mr-2">
          {t("detail.activationMode")}: {binding.activation_mode}
        </span>
      )}
      {binding.multi_tap && (
        <span className="technical">
          {t("detail.multiTap")}: {binding.multi_tap}
        </span>
      )}
    </p>
  );
}

/**
 * Colonne de droite : tout ce qu'on peut dire d'une commande.
 *
 * C'est ici que vivent les actions et, surtout, les conflits : le jeu ne
 * signale nulle part que deux commandes se disputent un bouton, et c'est
 * précisément ce qu'on découvre en vol.
 */
function DetailPane({
  binding,
  pending,
  conflicts,
  ambiguous,
  onEdit,
  onClear,
  onRevert,
  onLockedClick,
  onSelect,
}: {
  binding: EditableBinding | null;
  pending: Map<string, string | null>;
  conflicts: ConflictIndex;
  ambiguous: Set<string>;
  onEdit: (binding: EditableBinding) => void;
  onClear: (binding: EditableBinding) => void;
  onRevert: (key: string) => void;
  onLockedClick: (reason: LockReason) => void;
  onSelect: (key: string) => void;
}) {
  const t = useT();

  if (!binding) {
    return (
      <aside className="hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-10 text-center text-sm text-[var(--text-tertiary)] lg:block">
        {/* Masqué en fenêtre étroite : une invite à sélectionner n'a pas
            besoin d'un écran entier sous la liste. */}
        {t("detail.empty")}
      </aside>
    );
  }

  const key = keyOf(binding.actionmap, binding.action);
  const hasPending = pending.has(key);
  const staged = hasPending ? pending.get(key)! : undefined;
  const assigned = binding.control !== null && binding.control !== "";
  const rivals = rivalsOf(binding, pending, conflicts);

  return (
    <aside className="space-y-4 self-start rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 lg:sticky lg:top-0">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          {bindingLabel(binding)}
        </h3>
        <p className="technical mt-0.5 text-[var(--text-disabled)]">
          {binding.action}
          {ambiguous.has(bindingLabel(binding)) && (
            <span className="ml-1.5 text-[var(--text-tertiary)]">
              · {categoryLabel(binding.actionmap)}
            </span>
          )}
        </p>
      </div>

      {binding.description && (
        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
          {binding.description}
        </p>
      )}

      {/* La situation explique pourquoi telle touche partagée n'est pas
          signalée : une commande de siège et une commande à pied ne
          répondent jamais ensemble. */}
      <p className="text-xs text-[var(--text-tertiary)]">
        {t("detail.activeIn")}{" "}
        <span className="font-medium text-[var(--text-primary)]">
          {t(`context.${binding.context}`)}
        </span>
      </p>

      <div>
        <p className="text-xs font-medium text-[var(--text-tertiary)]">
          {t("detail.assignment")}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {hasPending ? (
            <>
              {assigned && (
                <span className="technical text-[var(--text-disabled)] line-through">
                  {binding.device}_{binding.control}
                </span>
              )}
              <span className="text-[var(--text-disabled)]">→</span>
              <Key accent>{staged ?? t("binding.clear")}</Key>
            </>
          ) : assigned ? (
            <TokenChips binding={binding} />
          ) : (
            <span className="text-sm italic text-[var(--text-disabled)]">
              {t("binding.unassigned")}
            </span>
          )}
        </div>
        {!hasPending && (binding.activation_mode || binding.multi_tap) && (
          <ActivationModeNote binding={binding} />
        )}
      </div>

      {rivals.length > 0 && (
        <div className="rounded-[var(--radius-control)] border border-[var(--danger)]/30 bg-[var(--danger-soft)] p-3">
          <p className="text-xs font-medium text-[var(--danger-text)]">
            {rivals.length}{" "}
            {t(rivals.length > 1 ? "conflict.manyBody" : "conflict.oneBody")}
          </p>
          <ul className="mt-1.5 space-y-1">
            {rivals.map((other) => (
              <li key={rowKey(other)}>
                <button
                  onClick={() => onSelect(rowKey(other))}
                  className="text-left text-xs text-[var(--text-primary)] underline decoration-[var(--warning)] underline-offset-2 hover:text-[var(--danger-text)]"
                >
                  {bindingLabel(other)}
                  <span className="ml-1 text-[var(--text-disabled)]">
                    · {categoryLabel(other.actionmap)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-3">
        {binding.lock ? (
          <button
            onClick={() => onLockedClick(binding.lock!)}
            className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--text-tertiary)]"
          >
            {t("binding.locked")}
          </button>
        ) : hasPending ? (
          <button
            onClick={() => onRevert(key)}
            className="rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
          >
            {t("binding.revert")}
          </button>
        ) : (
          <>
            <button
              onClick={() => onEdit(binding)}
              className="rounded-[var(--radius-control)] bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-hover)]"
            >
              {t("binding.edit")}
            </button>
            {assigned && (
              <button
                onClick={() => onClear(binding)}
                className="rounded-[var(--radius-control)] px-3 py-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--danger-text)]"
              >
                {t("binding.clear")}
              </button>
            )}
          </>
        )}
      </div>

      {binding.lock && (
        <p className="text-xs text-[var(--text-tertiary)]">{t(`lock.${binding.lock}`)}</p>
      )}
    </aside>
  );
}

/** Exporté : l'aperçu verrouillé du wizard (App.tsx) réutilise ce même badge. */
export function PremiumBadge() {
  return (
    <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[0.6875rem] font-medium text-[var(--text-accent)]">
      Premium
    </span>
  );
}

function UpsellDialog({
  reason,
  onClose,
}: {
  reason: LockReason;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Modal onCancel={onClose} title={t("upsell.title")}>
      <p className="text-sm text-[var(--text-secondary)]">{t(`lock.${reason}`)}</p>
      <p className="mt-3 text-sm text-[var(--text-secondary)]">{t("upsell.body")}</p>
      <div className="mt-5 flex justify-end">
        <button
          onClick={onClose}
          className="rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
        >
          {t("upsell.close")}
        </button>
      </div>
    </Modal>
  );
}

function ControlPicker({
  binding,
  devices,
  capture,
  onCancel,
  onPick,
}: {
  binding: EditableBinding;
  devices: DeviceView[];
  capture: CaptureFeed;
  onCancel: () => void;
  onPick: (input: string) => void;
}) {
  const joysticks = devices.filter((d) => d.category === "joystick");
  const gamepads = devices.filter((d) => d.category === "gamepad");

  const t = useT();
  // On ouvre sur le manche dès qu'il y en a un : c'est le périphérique que
  // vient configurer l'écrasante majorité des utilisateurs de ce logiciel.
  const [source, setSource] = useState<Source>(
    joysticks.length > 0 ? "joystick" : "keyboard",
  );

  const assigned = binding.control !== null && binding.control !== "";

  return (
    <Modal onCancel={onCancel} title={bindingLabel(binding)}>
      {assigned && (
        <div className="mb-4 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2">
          <p className="text-xs font-medium text-[var(--text-tertiary)]">
            {t("picker.currentAssignment")}
          </p>
          <div className="mt-1">
            <TokenChips binding={binding} />
          </div>
          {binding.modifier && (
            <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">
              {t("picker.modifierHint")}
            </p>
          )}
        </div>
      )}

      <div className="mb-4 flex gap-1 border-b border-[var(--border-subtle)]">
        <SourceTab
          active={source === "keyboard"}
          onClick={() => setSource("keyboard")}
        >
          {t("picker.keyboard")}
        </SourceTab>
        <SourceTab
          active={source === "joystick"}
          onClick={() => setSource("joystick")}
          count={joysticks.length}
        >
          {t("picker.joystick")}
        </SourceTab>
        <SourceTab
          active={source === "gamepad"}
          onClick={() => setSource("gamepad")}
          count={gamepads.length}
        >
          {t("picker.gamepad")}
        </SourceTab>
      </div>

      {source === "keyboard" ? (
        <KeyboardCapture onCancel={onCancel} onPick={onPick} />
      ) : (
        <DevicePicker
          key={source}
          allDevices={devices}
          family={source === "joystick" ? joysticks : gamepads}
          capture={capture}
          onCancel={onCancel}
          onPick={onPick}
        />
      )}
    </Modal>
  );
}

type Source = "keyboard" | "joystick" | "gamepad";

function SourceTab({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  const t = useT();
  // Un onglet sans périphérique reste visible mais inerte : le masquer
  // laisserait croire que le mode n'existe pas.
  const empty = count === 0;
  return (
    <button
      onClick={onClick}
      disabled={empty}
      title={empty ? t("picker.noDevice") : undefined}
      className={
        "-mb-px border-b-2 px-3 py-1.5 text-sm font-medium " +
        (empty
          ? "cursor-not-allowed border-transparent text-[var(--text-disabled)]"
          : active
            ? "border-[var(--border-accent)] text-[var(--text-accent)]"
            : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]")
      }
    >
      {children}
      {count !== undefined && count > 1 && (
        <span className="ml-1 text-xs text-[var(--text-disabled)]">({count})</span>
      )}
    </button>
  );
}

/**
 * Capture d'un appui clavier.
 *
 * L'écoute est posée sur `window` en phase de capture et bloque la propagation :
 * sans cela, Tab déplacerait le focus et Échap fermerait la fenêtre avant
 * qu'on ait pu lire la touche.
 *
 * Un modificateur ne se décide qu'au **relâchement**. Tant qu'il est maintenu,
 * on ne peut pas savoir si l'utilisateur assigne « Maj » seul ou s'apprête à
 * composer « Maj + F » — et « Maj » seul est une assignation courante, c'est la
 * postcombustion par défaut du jeu.
 */
function KeyboardCapture({
  onCancel,
  onPick,
}: {
  onCancel: () => void;
  onPick: (input: string) => void;
}) {
  const t = useT();
  const [captured, setCaptured] = useState<CaptureResult | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  /** Modificateurs physiquement enfoncés, dans l'ordre d'appui. */
  const held = useRef<string[]>([]);
  /** Une touche principale a-t-elle été frappée pendant ce maintien ? */
  const composed = useRef(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;

      const modifier = modifierOf(event.code);
      if (modifier) {
        if (!held.current.includes(modifier)) held.current.push(modifier);
        return;
      }

      const result = fromKeyPress(event.code, held.current);
      composed.current = true;
      if (result.ok) {
        setCaptured(result.value);
        setHint(null);
      } else {
        setCaptured(null);
        setHint(captureErrorMessage(result.error, t));
      }
    }


    function onKeyUp(event: KeyboardEvent) {
      const modifier = modifierOf(event.code);
      if (!modifier) return;
      event.preventDefault();
      event.stopPropagation();

      // Relâché sans qu'aucune touche principale n'ait été frappée : c'est
      // bien le modificateur seul que l'utilisateur veut assigner.
      if (!composed.current && held.current.length === 1) {
        setCaptured(build(null, modifier));
        setHint(null);
      }

      held.current = held.current.filter((m) => m !== modifier);
      if (held.current.length === 0) composed.current = false;
    }

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, []);

  function apply(
    result:
      | { ok: true; value: CaptureResult }
      | { ok: false; error: CaptureError },
  ) {
    if (result.ok) {
      setCaptured(result.value);
      setHint(null);
    } else {
      setCaptured(null);
      setHint(captureErrorMessage(result.error, t));
    }
  }

  return (
    <div className="space-y-4">
      {/* La souris n'est écoutée que dans cette zone, jamais sur la fenêtre :
          un écouteur global capterait les clics sur « Annuler » et
          « Confirmer », rendant le dialogue impossible à quitter. */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          apply(fromMouse(e.button, held.current));
        }}
        onWheel={(e) => apply(fromWheel(e.deltaY, held.current))}
        onContextMenu={(e) => e.preventDefault()}
        className={
          "cursor-pointer select-none rounded-[var(--radius-card)] border-2 border-dashed px-4 py-8 text-center " +
          (captured
            ? "border-[var(--border-accent)] bg-[var(--accent-soft)]"
            : "border-[var(--border-default)] bg-[var(--surface-2)]")
        }
      >
        {captured ? (
          <>
            <p className="text-lg font-medium text-[var(--text-accent)]">
              {describe(captured, t)}
            </p>
            <p className="technical mt-1 text-[var(--text-tertiary)]">{captured.token}</p>
          </>
        ) : (
          <p className="text-sm text-[var(--text-tertiary)]">
            {t("picker.pressKey")}
          </p>
        )}
      </div>

      {hint && <p className="text-sm text-[var(--danger-text)]">{hint}</p>}

      <p className="text-xs text-[var(--text-tertiary)]">{t("picker.keyHint")}</p>

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
        >
          {t("save.cancel")}
        </button>
        <button
          disabled={!captured}
          onClick={() => captured && onPick(captured.token)}
          className="rounded-[var(--radius-control)] bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--border-default)]"
        >
          {t("picker.apply")}
        </button>
      </div>
    </div>
  );
}

/**
 * Capture d'un contrôle de manche ou de manette.
 *
 * Tous les périphériques de la famille sont sondés simultanément : l'utilisateur
 * n'a pas à désigner le bon avant d'appuyer, l'application reconnaît lequel a
 * bougé. C'est indispensable en HOSAS, où deux exemplaires du même modèle sont
 * impossibles à distinguer dans une liste.
 *
 * On lit DirectInput, la même interface que Star Citizen : le bouton 5 est donc
 * le bouton 5. Une liste déroulante reste accessible en repli, pour assigner un
 * contrôle qu'on ne peut pas actionner sur le moment.
 */
function DevicePicker({
  allDevices,
  family,
  capture,
  onCancel,
  onPick,
}: {
  allDevices: DeviceView[];
  family: DeviceView[];
  capture: CaptureFeed;
  onCancel: () => void;
  onPick: (input: string) => void;
}) {
  const t = useT();
  const [manual, setManual] = useState(false);
  const [manualIndex, setManualIndex] = useState(0);
  const [control, setControl] = useState("");

  // On repart d'un relevé vierge à l'ouverture, sinon la fenêtre s'ouvrirait
  // déjà remplie par le dernier contrôle actionné pour identifier une commande.
  useEffect(() => {
    capture.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seul un contrôle de la bonne famille est retenu : dans l'onglet Manche, un
  // appui sur la manette ne doit pas s'inviter.
  const captured =
    capture.last &&
    family.some((d) => d.instance_guid === capture.last!.guid)
      ? capture.last
      : null;

  const manualDevice = family[manualIndex];
  const options: ControlOption[] = manualDevice
    ? controlsFor(manualDevice, t)
    : [];
  const groups = useMemo(() => {
    const map = new Map<ControlGroup, ControlOption[]>();
    for (const o of options) {
      const list = map.get(o.group);
      if (list) list.push(o);
      else map.set(o.group, [o]);
    }
    return [...map.entries()];
  }, [options]);

  if (family.length === 0) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">
        {t("picker.noDevice")}
      </p>
    );
  }

  // Le périphérique effectivement actionné, retrouvé par son GUID.
  const capturedDevice = captured
    ? allDevices.find((d) => d.instance_guid === captured.guid)
    : undefined;

  const token = manual
    ? manualDevice && control
      ? `${devicePrefix(allDevices, manualDevice)}_${control}`
      : null
    : captured && capturedDevice
      ? `${devicePrefix(allDevices, capturedDevice)}_${captured.control}`
      : null;

  return (
    <div className="space-y-4">
      {manual ? (
        <>
          <label className="block">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              {t("picker.device")}
            </span>
            <select
              className="mt-1 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-1.5 text-sm"
              value={manualIndex}
              onChange={(e) => {
                setManualIndex(Number(e.target.value));
                setControl("");
              }}
            >
              {family.map((d, i) => (
                <option key={d.instance_guid} value={i}>
                  {devicePrefix(allDevices, d)} —{" "}
                  {d.product_name || d.instance_name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              {t("picker.control")}
            </span>
            <select
              className="mt-1 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-1.5 text-sm"
              value={control}
              onChange={(e) => setControl(e.target.value)}
            >
              <option value="">{t("picker.choose")}</option>
              {groups.map(([group, items]) => (
                <optgroup key={group} label={groupLabel(group, t)}>
                  {items.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </>
      ) : (
        <div
          className={
            "rounded-[var(--radius-card)] border-2 border-dashed px-4 py-8 text-center " +
            (captured
              ? "border-[var(--border-accent)] bg-[var(--accent-soft)]"
              : "border-[var(--border-default)] bg-[var(--surface-2)]")
          }
        >
          {captured && capturedDevice ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-accent)]">
                {devicePrefix(allDevices, capturedDevice)} —{" "}
                {capturedDevice.product_name || capturedDevice.instance_name}
              </p>
              <p className="mt-1 text-lg font-medium text-[var(--text-accent)]">
                {controlLabel(captured.control, t)}
              </p>
              <p className="technical mt-1 text-[var(--text-tertiary)]">{token}</p>
            </>
          ) : (
            <>
              <p className="text-sm text-[var(--text-tertiary)]">
                {t("picker.pressControl")}
              </p>
              <p className="mt-1 text-xs text-[var(--text-disabled)]">
                {capture.listening
                  ? `${family.length} ${t(
                      family.length > 1 ? "probe.deviceMany" : "probe.deviceOne",
                    )} · ${t("probe.listening")}`
                  : t("probe.opening")}
              </p>
            </>
          )}
        </div>
      )}

      {capture.error && (
        <p className="text-sm text-[var(--danger-text)]">{capture.error}</p>
      )}

      <button
        onClick={() => {
          setManual((v) => !v);
          setControl("");
          capture.reset();
        }}
        className="text-sm font-medium text-[var(--text-accent)] hover:text-[var(--accent-hover)]"
      >
        {t(manual ? "picker.useCapture" : "picker.useList")}
      </button>

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
        >
          {t("save.cancel")}
        </button>
        <button
          disabled={!token}
          onClick={() => token && onPick(token)}
          className="rounded-[var(--radius-control)] bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--border-default)]"
        >
          {t("picker.apply")}
        </button>
      </div>
    </div>
  );
}

/** Exporté : l'aperçu verrouillé du wizard (App.tsx) réutilise cette même
 * enveloppe plutôt que d'en écrire une seconde. */
export function Modal({
  title,
  children,
  onCancel,
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center overflow-y-auto bg-[var(--scrim)] p-4 sm:p-8"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-5 shadow-[var(--shadow-2)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Key({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <span
      className={
        "rounded border px-1.5 py-0.5 " +
        (accent
          ? "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--text-accent)]"
          : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-primary)]")
      }
    >
      {children}
    </span>
  );
}
