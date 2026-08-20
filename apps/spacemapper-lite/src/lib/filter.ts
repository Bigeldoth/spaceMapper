/**
 * Filtrage et recherche des assignations.
 *
 * La fusion avec les valeurs par défaut du jeu fait passer la liste de
 * quelques dizaines d'entrées à plusieurs centaines. Sans moyen de la
 * restreindre, les réglages propres au joueur — précisément ce qu'il vient
 * consulter — s'y perdent.
 */

import type { EditableBinding, Origin } from "./api";
import { bindingLabel, categoryLabel } from "./actionLabels";

/**
 * Manière de piloter, et non famille de périphérique.
 *
 * On ne filtre pas par appareil mais par **installation** : personne ne
 * configure une souris seule, elle accompagne toujours un clavier. Les
 * séparer obligeait le joueur à consulter deux filtres pour voir une seule
 * façon de jouer.
 */
export type SetupMode = "desk" | "gamepad" | "joystick";

export interface Filters {
  /** Texte libre : libellé, nom interne ou jeton d'assignation. */
  query: string;
  origin: Origin | "all";
  mode: SetupMode | "all";
  /** Ne montrer que ce que l'édition Lite peut modifier. */
  editableOnly: boolean;
}

export const NO_FILTERS: Filters = {
  query: "",
  origin: "all",
  mode: "all",
  editableOnly: false,
};

export function isFiltering(filters: Filters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.origin !== "all" ||
    filters.mode !== "all" ||
    filters.editableOnly
  );
}

/**
 * Mode auquel se rattache une assignation, ou `null` si le jeton est illisible.
 *
 * `kb` et `mo` retombent tous deux sur `desk` : c'est ce regroupement qui fait
 * tout l'intérêt du filtre.
 */
export function modeOf(binding: EditableBinding): SetupMode | null {
  switch (binding.input_raw.slice(0, 2)) {
    case "kb":
    case "mo":
      return "desk";
    case "gp":
      return "gamepad";
    case "js":
      return "joystick";
    default:
      return null;
  }
}

export function apply(
  bindings: EditableBinding[],
  filters: Filters,
): EditableBinding[] {
  const needle = normalise(filters.query);

  return bindings.filter((b) => {
    if (filters.origin !== "all" && b.origin !== filters.origin) return false;
    if (filters.mode !== "all" && modeOf(b) !== filters.mode) return false;
    if (filters.editableOnly && b.lock !== null) return false;
    if (needle === "") return true;

    // On cherche dans tout ce que l'utilisateur peut avoir sous les yeux ou en
    // tête : le libellé traduit, le nom interne qu'échangent les joueurs, le
    // jeton d'assignation, et le nom de la catégorie.
    return [
      bindingLabel(b),
      b.action,
      b.description ?? "",
      b.input_raw,
      b.control ?? "",
      categoryLabel(b.actionmap),
      b.actionmap,
    ].some((field) => normalise(field).includes(needle));
  });
}

/**
 * Réduit une chaîne à une forme comparable.
 *
 * Les accents sont retirés : un joueur qui tape « energie » doit trouver
 * « Énergie », et il ne pense pas non plus à la casse.
 */
function normalise(value: string): string {
  // La décomposition NFD sépare la lettre de son accent ; on retire ensuite la
  // plage des diacritiques combinants. Les écrire en échappements plutôt qu'en
  // caractères littéraux les rend visibles dans le code.
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
