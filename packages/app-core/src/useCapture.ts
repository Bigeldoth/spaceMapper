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

export function useCapture(devices: DeviceView[], enabled: boolean): CaptureFeed {
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const onDocumentVisibility = () => setVisible(!document.hidden);
    const onDesktopVisibility = (event: Event) => setVisible((event as CustomEvent<boolean>).detail);
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
  // Empêche une réponse déjà en vol de restaurer `last` juste après un
  // reset local. Le clear natif prend ensuite le relais pour les frames futures.
  const resetGeneration = useRef(0);

  // Clé de valeur, et non de référence : la liste des périphériques est
  // recalculée à chaque rendu, mais son contenu change rarement.
  const guids = devices.map((d) => d.instance_guid).join("|");

  useEffect(() => {
    if (!enabled || !visible || guids === "") {
      setListening(false);
      setActive([]);
      setCaptureReady(undefined);
      return;
    }

    let cancelled = false;
    let timer: number | null = null;
    let acceptedSequence = -1;
    let acceptedGeneration = resetGeneration.current;
    setError(null);
    setListening(false);
    setActive([]);
    setFrameSequence(0);
    setCaptureReady(undefined);

    // On conserve la promesse de démarrage pour n'arrêter qu'une session
    // réellement ouverte. React réexécute les effets en développement, et un
    // arrêt tardif fermerait la session que le remontage vient d'ouvrir.
    const started = api.startCapture(guids.split("|"));
    started.then(
      (id) => {
        if (cancelled) return;
        setListening(true);

        const poll = async () => {
          if (cancelled) return;
          const generationAtRequest = resetGeneration.current;
          try {
            const frame = await api.pollLiveCapture(id);
            if (cancelled || frame.session_id !== id) return;
            if (generationAtRequest === resetGeneration.current) {
              // Chaque reset ouvre une nouvelle fenêtre d'acceptation. Une
              // réponse reçue pendant le clear a pu porter la même séquence que
              // la prochaine lecture ; elle ne doit pas empêcher cette dernière
              // de republier la barrière (et son éventuel tap persistant).
              if (acceptedGeneration !== generationAtRequest) {
                acceptedGeneration = generationAtRequest;
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
            }
          } catch (e) {
            if (!cancelled) {
              setError(String(e));
              setListening(false);
              setActive([]);
              setCaptureReady(undefined);
            }
            return;
          }

          // Le prochain appel ne part qu'après la fin du précédent : aucun
          // chevauchement, donc aucune frame ancienne ne peut gagner la course.
          if (!cancelled) {
            timer = window.setTimeout(poll, LIVE_POLL_INTERVAL_MS);
          }
        };

        void poll();
      },
      (e) => !cancelled && setError(String(e)),
    );

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      void started.then((id) => api.stopCapture(id)).catch(() => {});
    };
  }, [guids, enabled, visible]);

  const reset = useCallback(async (): Promise<number | null> => {
    resetGeneration.current += 1;
    setLast(null);
    setActive([]);
    setCaptureReady(undefined);
    let barrierSequence: number | null = null;
    try {
      // Le composant de capture peut attendre ce nettoyage avant de s'armer :
      // un geste commencé pendant l'effacement ne devient ainsi pas le choix
      // involontaire affiché à l'ouverture de la fenêtre.
      barrierSequence = await api.clearCapture();
    } catch (e) {
      // Conserve le comportement non bloquant historique pour les appelants
      // qui ignorent la promesse, tout en rendant la panne visible.
      setError(String(e));
    } finally {
      // Une lecture lancée pendant l'appel natif a pu publier une frame entre
      // les deux `await`. Une seconde génération l'invalide et ce dernier
      // nettoyage garantit que la promesse ne se résout jamais avec un ancien
      // contrôle encore affiché.
      resetGeneration.current += 1;
      setLast(null);
      setActive([]);
      setCaptureReady(undefined);
    }
    return barrierSequence;
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
