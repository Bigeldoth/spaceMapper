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
use spacemapper_core::device::{capture::MultiCaptureSession, DeviceGuid};
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
    /// Panne d'ouverture ou de lecture, à remonter telle quelle.
    failure: Arc<Mutex<Option<String>>>,
    /// Conservé pendant toute fermeture lente ; joint uniquement après sortie.
    worker: std::thread::JoinHandle<()>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CapturedInput {
    /// GUID du périphérique effectivement actionné.
    pub guid: String,
    /// Contrôle nommé comme le jeu le nomme, ex. `button5`.
    pub control: String,
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
        let failure = Arc::new(Mutex::new(None));

        let worker = {
            let running = Arc::clone(&running);
            let latest = Arc::clone(&latest);
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
                    if let Some(found) = session.poll() {
                        if !announced {
                            eprintln!(
                                "[capture] session {id} : premier contrôle détecté — {}",
                                found.control
                            );
                            announced = true;
                        }
                        if let Ok(mut slot) = latest.lock() {
                            *slot = Some(CapturedInput {
                                guid: found.guid.to_string(),
                                control: found.control,
                            });
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

/// Oublie le dernier contrôle relevé, sans fermer la session.
///
/// Effacer côté interface ne suffit pas : le thread conserve son relevé, et le
/// sondage suivant le restaurerait aussitôt. Le bouton « Effacer » paraissait
/// alors sans effet.
#[tauri::command]
pub fn clear_capture(state: tauri::State<'_, CaptureState>) -> CmdResult<()> {
    clear_capture_inner(&state)
}

fn clear_capture_inner(state: &CaptureState) -> CmdResult<()> {
    let guard = state.inner.lock().map_err(|_| "état de capture corrompu")?;
    if let Some(session) = guard.as_ref() {
        if let Ok(mut slot) = session.latest.lock() {
            *slot = None;
        }
    }
    Ok(())
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
        session.running.store(false, Ordering::Release);
        if session.worker.join().is_err() {
            eprintln!(
                "[capture] session {} : thread terminé en panique",
                session.id
            );
        }
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
}
