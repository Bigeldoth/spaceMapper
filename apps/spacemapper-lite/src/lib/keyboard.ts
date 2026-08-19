/**
 * Traduction d'un appui clavier vers le vocabulaire de Star Citizen.
 *
 * On lit `KeyboardEvent.code` et non `.key` : `code` désigne la **position
 * physique** de la touche, indépendamment de la disposition. Star Citizen
 * raisonne lui aussi en scancodes, donc un joueur AZERTY qui appuie sur la
 * touche marquée « A » doit produire `q` — la même valeur que le jeu écrira.
 * Utiliser `.key` produirait `a`, et le binding serait muet en jeu.
 *
 * ⚠️ **Portée de la vérification.** Seuls `lshift`, `ralt` et les lettres
 * minuscules ont été confirmés sur des fichiers réels. Le reste suit la
 * convention CryEngine, cohérente mais non vérifiée : la liste complète vit
 * dans `Data.p4k`, que la Phase 3 saura lire. En attendant, l'interface
 * affiche toujours le jeton produit avant de l'appliquer, pour que l'écart
 * éventuel soit visible plutôt que silencieux.
 */

/** Modificateurs, reconnus séparément de la touche principale. */
const MODIFIERS: Record<string, string> = {
  ShiftLeft: "lshift",
  ShiftRight: "rshift",
  ControlLeft: "lctrl",
  ControlRight: "rctrl",
  AltLeft: "lalt",
  AltRight: "ralt",
};

/** Touches nommées, hors lettres et chiffres qui suivent une règle. */
const NAMED: Record<string, string> = {
  Space: "space",
  Enter: "enter",
  Escape: "escape",
  Tab: "tab",
  Backspace: "backspace",
  CapsLock: "capslock",

  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",

  Insert: "insert",
  Delete: "delete",
  Home: "home",
  End: "end",
  PageUp: "pgup",
  PageDown: "pgdn",

  Minus: "minus",
  Equal: "equals",
  BracketLeft: "lbracket",
  BracketRight: "rbracket",
  Semicolon: "semicolon",
  Quote: "apostrophe",
  Backquote: "tilde",
  Backslash: "backslash",
  Comma: "comma",
  Period: "period",
  Slash: "slash",

  NumpadAdd: "np_add",
  NumpadSubtract: "np_subtract",
  NumpadMultiply: "np_multiply",
  NumpadDivide: "np_divide",
  NumpadDecimal: "np_period",
  NumpadEnter: "np_enter",

  PrintScreen: "print",
  ScrollLock: "scrolllock",
  Pause: "pause",
};

export interface CaptureResult {
  /** Jeton complet à écrire, ex. `kb1_lshift+f`. */
  token: string;
  /** Libellé lisible, ex. « Maj gauche + F ». */
  label: string;
}

export type CaptureError =
  | { kind: "modifier_only" }
  | { kind: "too_many_modifiers" }
  | { kind: "unsupported"; code: string };

/**
 * Convertit un appui en jeton Star Citizen.
 *
 * Renvoie une erreur explicite plutôt que `null` : l'utilisateur doit savoir
 * *pourquoi* son appui n'a pas été retenu.
 */
export function capture(
  event: KeyboardEvent,
): { ok: true; value: CaptureResult } | { ok: false; error: CaptureError } {
  // Un modificateur seul ne constitue pas une assignation : l'utilisateur est
  // en train de composer son raccourci, on attend la touche principale.
  if (event.code in MODIFIERS) {
    return { ok: false, error: { kind: "modifier_only" } };
  }

  const held: string[] = [];
  if (event.shiftKey) held.push(event.location === 2 ? "rshift" : "lshift");
  if (event.ctrlKey) held.push("lctrl");
  if (event.altKey) held.push("ralt");

  // Le jeu n'écrit qu'un modificateur devant la touche. Accepter une
  // combinaison plus riche produirait un jeton qu'il ignorerait en silence.
  if (held.length > 1) {
    return { ok: false, error: { kind: "too_many_modifiers" } };
  }

  const key = keyName(event.code);
  if (!key) {
    return { ok: false, error: { kind: "unsupported", code: event.code } };
  }

  const modifier = held[0];
  const control = modifier ? `${modifier}+${key}` : key;
  return {
    ok: true,
    value: {
      token: `kb1_${control}`,
      label: modifier ? `${modifierLabel(modifier)} + ${keyLabel(key)}` : keyLabel(key),
    },
  };
}

function keyName(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-2])$/.test(code)) return code.toLowerCase();
  if (/^Numpad[0-9]$/.test(code)) return `np_${code.slice(6)}`;
  return NAMED[code] ?? null;
}

const MODIFIER_LABELS: Record<string, string> = {
  lshift: "Maj gauche",
  rshift: "Maj droite",
  lctrl: "Ctrl gauche",
  rctrl: "Ctrl droit",
  lalt: "Alt gauche",
  ralt: "Alt Gr",
};

function modifierLabel(modifier: string): string {
  return MODIFIER_LABELS[modifier] ?? modifier;
}

const KEY_LABELS: Record<string, string> = {
  space: "Espace",
  enter: "Entrée",
  escape: "Échap",
  tab: "Tab",
  backspace: "Retour arrière",
  capslock: "Verr. Maj",
  up: "Flèche haut",
  down: "Flèche bas",
  left: "Flèche gauche",
  right: "Flèche droite",
  insert: "Inser",
  delete: "Suppr",
  home: "Origine",
  end: "Fin",
  pgup: "Page préc.",
  pgdn: "Page suiv.",
};

function keyLabel(key: string): string {
  if (KEY_LABELS[key]) return KEY_LABELS[key];
  if (key.startsWith("np_")) return `Pavé num. ${key.slice(3)}`;
  return key.toUpperCase();
}

/** Message d'erreur destiné à l'utilisateur. */
export function captureErrorMessage(error: CaptureError): string {
  switch (error.kind) {
    case "modifier_only":
      return "Maintenez le modificateur et appuyez sur la touche voulue.";
    case "too_many_modifiers":
      return "Star Citizen n'accepte qu'un seul modificateur par raccourci.";
    case "unsupported":
      return `Touche non reconnue (${error.code}). Choisissez-en une autre.`;
  }
}
