/**
 * Traduction de la manière dont le jeu déclenche une assignation.
 *
 * `activationMode`/`multiTap` existent aussi bien côté surcharges (l'attribut
 * brut du joueur) que côté valeurs par défaut du jeu (voir `defaults.rs`) :
 * une esquive jamais surchargée est un double-appui *par défaut*, et rien
 * dans `actionmaps.xml` ne le dit. Les valeurs listées ici ont été relevées
 * sur le profil par défaut réel du jeu (`defaultProfile.xml` extrait de
 * `Data.p4k`, août 2026) — `press` et `tap` dominent largement (plus de 500
 * occurrences à eux deux). `press` réagit immédiatement ; `tap` attend un
 * relâchement bref. Le badge rend visible cette différence lors du mapping.
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
 * Cette famille sert à l'affichage et aux anciens appelants sans attributs
 * résolus. Le diagnostic utilise `triggerSignatureOf` : un déclencheur inconnu
 * apparaît dans « À vérifier », sans être traité comme un conflit probable.
 */
export type ActivationGesture =
  | "immediate"
  | "short_press"
  | "long_press"
  | `multi_tap:${number}`
  | "unknown";

export interface ActivationSource {
  activation_mode: string | null | undefined;
  multi_tap: string | null | undefined;
  trigger_attributes?: Record<string, string>;
  input_raw?: string;
  device?: string | null;
  control?: string | null;
}

/** Même contrat que les signatures du carnet : événements, seuils et délais. */
export type TriggerSignature = { kind: "continuous_axis" } | {
  kind: "button";
  onpress: boolean;
  onhold: boolean;
  onrelease: boolean;
  multitap: number;
  presstriggerthreshold: number;
  releasetriggerthreshold: number;
  holdtriggerdelay: number;
  releasetriggerdelay: number;
};

const AXIS_CONTROLS = new Set(["x", "y", "z", "rotx", "roty", "rotz", "slider", "slider1", "slider2"]);
const TRIGGER_FLAGS = ["onpress", "onhold", "onrelease"] as const;
const TRIGGER_NUMBERS = {
  multitap: 1, presstriggerthreshold: -1, releasetriggerthreshold: -1,
  holdtriggerdelay: 0, releasetriggerdelay: 0,
} as const;

function finiteNumber(raw: string | number): number | null {
  if (typeof raw === "string" && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim())) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

/**
 * Aucun mode implicite n'est inventé : sans événements résolus, le bouton
 * reste inconnu. Les modes nommés sont développés par le backend à partir
 * des définitions de la version installée du jeu.
 */
export function triggerSignatureOf(source: ActivationSource, effectiveInput?: string | null): TriggerSignature | null {
  const attrs = Object.fromEntries(Object.entries(source.trigger_attributes ?? {}).map(([key, value]) => [key.toLowerCase(), value]));
  if (source.multi_tap !== null && source.multi_tap !== undefined) attrs.multitap = source.multi_tap;
  const token = (effectiveInput === undefined ? source.input_raw ?? `${source.device ?? ""}_${source.control ?? ""}` : effectiveInput ?? "").trim().toLowerCase();
  const match = /^(js|gp)\d+_(.+)$/.exec(token);
  const control = match?.[2]?.split("+").at(-1)?.trim();
  if (match && control && AXIS_CONTROLS.has(control)) {
    if (!["0", "false"].includes(String(attrs.useanalogcompare ?? "0").trim().toLowerCase())) return null;
    return { kind: "continuous_axis" };
  }
  if (!TRIGGER_FLAGS.some(key => key in attrs)) return null;
  const flags: Record<string, boolean> = {};
  for (const key of TRIGGER_FLAGS) {
    const value = String(attrs[key] ?? "0").trim().toLowerCase();
    if (["true", "false"].includes(value)) flags[key] = value === "true";
    else {
      const number = finiteNumber(value);
      if (number !== 0 && number !== 1) return null;
      flags[key] = number === 1;
    }
  }
  if (!TRIGGER_FLAGS.some(key => flags[key])) return null;
  const numbers: Record<string, number> = {};
  for (const [key, fallback] of Object.entries(TRIGGER_NUMBERS)) {
    const number = finiteNumber(attrs[key] ?? fallback);
    if (number === null) return null;
    numbers[key] = number;
  }
  return { kind: "button", ...flags, ...numbers } as TriggerSignature;
}

/** Stable malgré l'ordre des propriétés JSON ; refuse les observations mal formées. */
export function triggerSignatureKey(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const signature = value as Record<string, unknown>;
  if (signature.kind === "continuous_axis") return "continuous_axis";
  if (signature.kind !== "button") return null;
  if (TRIGGER_FLAGS.some(key => typeof signature[key] !== "boolean")) return null;
  if (!TRIGGER_FLAGS.some(key => signature[key])) return null;
  if (Object.keys(TRIGGER_NUMBERS).some(key => typeof signature[key] !== "number" || !Number.isFinite(signature[key]))) return null;
  return JSON.stringify(["button", ...TRIGGER_FLAGS.map(key => signature[key]), ...Object.keys(TRIGGER_NUMBERS).map(key => signature[key])]);
}

const SHORT_PRESS_MODES = new Set(["tap", "tap_quicker"]);
const IMMEDIATE_MODES = new Set(["", "press", "press_quicker", "hold", "hold_toggle", "hold_no_retrigger", "all", "smart_toggle"]);
const LONG_PRESS_MODES = new Set([
  "delayed_press",
  "delayed_press_quicker",
  "delayed_press_medium",
  "delayed_press_long",
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
  if (IMMEDIATE_MODES.has(mode)) return "immediate";
  if (SHORT_PRESS_MODES.has(mode)) return "short_press";
  if (LONG_PRESS_MODES.has(mode)) return "long_press";
  if (DOUBLE_TAP_MODES.has(mode)) return "multi_tap:2";
  return "unknown";
}

/**
 * Deux assignations occupent-elles le même usage configuré du contrôle ?
 *
 * Un appui simple, un appui prolongé et un multi-appui sont des usages
 * distincts. `press` et `tap` occupent tous deux l'usage simple : le moment
 * du déclenchement ne crée pas une combinaison supplémentaire.
 * Lorsque les attributs résolus sont fournis, les événements et délais exacts
 * priment sur cette famille historique. Sans eux, ce helper conserve sa
 * comparaison de familles ; l'index de diagnostic utilise toujours les
 * signatures résolues et distingue les résultats inconnus.
 */
export function activationGesturesOverlap(
  left: ActivationSource,
  right: ActivationSource,
): boolean {
  if (left.trigger_attributes !== undefined || right.trigger_attributes !== undefined) {
    const a = triggerSignatureKey(triggerSignatureOf(left));
    const b = triggerSignatureKey(triggerSignatureOf(right));
    return a === null || b === null || a === b;
  }
  const usageOf = (source: ActivationSource) => {
    const gesture = activationGestureOf(source);
    return gesture === "immediate" ? "short_press" : gesture;
  };
  const leftGesture = usageOf(left);
  const rightGesture = usageOf(right);
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
