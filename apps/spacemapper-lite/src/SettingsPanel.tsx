import { useEffect, useState } from "react";
import { api, type Language, type Settings } from "./lib/api";
import { useT } from "./lib/i18nContext";

/**
 * Réglages de l'application.
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
  onChanged,
}: {
  profilePath: string;
  onChanged: () => void;
}) {
  const t = useT();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const current = await api.getSettings();
        if (!cancelled) setSettings(current);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
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

  if (!settings) {
    return <p className="text-sm text-ink-500">{t("settings.loading")}</p>;
  }

  return (
    <div className="space-y-6">
      <Section
        title={t("settings.gameLanguage")}
        hint={t("settings.gameLanguageHint")}
      >
        {languages.length === 0 ? (
          <p className="text-sm text-ink-500">{t("settings.noLanguages")}</p>
        ) : (
          <>
            <select
              className="w-full max-w-sm rounded-md border border-ink-300 bg-white px-3 py-1.5 text-sm"
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
            <p className="mt-2 text-xs text-ink-500">{languages.length}</p>
          </>
        )}
      </Section>

      <Section
        title={t("settings.uiLanguage")}
        hint={t("settings.uiLanguageHint")}
      >
        <div className="flex gap-2">
          {[
            { id: "fr", label: "Français" },
            { id: "en", label: "English" },
          ].map((option) => (
            <button
              key={option.id}
              onClick={() =>
                void update({ ...settings, ui_language: option.id })
              }
              className={
                "rounded-md px-3 py-1.5 text-sm font-medium " +
                (settings.ui_language === option.id
                  ? "bg-accent-600 text-white"
                  : "border border-ink-300 bg-white text-ink-700 hover:bg-ink-50")
              }
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-500">{t("settings.installHint")}</p>
      </Section>

      {status && <p className="text-sm text-accent-700">{status}</p>}
      {error && <p className="text-sm text-warn-700">{error}</p>}
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      <p className="mb-3 mt-0.5 text-xs text-ink-500">{hint}</p>
      {children}
    </div>
  );
}
