import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  api,
  type BuildInfo,
  type DeviceView,
  type ProfileLocation,
} from "./lib/api";
import BindingEditor from "./BindingEditor";
import DiagnosisPanel from "./DiagnosisPanel";
import SettingsPanel from "./SettingsPanel";
import type { Key, Lang } from "./lib/i18n";
import { TranslationProvider, useT } from "./lib/i18nContext";

type Tab = "diagnosis" | "edit" | "settings";

/**
 * Racine de l'application.
 *
 * Elle porte la langue de l'interface : la charger ici, et non dans chaque
 * écran, garantit qu'un changement de réglage se propage d'un coup.
 */
export default function App() {
  const [lang, setLang] = useState<Lang>("fr");

  useEffect(() => {
    void api
      .getSettings()
      .then((s) => setLang(s.ui_language === "en" ? "en" : "fr"))
      .catch(() => {});
  }, []);

  return (
    <TranslationProvider lang={lang}>
      <Workspace onLanguageChange={setLang} />
    </TranslationProvider>
  );
}

function Workspace({
  onLanguageChange,
}: {
  onLanguageChange: (lang: Lang) => void;
}) {
  const t = useT();
  const [devices, setDevices] = useState<DeviceView[]>([]);
  const [profiles, setProfiles] = useState<ProfileLocation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [build, setBuild] = useState<BuildInfo | null>(null);
  // L'édition est la raison d'être de l'application ; le diagnostic est à un
  // clic pour qui vient réparer quelque chose.
  const [tab, setTab] = useState<Tab>("edit");
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

  // Changer de profil efface l'erreur du précédent : chaque onglet relit ce
  // dont il a besoin, et un message resté à l'écran parlerait d'un fichier
  // qu'on ne regarde plus.
  useEffect(() => {
    setError(null);
  }, [selected]);

  async function browseForProfile() {
    // Le `catch` n'est pas décoratif : un refus d'autorisation Tauri rejette
    // la promesse sans rien afficher, et le bouton paraît alors simplement
    // mort. C'est exactement le symptôme qu'a produit l'absence de fichier de
    // capacités.
    try {
      const picked = await open({
        title: t("profile.browse"),
        multiple: false,
        filters: [{ name: "Star Citizen", extensions: ["xml"] }],
      });
      if (typeof picked === "string") setSelected(picked);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="flex h-full flex-col bg-ink-50">
      {build?.channel === "staging" && <StagingBanner version={build.version} />}
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 overflow-y-auto px-8 py-8">
        {loading ? (
          <p className="text-sm text-ink-500">{t("loading")}</p>
        ) : (
          <div className="space-y-8">
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
                {tab === "diagnosis" && (
                  <DiagnosisPanel profilePath={selected} devices={devices} />
                )}
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
                    onChanged={() => {
                      setSettingsRevision((n) => n + 1);
                      // La langue de l'interface vit à la racine : on la
                      // relit pour que le changement se voie immédiatement.
                      void api
                        .getSettings()
                        .then((s) =>
                          onLanguageChange(s.ui_language === "en" ? "en" : "fr"),
                        )
                        .catch(() => {});
                    }}
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
  const t = useT();
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
          {t("app.readOnlyNotice")}
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
  const t = useT();
  const tabs: { id: Tab; label: Key }[] = [
    { id: "diagnosis", label: "tab.diagnosis" },
    { id: "edit", label: "tab.edit" },
    { id: "settings", label: "tab.settings" },
  ];

  return (
    <div className="flex gap-1 border-b border-ink-200">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={
            "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors " +
            (active === tab.id
              ? "border-accent-600 text-accent-700"
              : "border-transparent text-ink-500 hover:text-ink-800")
          }
        >
          {t(tab.label)}
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
  const t = useT();
  return (
    <Section title={t("profile.title")}>
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
              {t("profile.none")}
            </p>
          )}
          <button
            onClick={onBrowse}
            className="rounded-md border border-ink-300 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            {t("profile.browse")}
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

function ErrorNotice({ message }: { message: string }) {
  const t = useT();
  return (
    <div className="rounded-lg border border-warn-200 bg-warn-50 p-4">
      <p className="text-sm font-medium text-warn-700">{t("error.title")}</p>
      <p className="technical mt-1 text-ink-600">{message}</p>
    </div>
  );
}

