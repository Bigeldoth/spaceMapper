import { createContext, useContext, useMemo } from "react";
import type { CoreKey } from "./keys";

/**
 * Fonction de traduction, vue par les écrans partagés.
 *
 * Elle accepte n'importe quelle chaîne parce que chaque édition a son propre
 * vocabulaire, plus large que celui d'ici. Ce que les écrans partagés exigent
 * est nommé par [`CoreKey`], et vérifié dans le `i18n.ts` de chaque
 * application.
 */
export type Translate = (key: string) => string;

/**
 * Distribution de la fonction de traduction.
 *
 * Un contexte plutôt qu'un passage de propriété : la traduction concerne
 * chaque composant de l'arbre, et la faire descendre à la main polluerait
 * toutes les signatures sans rien apprendre au lecteur.
 *
 * Le défaut renvoie la clé telle quelle : un composant monté hors du
 * fournisseur est un défaut de câblage, et une clé brute à l'écran le signale
 * mieux qu'un texte vide.
 */
const TranslationContext = createContext<Translate>((key) => key);

export function TranslationProvider({
  translate,
  children,
}: {
  translate: Translate;
  children: React.ReactNode;
}) {
  // `translate` est déjà mémoïsé par l'appelant dans le cas courant ; on
  // stabilise malgré tout la valeur du contexte pour ne pas re-rendre tout
  // l'arbre si l'appelant reconstruit la fonction à chaque rendu.
  const value = useMemo(() => translate, [translate]);
  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
}

/** Fonction de traduction du composant courant. */
export function useT(): Translate {
  return useContext(TranslationContext);
}

export type { CoreKey };
