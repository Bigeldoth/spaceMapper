import { useEffect, useMemo, useState } from "react";
import {
  api,
  type DeviceView,
  type EditableBinding,
  type PendingEdit,
} from "./lib/api";
import { actionLabel, categoryLabel } from "./lib/actionLabels";
import { controlsFor, devicePrefix, type ControlOption } from "./lib/controls";
import BackupPanel from "./BackupPanel";

/** Clé stable d'une assignation, indépendante de l'ordre du fichier. */
function keyOf(actionmap: string, action: string): string {
  return `${actionmap}/${action}`;
}

export default function BindingEditor({
  profilePath,
  devices,
}: {
  profilePath: string;
  devices: DeviceView[];
}) {
  const [bindings, setBindings] = useState<EditableBinding[]>([]);
  const [editing, setEditing] = useState<EditableBinding | null>(null);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upsell, setUpsell] = useState<string | null>(null);

  /**
   * Modifications non enregistrées, par clé d'assignation. `null` signifie
   * « effacer ». Rien n'est écrit sur disque tant que l'utilisateur n'a pas
   * validé : c'est ce qui rend le bandeau du bas nécessaire.
   */
  const [pending, setPending] = useState<Map<string, string | null>>(new Map());

  async function reload() {
    try {
      setBindings(await api.listEditableBindings(profilePath));
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

  const grouped = useMemo(() => {
    const map = new Map<string, EditableBinding[]>();
    for (const b of bindings) {
      const list = map.get(b.actionmap);
      if (list) list.push(b);
      else map.set(b.actionmap, [b]);
    }
    return [...map.entries()];
  }, [bindings]);

  return (
    <div className="space-y-6 pb-4">
      <ScopeNotice />

      <BackupPanel profilePath={profilePath} onRestored={() => void reload()} />

      {status && (
        <p className="rounded-md border border-accent-100 bg-accent-50 px-4 py-2 text-sm text-accent-700">
          {status}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-warn-200 bg-warn-50 px-4 py-2 text-sm text-warn-700">
          {error}
        </p>
      )}

      {grouped.map(([actionmap, items]) => {
        const teaser = items[0]!.access === "premium_teaser";
        return (
          <div
            key={actionmap}
            className={
              "overflow-hidden rounded-lg border bg-white " +
              (teaser ? "border-ink-200 opacity-75" : "border-ink-200")
            }
          >
            <h3 className="flex items-center gap-2 border-b border-ink-100 bg-ink-50 px-4 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                {categoryLabel(actionmap)}
              </span>
              {teaser && <PremiumBadge />}
            </h3>
            <ul className="divide-y divide-ink-100">
              {items.map((b) => {
                const key = keyOf(b.actionmap, b.action);
                return (
                  <BindingRow
                    key={key}
                    binding={b}
                    pending={pending.has(key) ? pending.get(key)! : undefined}
                    hasPending={pending.has(key)}
                    onEdit={() => setEditing(b)}
                    onClear={() => stage(b, null)}
                    onRevert={() => discardOne(key)}
                    onLockedClick={() => setUpsell(b.locked_reason)}
                  />
                );
              })}
            </ul>
          </div>
        );
      })}

      {editing && (
        <ControlPicker
          binding={editing}
          devices={devices}
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
  return (
    <div className="sticky bottom-0 z-[5] -mx-2 mt-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warn-200 bg-warn-50 px-4 py-3 shadow-lg">
        <p className="text-sm font-medium text-warn-700">
          {count} modification{count > 1 ? "s" : ""} non enregistrée
          {count > 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onDiscardAll}
            disabled={saving}
            className="rounded-md px-2.5 py-1.5 text-sm text-ink-600 hover:text-warn-700 disabled:text-ink-400"
          >
            Tout annuler
          </button>
          <button
            onClick={onReview}
            disabled={saving}
            className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700 disabled:bg-ink-300"
          >
            {saving ? "Enregistrement…" : "Enregistrer…"}
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
  const [withBackup, setWithBackup] = useState(true);
  const [showDetail, setShowDetail] = useState(false);

  const rows = [...pending].map(([key, input]) => {
    const binding = bindings.find(
      (b) => keyOf(b.actionmap, b.action) === key,
    );
    return { key, input, binding };
  });

  return (
    <Modal onCancel={onCancel} title="Enregistrer les modifications">
      <p className="text-sm text-ink-600">
        {rows.length} modification{rows.length > 1 ? "s" : ""} sera
        {rows.length > 1 ? "ont" : ""} écrite{rows.length > 1 ? "s" : ""} dans
        votre profil Star Citizen.
      </p>

      <button
        onClick={() => setShowDetail((v) => !v)}
        className="mt-2 text-sm font-medium text-accent-700 hover:text-accent-600"
      >
        {showDetail ? "Masquer le détail" : "Voir les modifications"}
      </button>

      {showDetail && (
        <ul className="mt-3 max-h-60 divide-y divide-ink-100 overflow-y-auto rounded-md border border-ink-200">
          {rows.map(({ key, input, binding }) => (
            <li
              key={key}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-ink-800">
                  {binding ? actionLabel(binding.action) : key}
                </p>
                <p className="technical mt-0.5 truncate text-ink-400">
                  {binding?.control
                    ? `${binding.device}_${binding.control}`
                    : "non assignée"}
                  {" → "}
                  <span className="text-accent-700">{input ?? "effacée"}</span>
                </p>
              </div>
              <button
                onClick={() => onDiscardOne(key)}
                className="shrink-0 rounded px-2 py-1 text-xs text-ink-500 hover:text-warn-700"
              >
                Retirer
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
        <span className="text-sm text-ink-700">
          Créer un point de restauration avant d'écrire
          <span className="mt-0.5 block text-xs text-ink-500">
            Sans lui, ces modifications ne seront pas annulables.
          </span>
        </span>
      </label>

      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md border border-ink-300 bg-white px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-50"
        >
          Annuler
        </button>
        <button
          onClick={() => onConfirm(withBackup)}
          className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700"
        >
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}

function ScopeNotice() {
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <p className="text-sm text-ink-700">
        L'édition Lite couvre le <strong>pilotage</strong> et le{" "}
        <strong>déplacement à pied</strong>. Les autres catégories sont
        affichées mais verrouillées.
      </p>
      <p className="mt-2 text-sm text-ink-500">
        Rien n'est écrit tant que vous n'avez pas enregistré. Fermez Star
        Citizen avant d'éditer&nbsp;: le jeu réécrit ce fichier en quittant et
        écraserait vos changements.
      </p>
    </div>
  );
}

function PremiumBadge() {
  return (
    <span className="rounded-full bg-accent-50 px-2 py-0.5 text-[0.6875rem] font-medium text-accent-700">
      Premium
    </span>
  );
}

function BindingRow({
  binding,
  pending,
  hasPending,
  onEdit,
  onClear,
  onRevert,
  onLockedClick,
}: {
  binding: EditableBinding;
  pending: string | null | undefined;
  hasPending: boolean;
  onEdit: () => void;
  onClear: () => void;
  onRevert: () => void;
  onLockedClick: () => void;
}) {
  const assigned = binding.control !== null;

  return (
    <li
      className={
        "flex items-center justify-between gap-4 px-4 py-2.5 " +
        (hasPending ? "bg-accent-50/60" : "")
      }
    >
      <div className="min-w-0">
        <p className="truncate text-sm text-ink-800">
          {actionLabel(binding.action)}
        </p>
        <p className="technical mt-0.5 truncate text-ink-400">
          {binding.action}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {hasPending ? (
          <span className="technical flex items-center gap-1">
            <span className="text-ink-400 line-through">
              {assigned ? `${binding.device}_${binding.control}` : "vide"}
            </span>
            <span className="text-ink-400">→</span>
            <Key accent>{pending ?? "effacée"}</Key>
          </span>
        ) : assigned ? (
          <span className="technical flex items-center gap-1">
            <Key>{binding.device}</Key>
            <Key>{binding.control}</Key>
          </span>
        ) : (
          <span className="text-xs italic text-ink-400">non assignée</span>
        )}

        {binding.locked ? (
          <button
            onClick={onLockedClick}
            title={binding.locked_reason ?? undefined}
            className="cursor-not-allowed rounded border border-ink-200 bg-ink-50 px-2 py-1 text-xs text-ink-400"
          >
            Verrouillé
          </button>
        ) : hasPending ? (
          <button
            onClick={onRevert}
            className="rounded-md border border-ink-300 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50"
          >
            Rétablir
          </button>
        ) : (
          <>
            <button
              onClick={onEdit}
              className="rounded-md border border-ink-300 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50"
            >
              Modifier
            </button>
            {assigned && (
              <button
                onClick={onClear}
                className="rounded-md px-2 py-1 text-xs text-ink-500 hover:text-warn-700"
              >
                Effacer
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function UpsellDialog({
  reason,
  onClose,
}: {
  reason: string;
  onClose: () => void;
}) {
  return (
    <Modal onCancel={onClose} title="Réservé à l'édition Premium">
      <p className="text-sm text-ink-600">{reason}</p>
      <p className="mt-3 text-sm text-ink-600">
        SpaceMapper Premium débloque toutes les catégories — combat, énergie,
        systèmes de bord, tourelles — ainsi que les modificateurs, les modes
        d'activation, les profils nommés et la synchronisation entre machines.
      </p>
      <div className="mt-5 flex justify-end">
        <button
          onClick={onClose}
          className="rounded-md border border-ink-300 bg-white px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-50"
        >
          Fermer
        </button>
      </div>
    </Modal>
  );
}

function ControlPicker({
  binding,
  devices,
  onCancel,
  onPick,
}: {
  binding: EditableBinding;
  devices: DeviceView[];
  onCancel: () => void;
  onPick: (input: string) => void;
}) {
  const [deviceIndex, setDeviceIndex] = useState(0);
  const [control, setControl] = useState("");

  const device = devices[deviceIndex];
  const options: ControlOption[] = device ? controlsFor(device) : [];

  const groups = useMemo(() => {
    const map = new Map<string, ControlOption[]>();
    for (const o of options) {
      const list = map.get(o.group);
      if (list) list.push(o);
      else map.set(o.group, [o]);
    }
    return [...map.entries()];
  }, [options]);

  if (devices.length === 0) {
    return (
      <Modal onCancel={onCancel} title={actionLabel(binding.action)}>
        <p className="text-sm text-ink-600">
          Aucun périphérique détecté. Branchez votre manche puis relancez
          SpaceMapper.
        </p>
      </Modal>
    );
  }

  return (
    <Modal onCancel={onCancel} title={actionLabel(binding.action)}>
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-ink-600">Périphérique</span>
          <select
            className="mt-1 w-full rounded-md border border-ink-300 bg-white px-3 py-1.5 text-sm"
            value={deviceIndex}
            onChange={(e) => {
              setDeviceIndex(Number(e.target.value));
              setControl("");
            }}
          >
            {devices.map((d, i) => (
              <option key={d.instance_guid} value={i}>
                {devicePrefix(i)} — {d.product_name || d.instance_name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-ink-600">Contrôle</span>
          <select
            className="mt-1 w-full rounded-md border border-ink-300 bg-white px-3 py-1.5 text-sm"
            value={control}
            onChange={(e) => setControl(e.target.value)}
          >
            <option value="">Choisir…</option>
            {groups.map(([group, items]) => (
              <optgroup key={group} label={group}>
                {items.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        {control && (
          <p className="technical rounded bg-ink-50 px-3 py-2 text-ink-600">
            {devicePrefix(deviceIndex)}_{control}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-ink-300 bg-white px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-50"
          >
            Annuler
          </button>
          <button
            disabled={!control}
            onClick={() => onPick(`${devicePrefix(deviceIndex)}_${control}`)}
            className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-ink-300"
          >
            Appliquer
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({
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
      className="fixed inset-0 z-10 flex items-center justify-center bg-ink-900/30 p-8"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-lg border border-ink-200 bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-sm font-semibold text-ink-900">{title}</h3>
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
          ? "border-accent-100 bg-accent-50 text-accent-700"
          : "border-ink-200 bg-ink-50 text-ink-700")
      }
    >
      {children}
    </span>
  );
}
