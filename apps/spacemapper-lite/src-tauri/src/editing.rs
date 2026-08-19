//! Commandes d'édition et de points de restauration.
//!
//! L'édition Lite se limite au pilotage et au déplacement à pied. Cette limite
//! est appliquée par `spacemapper-edit`, en Rust : ces commandes ne font que
//! transmettre, elles ne décident pas du périmètre. Une action hors périmètre
//! est refusée même si le frontend la propose.
//!
//! Les modifications s'accumulent côté interface et ne touchent le disque qu'au
//! moment où l'utilisateur enregistre, via [`save_bindings`]. Le point de
//! restauration est proposé à cet instant précis, plutôt qu'imposé à chaque
//! écriture : c'est le seul moment où l'utilisateur sait ce qu'il s'apprête à
//! changer.

use serde::{Deserialize, Serialize};
use spacemapper_core::actionmaps::{self, ActionMaps};
use spacemapper_core::channel;
use spacemapper_edit::{backup, scope, BindingEdit, EditAccess, EditCategory};
use std::path::{Path, PathBuf};

type CmdResult<T> = Result<T, String>;

/// Une assignation présentée à l'édition.
#[derive(Debug, Serialize)]
pub struct EditableBinding {
    pub actionmap: String,
    pub category: EditCategory,
    /// Niveau d'accès : modifiable, ou verrouillé derrière le Premium.
    pub access: EditAccess,
    pub action: String,
    pub input_raw: String,
    pub device: Option<String>,
    pub control: Option<String>,
    /// L'action ne peut pas être modifiée dans cette édition.
    pub locked: bool,
    /// Motif du verrouillage, à afficher tel quel.
    pub locked_reason: Option<String>,
}

/// Une modification en attente, telle que la transmet l'interface.
#[derive(Debug, Deserialize)]
pub struct PendingEdit {
    pub actionmap: String,
    pub action: String,
    /// `None` efface l'assignation.
    pub input: Option<String>,
}

