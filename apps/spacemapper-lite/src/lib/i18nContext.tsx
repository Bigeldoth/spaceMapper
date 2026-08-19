import { createContext, useContext, useMemo } from "react";
import { translator, type Key, type Lang } from "./i18n";

/**
 * Distribution de la fonction de traduction.
 *
 * Un contexte plutôt qu'un passage de propriété : la traduction concerne
 * chaque composant de l'arbre, et la faire descendre à la main polluerait
 * toutes les signatures sans rien apprendre au lecteur.
 */
const TranslationContext = createContext<(key: Key) => string>(
  translator("fr"),
);

export function TranslationProvider({
  lang,
  children,
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  const t = useMemo(() => translator(lang), [lang]);
  return (
    <TranslationContext.Provider value={t}>
      {children}
    </TranslationContext.Provider>
  );
}

/** Fonction de traduction du composant courant. */
export function useT(): (key: Key) => string {
  return useContext(TranslationContext);
}
