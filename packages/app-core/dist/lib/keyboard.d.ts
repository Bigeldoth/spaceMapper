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
export declare function useKeyboardLayoutMap(): Map<string, string> | null;
/** Libellé lisible d'un nom de contrôle, dans la langue de l'interface. */
export declare function controlLabel(control: string, t: Translate): string;
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
export declare function keycapLabel(control: string, layoutMap: Map<string, string> | null, t: Translate): string;
/**
 * Libellé complet d'une capture, modificateur compris.
 *
 * `layoutMap` est optionnel : les appelants qui ne l'ont pas encore adopté
 * gardent le comportement d'avant (position QWERTY).
 */
export declare function describe(result: CaptureResult, t: Translate, layoutMap?: Map<string, string> | null): string;
/** Message d'erreur destiné à l'utilisateur. */
export declare function captureErrorMessage(error: CaptureError, t: Translate): string;
