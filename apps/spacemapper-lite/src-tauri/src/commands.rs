//! Commandes exposées au frontend.
//!
//! Surface volontairement minuscule, et **entièrement en lecture**. Aucune
//! commande d'ici ne prend un chemin de destination ni n'ouvre un fichier en
//! écriture. C'est la garantie technique de l'édition Lite : elle ne peut pas
//! abîmer une configuration, même en cas de bug.

use serde::Serialize;
use spacemapper_core::actionmaps::{self, ActionMaps};
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

#[derive(Debug, Serialize)]
pub struct BindingView {
    /// Nom de la catégorie, ex. `spaceship_movement`.
    pub category: String,
    /// Nom interne de l'action, ex. `v_boost`.
    pub action: String,
    /// Valeur brute, telle qu'écrite dans le fichier.
    pub input_raw: String,
    /// Périphérique visé (`js`, `kb`, …) et son index, ex. `js1`.
    pub device: Option<String>,
    pub modifier: Option<String>,
    pub control: Option<String>,
    pub activation_mode: Option<String>,
    pub multi_tap: Option<String>,
    /// L'assignation est présente mais indéchiffrable.
    pub corrupt: bool,
    pub line: u32,
}

#[derive(Debug, Serialize)]
pub struct FlightBindings {
    pub profile_name: Option<String>,
    /// Index de joystick réellement utilisés par au moins une assignation.
    pub joysticks_in_use: Vec<u8>,
    /// GUID trouvés dans le fichier, toutes sources confondues.
    pub known_guids: Vec<String>,
    pub bindings: Vec<BindingView>,
    /// Nombre d'assignations corrompues — l'accroche vers l'édition Premium,
    /// qui sait les réparer.
    pub corrupt_count: usize,
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

/// Lit les assignations de pilotage d'un `actionmaps.xml`.
///
/// C'est le cœur de l'édition Lite : montrer, lisiblement, ce que le joueur a
/// réellement configuré pour voler.
#[tauri::command]
pub fn read_flight_bindings(path: String) -> CmdResult<FlightBindings> {
    let maps = actionmaps::parse_file(PathBuf::from(&path)).map_err(|e| e.to_string())?;
    Ok(to_flight_view(&maps))
}

/// Édition de ce binaire. Le frontend s'en sert pour afficher l'accroche
/// d'upgrade — et pour qu'un utilisateur puisse vérifier ce qu'il exécute.
#[tauri::command]
pub fn edition() -> &'static str {
    "lite"
}

fn to_flight_view(maps: &ActionMaps) -> FlightBindings {
    let mut bindings = Vec::new();
    let mut corrupt_count = 0;

    for (map, action, rebind) in maps.rebinds() {
        if !map.is_flight() || rebind.is_unbound() {
            continue;
        }
        let corrupt = rebind.is_corrupt();
        if corrupt {
            corrupt_count += 1;
        }

        let (device, modifier, control) = match &rebind.input {
            Some(input) => (
                Some(format!("{}{}", input.device_kind.prefix(), input.instance)),
                input.modifier.clone(),
                Some(input.control.clone()),
            ),
            None => (None, None, None),
        };

        bindings.push(BindingView {
            category: map.name.clone(),
            action: action.name.clone(),
            input_raw: rebind.input_raw.clone(),
            device,
            modifier,
            control,
            activation_mode: rebind.activation_mode.clone(),
            multi_tap: rebind.multi_tap.clone(),
            corrupt,
            line: rebind.line,
        });
    }

    FlightBindings {
        profile_name: maps.profile_name.clone(),
        joysticks_in_use: maps.joystick_instances_in_use(),
        known_guids: maps.known_guids().iter().map(|g| g.to_string()).collect(),
        bindings,
        corrupt_count,
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

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"<ActionMaps>
 <ActionProfiles profileName="default">
  <actionmap name="spaceship_movement">
   <action name="v_boost"><rebind input="js1_rctrl+button10"/></action>
   <action name="v_broken"><rebind input="js3_ " activationMode="press"/></action>
   <action name="v_unbound"><rebind input=""/></action>
  </actionmap>
  <actionmap name="player">
   <action name="v_use"><rebind input="kb1_f"/></action>
  </actionmap>
 </ActionProfiles>
</ActionMaps>"#;

    #[test]
    fn flight_view_keeps_only_flight_and_bound_actions() {
        let maps = actionmaps::parse_str(SAMPLE).unwrap();
        let view = to_flight_view(&maps);

        let actions: Vec<_> = view.bindings.iter().map(|b| b.action.as_str()).collect();
        // `v_use` est à pied, `v_unbound` n'est pas assignée.
        assert_eq!(actions, ["v_boost", "v_broken"]);
    }

    #[test]
    fn flight_view_decomposes_modifier() {
        let maps = actionmaps::parse_str(SAMPLE).unwrap();
        let view = to_flight_view(&maps);
        let boost = &view.bindings[0];

        assert_eq!(boost.device.as_deref(), Some("js1"));
        assert_eq!(boost.modifier.as_deref(), Some("rctrl"));
        assert_eq!(boost.control.as_deref(), Some("button10"));
        assert!(!boost.corrupt);
    }

    #[test]
    fn flight_view_counts_corrupt_bindings() {
        let maps = actionmaps::parse_str(SAMPLE).unwrap();
        let view = to_flight_view(&maps);

        assert_eq!(view.corrupt_count, 1);
        let broken = view.bindings.iter().find(|b| b.corrupt).unwrap();
        assert_eq!(broken.input_raw, "js3_ ");
        assert!(broken.device.is_none());
    }

    #[test]
    fn flight_view_reports_joysticks_actually_used() {
        let maps = actionmaps::parse_str(SAMPLE).unwrap();
        // `js3_ ` est illisible, donc js3 ne compte pas comme utilisé.
        assert_eq!(to_flight_view(&maps).joysticks_in_use, vec![1]);
    }
}
