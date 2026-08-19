//! Résolution des clés de localisation du jeu.
//!
//! Le profil par défaut désigne ses libellés par des clés — `@ui_CIPitch`,
//! `@ui_CIPitchDesc` — qui se résolvent dans `Data/Localization/<langue>/
//! global.ini`. Le jeu fournit donc son propre vocabulaire, complet et traduit,
//! là où un catalogue tenu à la main plafonne à quelques centaines d'entrées
//! et vieillit à chaque patch.
//!
//! Le fichier français pèse 2,6 Mo pour des dizaines de milliers de clés, dont
//! une infime part concerne les contrôles. On ne retient donc que les clés
//! utiles, l'application visant moins de 80 Mo de mémoire.

use std::collections::HashMap;

/// Langues disponibles, du nom de dossier employé dans l'archive.
///
/// L'anglais sert de repli : c'est la seule traduction toujours complète.
pub const FRENCH: &str = "french_(france)";
pub const ENGLISH: &str = "english";

/// Chemin du catalogue pour une langue donnée.
pub fn catalog_path(language: &str) -> String {
    format!(r"Data\Localization\{language}\global.ini")
}

/// Extrait le nom de langue d'un chemin de catalogue.
///
/// `Data\Localization\french_(france)\global.ini` → `french_(france)`.
pub fn language_of(path: &str) -> Option<&str> {
    let normalised = path.trim_end_matches(|c| c != '\\' && c != '/');
    let trimmed = normalised.trim_end_matches(['\\', '/']);
    let name = trimmed.rsplit(['\\', '/']).next()?;
    (!name.is_empty() && !name.eq_ignore_ascii_case("Localization")).then_some(name)
}

/// Un nom de langue rendu lisible.
///
/// L'archive emploie des identifiants techniques ; les afficher tels quels
/// obligerait l'utilisateur à traduire `spanish_(latin_america)` de tête.
pub fn display_name(language: &str) -> String {
    const KNOWN: &[(&str, &str)] = &[
        ("english", "Anglais"),
        ("french_(france)", "Français"),
        ("german_(germany)", "Allemand"),
        ("italian_(italy)", "Italien"),
        ("spanish_(spain)", "Espagnol (Espagne)"),
        ("spanish_(latin_america)", "Espagnol (Amérique latine)"),
        ("portuguese_(brazil)", "Portugais (Brésil)"),
        ("polish_(poland)", "Polonais"),
        ("japanese_(japan)", "Japonais"),
        ("korean_(south_korea)", "Coréen"),
        ("chinese_(simplified)", "Chinois simplifié"),
        ("chinese_(traditional)", "Chinois traditionnel"),
    ];

    KNOWN
        .iter()
        .find(|(id, _)| *id == language)
        .map(|(_, label)| (*label).to_string())
        // Une langue ajoutée par un patch reste utilisable, sous son nom brut.
        .unwrap_or_else(|| language.replace('_', " "))
}

/// Table de traduction, restreinte aux clés demandées.
#[derive(Debug, Default, Clone)]
pub struct Catalog {
    entries: HashMap<String, String>,
}

impl Catalog {
    /// Analyse un `global.ini` en ne retenant que les clés voulues.
    ///
    /// Le filtre n'est pas une optimisation gratuite : le catalogue anglais
    /// dépasse dix méga-octets une fois décompressé, et l'écrasante majorité
    /// de ses clés décrit des missions, des objets ou de l'interface, pas des
    /// commandes.
    pub fn parse(text: &str, wanted: &dyn Fn(&str) -> bool) -> Self {
        let mut entries = HashMap::new();

        for line in text.lines() {
            // Le fichier peut commencer par une marque d'ordre des octets.
            let line = line.trim_start_matches('\u{feff}').trim();
            if line.is_empty() || line.starts_with(';') || line.starts_with('[') {
                continue;
            }
            let Some((key, value)) = line.split_once('=') else {
                continue;
            };
            let key = key.trim();
            if wanted(key) {
                entries.insert(key.to_string(), value.trim().to_string());
            }
        }

        Catalog { entries }
    }

    /// Traduction d'une clé, avec ou sans son arobase de tête.
    ///
    /// Le profil écrit `@ui_CIPitch` tandis que le catalogue indexe
    /// `ui_CIPitch` : accepter les deux formes évite de disséminer ce détail.
    pub fn get(&self, key: &str) -> Option<&str> {
        self.entries
            .get(key.strip_prefix('@').unwrap_or(key))
            .map(String::as_str)
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

/// Langues réellement présentes dans l'archive du joueur.
///
/// On recense plutôt qu'on ne suppose : l'installation d'un joueur ne contient
/// pas nécessairement toutes les traductions, et un patch peut en ajouter.
pub fn available(archive: &crate::p4k::Archive) -> crate::Result<Vec<String>> {
    let mut found: Vec<String> = archive
        .scan(|name| {
            let lower = name.to_ascii_lowercase().replace('/', "\\");
            lower.starts_with("data\\localization\\") && lower.ends_with("\\global.ini")
        })?
        .iter()
        .filter_map(|entry| language_of(&entry.name).map(str::to_string))
        .collect();

    found.sort();
    found.dedup();
    Ok(found)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = "\u{feff}; commentaire\n\
        [section]\n\
        ui_CIPitch=Tangage\n\
        ui_CIPitchDesc=Incline le nez du vaisseau\n\
        mission_intro=Bienvenue\n\
        \n\
        ligne_sans_egal\n";

    #[test]
    fn parses_keys_and_ignores_structure() {
        let catalog = Catalog::parse(SAMPLE, &|_| true);
        assert_eq!(catalog.get("ui_CIPitch"), Some("Tangage"));
        assert_eq!(
            catalog.get("ui_CIPitchDesc"),
            Some("Incline le nez du vaisseau")
        );
        // Commentaire, section et ligne malformée n'entrent pas.
        assert_eq!(catalog.len(), 3);
    }

    #[test]
    fn accepts_the_at_prefix_used_by_the_profile() {
        let catalog = Catalog::parse(SAMPLE, &|_| true);
        assert_eq!(catalog.get("@ui_CIPitch"), Some("Tangage"));
    }

    #[test]
    fn language_is_extracted_from_the_archive_path() {
        assert_eq!(
            language_of(r"Data\Localization\french_(france)\global.ini"),
            Some("french_(france)")
        );
        // L'archive mélange parfois les séparateurs.
        assert_eq!(
            language_of("Data/Localization/english/global.ini"),
            Some("english")
        );
        assert!(language_of("global.ini").is_none());
    }

    #[test]
    fn unknown_languages_stay_usable() {
        // Un patch peut ajouter une langue : elle doit rester sélectionnable,
        // fût-ce sous un nom approximatif.
        assert_eq!(display_name("french_(france)"), "Français");
        assert_eq!(display_name("klingon_(qonos)"), "klingon (qonos)");
    }

    #[test]
    fn the_filter_keeps_memory_in_check() {
        // Le catalogue anglais dépasse dix méga-octets : tout charger pour
        // n'en utiliser qu'une fraction serait un gâchis.
        let catalog = Catalog::parse(SAMPLE, &|key| key.starts_with("ui_"));
        assert_eq!(catalog.len(), 2);
        assert!(catalog.get("mission_intro").is_none());
    }
}
