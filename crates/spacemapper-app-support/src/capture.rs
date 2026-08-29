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
    /// Frame live la plus récente. Contrairement à `latest`, une frame vide
    /// remplace la précédente au relâchement d'un contrôle.
    live: Arc<Mutex<LiveCaptureFrame>>,
    /// Panne d'ouverture ou de lecture, à remonter telle quelle.
    failure: Arc<Mutex<Option<String>>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CapturedInput {
    /// GUID du périphérique effectivement actionné.
    pub guid: String,
    /// Contrôle nommé comme le jeu le nomme, ex. `button5`.
    pub control: String,
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
    let live = Arc::new(Mutex::new(LiveCaptureFrame {
        session_id: id,
        sequence: 0,
        inputs: Vec::new(),
        last: None,
    }));
    let failure = Arc::new(Mutex::new(None));

    {
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
                    if let Ok(mut slot) = latest.lock() {
                        *slot = Some(CapturedInput {
                            guid: found.guid.to_string(),
                            control: found.control.clone(),
                        });
                    }
                }

                let sticky = latest.lock().ok().and_then(|slot| slot.clone());
                let inputs: Vec<LiveInput> = found.into_iter().map(live_input).collect();
                if let Ok(mut slot) = live.lock() {
                    // Une séquence est un changement observable, pas un simple
                    // tick : au repos l'interface ne doit pas se rerendre 60
                    // fois par seconde. La transition vers `inputs: []` reste
                    // bien un changement et signale immédiatement le relâchement.
                    if slot.inputs != inputs || slot.last != sticky {
                        slot.sequence = slot.sequence.wrapping_add(1);
                        slot.inputs = inputs;
                        slot.last = sticky;
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
        live,
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
pub fn clear_capture(state: tauri::State<'_, CaptureState>) -> CmdResult<()> {
    let guard = state.inner.lock().map_err(|_| "état de capture corrompu")?;
    if let Some(session) = guard.as_ref() {
        if let Ok(mut slot) = session.latest.lock() {
            *slot = None;
        }
        if let Ok(mut frame) = session.live.lock() {
            if frame.last.is_some() {
                frame.sequence = frame.sequence.wrapping_add(1);
                frame.last = None;
            }
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

/// Choisit le candidat persistant sans perdre la frame multi-contrôles.
///
/// Un bouton est prioritaire sur un HAT, lui-même prioritaire sur un axe,
/// même si le contrôle numérique appartient à un périphérique énuméré
/// après celui de l'axe.
fn capture_candidate(inputs: &[CapturedFrom]) -> Option<CapturedFrom> {
    inputs
        .iter()
        .filter(|input| input.capturable)
        .min_by_key(|input| match input.kind {
            CapturedControlKind::Button => 0,
            CapturedControlKind::Hat => 1,
            CapturedControlKind::Axis => 2,
        })
        .cloned()
}

fn live_input(input: CapturedFrom) -> LiveInput {
    LiveInput {
        guid: input.guid.to_string(),
        control: input.control,
        kind: match input.kind {
            CapturedControlKind::Button => LiveInputKind::Button,
            CapturedControlKind::Hat => LiveInputKind::Hat,
            CapturedControlKind::Axis => LiveInputKind::Axis,
        },
        value: input.value,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn captured(
        control: &str,
        kind: CapturedControlKind,
        value: f32,
        capturable: bool,
    ) -> CapturedFrom {
        CapturedFrom {
            guid: DeviceGuid::parse("B10A044F-0000-0000-0000-504944564944").unwrap(),
            control: control.into(),
            kind,
            value,
            capturable,
        }
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
    fn live_conversion_preserves_axis_sign_and_kind() {
        let input = live_input(captured("rotz", CapturedControlKind::Axis, -0.625, true));
        assert_eq!(input.control, "rotz");
        assert_eq!(input.kind, LiveInputKind::Axis);
        assert_eq!(input.value, -0.625);
    }
}
