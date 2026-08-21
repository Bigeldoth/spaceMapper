import type { ReactNode } from "react";
/** Teinte du badge — voir tokens/colors.css pour les couleurs sémantiques. */
export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";
export interface BadgeProps {
    tone?: BadgeTone;
    children: ReactNode;
}
/** Étiquette courte, jamais interactive — statut, comptage, teaser Premium. */
export declare function Badge({ tone, children }: BadgeProps): import("react").JSX.Element;
