import type { SVGProps } from "react";

/** Tailles autorisées par le design system — rien en dehors de cette échelle. */
export type IconSize = 14 | 16 | 18 | 20 | 24;

export interface IconWrapperProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  size?: IconSize;
}

/**
 * Enveloppe commune aux icônes Phosphor duotone vendues dans ce dossier.
 *
 * Chaque icône est un composant dédié (voir `Icon.prompt` dans le plan) plutôt
 * qu'un unique composant paramétré par un nom : cela évite d'embarquer les 1512
 * SVG du jeu Phosphor dans le bundle final quand seule une poignée est utilisée.
 */
export function svgProps(size: IconSize = 20): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: "0 0 256 256",
    "aria-hidden": true,
    focusable: false,
  };
}
