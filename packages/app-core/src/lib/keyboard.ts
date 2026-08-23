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

import { useEffect, useState } from "react";
import type { Translate } from "./i18nContext";

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

/**
 * Boutons de souris, nommés comme Star Citizen les nomme.
 *
 * `mouse1`, `mouse2`, `mouse3`, `mwheel_up` et `mwheel_down` sont relevés dans
 * `defaultProfile.xml` — le jeu s'en sert pour ses propres défauts. Les clés
 * sont les valeurs de `MouseEvent.button` : 0 gauche, 1 molette, 2 droit.
 * Attention à l'inversion, le milieu vaut `mouse3` et le droit `mouse2`.
 *
 * `mouse4` et `mouse5` suivent la convention sans être attestés : le jeu
 * n'assigne rien aux boutons latéraux par défaut.
 */
const MOUSE_BUTTONS: Record<number, string> = {
  0: "mouse1",
  1: "mouse3",
  2: "mouse2",
  3: "mouse4",
  4: "mouse5",
};

export interface CaptureResult {
  /** Jeton complet à écrire, ex. `kb1_lshift+f`. */
  token: string;
  /** Nom Star Citizen du modificateur maintenu, ou `null`. */
  modifier: string | null;
  /** Nom Star Citizen du contrôle, ex. `f`, `mouse1`, `np_5`. */
  control: string;
}

/**
 * Fonction de traduction, telle que la fournit `useT`.
 *
 * Le libellé lisible n'est plus calculé ici : ce module ne connaît pas la
 * langue de l'interface, et les noms qu'il produisait — « Maj gauche »,
 * « Clic droit » — restaient en français quel que soit le réglage.
 */

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
  const full = modifier ? `${modifier}+${key}` : key;
  return { token: `kb1_${full}`, modifier, control: key };
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

/**
 * Traduit un clic ou un cran de molette.
 *
 * Le préfixe est `mo1_` et non `kb1_` : le jeu traite la souris comme un
 * périphérique distinct, même si le joueur, lui, la considère comme faisant
 * corps avec son clavier.
 */
export function fromMouse(
  button: number,
  heldModifiers: string[],
): { ok: true; value: CaptureResult } | { ok: false; error: CaptureError } {
  if (heldModifiers.length > 1) {
    return { ok: false, error: { kind: "too_many_modifiers" } };
  }

  const control = MOUSE_BUTTONS[button];
  if (!control) {
    return { ok: false, error: { kind: "unsupported", code: `mouse${button}` } };
  }

  return { ok: true, value: buildMouse(heldModifiers[0] ?? null, control) };
}

/** Cran de molette. `deltaY` négatif signifie vers le haut. */
export function fromWheel(
  deltaY: number,
  heldModifiers: string[],
): { ok: true; value: CaptureResult } | { ok: false; error: CaptureError } {
  if (heldModifiers.length > 1) {
    return { ok: false, error: { kind: "too_many_modifiers" } };
  }
  if (deltaY === 0) {
    return { ok: false, error: { kind: "unsupported", code: "mwheel" } };
  }

  const control = deltaY < 0 ? "mwheel_up" : "mwheel_down";
  return { ok: true, value: buildMouse(heldModifiers[0] ?? null, control) };
}

function buildMouse(modifier: string | null, control: string): CaptureResult {
  const full = modifier ? `${modifier}+${control}` : control;
  return { token: `mo1_${full}`, modifier, control };
}

function keyName(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-2])$/.test(code)) return code.toLowerCase();
  if (/^Numpad[0-9]$/.test(code)) return `np_${code.slice(6)}`;
  return NAMED[code] ?? null;
}

/**
 * `KeyboardEvent.code` d'une lettre ou d'un chiffre nommé à la Star Citizen —
 * l'inverse de `keyName()`. Sert uniquement à retrouver, pour affichage, ce
 * que la disposition courante produit à cette position physique.
 */
function codeForKeyName(name: string): string | null {
  if (/^[a-z]$/.test(name)) return `Key${name.toUpperCase()}`;
  if (/^[0-9]$/.test(name)) return `Digit${name}`;
  return null;
}

