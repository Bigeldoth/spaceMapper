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
export declare function TranslationProvider({ translate, children, }: {
    translate: Translate;
    children: React.ReactNode;
}): import("react").JSX.Element;
/** Fonction de traduction du composant courant. */
export declare function useT(): Translate;
export type { CoreKey };
