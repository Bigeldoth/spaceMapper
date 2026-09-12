//! Capture de l'appui d'un contrôle de manche ou de manette.
//!
//! Les objets DirectInput sont des interfaces COM, qui ne sont pas `Send` : les
//! confier directement à l'état partagé de Tauri exigerait un `unsafe impl
//! Send` que rien ne justifie. On dédie donc un thread aux sessions, qui les
//! possède entièrement, et l'interface se contente de lire le dernier contrôle
//! détecté.
//!
//! Tous les périphériques d'une même famille sont sondés à la fois. L'utilisateur
//! n'a donc pas à désigner le bon avant d'appuyer — il actionne ce qu'il veut
//! assigner, et l'application reconnaît lequel a bougé.

use serde::Serialize;
use spacemapper_core::device::{
    capture::{CapturedControlKind, CapturedFrom, MultiCaptureSession},
    DeviceGuid,
};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::Manager;

type CmdResult<T> = Result<T, String>;

/// Cadence de sondage. Soixante fois par seconde suffit largement à ne pas
/// manquer un appui, sans occuper un cœur pour rien.
const POLL_INTERVAL: Duration = Duration::from_millis(16);
/// Un pilote suspendu ne doit ni bloquer l'interface ni ouvrir une seconde
/// session concurrente. Son handle reste conservé après ce délai.
const WORKER_SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(1);
const SHUTDOWN_CHECK_INTERVAL: Duration = Duration::from_millis(5);

/// Marge normalisée qui départage des axes capturables de plusieurs manches.
///
/// Le suivi de chaque périphérique applique déjà la même marge en unités
/// DirectInput. Cette seconde comparaison est nécessaire en HOSAS : une petite
/// dérive du manche au repos ne doit pas gagner uniquement parce que ce manche
/// a été énuméré avant celui que l'utilisateur actionne volontairement.
const AXIS_CAPTURE_DOMINANCE_MARGIN: f32 = 4_000.0 / 32_767.0;

#[derive(Default)]
pub struct CaptureState {
    inner: Mutex<Option<Session>>,
    /// Sérialise les changements de session, sans retenir le verrou des relevés.
    /// Une fermeture expirée reste ici jusqu'à la sortie effective du worker.
    retiring: Mutex<Option<Session>>,
    /// Numéro de la prochaine session. Voir [`stop_capture`] pour la raison
    /// d'être de cette numérotation.
    next_id: AtomicU64,
}

/// Ce que le thread de capture partage avec l'interface.
struct Session {
    id: u64,
    /// Mis à `false` pour demander l'arrêt ; le thread libère alors les
    /// périphériques en sortant.
    running: Arc<AtomicBool>,
    latest: Arc<Mutex<Option<CapturedInput>>>,
    /// Frame live la plus récente. Contrairement à `latest`, une frame vide
    /// remplace la précédente au relâchement d'un contrôle.
    live: Arc<Mutex<LiveCaptureFrame>>,
    /// Panne d'ouverture ou de lecture, à remonter telle quelle.
    failure: Arc<Mutex<Option<String>>>,
    /// Thread propriétaire des objets DirectInput/COM.
    ///
    /// Une nouvelle session attend sa sortie, au plus une seconde par appel.
    /// Si le pilote reste suspendu, le handle reste dans `retiring` et aucun
    /// remplaçant n'est ouvert. `join` ne s'exécute jamais sur le thread UI.
    worker: std::thread::JoinHandle<()>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CapturedInput {
    /// GUID du périphérique effectivement actionné.
    pub guid: String,
    /// Contrôle nommé comme le jeu le nomme, ex. `button5`.
    pub control: String,
    /// Nature DirectInput relevée au moment précis du geste.
    pub kind: LiveInputKind,
    /// Intensité du candidat au moment où il est devenu capturable.
    pub value: f32,
    /// Toujours vrai pour un candidat persistant ; explicite pour que
    /// l'interface n'ait pas à faire confiance à cette convention interne.
    pub capturable: bool,
    /// Séquence de la frame où ce geste a été détecté.
    ///
    /// Elle ne change pas au relâchement : un appui très bref reste donc
    /// attribuable même si l'interface ne sonde qu'après la frame vide.
    pub detected_sequence: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum LiveInputKind {
    Button,
    Hat,
    Axis,
}

/// Un contrôle actif dans la dernière frame DirectInput.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct LiveInput {
    pub guid: String,
    pub control: String,
    pub kind: LiveInputKind,
    /// `1` pour un bouton/HAT ; valeur signée dans `[-1, 1]` pour un axe.
    pub value: f32,
    /// Ce mouvement est-il assez franc pour devenir une assignation ?
    ///
    /// Les petits mouvements d'axe restent utiles au retour visuel, mais ne
    /// doivent pas voler la capture d'un bouton. Exposer ce verdict dans la
    /// frame complète permet à l'interface de filtrer d'abord par périphérique
    /// et par nature de contrôle, avant de choisir son candidat.
    pub capturable: bool,
}

/// État live complet d'une session de capture.
///
/// `last` reste persistant pour le sélecteur d'assignation, tandis que
/// `inputs` décrit uniquement la frame courante et devient donc vide au repos.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct LiveCaptureFrame {
    pub session_id: u64,
    pub sequence: u64,
    pub inputs: Vec<LiveInput>,
    pub last: Option<CapturedInput>,
    /// Le thread a-t-il observé une frame neutre depuis le dernier clear ?
    pub capture_ready: bool,
}

