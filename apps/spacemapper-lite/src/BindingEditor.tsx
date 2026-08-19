import { useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  type DeviceView,
  type EditableBinding,
  type PendingEdit,
} from "./lib/api";
import { actionLabel, categoryLabel } from "./lib/actionLabels";
import {
  controlLabel,
  controlsFor,
  devicePrefix,
  type ControlOption,
} from "./lib/controls";
import {
  build,
  captureErrorMessage,
  fromKeyPress,
  modifierOf,
  type CaptureResult,
} from "./lib/keyboard";
import BackupPanel from "./BackupPanel";
import { capturedToken, useCapture, type CaptureFeed } from "./useCapture";

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

  // Session de capture unique, partagée par la mise en évidence et le
  // sélecteur. Elle reste ouverte tant que l'onglet d'édition est affiché.
  const capture = useCapture(devices, true);
  const activeToken = capturedToken(capture.last, devices, (d) =>
    devicePrefix(devices, d),
  );

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

      <LiveProbe
        capture={capture}
        token={activeToken}
        devices={devices}
        matches={
          activeToken
            ? bindings.filter((b) => b.input_raw === activeToken).length
            : 0
        }
      />

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
                    // Une assignation dont le contrôle est actionné en ce
                    // moment même : c'est le lien direct entre le geste et la
                    // ligne du fichier.
                    live={activeToken !== null && b.input_raw === activeToken}
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

/**
 * Bandeau de sonde.
 *
 * Actionner un contrôle éclaire les assignations correspondantes. C'est le
 * moyen le plus direct de répondre à la question que se pose tout joueur
 * devant une configuration héritée : « ce bouton, il sert à quoi ? »
 */
