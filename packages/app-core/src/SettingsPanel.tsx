import { useEffect, useState } from "react";
import { Button, Card } from "@spacemapper/ui";
import {
  api,
  type Language,
  type ProfileLocation,
  type Settings,
} from "./lib/api";
import { useT } from "./lib/i18nContext";

/**
 * Réglages de l'application.
 *
 * Le choix du profil vit ici, et non en tête de chaque écran : on le fait une
 * fois, à l'installation ou lors d'un changement de canal. L'y laisser en
 * permanence coûtait un bandeau sur toutes les pages pour un réglage qu'on ne
 * touche presque jamais.
 *
 * Deux langues distinctes, et la distinction est volontaire : un joueur peut
 * vouloir l'interface en français tout en gardant les noms de commandes en
 * anglais, qui sont ceux qu'échange la communauté sur Spectrum et Reddit.
 *
 * Les langues proposées sont celles réellement présentes dans l'installation,
 * relevées dans l'archive : en proposer une absente mènerait à une liste de
 * commandes soudain sans nom.
 */
export default function SettingsPanel({
  profilePath,
  profiles,
  onSelectProfile,
  onBrowse,
  onRefresh,
  onChanged,
}: {
  profilePath: string | null;
  profiles: ProfileLocation[];
  onSelectProfile: (path: string) => void;
  onBrowse: () => void;
  onRefresh?: () => void | Promise<void>;
  onChanged: () => void;
}) {
  const t = useT();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const current = await api.getSettings();
        if (!cancelled) setSettings(current);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
      if (!profilePath) return;
      try {
        const found = await api.listGameLanguages(profilePath);
        if (!cancelled) setLanguages(found);
      } catch (e) {
        // L'archive peut être illisible : les réglages restent modifiables,
        // seule la liste des langues manque.
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profilePath]);

  async function update(next: Settings) {
    setSettings(next);
    try {
      await api.setSettings(next);
      setStatus(t("settings.saved"));
      setError(null);
      onChanged();
    } catch (e) {
      setError(String(e));
    }
  }

  async function refreshProfiles() {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      await onRefresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setRefreshing(false);
    }
  }

  if (!settings) {
    return (
      <p className="text-[length:var(--fs-body-sm)] text-[var(--text-tertiary)]">
        {t("settings.loading")}
      </p>
    );
  }

  const selectClasses =
    "min-w-0 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-2)] px-[var(--sp-6)] py-[var(--sp-4)] text-[length:var(--fs-body-sm)] text-[var(--text-primary)] focus:border-[var(--border-accent)] focus-visible:shadow-[var(--ring-focus)] focus:outline-none";
  const isManualProfile =
    profilePath !== null && !profiles.some((profile) => profile.path === profilePath);

  return (
    <div className="space-y-[var(--sp-6)]">
      <Section title={t("profile.title")} hint={t("profile.hint")}>
        <div className="flex flex-wrap items-center gap-[var(--sp-4)]">
          {profiles.length > 0 || isManualProfile ? (
            <select
              className={`max-w-full flex-1 sm:flex-none ${selectClasses}`}
              value={profilePath ?? ""}
              onChange={(e) => onSelectProfile(e.target.value)}
            >
              {isManualProfile && (
                <option value={profilePath}>{t("profile.manual")}</option>
              )}
              {profiles.map((p) => (
                <option key={p.path} value={p.path}>
                  {installationLabel(p)}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-[length:var(--fs-body-sm)] text-[var(--text-tertiary)]">
              {t("profile.none")}
            </p>
          )}
          <Button variant="secondary" size="sm" onClick={onBrowse} className="shrink-0">
            {t("profile.browse")}
          </Button>
          {onRefresh && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void refreshProfiles()}
              disabled={refreshing}
              className="shrink-0"
            >
              {refreshing ? t("profile.refreshing") : t("profile.rescan")}
            </Button>
          )}
        </div>
        {profilePath && (
          <p className="technical mt-[var(--sp-4)] break-all text-[var(--text-disabled)]">
            {profilePath}
          </p>
        )}
      </Section>

      <Section
        title={t("settings.gameLanguage")}
        hint={t("settings.gameLanguageHint")}
      >
        {languages.length === 0 ? (
          <p className="text-[length:var(--fs-body-sm)] text-[var(--text-tertiary)]">
            {t("settings.noLanguages")}
          </p>
        ) : (
          <select
            className={`w-full max-w-sm ${selectClasses}`}
            value={settings.game_language}
            onChange={(e) =>
              void update({ ...settings, game_language: e.target.value })
            }
          >
            {languages.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        )}
      </Section>

      <Section
        title={t("settings.uiLanguage")}
        hint={t("settings.uiLanguageHint")}
      >
        <div className="flex gap-[var(--sp-4)]">
          {[
            { id: "fr", label: "Français" },
            { id: "en", label: "English" },
          ].map((option) => (
            <Button
              key={option.id}
              size="sm"
              variant={settings.ui_language === option.id ? "primary" : "secondary"}
              onClick={() => void update({ ...settings, ui_language: option.id })}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <p className="mt-[var(--sp-4)] text-[length:var(--fs-caption)] text-[var(--text-tertiary)]">
          {t("settings.installHint")}
        </p>
      </Section>

      {status && (
        <p className="text-[length:var(--fs-body-sm)] text-[var(--success-text)]">{status}</p>
      )}
      {error && (
        <p className="text-[length:var(--fs-body-sm)] text-[var(--danger-text)]">{error}</p>
      )}
    </div>
  );
}

/**
 * Distingue deux canaux installés sur des disques différents sans reconstruire
 * le chemin : on conserve donc exactement les séparateurs et la casse fournis
 * par Windows. Le repli sur le chemin complet couvre aussi un emplacement
 * choisi manuellement qui ne suit pas l'arborescence habituelle du jeu.
 */
function installationLabel(profile: ProfileLocation): string {
  const root = starCitizenRoot(profile.path) ?? profile.path;
  return `${profile.channel} — ${root}`;
}

function starCitizenRoot(path: string): string | null {
  const marker = /(?:^|[\\/])StarCitizen(?=[\\/]|$)/gi;
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;

  while ((match = marker.exec(path)) !== null) {
    lastMatch = match;
  }

  return lastMatch
    ? path.slice(0, lastMatch.index + lastMatch[0].length)
    : null;
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
    <Card>
      <h3 className="text-[length:var(--fs-body)] font-semibold text-[var(--text-primary)]">
        {title}
      </h3>
      <p className="mb-[var(--sp-4)] mt-[var(--sp-1)] text-[length:var(--fs-caption)] text-[var(--text-tertiary)]">
        {hint}
      </p>
      {children}
    </Card>
  );
}
