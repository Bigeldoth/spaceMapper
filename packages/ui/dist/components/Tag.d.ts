import type { ButtonHTMLAttributes } from "react";
export interface TagProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    selected?: boolean;
}
/** Puce de filtre/sélection — bascule d'état, contrairement à `Badge` (statique). */
export declare function Tag({ selected, className, ...rest }: TagProps): import("react").JSX.Element;