function LiveProbe({
  capture,
  token,
  devices,
  matches,
}: {
  capture: CaptureFeed;
  token: string | null;
  devices: DeviceView[];
  matches: number;
}) {
  const device = capture.last
    ? devices.find((d) => d.instance_guid === capture.last!.guid)
    : undefined;

  return (
    <div
      className={
        "rounded-lg border p-4 " +
        (token
          ? "border-accent-500 bg-accent-50"
          : "border-ink-200 bg-white")
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink-900">
          Identifier une commande
        </h3>
        <span className="text-xs text-ink-500">
          {capture.error
            ? "à l'arrêt"
            : capture.listening
              ? `${devices.length} périphérique${devices.length > 1 ? "s" : ""} à l'écoute`
              : "ouverture…"}
        </span>
      </div>

      {capture.error ? (
        <p className="mt-2 text-sm text-warn-700">{capture.error}</p>
      ) : token && capture.last && device ? (
        <div className="mt-2">
          <p className="text-sm text-ink-700">
            <span className="font-medium text-accent-700">
              {devicePrefix(devices, device)}
            </span>{" "}
            — {device.product_name || device.instance_name} ·{" "}
            {controlLabel(capture.last.control)}
            <span className="technical ml-2 text-ink-500">{token}</span>
          </p>
          <p className="mt-1 text-sm text-ink-600">
            {matches === 0
              ? "Aucune commande de déplacement n'utilise ce contrôle."
              : `${matches} commande${matches > 1 ? "s" : ""} en surbrillance ci-dessous.`}
          </p>
          <button
            onClick={capture.reset}
            className="mt-2 text-xs font-medium text-accent-700 hover:text-accent-600"
          >
            Effacer
          </button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-ink-500">
          Actionnez un bouton, un axe ou une touche&nbsp;: les commandes qui
          l'utilisent s'éclairent dans la liste.
        </p>
      )}
    </div>
  );
}

function BindingRow({
  binding,
  pending,
  hasPending,
  live,
  onEdit,
  onClear,
  onRevert,
  onLockedClick,
}: {
  binding: EditableBinding;
  pending: string | null | undefined;
  hasPending: boolean;
  live: boolean;
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
        // La sonde prime sur la modification en attente : c'est un retour
        // immédiat au geste de l'utilisateur.
        (live
          ? "bg-accent-100 ring-1 ring-inset ring-accent-500"
          : hasPending
            ? "bg-accent-50/60"
            : "")
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

  // On ouvre sur le manche dès qu'il y en a un : c'est le périphérique que
  // vient configurer l'écrasante majorité des utilisateurs de ce logiciel.
  const [source, setSource] = useState<Source>(
    joysticks.length > 0 ? "joystick" : "keyboard",
  );

  return (
    <Modal onCancel={onCancel} title={actionLabel(binding.action)}>
      <div className="mb-4 flex gap-1 border-b border-ink-200">
        <SourceTab
          active={source === "keyboard"}
          onClick={() => setSource("keyboard")}
        >
          Clavier
        </SourceTab>
        <SourceTab
          active={source === "joystick"}
          onClick={() => setSource("joystick")}
          count={joysticks.length}
        >
          Manche
        </SourceTab>
        <SourceTab
          active={source === "gamepad"}
          onClick={() => setSource("gamepad")}
          count={gamepads.length}
        >
          Manette
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
  // Un onglet sans périphérique reste visible mais inerte : le masquer
  // laisserait croire que le mode n'existe pas.
  const empty = count === 0;
  return (
    <button
      onClick={onClick}
      disabled={empty}
      title={empty ? "Aucun périphérique de ce type détecté" : undefined}
      className={
        "-mb-px border-b-2 px-3 py-1.5 text-sm font-medium " +
        (empty
          ? "cursor-not-allowed border-transparent text-ink-300"
          : active
            ? "border-accent-600 text-accent-700"
            : "border-transparent text-ink-500 hover:text-ink-800")
      }
    >
      {children}
      {count !== undefined && count > 1 && (
        <span className="ml-1 text-xs text-ink-400">({count})</span>
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
        setHint(captureErrorMessage(result.error));
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

  return (
    <div className="space-y-4">
      <div
        className={
          "rounded-lg border-2 border-dashed px-4 py-8 text-center " +
          (captured
            ? "border-accent-500 bg-accent-50"
            : "border-ink-300 bg-ink-50")
        }
      >
        {captured ? (
          <>
            <p className="text-lg font-medium text-accent-700">
              {captured.label}
            </p>
            <p className="technical mt-1 text-ink-500">{captured.token}</p>
          </>
        ) : (
          <p className="text-sm text-ink-500">
            Appuyez sur la touche ou la combinaison souhaitée.
          </p>
        )}
      </div>

      {hint && <p className="text-sm text-warn-700">{hint}</p>}

      <p className="text-xs text-ink-500">
        Une touche modificatrice seule — Maj, Ctrl, Alt — est retenue quand vous
        la relâchez. La position physique de la touche est enregistrée, pas le
        caractère imprimé&nbsp;: c'est ainsi que Star Citizen raisonne.
      </p>

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md border border-ink-300 bg-white px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-50"
        >
          Annuler
        </button>
        <button
          disabled={!captured}
          onClick={() => captured && onPick(captured.token)}
          className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-ink-300"
        >
          Appliquer
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
  const options: ControlOption[] = manualDevice ? controlsFor(manualDevice) : [];
  const groups = useMemo(() => {
    const map = new Map<string, ControlOption[]>();
    for (const o of options) {
      const list = map.get(o.group);
      if (list) list.push(o);
      else map.set(o.group, [o]);
    }
    return [...map.entries()];
  }, [options]);

  if (family.length === 0) {
    return (
      <p className="text-sm text-ink-600">
        Aucun périphérique de ce type détecté. Branchez-le&nbsp;: il apparaîtra
        en quelques secondes, sans redémarrer l'application.
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
            <span className="text-xs font-medium text-ink-600">
              Périphérique
            </span>
            <select
              className="mt-1 w-full rounded-md border border-ink-300 bg-white px-3 py-1.5 text-sm"
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
        </>
      ) : (
        <div
          className={
            "rounded-lg border-2 border-dashed px-4 py-8 text-center " +
            (captured
              ? "border-accent-500 bg-accent-50"
              : "border-ink-300 bg-ink-50")
          }
        >
          {captured && capturedDevice ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-accent-700">
                {devicePrefix(allDevices, capturedDevice)} —{" "}
                {capturedDevice.product_name || capturedDevice.instance_name}
              </p>
              <p className="mt-1 text-lg font-medium text-accent-700">
                {controlLabel(captured.control)}
              </p>
              <p className="technical mt-1 text-ink-500">{token}</p>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-500">
                Actionnez le bouton, l'axe ou le chapeau souhaité.
              </p>
              <p className="mt-1 text-xs text-ink-400">
                {!capture.listening
                  ? "Ouverture de la session…"
                  : family.length > 1
                    ? `${family.length} périphériques à l'écoute — celui que vous actionnez sera reconnu.`
                    : "Périphérique à l'écoute."}
              </p>
            </>
          )}
        </div>
      )}

      {capture.error && (
        <p className="text-sm text-warn-700">{capture.error}</p>
      )}

      <button
        onClick={() => {
          setManual((v) => !v);
          setControl("");
          capture.reset();
        }}
        className="text-sm font-medium text-accent-700 hover:text-accent-600"
      >
        {manual ? "Revenir à la capture" : "Choisir dans une liste à la place"}
      </button>

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="rounded-md border border-ink-300 bg-white px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-50"
        >
          Annuler
        </button>
        <button
          disabled={!token}
          onClick={() => token && onPick(token)}
          className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-ink-300"
        >
          Appliquer
        </button>
      </div>
    </div>
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
