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
use std::time::Duration;

type CmdResult<T> = Result<T, String>;

/// Cadence de sondage. Soixante fois par seconde suffit largement à ne pas
/// manquer un appui, sans occuper un cœur pour rien.
const POLL_INTERVAL: Duration = Duration::from_millis(16);

#[derive(Default)]
pub struct CaptureState {
    inner: Mutex<Option<Session>>,
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
pub fn start_capture(
    window: tauri::Window,
    state: tauri::State<'_, CaptureState>,
    guids: Vec<String>,
) -> CmdResult<u64> {
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

    let mut guard = state.inner.lock().map_err(|_| {
        eprintln!("[capture] refus : état de capture corrompu");
        "état de capture corrompu"
    })?;
    if let Some(previous) = guard.as_ref() {
        eprintln!(
            "[capture] la session {} est remplacée par une nouvelle",
            previous.id
        );
    }
    stop_session(&mut guard);

    let id = state.next_id.fetch_add(1, Ordering::Relaxed) + 1;
    let running = Arc::new(AtomicBool::new(true));
    let latest = Arc::new(Mutex::new(None));
    let failure = Arc::new(Mutex::new(None));

    {
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
        });
    }

    *guard = Some(Session {
        id,
        running,
        latest,
        failure,
    });
    Ok(id)
}

/// Note une fin de thread anormale, pour qu'elle ne passe pas pour un silence.
struct ExitGuard {
    failure: Arc<Mutex<Option<String>>>,
    running: Arc<AtomicBool>,
}

impl Drop for ExitGuard {
    fn drop(&mut self) {
        // Sortie alors que personne n'a demandé l'arrêt : le thread a cédé.
        if self.running.load(Ordering::Relaxed) {
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
pub fn stop_capture(state: tauri::State<'_, CaptureState>, id: u64) -> CmdResult<()> {
    let mut guard = state.inner.lock().map_err(|_| "état de capture corrompu")?;
    let current = guard.as_ref().map(|s| s.id);
    if current == Some(id) {
        eprintln!("[capture] arrêt demandé de la session courante {id}");
        stop_session(&mut guard);
    } else {
        // Trace décisive : distingue « l'interface a fermé la session » d'un
        // arrêt tardif venu d'un montage précédent, qui lui est sans effet.
        eprintln!("[capture] arrêt ignoré de la session {id} (courante : {current:?})");
    }
    Ok(())
}

fn stop_session(slot: &mut Option<Session>) {
    if let Some(session) = slot.take() {
        session.running.store(false, Ordering::Relaxed);
    }
}
