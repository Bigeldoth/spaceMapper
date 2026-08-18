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

use std::path::{Path, PathBuf};

/// Canaux de publication du jeu, du plus courant au plus rare.
pub const CHANNELS: [&str; 4] = ["LIVE", "PTU", "EPTU", "TECH-PREVIEW"];

/// Emplacements d'installation habituels, relatifs à une racine de lecteur.
const INSTALL_SUFFIXES: [&str; 2] = [
    "Program Files/Roberts Space Industries",
    "Roberts Space Industries",
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
/// La casse minuscule de `user/client/0` reproduit ce que le client écrit ;
/// Windows s'en moque, mais un futur portage Linux/Proton non.
pub fn actionmaps_path(game_root: &Path, channel: &str) -> PathBuf {
    game_root
        .join(channel)
        .join("user/client/0/Profiles/default/actionmaps.xml")
}

/// Cherche les `actionmaps.xml` présents sur la machine.
///
/// Ne renvoie que des fichiers existants. Une liste vide n'est pas une erreur :
/// elle signifie qu'il faut demander le chemin à l'utilisateur.
pub fn discover(candidate_roots: &[PathBuf]) -> Vec<DiscoveredProfile> {
    let mut found = Vec::new();
    for root in candidate_roots {
        let star_citizen = root.join("StarCitizen");
        for channel in CHANNELS {
            let path = actionmaps_path(&star_citizen, channel);
            if path.is_file() {
                found.push(DiscoveredProfile {
                    channel: channel.to_string(),
                    path,
                });
            }
        }
    }
    found
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
            let candidate = drive.join(suffix);
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
}
