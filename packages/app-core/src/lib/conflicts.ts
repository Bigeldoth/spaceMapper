/**
 * Commandes qui occupent le même usage d'un contrôle.
 *
 * La combinaison complète comprend le périphérique, le contrôle, ses
 * modificateurs et le type d'appui. Réutiliser un bouton avec Ctrl, Maj,
 * un double-appui ou un appui prolongé crée un usage distinct.
 */

import type { ConflictReview, Context, EditableBinding } from "./api";
import { triggerSignatureKey, triggerSignatureOf } from "./activation";

/**
 * Contextes autorisés à produire un conflit dans le diagnostic.
 *
 * Fournie par le backend, où elle est testée, plutôt que réécrite ici. Tant
 * qu'elle n'est pas chargée, on considère que tout se heurte : mieux vaut une
 * fausse alerte visible qu'un conflit tu, qui ne se découvrirait qu'en vol.
 */
export class ContextRules {
  private readonly pairs: Set<string>;
  private readonly loaded: boolean;

  constructor(pairs: [Context, Context][] | null) {
    this.loaded = pairs !== null;
    this.pairs = new Set(
      (pairs ?? []).flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]),
    );
  }

  canCollide(a: Context, b: Context): boolean {
    if (!this.loaded) return true;
    return this.pairs.has(`${a}|${b}`);
  }
}

/**
 * Clé stable d'une ligne, indépendante de l'ordre du fichier — commande
 * **et** assignation précise.
 *
 * Une action peut porter deux lignes à la fois — une au clavier, une au
 * manche. Les confondre sous la seule paire (actionmap, action) faisait
 * déteindre l'édition ou le signalement de conflit d'une ligne sur l'autre :
 * modifier le manche marquait aussi le clavier comme en attente.
 *
 * On distingue sur `input_raw` plutôt que sur `device` : `device` vaut
 * `null` pour toute surcharge à contrôle blanc (`jsN_ `, la forme que le jeu
 * écrit en masse) ou illisible — précisément les lignes que ce correctif
 * visait à distinguer. `input_raw`, lui, reste unique même dans ce cas
 * (`"js3_ "` diffère de `"mo1_ "`), et c'est aussi la valeur que le
 * back-end utilise pour retrouver le `<rebind>` exact à réécrire — voir
 * `spacemapper_edit::writer::BindingEdit::original_input`.
 */
