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
import type { Translate } from "./i18nContext";
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
export type CaptureError = {
    kind: "too_many_modifiers";
} | {
    kind: "unsupported";
    code: string;
};
/** Nom Star Citizen d'une touche modificatrice, ou `null`. */
export declare function modifierOf(code: string): string | null;
/**
 * Construit le jeton d'une assignation.
 *
 * `modifier` est le nom Star Citizen d'une touche modificatrice réellement
 * maintenue, ou `null`. On ne le déduit pas de `event.shiftKey` : ce drapeau ne
 * dit pas *quelle* touche Maj est enfoncée, et une combinaison faite avec la
 * touche droite serait écrite comme si elle venait de la gauche.
 */
export declare function build(modifier: string | null, key: string): CaptureResult;
/**
 * Traduit l'appui d'une touche non modificatrice.
 *
 * Les modificateurs sont traités séparément, au relâchement : un `Maj` seul est
 * une assignation parfaitement valide — c'est la postcombustion par défaut de
 * Star Citizen — et le refuser rendrait la touche clavier la plus courante du
 * jeu inassignable.
 */
export declare function fromKeyPress(code: string, heldModifiers: string[]): {
    ok: true;
    value: CaptureResult;
} | {
    ok: false;
    error: CaptureError;
};
/**
 * Traduit un clic ou un cran de molette.
 *
 * Le préfixe est `mo1_` et non `kb1_` : le jeu traite la souris comme un
 * périphérique distinct, même si le joueur, lui, la considère comme faisant
 * corps avec son clavier.
 */
export declare function fromMouse(button: number, heldModifiers: string[]): {
    ok: true;
    value: CaptureResult;
} | {
    ok: false;
    error: CaptureError;
};
/** Cran de molette. `deltaY` négatif signifie vers le haut. */
export declare function fromWheel(deltaY: number, heldModifiers: string[]): {
    ok: true;
    value: CaptureResult;
} | {
    ok: false;
    error: CaptureError;
};
/** Libellé lisible d'un nom de contrôle, dans la langue de l'interface. */
export declare function controlLabel(control: string, t: Translate): string;
/** Libellé complet d'une capture, modificateur compris. */
export declare function describe(result: CaptureResult, t: Translate): string;
/** Message d'erreur destiné à l'utilisateur. */
export declare function captureErrorMessage(error: CaptureError, t: Translate): string;