impl From<&PendingEdit> for BindingEdit {
    fn from(p: &PendingEdit) -> Self {
        BindingEdit {
            actionmap: p.actionmap.clone(),
            action: p.action.clone(),
            input: p.input.clone(),
        }
    }
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

/// Enregistre un lot de modifications en une seule écriture.
///
/// Les modifications s'accumulent côté interface jusqu'à ce que l'utilisateur
/// valide : le fichier du jeu n'est touché qu'ici, et une seule fois. Si
/// `create_restore_point` est vrai, une copie du profil est déposée **avant**
/// l'écriture ; son chemin est renvoyé.
///
/// Un lot invalide est refusé en bloc : mieux vaut ne rien écrire qu'un état
/// intermédiaire que l'utilisateur n'a pas demandé.
#[tauri::command]
pub fn save_bindings(
    path: String,
    edits: Vec<PendingEdit>,
    create_restore_point: bool,
) -> CmdResult<Option<String>> {
    if edits.is_empty() {
        return Ok(None);
    }

    let target = Path::new(&path);
    let converted: Vec<BindingEdit> = edits.iter().map(BindingEdit::from).collect();

    let saved = if create_restore_point {
        let dir = backup_dir()?;
        Some(
            backup::create(target, &dir)
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .into_owned(),
        )
    } else {
        None
    };

    spacemapper_edit::apply_all_to_file(target, &converted).map_err(|e| e.to_string())?;
    Ok(saved)
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
            // Les catégories réservées au Premium sans intérêt de vitrine sont
            // absentes de la liste, pas seulement grisées.
            let access = scope::access_of(&map.name)?;
            if access == EditAccess::PremiumOnly {
                return None;
            }
            let category = scope::category_of(&map.name)?;

            let (device, control, modifier) = match &rebind.input {
                Some(input) => (
                    Some(format!("{}{}", input.device_kind.prefix(), input.instance)),
                    Some(input.control.clone()),
                    input.modifier.clone(),
                ),
                None => (None, None, None),
            };

            // Deux raisons distinctes de verrouiller, et l'ordre compte : une
            // catégorie de vitrine reste verrouillée quel que soit le contenu
            // de l'assignation, et c'est ce motif qu'il faut afficher.
            let locked_reason = if access == EditAccess::PremiumTeaser {
                Some("Catégorie réservée à l'édition Premium".to_string())
            } else if modifier.is_some() {
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
                access,
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
   <action name="v_afterburner"><rebind input="js1_button5"/></action>
   <action name="v_pitch_up"><rebind input="js1_rctrl+button6"/></action>
   <action name="v_roll_left"><rebind input="js1_hat1_down" multiTap="2"/></action>
   <action name="v_strafe_up"><rebind input="js2_ "/></action>
  </actionmap>
  <actionmap name="player">
   <action name="moveforward"><rebind input="kb1_w"/></action>
  </actionmap>
  <actionmap name="vehicle_driver">
   <action name="v_boost"><rebind input="js1_button2"/></action>
  </actionmap>
  <actionmap name="player_emotes">
   <action name="emote_wave"><rebind input="kb1_1"/></action>
  </actionmap>
  <actionmap name="prone">
   <action name="prone_rollleft"><rebind input="kb1_q"/></action>
  </actionmap>
  <actionmap name="spaceship_weapons">
   <action name="v_attack1"><rebind input="js1_button1"/></action>
  </actionmap>
 </ActionProfiles></ActionMaps>"#;

    fn editable() -> Vec<EditableBinding> {
        collect_editable(&actionmaps::parse_str(DOC).unwrap())
    }

    #[test]
    fn out_of_domain_categories_are_absent() {
        let names: Vec<_> = editable().iter().map(|b| b.actionmap.clone()).collect();
        assert!(names.iter().all(|n| n != "spaceship_weapons"));
    }

    #[test]
    fn prone_is_hidden_entirely_from_lite() {
        // Contrairement aux catégories de vitrine, celle-ci ne doit même pas
        // apparaître : elle est reportée à l'édition Premium.
        let names: Vec<_> = editable().iter().map(|b| b.actionmap.clone()).collect();
        assert!(names.iter().all(|n| n != "prone"));
    }

    #[test]
    fn teaser_categories_appear_but_stay_locked() {
        // Elles sont là pour montrer ce que débloque le Premium ; les cacher
        // supprimerait l'incitation, les rendre modifiables la viderait.
        for (actionmap, action) in [
            ("vehicle_driver", "v_boost"),
            ("player_emotes", "emote_wave"),
        ] {
            let list = editable();
            let found = list
                .iter()
                .find(|b| b.action == action)
                .unwrap_or_else(|| panic!("{actionmap} absente de la liste"));

            assert_eq!(found.access, EditAccess::PremiumTeaser);
            assert!(found.locked, "{actionmap} devrait être verrouillée");
            assert!(found.locked_reason.as_ref().unwrap().contains("Premium"));
        }
    }

    #[test]
    fn plain_bindings_are_editable() {
        let list = editable();
        let boost = list.iter().find(|b| b.action == "v_afterburner").unwrap();
        assert_eq!(boost.access, EditAccess::Lite);
        assert!(!boost.locked);
        assert_eq!(boost.device.as_deref(), Some("js1"));
        assert_eq!(boost.control.as_deref(), Some("button5"));
    }

    #[test]
    fn unassigned_actions_are_offered_for_assignment() {
        // Assigner une action vierge fait partie du périmètre Lite.
        let list = editable();
        let libre = list.iter().find(|b| b.action == "v_strafe_up").unwrap();
        assert!(!libre.locked);
        assert!(libre.control.is_none());
    }

    #[test]
    fn bindings_with_modifiers_are_locked_not_hidden() {
        // Les masquer laisserait croire qu'elles n'existent pas ; les éditer
        // écraserait un réglage invisible dans l'interface simplifiée.
        let list = editable();
        let pitch = list.iter().find(|b| b.action == "v_pitch_up").unwrap();
        assert!(pitch.locked);
        assert!(pitch
            .locked_reason
            .as_ref()
            .unwrap()
            .contains("modificateur"));
    }

    #[test]
    fn bindings_with_activation_modes_are_locked() {
        let list = editable();
        let roll = list.iter().find(|b| b.action == "v_roll_left").unwrap();
        assert!(roll.locked);
        assert!(roll
            .locked_reason
            .as_ref()
            .unwrap()
            .contains("mode d'activation"));
    }
}
