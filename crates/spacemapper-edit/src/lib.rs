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

pub use scope::{EditAccess, EditCategory};
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

    /// Le document ne comporte aucun endroit où insérer l'assignation.
    ///
    /// Une action absente est normalement **créée** — surcharger un défaut du
    /// jeu revient précisément à cela. Cette erreur ne subsiste que pour un
    /// document trop malformé pour offrir un point d'insertion.
    #[error(
        "impossible d'écrire « {action} » dans « {actionmap} » : \
         le document ne comporte aucun point d'insertion"
    )]
    NoInsertionPoint { actionmap: String, action: String },

    #[error(
        "« {actionmap} » n'est pas modifiable dans l'édition Lite, \
         qui se limite aux déplacements à pied et en vol"
    )]
    OutOfScope { actionmap: String },

    /// Une opération destructrice visait une cible hors de son périmètre.
    ///
    /// Distincte d'une erreur d'entrée-sortie : rien n'a échoué, on a refusé.
    #[error("{0}")]
    Refused(String),
}

impl Error {
    pub(crate) fn io(path: impl Into<PathBuf>, source: std::io::Error) -> Self {
        Error::Io {
            path: path.into(),
            source,
        }
    }

    pub(crate) fn refused(message: impl Into<String>) -> Self {
        Error::Refused(message.into())
    }
}

/// Applique une modification à un `actionmaps.xml` sur disque.
pub fn apply_to_file(target: &Path, edit: &BindingEdit) -> Result<()> {
    apply_all_to_file(target, std::slice::from_ref(edit))
}

/// Applique un lot de modifications en une seule écriture.
///
/// Le chemin d'écriture est unique et passe obligatoirement par ici : vérifier
/// le périmètre de **chaque** modification, produire le document, le relire,
/// puis écrire. Court-circuiter l'une de ces étapes demanderait de modifier ce
/// fichier, ce qui se voit en revue.
///
/// La vérification de périmètre précède toute production : si une seule
/// modification est hors périmètre, aucune n'est appliquée. Un lot n'est pas
/// une occasion de faire passer en fraude ce qu'on refuse à l'unité.
///
/// Ne crée **aucune** sauvegarde : c'est à l'appelant de proposer
/// [`backup::create`] au moment opportun.
pub fn apply_all_to_file(target: &Path, edits: &[BindingEdit]) -> Result<()> {
    if let Some(refused) = edits
        .iter()
        .find(|e| !scope::is_editable(&e.actionmap, &e.action))
    {
        return Err(Error::OutOfScope {
            actionmap: refused.actionmap.clone(),
        });
    }

    let original = std::fs::read_to_string(target).map_err(|e| Error::io(target, e))?;
    let updated = writer::apply_many(&original, edits)?;

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
    fn a_batch_is_refused_whole_if_one_edit_is_out_of_scope() {
        // Sans cette verification prealable, les modifications legitimes du
        // lot seraient ecrites avant que l'interdite ne soit detectee.
        let (target, _) = fixture("batch-scope");
        let err = apply_all_to_file(
            &target,
            &[
                BindingEdit::set("spaceship_movement", "v_boost", "js1_button9"),
                BindingEdit::set("spaceship_weapons", "v_attack1", "js1_button2"),
            ],
        )
        .unwrap_err();

        assert!(matches!(err, Error::OutOfScope { .. }));
        assert_eq!(std::fs::read_to_string(&target).unwrap(), DOC);
    }

    #[test]
    fn overriding_a_game_default_creates_the_entry() {
        // `actionmaps.xml` ne contient que les surcharges : assigner une
        // commande jusqu'ici laissée par défaut suppose de créer son entrée.
        let (target, _) = fixture("create");
        apply_to_file(
            &target,
            &BindingEdit::set("spaceship_movement", "v_pitch", "js1_y"),
        )
        .unwrap();

        let written = std::fs::read_to_string(&target).unwrap();
        let maps = spacemapper_core::actionmaps::parse_str(&written).unwrap();
        let created = maps
            .rebinds()
            .find(|(_, a, _)| a.name == "v_pitch")
            .expect("action non créée");
        assert_eq!(created.2.input_raw, "js1_y");
    }

    #[test]
    fn a_document_without_insertion_point_is_refused() {
        let (target, _) = fixture("malformed");
        std::fs::write(&target, "<Nope/>").unwrap();

        let err = apply_to_file(
            &target,
            &BindingEdit::set("spaceship_movement", "v_pitch", "js1_y"),
        )
        .unwrap_err();
        assert!(matches!(err, Error::NoInsertionPoint { .. }));
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "<Nope/>");
    }
}
