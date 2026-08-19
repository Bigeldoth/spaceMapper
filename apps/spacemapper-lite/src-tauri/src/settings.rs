//! Préférences de l'utilisateur.
//!
//! Conservées dans le dossier de données de l'application, isolé par canal :
//! une build de pré-release ne doit pas modifier les réglages de la version
//! installée.

use serde::{Deserialize, Serialize};
use spacemapper_core::{channel, locale, localization};
use std::path::PathBuf;

const FILE: &str = "settings.json";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    /// Langue des libellés issus du jeu, sous son nom d'archive.
    pub game_language: String,
    /// Langue de l'interface de SpaceMapper : `fr` ou `en`.
    ///
    /// Distincte de la précédente : un joueur peut vouloir l'application en
    /// français tout en gardant les noms de commandes en anglais, qui sont
    /// ceux qu'échange la communauté.
    pub ui_language: String,
    /// Numéro de version du fichier, pour migrer sans casse.
    pub version: u32,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            game_language: localization::FRENCH.to_string(),
            ui_language: "fr".to_string(),
            version: 1,
        }
    }
}

impl Settings {
    /// Réglages du tout premier lancement, calqués sur la langue du système.
    ///
    /// C'est ce qui remplace un écran de choix à l'installation : l'utilisateur
    /// trouve l'application dans sa langue sans avoir rien à régler, et le
    /// menu Réglages reste là pour en changer.
    ///
    /// Volontairement distinct de [`Default`], qui doit rester déterministe :
    /// des tests qui dépendraient de la locale de la machine seraient une
    /// source de faux échecs.
    pub fn from_system() -> Self {
        Self::for_locale(locale::system_locale().as_deref())
    }

    fn for_locale(tag: Option<&str>) -> Self {
        let ui = locale::ui_language_for(tag);
        Settings {
            // Les libellés du jeu suivent le même choix : afficher une
            // interface anglaise avec des commandes françaises serait un
            // réglage délibéré, pas un point de départ.
            game_language: match ui {
                "fr" => localization::FRENCH,
                _ => localization::ENGLISH,
            }
            .to_string(),
            ui_language: ui.to_string(),
            version: 1,
        }
    }
}

fn path() -> Option<PathBuf> {
    channel::data_dir().map(|dir| dir.join(FILE))
}

/// Lit les préférences, en retombant sur la langue du système.
///
/// Un fichier illisible n'est pas une erreur bloquante : mieux vaut démarrer
/// avec des réglages déduits du système que refuser de s'ouvrir.
pub fn load() -> Settings {
    let Some(path) = path() else {
        return Settings::from_system();
    };
    std::fs::read_to_string(path)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_else(Settings::from_system)
}

pub fn save(settings: &Settings) -> Result<(), String> {
    let path = path().ok_or_else(|| "APPDATA introuvable".to_string())?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    std::fs::write(&path, text).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_french() {
        let settings = Settings::default();
        assert_eq!(settings.game_language, localization::FRENCH);
        assert_eq!(settings.ui_language, "fr");
    }

    #[test]
    fn the_first_launch_follows_the_system_language() {
        let french = Settings::for_locale(Some("fr-FR"));
        assert_eq!(french.ui_language, "fr");
        assert_eq!(french.game_language, localization::FRENCH);

        // Tout ce qui n'est pas français démarre en anglais : c'est la langue
        // d'échange de la communauté Star Citizen.
        let german = Settings::for_locale(Some("de-DE"));
        assert_eq!(german.ui_language, "en");
        assert_eq!(german.game_language, localization::ENGLISH);

        assert_eq!(Settings::for_locale(None).ui_language, "en");
    }

    #[test]
    fn a_partial_file_keeps_the_other_defaults() {
        // `serde(default)` protège d'un fichier écrit par une version
        // antérieure, qui ignorait certains champs.
        let settings: Settings = serde_json::from_str(r#"{"ui_language":"en"}"#).unwrap();
        assert_eq!(settings.ui_language, "en");
        assert_eq!(settings.game_language, localization::FRENCH);
    }
}
