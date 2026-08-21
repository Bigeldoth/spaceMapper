import type { ButtonHTMLAttributes } from "react";

export interface TagProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

/** Puce de filtre/sélection — bascule d'état, contrairement à `Badge` (statique). */
export function Tag({ selected = false, className = "", ...rest }: TagProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`inline-flex items-center gap-[var(--sp-2)] rounded-[var(--radius-pill)] border px-[var(--sp-5)] py-[var(--sp-2)] text-[length:var(--fs-body-sm)] font-medium leading-none transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] focus-visible:shadow-[var(--ring-focus)] ${
        selected
          ? "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--text-accent)]"
          : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:text-[var(--text-primary)]"
      } ${className}`}
      {...rest}
    />
  );
}
