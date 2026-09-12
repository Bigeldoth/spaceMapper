import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  type CapturedInput,
  type DeviceView,
  type LiveInput,
} from "./lib/api";

/** Environ trente images par seconde ; le backend sonde le matériel à 60 Hz. */
const LIVE_POLL_INTERVAL_MS = 32;

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
  /** Contrôles actifs dans la frame courante. Vide dès le relâchement. */
  active: readonly LiveInput[];
  /** Numéro du dernier changement live observé dans cette session. */
  frameSequence: number;
  /** Barrière native de neutralité franchie, si le backend la fournit. */
  captureReady: boolean | undefined;
  /** La session est-elle ouverte ? Distingue « rien actionné » de « inactif ». */
  listening: boolean;
  error: string | null;
  /**
   * Vide le dernier relevé et la frame active, puis attend le clear natif.
   * Renvoie la séquence exacte de la barrière quand le backend la fournit.
   */
  reset: () => Promise<number | null>;
}

interface CaptureRun {
  cancelled: boolean;
  resetGeneration: number;
  pendingResets: number;
  started: Promise<number>;
  resetQueue: Promise<void>;
}

export function useCapture(devices: DeviceView[], enabled: boolean): CaptureFeed {
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const onDocumentVisibility = () => setVisible(!document.hidden);
    const onDesktopVisibility = (event: Event) =>
      setVisible((event as CustomEvent<boolean>).detail);
    document.addEventListener("visibilitychange", onDocumentVisibility);
    window.addEventListener("spacemapper:visibility", onDesktopVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onDocumentVisibility);
      window.removeEventListener("spacemapper:visibility", onDesktopVisibility);
    };
  }, []);
  const [last, setLast] = useState<CapturedInput | null>(null);
  const [active, setActive] = useState<readonly LiveInput[]>([]);
  const [frameSequence, setFrameSequence] = useState(0);
  const [captureReady, setCaptureReady] = useState<boolean | undefined>(undefined);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runRef = useRef<CaptureRun | null>(null);

  // Clé de valeur, et non de référence : la liste des périphériques est
  // recalculée à chaque rendu, mais son contenu change rarement.
  const guids = devices.map((d) => d.instance_guid).join("|");

  useEffect(() => {
    setLast(null);
    setActive([]);
    setFrameSequence(0);
    setCaptureReady(undefined);
    setListening(false);
    setError(null);
    if (!enabled || !visible || guids === "") return;

    let timer: number | null = null;
    let acceptedSequence = -1;
    let acceptedGeneration = 0;

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

    started.then(
      (id) => {
        if (run.cancelled) return;
        setListening(true);

        const poll = async () => {
          if (run.cancelled) return;
          const generation = run.resetGeneration;
          if (run.pendingResets === 0) {
            try {
              const frame = await api.pollLiveCapture(id);
              if (
                !run.cancelled &&
                frame.session_id === id &&
                generation === run.resetGeneration &&
                run.pendingResets === 0
              ) {
                // Chaque reset ouvre une nouvelle fenêtre d'acceptation. La
                // séquence peut rester identique après un clear : il faut alors
                // republier sa barrière et son éventuel tap persistant.
                if (acceptedGeneration !== generation) {
                  acceptedGeneration = generation;
                  acceptedSequence = -1;
                }
                if (frame.sequence > acceptedSequence) {
                  acceptedSequence = frame.sequence;
                  setActive(frame.inputs);
                  setFrameSequence(frame.sequence);
                  setCaptureReady(frame.capture_ready);
                  setLast((current) =>
                    sameCapturedInput(current, frame.last) ? current : frame.last,
                  );
                }
                setError(null);
                setListening(true);
              }
            } catch (e) {
              if (!run.cancelled && generation === run.resetGeneration) {
                setError(String(e));
                setListening(false);
                setActive([]);
                setCaptureReady(undefined);
                acceptedSequence = -1;
              }
            }
          }

          // Aucun chevauchement ni lecture pendant un reset. Une panne
          // transitoire reste visible jusqu'à la prochaine réponse valide.
          if (!run.cancelled) {
            timer = window.setTimeout(poll, LIVE_POLL_INTERVAL_MS);
          }
        };

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
  }, [guids, enabled, visible]);

  const reset = useCallback(async (): Promise<number | null> => {
    setLast(null);
    setActive([]);
    setCaptureReady(undefined);
    const run = runRef.current;
    if (!run || run.cancelled) return null;
    run.resetGeneration += 1;
    run.pendingResets += 1;

    // Les resets rapides sont sérialisés et attendent leur propre démarrage.
    // Une ancienne session ne doit jamais effacer celle qui l'a remplacée.
    const cleared = run.resetQueue.then(async () => {
      await run.started;
      return run.cancelled ? null : api.clearCapture();
    });
    run.resetQueue = cleared.then(() => {}, () => {});
    try {
      return await cleared;
    } catch (e) {
      if (!run.cancelled) setError(String(e));
      return null;
    } finally {
      // Invalide également les réponses lancées pendant l'effacement. La
      // prochaine frame live republiera ensuite la barrière de neutralité.
      run.pendingResets -= 1;
      run.resetGeneration += 1;
      if (!run.cancelled) {
        setLast(null);
        setActive([]);
        setCaptureReady(undefined);
      }
    }
  }, []);

  return {
    last,
    active,
    frameSequence,
    captureReady,
    listening,
    error,
    // L'oubli doit aussi porter côté Rust : le thread garde son relevé, et le
    // sondage suivant le restaurerait aussitôt.
    reset,
  };
}

function sameCapturedInput(
  left: CapturedInput | null,
  right: CapturedInput | null,
): boolean {
  return (
    left === right ||
    (left !== null &&
      right !== null &&
      left.guid === right.guid &&
      left.control === right.control &&
      left.detected_sequence === right.detected_sequence)
  );
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
