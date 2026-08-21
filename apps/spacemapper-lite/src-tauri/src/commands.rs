//! Identité de ce binaire.
//!
//! Tout le reste de la découverte (périphériques, profils, diagnostic) vit
//! dans `spacemapper_app_support::devices`, partagé avec les autres éditions :
//! il n'a jamais rien eu de spécifique à Lite. Ne reste ici que ce qui, par
//! nature, diffère d'une édition à l'autre.

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct BuildInfo {
    /// `lite` ou `premium`.
    pub edition: &'static str,
    /// `production` ou `staging`.
    pub channel: &'static str,
    pub version: &'static str,
}

/// Identité de ce binaire.
///
/// Le frontend s'en sert pour afficher l'accroche d'upgrade et signaler
/// visiblement une build de pré-release — un testeur doit savoir en un coup
/// d'œil laquelle des deux versions installées il a sous les yeux.
#[tauri::command]
pub fn build_info() -> BuildInfo {
    BuildInfo {
        edition: "lite",
        channel: spacemapper_core::channel::CHANNEL,
        version: env!("CARGO_PKG_VERSION"),
    }
}
