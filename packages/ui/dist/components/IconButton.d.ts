import type { ButtonHTMLAttributes, ReactNode } from "react";
export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
    icon: ReactNode;
    /** Toujours requis : une icône ne remplace jamais un libellé sur une action critique. */
    label: string;
    /** Affiche aussi le libellé à côté de l'icône plutôt que de le réserver au lecteur d'écran. */
    showLabel?: boolean;
    size?: "sm" | "md" | "lg";
}
/** Bouton icône seule — voir `Button` pour un libellé toujours visible. */
export declare function IconButton({ icon, label, showLabel, size, className, ...rest }: IconButtonProps): import("react").JSX.Element;
