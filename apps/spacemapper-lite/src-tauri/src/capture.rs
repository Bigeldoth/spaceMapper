//! Capture de l'appui d'un bouton de manche.
//!
//! Les objets DirectInput sont des interfaces COM, qui ne sont pas `Send` : les
//! confier directement à l'état partagé de Tauri exigerait un `unsafe impl
//! Send` que rien ne justifie. On dédie donc un thread à la session, qui la
//! possède entièrement, et l'interface se contente de lire le dernier contrôle
//! détecté.
//!
//! Le thread sonde en continu plutôt que de répondre à la demande : acquérir un
//! périphérique coûte cher, et le faire à chaque sondage ferait clignoter son
//! accès pour les autres applications.

use serde::Serialize;
use spacemapper_core::device::{capture::CaptureSession, DeviceGuid};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

type CmdResult<T> = Result<T, String>;

/// Cadence de sondage. Soixante fois par seconde suffit largement à ne pas
/// manquer un appui, sans occuper un cœur pour rien.
const POLL_INTERVAL: Duration = Duration::from_millis(16);

#[derive(Default)]
pub struct CaptureState {
    inner: Mutex<Option<Session>>,
}

/// Ce que le thread de capture partage avec l'interface.
struct Session {
    /// Mis à `false` pour demander l'arrêt ; le thread libère alors le
    /// périphérique en sortant.
    running: Arc<AtomicBool>,
    latest: Arc<Mutex<Option<String>>>,
    /// Erreur d'ouverture ou de lecture, à remonter telle quelle.
    failure: Arc<Mutex<Option<String>>>,
}

#[derive(Debug, Serialize)]
pub struct CapturedInput {
    /// Contrôle nommé comme le jeu le nomme, ex. `button5`.
    pub control: String,
}

/// Ouvre une session sur le périphérique désigné par son GUID.
#[tauri::command]
pub fn start_capture(
    window: tauri::Window,
    state: tauri::State<'_, CaptureState>,
    guid: String,
) -> CmdResult<()> {
    let parsed = DeviceGuid::parse(&guid).ok_or_else(|| format!("GUID illisible: {guid}"))?;

    // DirectInput exige une fenêtre pour fixer le niveau de coopération. On
    // transmet le handle sous forme d'entier : il traverse une frontière de
    // thread, et `HWND` n'est pas `Send`.
    let hwnd = window
        .hwnd()
        .map_err(|e| format!("fenêtre inaccessible: {e}"))?
        .0 as isize;

    let mut guard = state.inner.lock().map_err(|_| "état de capture corrompu")?;
    stop_session(&mut guard);

    let running = Arc::new(AtomicBool::new(true));
    let latest = Arc::new(Mutex::new(None));
    let failure = Arc::new(Mutex::new(None));

    {
        let running = Arc::clone(&running);
        let latest = Arc::clone(&latest);
        let failure = Arc::clone(&failure);

        std::thread::spawn(move || {
            let session = match CaptureSession::open(&parsed, hwnd) {
                Ok(s) => s,
                Err(e) => {
                    if let Ok(mut slot) = failure.lock() {
                        *slot = Some(e.to_string());
                    }
                    return;
                }
            };

            while running.load(Ordering::Relaxed) {
                match session.poll() {
                    Ok(Some(found)) => {
                        if let Ok(mut slot) = latest.lock() {
                            *slot = Some(found.control);
                        }
                    }
                    Ok(None) => {}
                    Err(e) => {
                        if let Ok(mut slot) = failure.lock() {
                            *slot = Some(e.to_string());
                        }
                        break;
                    }
                }
                std::thread::sleep(POLL_INTERVAL);
            }
            // `session` sort de portée ici : le périphérique est désacquis.
        });
    }

    *guard = Some(Session {
        running,
        latest,
        failure,
    });
    Ok(())
}

/// Relève le dernier contrôle actionné, s'il y en a un.
///
/// Renvoie `None` tant que rien n'a été pressé : c'est le cas le plus
/// fréquent, l'interface sonde en continu.
#[tauri::command]
pub fn poll_capture(state: tauri::State<'_, CaptureState>) -> CmdResult<Option<CapturedInput>> {
    let guard = state.inner.lock().map_err(|_| "état de capture corrompu")?;
    let Some(session) = guard.as_ref() else {
        return Ok(None);
    };

    // Une panne du thread doit remonter à l'utilisateur, pas se traduire par
    // une capture qui ne répond simplement jamais.
    if let Ok(slot) = session.failure.lock() {
        if let Some(message) = slot.as_ref() {
            return Err(message.clone());
        }
    }

    let control = session
        .latest
        .lock()
        .map_err(|_| "état de capture corrompu")?
        .clone();

    Ok(control.map(|control| CapturedInput { control }))
}

/// Ferme la session et rend le périphérique.
#[tauri::command]
pub fn stop_capture(state: tauri::State<'_, CaptureState>) -> CmdResult<()> {
    let mut guard = state.inner.lock().map_err(|_| "état de capture corrompu")?;
    stop_session(&mut guard);
    Ok(())
}

fn stop_session(slot: &mut Option<Session>) {
    if let Some(session) = slot.take() {
        session.running.store(false, Ordering::Relaxed);
    }
}
