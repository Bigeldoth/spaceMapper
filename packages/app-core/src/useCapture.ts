import { useEffect, useState } from "react";
import { api, type CapturedInput, type DeviceView } from "./lib/api";

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

export function useCapture(devices: DeviceView[], enabled: boolean): CaptureFeed {
  const [last, setLast] = useState<CapturedInput | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clé de valeur, et non de référence : la liste des périphériques est
  // recalculée à chaque rendu, mais son contenu change rarement.
  const guids = devices.map((d) => d.instance_guid).join("|");

  useEffect(() => {
    if (!enabled || guids === "") {
      setListening(false);
      return;
    }

    let cancelled = false;
    setError(null);
    setListening(false);

    // On conserve la promesse de démarrage pour n'arrêter qu'une session
    // réellement ouverte. React réexécute les effets en développement, et un
    // arrêt tardif fermerait la session que le remontage vient d'ouvrir.
    const started = api.startCapture(guids.split("|"));
    started.then(
      () => !cancelled && setListening(true),
      (e) => !cancelled && setError(String(e)),
    );

    const timer = window.setInterval(async () => {
      try {
        const found = await api.pollCapture();
        if (!cancelled && found) setLast(found);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }, 60);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      void started.then((id) => api.stopCapture(id)).catch(() => {});
    };
  }, [guids, enabled]);

  return {
    last,
    listening,
    error,
    // L'oubli doit aussi porter côté Rust : le thread garde son relevé, et le
    // sondage suivant le restaurerait aussitôt.
    reset: () => {
      setLast(null);
      void api.clearCapture().catch(() => {});
    },
  };
}

/**
 * Jeton d'assignation correspondant au contrôle relevé, ex. `js2_button5`.
 *
 * Renvoie `null` si le périphérique n'est pas dans la liste connue — un manche
 * débranché entre la capture et l'affichage, par exemple.
 */
export function capturedToken(
  captured: CapturedInput | null,
  devices: DeviceView[],
  prefixOf: (device: DeviceView) => string,
): string | null {
  if (!captured) return null;
  const device = devices.find((d) => d.instance_guid === captured.guid);
  return device ? `${prefixOf(device)}_${captured.control}` : null;
}
