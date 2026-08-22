import { useEffect, useRef, useState } from "react";
import { api, type BackupView } from "./lib/api";
import type { SetupMode } from "./lib/filter";
import type { CoreKey } from "./lib/keys";
import { useT } from "./lib/i18nContext";

/**
 * Barre d'outils de l'éditeur.
 *
 * Elle remplace trois panneaux qui occupaient en permanence le haut de
 * l'écran — points de restauration, sonde d'écoute, avertissement de périmètre.
 * Aucun n'a disparu : ils sont devenus un bouton, un voyant et une info-bulle.
 * Ce qu'on consulte une fois n'a pas à rester déplié.
 */
export default function EditorToolbar({
  profilePath,
  mode,
  onModeChange,
  listening,
  deviceCount,
  captureError,
  probe,
  onClearProbe,
  onRestored,
}: {
  profilePath: string;
  mode: SetupMode | "all";
  onModeChange: (mode: SetupMode | "all") => void;
  listening: boolean;
  deviceCount: number;
  captureError: string | null;
  /** Contrôle actionné à l'instant, s'il y en a un. */
  probe: { device: string; control: string; matches: number } | null;
  onClearProbe: () => void;
  onRestored: () => void;
}) {
  const t = useT();
  const [backups, setBackups] = useState<BackupView[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function reload() {
    try {
      setBackups(await api.listBackups());
    } catch {
      // Une liste illisible ne doit pas empêcher de sauvegarder.
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function createBackup() {
    setBusy(true);
    try {
      await api.createBackup(profilePath);
      setNote(t("backup.created"));
      await reload();
    } catch (e) {
      setNote(String(e));
    } finally {
      setBusy(false);
    }
  }

  const modes: { id: SetupMode | "all"; label: CoreKey }[] = [
    { id: "all", label: "filter.mode.all" },
    { id: "desk", label: "filter.mode.desk" },
    { id: "gamepad", label: "filter.mode.gamepad" },
    { id: "joystick", label: "filter.mode.joystick" },
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2">
        {/* Le mode n'est pas un filtre mais un contexte : « qu'est-ce que je
            configure ». Il précède donc la recherche et lui survit.
            Défilant horizontalement plutôt que replié : en fenêtre étroite on
            fait glisser, on ne perd pas de vue le mode actif.
            `overflow-y-hidden` : sans lui, `overflow-x-auto` seul hérite un
            `overflow-y: auto` (règle CSS dès qu'un axe n'est pas `visible`),
            et le débordement d'un pixel de la ligne affiche une barre de
            défilement verticale résiduelle, réduite à ses flèches. */}
        <div className="-mx-1 flex max-w-full items-center gap-1 overflow-x-auto overflow-y-hidden px-1">
          <span className="mr-1 shrink-0 text-xs font-medium text-[var(--text-tertiary)]">
            {t("filter.mode")}
          </span>
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => onModeChange(m.id)}
              className={
                "shrink-0 whitespace-nowrap rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-medium transition-colors " +
                (mode === m.id
                  ? "bg-accent text-white"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]")
              }
            >
              {t(m.label)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
          <Probe
            listening={listening}
            count={deviceCount}
            error={captureError}
            probe={probe}
            onClear={onClearProbe}
          />

          <div className="relative">
            <div className="flex items-center rounded-[var(--radius-control)] border border-[var(--border-default)]">
              <button
                onClick={() => void createBackup()}
                disabled={busy}
                className="rounded-l-md px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:text-[var(--text-disabled)]"
              >
                {t("backup.create")}
              </button>
              <button
                onClick={() => setOpen((v) => !v)}
                className="border-l border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                title={t("backup.title")}
              >
                {backups.length} ▾
              </button>
            </div>

            {open && (
              <BackupMenu
                profilePath={profilePath}
                backups={backups}
                onClose={() => setOpen(false)}
                onChanged={async () => {
                  await reload();
                  onRestored();
                }}
              />
            )}
          </div>

          <ScopeHint />
        </div>
      </div>

      {note && (
        <p className="rounded-[var(--radius-control)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs text-[var(--text-accent)]">
          {note}
        </p>
      )}
    </div>
  );
}

/**
 * Sonde d'identification, réduite à un voyant.
 *
 * Elle occupait un panneau entier ; elle tient dans une ligne. Au repos elle
 * dit seulement combien de périphériques sont écoutés. Dès qu'un contrôle est
 * actionné, elle affiche lequel et combien de commandes s'en servent — la
 * réponse à « ce bouton, il sert à quoi ? », qui reste la question la plus
 * fréquente devant une configuration héritée.
 */
function Probe({
  listening,
  count,
  error,
  probe,
  onClear,
}: {
  listening: boolean;
  count: number;
  error: string | null;
  probe: { device: string; control: string; matches: number } | null;
  onClear: () => void;
}) {
  const t = useT();

  if (error) {
    return (
      <span className="text-xs text-[var(--danger-text)]" title={error}>
        {t("probe.stopped")}
      </span>
    );
  }

  if (probe) {
    return (
      <span className="flex items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--accent-soft)] px-2 py-1 text-xs text-[var(--text-accent)]">
        <span className="font-mono font-semibold">{probe.device}</span>
        <span>{probe.control}</span>
        <span className="text-[var(--text-accent)]">·</span>
        <span>
          {probe.matches === 0
            ? t("probe.noMatch")
            : `${probe.matches} ${t(
                probe.matches > 1 ? "probe.matchMany" : "probe.matchOne",
              )}`}
        </span>
        <button
          onClick={onClear}
          className="ml-1 text-[var(--text-accent)] hover:text-[var(--accent-hover)]"
        >
          {t("probe.clear")}
        </button>
      </span>
    );
  }

  return (
    <span
      className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]"
      title={t("probe.idle")}
    >
      <span
        className={
          "inline-block h-1.5 w-1.5 rounded-full " +
          (listening ? "bg-[var(--accent-soft)]0" : "bg-[var(--border-default)]")
        }
      />
      {count} {t(count > 1 ? "probe.deviceMany" : "probe.deviceOne")}
    </span>
  );
}

/**
 * Périmètre de l'édition, en info-bulle.
 *
 * Le texte était un pavé permanent. On le lit une fois ; le garder déplié
 * revenait à répéter la même phrase à chaque ouverture.
 */
function ScopeHint() {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border-default)] text-xs text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]"
        title={t("scope.title")}
      >
        ?
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-80 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 shadow-[var(--shadow-2)]">
            <h4 className="text-xs font-semibold text-[var(--text-primary)]">
              {t("scope.title")}
            </h4>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{t("scope.editable")}</p>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">{t("scope.defaults")}</p>
            <p className="mt-2 text-xs text-[var(--danger-text)]">{t("scope.closeGame")}</p>
          </div>
        </>
      )}
    </div>
  );
}

