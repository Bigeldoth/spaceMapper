/**
 * Traduction d'un appui clavier vers le vocabulaire de Star Citizen.
 *
 * On lit `KeyboardEvent.code` et non `.key` : `code` désigne la **position
 * physique** de la touche, indépendamment de la disposition. Star Citizen
 * raisonne lui aussi en scancodes, donc un joueur AZERTY qui appuie sur la
 * touche marquée « A » doit produire `q` — la même valeur que le jeu écrira.
 * Utiliser `.key` produirait `a`, et le binding serait muet en jeu.
 *
 * **Portée de la vérification.** Cette table a été confrontée aux 99 noms de
 * touches employés par `defaultProfile.xml`, le fichier de CIG lui-même
 * (`cargo run -p spacemapper-core --example keyboard_vocabulary`). Tous les
 * noms que nous produisons *et* que le jeu emploie concordent exactement :
 * modificateurs, flèches, navigation, pavé numérique, `lbracket`/`rbracket`,
 * `equals`, `minus`, `pgup`/`pgdn`, lettres, chiffres et F1–F12.
 *
 * Onze noms restent sans preuve — `apostrophe`, `backslash`, `capslock`,
 * `delete`, `insert`, `np_enter`, `period`, `print`, `scrolllock`,
 * `semicolon`, `tilde` — simplement parce que le jeu ne les assigne à rien
 * par défaut. Ils suivent la même convention que leurs voisins confirmés.
 *
 * À noter : le fichier de CIG n'est pas normalisé. On y trouve `K` en
 * majuscule et `]` littéral à côté de `k` et `rbracket`. Le jeu accepte donc
 * plusieurs formes ; nous n'émettons que la forme canonique, celle qui est
 * attestée majoritairement.
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
  | { kind: "too_many_modifiers" }
  | { kind: "unsupported"; code: string };

/** Nom Star Citizen d'une touche modificatrice, ou `null`. */
export function modifierOf(code: string): string | null {
  return MODIFIERS[code] ?? null;
}

/**
 * Construit le jeton d'une assignation.
 *
 * `modifier` est le nom Star Citizen d'une touche modificatrice réellement
 * maintenue, ou `null`. On ne le déduit pas de `event.shiftKey` : ce drapeau ne
 * dit pas *quelle* touche Maj est enfoncée, et une combinaison faite avec la
 * touche droite serait écrite comme si elle venait de la gauche.
 */
export function build(modifier: string | null, key: string): CaptureResult {
  const control = modifier ? `${modifier}+${key}` : key;
  return {
    token: `kb1_${control}`,
    label: modifier
      ? `${modifierLabel(modifier)} + ${keyLabel(key)}`
      : keyLabel(key),
  };
}

/**
 * Traduit l'appui d'une touche non modificatrice.
 *
 * Les modificateurs sont traités séparément, au relâchement : un `Maj` seul est
 * une assignation parfaitement valide — c'est la postcombustion par défaut de
 * Star Citizen — et le refuser rendrait la touche clavier la plus courante du
 * jeu inassignable.
 */
export function fromKeyPress(
  code: string,
  heldModifiers: string[],
): { ok: true; value: CaptureResult } | { ok: false; error: CaptureError } {
  // Le jeu n'écrit qu'un modificateur devant la touche. En accepter deux
  // produirait un jeton qu'il ignorerait en silence.
  if (heldModifiers.length > 1) {
    return { ok: false, error: { kind: "too_many_modifiers" } };
  }

  const key = keyName(code);
  if (!key) {
    return { ok: false, error: { kind: "unsupported", code } };
  }

  return { ok: true, value: build(heldModifiers[0] ?? null, key) };
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
  if (MODIFIER_LABELS[key]) return MODIFIER_LABELS[key];
  if (key.startsWith("np_")) return `Pavé num. ${key.slice(3)}`;
  return key.toUpperCase();
}

/** Message d'erreur destiné à l'utilisateur. */
export function captureErrorMessage(error: CaptureError): string {
  switch (error.kind) {
    case "too_many_modifiers":
      return "Star Citizen n'accepte qu'un seul modificateur par raccourci.";
    case "unsupported":
      return `Touche non reconnue (${error.code}). Choisissez-en une autre.`;
  }
}
