//! Points de restauration.
//!
//! Les sauvegardes sont **explicites** : l'utilisateur crée un point de
//! restauration quand il le décide. Modifier une assignation n'en déclenche
//! aucune.
//!
//! Elles restent du **XML en clair**, délibérément. Le `actionmaps.xml` du jeu
//! est lui-même en clair et copiable depuis l'Explorateur : chiffrer les
//! sauvegardes n'empêcherait aucun partage de configuration, mais rendrait les
//! données du joueur illisibles s'il désinstalle SpaceMapper. Ce que
//! l'édition Premium vend, ce n'est pas la possession du fichier — c'est ce
//! qu'on en fait : profils nommés, synchronisation, adaptation d'un preset à
//! un autre matériel.
//!
//! Aucune fonction de ce module n'est appelée automatiquement : ni écrire une
//! assignation, ni restaurer un profil ne dépose de copie à l'insu de
//! l'utilisateur.

use crate::{Error, Result};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Nombre de sauvegardes conservées par fichier d'origine.
///
/// Assez pour revenir en arrière après plusieurs essais successifs, assez peu
/// pour ne pas accumuler indéfiniment : chaque copie pèse quelques dizaines
/// de kilo-octets.
pub const RETAINED: usize = 20;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BackupEntry {
    pub path: PathBuf,
    /// Millisecondes depuis l'époque Unix, extraites du nom de fichier.
    pub timestamp: u128,
}

/// Copie `source` dans `backup_dir` sous un nom horodaté.
///
/// Renvoie le chemin de la sauvegarde créée.
pub fn create(source: &Path, backup_dir: &Path) -> Result<PathBuf> {
    std::fs::create_dir_all(backup_dir).map_err(|e| Error::io(backup_dir, e))?;

    // Horodatage en millisecondes, et non en secondes : un utilisateur qui
    // enchaîne deux réassignations rapides produirait sinon deux fois le même
    // nom, et la seconde sauvegarde écraserait la première — exactement ce
    // que ce module existe pour empêcher.
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    let stem = source
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("actionmaps");

    // Deux écritures dans la même milliseconde restent possibles ; on suffixe
    // plutôt que d'écraser.
    let mut dest = backup_dir.join(format!("{stem}.{stamp}.xml"));
    let mut collision = 1;
    while dest.exists() {
        dest = backup_dir.join(format!("{stem}.{stamp}-{collision}.xml"));
        collision += 1;
    }

    std::fs::copy(source, &dest).map_err(|e| Error::io(&dest, e))?;
    prune(backup_dir, stem)?;
    Ok(dest)
}

/// Sauvegardes disponibles, de la plus récente à la plus ancienne.
pub fn list(backup_dir: &Path) -> Result<Vec<BackupEntry>> {
    let entries = match std::fs::read_dir(backup_dir) {
        Ok(e) => e,
        // Pas encore de dossier : aucune sauvegarde, ce n'est pas une erreur.
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(Error::io(backup_dir, e)),
    };

    let mut found: Vec<BackupEntry> = entries
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let path = e.path();
            Some(BackupEntry {
                timestamp: parse_timestamp(&path)?,
                path,
            })
        })
        .collect();

    // Du plus récent au plus ancien. Le nom départage les collisions, pour
    // que l'ordre soit reproductible plutôt que dépendant du système de
    // fichiers.
    found.sort_by(|a, b| {
        b.timestamp
            .cmp(&a.timestamp)
            .then_with(|| b.path.file_name().cmp(&a.path.file_name()))
    });
    Ok(found)
}

/// Restaure une sauvegarde par-dessus `target`.
///
/// Ne crée aucune copie de l'état écrasé. Une version précédente le faisait,
/// mais cela produisait un point de restauration à chaque retour en arrière,
/// alors que l'état écrasé venait presque toujours d'être capturé par la case
/// « créer un point de restauration » au moment de l'enregistrement. La liste
/// se remplissait de doublons sans valeur.
pub fn restore(backup: &Path, target: &Path) -> Result<()> {
    std::fs::copy(backup, target).map_err(|e| Error::io(target, e))?;
    Ok(())
}

/// Extrait l'horodatage de `actionmaps.1755540000123.xml`, ou de sa variante
/// suffixée `actionmaps.1755540000123-1.xml` en cas de collision.
fn parse_timestamp(path: &Path) -> Option<u128> {
    let name = path.file_name()?.to_str()?;
    let rest = name.strip_suffix(".xml")?;
    let last = rest.rsplit_once('.')?.1;
    // Le suffixe de collision ne fait pas partie de l'horodatage.
    let digits = last.split_once('-').map_or(last, |(head, _)| head);
    digits.parse().ok()
}