export function keyOf(
  binding: Pick<EditableBinding, "actionmap" | "action" | "input_raw">,
): string {
  return `${binding.actionmap}/${binding.action}/${binding.input_raw}`;
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
  const key = keyOf(binding);
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
 * Le regroupement reste physique (`byToken`), puis chaque paire est filtrée
 * par contexte **et** par geste d'activation : court, long et double-appui
 * peuvent partager un contrôle sans se disputer son déclenchement.
 */
export interface ConflictIndex {
  /** Commandes partageant un jeton, sans distinction de situation. */
  readonly byToken: Map<string, EditableBinding[]>;
  readonly rules: ContextRules;
  /** Clés des commandes dont l'usage fait doublon dans un contexte compatible. */
  readonly flagged: Set<string>;
  /** Partages non évalués ou dont le déclencheur n'est pas complètement connu. */
  readonly uncertain: Set<string>;
  readonly reviews: readonly ConflictReview[];
  readonly probableRivals: Map<string, EditableBinding[]>;
  readonly uncertainRivals: Map<string, EditableBinding[]>;
}

/**
 * Deux lignes d'une même action décrivent plusieurs façons de déclencher la
 * même commande ; elles ne sont donc jamais rivales entre elles. Cette règle
 * doit rester identique pour le badge calculé par l'index et le détail rendu
 * par `rivalsOf`, même si les lignes ont des `input_raw` distincts.
 */
/** Casse et ordre des modificateurs sont normalisés, leurs côtés restent distincts. */
export function canonicalControlToken(raw: string): string {
  const token = raw.trim().toLowerCase();
  const match = /^((?:js|gp|kb|mo)\d+)_(.*)$/.exec(token);
  if (!match) return token;
  const parts = match[2]!.split("+").map(part => part.trim());
  const control = parts.pop() ?? "";
  return `${match[1]}_${[...parts.sort(), control].join("+")}`;
}

export type ConflictLevel = "none" | "probable" | "uncertain";
export type ConflictReason = "different_controls" | "same_action" | "review_false_alarm" | "review_real_conflict" | "different_triggers" | "separate_contexts" | "unknown_trigger" | "preexisting_default" | "same_usage";
export interface ConflictAssessment { level: ConflictLevel; reason: ConflictReason; }

function reviewKey(control: string, actions: { actionmap: string; action: string; trigger_signature: unknown }[]): string | null {
  if (actions.length !== 2) return null;
  const identities = actions.map(action => {
    const signature = triggerSignatureKey(action.trigger_signature);
    return signature === null ? null : JSON.stringify([action.actionmap, action.action, signature]);
  });
  if (identities.some(identity => identity === null)) return null;
  return JSON.stringify([canonicalControlToken(control), ...identities.sort()]);
}

// Les réponses du backend sont immuables ; ne pas resérialiser 90 observations
// pour chacune des nombreuses paires présentes dans les valeurs par défaut.
const reviewLookups = new WeakMap<readonly ConflictReview[], Map<string, ConflictReview>>();
function lookupReviews(reviews: readonly ConflictReview[]): Map<string, ConflictReview> {
  const cached = reviewLookups.get(reviews);
  if (cached) return cached;
  const lookup = new Map<string, ConflictReview>();
  for (const review of reviews) {
    if (review.verdict !== "false_alarm" && review.verdict !== "real_conflict") continue;
    const key = reviewKey(review.control, review.actions);
    if (key !== null) lookup.set(key, review);
  }
  reviewLookups.set(reviews, lookup);
  return lookup;
}

/** Même décision pour le compteur, la fiche, la capture et le choix de geste. */
export function assessConflictPair(
  left: EditableBinding,
  right: EditableBinding,
  pending: Map<string, string | null>,
  rules: ContextRules,
  reviews: readonly ConflictReview[] = [],
): ConflictAssessment {
  const leftRaw = effectiveToken(left, pending);
  const rightRaw = effectiveToken(right, pending);
  if (leftRaw === null || rightRaw === null || canonicalControlToken(leftRaw) !== canonicalControlToken(rightRaw)) return { level: "none", reason: "different_controls" };
  if (left.actionmap === right.actionmap && left.action === right.action) return { level: "none", reason: "same_action" };
  const a = triggerSignatureOf(left, leftRaw);
  const b = triggerSignatureOf(right, rightRaw);
  const key = reviewKey(leftRaw, [
    { actionmap: left.actionmap, action: left.action, trigger_signature: a },
    { actionmap: right.actionmap, action: right.action, trigger_signature: b },
  ]);
  // Une observation exacte prime sur les anciennes exclusions de catégories.
  // Changer le contrôle, ses modificateurs ou son déclencheur invalide ce retour.
  if (key !== null) {
    const review = lookupReviews(reviews).get(key);
    if (review) return review.verdict === "real_conflict"
      ? { level: "probable", reason: "review_real_conflict" }
      : { level: "none", reason: "review_false_alarm" };
  }
  if (a !== null && b !== null && triggerSignatureKey(a) !== triggerSignatureKey(b)) return { level: "none", reason: "different_triggers" };
  if (!rules.canCollide(left.context, right.context)) return { level: "none", reason: "separate_contexts" };
  if (a === null || b === null) return { level: "uncertain", reason: "unknown_trigger" };
  if (left.origin === "game_default" && right.origin === "game_default" && !pending.has(keyOf(left)) && !pending.has(keyOf(right))) return { level: "uncertain", reason: "preexisting_default" };
  return { level: "probable", reason: "same_usage" };
}

export function classifyConflictPair(
  left: EditableBinding, right: EditableBinding, pending: Map<string, string | null>,
  rules: ContextRules, reviews: readonly ConflictReview[] = [],
): ConflictLevel {
  return assessConflictPair(left, right, pending, rules, reviews).level;
}

export function indexConflicts(
  bindings: EditableBinding[],
  pending: Map<string, string | null>,
  rules: ContextRules,
  reviews: readonly ConflictReview[] = [],
): ConflictIndex {
  const byToken = new Map<string, EditableBinding[]>();

  for (const binding of bindings) {
    const raw = effectiveToken(binding, pending);
    if (raw === null) continue;
    const token = canonicalControlToken(raw);
    const list = byToken.get(token);
    if (list) list.push(binding);
    else byToken.set(token, [binding]);
  }

  // Partager un bouton ne suffit pas : encore faut-il pouvoir répondre en même
  // temps et au même geste. Sans ce tri, une touche commune au siège et à la
  // marche à pied — cas massivement courant, le jeu le fait exprès — ou un
  // appui court associé à un maintien passeraient pour des défauts.
  const flagged = new Set<string>();
  const uncertain = new Set<string>();
  const probableRivals = new Map<string, EditableBinding[]>();
  const uncertainRivals = new Map<string, EditableBinding[]>();
  const appendRival = (map: Map<string, EditableBinding[]>, binding: EditableBinding, rival: EditableBinding) => {
    const key = keyOf(binding);
    const list = map.get(key) ?? [];
    list.push(rival);
    map.set(key, list);
  };
  for (const [, group] of byToken) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const left = group[i]!, right = group[j]!;
        const level = classifyConflictPair(left, right, pending, rules, reviews);
        if (level === "none") continue;
        const keys = level === "probable" ? flagged : uncertain;
        const map = level === "probable" ? probableRivals : uncertainRivals;
        keys.add(keyOf(left)); keys.add(keyOf(right));
        appendRival(map, left, right); appendRival(map, right, left);
      }
    }
  }

  return { byToken, rules, flagged, uncertain, reviews, probableRivals, uncertainRivals };
}

/** Les autres commandes qui occupent le même usage dans un contexte compatible. */
export function rivalsOf(
  binding: EditableBinding,
  pending: Map<string, string | null>,
  conflicts: ConflictIndex,
): EditableBinding[] {
  const raw = effectiveToken(binding, pending);
  if (raw === null) return [];
  return (conflicts.byToken.get(canonicalControlToken(raw)) ?? []).filter(other =>
    other !== binding && classifyConflictPair(binding, other, pending, conflicts.rules, conflicts.reviews) === "probable",
  );
}

export function uncertainRivalsOf(binding: EditableBinding, pending: Map<string, string | null>, conflicts: ConflictIndex): EditableBinding[] {
  const raw = effectiveToken(binding, pending);
  if (raw === null) return [];
  return (conflicts.byToken.get(canonicalControlToken(raw)) ?? []).filter(other =>
    other !== binding && classifyConflictPair(binding, other, pending, conflicts.rules, conflicts.reviews) === "uncertain",
  );
}

export function hasUncertainConflict(binding: EditableBinding, _pending: Map<string, string | null>, conflicts: ConflictIndex): boolean {
  return conflicts.uncertain.has(keyOf(binding));
}

export function hasConflict(
  binding: EditableBinding,
  _pending: Map<string, string | null>,
  conflicts: ConflictIndex,
): boolean {
  return conflicts.flagged.has(keyOf(binding));
}
