import type { SetupMode } from "./lib/filter";
/**
 * Barre d'outils de l'éditeur.
 *
 * Elle remplace trois panneaux qui occupaient en permanence le haut de
 * l'écran — points de restauration, sonde d'écoute, avertissement de périmètre.
 * Aucun n'a disparu : ils sont devenus un bouton, un voyant et une info-bulle.
 * Ce qu'on consulte une fois n'a pas à rester déplié.
 */
export default function EditorToolbar({ profilePath, mode, onModeChange, listening, deviceCount, captureError, probe, onClearProbe, onRestored, }: {
    profilePath: string;
    mode: SetupMode | "all";
    onModeChange: (mode: SetupMode | "all") => void;
    listening: boolean;
    deviceCount: number;
    captureError: string | null;
    /** Contrôle actionné à l'instant, s'il y en a un. */
    probe: {
        device: string;
        control: string;
        matches: number;
    } | null;
    onClearProbe: () => void;
    onRestored: () => void;
}): import("react").JSX.Element;
