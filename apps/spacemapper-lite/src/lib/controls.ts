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

/** Axes DirectInput, dans l'ordre où le jeu les nomme. */
const AXES = ["x", "y", "z", "rotx", "roty", "rotz", "slider1", "slider2"];

const HAT_DIRECTIONS = ["up", "right", "down", "left"];

export interface ControlOption {
  /** Valeur écrite dans le XML, ex. `button12`. */
  value: string;
  /** Libellé affiché, ex. « Bouton 12 ». */
  label: string;
  group: "Boutons" | "Axes" | "Chapeaux";
}

/** Contrôles disponibles sur un périphérique donné. */
export function controlsFor(device: DeviceView): ControlOption[] {
  const options: ControlOption[] = [];

  for (let i = 1; i <= device.buttons; i++) {
    options.push({ value: `button${i}`, label: `Bouton ${i}`, group: "Boutons" });
  }

  // DirectInput ne dit pas *lesquels* des axes sont présents, seulement
  // combien. On expose donc les premiers de la convention, ce qui couvre les
  // manches courants sans inventer d'axes exotiques.
  for (const axis of AXES.slice(0, device.axes)) {
    options.push({ value: axis, label: `Axe ${axis}`, group: "Axes" });
  }

  for (let hat = 1; hat <= device.povs; hat++) {
    for (const direction of HAT_DIRECTIONS) {
      options.push({
        value: `hat${hat}_${direction}`,
        label: `Chapeau ${hat} — ${directionLabel(direction)}`,
        group: "Chapeaux",
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
export function controlLabel(control: string): string {
  const button = /^button(\d+)$/.exec(control);
  if (button) return `Bouton ${button[1]}`;

  const hat = /^hat(\d+)_(\w+)$/.exec(control);
  if (hat) return `Chapeau ${hat[1]} — ${directionLabel(hat[2]!)}`;

  const slider = /^slider(\d+)$/.exec(control);
  if (slider) return `Curseur ${slider[1]}`;

  return `Axe ${control}`;
}

function directionLabel(direction: string): string {
  switch (direction) {
    case "up":
      return "haut";
    case "down":
      return "bas";
    case "left":
      return "gauche";
    case "right":
      return "droite";
    default:
      return direction;
  }
}

/**
 * Préfixe `jsN` à attribuer à un périphérique.
 *
 * Le jeu numérote les joysticks selon son propre ordre d'énumération, que
 * SpaceMapper Lite ne corrige pas — c'est justement ce que l'édition Premium
 * apporte. On se cale donc sur l'ordre de détection, et l'interface affiche
 * le préfixe pour que l'utilisateur puisse vérifier lui-même.
 */
export function devicePrefix(index: number): string {
  return `js${index + 1}`;
}
