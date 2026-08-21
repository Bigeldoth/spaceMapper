//! Profils exportés, ceux que s'échange la communauté.
//!
//! Star Citizen les range dans `Controls\mappings` et sait les charger, mais
//! n'en montre rien avant de les appliquer : on copie un fichier à l'aveugle.
//! Ce module répond à la question qu'on se pose avant d'installer le travail
//! d'un inconnu — **qu'est-ce que ça fait, et est-ce que ça correspond à mon
//! matériel ?**
//!
//! Lecture seule, entièrement. Appliquer un profil, l'adapter à un autre ordre
//! de périphériques ou en permuter les manches relève de l'édition Premium.

use crate::devices::enumerator;
use serde::Serialize;
use spacemapper_core::actionmaps::{self, ActionMaps, DeviceKind};
use spacemapper_core::device::{DeviceEnumerator, InputDevice};
use std::path::{Path, PathBuf};

type CmdResult<T> = Result<T, String>;

/// Un fichier trouvé dans `Controls\mappings`.
#[derive(Debug, Serialize)]
pub struct LayoutFile {
    pub path: String,
    pub file_name: String,
    /// Nom donné par l'auteur, quand le fichier en porte un.
    pub label: Option<String>,
    pub description: Option<String>,
    /// Assignations exploitables — ni vides, ni illisibles.
    pub bindings: usize,
}

/// Périphérique attendu par le profil, confronté au matériel branché.
#[derive(Debug, Serialize)]
pub struct ExpectedDevice {
    /// `js1`, `kb1`, `gp2`…
    pub slot: String,
    pub kind: String,
    /// Nom écrit par l'auteur, ex. `T.16000M Joystick`.
    pub product_name: Option<String>,
    pub guid: Option<String>,
    /// Nombre d'exemplaires branchés correspondant à ce GUID de modèle.
    ///
    /// `0` : le profil attend un appareil que vous n'avez pas. `2` ou plus :
    /// le GUID ne suffit pas à désigner lequel, c'est le cas HOSAS.
    pub matching_devices: usize,
    /// Assignations qui visent ce slot.
    pub bindings: usize,
}

#[derive(Debug, Serialize)]
pub struct LayoutInspection {
    pub path: String,
    pub file_name: String,
    pub label: Option<String>,
    pub description: Option<String>,
    pub profile_name: Option<String>,
    pub expected_devices: Vec<ExpectedDevice>,
    pub categories: Vec<CategorySummary>,
    /// Assignations exploitables.
    pub bindings: usize,
    /// Assignations que le jeu ne saura pas relire.
    pub corrupt: usize,
    /// Emploient une touche modificatrice.
    pub with_modifier: usize,
    /// Emploient un mode d'activation ou un multi-appui.
    pub with_activation_mode: usize,
    pub with_multi_tap: usize,
}

#[derive(Debug, Serialize)]
pub struct CategorySummary {
    pub actionmap: String,
    pub bindings: usize,
}

/// Dossier des profils exportés, déduit du chemin d'un `actionmaps.xml`.
///
/// Le profil vit dans `…\user\client\0\Profiles\default\actionmaps.xml` et les
/// exports dans `…\user\client\0\Controls\mappings`. On remonte de deux crans
/// plutôt que de reconstruire l'arborescence, qui varie selon le canal.
fn mappings_dir(profile: &Path) -> Option<PathBuf> {
    let client = profile.ancestors().nth(3)?;
    Some(client.join("Controls").join("mappings"))
}

/// Profils exportés présents sur la machine.
///
/// Une absence de dossier n'est pas une erreur : le joueur n'a simplement
/// jamais exporté ni importé de disposition.
#[tauri::command]
pub fn list_layouts(path: String) -> CmdResult<Vec<LayoutFile>> {
    let Some(dir) = mappings_dir(Path::new(&path)) else {
        return Ok(Vec::new());
    };

    let entries = match std::fs::read_dir(&dir) {
        Ok(e) => e,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(format!("{}: {e}", dir.display())),
    };

    let mut found = Vec::new();
    for entry in entries.filter_map(|e| e.ok()) {
        let file = entry.path();
        if file.extension().and_then(|e| e.to_str()) != Some("xml") {
            continue;
        }
        // Un fichier illisible est ignoré plutôt que fatal : un export
        // tronqué ne doit pas cacher les autres.
        let Ok(maps) = actionmaps::parse_file(&file) else {
            continue;
        };

        found.push(LayoutFile {
            file_name: file
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default(),
            path: file.to_string_lossy().into_owned(),
            label: non_empty(maps.header_label.clone()),
            description: non_empty(maps.header_description.clone()),
            bindings: usable(&maps).count(),
        });
    }

    found.sort_by(|a, b| a.file_name.cmp(&b.file_name));
    Ok(found)
}

