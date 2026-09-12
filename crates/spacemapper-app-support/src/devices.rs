//! Découverte du matériel et des profils, en lecture seule.
//!
//! Surface volontairement minuscule, et **entièrement en lecture** : aucune
//! commande d'ici ne prend un chemin de destination ni n'ouvre un fichier en
//! écriture. C'est vrai de toutes les éditions, et c'est pourquoi ce module
//! vit dans le crate partagé plutôt que dans chaque application.
//!
//! Ce qui distingue les éditions — le périmètre d'écriture — n'est pas ici
//! mais dans leur module `editing` respectif.

use serde::Serialize;
use spacemapper_core::actionmaps;
use spacemapper_core::device::diagnosis::{self, Diagnosis};
use spacemapper_core::device::{DeviceEnumerator, InputDevice};
use spacemapper_core::install;
use std::path::PathBuf;
use std::sync::{Arc, Condvar, Mutex, OnceLock};
use std::time::{Duration, Instant};

/// Les erreurs traversent la frontière Tauri sous forme de chaîne : le
/// frontend n'a pas besoin de la structure, seulement d'un message lisible.
type CmdResult<T> = Result<T, String>;

type EnumerationResult = CmdResult<Vec<InputDevice>>;
type EnumerationJob = dyn Fn() -> EnumerationResult + Send + Sync;

const ENUMERATION_CACHE_TTL: Duration = Duration::from_secs(1);
const ENUMERATION_TIMEOUT: Duration = Duration::from_secs(2);
const ENUMERATION_TIMEOUT_MESSAGE: &str =
    "la découverte des périphériques prend trop de temps ; le pilote est encore occupé";

/// Une énumération native peut rester bloquée dans un pilote. Sa durée ne doit
/// bloquer ni la fenêtre, ni les prochaines demandes : celles-ci rejoignent la
/// même opération et expirent indépendamment, sans créer d'autres threads natifs.
struct DeviceDiscovery {
    active: Mutex<Option<Arc<EnumerationFlight>>>,
    enumerate: Arc<EnumerationJob>,
    cache_ttl: Duration,
    timeout: Duration,
}

struct EnumerationFlight {
    result: Mutex<Option<(Instant, EnumerationResult)>>,
    ready: Condvar,
}

impl EnumerationFlight {
    fn wait(&self, timeout: Duration) -> EnumerationResult {
        let started = Instant::now();
        let mut result = self
            .result
            .lock()
            .map_err(|_| "état de découverte corrompu")?;
        loop {
            if let Some((_, result)) = result.as_ref() {
                return result.clone();
            }
            let remaining = timeout.saturating_sub(started.elapsed());
            if remaining.is_zero() {
                return Err(ENUMERATION_TIMEOUT_MESSAGE.into());
            }
            let (next, _) = self
                .ready
                .wait_timeout(result, remaining)
                .map_err(|_| "état de découverte corrompu")?;
            result = next;
        }
    }
}

impl DeviceDiscovery {
    fn new(
        enumerate: impl Fn() -> EnumerationResult + Send + Sync + 'static,
        cache_ttl: Duration,
        timeout: Duration,
    ) -> Self {
        Self {
            active: Mutex::new(None),
            enumerate: Arc::new(enumerate),
            cache_ttl,
            timeout,
        }
    }

    fn discover(&self) -> EnumerationResult {
        let started = Instant::now();
        let flight = {
            let mut active = self
                .active
                .lock()
                .map_err(|_| "état de découverte corrompu")?;
            let reusable = if let Some(flight) = active.as_ref() {
                let result = flight
                    .result
                    .lock()
                    .map_err(|_| "état de découverte corrompu")?;
                result
                    .as_ref()
                    .map(|(finished, _)| finished.elapsed() < self.cache_ttl)
                    .unwrap_or(true)
            } else {
                false
            };

            if reusable {
                Arc::clone(active.as_ref().expect("opération de découverte présente"))
            } else {
                let flight = Arc::new(EnumerationFlight {
                    result: Mutex::new(None),
                    ready: Condvar::new(),
                });
                let worker_flight = Arc::clone(&flight);
                let enumerate = Arc::clone(&self.enumerate);
                // Un thread indépendant permet aussi de quitter l'application
                // sans attendre un pilote bloqué dans le pool async de Tauri.
                let worker = std::thread::Builder::new()
                    .name("spacemapper-device-discovery".into())
                    .spawn(move || {
                        let result =
                            std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| enumerate()))
                                .unwrap_or_else(|_| {
                                    Err("la découverte des périphériques s'est interrompue".into())
                                });
                        let mut slot = worker_flight
                            .result
                            .lock()
                            .unwrap_or_else(|e| e.into_inner());
                        *slot = Some((Instant::now(), result));
                        drop(slot);
                        worker_flight.ready.notify_all();
                    })
                    .map_err(|e| {
                        format!("impossible de lancer la découverte des périphériques : {e}")
                    })?;
                drop(worker);
                *active = Some(Arc::clone(&flight));
                flight
            }
        };
        flight.wait(self.timeout.saturating_sub(started.elapsed()))
    }
}

