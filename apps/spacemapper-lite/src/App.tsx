import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  api,
  type BindingView,
  type BuildInfo,
  type DeviceView,
  type FlightBindings,
  type ProfileLocation,
} from "./lib/api";
import { actionLabel, categoryLabel, isKnownAction } from "./lib/actionLabels";
import { devicePrefix } from "./lib/controls";
import BindingEditor from "./BindingEditor";
import SettingsPanel from "./SettingsPanel";

const TIPEEE_URL = "https://fr.tipeee.com/padek-interactive";

type Tab = "overview" | "edit" | "settings";

export default function App() {
  const [devices, setDevices] = useState<DeviceView[]>([]);
  const [profiles, setProfiles] = useState<ProfileLocation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [bindings, setBindings] = useState<FlightBindings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [build, setBuild] = useState<BuildInfo | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  /** Incrémenté à chaque changement de réglage, pour reconstruire l'éditeur. */
  const [settingsRevision, setSettingsRevision] = useState(0);

  /**
   * Ré-énumération périodique.
   *
   * DirectInput ne prévient pas d'un branchement : sans ce rappel, un manche
   * branché après le démarrage resterait invisible jusqu'à un redémarrage de
   * l'application. On ne remplace la liste que si elle a réellement changé,
   * pour ne pas réinitialiser l'écran toutes les trois secondes.
   */
  useEffect(() => {
    const timer = window.setInterval(async () => {
      try {
        const found = await api.listDevices();
        setDevices((previous) => {
          const before = previous.map((d) => d.instance_guid).join();
          const after = found.map((d) => d.instance_guid).join();
          return before === after ? previous : found;
        });
      } catch {
        // Un échec ponctuel d'énumération ne doit pas vider la liste ni
        // afficher une erreur : le prochain passage reprendra.
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, []);

  // Découverte initiale : périphériques branchés et profils sur le disque.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [found, located, info] = await Promise.all([
          api.listDevices(),
          api.locateActionmaps(),
          api.buildInfo(),
        ]);
        if (cancelled) return;
        setDevices(found);
        setProfiles(located);
        setBuild(info);
        // Le canal LIVE est celui que joue l'écrasante majorité des joueurs.
        const live = located.find((p) => p.channel === "LIVE") ?? located[0];
        if (live) setSelected(live.path);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Relecture à chaque changement de profil sélectionné.
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    (async () => {
      try {
        const read = await api.readFlightBindings(selected);
        if (!cancelled) {
          setBindings(read);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setBindings(null);
          setError(String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function browseForProfile() {
    const picked = await open({
      title: "Choisir un actionmaps.xml",
      multiple: false,
      filters: [{ name: "Profil Star Citizen", extensions: ["xml"] }],
    });
    if (typeof picked === "string") setSelected(picked);
  }

  return (
    <div className="flex h-full flex-col bg-ink-50">
      {build?.channel === "staging" && <StagingBanner version={build.version} />}
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 overflow-y-auto px-8 py-8">
        {loading ? (
          <p className="text-sm text-ink-500">Détection en cours…</p>
        ) : (
          <div className="space-y-8">
            <DeviceSection devices={devices} />
            <ProfileSection
              profiles={profiles}
              selected={selected}
              onSelect={setSelected}
              onBrowse={browseForProfile}
            />
            {error && <ErrorNotice message={error} />}

            {selected && (
              <>
                <Tabs active={tab} onChange={setTab} />
                {tab === "overview" &&
                  bindings && <BindingsSection bindings={bindings} />}
                {tab === "edit" && (
                  <BindingEditor
                    // Changer de langue doit reconstruire l'éditeur : les
                    // libellés viennent du backend, pas d'un état local.
                    key={settingsRevision}
                    profilePath={selected}
                    devices={devices}
                  />
                )}
                {tab === "settings" && (
                  <SettingsPanel
                    profilePath={selected}
                    onChanged={() => setSettingsRevision((n) => n + 1)}
                  />
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/** Bandeau de pré-release.
 *
 *  Staging s'installe à côté de la production : sans marqueur visible, un
 *  testeur ne saurait pas laquelle des deux il a ouverte, et rapporterait des
 *  bugs sur la mauvaise version. */
function StagingBanner({ version }: { version: string }) {
  return (
    <div className="bg-warn-600 px-8 py-1.5 text-center text-xs font-medium text-white">
      Pré-release {version} — données isolées dans %APPDATA%\SpaceMapper-Staging
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-ink-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-8 py-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-ink-900">
            SpaceMapper
          </h1>
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600">
            Lite
          </span>
        </div>
        <p className="text-xs text-ink-500">
          Sauvegarde automatique avant chaque modification
        </p>
      </div>
    </header>
  );
}

function Tabs({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
}) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Aperçu complet" },
    { id: "edit", label: "Modifier les commandes" },
    { id: "settings", label: "Réglages" },
  ];

  return (
    <div className="flex gap-1 border-b border-ink-200">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={
            "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors " +
            (active === t.id
              ? "border-accent-600 text-accent-700"
              : "border-transparent text-ink-500 hover:text-ink-800")
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-ink-200 bg-white">
      {children}
    </div>
  );
}

function DeviceSection({ devices }: { devices: DeviceView[] }) {
  return (
    <Section
      title={`Périphériques détectés (${devices.length})`}
      hint="Identifiés par leur GUID matériel, stable quel que soit le port USB. La liste se met à jour automatiquement au branchement."
    >
      <Card>
        {devices.length === 0 ? (
          <EmptyState text="Aucun périphérique de jeu détecté. Branchez votre manche — il apparaîtra ici en quelques secondes." />
        ) : (
          <ul className="divide-y divide-ink-100">
            {devices.map((d) => (
              <li
                key={d.instance_guid}
                className="flex items-center justify-between gap-6 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-ink-900">
                    {/* Le préfixe est ce que le jeu écrira : l'afficher permet
                        de vérifier soi-même la correspondance. */}
                    <span className="technical rounded bg-ink-100 px-1.5 py-0.5 text-ink-600">
                      {devicePrefix(devices, d)}
                    </span>
                    {d.product_name || d.instance_name || "Périphérique inconnu"}
                  </p>
                  <p className="technical mt-0.5 truncate text-ink-400">
                    {d.instance_guid}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-ink-500">
                  {d.axes} axes · {d.buttons} boutons · {d.povs} chapeaux
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Section>
  );
}

function ProfileSection({
  profiles,
  selected,
  onSelect,
  onBrowse,
}: {
  profiles: ProfileLocation[];
  selected: string | null;
  onSelect: (path: string) => void;
  onBrowse: () => void;
}) {
  return (
    <Section title="Profil analysé">
      <Card>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          {profiles.length > 0 ? (
            <select
              className="rounded-md border border-ink-300 bg-white px-3 py-1.5 text-sm text-ink-800"
              value={selected ?? ""}
              onChange={(e) => onSelect(e.target.value)}
            >
              {profiles.map((p) => (
                <option key={p.path} value={p.path}>
                  {p.channel}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-ink-500">
              Aucune installation détectée automatiquement.
            </p>
          )}
          <button
            onClick={onBrowse}
            className="rounded-md border border-ink-300 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            Choisir un fichier…
          </button>
        </div>
        {selected && (
          <p className="technical border-t border-ink-100 bg-ink-50 px-4 py-2 text-ink-500">
            {selected}
          </p>
        )}
      </Card>
    </Section>
  );
}

function BindingsSection({ bindings }: { bindings: FlightBindings }) {
  // Regroupement par catégorie, en préservant l'ordre du fichier : c'est
  // l'ordre dans lequel le joueur retrouvera ses touches dans le jeu.
  const grouped = useMemo(() => {
    const map = new Map<string, BindingView[]>();
    for (const b of bindings.bindings) {
      const list = map.get(b.category);
      if (list) list.push(b);
      else map.set(b.category, [b]);
    }
    return [...map.entries()];
  }, [bindings]);

  return (
    <Section
      title="Assignations de vol"
      hint={`${bindings.bindings.length} assignations · joysticks utilisés : ${
        bindings.joysticks_in_use.map((i) => `js${i}`).join(", ") || "aucun"
      }`}
    >
      {bindings.corrupt_count > 0 && (
        <CorruptNotice count={bindings.corrupt_count} />
      )}

      {grouped.length === 0 ? (
        <Card>
          <EmptyState text="Aucune assignation de vol dans ce profil." />
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([category, items]) => (
            <Card key={category}>
              <h3 className="border-b border-ink-100 bg-ink-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                {categoryLabel(category)}
              </h3>
              <ul className="divide-y divide-ink-100">
                {items.map((b, i) => (
                  <BindingRow key={`${b.action}-${i}`} binding={b} />
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </Section>
  );
}

function BindingRow({ binding }: { binding: BindingView }) {
  const known = isKnownAction(binding.action);

  return (
    <li className="flex items-center justify-between gap-6 px-4 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm text-ink-800">
          {actionLabel(binding.action)}
        </p>
        {/* Le nom interne reste visible quand il est déjà traduit : les
            joueurs partagent leurs configs en s'échangeant ces identifiants. */}
        {known && (
          <p className="technical mt-0.5 truncate text-ink-400">
            {binding.action}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {binding.activation_mode && (
          <Tag>{binding.activation_mode}</Tag>
        )}
        {binding.multi_tap && <Tag>×{binding.multi_tap}</Tag>}
        {binding.corrupt ? (
          <span className="technical rounded border border-warn-200 bg-warn-50 px-2 py-1 text-warn-700">
            {binding.input_raw || "(vide)"}
          </span>
        ) : (
          <Binding binding={binding} />
        )}
      </div>
    </li>
  );
}

function Binding({ binding }: { binding: BindingView }) {
  return (
    <span className="technical flex items-center gap-1">
      <Key>{binding.device}</Key>
      {binding.modifier && (
        <>
          <Key>{binding.modifier}</Key>
          <span className="text-ink-400">+</span>
        </>
      )}
      <Key>{binding.control}</Key>
    </span>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-ink-700">
      {children}
    </span>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-accent-50 px-1.5 py-0.5 text-xs font-medium text-accent-700">
      {children}
    </span>
  );
}

function CorruptNotice({ count }: { count: number }) {
  return (
    <div className="mb-4 rounded-lg border border-warn-200 bg-warn-50 p-4">
      <p className="text-sm font-medium text-warn-700">
        {count} assignation{count > 1 ? "s" : ""} illisible
        {count > 1 ? "s" : ""} détectée{count > 1 ? "s" : ""}
      </p>
      <p className="mt-1 text-sm text-ink-600">
        Le client Star Citizen a écrit des valeurs que le jeu ne pourra pas
        relire — ces touches resteront muettes. SpaceMapper Lite vous les
        signale ; l'édition Premium les répare.
      </p>
      <UpgradeLink />
    </div>
  );
}

function UpgradeLink() {
  return (
    <button
      onClick={() => void openUrl(TIPEEE_URL)}
      className="mt-3 rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700"
    >
      Découvrir SpaceMapper Premium — 15 €
    </button>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-warn-200 bg-warn-50 p-4">
      <p className="text-sm font-medium text-warn-700">Lecture impossible</p>
      <p className="technical mt-1 text-ink-600">{message}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="px-4 py-6 text-center text-sm text-ink-500">{text}</p>;
}
