import { useEffect, useMemo, useState } from "react";
import {
  api,
  type DeviceView,
  type EditableBinding,
  type EditCategory,
} from "./lib/api";
import { actionLabel, categoryLabel } from "./lib/actionLabels";
import { controlsFor, devicePrefix, type ControlOption } from "./lib/controls";
import BackupPanel from "./BackupPanel";

const CATEGORY_TITLES: Record<EditCategory, string> = {
  flight: "Pilotage",
  on_foot: "À pied",
};

export default function BindingEditor({
  profilePath,
  devices,
}: {
  profilePath: string;
  devices: DeviceView[];
}) {
  const [bindings, setBindings] = useState<EditableBinding[]>([]);
  const [editing, setEditing] = useState<EditableBinding | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backupCount, setBackupCount] = useState<number | null>(null);

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

  async function commit(binding: EditableBinding, input: string | null) {
    try {
      if (input === null) {
        await api.clearBinding(profilePath, binding.actionmap, binding.action);
        setStatus(`« ${actionLabel(binding.action)} » effacée.`);
      } else {
        await api.setBinding(profilePath, binding.actionmap, binding.action, input);
        setStatus(`« ${actionLabel(binding.action)} » réassignée.`);
      }
      setError(null);
      setEditing(null);
      await reload();
    } catch (e) {
      setError(String(e));
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
    <div className="space-y-6">
      <ScopeNotice />

      <BackupPanel
        profilePath={profilePath}
        onRestored={() => void reload()}
        onCountChange={setBackupCount}
      />

      {backupCount === 0 && <NoBackupWarning />}

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

      {grouped.map(([actionmap, items]) => (
        <div
          key={actionmap}
          className="overflow-hidden rounded-lg border border-ink-200 bg-white"
        >
          <h3 className="flex items-baseline gap-2 border-b border-ink-100 bg-ink-50 px-4 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {categoryLabel(actionmap)}
            </span>
            <span className="text-xs text-ink-400">
              {CATEGORY_TITLES[items[0]!.category]}
            </span>
          </h3>
          <ul className="divide-y divide-ink-100">
            {items.map((b) => (
              <BindingRow
                key={`${b.actionmap}-${b.action}`}
                binding={b}
                onEdit={() => setEditing(b)}
                onClear={() => void commit(b, null)}
              />
            ))}
          </ul>
        </div>
      ))}

      {editing && (
        <ControlPicker
          binding={editing}
          devices={devices}
          onCancel={() => setEditing(null)}
          onPick={(input) => void commit(editing, input)}
        />
      )}
    </div>
  );
}

function ScopeNotice() {
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <p className="text-sm text-ink-700">
        L'édition Lite couvre les <strong>déplacements</strong> — pilotage et
        déplacement à pied. Le combat, le ciblage, l'énergie et les systèmes de
        bord relèvent de l'édition Premium.
      </p>
      <p className="mt-2 text-sm text-ink-500">
        Fermez Star Citizen avant d'éditer&nbsp;: le jeu réécrit ce fichier en
        quittant et écraserait vos changements.
      </p>
    </div>
  );
}

/**
 * Les sauvegardes n'étant pas automatiques, un utilisateur peut modifier ses
 * assignations sans aucun moyen de revenir en arrière. On le lui dit à
 * l'endroit et au moment où ça compte, sans bloquer son geste.
 */
function NoBackupWarning() {
  return (
    <div className="rounded-lg border border-warn-200 bg-warn-50 p-4">
      <p className="text-sm font-medium text-warn-700">
        Aucun point de restauration
      </p>
      <p className="mt-1 text-sm text-ink-600">
        Vos modifications ne seront pas annulables. Créez une sauvegarde
        ci-dessus avant de commencer&nbsp;: c'est votre seul moyen de retrouver
        votre configuration actuelle.
      </p>
    </div>
  );
}

function BindingRow({
  binding,
  onEdit,
  onClear,
}: {
  binding: EditableBinding;
  onEdit: () => void;
  onClear: () => void;
}) {
  const assigned = binding.control !== null;

  return (
    <li className="flex items-center justify-between gap-4 px-4 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm text-ink-800">
          {actionLabel(binding.action)}
        </p>
        <p className="technical mt-0.5 truncate text-ink-400">{binding.action}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {assigned ? (
          <span className="technical flex items-center gap-1">
            <Key>{binding.device}</Key>
            <Key>{binding.control}</Key>
          </span>
        ) : (
          <span className="text-xs italic text-ink-400">non assignée</span>
        )}

        {binding.locked ? (
          <span
            title={binding.locked_reason ?? undefined}
            className="rounded border border-ink-200 px-2 py-1 text-xs text-ink-400"
          >
            verrouillée
          </span>
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
            Assigner
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

function Key({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-ink-700">
      {children}
    </span>
  );
}
