/**
 * Traduction de la manière dont le jeu déclenche une assignation.
 *
 * `activationMode`/`multiTap` existent aussi bien côté surcharges (l'attribut
 * brut du joueur) que côté valeurs par défaut du jeu (voir `defaults.rs`) :
 * une esquive jamais surchargée est un double-appui *par défaut*, et rien
 * dans `actionmaps.xml` ne le dit. Les valeurs listées ici ont été relevées
 * sur le profil par défaut réel du jeu (`defaultProfile.xml` extrait de
 * `Data.p4k`, août 2026) — `press` et `tap` dominent largement (plus de 500
 * occurrences à eux deux) et correspondent à « une pression suffit », le
 * fonctionnement qu'un joueur attend sans qu'on le lui dise. Tout le reste
 * mérite un badge : c'est précisément ce qui surprend en jeu si on ne le
 * découvre qu'en ratant une esquive.
 */
import type { Translate } from "./i18nContext";

export type ActivationKind = "tap" | "hold" | "other";

export interface ActivationBadge {
  label: string;
  kind: ActivationKind;
}

/**
 * Geste physique attendu par Star Citizen pour déclencher une assignation.
 *
 * Les variantes d'un même geste (`hold_toggle`, `hold_no_retrigger`, etc.)
 * changent ce que fait le jeu après le déclenchement, pas ce que le joueur
 * doit faire avec le contrôle. Elles partagent donc la même famille pour la
 * détection des conflits.
 *
 * `unknown` est volontairement une valeur joker : lorsqu'un patch du jeu
 * introduit un mode que SpaceMapper ne connaît pas encore, on conserve la
 * fausse alerte plutôt que de masquer un vrai conflit.
 */
export type ActivationGesture =
  | "short_press"
  | "long_press"
  | `multi_tap:${number}`
  | "unknown";

export interface ActivationSource {
  activation_mode: string | null | undefined;
  multi_tap: string | null | undefined;
}

const SHORT_PRESS_MODES = new Set(["", "press", "tap"]);
const LONG_PRESS_MODES = new Set([
  "hold",
  "hold_toggle",
  "hold_no_retrigger",
  "delayed_press",
  "delayed_press_medium",
  "delayed_hold",
  "delayed_hold_long",
  "delayed_hold_no_retrigger",
]);
const DOUBLE_TAP_MODES = new Set(["double_tap", "double_tap_nonblocking"]);

/**
 * Normalise les deux représentations du jeu (`activationMode` et `multiTap`)
 * en geste comparable. Un `multiTap` explicite prime, comme pour le badge.
 */
export function activationGestureOf(source: ActivationSource): ActivationGesture {
  const rawMultiTap = source.multi_tap?.trim();
  if (rawMultiTap) {
    // `parseInt("2x")` donnerait 2, alors que le comportement d'une valeur
    // corrompue est inconnu. Exiger un entier complet garde le diagnostic sûr.
    if (!/^\d+$/.test(rawMultiTap)) return "unknown";
    const taps = Number.parseInt(rawMultiTap, 10);
    if (taps > 1) return `multi_tap:${taps}`;
    if (taps < 1) return "unknown";
  }

  const mode = (source.activation_mode ?? "").trim().toLowerCase();
  if (SHORT_PRESS_MODES.has(mode)) return "short_press";
  if (LONG_PRESS_MODES.has(mode)) return "long_press";
  if (DOUBLE_TAP_MODES.has(mode)) return "multi_tap:2";
  return "unknown";
}

/**
 * Deux assignations peuvent-elles répondre au même geste physique ?
 *
 * Un appui court, un appui long et un double-appui sont indépendants. Deux
 * variantes appartenant à la même famille se disputent en revanche bien le
 * contrôle. Toute valeur inconnue reste conflictuelle par prudence.
 */
export function activationGesturesOverlap(
  left: ActivationSource,
  right: ActivationSource,
): boolean {
  const leftGesture = activationGestureOf(left);
  const rightGesture = activationGestureOf(right);
  return (
    leftGesture === "unknown" ||
    rightGesture === "unknown" ||
    leftGesture === rightGesture
  );
}

/** Clé de traduction et famille visuelle, par valeur `activationMode` observée. */
const MODES: Record<string, { key: string; kind: ActivationKind }> = {
  tap: { key: "activation.tap", kind: "tap" },
  hold: { key: "activation.hold", kind: "hold" },
  hold_toggle: { key: "activation.holdToggle", kind: "hold" },
  hold_no_retrigger: { key: "activation.hold", kind: "hold" },
  double_tap: { key: "activation.doubleTap", kind: "tap" },
  double_tap_nonblocking: { key: "activation.doubleTap", kind: "tap" },
  delayed_press: { key: "activation.delayedPress", kind: "hold" },
  delayed_press_medium: { key: "activation.delayedPress", kind: "hold" },
  delayed_hold: { key: "activation.delayedHold", kind: "hold" },
  delayed_hold_long: { key: "activation.delayedHold", kind: "hold" },
  delayed_hold_no_retrigger: { key: "activation.delayedHold", kind: "hold" },
  smart_toggle: { key: "activation.smartToggle", kind: "other" },
};

/**
 * Badge à afficher pour une assignation, ou `null` si rien ne mérite de
 * l'être — `press` (l'absence de l'attribut y compris) est la manière
 * normale d'actionner une touche, la signaler partout noierait les cas qui
 * comptent vraiment.
 *
 * Un `multiTap` numérique prime sur `activationMode` quand les deux
 * coexistent : c'est un compte de frappes précis, plus parlant que le mode
 * qui l'accompagne parfois côté surcharges utilisateur.
 */
export function activationBadge(
  activationMode: string | null,
  multiTap: string | null,
  t: Translate,
): ActivationBadge | null {
  // `NaN > 1` est déjà `false` : pas besoin d'un garde-fou séparé pour
  // l'absence ou l'illisibilité de `multiTap`.
  const taps = multiTap ? Number.parseInt(multiTap, 10) : NaN;
  if (taps > 1) {
    return {
      label: taps === 2 ? t("activation.doubleTap") : `${t("activation.multiTap")} ×${taps}`,
      kind: "tap",
    };
  }

  if (!activationMode || activationMode === "press") {
    return null;
  }

  const known = MODES[activationMode];
  if (known) {
    return { label: t(known.key), kind: known.kind };
  }

  // Valeur non cataloguée (le jeu en ajoute au fil des patchs) : on affiche
  // le mot brut plutôt que de rester muet ou d'inventer un libellé.
  return { label: activationMode, kind: "other" };
}
