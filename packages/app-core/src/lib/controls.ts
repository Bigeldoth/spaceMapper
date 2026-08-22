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
export const AXES = ["x", "y", "z", "rotx", "roty", "rotz", "slider1", "slider2"];

const HAT_DIRECTIONS = ["up", "right", "down", "left"];

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
export function groupLabel(group: ControlGroup, t: Translate): string {
  switch (group) {
    case "buttons":
      return t("control.buttons");
    case "axes":
      return t("control.axes");
    case "hats":
      return t("control.hats");
  }
}

/** Contrôles disponibles sur un périphérique donné. */
export function controlsFor(
  device: DeviceView,
  t: Translate,
): ControlOption[] {
  const options: ControlOption[] = [];

  for (let i = 1; i <= device.buttons; i++) {
    options.push({
      value: `button${i}`,
      label: `${t("control.button")} ${i}`,
      group: "buttons",
    });
  }

  // DirectInput ne dit pas *lesquels* des axes sont présents, seulement
  // combien. On expose donc les premiers de la convention, ce qui couvre les
  // manches courants sans inventer d'axes exotiques.
  for (const axis of AXES.slice(0, device.axes)) {
    options.push({
      value: axis,
      label: `${t("control.axis")} ${axis}`,
      group: "axes",
    });
  }

  for (let hat = 1; hat <= device.povs; hat++) {
    for (const direction of HAT_DIRECTIONS) {
      options.push({
        value: `hat${hat}_${direction}`,
        label: `${t("control.hat")} ${hat} — ${directionLabel(direction, t)}`,
        group: "hats",
      });
    }
  }

  return options;
}

/**
 * Libellé lisible d'un contrôle relevé par la capture.
 *
 * La capture renvoie le nom technique (`hat1_up`) ; l'utilisateur doit
 * reconnaître ce qu'il vient d'actionner sans avoir à décoder.
 */
export function controlLabel(control: string, t: Translate): string {
  const button = /^button(\d+)$/.exec(control);
  if (button) return `${t("control.button")} ${button[1]}`;

  const hat = /^hat(\d+)_(\w+)$/.exec(control);
  if (hat) {
    return `${t("control.hat")} ${hat[1]} — ${directionLabel(hat[2]!, t)}`;
  }

  const slider = /^slider(\d+)$/.exec(control);
  if (slider) return `${t("control.slider")} ${slider[1]}`;

  return `${t("control.axis")} ${control}`;
}

function directionLabel(direction: string, t: Translate): string {
  switch (direction) {
    case "up":
      return t("control.up");
    case "down":
      return t("control.down");
    case "left":
      return t("control.left");
    case "right":
      return t("control.right");
    default:
      return direction;
  }
}

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
export function devicePrefix(devices: DeviceView[], device: DeviceView): string {
  const family = devices.filter((d) => d.category === device.category);
  const rank = family.findIndex(
    (d) => d.instance_guid === device.instance_guid,
  );
  const letters = device.category === "gamepad" ? "gp" : "js";
  return `${letters}${rank + 1}`;
}