/// Ouvre une session de capture sur les périphériques désignés.
///
/// Renvoie le numéro de la session, à repasser à [`stop_capture`].
#[tauri::command]
pub async fn start_capture(window: tauri::Window, guids: Vec<String>) -> CmdResult<u64> {
    let parsed: Vec<DeviceGuid> = guids.iter().filter_map(|g| DeviceGuid::parse(g)).collect();

    // Trace de mise au point : en cas de capture muette, il faut savoir si la
    // commande est seulement atteinte, et avec quoi.
    eprintln!(
        "[capture] démarrage demandé : {} guid(s) reçu(s), {} exploitable(s)",
        guids.len(),
        parsed.len()
    );

    if parsed.is_empty() {
        eprintln!("[capture] refus : aucun identifiant exploitable");
        return Err(format!(
            "aucun périphérique exploitable parmi {} identifiant(s)",
            guids.len()
        ));
    }

    // DirectInput exige une fenêtre pour fixer le niveau de coopération. On
    // transmet le handle sous forme d'entier : il traverse une frontière de
    // thread, et `HWND` n'est pas `Send`.
    let hwnd = window
        .hwnd()
        .map_err(|e| {
            eprintln!("[capture] refus : fenêtre inaccessible — {e}");
            format!("fenêtre inaccessible: {e}")
        })?
        .0 as isize;

    let app = window.app_handle().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<CaptureState>();
        start_capture_inner(&state, parsed, hwnd)
    })
    .await
    .map_err(|error| format!("démarrage de capture interrompu : {error}"))?
}

fn start_capture_inner(
    state: &CaptureState,
    parsed: Vec<DeviceGuid>,
    hwnd: isize,
) -> CmdResult<u64> {
    replace_capture(state, WORKER_SHUTDOWN_TIMEOUT, |id| {
        let running = Arc::new(AtomicBool::new(true));
        let latest = Arc::new(Mutex::new(None));
        let live = Arc::new(Mutex::new(LiveCaptureFrame {
            session_id: id,
            sequence: 0,
            inputs: Vec::new(),
            last: None,
            capture_ready: true,
        }));
        let failure = Arc::new(Mutex::new(None));

        let worker = {
            let running = Arc::clone(&running);
            let latest = Arc::clone(&latest);
            let live = Arc::clone(&live);
            let failure = Arc::clone(&failure);

            std::thread::spawn(move || {
                // Une panique ici laisserait l'interface attendre un appui qui ne
                // viendrait jamais, sans le moindre message. Le garde note la
                // sortie du thread, y compris pendant un déroulement de pile.
                let _guard = ExitGuard {
                    failure: Arc::clone(&failure),
                    running: Arc::clone(&running),
                };

                // Repère d'entrée : sans lui, un thread bloqué *dans* l'ouverture
                // est indiscernable d'un thread qui n'a jamais démarré.
                eprintln!(
                    "[capture] session {id} : ouverture de {} périphérique(s)…",
                    parsed.len()
                );
                let (session, failures) = MultiCaptureSession::open(&parsed, hwnd);
                eprintln!(
                    "[capture] session {id} : {} ouvert(s), {} échec(s){}",
                    parsed.len() - failures.len(),
                    failures.len(),
                    if failures.is_empty() {
                        String::new()
                    } else {
                        format!(" — {}", failures.join(" ; "))
                    }
                );

                if session.is_empty() {
                    if let Ok(mut slot) = failure.lock() {
                        *slot = Some(if failures.is_empty() {
                            "aucun périphérique n'a pu être ouvert".into()
                        } else {
                            failures.join(" ; ")
                        });
                    }
                    return;
                }

                let mut announced = false;
                while running.load(Ordering::Relaxed) {
                    let found = session.poll_all();
                    let candidate = capture_candidate(&found);
                    if let Some(found) = candidate.as_ref() {
                        if !announced {
                            eprintln!(
                                "[capture] session {id} : premier contrôle détecté — {}",
                                found.control
                            );
                            announced = true;
                        }
                    }

                    let inputs: Vec<LiveInput> = found.into_iter().map(live_input).collect();
                    // `clear_capture` prend les verrous dans le même ordre. Garder
                    // cette discipline rend atomiques la séquence du geste, le
                    // candidat persistant et la frame publiée.
                    if let Ok(mut sticky) = latest.lock() {
                        if let Ok(mut slot) = live.lock() {
                            publish_capture_frame(
                                &mut slot,
                                &mut sticky,
                                candidate.as_ref(),
                                inputs,
                            );
                        }
                    }
                    std::thread::sleep(POLL_INTERVAL);
                }
                eprintln!("[capture] session {id} : arrêtée");
                // `session` sort de portée ici : les périphériques sont relâchés.
            })
        };

        Ok(Session {
            id,
            running,
            latest,
            live,
            failure,
            worker,
        })
    })
}

