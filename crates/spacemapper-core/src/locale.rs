//! Langue du système, pour choisir celle de l'interface au premier lancement.
//!
//! Ce choix n'est fait **qu'une fois** : dès que l'utilisateur enregistre ses
//! réglages, c'est son fichier qui décide. Deviner à chaque démarrage
//! écraserait un choix délibéré — un joueur français qui met l'application en
//! anglais a une bonne raison de le faire.

/// Langue de l'interface retenue à partir de l'étiquette de locale système.
///
/// Séparée de l'appel Win32 pour rester testable : c'est la règle de décision
/// qui mérite des tests, pas l'appel système.
///
/// L'anglais est le repli. La communauté Star Citizen est très majoritairement
/// anglophone ; servir du français à un joueur allemand ou espagnol serait
/// moins utile que de l'anglais.
pub fn ui_language_for(locale: Option<&str>) -> &'static str {
    // On compare la sous-étiquette de langue entière, pas un préfixe : `frr`
    // (frison septentrional) commence par « fr » sans être du français.
    let primary = locale
        .and_then(|tag| tag.split(['-', '_']).next())
        .map(str::to_ascii_lowercase);

    match primary.as_deref() {
        // Toutes les variantes régionales comptent : `fr-FR`, `fr-BE`, `fr-CA`.
        Some("fr") => "fr",
        _ => "en",
    }
}

/// Étiquette BCP-47 de la locale utilisateur, ex. `fr-FR`.
#[cfg(windows)]
pub fn system_locale() -> Option<String> {
    use windows::Win32::Globalization::GetUserDefaultLocaleName;

    // `LOCALE_NAME_MAX_LENGTH`, non exporté comme constante par le crate.
    const MAX: usize = 85;
    let mut buffer = [0u16; MAX];

    // SAFETY : l'API écrit au plus `buffer.len()` unités dans un tampon que
    // nous possédons, et renvoie le nombre écrit.
    let written = unsafe { GetUserDefaultLocaleName(&mut buffer) };
    if written <= 0 {
        return None;
    }

    // Le compte inclut le zéro terminal.
    let end = (written as usize).saturating_sub(1).min(MAX);
    Some(String::from_utf16_lossy(&buffer[..end]))
}

#[cfg(not(windows))]
pub fn system_locale() -> Option<String> {
    std::env::var("LANG").ok().map(|v| v.replace('_', "-"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn french_variants_all_select_french() {
        for tag in ["fr-FR", "fr-BE", "fr-CA", "fr", "FR-fr"] {
            assert_eq!(ui_language_for(Some(tag)), "fr", "{tag}");
        }
    }

    #[test]
    fn anything_else_falls_back_to_english() {
        for tag in ["en-US", "de-DE", "es-ES", "ja-JP", ""] {
            assert_eq!(ui_language_for(Some(tag)), "en", "{tag}");
        }
        assert_eq!(ui_language_for(None), "en");
    }

    #[test]
    fn a_language_merely_starting_with_fr_is_not_french() {
        // `frr` est le frison septentrional, parlé en Allemagne.
        assert_eq!(ui_language_for(Some("frr-DE")), "en");
        assert_eq!(ui_language_for(Some("fry-NL")), "en");
    }

    #[test]
    fn the_unix_underscore_form_is_understood() {
        // `LANG=fr_FR.UTF-8` sur les systèmes POSIX.
        assert_eq!(ui_language_for(Some("fr_FR.UTF-8")), "fr");
    }
}