/**
 * Disposition clavier courante, position physique → caractère produit.
 *
 * `KeyboardEvent.code` (utilisé pour écrire dans le fichier, voir le
 * commentaire de module) est indépendant de la disposition — c'est vital pour
 * que le jeu relise la bonne touche, mais ça veut aussi dire qu'un joueur
 * AZERTY qui appuie sur la touche marquée « A » voit SpaceMapper lui annoncer
 * « Q » : la lettre à la position QWERTY de son clavier. Cette table sert
 * uniquement à *afficher* la bonne lettre, jamais à décider quoi écrire.
 *
 * La `Keyboard API` (Chromium, donc disponible dans le WebView2 de Tauri) est
 * la seule source fiable : aucune bibliothèque de dispositions clavier ne
 * suffirait, l'utilisateur peut avoir configuré n'importe quoi. Absente ou en
 * échec (dispositions plus anciennes, permission refusée), l'affichage
 * retombe silencieusement sur la position QWERTY — le comportement d'avant
 * cette fonctionnalité, jamais pire.
 */
export function useKeyboardLayoutMap(): Map<string, string> | null {
  const [map, setMap] = useState<Map<string, string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const kb = (navigator as { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } })
      .keyboard;
    if (!kb?.getLayoutMap) return;

    kb.getLayoutMap()
      .then((layoutMap) => {
        if (!cancelled) setMap(layoutMap);
      })
      .catch(() => {
        // Permission refusée ou API indisponible : on reste sur le repli QWERTY.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return map;
}

/**
 * Noms de contrôle qui méritent un libellé lisible, et leur clé de traduction.
 *
 * Tout ce qui n'y figure pas se lit déjà bien de lui-même : une lettre, un
 * chiffre ou `F5` n'ont pas besoin d'être traduits.
 */
const LABELS: Record<string, string> = {
  lshift: "key.lshift",
  rshift: "key.rshift",
  lctrl: "key.lctrl",
  rctrl: "key.rctrl",
  lalt: "key.lalt",
  ralt: "key.ralt",

  space: "key.space",
  enter: "key.enter",
  escape: "key.escape",
  tab: "key.tab",
  backspace: "key.backspace",
  capslock: "key.capslock",
  up: "key.up",
  down: "key.down",
  left: "key.left",
  right: "key.right",
  insert: "key.insert",
  delete: "key.delete",
  home: "key.home",
  end: "key.end",
  pgup: "key.pgup",
  pgdn: "key.pgdn",

  mouse1: "key.mouse1",
  mouse2: "key.mouse2",
  mouse3: "key.mouse3",
  mouse4: "key.mouse4",
  mouse5: "key.mouse5",
  mwheel_up: "key.mwheelUp",
  mwheel_down: "key.mwheelDown",
};

/** Libellé lisible d'un nom de contrôle, dans la langue de l'interface. */
export function controlLabel(control: string, t: Translate): string {
  const key = LABELS[control];
  if (key) return t(key);
  if (control.startsWith("np_")) return `${t("key.numpad")} ${control.slice(3)}`;
  return control.toUpperCase();
}

/**
 * Libellé d'un contrôle **clavier**, conscient de la disposition si elle est
 * connue — voir `useKeyboardLayoutMap`. Sans elle (`layoutMap` nul), se
 * comporte exactement comme `controlLabel`.
 *
 * Ne s'applique qu'aux lettres et chiffres nus : les touches nommées
 * (`lshift`, `enter`…) ont déjà un libellé traduit et invariant, et une
 * disposition qui produit un symbole à la place d'un chiffre (`&` pour `1` en
 * AZERTY non maintenu) ne vaut pas mieux que le repli — la garde
 * `[a-z0-9]` l'exclut explicitement.
 */
export function keycapLabel(
  control: string,
  layoutMap: Map<string, string> | null,
  t: Translate,
): string {
  if (layoutMap && /^[a-z0-9]$/.test(control)) {
    const code = codeForKeyName(control);
    const produced = code ? layoutMap.get(code) : undefined;
    if (produced && /^[a-z0-9]$/i.test(produced)) return produced.toUpperCase();
  }
  return controlLabel(control, t);
}

/**
 * Libellé complet d'une capture, modificateur compris.
 *
 * `layoutMap` est optionnel : les appelants qui ne l'ont pas encore adopté
 * gardent le comportement d'avant (position QWERTY).
 */
export function describe(
  result: CaptureResult,
  t: Translate,
  layoutMap?: Map<string, string> | null,
): string {
  const control = keycapLabel(result.control, layoutMap ?? null, t);
  return result.modifier
    ? `${controlLabel(result.modifier, t)} + ${control}`
    : control;
}

/** Message d'erreur destiné à l'utilisateur. */
export function captureErrorMessage(
  error: CaptureError,
  t: Translate,
): string {
  switch (error.kind) {
    case "too_many_modifiers":
      return t("capture.tooManyModifiers");
    case "unsupported":
      return `${t("capture.unsupported")} (${error.code})`;
  }
}
