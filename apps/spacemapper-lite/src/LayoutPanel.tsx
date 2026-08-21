import { useCallback, useEffect, useState } from "react";
import {
  api,
  type ExpectedDevice,
  type LayoutFile,
  type LayoutInspection,
} from "./lib/api";
import { categoryLabel } from "./lib/actionLabels";
import { useT } from "./lib/i18nContext";
import UpgradeLink from "./UpgradeLink";

/**
 * Inspection des profils partagés par la communauté.
 *
 * Star Citizen sait charger ces fichiers mais n'en montre rien avant de les
 * appliquer : on installe le travail d'un inconnu à l'aveugle. Ce panneau
 * répond aux deux questions qu'on se pose avant — **qu'est-ce que ça fait**,
 * et **est-ce que ça correspond à mon matériel**.
 *
 * Lecture seule. Appliquer un profil, ou l'adapter à un autre ordre de
 * périphériques, relève de l'édition Premium.
 */
export default function LayoutPanel({
  profilePath,
}: {
  profilePath: string | null;
}) {
  const t = useT();
  const [files, setFiles] = useState<LayoutFile[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<LayoutInspection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profilePath) return;
    try {
      const found = await api.listLayouts(profilePath);
      setFiles(found);
      setError(null);
      // Un seul profil : l'ouvrir d'emblée épargne un clic sans rien masquer.
      if (found.length === 1) setSelected(found[0]!.path);
    } catch (e) {
      setError(String(e));
    }
  }, [profilePath]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    void api
      .inspectLayout(selected)
      .then((d) => !cancelled && setDetail(d))
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  if (!profilePath) {
    return <Empty>{t("layout.noProfile")}</Empty>;
  }

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          {t("layout.title")}
        </h2>
        <p className="mt-0.5 max-w-2xl text-xs text-[var(--text-tertiary)]">
          {t("layout.hint")}
        </p>
      </header>

      {error && (
        <p className="rounded-[var(--radius-control)] border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger-text)]">
          {error}
        </p>
      )}

      {files.length === 0 ? (
        <Empty>{t("layout.empty")}</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <ul className="divide-y divide-[var(--border-subtle)] self-start overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)]">
            {files.map((f) => (
              <li key={f.path}>
                <button
                  onClick={() => setSelected(f.path)}
                  className={
                    "w-full border-l-2 px-3 py-2 text-left transition-colors " +
                    (selected === f.path
                      ? "border-[var(--border-accent)] bg-[var(--accent-soft)]"
                      : "border-transparent hover:bg-[var(--surface-hover)]")
                  }
                >
                  <span className="block truncate text-sm text-[var(--text-primary)]">
                    {f.label ?? f.file_name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--text-disabled)]">
                    {f.bindings} {t("layout.bindings")}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {detail ? (
            <Inspection detail={detail} />
          ) : (
            <Empty>{t("layout.pick")}</Empty>
          )}
        </div>
      )}
    </div>
  );
}

