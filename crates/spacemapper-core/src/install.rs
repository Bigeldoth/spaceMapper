//! Localisation de l'installation de Star Citizen et de son `actionmaps.xml`.
//!
//! Le chemin utilisé ici a été **vérifié sur une installation réelle** :
//!
//! ```text
//! C:\Program Files\Roberts Space Industries\StarCitizen\LIVE\user\client\0\Profiles\default\actionmaps.xml
//! ```
//!
//! Il ne suit ni la documentation officielle ni les chemins qui circulent dans
//! la communauté (`USER\Controls\Mappings`, qui ne contient que les profils
//! *exportés*). On sonde donc plusieurs candidats plutôt que d'en coder un
//! seul en dur, et l'appelant doit toujours proposer une sélection manuelle en
//! dernier recours : le joueur peut avoir installé le jeu n'importe où.

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

/// Canaux connus, utilisés uniquement pour l'ordre d'affichage.
///
/// La découverte n'est volontairement pas limitée à cette liste : le launcher
/// peut ajouter un canal et les joueurs renomment parfois `LIVE` en `HOTFIX`.
pub const CHANNELS: [&str; 5] = ["LIVE", "HOTFIX", "PTU", "EPTU", "TECH-PREVIEW"];

/// Emplacements d'installation habituels, relatifs à une racine de lecteur.
/// Chaque entrée est une suite de segments, jointe proprement à l'usage.
const INSTALL_SUFFIXES: [&[&str]; 2] = [
    &["Program Files", "Roberts Space Industries"],
    &["Roberts Space Industries"],
];

/// Un `actionmaps.xml` découvert sur le disque.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiscoveredProfile {
    /// Canal auquel il appartient (`LIVE`, `PTU`, …).
    pub channel: String,
    pub path: PathBuf,
}

/// Chemin du `actionmaps.xml` pour une racine de jeu et un canal donnés.
///
/// Les segments sont joints un par un plutôt qu'en une chaîne à barres
/// obliques : le chemin est affiché à l'utilisateur, et un mélange de `\` et
/// `/` donne une impression de bricolage.
///
/// La casse minuscule de `user/client/0` reproduit ce que le client écrit ;
/// Windows s'en moque, mais un futur portage Linux/Proton non.
pub fn actionmaps_path(game_root: &Path, channel: &str) -> PathBuf {
    game_root
        .join(channel)
        .join("user")
        .join("client")
        .join("0")
        .join("Profiles")
        .join("default")
        .join("actionmaps.xml")
}

/// Cherche les `actionmaps.xml` présents sur la machine.
///
/// Ne renvoie que des fichiers existants. Une liste vide n'est pas une erreur :
/// elle signifie qu'il faut demander le chemin à l'utilisateur.
pub fn discover(candidate_roots: &[PathBuf]) -> Vec<DiscoveredProfile> {
    let mut found = Vec::new();
    let mut seen = HashSet::new();
    for root in candidate_roots {
        let star_citizen = root.join("StarCitizen");
        let Ok(entries) = fs::read_dir(&star_citizen) else {
            continue;
        };
        for entry in entries.flatten() {
            let channel_root = entry.path();
            if !channel_root.is_dir() {
                continue;
            }
            let channel = entry.file_name().to_string_lossy().into_owned();
            let path = actionmaps_path(&star_citizen, &channel);
            if path.is_file() {
                let identity = fs::canonicalize(&path).unwrap_or_else(|_| path.clone());
                if !seen.insert(identity) {
                    continue;
                }
                found.push(DiscoveredProfile {
                    channel,
                    path,
                });
            }
        }
    }
    found.sort_by(|left, right| {
        channel_priority(&left.channel)
            .cmp(&channel_priority(&right.channel))
            .then_with(|| {
                left.channel
                    .to_ascii_lowercase()
                    .cmp(&right.channel.to_ascii_lowercase())
            })
            .then_with(|| left.path.cmp(&right.path))
    });
    found
}

fn channel_priority(channel: &str) -> usize {
    CHANNELS
        .iter()
        .position(|candidate| candidate.eq_ignore_ascii_case(channel))
        .unwrap_or(CHANNELS.len())
}

/// Racines d'installation plausibles sur cette machine.
#[cfg(windows)]
pub fn default_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    // Les joueurs déplacent souvent le jeu sur un SSD secondaire, d'où le
    // balayage des lettres de lecteur plutôt que le seul disque système.
    for letter in 'C'..='Z' {
        let drive = PathBuf::from(format!("{letter}:\\"));
        if !drive.is_dir() {
            continue;
        }
        for suffix in INSTALL_SUFFIXES {
            let candidate = suffix
                .iter()
                .fold(drive.clone(), |path, seg| path.join(seg));
            if candidate.is_dir() {
                roots.push(candidate);
            }
        }
    }
    roots
}

#[cfg(not(windows))]
pub fn default_roots() -> Vec<PathBuf> {
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temporary_install_root(test_name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("horloge système antérieure à 1970")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "spacemapper-install-{test_name}-{}-{nonce}",
            std::process::id()
        ))
    }

    fn create_profile(root: &Path, channel: &str) -> PathBuf {
        let star_citizen = root.join("StarCitizen");
        let path = actionmaps_path(&star_citizen, channel);
        fs::create_dir_all(path.parent().expect("profil sans dossier parent"))
            .expect("création de la fixture");
        fs::write(&path, "<ActionMaps />").expect("écriture de la fixture");
        path
    }

    #[test]
    fn actionmaps_path_matches_verified_layout() {
        let root = Path::new(r"C:\Program Files\Roberts Space Industries\StarCitizen");
        let path = actionmaps_path(root, "LIVE");
        let rendered = path.to_string_lossy().replace('\\', "/");
        assert!(
            rendered.ends_with("StarCitizen/LIVE/user/client/0/Profiles/default/actionmaps.xml"),
            "chemin inattendu: {rendered}"
        );
    }

    #[test]
    fn discover_returns_nothing_for_missing_roots() {
        let roots = vec![PathBuf::from("/chemin/qui/nexiste/pas")];
        assert!(discover(&roots).is_empty());
    }

    #[test]
    fn discover_accepts_hotfix_and_unknown_channel_directories() {
        let root = temporary_install_root("all-channels");
        create_profile(&root, "CUSTOM-4.2");
        create_profile(&root, "PTU");
        create_profile(&root, "HOTFIX");
        fs::create_dir_all(root.join("StarCitizen").join("INCOMPLETE"))
            .expect("création du canal incomplet");
        fs::write(root.join("StarCitizen").join("README.txt"), "pas un canal")
            .expect("création du fichier parasite");
        create_profile(
            &root.join("StarCitizen").join("ARCHIVE"),
            "NESTED-CHANNEL",
        );

        let profiles = discover(std::slice::from_ref(&root));
        let channels: Vec<&str> = profiles
            .iter()
            .map(|profile| profile.channel.as_str())
            .collect();

        assert_eq!(channels, vec!["HOTFIX", "PTU", "CUSTOM-4.2"]);
        assert!(profiles.iter().all(|profile| profile.path.is_file()));

        fs::remove_dir_all(root).expect("suppression de la fixture");
    }

    #[test]
    fn discover_deduplicates_the_same_installation_root() {
        let root = temporary_install_root("duplicate");
        let expected = create_profile(&root, "HOTFIX");

        let profiles = discover(&[root.clone(), root.clone()]);

        assert_eq!(profiles.len(), 1);
        assert_eq!(profiles[0].path, expected);

        fs::remove_dir_all(root).expect("suppression de la fixture");
    }
}
