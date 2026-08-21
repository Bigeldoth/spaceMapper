import type { HTMLAttributes } from "react";

export type CardVariant = "standard" | "hud";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** Bordure bleutée + translation -1px au survol — réserver aux cartes cliquables. */
  interactive?: boolean;
}

const HOVER_CLASSES =
  "cursor-pointer transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:-translate-y-px hover:border-[var(--border-accent)]";

/** Équerres HUD : seul ornement du système, réservé aux blocs de données —
 * au plus deux cartes `variant="hud"` par vue. */
function HudCorners() {
  const base = "pointer-events-none absolute h-[10px] w-[10px] border-[var(--border-hud)]";
  return (
    <>
      <span aria-hidden className={`${base} left-0 top-0 border-l-2 border-t-2`} />
      <span aria-hidden className={`${base} right-0 top-0 border-r-2 border-t-2`} />
      <span aria-hidden className={`${base} bottom-0 left-0 border-b-2 border-l-2`} />
      <span aria-hidden className={`${base} bottom-0 right-0 border-b-2 border-r-2`} />
    </>
  );
}

export function Card({
  variant = "standard",
  interactive = false,
  className = "",
  children,
  ...rest
}: CardProps) {
  const hoverClasses = interactive ? HOVER_CLASSES : "";

  if (variant === "hud") {
    return (
      <div
        className={`relative rounded-[var(--radius-xs)] border border-[var(--border-hud)] bg-[var(--surface-1)] p-[var(--pad-card)] ${hoverClasses} ${className}`}
        {...rest}
      >
        <HudCorners />
        {children}
      </div>
    );
  }

  return (
    <div
      className={`rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-[var(--pad-card)] shadow-[var(--shadow-1)] ${hoverClasses} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
