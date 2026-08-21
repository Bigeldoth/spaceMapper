import type { ButtonHTMLAttributes } from "react";
export type ButtonVariant = "primary" | "secondary" | "ghost";
/** Hauteurs de contrôle du design system : 28 / 36 / 44px. */
export type ButtonSize = "sm" | "md" | "lg";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
}
/** Bouton d'action principal — voir `IconButton` pour une icône seule. */
export declare function Button({ variant, size, className, ...rest }: ButtonProps): import("react").JSX.Element;
