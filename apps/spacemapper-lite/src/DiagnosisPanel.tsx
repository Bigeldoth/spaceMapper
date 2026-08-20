import { useCallback, useEffect, useState } from "react";
import {
  api,
  type DeviceView,
  type Diagnosis,
  type Finding,
  type LiveDevice,
  type SlotUsage,
} from "./lib/api";
import { useT } from "./lib/i18nContext";
import { useCapture } from "./useCapture";

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
  const [report, setReport] = useState<Diagnosis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useActuatedDevice(devices);

  const load = useCallback(async () => {
    if (!profilePath) {
      setReport(null);
      return;
    }
    setBusy(true);
    try {
      setReport(await api.diagnoseDevices(profilePath));
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, [profilePath]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!profilePath) {
    return (
      <p className="rounded-lg border border-ink-200 bg-white px-4 py-6 text-center text-sm text-ink-500">
        {t("diag.noProfile")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-900">
            {t("diag.title")}
          </h2>
          <p className="mt-0.5 max-w-2xl text-xs text-ink-500">
            {t("diag.hint")}
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={busy}
          className="shrink-0 rounded-md border border-ink-300 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:text-ink-400"
        >
          {t("diag.refresh")}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-warn-200 bg-warn-50 px-4 py-3 text-sm text-warn-700">
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
      <p className="rounded-lg border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-700">
        {t("diag.noFindings")}
      </p>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-ink-200 bg-white">
      <h3 className="border-b border-ink-100 px-4 py-2.5 text-sm font-semibold text-ink-900">
        {t("diag.findingsTitle")}
      </h3>
      <ul className="divide-y divide-ink-100">
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
      <p className="text-sm font-medium text-ink-800">
        {title}
        {subject && (
          <span className="ml-2 rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs font-normal text-ink-600">
            {subject}
          </span>
        )}
      </p>
      {detail && <p className="mt-1 text-xs text-ink-500">{detail}</p>}
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
    <section className="overflow-hidden rounded-lg border border-ink-200 bg-white">
      <div className="border-b border-ink-100 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-ink-900">
          {t("diag.liveTitle")}
        </h3>
        <p className="mt-0.5 text-xs text-ink-500">{t("diag.rankHint")}</p>
        <ListeningBadge active={active} />
      </div>
      <ul className="divide-y divide-ink-100">
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
                  ? "bg-accent-50 ring-2 ring-inset ring-accent-400 duration-0"
                  : "")
              }
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-sm font-semibold text-accent-700">
                  {d.category === "gamepad" ? "gp" : "js"}
                  {d.rank}
                </span>
                {lit ? (
                  <span className="rounded bg-accent-600 px-1.5 py-0.5 font-mono text-xs text-white">
                    {active.control}
                  </span>
                ) : (
                  <span
                    className={
                      d.declared_in_file
                        ? "text-xs text-accent-700"
                        : "text-xs text-ink-400"
                    }
                  >
                    {d.declared_in_file
                      ? t("diag.matched")
                      : t("diag.unmatched")}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-ink-800">{d.instance_name}</p>
              <p className="mt-0.5 text-xs text-ink-500">
                {d.axes} {t("devices.axes")} · {d.buttons} {t("devices.buttons")}{" "}
                · {d.povs} {t("devices.hats")}
              </p>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-ink-400">
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
      <p className="mt-2 text-xs text-warn-700">
        {t("diag.captureFailed")} {active.error}
      </p>
    );
  }
  if (!active.listening) {
    return <p className="mt-2 text-xs text-ink-400">{t("diag.notListening")}</p>;
  }
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs text-accent-700">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-500" />
      {t("diag.wiggleHint")}
    </p>
  );
}

function SlotList({ slots }: { slots: SlotUsage[] }) {
  const t = useT();

  return (
    <section className="overflow-hidden rounded-lg border border-ink-200 bg-white">
      <h3 className="border-b border-ink-100 px-4 py-2.5 text-sm font-semibold text-ink-900">
        {t("diag.slotsTitle")}
      </h3>
      <ul className="divide-y divide-ink-100">
        {slots.map((s) => (
          <li
            key={s.instance}
            className="flex items-baseline justify-between gap-3 px-4 py-2.5"
          >
            <span className="font-mono text-sm font-semibold text-ink-800">
              js{s.instance}
            </span>
            <span className="text-xs text-ink-500">
              {s.bindings} {t("diag.slotBindings")} ·{" "}
              <span className={s.named ? "text-ink-500" : "text-warn-700"}>
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
    <section className="overflow-hidden rounded-lg border border-ink-200 bg-white">
      <h3 className="border-b border-ink-100 px-4 py-2.5 text-sm font-semibold text-ink-900">
        {t("diag.declaredTitle")}
      </h3>
      <ul className="divide-y divide-ink-100">
        {report.declared.map((d, i) => (
          <li key={`${d.guid}-${i}`} className="px-4 py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-ink-800">{d.name}</span>
              <span
                className={
                  d.matching_devices > 0
                    ? "text-xs text-accent-700"
                    : "text-xs text-warn-700"
                }
              >
                {d.matching_devices > 0
                  ? `${d.matching_devices} ×`
                  : t("diag.unmatched")}
              </span>
            </div>
            {d.guid && (
              <p className="mt-0.5 font-mono text-[11px] text-ink-400">
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
    <section className="rounded-lg border border-accent-200 bg-accent-50 px-4 py-3">
      <h3 className="text-sm font-semibold text-accent-800">
        {t("diag.premiumTitle")}
      </h3>
      <p className="mt-1 text-xs text-accent-700">{t("diag.premiumBody")}</p>
    </section>
  );
}
