//! Périmètre d'édition autorisé.
//!
//! Cette politique est appliquée **en Rust**, dans la couche d'écriture, et non
//! dans l'interface. Une commande visant une catégorie hors périmètre est
//! refusée quoi qu'ait affiché le frontend : c'est ce qui rend la limite réelle
//! plutôt que cosmétique.
//!
//! Trois niveaux, et la distinction entre les deux derniers est un choix
//! commercial autant que technique :
//!
//! - [`EditAccess::Lite`] — modifiable dans l'édition gratuite.
//! - [`EditAccess::PremiumTeaser`] — affiché dans Lite, mais verrouillé. Le
//!   joueur voit ce qu'il gagnerait à passer au Premium, sur des catégories
//!   qu'il utilise vraiment.
//! - [`EditAccess::PremiumOnly`] — absent de Lite. Réservé aux catégories dont
//!   l'affichage n'apporterait rien à un utilisateur gratuit.

use serde::Serialize;

/// Modifiable par l'édition Lite.
///
/// Volontairement réduit aux deux catégories qui couvrent l'essentiel d'une
/// première configuration : piloter et marcher.
const LITE: &[&str] = &["spaceship_movement", "player"];

/// Affiché dans Lite, mais verrouillé.
const TEASER: &[&str] = &[
    "vehicle_driver",
    "player_choice",
    "player_emotes",
    "zero_gravity_eva",
];

/// Modifiable en Premium, mais non affiché dans Lite.
const PREMIUM_ONLY: &[&str] = &["prone"];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum EditAccess {
    Lite,
    PremiumTeaser,
    PremiumOnly,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum EditCategory {
    /// Pilotage : tangage, lacet, roulis, translations, postcombustion.
    Flight,
    /// Déplacement du personnage : marche, interaction, émotes, EVA.
    OnFoot,
}

/// Cette catégorie est-elle **modifiable** par l'édition Lite ?
///
/// C'est la seule question que pose la couche d'écriture.
pub fn is_editable(actionmap: &str) -> bool {
    LITE.contains(&actionmap)
}

/// Niveau d'accès d'une catégorie, ou `None` si elle sort entièrement du
/// domaine d'édition (armement, énergie, tourelles…).
pub fn access_of(actionmap: &str) -> Option<EditAccess> {
    if LITE.contains(&actionmap) {
        Some(EditAccess::Lite)
    } else if TEASER.contains(&actionmap) {
        Some(EditAccess::PremiumTeaser)
    } else if PREMIUM_ONLY.contains(&actionmap) {
        Some(EditAccess::PremiumOnly)
    } else {
        None
    }
}

/// Cette catégorie doit-elle apparaître dans l'interface Lite ?
pub fn is_visible_in_lite(actionmap: &str) -> bool {
    matches!(
        access_of(actionmap),
        Some(EditAccess::Lite | EditAccess::PremiumTeaser)
    )
}

pub fn category_of(actionmap: &str) -> Option<EditCategory> {
    match actionmap {
        "spaceship_movement" | "vehicle_driver" => Some(EditCategory::Flight),
        "player" | "prone" | "player_choice" | "player_emotes" | "zero_gravity_eva" => {
            Some(EditCategory::OnFoot)
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lite_can_edit_walking_and_flying() {
        assert!(is_editable("spaceship_movement"));
        assert!(is_editable("player"));
    }

    #[test]
    fn teaser_categories_are_shown_but_not_writable() {
        // Le cœur de l'incitation commerciale : visibles, jamais modifiables.
        for name in TEASER {
            assert!(!is_editable(name), "{name} ne doit pas être modifiable");
            assert!(is_visible_in_lite(name), "{name} doit rester visible");
            assert_eq!(access_of(name), Some(EditAccess::PremiumTeaser));
        }
    }

    #[test]
    fn prone_is_absent_from_lite_entirely() {
        assert!(!is_editable("prone"));
        assert!(!is_visible_in_lite("prone"));
        assert_eq!(access_of("prone"), Some(EditAccess::PremiumOnly));
    }

    #[test]
    fn combat_and_systems_stay_out_of_reach() {
        // Ces catégories existent bel et bien dans un fichier réel ; elles
        // doivent être refusées et invisibles, pas simplement ignorées.
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
            // Porte l'autodestruction : hors de portée d'une interface
            // simplifiée, même en affichage.
            "spaceship_general",
        ] {
            assert!(!is_editable(name), "{name} ne doit pas être modifiable");
            assert!(!is_visible_in_lite(name), "{name} ne doit pas s'afficher");
            assert_eq!(access_of(name), None);
        }
    }

    #[test]
    fn unknown_categories_are_refused_by_default() {
        // Un futur patch peut introduire n'importe quel nom : le défaut sûr
        // est le refus, pas l'autorisation.
        assert!(!is_editable("categorie_inventee_par_un_patch"));
        assert!(!is_visible_in_lite(""));
        assert_eq!(access_of("inconnue"), None);
    }

    #[test]
    fn every_known_category_has_a_display_category() {
        // Sans quoi une entrée serait affichée sans savoir où la ranger.
        for name in LITE.iter().chain(TEASER).chain(PREMIUM_ONLY) {
            assert!(category_of(name).is_some(), "{name} sans catégorie");
        }
    }
}
