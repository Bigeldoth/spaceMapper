/**
 * Liste des contrôles assignables d'un périphérique.
 *
 * Star Citizen nomme les contrôles selon une convention fixe (`button12`, `x`,
 * `rotz`, `hat1_up`). On dérive la liste des capacités remontées par
 * DirectInput plutôt que de proposer une saisie libre : un nom mal orthographié
 * produirait une assignation silencieusement morte dans le jeu, sans message
 * d'erreur au moment de l'écriture.
 */
import type { DeviceView } from "./api";
import type { Translate } from "./i18nContext";
/**
 * Axes DirectInput, dans l'ordre où le jeu les nomme.
 *
 * Exportée (et non locale à ce fichier) : le wizard d'activités de Premium
 * en a besoin pour vérifier qu'un axe qu'il s'apprête à suggérer existe
 * réellement sur le périphérique visé, sans dupliquer cette convention.
 */
export declare const AXES: string[];
/** Voir la note du même nom dans `keyboard.ts`. */
/** Famille de contrôle, pour regrouper la liste déroulante. */
export type ControlGroup = "buttons" | "axes" | "hats";
export interface ControlOption {
    /** Valeur écrite dans le XML, ex. `button12`. */
    value: string;
    /** Libellé affiché, ex. « Bouton 12 ». */
    label: string;
    /**
     * Code de famille, et non son nom traduit : le regroupement doit survivre
     * à un changement de langue.
     */
    group: ControlGroup;
}
/** Titre traduit d'une famille de contrôles. */
export declare function groupLabel(group: ControlGroup, t: Translate): string;
/** Contrôles disponibles sur un périphérique donné. */
export declare function controlsFor(device: DeviceView, t: Translate): ControlOption[];
/**
 * Libellé lisible d'un contrôle relevé par la capture.
 *
 * La capture renvoie le nom technique (`hat1_up`) ; l'utilisateur doit
 * reconnaître ce qu'il vient d'actionner sans avoir à décoder.
 */
export declare function controlLabel(control: string, t: Translate): string;
/**
 * Préfixe d'un périphérique, tel que le jeu l'écrit.
 *
 * Le rang est compté **au sein de sa famille** : le premier joystick est `js1`
 * et la première manette `gp1`, même si Windows les a énumérés dans un autre
 * ordre. Mélanger les deux familles décalerait tous les index.
 *
 * Le jeu numérote selon son propre ordre d'énumération, que SpaceMapper ne
 * corrige pas encore (réparation de l'ordre des périphériques : à venir). On
 * se cale donc sur l'ordre de détection, et l'interface affiche le préfixe
 * pour que l'utilisateur puisse vérifier lui-même.
 */
export declare function devicePrefix(devices: DeviceView[], device: DeviceView): string;
