import { type CapturedInput, type DeviceView } from "./lib/api";
/**
 * Session de capture partagée par tout l'éditeur.
 *
 * Une seule session existe à la fois : elle alimente à la fois la mise en
 * évidence des assignations actionnées et le sélecteur de contrôle. Les faire
 * cohabiter en ouvrant deux sessions concurrentes reviendrait à ce que la
 * seconde ferme la première.
 *
 * La session couvre **tous** les périphériques, manches et manettes confondus :
 * l'utilisateur actionne ce qu'il veut, et on reconnaît lequel a bougé.
 */
export interface CaptureFeed {
    /** Dernier contrôle relevé, ou `null` si rien n'a encore été actionné. */
    last: CapturedInput | null;
    /** La session est-elle ouverte ? Distingue « rien actionné » de « inactif ». */
    listening: boolean;
    error: string | null;
    /** Oublie le dernier relevé, pour repartir d'une capture propre. */
    reset: () => void;
}
export declare function useCapture(devices: DeviceView[], enabled: boolean): CaptureFeed;
/**
 * Jeton d'assignation correspondant au contrôle relevé, ex. `js2_button5`.
 *
 * Renvoie `null` si le périphérique n'est pas dans la liste connue — un manche
 * débranché entre la capture et l'affichage, par exemple.
 */
export declare function capturedToken(captured: CapturedInput | null, devices: DeviceView[], prefixOf: (device: DeviceView) => string): string | null;
