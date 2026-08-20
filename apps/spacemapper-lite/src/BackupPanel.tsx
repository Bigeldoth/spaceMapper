import { useEffect, useState } from "react";
import { api, type BackupView } from "./lib/api";
import { useT } from "./lib/i18nContext";

/**
 * Points de restauration.
 *
 * Les sauvegardes sont créées à la demande, jamais automatiquement. Ce panneau
 * est donc le seul endroit d'où l'utilisateur peut se constituer un filet — et
 * c'est pour cela qu'il est affiché au-dessus de l'éditeur plutôt que relégué
 * dans un réglage.
 */
export default function BackupPanel({
  profilePath,
  onRestored,
}: {
  profilePath: string;
  onRestored: () => void;
}) {
  const t = useT();
  const [backups, setBackups] = useState<BackupView[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Une seule confirmation à la fois, restauration comme suppression. */
  const [confirming, setConfirming] = useState<{
    backup: BackupView;
    action: "restore" | "delete";
  } | null>(null);

  async function reload() {
    try {
      setBackups(await api.listBackups());
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setBusy(true);
    try {
      await api.createBackup(profilePath);
      setStatus(t("backup.title"));
      setError(null);
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function restore(backup: BackupView) {
    setBusy(true);
    setConfirming(null);
    try {
      await api.restoreBackup(profilePath, backup.path);
      setStatus(formatTimestamp(backup.timestamp));
      setError(null);
      await reload();
      onRestored();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(backup: BackupView) {
    setBusy(true);
    setConfirming(null);
    try {
      await api.deleteBackup(backup.path);
      setStatus(t("backup.deleted"));
      setError(null);
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-ink-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-900">
            {t("backup.title")}
          </h3>
          <p className="mt-0.5 text-xs text-ink-500">{t("backup.hint")}</p>
        </div>
        <button
          onClick={() => void save()}
          disabled={busy}
          className="shrink-0 rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700 disabled:bg-ink-300"
        >
          {t("backup.create")}
        </button>
      </div>

      {status && (
        <p className="border-b border-ink-100 bg-accent-50 px-4 py-2 text-sm text-accent-700">
          {status}
        </p>
      )}
      {error && (
        <p className="border-b border-ink-100 bg-warn-50 px-4 py-2 text-sm text-warn-700">
          {error}
        </p>
      )}

      {backups.length === 0 ? (
        <p className="px-4 py-5 text-center text-sm text-ink-500">
          {t("backup.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {backups.map((b) => (
            <li
              key={b.path}
              className="flex items-center justify-between gap-4 px-4 py-2.5"
            >
              <span className="text-sm text-ink-700">
                {formatTimestamp(b.timestamp)}
              </span>
              <span className="flex shrink-0 gap-2">
                <button
                  onClick={() => setConfirming({ backup: b, action: "restore" })}
                  disabled={busy}
                  className="rounded-md border border-ink-300 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:text-ink-400"
                >
                  {t("backup.restore")}
                </button>
                {/* Discret face à « Restaurer » : supprimer est irréversible,
                    ce n'est pas l'action qu'on veut cliquer par réflexe. */}
                <button
                  onClick={() => setConfirming({ backup: b, action: "delete" })}
                  disabled={busy}
                  className="rounded-md px-2.5 py-1 text-xs font-medium text-ink-500 hover:bg-warn-50 hover:text-warn-700 disabled:text-ink-300"
                >
                  {t("backup.delete")}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {confirming && (
        <Confirm
          backup={confirming.backup}
          action={confirming.action}
          onCancel={() => setConfirming(null)}
          onConfirm={() =>
            void (confirming.action === "restore"
              ? restore(confirming.backup)
              : remove(confirming.backup))
          }
        />
      )}
    </div>
  );
}

/**
 * Confirmation commune à la restauration et à la suppression.
 *
 * Les deux méritent une confirmation, mais pas le même ton : restaurer se
 * défait en restaurant autre chose, supprimer ne se défait pas. Seul le second
 * porte donc l'habillage d'alerte.
 */
function Confirm({
  backup,
  action,
  onCancel,
  onConfirm,
}: {
  backup: BackupView;
  action: "restore" | "delete";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  const destructive = action === "delete";

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-ink-900/30 p-8"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-lg border border-ink-200 bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-ink-900">
          {t(destructive ? "backup.confirmDeleteTitle" : "backup.confirmTitle")}
        </h3>
        <p className="mt-2 text-sm text-ink-600">
          {formatTimestamp(backup.timestamp)}
        </p>
        <p
          className={
            "mt-2 text-sm " + (destructive ? "text-warn-700" : "text-ink-500")
          }
        >
          {t(destructive ? "backup.confirmDeleteBody" : "backup.confirmKept")}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-ink-300 bg-white px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-50"
          >
            {t("save.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className={
              "rounded-md px-3 py-1.5 text-sm font-medium text-white " +
              (destructive
                ? "bg-warn-600 hover:bg-warn-700"
                : "bg-accent-600 hover:bg-accent-700")
            }
          >
            {t(destructive ? "backup.delete" : "backup.restore")}
          </button>
        </div>
      </div>
    </div>
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