/** Liste déroulante des points de restauration. */
function BackupMenu({
  profilePath,
  backups,
  onClose,
  onChanged,
}: {
  profilePath: string;
  backups: BackupView[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useT();
  const [confirming, setConfirming] = useState<{
    backup: BackupView;
    action: "restore" | "delete";
  } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  async function run() {
    if (!confirming) return;
    const { backup, action } = confirming;
    setConfirming(null);
    try {
      if (action === "restore") {
        await api.restoreBackup(profilePath, backup.path);
      } else {
        await api.deleteBackup(backup.path);
      }
      onChanged();
    } catch {
      // Le message d'échec remonte au prochain rechargement de la liste.
    }
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div
        ref={box}
        className="absolute right-0 z-20 mt-1 w-72 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] shadow-[var(--shadow-2)]"
      >
        <p className="border-b border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-tertiary)]">
          {t("backup.hint")}
        </p>

        {backups.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-[var(--text-tertiary)]">
            {t("backup.empty")}
          </p>
        ) : (
          <ul className="max-h-64 divide-y divide-[var(--border-subtle)] overflow-y-auto">
            {backups.map((b) => (
              <li key={b.path} className="px-3 py-2">
                <p className="text-xs text-[var(--text-primary)]">
                  {formatTimestamp(b.timestamp)}
                </p>
                <div className="mt-1 flex gap-2">
                  <button
                    onClick={() =>
                      setConfirming({ backup: b, action: "restore" })
                    }
                    className="text-xs font-medium text-[var(--text-accent)] hover:text-[var(--accent-hover)]"
                  >
                    {t("backup.restore")}
                  </button>
                  <button
                    onClick={() =>
                      setConfirming({ backup: b, action: "delete" })
                    }
                    className="text-xs text-[var(--text-tertiary)] hover:text-[var(--danger-text)]"
                  >
                    {t("backup.delete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirming && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[var(--scrim)] p-4 sm:p-8"
          onClick={() => setConfirming(null)}
        >
          <div
            className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-5 shadow-[var(--shadow-2)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {t(
                confirming.action === "delete"
                  ? "backup.confirmDeleteTitle"
                  : "backup.confirmTitle",
              )}
            </h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {formatTimestamp(confirming.backup.timestamp)}
            </p>
            <p
              className={
                "mt-2 text-sm " +
                (confirming.action === "delete"
                  ? "text-[var(--danger-text)]"
                  : "text-[var(--text-tertiary)]")
              }
            >
              {t(
                confirming.action === "delete"
                  ? "backup.confirmDeleteBody"
                  : "backup.confirmKept",
              )}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirming(null)}
                className="rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
              >
                {t("save.cancel")}
              </button>
              <button
                onClick={() => void run()}
                className={
                  "rounded-[var(--radius-control)] px-3 py-1.5 text-sm font-medium text-white " +
                  (confirming.action === "delete"
                    ? "bg-[var(--danger)] hover:bg-[var(--danger)]"
                    : "bg-accent hover:bg-[var(--accent-hover)]")
                }
              >
                {t(
                  confirming.action === "delete"
                    ? "backup.delete"
                    : "backup.restore",
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Le backend renvoie des millisecondes Unix sous forme de chaîne. */
function formatTimestamp(raw: string): string {
  const ms = Number(raw);
  if (!Number.isFinite(ms)) return raw;
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