/// Réservé aux tâches bloquantes : aucune commande IPC synchrone ne doit
/// attendre un pilote DirectInput sur le thread de la fenêtre.
pub(crate) fn discover_devices() -> EnumerationResult {
    static DISCOVERY: OnceLock<DeviceDiscovery> = OnceLock::new();
    DISCOVERY
        .get_or_init(|| {
            DeviceDiscovery::new(
                || enumerator().enumerate().map_err(|e| e.to_string()),
                ENUMERATION_CACHE_TTL,
                ENUMERATION_TIMEOUT,
            )
        })
        .discover()
}

#[derive(Debug, Serialize)]
pub struct DeviceView {
    pub instance_guid: String,
    pub product_name: String,
    pub instance_name: String,
    /// `joystick` ou `gamepad` : détermine le préfixe employé par le jeu.
    pub category: spacemapper_core::device::DeviceCategory,
    pub axes: u32,
    pub buttons: u32,
    pub povs: u32,
}

impl From<InputDevice> for DeviceView {
    fn from(d: InputDevice) -> Self {
        DeviceView {
            instance_guid: d.instance_guid.to_string(),
            product_name: d.product_name,
            instance_name: d.instance_name,
            category: d.category,
            axes: d.capabilities.axes,
            buttons: d.capabilities.buttons,
            povs: d.capabilities.povs,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ProfileLocation {
    pub channel: String,
    pub path: String,
}

/// Périphériques d'entrée actuellement branchés.
#[tauri::command]
pub async fn list_devices() -> CmdResult<Vec<DeviceView>> {
    tauri::async_runtime::spawn_blocking(|| {
        discover_devices().map(|devices| devices.into_iter().map(DeviceView::from).collect())
    })
    .await
    .map_err(|e| format!("découverte des périphériques interrompue : {e}"))?
}

/// Fichiers `actionmaps.xml` trouvés sur la machine.
///
/// Une liste vide n'est pas une erreur : le frontend doit alors proposer une
/// sélection manuelle du fichier.
#[tauri::command]
pub async fn locate_actionmaps() -> CmdResult<Vec<ProfileLocation>> {
    tauri::async_runtime::spawn_blocking(|| {
        install::discover(&install::default_roots())
            .into_iter()
            .map(|p| ProfileLocation {
                channel: p.channel,
                path: p.path.to_string_lossy().into_owned(),
            })
            .collect()
    })
    .await
    .map_err(|e| format!("recherche des profils interrompue : {e}"))
}

/// Confronte le profil au matériel réellement branché.
///
/// C'est le diagnostic que le système natif ne fournit pas : le jeu n'indique
/// nulle part que `js1_` ne désigne plus le même manche qu'hier.
#[tauri::command]
pub async fn diagnose_devices(path: String) -> CmdResult<Diagnosis> {
    tauri::async_runtime::spawn_blocking(move || {
        let maps = actionmaps::parse_file(PathBuf::from(&path)).map_err(|e| e.to_string())?;
        let devices = discover_devices()?;
        Ok(diagnosis::diagnose(&maps, &devices))
    })
    .await
    .map_err(|e| format!("diagnostic des périphériques interrompu : {e}"))?
}

/// Énumérateur de la plateforme courante.
///
/// Appelé uniquement par le service de découverte sur son thread dédié.
#[cfg(windows)]
fn enumerator() -> impl DeviceEnumerator {
    spacemapper_core::device::directinput::DirectInputEnumerator::new()
}

#[cfg(not(windows))]
fn enumerator() -> impl DeviceEnumerator {
    spacemapper_core::device::FakeEnumerator::default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::mpsc;
    use std::sync::Barrier;

    #[test]
    fn concurrent_requests_share_one_native_enumeration_and_its_result() {
        let calls = Arc::new(AtomicUsize::new(0));
        let (started, started_rx) = mpsc::channel();
        let (release, release_rx) = mpsc::channel();
        let release_rx = Mutex::new(release_rx);
        let worker_calls = Arc::clone(&calls);
        let discovery = Arc::new(DeviceDiscovery::new(
            move || {
                worker_calls.fetch_add(1, Ordering::SeqCst);
                started.send(std::thread::current().id()).unwrap();
                release_rx.lock().unwrap().recv().unwrap();
                Ok(Vec::new())
            },
            Duration::from_secs(1),
            Duration::from_secs(2),
        ));
        let barrier = Arc::new(Barrier::new(5));
        let requests: Vec<_> = (0..4)
            .map(|_| {
                let discovery = Arc::clone(&discovery);
                let barrier = Arc::clone(&barrier);
                std::thread::spawn(move || {
                    barrier.wait();
                    (std::thread::current().id(), discovery.discover())
                })
            })
            .collect();
        barrier.wait();
        let worker_thread = started_rx.recv_timeout(Duration::from_secs(1)).unwrap();
        release.send(()).unwrap();
        for request in requests {
            let (request_thread, result) = request.join().unwrap();
            assert_ne!(
                request_thread, worker_thread,
                "le pilote tourne sur son thread dédié"
            );
            assert_eq!(result.unwrap(), Vec::new());
        }
        assert_eq!(discovery.discover().unwrap(), Vec::new());
        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn a_blocked_driver_times_out_without_spawning_another_worker_on_retry() {
        let calls = Arc::new(AtomicUsize::new(0));
        let worker_calls = Arc::clone(&calls);
        let (release, release_rx) = mpsc::channel();
        let release_rx = Mutex::new(release_rx);
        let discovery = DeviceDiscovery::new(
            move || {
                worker_calls.fetch_add(1, Ordering::SeqCst);
                release_rx.lock().unwrap().recv().unwrap();
                Ok(Vec::new())
            },
            Duration::from_millis(10),
            Duration::from_millis(25),
        );

        let started = Instant::now();
        for _ in 0..3 {
            assert_eq!(
                discovery.discover().unwrap_err(),
                ENUMERATION_TIMEOUT_MESSAGE
            );
        }
        assert!(started.elapsed() < Duration::from_secs(2));
        assert_eq!(calls.load(Ordering::SeqCst), 1);

        // Même après plusieurs expirations, le résultat tardif est récupéré.
        release.send(()).unwrap();
        assert_eq!(discovery.discover().unwrap(), Vec::new());
        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn completed_discovery_refreshes_after_the_cache_expires() {
        let calls = Arc::new(AtomicUsize::new(0));
        let worker_calls = Arc::clone(&calls);
        let discovery = DeviceDiscovery::new(
            move || {
                worker_calls.fetch_add(1, Ordering::SeqCst);
                Ok(Vec::new())
            },
            Duration::ZERO,
            Duration::from_secs(1),
        );
        assert_eq!(discovery.discover().unwrap(), Vec::new());
        assert_eq!(discovery.discover().unwrap(), Vec::new());
        assert_eq!(calls.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn a_driver_error_is_reported_and_does_not_prevent_a_later_retry() {
        let calls = Arc::new(AtomicUsize::new(0));
        let worker_calls = Arc::clone(&calls);
        let discovery = DeviceDiscovery::new(
            move || {
                if worker_calls.fetch_add(1, Ordering::SeqCst) == 0 {
                    Err("pilote indisponible".into())
                } else {
                    Ok(Vec::new())
                }
            },
            Duration::ZERO,
            Duration::from_secs(1),
        );
        assert_eq!(discovery.discover().unwrap_err(), "pilote indisponible");
        assert_eq!(discovery.discover().unwrap(), Vec::new());
        assert_eq!(calls.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn a_panicking_worker_returns_an_error_instead_of_leaving_requests_pending() {
        let discovery = DeviceDiscovery::new(
            || panic!("simulated enumeration panic"),
            Duration::from_secs(1),
            Duration::from_secs(1),
        );
        assert_eq!(
            discovery.discover().unwrap_err(),
            "la découverte des périphériques s'est interrompue"
        );
    }
}
