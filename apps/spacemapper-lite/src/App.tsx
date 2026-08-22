import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Badge } from "@spacemapper/ui";
import {
  api,
  type BuildInfo,
  type DeviceView,
  type ProfileLocation,
} from "@spacemapper/app-core";
import BindingEditor from "./BindingEditor";
import DiagnosisPanel from "./DiagnosisPanel";
import LayoutPanel from "./LayoutPanel";
import { SettingsPanel, TranslationProvider, useT } from "@spacemapper/app-core";
import { translator, type Key, type Lang } from "./lib/i18n";

type Tab = "edit" | "diagnosis" | "layouts" | "settings";

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

  // La table est propre à cette édition ; seul le mécanisme de distribution
  // est partagé. On mémoïse pour ne pas re-rendre tout l'arbre à chaque rendu.
  const translate = useMemo(() => translator(lang), [lang]);

  return (
    <TranslationProvider translate={translate}>
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
    <div className="flex h-full flex-col bg-[var(--bg-base)]">
      {build?.channel === "staging" && <StagingBanner version={build.version} />}
      <Header />
      {/* La navigation vit sous l'en-tête plutôt que dans le flux : elle ne
          défile pas avec le contenu, et reste atteignable même sans profil —
          c'est par les Réglages qu'on en choisit un. */}
      {!loading && <Tabs active={tab} onChange={setTab} />}

      <main className="mx-auto w-full max-w-6xl flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
        {loading ? (
          <p className="text-sm text-[var(--text-tertiary)]">{t("loading")}</p>
        ) : (
          <div className="space-y-4">
            {error && <ErrorNotice message={error} />}

            {tab === "settings" ? (
              <SettingsPanel
                profilePath={selected}
                profiles={profiles}
                onSelectProfile={setSelected}
                onBrowse={browseForProfile}
                onChanged={() => {
                  setSettingsRevision((n) => n + 1);
                  // La langue de l'interface vit à la racine : on la relit
                  // pour que le changement se voie immédiatement.
                  void api
                    .getSettings()
                    .then((s) =>
                      onLanguageChange(s.ui_language === "en" ? "en" : "fr"),
                    )
                    .catch(() => {});
                }}
              />
            ) : selected ? (
              <>
                {tab === "edit" && (
                  <BindingEditor
                    // Changer de langue doit reconstruire l'éditeur : les
                    // libellés viennent du backend, pas d'un état local.
                    key={settingsRevision}
                    profilePath={selected}
                    devices={devices}
                  />
                )}
                {tab === "diagnosis" && (
                  <DiagnosisPanel profilePath={selected} devices={devices} />
                )}
                {tab === "layouts" && <LayoutPanel profilePath={selected} />}
              </>
            ) : (
              <NoProfile onSettings={() => setTab("settings")} />
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
  const t = useT();
  return (
    <div className="bg-[var(--warning)] px-8 py-1.5 text-center text-xs font-medium text-[var(--n-950)]">
      {t("staging.banner")} {version} — {t("staging.isolated")}
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-[var(--border-subtle)] bg-[var(--surface-2)]">
      <div className="mx-auto flex w-full max-w-6xl items-baseline gap-2 px-4 py-3 sm:px-6 lg:px-8">
        <h1 className="text-base font-semibold tracking-tight text-[var(--text-primary)] sm:text-lg">
          SpaceMapper
        </h1>
        <Badge tone="accent">Lite</Badge>
      </div>
    </header>
  );
}

/**
 * Navigation principale.
 *
 * Défilante horizontalement plutôt que repliée dans un menu : quatre entrées
 * courtes tiennent sur un écran étroit dès lors qu'on accepte de les faire
 * glisser, et un menu déroulant cacherait où l'on se trouve.
 */
function Tabs({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
}) {
  const t = useT();
  const tabs: { id: Tab; label: Key }[] = [
    { id: "edit", label: "tab.edit" },
    { id: "diagnosis", label: "tab.diagnosis" },
    { id: "layouts", label: "tab.layouts" },
    { id: "settings", label: "tab.settings" },
  ];

  return (
    <nav className="border-b border-[var(--border-subtle)] bg-[var(--surface-2)]">
      {/* `overflow-y-hidden` n'est pas décoratif : sans lui, la ligne (dont le
          contenu déborde d'un pixel via les métriques de police) hérite un
          `overflow-y: auto` du seul `overflow-x-auto` posé — la CSS impose ça
          dès qu'un seul axe n'est pas `visible` — et affiche une barre de
          défilement verticale résiduelle, réduite à ses flèches. */}
      <div className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto overflow-y-hidden px-4 sm:px-6 lg:px-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={
              "-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors sm:px-4 " +
              (active === tab.id
                ? "border-accent text-[var(--text-accent)]"
                : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]")
            }
          >
            {t(tab.label)}
          </button>
        ))}
      </div>
    </nav>
  );
}

/** Aucun profil retenu : on dit où le choisir plutôt que d'afficher du vide. */
function NoProfile({ onSettings }: { onSettings: () => void }) {
  const t = useT();
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-10 text-center">
      <p className="text-sm text-[var(--text-secondary)]">{t("profile.none")}</p>
      <button
        onClick={onSettings}
        className="mt-3 rounded-[var(--radius-control)] bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
      >
        {t("profile.goToSettings")}
      </button>
    </div>
  );
}



function ErrorNotice({ message }: { message: string }) {
  const t = useT();
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--danger)]/30 bg-[var(--danger-soft)] p-4">
      <p className="text-sm font-medium text-[var(--danger-text)]">{t("error.title")}</p>
      <p className="technical mt-1 text-[var(--text-secondary)]">{message}</p>
    </div>
  );
}