/// Détaille un profil exporté, sans rien y écrire.
#[tauri::command]
pub fn inspect_layout(path: String) -> CmdResult<LayoutInspection> {
    let file = PathBuf::from(&path);
    let maps = actionmaps::parse_file(&file).map_err(|e| e.to_string())?;
    let devices = enumerator().enumerate().unwrap_or_default();

    let mut with_modifier = 0;
    let mut with_activation_mode = 0;
    let mut with_multi_tap = 0;

    for (_, _, rebind) in maps.rebinds() {
        if rebind.is_unbound() || rebind.is_corrupt() {
            continue;
        }
        if rebind.input.as_ref().is_some_and(|i| i.modifier.is_some()) {
            with_modifier += 1;
        }
        // `Some("")` est la forme cassée que le client écrit parfois ; elle
        // compte quand même comme un mode d'activation présent.
        if rebind.activation_mode.is_some() {
            with_activation_mode += 1;
        }
        if rebind.multi_tap.is_some() {
            with_multi_tap += 1;
        }
    }

    let mut categories: Vec<CategorySummary> = maps
        .action_maps
        .iter()
        .map(|map| CategorySummary {
            actionmap: map.name.clone(),
            bindings: map
                .actions
                .iter()
                .flat_map(|a| &a.rebinds)
                .filter(|r| !r.is_unbound() && !r.is_corrupt())
                .count(),
        })
        .filter(|c| c.bindings > 0)
        .collect();
    categories.sort_by_key(|c| std::cmp::Reverse(c.bindings));

    Ok(LayoutInspection {
        file_name: file
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default(),
        path,
        label: non_empty(maps.header_label.clone()),
        description: non_empty(maps.header_description.clone()),
        profile_name: maps.profile_name.clone(),
        expected_devices: expected_devices(&maps, &devices),
        categories,
        bindings: usable(&maps).count(),
        corrupt: maps.rebinds().filter(|(_, _, r)| r.is_corrupt()).count(),
        with_modifier,
        with_activation_mode,
        with_multi_tap,
    })
}

fn expected_devices(maps: &ActionMaps, devices: &[InputDevice]) -> Vec<ExpectedDevice> {
    let mut out: Vec<ExpectedDevice> = maps
        .options
        .iter()
        .map(|o| {
            let slot = format!("{}{}", o.device_kind.prefix(), o.instance);
            let matching = o
                .guid
                .as_ref()
                .map(|g| devices.iter().filter(|d| &d.product_guid == g).count())
                .unwrap_or(0);

            ExpectedDevice {
                bindings: maps
                    .rebinds()
                    .filter_map(|(_, _, r)| r.input.as_ref())
                    .filter(|i| {
                        i.device_kind == o.device_kind
                            && i.instance == o.instance
                            && !i.control.is_empty()
                    })
                    .count(),
                kind: kind_name(o.device_kind).to_string(),
                slot,
                product_name: o.product_name.clone(),
                guid: o.guid.as_ref().map(|g| g.to_string()),
                matching_devices: matching,
            }
        })
        .collect();

    // Le plus sollicité en premier : c'est celui qui décide de l'ergonomie.
    out.sort_by_key(|d| std::cmp::Reverse(d.bindings));
    out
}

fn kind_name(kind: DeviceKind) -> &'static str {
    match kind {
        DeviceKind::Joystick => "joystick",
        DeviceKind::Keyboard => "keyboard",
        DeviceKind::Mouse => "mouse",
        DeviceKind::Gamepad => "gamepad",
    }
}

fn usable(maps: &ActionMaps) -> impl Iterator<Item = ()> + '_ {
    maps.rebinds()
        .filter(|(_, _, r)| !r.is_unbound() && !r.is_corrupt())
        .map(|_| ())
}

/// Le jeu écrit volontiers `description=""` : une chaîne vide n'est pas une
/// description, et l'afficher laisserait une ligne blanche.
fn non_empty(value: Option<String>) -> Option<String> {
    value.filter(|v| !v.trim().is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mappings_directory_sits_beside_the_profiles_folder() {
        // Relevé sur une installation réelle : le profil vit dans
        // `…\client\0\Profiles\default\actionmaps.xml`, les exports dans
        // `…\client\0\Controls\mappings`.
        let profile =
            Path::new(r"C:\Games\StarCitizen\LIVE\user\client\0\Profiles\default\actionmaps.xml");
        assert_eq!(
            mappings_dir(profile).unwrap(),
            Path::new(r"C:\Games\StarCitizen\LIVE\user\client\0\Controls\mappings")
        );
    }

    #[test]
    fn a_blank_description_is_treated_as_absent() {
        assert_eq!(non_empty(Some("   ".into())), None);
        assert_eq!(non_empty(Some(String::new())), None);
        assert_eq!(non_empty(Some("HOSAS".into())), Some("HOSAS".into()));
    }
}
