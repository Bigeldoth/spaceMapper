import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: ReactNode;
  /** Toujours requis : une icône ne remplace jamais un libellé sur une action critique. */
  label: string;
  /** Affiche aussi le libellé à côté de l'icône plutôt que de le réserver au lecteur d'écran. */
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  sm: "h-[var(--h-control-sm)] w-[var(--h-control-sm)]",
  md: "h-[var(--h-control)] w-[var(--h-control)]",
  lg: "h-[var(--h-control-lg)] w-[var(--h-control-lg)]",
};

/** Bouton icône seule — voir `Button` pour un libellé toujours visible. */
export function IconButton({
  icon,
  label,
  showLabel = false,
  size = "md",
  className = "",
  ...rest
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={!showLabel ? label : undefined}
      className={`inline-flex items-center justify-center gap-[var(--sp-3)] rounded-[var(--radius-control)] border border-transparent text-[var(--text-secondary)] transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:shadow-[var(--ring-focus)] active:scale-[var(--press-scale)] disabled:pointer-events-none disabled:opacity-[0.42] ${showLabel ? "px-[var(--sp-5)]" : SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {icon}
      {showLabel && <span className="text-[length:var(--fs-body-sm)]">{label}</span>}
    </button>
  );
}
