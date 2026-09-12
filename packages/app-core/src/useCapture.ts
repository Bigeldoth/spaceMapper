import { useCallback, useEffect, useRef, useState } from "react";
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
  reset: () => Promise<void>;
}

interface CaptureRun {
  cancelled: boolean;
  resetGeneration: number;
  pendingResets: number;
  started: Promise<number>;
  resetQueue: Promise<void>;
}

export function useCapture(devices: DeviceView[], enabled: boolean): CaptureFeed {
  const [last, setLast] = useState<CapturedInput | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runRef = useRef<CaptureRun | null>(null);

  // Clé de valeur, et non de référence : la liste des périphériques est
  // recalculée à chaque rendu, mais son contenu change rarement.
  const guids = devices.map((d) => d.instance_guid).join("|");

  useEffect(() => {
    setLast(null);
    setListening(false);
    setError(null);
    if (!enabled || guids === "") {
      return;
    }

    let timer: number | null = null;

    // On conserve la promesse de démarrage pour n'arrêter qu'une session
    // réellement ouverte. React réexécute les effets en développement, et un
    // arrêt tardif fermerait la session que le remontage vient d'ouvrir.
    const started = api.startCapture(guids.split("|"));
    const run: CaptureRun = {
      cancelled: false,
      resetGeneration: 0,
      pendingResets: 0,
      started,
      resetQueue: Promise.resolve(),
    };
    runRef.current = run;

    const poll = async () => {
      if (run.cancelled) return;
      const generation = run.resetGeneration;
      if (run.pendingResets === 0) {
        try {
          const found = await api.pollCapture();
          if (!run.cancelled && generation === run.resetGeneration) {
            setLast((current) =>
              current?.guid === found?.guid && current?.control === found?.control
                ? current
                : found,
            );
            setError(null);
          }
        } catch (e) {
          if (!run.cancelled && generation === run.resetGeneration) {
            setError(String(e));
          }
        }
      }
      // Un appel lent ne crée pas une file de sondages IPC. Le prochain ne
      // démarre qu'après la réponse du précédent et la fin d'un éventuel reset.
      if (!run.cancelled) timer = window.setTimeout(poll, 60);
    };

    started.then(
      () => {
        if (run.cancelled) return;
        setListening(true);
        void poll();
      },
      (e) => !run.cancelled && setError(String(e)),
    );

    return () => {
      run.cancelled = true;
      if (runRef.current === run) runRef.current = null;
      if (timer !== null) window.clearTimeout(timer);
      void started.then((id) => api.stopCapture(id)).catch(() => {});
    };
  }, [guids, enabled]);

  const reset = useCallback(async (): Promise<void> => {
    setLast(null);
    const run = runRef.current;
    if (!run || run.cancelled) return;
    run.resetGeneration += 1;
    run.pendingResets += 1;
    // Les resets rapides sont sérialisés. Aucun relevé lancé avant ou pendant
    // l'effacement ne peut réintroduire le contrôle qu'on vient d'oublier.
    const cleared = run.resetQueue.then(async () => {
      await run.started;
      if (!run.cancelled) await api.clearCapture();
    });
    run.resetQueue = cleared.catch(() => {});
    try {
      await cleared;
    } catch (e) {
      if (!run.cancelled) setError(String(e));
    } finally {
      run.pendingResets -= 1;
      run.resetGeneration += 1;
      if (!run.cancelled) setLast(null);
    }
  }, []);

  return {
    last,
    listening,
    error,
    // L'oubli doit aussi porter côté Rust : le thread garde son relevé, et le
    // sondage suivant le restaurerait aussitôt.
    reset,
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
