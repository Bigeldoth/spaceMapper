//! Commandes d'édition et de points de restauration.
//!
//! L'édition Lite se limite aux déplacements, à pied et en vol. Cette limite
//! est appliquée par `spacemapper-edit`, en Rust : ces commandes ne font que
//! transmettre, elles ne décident pas du périmètre. Une action hors périmètre
//! est refusée même si le frontend la propose.
//!
//! Les sauvegardes sont créées à la demande, jamais automatiquement. Il revient
//! donc à l'interface de signaler qu'aucun point de restauration n'existe
//! avant de laisser modifier quoi que ce soit.

use serde::Serialize;
use spacemapper_core::actionmaps::{self, ActionMaps};
use spacemapper_core::channel;
use spacemapper_edit::{backup, scope, BindingEdit, EditCategory};
use std::path::{Path, PathBuf};

type CmdResult<T> = Result<T, String>;

/// Une assignation présentée à l'édition.
#[derive(Debug, Serialize)]
pub struct EditableBinding {
    pub actionmap: String,
    pub category: EditCategory,
    pub action: String,
    pub input_raw: String,
    pub device: Option<String>,
    pub control: Option<String>,
    /// L'action porte un modificateur ou un mode d'activation, que l'édition
    /// Lite ne sait pas manipuler. La modifier écraserait un réglage que
    /// l'utilisateur ne voit pas ; on la présente donc en lecture seule.
    pub locked: bool,
    /// Motif du verrouillage, à afficher tel quel.
    pub locked_reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BackupView {
    pub path: String,
    pub timestamp: String,
}

/// Emplacement des sauvegardes, isolé par canal.
fn backup_dir() -> CmdResult<PathBuf> {
    channel::data_dir()
        .map(|d| d.join("Backups"))
        .ok_or_else(|| "APPDATA introuvable".to_string())
}

/// Les assignations que l'édition Lite peut modifier.
#[tauri::command]
pub fn list_editable_bindings(path: String) -> CmdResult<Vec<EditableBinding>> {
    let maps = actionmaps::parse_file(PathBuf::from(&path)).map_err(|e| e.to_string())?;
    Ok(collect_editable(&maps))
}

/// Réassigne une action.
#[tauri::command]
pub fn set_binding(
    path: String,
    actionmap: String,
    action: String,
    input: String,
) -> CmdResult<()> {
    write(&path, BindingEdit::set(&actionmap, &action, &input))
}

/// Efface une assignation.
#[tauri::command]
pub fn clear_binding(path: String, actionmap: String, action: String) -> CmdResult<()> {
    write(&path, BindingEdit::clear(&actionmap, &action))
}

/// Crée un point de restauration du profil courant.
///
/// Renvoie le chemin du fichier créé, pour que l'interface puisse indiquer à
/// l'utilisateur où se trouve son filet.
#[tauri::command]
pub fn create_backup(path: String) -> CmdResult<String> {
    let dir = backup_dir()?;
    backup::create(Path::new(&path), &dir)
        .map(|saved| saved.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_backups() -> CmdResult<Vec<BackupView>> {
    let dir = backup_dir()?;
    backup::list(&dir)
        .map_err(|e| e.to_string())
        .map(|entries| entries.into_iter().map(BackupView::from).collect())
}

/// Restaure un point de restauration par-dessus le profil courant.
///
/// L'état écrasé est lui-même conservé : se tromper de sauvegarde ne doit pas
/// être définitif.
#[tauri::command]
pub fn restore_backup(path: String, backup_path: String) -> CmdResult<()> {
    let dir = backup_dir()?;
    backup::restore(Path::new(&backup_path), Path::new(&path), &dir).map_err(|e| e.to_string())
}

fn write(path: &str, edit: BindingEdit) -> CmdResult<()> {
    spacemapper_edit::apply_to_file(Path::new(path), &edit).map_err(|e| e.to_string())
}

impl From<backup::BackupEntry> for BackupView {
    fn from(entry: backup::BackupEntry) -> Self {
        BackupView {
            path: entry.path.to_string_lossy().into_owned(),
            // L'horodatage brut est mis en forme côté interface, qui connaît
            // la locale de l'utilisateur.
            timestamp: entry.timestamp.to_string(),
        }
    }
}

fn collect_editable(maps: &ActionMaps) -> Vec<EditableBinding> {
    maps.rebinds()
        .filter_map(|(map, action, rebind)| {
            let category = scope::category_of(&map.name)?;

            let (device, control, modifier) = match &rebind.input {
                Some(input) => (
                    Some(format!("{}{}", input.device_kind.prefix(), input.instance)),
                    Some(input.control.clone()),
                    input.modifier.clone(),
                ),
                None => (None, None, None),
            };

            // On refuse de toucher à ce qu'on ne sait pas restituer.
            let locked_reason = if modifier.is_some() {
                Some("Comporte un modificateur — réservé à l'édition Premium".to_string())
            } else if rebind
                .activation_mode
                .as_deref()
                .is_some_and(|m| !m.is_empty())
                || rebind.multi_tap.is_some()
            {
                Some("Comporte un mode d'activation — réservé à l'édition Premium".to_string())
            } else {
                None
            };

            Some(EditableBinding {
                actionmap: map.name.clone(),
                category,
                action: action.name.clone(),
                input_raw: rebind.input_raw.clone(),
                device,
                control,
                locked: locked_reason.is_some(),
                locked_reason,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const DOC: &str = r#"<ActionMaps><ActionProfiles profileName="default">
  <actionmap name="spaceship_movement">
   <action name="v_boost"><rebind input="js1_button5"/></action>
   <action name="v_brake"><rebind input="js1_rctrl+button6"/></action>
   <action name="v_decoy"><rebind input="js1_hat1_down" multiTap="2"/></action>
   <action name="v_libre"><rebind input="js2_ "/></action>
  </actionmap>
  <actionmap name="player">
   <action name="v_jump"><rebind input="kb1_space"/></action>
  </actionmap>
  <actionmap name="spaceship_weapons">
   <action name="v_attack1"><rebind input="js1_button1"/></action>
  </actionmap>
 </ActionProfiles></ActionMaps>"#;

    fn editable() -> Vec<EditableBinding> {
        collect_editable(&actionmaps::parse_str(DOC).unwrap())
    }

    #[test]
    fn only_movement_categories_are_offered() {
        let names: Vec<_> = editable().iter().map(|b| b.actionmap.clone()).collect();
        assert!(names.iter().all(|n| n != "spaceship_weapons"));
        assert!(names.contains(&"spaceship_movement".to_string()));
        assert!(names.contains(&"player".to_string()));
    }

    #[test]
    fn plain_bindings_are_editable() {
        let list = editable();
        let boost = list.iter().find(|b| b.action == "v_boost").unwrap();
        assert!(!boost.locked);
        assert_eq!(boost.device.as_deref(), Some("js1"));
        assert_eq!(boost.control.as_deref(), Some("button5"));
    }

    #[test]
    fn unassigned_actions_are_offered_for_assignment() {
        // Assigner une action vierge fait partie du périmètre Lite.
        let list = editable();
        let libre = list.iter().find(|b| b.action == "v_libre").unwrap();
        assert!(!libre.locked);
        assert!(libre.control.is_none());
    }

    #[test]
    fn bindings_with_modifiers_are_locked_not_hidden() {
        // Les masquer laisserait croire qu'elles n'existent pas ; les éditer
        // écraserait un réglage invisible dans l'interface simplifiée.
        let list = editable();
        let brake = list.iter().find(|b| b.action == "v_brake").unwrap();
        assert!(brake.locked);
        assert!(brake
            .locked_reason
            .as_ref()
            .unwrap()
            .contains("modificateur"));
    }

    #[test]
    fn bindings_with_activation_modes_are_locked() {
        let list = editable();
        let decoy = list.iter().find(|b| b.action == "v_decoy").unwrap();
        assert!(decoy.locked);
        assert!(decoy
            .locked_reason
            .as_ref()
            .unwrap()
            .contains("mode d'activation"));
    }
}
