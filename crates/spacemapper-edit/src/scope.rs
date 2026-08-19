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
/// Le critère est net : **tout ce qu'il faut pour décoller, se déplacer et se
/// poser**, et rien de plus. Chaque entrée répond à un besoin de ce parcours.
///
/// `spaceship_power` en fait partie parce qu'on ne décolle pas sans allumer le
/// vaisseau, et `spaceship_view` parce qu'on ne se pose pas sans regarder où.
/// Ce sont deux manques qui rendaient l'édition Lite inutilisable en pratique.
const LITE: &[&str] = &[
    // Piloter : tangage, lacet, roulis, translations, postcombustion, train.
    "spaceship_movement",
    // Décoller : mise sous tension, répartition de l'énergie.
    "spaceship_power",
    // Se poser : orienter la vue, zoomer.
    "spaceship_view",
    // Voyager.
    "spaceship_quantum",
    // Basculer entre les modes depuis le siège.
    "seat_general",
    // Rejoindre son vaisseau à pied.
    "player",
];

/// Actions refusées à l'édition Lite quelle que soit leur catégorie.
///
/// Une interface simplifiée ne doit pas pouvoir réassigner par mégarde ce qui
/// détruit le vaisseau ou éjecte le pilote. Ces actions restent visibles, mais
/// verrouillées : les masquer ferait croire qu'elles n'existent pas.
const DANGEROUS: &[&str] = &["v_self_destruct", "v_eject", "v_emergency_exit"];

/// Affiché dans Lite, mais verrouillé.
const TEASER: &[&str] = &[
    "vehicle_driver",
    "player_choice",
    "player_emotes",
    "zero_gravity_eva",
    // Portes, verrous et refroidisseurs : utiles, mais hors du parcours
    // décoller / se déplacer / se poser. La catégorie porte aussi
    // l'autodestruction.
    "spaceship_general",
    "spaceship_hud",
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

/// Cette assignation est-elle **modifiable** par l'édition Lite ?
///
/// C'est la seule question que pose la couche d'écriture. Elle porte sur le
/// couple catégorie/action, et non sur la seule catégorie : une action
/// dangereuse reste refusée même dans une catégorie autorisée.
pub fn is_editable(actionmap: &str, action: &str) -> bool {
    LITE.contains(&actionmap) && !DANGEROUS.contains(&action)
}

/// Cette action est-elle refusée pour sa dangerosité ?
pub fn is_dangerous(action: &str) -> bool {
    DANGEROUS.contains(&action)
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
        "spaceship_movement" | "spaceship_power" | "spaceship_view" | "spaceship_quantum"
        | "spaceship_general" | "spaceship_hud" | "seat_general" | "vehicle_driver" => {
            Some(EditCategory::Flight)
        }
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
    fn lite_covers_the_whole_flight_loop() {
        // Le critère du périmètre : décoller, se déplacer, se poser. Chacune
        // de ces catégories répond à une étape, et leur absence rendait
        // l'édition Lite inutilisable en pratique.
        assert!(
            is_editable("spaceship_power", "v_power_toggle"),
            "on ne décolle pas sans allumer le vaisseau"
        );
        assert!(
            is_editable("spaceship_view", "v_view_pitch"),
            "on ne se pose pas sans regarder où"
        );
        assert!(is_editable("spaceship_movement", "v_afterburner"));
        assert!(is_editable(
            "spaceship_quantum",
            "v_toggle_qdrive_engagement"
        ));
        assert!(is_editable("seat_general", "v_toggle_quantum_mode"));
        assert!(is_editable("player", "moveforward"));
    }

    #[test]
    fn dangerous_actions_stay_locked_inside_allowed_categories() {
        // L'autodestruction vit dans une catégorie de vitrine aujourd'hui,
        // mais la protection doit tenir quelle que soit la catégorie.
        assert!(is_dangerous("v_self_destruct"));
        assert!(!is_editable("spaceship_movement", "v_self_destruct"));
        assert!(!is_editable("spaceship_power", "v_eject"));
    }

    #[test]
    fn teaser_categories_are_shown_but_not_writable() {
        // Le cœur de l'incitation commerciale : visibles, jamais modifiables.
        for name in TEASER {
            assert!(
                !is_editable(name, "action_quelconque"),
                "{name} ne doit pas être modifiable"
            );
            assert!(is_visible_in_lite(name), "{name} doit rester visible");
            assert_eq!(access_of(name), Some(EditAccess::PremiumTeaser));
        }
    }

    #[test]
    fn prone_is_absent_from_lite_entirely() {
        assert!(!is_editable("prone", "prone_rollleft"));
        assert!(!is_visible_in_lite("prone"));
        assert_eq!(access_of("prone"), Some(EditAccess::PremiumOnly));
    }

    #[test]
    fn combat_and_specialisations_stay_out_of_reach() {
        // Ces catégories existent bel et bien dans un fichier réel ; elles
        // doivent être refusées et invisibles, pas simplement ignorées.
        for name in [
            "spaceship_weapons",
            "spaceship_targeting",
            "spaceship_targeting_advanced",
            "spaceship_defensive",
            "spaceship_missiles",
            "spaceship_radar",
            "spaceship_scanning",
            "spaceship_mining",
            "turret_movement",
            "turret_advanced",
            "vehicle_mfd",
            "tractor_beam",
        ] {
            assert!(
                !is_editable(name, "action_quelconque"),
                "{name} ne doit pas être modifiable"
            );
            assert!(!is_visible_in_lite(name), "{name} ne doit pas s'afficher");
            assert_eq!(access_of(name), None);
        }
    }

    #[test]
    fn unknown_categories_are_refused_by_default() {
        // Un futur patch peut introduire n'importe quel nom : le défaut sûr
        // est le refus, pas l'autorisation.
        assert!(!is_editable("categorie_inventee_par_un_patch", "quoi"));
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
