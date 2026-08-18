//! Écriture sûre dans `actionmaps.xml`.
//!
//! Ce crate est le seul endroit du dépôt public qui modifie un fichier de jeu.
//! Trois garanties encadrent cette écriture, appliquées en Rust et non dans
//! l'interface :
//!
//! 1. **Périmètre restreint** — seules les catégories de déplacement (au sol et
//!    en vol) sont modifiables. Voir [`scope`].
//! 2. **Modification chirurgicale** — un seul attribut est réécrit ; le reste
//!    du document est recopié à l'octet près. Voir [`writer`].
//! 3. **Validation avant pose** — le document produit est reparsé, et refusé
//!    s'il est illisible.
//!
//! La **sauvegarde est explicite** : elle relève d'une action de l'utilisateur
//! via [`backup::create`], et non d'un automatisme déclenché à chaque écriture.
//! C'est un choix produit assumé — moins de fichiers accumulés, l'utilisateur
//! maîtrise ses points de restauration — dont la contrepartie est qu'une
//! modification n'est pas annulable si aucune sauvegarde n'a été prise. Il
//! revient à l'interface d'y rendre l'utilisateur attentif.
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
/// le périmètre, produire le document, le relire, puis écrire. Court-circuiter
/// l'une de ces étapes demanderait de modifier ce fichier, ce qui se voit en
/// revue.
///
/// Ne crée **aucune** sauvegarde : c'est à l'appelant de proposer
/// [`backup::create`] au moment opportun.
pub fn apply_to_file(target: &Path, edit: &BindingEdit) -> Result<()> {
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

    std::fs::write(target, updated).map_err(|e| Error::io(target, e))
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
    fn writes_the_change() {
        let (target, _) = fixture("apply");
        apply_to_file(
            &target,
            &BindingEdit::set("spaceship_movement", "v_boost", "js1_button9"),
        )
        .unwrap();

        assert!(std::fs::read_to_string(&target)
            .unwrap()
            .contains("js1_button9"));
    }

    #[test]
    fn writing_creates_no_backup_of_its_own() {
        // La sauvegarde est un geste explicite de l'utilisateur. Écrire ne
        // doit rien déposer dans le dossier de sauvegardes.
        let (target, backups) = fixture("no-implicit-backup");
        apply_to_file(
            &target,
            &BindingEdit::set("spaceship_movement", "v_boost", "js1_button9"),
        )
        .unwrap();

        assert!(backup::list(&backups).unwrap().is_empty());
    }

    #[test]
    fn refuses_categories_outside_the_lite_scope() {
        let (target, _) = fixture("scope");
        let err = apply_to_file(
            &target,
            &BindingEdit::set("spaceship_weapons", "v_attack1", "js1_button9"),
        )
        .unwrap_err();

        assert!(matches!(err, Error::OutOfScope { .. }));
        assert_eq!(std::fs::read_to_string(&target).unwrap(), DOC);
    }

    #[test]
    fn a_failed_edit_leaves_the_file_untouched() {
        let (target, _) = fixture("notfound");
        let err = apply_to_file(
            &target,
            &BindingEdit::set("spaceship_movement", "v_inexistante", "js1_x"),
        )
        .unwrap_err();

        assert!(matches!(err, Error::ActionNotFound { .. }));
        assert_eq!(std::fs::read_to_string(&target).unwrap(), DOC);
    }
}
