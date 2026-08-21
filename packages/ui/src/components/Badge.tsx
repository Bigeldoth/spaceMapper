import type { ReactNode } from "react";

/** Teinte du badge — voir tokens/colors.css pour les couleurs sémantiques. */
export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border-subtle)]",
  accent: "bg-[var(--accent-soft)] text-[var(--text-accent)] border-[var(--border-accent)]",
  success: "bg-[var(--success-soft)] text-[var(--success-text)] border-transparent",
  warning: "bg-[var(--warning-soft)] text-[var(--warning-text)] border-transparent",
  danger: "bg-[var(--danger-soft)] text-[var(--danger-text)] border-transparent",
};

/** Étiquette courte, jamais interactive — statut, comptage, teaser Premium. */
export function Badge({ tone = "neutral", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-[var(--sp-4)] py-[var(--sp-1)] text-[length:var(--fs-caption)] font-medium leading-none ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