/// Note une fin de thread anormale, pour qu'elle ne passe pas pour un silence.
struct ExitGuard {
    failure: Arc<Mutex<Option<String>>>,
    running: Arc<AtomicBool>,
}

impl Drop for ExitGuard {
    fn drop(&mut self) {
        // Sortie alors que personne n'a demandé l'arrêt : le thread a cédé.
        if self.running.swap(false, Ordering::AcqRel) {
            if let Ok(mut slot) = self.failure.lock() {
                if slot.is_none() {
                    *slot = Some("la capture s'est interrompue".into());
                }
            }
        }
    }
}

/// Relève le dernier contrôle actionné, s'il y en a un.
#[tauri::command]
pub fn poll_capture(state: tauri::State<'_, CaptureState>) -> CmdResult<Option<CapturedInput>> {
    poll_capture_inner(&state)
}

fn poll_capture_inner(state: &CaptureState) -> CmdResult<Option<CapturedInput>> {
    let guard = state.inner.lock().map_err(|_| "état de capture corrompu")?;
    let Some(session) = guard.as_ref() else {
        return Ok(None);
    };

    if let Ok(slot) = session.failure.lock() {
        if let Some(message) = slot.as_ref() {
            return Err(message.clone());
        }
    }

    let found = session
        .latest
        .lock()
        .map_err(|_| "état de capture corrompu")?
        .clone();

    Ok(found)
}

/// Relève la dernière frame live de la session désignée.
///
/// L'identifiant ferme la même course que pour [`stop_capture`] : un effet
/// React obsolète ne doit jamais lire la session ouverte par son successeur.
#[tauri::command]
pub fn poll_live_capture(
    state: tauri::State<'_, CaptureState>,
    id: u64,
) -> CmdResult<LiveCaptureFrame> {
    let guard = state.inner.lock().map_err(|_| "état de capture corrompu")?;
    let Some(session) = guard.as_ref() else {
        return Err("aucune session de capture active".into());
    };
    if session.id != id {
        return Err(format!(
            "session de capture {id} obsolète (courante : {})",
            session.id
        ));
    }

    if let Ok(slot) = session.failure.lock() {
        if let Some(message) = slot.as_ref() {
            return Err(message.clone());
        }
    }

    session
        .live
        .lock()
        .map_err(|_| "état de capture corrompu".into())
        .map(|frame| frame.clone())
}

/// Oublie le dernier contrôle relevé, sans fermer la session.
///
/// Effacer côté interface ne suffit pas : le thread conserve son relevé, et le
/// sondage suivant le restaurerait aussitôt. Le bouton « Effacer » paraissait
/// alors sans effet.
#[tauri::command]
pub fn clear_capture(state: tauri::State<'_, CaptureState>) -> CmdResult<Option<u64>> {
    clear_capture_inner(&state)
}

