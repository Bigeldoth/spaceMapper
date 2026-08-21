/**
 * Commandes qui se disputent le même contrôle.
 *
 * Star Citizen n'interdit pas d'assigner deux commandes au même bouton, et ne
 * le signale nulle part : le joueur découvre en vol que sa postcombustion
 * déclenche aussi autre chose. C'est l'un des rares défauts de configuration
 * qu'on peut détecter sans le jeu, et il mérite mieux qu'un compteur.
 */

import type { Context, EditableBinding } from "./api";

/**
 * Relation « ces deux situations peuvent coexister ».
 *
 * Fournie par le backend, où elle est testée, plutôt que réécrite ici. Tant
 * qu'elle n'est pas chargée, on considère que tout se heurte : mieux vaut une
 * fausse alerte visible qu'un conflit tu, qui ne se découvrirait qu'en vol.
 */
export class ContextRules {
  private readonly pairs: Set<string>;

  constructor(pairs: [Context, Context][] | null) {
    this.pairs = new Set(
      (pairs ?? []).flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]),
    );
  }

  canCollide(a: Context, b: Context): boolean {
    if (this.pairs.size === 0) return true;
    return this.pairs.has(`${a}|${b}`);
  }
}

/** Clé stable d'une commande, indépendante de l'ordre du fichier. */
export function keyOf(actionmap: string, action: string): string {
  return `${actionmap}/${action}`;
}

/**
 * Jeton réellement en vigueur, modification en attente comprise.
 *
 * Une modification non enregistrée doit compter : sinon l'utilisateur
 * n'apprendrait qu'il vient de créer un conflit qu'après avoir écrit dans son
 * profil.
 */
export function effectiveToken(
  binding: EditableBinding,
  pending: Map<string, string | null>,
): string | null {
  const key = keyOf(binding.actionmap, binding.action);
  if (pending.has(key)) return pending.get(key) ?? null;

  // `control` vide correspond aux formes `js3_ ` que le jeu écrit en masse
  // pour dire « rien sur ce périphérique ». Ce n'est pas une assignation.
  return binding.control && binding.control.trim() !== ""
    ? binding.input_raw
    : null;
}

/** Une commande est-elle assignée, modification en attente comprise ? */
export function isAssigned(
  binding: EditableBinding,
  pending: Map<string, string | null>,
): boolean {
  return effectiveToken(binding, pending) !== null;
}

/**
 * Index des jetons partagés par au moins deux commandes.
 *
 * Construit une fois par rendu et passé aux filtres comme au détail : le
 * recalculer par ligne serait quadratique sur 451 assignations.
 */
export interface ConflictIndex {
  /** Commandes partageant un jeton, sans distinction de situation. */
  readonly byToken: Map<string, EditableBinding[]>;
  readonly rules: ContextRules;
  /** Clés des commandes réellement en conflit, situation comprise. */
  readonly flagged: Set<string>;
}

export function indexConflicts(
  bindings: EditableBinding[],
  pending: Map<string, string | null>,
  rules: ContextRules,
): ConflictIndex {
  const byToken = new Map<string, EditableBinding[]>();

  for (const binding of bindings) {
    const token = effectiveToken(binding, pending);
    if (token === null) continue;
    const list = byToken.get(token);
    if (list) list.push(binding);
    else byToken.set(token, [binding]);
  }

  // Partager un bouton ne suffit pas : encore faut-il pouvoir répondre en même
  // temps. Sans ce tri, une touche commune au siège et à la marche à pied —
  // cas massivement courant, le jeu le fait exprès — passerait pour un défaut.
  const flagged = new Set<string>();
  for (const [, group] of byToken) {
    for (const binding of group) {
      const rivals = group.filter(
        (other) =>
          other !== binding && rules.canCollide(binding.context, other.context),
      );
      if (rivals.length > 0) {
        flagged.add(keyOf(binding.actionmap, binding.action));
      }
    }
  }

  return { byToken, rules, flagged };
}

/** Les *autres* commandes qui occupent le même contrôle au même moment. */
export function rivalsOf(
  binding: EditableBinding,
  pending: Map<string, string | null>,
  conflicts: ConflictIndex,
): EditableBinding[] {
  const token = effectiveToken(binding, pending);
  if (token === null) return [];
  const key = keyOf(binding.actionmap, binding.action);
  return (conflicts.byToken.get(token) ?? []).filter(
    (other) =>
      keyOf(other.actionmap, other.action) !== key &&
      conflicts.rules.canCollide(binding.context, other.context),
  );
}

export function hasConflict(
  binding: EditableBinding,
  _pending: Map<string, string | null>,
  conflicts: ConflictIndex,
): boolean {
  return conflicts.flagged.has(keyOf(binding.actionmap, binding.action));
}
