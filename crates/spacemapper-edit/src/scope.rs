//! Périmètre d'édition autorisé.
//!
//! Cette politique est appliquée **en Rust**, dans la couche d'écriture, et non
//! dans l'interface. Une commande visant une catégorie hors périmètre est
//! refusée quoi qu'ait affiché le frontend : c'est ce qui rend la limite réelle
//! plutôt que cosmétique.
//!
//! Le découpage suit les deux premières étapes du parcours d'apprentissage :
//! savoir marcher, puis savoir voler. Tout ce qui relève du combat, des
//! systèmes de bord ou des spécialisations relève de l'édition Premium.

use serde::Serialize;

/// Catégories de pilotage éditables : les mouvements, rien d'autre.
///
/// `spaceship_general` en est volontairement exclu : il contient
/// l'autodestruction et les verrouillages de portes, qu'on ne veut pas voir
/// réassignés par erreur depuis une interface dite simplifiée.
const FLIGHT: &[&str] = &["spaceship_movement", "vehicle_driver"];

/// Catégories à pied.
const ON_FOOT: &[&str] = &[
    "player",
    "prone",
    "player_emotes",
    "player_choice",
    "zero_gravity_eva",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum EditCategory {
    /// Pilotage : tangage, lacet, roulis, translations, boost, frein.
    Flight,
    /// Déplacement du personnage : marche, accroupi, saut, interaction.
    OnFoot,
}

/// Cette catégorie est-elle modifiable par l'édition Lite ?
pub fn is_editable(actionmap: &str) -> bool {
    category_of(actionmap).is_some()
}

pub fn category_of(actionmap: &str) -> Option<EditCategory> {
    if FLIGHT.contains(&actionmap) {
        Some(EditCategory::Flight)
    } else if ON_FOOT.contains(&actionmap) {
        Some(EditCategory::OnFoot)
    } else {
        None
    }
}

/// Toutes les catégories éditables, pour l'affichage.
pub fn editable_actionmaps() -> impl Iterator<Item = (&'static str, EditCategory)> {
    FLIGHT
        .iter()
        .map(|n| (*n, EditCategory::Flight))
        .chain(ON_FOOT.iter().map(|n| (*n, EditCategory::OnFoot)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn movement_categories_are_editable() {
        assert_eq!(
            category_of("spaceship_movement"),
            Some(EditCategory::Flight)
        );
        assert_eq!(category_of("vehicle_driver"), Some(EditCategory::Flight));
        assert_eq!(category_of("player"), Some(EditCategory::OnFoot));
        assert_eq!(category_of("zero_gravity_eva"), Some(EditCategory::OnFoot));
    }

    #[test]
    fn combat_and_systems_stay_out_of_reach() {
        // Le cœur de la limite Lite. Ces catégories existent bel et bien dans
        // un fichier réel ; elles doivent être refusées, pas ignorées.
        for name in [
            "spaceship_weapons",
            "spaceship_targeting",
            "spaceship_defensive",
            "spaceship_power",
            "spaceship_quantum",
            "spaceship_mining",
            "turret_movement",
            "vehicle_mfd",
            "seat_general",
        ] {
            assert!(!is_editable(name), "{name} ne doit pas être éditable");
        }
    }

    #[test]
    fn dangerous_general_category_is_excluded() {
        // `spaceship_general` porte v_self_destruct : hors de portée d'une
        // interface simplifiée.
        assert!(!is_editable("spaceship_general"));
    }

    #[test]
    fn unknown_categories_are_refused_by_default() {
        // Un futur patch peut introduire n'importe quel nom : le défaut sûr
        // est le refus, pas l'autorisation.
        assert!(!is_editable("categorie_inventee_par_un_patch"));
        assert!(!is_editable(""));
    }
}