fn clear_capture_inner(state: &CaptureState) -> CmdResult<Option<u64>> {
    let guard = state.inner.lock().map_err(|_| "état de capture corrompu")?;
    if let Some(session) = guard.as_ref() {
        let mut sticky = session
            .latest
            .lock()
            .map_err(|_| "état de capture corrompu")?;
        let mut frame = session
            .live
            .lock()
            .map_err(|_| "état de capture corrompu")?;
        return Ok(Some(clear_capture_frame(&mut frame, &mut sticky)));
    }
    Ok(None)
}

/// Ferme la session dont on donne le numéro, et rend les périphériques.
///
/// Le numéro n'est pas un ornement. En développement, React réexécute chaque
/// effet — montage, nettoyage, montage — et ces appels étant asynchrones, un
/// arrêt tardif pouvait tuer la session que le second montage venait d'ouvrir.
/// La capture restait alors muette sans qu'aucune erreur ne soit levée. Un
/// arrêt qui ne désigne plus la session courante est désormais ignoré.
#[tauri::command]
pub async fn stop_capture(app: tauri::AppHandle, id: u64) -> CmdResult<()> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<CaptureState>();
        stop_capture_inner(&state, id, WORKER_SHUTDOWN_TIMEOUT)
    })
    .await
    .map_err(|error| format!("arrêt de capture interrompu : {error}"))?
}

/// Cette fonction tourne uniquement hors du thread UI. `try_lock` refuse les
/// changements concurrents au lieu d'empiler des threads derrière un pilote.
fn replace_capture(
    state: &CaptureState,
    timeout: Duration,
    create: impl FnOnce(u64) -> CmdResult<Session>,
) -> CmdResult<u64> {
    let mut retiring = state
        .retiring
        .try_lock()
        .map_err(|_| "un changement de capture est déjà en cours ; réessayez")?;
    finish_retiring(&mut retiring, timeout)?;
    *retiring = state
        .inner
        .lock()
        .map_err(|_| "état de capture corrompu")?
        .take();
    finish_retiring(&mut retiring, timeout)?;
    let id = state.next_id.fetch_add(1, Ordering::Relaxed) + 1;
    let session = create(id)?;
    *state.inner.lock().map_err(|_| "état de capture corrompu")? = Some(session);
    Ok(id)
}

fn stop_capture_inner(state: &CaptureState, id: u64, timeout: Duration) -> CmdResult<()> {
    let mut retiring = state
        .retiring
        .try_lock()
        .map_err(|_| "un changement de capture est déjà en cours ; réessayez")?;
    {
        let mut current = state.inner.lock().map_err(|_| "état de capture corrompu")?;
        if current.as_ref().is_some_and(|session| session.id == id) {
            *retiring = current.take();
        }
    }
    if retiring.as_ref().is_some_and(|session| session.id == id) {
        finish_retiring(&mut retiring, timeout)?;
    }
    Ok(())
}

fn finish_retiring(slot: &mut Option<Session>, timeout: Duration) -> CmdResult<()> {
    if let Some(session) = slot.as_ref() {
        session.running.store(false, Ordering::Release);
        let deadline = Instant::now() + timeout;
        while !session.worker.is_finished() {
            if Instant::now() >= deadline {
                return Err("le périphérique tarde à arrêter la capture ; aucun autre accès n'a été ouvert. Réessayez après sa reconnexion".into());
            }
            std::thread::sleep(SHUTDOWN_CHECK_INTERVAL);
        }
    }
    stop_session(slot);
    Ok(())
}

impl Drop for CaptureState {
    fn drop(&mut self) {
        // La destruction de l'état peut se produire sur le thread UI. Signaler
        // l'arrêt suffit ici : jamais de join vers un pilote possiblement figé.
        for slot in [&mut self.inner, &mut self.retiring] {
            if let Some(session) = slot
                .get_mut()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .as_ref()
            {
                session.running.store(false, Ordering::Release);
            }
        }
    }
}

fn stop_session(slot: &mut Option<Session>) {
    if let Some(session) = slot.take() {
        let id = session.id;
        session.running.store(false, Ordering::Relaxed);
        // Le retour de `join` est la garantie que `MultiCaptureSession` est
        // sorti de portée et que tous ses périphériques DirectInput sont
        // désacquis avant qu'un remplacement ne commence son ouverture.
        if session.worker.join().is_err() {
            eprintln!("[capture] session {id} : thread terminé en panique");
        }
    }
}

