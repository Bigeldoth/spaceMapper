//! Commandes exposées au frontend.
//!
//! Surface volontairement minuscule, et **entièrement en lecture**. Aucune
//! commande d'ici ne prend un chemin de destination ni n'ouvre un fichier en
//! écriture. C'est la garantie technique de l'édition Lite : elle ne peut pas
//! abîmer une configuration, même en cas de bug.

use serde::Serialize;
use spacemapper_core::actionmaps;
use spacemapper_core::device::diagnosis::{self, Diagnosis};
use spacemapper_core::device::{DeviceEnumerator, InputDevice};
use spacemapper_core::install;
use std::path::PathBuf;

/// Les erreurs traversent la frontière Tauri sous forme de chaîne : le
/// frontend n'a pas besoin de la structure, seulement d'un message lisible.
type CmdResult<T> = Result<T, String>;

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
pub fn list_devices() -> CmdResult<Vec<DeviceView>> {
    enumerator()
        .enumerate()
        .map(|devices| devices.into_iter().map(DeviceView::from).collect())
        .map_err(|e| e.to_string())
}

/// Fichiers `actionmaps.xml` trouvés sur la machine.
///
/// Une liste vide n'est pas une erreur : le frontend doit alors proposer une
/// sélection manuelle du fichier.
#[tauri::command]
pub fn locate_actionmaps() -> Vec<ProfileLocation> {
    install::discover(&install::default_roots())
        .into_iter()
        .map(|p| ProfileLocation {
            channel: p.channel,
            path: p.path.to_string_lossy().into_owned(),
        })
        .collect()
}

/// Confronte le profil au matériel réellement branché.
///
/// C'est le diagnostic que le système natif ne fournit pas : le jeu n'indique
/// nulle part que `js1_` ne désigne plus le même manche qu'hier.
#[tauri::command]
pub fn diagnose_devices(path: String) -> CmdResult<Diagnosis> {
    let maps = actionmaps::parse_file(PathBuf::from(&path)).map_err(|e| e.to_string())?;
    let devices = enumerator().enumerate().map_err(|e| e.to_string())?;
    Ok(diagnosis::diagnose(&maps, &devices))
}

#[derive(Debug, Serialize)]
pub struct BuildInfo {
    /// `lite` ou `premium`.
    pub edition: &'static str,
    /// `production` ou `staging`.
    pub channel: &'static str,
    pub version: &'static str,
}

/// Identité de ce binaire.
///
/// Le frontend s'en sert pour afficher l'accroche d'upgrade et signaler
/// visiblement une build de pré-release — un testeur doit savoir en un coup
/// d'œil laquelle des deux versions installées il a sous les yeux.
#[tauri::command]
pub fn build_info() -> BuildInfo {
    BuildInfo {
        edition: "lite",
        channel: spacemapper_core::channel::CHANNEL,
        version: env!("CARGO_PKG_VERSION"),
    }
}

#[cfg(windows)]
fn enumerator() -> impl DeviceEnumerator {
    spacemapper_core::device::directinput::DirectInputEnumerator::new()
}

#[cfg(not(windows))]
fn enumerator() -> impl DeviceEnumerator {
    spacemapper_core::device::FakeEnumerator::default()
}
