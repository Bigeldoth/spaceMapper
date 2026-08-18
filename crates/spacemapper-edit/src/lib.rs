//! Écriture sûre dans `actionmaps.xml`.
//!
//! Ce crate est le seul endroit du dépôt public qui modifie un fichier de jeu.
//! Il impose deux garde-fous, appliqués en Rust et non dans l'interface :
//!
//! 1. **Périmètre restreint** — seules les catégories de déplacement (au sol et
//!    en vol) sont modifiables. Voir [`scope`].
//! 2. **Sauvegarde obligatoire** — une copie horodatée est écrite avant toute
//!    modification ; si elle échoue, la modification n'a pas lieu.
//!
//! Le crate [`spacemapper_core`] reste, lui, strictement en lecture.

pub mod backup;
pub mod scope;
pub mod writer;

pub use scope::EditCategory;
pub use writer::BindingEdit;

use std::path::{Path, PathBuf};

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("accès impossible à {path}: {source}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },

    #[error("XML illisible: {0}")]
    Xml(String),

    #[error("action « {action} » introuvable dans « {actionmap} »")]
    ActionNotFound { actionmap: String, action: String },

    #[error(
        "« {actionmap} » n'est pas modifiable dans l'édition Lite, \
         qui se limite aux déplacements à pied et en vol"
    )]
    OutOfScope { actionmap: String },
}

impl Error {
    pub(crate) fn io(path: impl Into<PathBuf>, source: std::io::Error) -> Self {
        Error::Io {
            path: path.into(),
            source,
        }
    }
}

/// Applique une modification à un `actionmaps.xml` sur disque.
///
/// Le chemin d'écriture est unique et passe obligatoirement par ici : vérifier
/// le périmètre, sauvegarder, valider le résultat, puis écrire. Court-circuiter
/// l'une de ces étapes demanderait de modifier ce fichier, ce qui se voit en
/// revue.
///
/// Renvoie le chemin de la sauvegarde créée.
pub fn apply_to_file(target: &Path, backup_dir: &Path, edit: &BindingEdit) -> Result<PathBuf> {
    if !scope::is_editable(&edit.actionmap) {
        return Err(Error::OutOfScope {
            actionmap: edit.actionmap.clone(),
        });
    }

    let original = std::fs::read_to_string(target).map_err(|e| Error::io(target, e))?;
    let updated = writer::apply(&original, edit)?;

    // Relire le résultat avant de le poser : un fichier que notre propre
    // parseur refuse n'a rien à faire dans le dossier du jeu.
    spacemapper_core::actionmaps::parse_str(&updated)
        .map_err(|e| Error::Xml(format!("le document produit est invalide: {e}")))?;

    // La sauvegarde d'abord. Si elle échoue, on n'écrit rien.
    let saved = backup::create(target, backup_dir)?;
    std::fs::write(target, updated).map_err(|e| Error::io(target, e))?;
    Ok(saved)
}

#[cfg(test)]
mod tests {
    use super::*;

    const DOC: &str = r#"<ActionMaps>
 <ActionProfiles profileName="default">
  <actionmap name="spaceship_movement">
   <action name="v_boost"><rebind input="js1_button5"/></action>
  </actionmap>
  <actionmap name="spaceship_weapons">
   <action name="v_attack1"><rebind input="js1_button1"/></action>
  </actionmap>
 </ActionProfiles>
</ActionMaps>"#;

    fn fixture(name: &str) -> (PathBuf, PathBuf) {
        let dir = std::env::temp_dir().join(format!("spacemapper-edit-{name}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let target = dir.join("actionmaps.xml");
        std::fs::write(&target, DOC).unwrap();
        (target, dir.join("Backups"))
    }

    #[test]
    fn writes_the_change_and_leaves_a_backup() {
        let (target, backups) = fixture("apply");
        let saved = apply_to_file(
            &target,
            &backups,
            &BindingEdit::set("spaceship_movement", "v_boost", "js1_button9"),
        )
        .unwrap();

        assert!(std::fs::read_to_string(&target)
            .unwrap()
            .contains("js1_button9"));
        // La sauvegarde porte l'état d'avant, pas d'après.
        assert!(std::fs::read_to_string(&saved)
            .unwrap()
            .contains("js1_button5"));
    }

    #[test]
    fn refuses_categories_outside_the_lite_scope() {
        let (target, backups) = fixture("scope");
        let err = apply_to_file(
            &target,
            &backups,
            &BindingEdit::set("spaceship_weapons", "v_attack1", "js1_button9"),
        )
        .unwrap_err();

        assert!(matches!(err, Error::OutOfScope { .. }));
        // Refus total : ni écriture, ni sauvegarde parasite.
        assert_eq!(std::fs::read_to_string(&target).unwrap(), DOC);
        assert!(backup::list(&backups).unwrap().is_empty());
    }

    #[test]
    fn a_failed_edit_leaves_the_file_untouched() {
        let (target, backups) = fixture("notfound");
        let err = apply_to_file(
            &target,
            &backups,
            &BindingEdit::set("spaceship_movement", "v_inexistante", "js1_x"),
        )
        .unwrap_err();

        assert!(matches!(err, Error::ActionNotFound { .. }));
        assert_eq!(std::fs::read_to_string(&target).unwrap(), DOC);
    }
}
