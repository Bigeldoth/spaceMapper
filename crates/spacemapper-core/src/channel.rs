//! Canal de distribution du binaire courant.
//!
//! Le code source est **identique** entre staging et production : `staging`
//! est une branche de pré-release synchronisée depuis `main`. Ce qui distingue
//! les deux, c'est la configuration de build, injectée par la CI via la
//! variable d'environnement `SPACEMAPPER_CHANNEL`.
//!
//! La conséquence importante est l'isolation des données : une build staging
//! n'écrit jamais dans le dossier de la production. Un testeur peut donc faire
//! tourner les deux côte à côte, et un bug de pré-release ne peut pas abîmer
//! ses vrais profils — ce qui compte d'autant plus que l'édition Premium, elle,
//! écrit réellement dans `actionmaps.xml`.

use std::path::PathBuf;

/// Canal figé à la compilation. `production` par défaut : si la variable n'est
/// pas définie, on livre le comportement le plus sûr plutôt qu'un binaire qui
/// se croirait en test.
pub const CHANNEL: &str = match option_env!("SPACEMAPPER_CHANNEL") {
    Some(channel) => channel,
    None => "production",
};

pub fn is_staging() -> bool {
    CHANNEL == "staging"
}

/// Nom du dossier de données, distinct par canal **et par application**.
///
/// `app_name` isole Lite de Premium : sans lui, les deux éditions
/// partageraient silencieusement le même `settings.json` et le même dossier
/// de sauvegardes, alors qu'elles ne partagent aucun périmètre d'écriture.
pub fn data_dir_name(app_name: &str) -> String {
    if is_staging() {
        format!("{app_name}-Staging")
    } else {
        app_name.to_string()
    }
}

/// Racine des données applicatives : `%APPDATA%\<app_name>[-Staging]`.
///
/// Volontairement hors de l'arborescence de Star Citizen : le nettoyage du
/// dossier `USER` lors des patchs ne doit avoir aucun effet sur les profils
/// sauvegardés.
pub fn data_dir(app_name: &str) -> Option<PathBuf> {
    let roaming = std::env::var_os("APPDATA")?;
    Some(PathBuf::from(roaming).join(data_dir_name(app_name)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn channel_defaults_to_production() {
        // Les tests tournent sans SPACEMAPPER_CHANNEL défini : on doit obtenir
        // le canal sûr, jamais staging par accident.
        assert!(matches!(CHANNEL, "production" | "staging"));
        if option_env!("SPACEMAPPER_CHANNEL").is_none() {
            assert_eq!(CHANNEL, "production");
            assert!(!is_staging());
        }
    }

    #[test]
    fn data_dir_name_is_isolated_per_channel() {
        // Le point crucial : les deux canaux ne doivent jamais désigner le
        // même dossier, sinon une build de test corromprait de vrais profils.
        assert_ne!("SpaceMapper", "SpaceMapper-Staging");
        assert_eq!(
            data_dir_name("SpaceMapper"),
            if is_staging() {
                "SpaceMapper-Staging"
            } else {
                "SpaceMapper"
            }
        );
    }

    #[test]
    fn data_dir_name_is_also_isolated_per_application() {
        // Lite et Premium ne doivent jamais désigner le même dossier non plus :
        // sans ça, save_bindings/backup d'une édition abîmerait les données de
        // l'autre.
        assert_ne!(
            data_dir_name("SpaceMapper"),
            data_dir_name("SpaceMapper-Premium")
        );
    }
}