function Inspection({ detail }: { detail: LayoutInspection }) {
  const t = useT();

  // Ce que l'édition Lite ne saurait pas reproduire. Le dire avant que
  // l'utilisateur ne le découvre bouton par bouton.
  const advanced =
    detail.with_modifier + detail.with_activation_mode + detail.with_multi_tap;

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          {detail.label ?? detail.file_name}
        </h3>
        {detail.description && (
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{detail.description}</p>
        )}
        <p className="technical mt-1 truncate text-[var(--text-disabled)]">
          {detail.file_name}
        </p>

        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t("layout.bindings")} value={detail.bindings} />
          <Stat
            label={t("layout.categories")}
            value={detail.categories.length}
          />
          <Stat
            label={t("layout.advanced")}
            value={advanced}
            tone={advanced > 0 ? "accent" : undefined}
          />
          <Stat
            label={t("layout.corrupt")}
            value={detail.corrupt}
            tone={detail.corrupt > 0 ? "warn" : undefined}
          />
        </dl>
      </section>

      <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)]">
        <div className="border-b border-[var(--border-subtle)] px-4 py-2.5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {t("layout.expects")}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{t("layout.expectsHint")}</p>
        </div>
        <ul className="divide-y divide-[var(--border-subtle)]">
          {detail.expected_devices.map((d) => (
            <DeviceRow key={d.slot} device={d} />
          ))}
        </ul>
      </section>

      {advanced > 0 && (
        <section className="rounded-[var(--radius-card)] border border-[var(--border-accent)] bg-[var(--accent-soft)] px-4 py-3">
          <h3 className="text-sm font-semibold text-[var(--text-accent)]">
            {t("layout.premiumTitle")}
          </h3>
          <p className="mt-1 text-xs text-[var(--text-accent)]">
            {t("layout.premiumBody")}
          </p>
          <ul className="mt-2 space-y-0.5 text-xs text-[var(--text-accent)]">
            {detail.with_modifier > 0 && (
              <li>
                {detail.with_modifier} {t("layout.withModifier")}
              </li>
            )}
            {detail.with_activation_mode > 0 && (
              <li>
                {detail.with_activation_mode} {t("layout.withActivation")}
              </li>
            )}
            {detail.with_multi_tap > 0 && (
              <li>
                {detail.with_multi_tap} {t("layout.withMultiTap")}
              </li>
            )}
          </ul>
          <UpgradeLink />
        </section>
      )}

      <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)]">
        <h3 className="border-b border-[var(--border-subtle)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)]">
          {t("layout.categories")}
        </h3>
        <ul className="divide-y divide-[var(--border-subtle)]">
          {detail.categories.map((c) => (
            <li
              key={c.actionmap}
              className="flex items-baseline justify-between gap-3 px-4 py-1.5"
            >
              <span className="truncate text-sm text-[var(--text-primary)]">
                {categoryLabel(c.actionmap)}
              </span>
              <span className="tabular-nums text-xs text-[var(--text-disabled)]">
                {c.bindings}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/**
 * Une ligne de périphérique attendu.
 *
 * Le cas à zéro exemplaire est un avertissement — le profil vise du matériel
 * absent. Le cas à plusieurs est le piège HOSAS : deux manches identiques
 * partagent un identifiant, et rien ne dit lequel l'auteur tenait à droite.
 */
function DeviceRow({ device }: { device: ExpectedDevice }) {
  const t = useT();
  const missing = device.matching_devices === 0;
  const ambiguous = device.matching_devices > 1;

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
      <span className="min-w-0">
        <span className="font-mono text-sm font-semibold text-[var(--text-accent)]">
          {device.slot}
        </span>
        <span className="ml-2 text-sm text-[var(--text-primary)]">
          {device.product_name ?? t("layout.unnamedDevice")}
        </span>
        <span className="mt-0.5 block text-xs text-[var(--text-disabled)]">
          {device.bindings} {t("layout.bindings")}
        </span>
      </span>

      <span
        className={
          "shrink-0 rounded px-2 py-0.5 text-xs font-medium " +
          (missing
            ? "bg-[var(--danger-soft)] text-[var(--danger-text)]"
            : ambiguous
              ? "bg-[var(--surface-2)] text-[var(--text-secondary)]"
              : "bg-[var(--accent-soft)] text-[var(--text-accent)]")
        }
      >
        {missing
          ? t("layout.deviceMissing")
          : ambiguous
            ? `${device.matching_devices} × ${t("layout.deviceAmbiguous")}`
            : t("layout.devicePresent")}
      </span>
    </li>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "accent" | "warn";
}) {
  const colour =
    tone === "warn"
      ? "text-[var(--danger-text)]"
      : tone === "accent"
        ? "text-[var(--text-accent)]"
        : "text-[var(--text-primary)]";
  return (
    <div>
      <dt className="text-xs text-[var(--text-tertiary)]">{label}</dt>
      <dd className={`text-lg font-semibold tabular-nums ${colour}`}>
        {value}
      </dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-10 text-center text-sm text-[var(--text-tertiary)]">
      {children}
    </p>
  );
}
