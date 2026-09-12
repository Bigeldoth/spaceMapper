import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  type DeviceView,
  type Diagnosis,
  type Finding,
  type LiveDevice,
  type SlotUsage,
} from "@spacemapper/app-core";
import { useT } from "@spacemapper/app-core";
import { useCapture } from "@spacemapper/app-core";
import UpgradeLink from "./UpgradeLink";

/** Durée d'allumage d'une ligne après le dernier mouvement détecté. */
const HIGHLIGHT_MS = 1200;

/**
 * Correspondance entre le profil et le matériel branché.
 *
 * C'est le diagnostic que le jeu ne donne nulle part : rien, dans son
 * interface, ne dit à quel manche `js1_` s'adresse ni pourquoi les commandes
 * changent de manche après un rebranchement. Lite le **constate** ; la
 * renumérotation relève de l'édition Premium.
 *
 * Le panneau écoute les périphériques en permanence : bouger un manche allume
 * sa ligne. C'est la **seule** façon fiable d'associer un rang à un exemplaire
 * physique quand deux manches identiques partagent le même identifiant — le
 * matériel ne sait pas les distinguer, l'utilisateur si.
 */
export default function DiagnosisPanel({
  profilePath,
  devices,
}: {
  profilePath: string | null;
  devices: DeviceView[];
}) {
  const t = useT();
  const [diagnosis, setDiagnosis] = useState<{ path: string; value: Diagnosis } | null>(null);
  const [failure, setFailure] = useState<{ path: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useActuatedDevice(devices);
  const deviceSignature = devices.map((device) =>
    `${device.instance_guid}:${device.product_name}:${device.instance_name}:${device.category}:${device.axes}:${device.buttons}:${device.povs}`,
  ).join("|");
  const requestKey = JSON.stringify([profilePath, deviceSignature]);
  const desired = useRef({ path: profilePath, key: requestKey });
  desired.current = { path: profilePath, key: requestKey };
  const inFlight = useRef(false);
  const mounted = useRef(false);
  // Un rapport du profil précédent ne doit jamais être présenté comme celui
  // du nouveau profil pendant que le diagnostic natif attend le matériel.
  const report = diagnosis?.path === profilePath ? diagnosis.value : null;
  const error = failure?.path === profilePath ? failure.message : null;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const load = useCallback(async (): Promise<void> => {
    const target = desired.current;
    if (!target.path || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailure(null);
    try {
      const value = await api.diagnoseDevices(target.path);
      if (mounted.current && desired.current.key === target.key) {
        setDiagnosis({ path: target.path, value });
      }
    } catch (reason) {
      if (mounted.current && desired.current.key === target.key) {
        setFailure({ path: target.path, message: String(reason) });
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        // Coalescer seulement un changement réel survenu pendant le scan.
        // Une erreur seule ne déclenche aucune nouvelle tentative automatique.
        if (desired.current.path && desired.current.key !== target.key) void load();
        else setBusy(false);
      }
    }
  }, []);

  useEffect(() => { void load(); }, [load, requestKey]);

  if (!profilePath) {
    return (
      <p className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-6 text-center text-sm text-[var(--text-tertiary)]">
        {t("diag.noProfile")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <header className="app-page-header">
        <div className="min-w-0">
          <h2 className="app-page-title">
            {t("diag.title")}
          </h2>
          <p className="app-page-description">
            {t("diag.hint")}
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={busy}
          className="shrink-0 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:text-[var(--text-disabled)]"
        >
          {t("diag.refresh")}
        </button>
      </header>

      {busy && <p role="status" className="text-sm text-[var(--text-tertiary)]">{t("diag.loading")}</p>}

      {error && (
        <p role="alert" className="rounded-[var(--radius-card)] border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger-text)]">
          {error}
        </p>
      )}

      {report && (
        <>
          <Findings findings={report.findings} />
          <div className="grid gap-4 lg:grid-cols-2">
            <LiveList devices={report.live} active={active} />
            <div className="space-y-4">
              <SlotList slots={report.slots} />
              <DeclaredList report={report} />
            </div>
          </div>
          <PremiumNote />
        </>
      )}
    </div>
  );
}

/** Le périphérique actionné à l'instant, et le contrôle qui l'a signalé. */
interface Actuated {
  guid: string;
  control: string;
  /** Session ouverte : distingue « rien ne bouge » de « on n'écoute pas ». */
  listening: boolean;
  error: string | null;
}

/**
 * Suit le périphérique en cours d'utilisation.
 *
 * La capture ne s'arrête jamais tant que l'onglet est affiché : ici, on ne
 * cherche pas *un* appui à retenir, mais un signal permanent qui suit la main
 * de l'utilisateur.
 */
function useActuatedDevice(devices: DeviceView[]): Actuated {
  const { last, listening, error, reset } = useCapture(devices, true);
  const [seen, setSeen] = useState<{ guid: string; control: string } | null>(
    null,
  );

  useEffect(() => {
    if (!last) return;
    setSeen({ guid: last.guid, control: last.control });
    // On efface aussitôt côté Rust : sans cela le thread conserve son relevé
    // et la ligne resterait allumée après l'arrêt du mouvement.
    reset();
    // `reset` change d'identité à chaque rendu ; l'inclure bouclerait.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last]);

  // L'extinction est un délai glissant : tant que le manche bouge, chaque
  // relevé repousse l'échéance et la ligne reste allumée.
  useEffect(() => {
    if (!seen) return;
    const timer = window.setTimeout(() => setSeen(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [seen]);

  if (error) return { guid: "", control: "", listening: false, error };
  if (!seen) return { guid: "", control: "", listening, error: null };
  return { ...seen, listening, error: null };
}

function Findings({ findings }: { findings: Finding[] }) {
  const t = useT();

  if (findings.length === 0) {
    return (
      <p className="rounded-[var(--radius-card)] border border-[var(--border-accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--text-accent)]">
        {t("diag.noFindings")}
      </p>
    );
  }

  return (
    <section className="app-panel app-panel--hud overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)]">
      <h3 className="border-b border-[var(--border-subtle)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)]">
        {t("diag.findingsTitle")}
      </h3>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {findings.map((f, i) => (
          <FindingRow key={i} finding={f} />
        ))}
      </ul>
    </section>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  const t = useT();
  const { title, detail, subject } = describe(finding, t);

  return (
    <li className="px-4 py-3">
      <p className="text-sm font-medium text-[var(--text-primary)]">
        {title}
        {subject && (
          <span className="ml-2 rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-xs font-normal text-[var(--text-secondary)]">
            {subject}
          </span>
        )}
      </p>
      {detail && <p className="mt-1 text-xs text-[var(--text-tertiary)]">{detail}</p>}
    </li>
  );
}

/**
 * Rend un constat en texte. Le `switch` est exhaustif : ajouter une variante
 * côté Rust sans l'afficher ici devient une erreur de compilation.
 */
function describe(
  finding: Finding,
  t: ReturnType<typeof useT>,
): { title: string; detail?: string; subject?: string } {
  switch (finding.kind) {
    case "anonymous_slots":
      return {
        title: t("diag.anonymousSlots"),
        detail: t("diag.anonymousSlotsDetail"),
        subject: finding.instances.map((i) => `js${i}`).join(", "),
      };
    case "ambiguous_model":
      return {
        title: t("diag.ambiguousModel"),
        detail: t("diag.ambiguousModelDetail"),
        subject: `${finding.count} × ${finding.product_name}`,
      };
    case "declared_but_absent":
      return {
        title: t("diag.declaredButAbsent"),
        detail: t("diag.declaredButAbsentDetail"),
        subject: finding.name,
      };
    case "plugged_but_unused":
      return { title: t("diag.pluggedButUnused"), subject: finding.name };
    case "more_slots_than_devices":
      return {
        title: t("diag.moreSlotsThanDevices"),
        subject: `${finding.slots} / ${finding.devices}`,
      };
    case "corrupt_bindings":
      return {
        title: t("diag.corruptBindings"),
        detail: t("diag.corruptBindingsDetail"),
        subject: String(finding.count),
      };
  }
}

function LiveList({
  devices,
  active,
}: {
  devices: LiveDevice[];
  active: Actuated;
}) {
  const t = useT();

  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)]">
      <div className="border-b border-[var(--border-subtle)] px-4 py-2.5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          {t("diag.liveTitle")}
        </h3>
        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{t("diag.rankHint")}</p>
        <ListeningBadge active={active} />
      </div>
      {devices.length === 0 && (
        <p className="px-4 py-6 text-center text-sm text-[var(--text-tertiary)]">
          {t("devices.empty")}
        </p>
      )}
      <ul className="divide-y divide-[var(--border-subtle)]">
        {devices.map((d) => {
          const lit = active.guid === d.instance_guid;
          return (
            <li
              key={d.instance_guid}
              // La transition est volontairement asymétrique : l'allumage est
              // instantané pour que le geste réponde, l'extinction est douce
              // pour qu'on ait le temps de lire quelle ligne s'est allumée.
              className={
                "px-4 py-3 transition-colors duration-500 " +
                (lit
                  ? "bg-[var(--accent-soft)] ring-2 ring-inset ring-[var(--border-accent)] duration-0"
                  : "")
              }
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-sm font-semibold text-[var(--text-accent)]">
                  {d.category === "gamepad" ? "gp" : "js"}
                  {d.rank}
                </span>
                {lit ? (
                  <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-xs text-white">
                    {active.control}
                  </span>
                ) : (
                  <span
                    className={
                      d.declared_in_file
                        ? "text-xs text-[var(--text-accent)]"
                        : "text-xs text-[var(--text-disabled)]"
                    }
                  >
                    {d.declared_in_file
                      ? t("diag.matched")
                      : t("diag.unmatched")}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-[var(--text-primary)]">{d.instance_name}</p>
              <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                {d.axes} {t("devices.axes")} · {d.buttons} {t("devices.buttons")}{" "}
                · {d.povs} {t("devices.hats")}
              </p>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-[var(--text-disabled)]">
                {t("diag.guidProduct")} {d.product_guid}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** État de l'écoute, pour que le silence ne soit jamais ambigu. */
function ListeningBadge({ active }: { active: Actuated }) {
  const t = useT();

  if (active.error) {
    return (
      <p className="mt-2 text-xs text-[var(--danger-text)]">
        {t("diag.captureFailed")} {active.error}
      </p>
    );
  }
  if (!active.listening) {
    return <p className="mt-2 text-xs text-[var(--text-disabled)]">{t("diag.notListening")}</p>;
  }
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-accent)]">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent-line)]" />
      {t("diag.wiggleHint")}
    </p>
  );
}

function SlotList({ slots }: { slots: SlotUsage[] }) {
  const t = useT();

  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)]">
      <h3 className="border-b border-[var(--border-subtle)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)]">
        {t("diag.slotsTitle")}
      </h3>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {slots.map((s) => (
          <li
            key={s.instance}
            className="flex items-baseline justify-between gap-3 px-4 py-2.5"
          >
            <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
              js{s.instance}
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">
              {s.bindings} {t("diag.slotBindings")} ·{" "}
              <span className={s.named ? "text-[var(--text-tertiary)]" : "text-[var(--danger-text)]"}>
                {s.named ? t("diag.slotNamed") : t("diag.slotAnonymous")}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DeclaredList({ report }: { report: Diagnosis }) {
  const t = useT();

  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)]">
      <h3 className="border-b border-[var(--border-subtle)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)]">
        {t("diag.declaredTitle")}
      </h3>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {report.declared.map((d, i) => (
          <li key={`${d.guid}-${i}`} className="px-4 py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-[var(--text-primary)]">{d.name}</span>
              <span
                className={
                  d.matching_devices > 0
                    ? "text-xs text-[var(--text-accent)]"
                    : "text-xs text-[var(--danger-text)]"
                }
              >
                {d.matching_devices > 0
                  ? `${d.matching_devices} ×`
                  : t("diag.unmatched")}
              </span>
            </div>
            {d.guid && (
              <p className="mt-0.5 font-mono text-[11px] text-[var(--text-disabled)]">
                {d.guid}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PremiumNote() {
  const t = useT();
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border-accent)] bg-[var(--accent-soft)] px-4 py-3">
      <h3 className="text-sm font-semibold text-[var(--text-accent)]">
        {t("diag.premiumTitle")}
      </h3>
      <p className="mt-1 text-xs text-[var(--text-accent)]">{t("diag.premiumBody")}</p>
      <UpgradeLink />
    </section>
  );
}