/// Supprime les sauvegardes excédentaires du même fichier d'origine.
fn prune(backup_dir: &Path, stem: &str) -> Result<()> {
    let prefix = format!("{stem}.");
    let mut mine: Vec<_> = list(backup_dir)?
        .into_iter()
        .filter(|e| {
            e.path
                .file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with(&prefix))
        })
        .collect();

    if mine.len() <= RETAINED {
        return Ok(());
    }

    // `list` trie du plus récent au plus ancien : on coupe la queue.
    for old in mine.split_off(RETAINED) {
        // Un échec de purge ne doit pas faire échouer une sauvegarde réussie.
        let _ = std::fs::remove_file(&old.path);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("spacemapper-test-{name}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn create_copies_content_and_is_listed() {
        let dir = temp_dir("backup-create");
        let source = dir.join("actionmaps.xml");
        std::fs::write(&source, "<ActionMaps/>").unwrap();
        let backups = dir.join("Backups");

        let made = create(&source, &backups).unwrap();
        assert_eq!(std::fs::read_to_string(&made).unwrap(), "<ActionMaps/>");

        let listed = list(&backups).unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].path, made);
    }

    #[test]
    fn list_on_missing_directory_is_empty_not_an_error() {
        let dir = temp_dir("backup-missing");
        assert!(list(&dir.join("jamais-cree")).unwrap().is_empty());
    }

    #[test]
    fn restore_puts_content_back() {
        let dir = temp_dir("backup-restore");
        let target = dir.join("actionmaps.xml");
        let backups = dir.join("Backups");

        std::fs::write(&target, "<original/>").unwrap();
        let saved = create(&target, &backups).unwrap();
        std::fs::write(&target, "<modifie/>").unwrap();

        restore(&saved, &target).unwrap();
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "<original/>");
    }

    #[test]
    fn restore_adds_no_backup_of_its_own() {
        // Restaurer ne doit pas gonfler la liste : l'état écrasé a presque
        // toujours déjà été capturé au moment de l'enregistrement.
        let dir = temp_dir("backup-restore-clean");
        let target = dir.join("actionmaps.xml");
        let backups = dir.join("Backups");

        std::fs::write(&target, "<original/>").unwrap();
        let saved = create(&target, &backups).unwrap();
        std::fs::write(&target, "<modifie/>").unwrap();

        restore(&saved, &target).unwrap();
        assert_eq!(list(&backups).unwrap().len(), 1);
    }

    #[test]
    fn rapid_successive_backups_never_overwrite_each_other() {
        // Le défaut que ce module doit absolument éviter : deux modifications
        // rapprochées produisaient le même nom, et la seconde sauvegarde
        // effaçait la première. L'utilisateur croyait avoir un filet.
        let dir = temp_dir("backup-collision");
        let source = dir.join("actionmaps.xml");
        let backups = dir.join("Backups");

        for i in 0..5 {
            std::fs::write(&source, format!("<version n=\"{i}\"/>")).unwrap();
            create(&source, &backups).unwrap();
        }

        let listed = list(&backups).unwrap();
        assert_eq!(listed.len(), 5, "des sauvegardes ont été écrasées");

        // Les cinq états doivent être récupérables, pas seulement le dernier.
        let contents: Vec<_> = listed
            .iter()
            .map(|e| std::fs::read_to_string(&e.path).unwrap())
            .collect();
        for i in 0..5 {
            assert!(
                contents.contains(&format!("<version n=\"{i}\"/>")),
                "état {i} perdu"
            );
        }
    }

    #[test]
    fn retention_caps_the_number_of_backups() {
        let dir = temp_dir("backup-prune");
        let source = dir.join("actionmaps.xml");
        let backups = dir.join("Backups");

        for i in 0..(RETAINED + 5) {
            std::fs::write(&source, format!("<n>{i}</n>")).unwrap();
            create(&source, &backups).unwrap();
        }

        assert_eq!(list(&backups).unwrap().len(), RETAINED);
    }

    #[test]
    fn timestamp_parsing_ignores_foreign_files() {
        assert_eq!(
            parse_timestamp(Path::new("actionmaps.1755540000123.xml")),
            Some(1_755_540_000_123)
        );
        // Variante suffixée en cas de collision dans la même milliseconde.
        assert_eq!(
            parse_timestamp(Path::new("actionmaps.1755540000123-2.xml")),
            Some(1_755_540_000_123)
        );
        assert!(parse_timestamp(Path::new("notes.txt")).is_none());
        assert!(parse_timestamp(Path::new("actionmaps.xml")).is_none());
    }
}