/// Choisit le candidat persistant sans perdre la frame multi-contrôles.
///
/// Un bouton est prioritaire sur un HAT, lui-même prioritaire sur un axe,
/// même si le contrôle numérique appartient à un périphérique énuméré
/// après celui de l'axe.
fn capture_candidate(inputs: &[CapturedFrom]) -> Option<CapturedFrom> {
    // Les contrôles numériques gardent leur priorité historique, quel que soit
    // leur périphérique ou l'amplitude simultanée des axes.
    for kind in [CapturedControlKind::Button, CapturedControlKind::Hat] {
        if let Some(input) = inputs
            .iter()
            .find(|input| input.capturable && input.kind == kind)
        {
            return Some(input.clone());
        }
    }

    let mut strongest: Option<(usize, &CapturedFrom)> = None;
    for (index, input) in inputs
        .iter()
        .enumerate()
        .filter(|(_, input)| input.capturable && input.kind == CapturedControlKind::Axis)
    {
        let magnitude = input.value.abs();
        match strongest {
            Some((_, current)) if magnitude > current.value.abs() => {
                strongest = Some((index, input));
            }
            Some(_) => {}
            None => strongest = Some((index, input)),
        }
    }

    let (strongest_index, strongest) = strongest?;
    // Un axe live mais pas encore capturable reste un concurrent pertinent :
    // l'ignorer ferait valider un autre manche à 38 % face à une dérive à 36 %.
    let runner_up = inputs
        .iter()
        .enumerate()
        .filter(|(index, input)| {
            *index != strongest_index && input.kind == CapturedControlKind::Axis
        })
        .map(|(_, input)| input.value.abs())
        .fold(0.0_f32, f32::max);

    (strongest.value.abs() - runner_up >= AXIS_CAPTURE_DOMINANCE_MARGIN).then(|| strongest.clone())
}

/// Publie une frame et date précisément le début du candidat persistant.
///
/// `last` doit survivre au relâchement afin qu'un tap plus court que la cadence
/// de sondage du frontend ne soit pas perdu. Sa séquence n'est renouvelée qu'au
/// début d'un geste (ou quand un autre contrôle devient candidat), jamais à
/// chaque tick d'un bouton maintenu.
fn publish_capture_frame(
    frame: &mut LiveCaptureFrame,
    sticky: &mut Option<CapturedInput>,
    candidate: Option<&CapturedFrom>,
    inputs: Vec<LiveInput>,
) {
    let next_sequence = frame.sequence.wrapping_add(1);

    // Un clear ouvre une vraie barrière de neutralité côté matériel. Ainsi un
    // bouton déjà tenu mais pas encore remonté jusqu'à React ne peut pas être
    // pris pour le premier geste de la nouvelle fenêtre. La première frame vide
    // réarme le thread ; tout appui commencé avant elle est ignoré.
    if !frame.capture_ready {
        let capture_ready = inputs.is_empty();
        let changed = frame.inputs != inputs || frame.last.is_some() || capture_ready;
        *sticky = None;
        if changed {
            frame.sequence = next_sequence;
            frame.inputs = inputs;
            frame.last = None;
            frame.capture_ready = capture_ready;
        }
        return;
    }

    if let Some(candidate) = candidate {
        let candidate_was_already_active = frame.inputs.iter().any(|input| {
            input.guid.eq_ignore_ascii_case(candidate.guid.as_str())
                && input.control == candidate.control
                && input.capturable
        });
        let candidate_changed = sticky.as_ref().map_or(true, |current| {
            !current.guid.eq_ignore_ascii_case(candidate.guid.as_str())
                || current.control != candidate.control
        });

        if !candidate_was_already_active || candidate_changed {
            *sticky = Some(captured_input(candidate, next_sequence));
        }
    }

    let latest = sticky.clone();
    // Une séquence est un changement observable, pas un simple tick : au repos
    // l'interface ne doit pas se rerendre 60 fois par seconde. La transition
    // vers `inputs: []` reste bien un changement et signale le relâchement.
    if frame.inputs != inputs || frame.last != latest {
        frame.sequence = next_sequence;
        frame.inputs = inputs;
        frame.last = latest;
    }
}

/// Invalide tout geste antérieur et renvoie l'identifiant exact de la barrière.
fn clear_capture_frame(frame: &mut LiveCaptureFrame, sticky: &mut Option<CapturedInput>) -> u64 {
    *sticky = None;
    // Même si `last` était déjà vide, cette séquence constitue une barrière
    // observable. `inputs` reste intact pour que l'interface puisse exiger le
    // relâchement d'un contrôle qui était tenu avant l'ouverture.
    frame.sequence = frame.sequence.wrapping_add(1);
    frame.last = None;
    frame.capture_ready = false;
    frame.sequence
}

