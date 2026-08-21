import type { HTMLAttributes } from "react";
export type CardVariant = "standard" | "hud";
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: CardVariant;
    /** Bordure bleutée + translation -1px au survol — réserver aux cartes cliquables. */
    interactive?: boolean;
}
export declare function Card({ variant, interactive, className, children, ...rest }: CardProps): import("react").JSX.Element;
