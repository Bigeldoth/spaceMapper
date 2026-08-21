import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";
/** Hauteurs de contrôle du design system : 28 / 36 / 44px. */
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-[var(--h-control-sm)] px-[var(--sp-5)] text-[length:var(--fs-body-sm)]",
  md: "h-[var(--h-control)] px-[var(--sp-6)] text-[length:var(--fs-body)]",
  lg: "h-[var(--h-control-lg)] px-[var(--sp-7)] text-[length:var(--fs-body)]",
};

// Le primaire s'éclaircit au survol (jamais d'assombrissement) et gagne un
// halo diffus ; press = léger retrait d'échelle + accent-press, sans halo.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "border border-transparent bg-accent text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] hover:shadow-[var(--glow-soft)] active:bg-[var(--accent-press)] active:shadow-none",
  secondary:
    "border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]",
  ghost:
    "border border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
};

/** Bouton d'action principal — voir `IconButton` pour une icône seule. */
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-[var(--sp-3)] rounded-[var(--radius-control)] font-medium leading-none transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] focus-visible:shadow-[var(--ring-focus)] active:scale-[var(--press-scale)] disabled:pointer-events-none disabled:opacity-[0.42] ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    />
  );
}