fn captured_input(input: &CapturedFrom, detected_sequence: u64) -> CapturedInput {
    CapturedInput {
        guid: input.guid.to_string(),
        control: input.control.clone(),
        kind: live_input_kind(input.kind),
        value: input.value,
        capturable: input.capturable,
        detected_sequence,
    }
}

fn live_input_kind(kind: CapturedControlKind) -> LiveInputKind {
    match kind {
        CapturedControlKind::Button => LiveInputKind::Button,
        CapturedControlKind::Hat => LiveInputKind::Hat,
        CapturedControlKind::Axis => LiveInputKind::Axis,
    }
}

fn live_input(input: CapturedFrom) -> LiveInput {
    LiveInput {
        guid: input.guid.to_string(),
        control: input.control,
        kind: live_input_kind(input.kind),
        value: input.value,
        capturable: input.capturable,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn simulated_session(id: u64, gate: Option<std::sync::mpsc::Receiver<()>>) -> Session {
        let running = Arc::new(AtomicBool::new(true));
        let worker_running = Arc::clone(&running);
        let worker = std::thread::spawn(move || {
            if let Some(gate) = gate {
                gate.recv().unwrap();
            }
            while worker_running.load(Ordering::Acquire) {
                std::thread::sleep(Duration::from_millis(1));
            }
        });
        Session {
            id,
            running,
            latest: Arc::new(Mutex::new(None)),
            failure: Arc::new(Mutex::new(None)),
            worker,
            live: Arc::new(Mutex::new(LiveCaptureFrame {
                session_id: id,
                sequence: 0,
                inputs: Vec::new(),
                last: None,
                capture_ready: true,
            })),
        }
    }

    #[test]
    fn slow_shutdown_keeps_poll_clear_and_stale_session_handling_responsive() {
        let state = Arc::new(CaptureState::default());
        let (release, gate) = std::sync::mpsc::channel();
        let session = simulated_session(100, Some(gate));
        let running = Arc::clone(&session.running);
        *state.inner.lock().unwrap() = Some(session);
        let stop_state = Arc::clone(&state);
        let stopper = std::thread::spawn(move || {
            stop_capture_inner(&stop_state, 100, Duration::from_millis(500))
        });
        let deadline = Instant::now() + Duration::from_secs(1);
        while running.load(Ordering::Acquire) && Instant::now() < deadline {
            std::thread::yield_now();
        }
        assert!(!running.load(Ordering::Acquire));
        // The control thread is still waiting on a deliberately blocked worker.
        // UI reads and clear must not wait behind that lifecycle operation.
        let probe_state = Arc::clone(&state);
        let (observed, observe) = std::sync::mpsc::channel();
        let probe = std::thread::spawn(move || {
            assert!(poll_capture_inner(&probe_state).unwrap().is_none());
            clear_capture_inner(&probe_state).unwrap();
            observed.send(()).unwrap();
        });
        observe.recv_timeout(Duration::from_millis(200)).unwrap();
        probe.join().unwrap();
        assert!(
            replace_capture(&state, Duration::ZERO, |_| panic!("concurrent replacement")).is_err()
        );
        assert!(stopper.join().unwrap().is_err());
        assert!(state.inner.lock().unwrap().is_none());
        assert!(state.retiring.lock().unwrap().is_some());
        assert!(replace_capture(&state, Duration::ZERO, |_| panic!(
            "old native worker still owns device"
        ))
        .is_err());

        release.send(()).unwrap();
        let next = replace_capture(&state, Duration::from_secs(1), |id| {
            Ok(simulated_session(id, None))
        })
        .unwrap();
        stop_capture_inner(&state, 100, Duration::ZERO).unwrap();
        assert_eq!(state.inner.lock().unwrap().as_ref().unwrap().id, next);
        assert!(state
            .inner
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .running
            .load(Ordering::Acquire));
        stop_capture_inner(&state, next, Duration::from_secs(1)).unwrap();
        assert!(state.inner.lock().unwrap().is_none());
        assert!(state.retiring.lock().unwrap().is_none());
    }

    #[test]
    fn replacing_a_live_session_finishes_its_worker_before_creation() {
        let state = CaptureState::default();
        let current = simulated_session(1, None);
        let running = Arc::clone(&current.running);
        *state.inner.lock().unwrap() = Some(current);
        state.next_id.store(1, Ordering::Relaxed);
        let next = replace_capture(&state, Duration::from_secs(1), |id| {
            assert!(!running.load(Ordering::Acquire));
            assert!(state.inner.lock().unwrap().is_none());
            Ok(simulated_session(id, None))
        })
        .unwrap();
        assert_eq!(next, 2);
        stop_capture_inner(&state, 1, Duration::ZERO).unwrap();
        assert_eq!(state.inner.lock().unwrap().as_ref().unwrap().id, 2);
        stop_capture_inner(&state, next, Duration::from_secs(1)).unwrap();
    }

    #[test]
    fn state_destruction_signals_a_stalled_worker_without_waiting() {
        let state = CaptureState::default();
        let (release, gate) = std::sync::mpsc::channel();
        let session = simulated_session(1, Some(gate));
        let running = Arc::clone(&session.running);
        *state.inner.lock().unwrap() = Some(session);
        let (dropped, done) = std::sync::mpsc::channel();
        let dropper = std::thread::spawn(move || {
            drop(state);
            dropped.send(()).unwrap();
        });
        // Receive before unblocking the fake driver: a join in Drop would fail.
        done.recv_timeout(Duration::from_secs(1)).unwrap();
        assert!(!running.load(Ordering::Acquire));
        release.send(()).unwrap();
        dropper.join().unwrap();
    }

    fn captured(
        control: &str,
        kind: CapturedControlKind,
        value: f32,
        capturable: bool,
    ) -> CapturedFrom {
        captured_on(
            "B10A044F-0000-0000-0000-504944564944",
            control,
            kind,
            value,
            capturable,
        )
    }

    fn captured_on(
        guid: &str,
        control: &str,
        kind: CapturedControlKind,
        value: f32,
        capturable: bool,
    ) -> CapturedFrom {
        CapturedFrom {
            guid: DeviceGuid::parse(guid).unwrap(),
            control: control.into(),
            kind,
            value,
            capturable,
        }
    }

    #[test]
    fn stopping_a_session_joins_its_worker_before_returning() {
        let running = Arc::new(AtomicBool::new(true));
        let worker_running = Arc::clone(&running);
        let entered = Arc::new(std::sync::Barrier::new(2));
        let worker_entered = Arc::clone(&entered);
        let released = Arc::new(AtomicBool::new(false));
        let worker_released = Arc::clone(&released);

        let worker = std::thread::spawn(move || {
            worker_entered.wait();
            while worker_running.load(Ordering::Relaxed) {
                std::thread::yield_now();
            }
            // Simule la destruction des objets DirectInput détenus par le
            // thread. Le prochain démarrage ne doit pouvoir arriver qu'après.
            worker_released.store(true, Ordering::Release);
        });

        let mut slot = Some(Session {
            id: 7,
            running,
            latest: Arc::new(Mutex::new(None)),
            live: Arc::new(Mutex::new(LiveCaptureFrame {
                session_id: 7,
                sequence: 0,
                inputs: Vec::new(),
                last: None,
                capture_ready: true,
            })),
            failure: Arc::new(Mutex::new(None)),
            worker,
        });

        entered.wait();
        stop_session(&mut slot);

        assert!(slot.is_none());
        assert!(
            released.load(Ordering::Acquire),
            "les ressources du worker sont encore détenues après stop_session"
        );
    }

    #[test]
    fn sticky_candidate_ignores_subtle_axes_and_prefers_digital_controls() {
        let inputs = vec![
            captured("x", CapturedControlKind::Axis, 0.08, false),
            captured("y", CapturedControlKind::Axis, -0.7, true),
            captured("hat1_left", CapturedControlKind::Hat, 1.0, true),
            captured("button5", CapturedControlKind::Button, 1.0, true),
        ];

        let candidate = capture_candidate(&inputs).unwrap();
        assert_eq!(candidate.control, "button5");
    }

    #[test]
    fn axis_candidate_uses_amplitude_instead_of_directinput_order() {
        let inputs = vec![
            captured_on(
                "B10A044F-0000-0000-0000-504944564944",
                "x",
                CapturedControlKind::Axis,
                0.44,
                true,
            ),
            captured_on(
                "A36D044F-0000-0000-0000-504944564944",
                "y",
                CapturedControlKind::Axis,
                -0.76,
                true,
            ),
        ];

        let candidate = capture_candidate(&inputs).unwrap();
        assert_eq!(candidate.control, "y");
        assert_eq!(candidate.value, -0.76);
    }

    #[test]
    fn close_axis_candidates_from_different_devices_remain_ambiguous() {
        let inputs = vec![
            captured_on(
                "B10A044F-0000-0000-0000-504944564944",
                "x",
                CapturedControlKind::Axis,
                0.50,
                true,
            ),
            captured_on(
                "A36D044F-0000-0000-0000-504944564944",
                "y",
                CapturedControlKind::Axis,
                -0.45,
                false,
            ),
        ];

        assert!(
            capture_candidate(&inputs).is_none(),
            "l'ordre d'énumération a départagé deux axes trop proches"
        );
    }

    #[test]
    fn live_conversion_preserves_axis_sign_and_kind() {
        let input = live_input(captured("rotz", CapturedControlKind::Axis, -0.625, true));
        assert_eq!(input.control, "rotz");
        assert_eq!(input.kind, LiveInputKind::Axis);
        assert_eq!(input.value, -0.625);
        assert!(input.capturable);
    }

    #[test]
    fn live_conversion_keeps_subtle_axis_non_capturable() {
        let input = live_input(captured("x", CapturedControlKind::Axis, 0.08, false));
        assert_eq!(input.kind, LiveInputKind::Axis);
        assert!(!input.capturable);
    }

    #[test]
    fn a_short_tap_keeps_the_sequence_of_its_press_after_release() {
        let mut frame = LiveCaptureFrame {
            session_id: 1,
            sequence: 10,
            inputs: Vec::new(),
            last: None,
            capture_ready: true,
        };
        let mut sticky = None;
        let pressed = captured("button5", CapturedControlKind::Button, 1.0, true);

        publish_capture_frame(
            &mut frame,
            &mut sticky,
            Some(&pressed),
            vec![live_input(pressed.clone())],
        );
        assert_eq!(frame.sequence, 11);
        assert_eq!(frame.last.as_ref().unwrap().detected_sequence, 11);
        assert_eq!(frame.last.as_ref().unwrap().kind, LiveInputKind::Button);
        assert!(frame.last.as_ref().unwrap().capturable);

        // Le frontend peut ne voir que cette frame de relâchement. Le candidat
        // doit rester disponible, daté de la frame où le bouton était enfoncé.
        publish_capture_frame(&mut frame, &mut sticky, None, Vec::new());
        assert_eq!(frame.sequence, 12);
        assert!(frame.inputs.is_empty());
        assert_eq!(frame.last.as_ref().unwrap().detected_sequence, 11);
    }

    #[test]
    fn reset_and_neutral_barriers_reject_a_preheld_button_but_allow_its_next_tap() {
        let mut frame = LiveCaptureFrame {
            session_id: 1,
            sequence: 0,
            inputs: Vec::new(),
            last: None,
            capture_ready: true,
        };
        let mut sticky = None;
        let pressed = captured("button5", CapturedControlKind::Button, 1.0, true);

        publish_capture_frame(
            &mut frame,
            &mut sticky,
            Some(&pressed),
            vec![live_input(pressed.clone())],
        );
        let reset_barrier = clear_capture_frame(&mut frame, &mut sticky);
        assert_eq!(reset_barrier, 2);
        assert!(frame.last.is_none());
        assert_eq!(
            frame.inputs.len(),
            1,
            "le contrôle tenu doit rester visible"
        );

        // Le thread revoit le bouton toujours tenu après le clear. La barrière
        // native ne le republie pas comme candidat, même si React ne l'avait
        // pas vu avant l'ouverture du sélecteur.
        publish_capture_frame(
            &mut frame,
            &mut sticky,
            Some(&pressed),
            vec![live_input(pressed.clone())],
        );
        assert_eq!(frame.sequence, reset_barrier);
        assert!(frame.last.is_none());
        assert!(!frame.capture_ready);

        publish_capture_frame(&mut frame, &mut sticky, None, Vec::new());
        let neutral_barrier = frame.sequence;
        assert_eq!(neutral_barrier, 3);
        assert!(frame.last.is_none());
        assert!(frame.capture_ready);

        // Une nouvelle pression du même bouton doit renouveler la séquence.
        // Sinon un second tap très bref serait confondu avec le bouton pré-tenu.
        publish_capture_frame(
            &mut frame,
            &mut sticky,
            Some(&pressed),
            vec![live_input(pressed.clone())],
        );
        publish_capture_frame(&mut frame, &mut sticky, None, Vec::new());
        assert_eq!(frame.sequence, 5);
        assert_eq!(frame.last.as_ref().unwrap().detected_sequence, 4);
        assert!(frame.last.as_ref().unwrap().detected_sequence > neutral_barrier);
    }
}
