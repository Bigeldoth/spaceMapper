//! Quand une assignation est-elle active ?
//!
//! Deux commandes ne se disputent un bouton que si elles peuvent être actives
//! **en même temps**. Or Star Citizen n'active jamais toutes ses catégories à
//! la fois : on ne marche pas en pilotant, et un mode de minage n'a pas les
//! mêmes commandes qu'un mode de combat. Signaler un conflit entre le siège et
//! la marche à pied serait une fausse alerte — et l'outil qui crie au loup sur
//! 200 lignes ne sert plus à rien.
//!
//! Le découpage part des **50 catégories réellement présentes** dans
//! `defaultProfile.xml`, relevées par l'exemple `actionmap_contexts`, et non
//! d'une liste supposée.
//!
//! # Ce qui est certain et ce qui est déduit
//!
//! Qu'on ne puisse pas être à pied et assis aux commandes en même temps relève
//! du fonctionnement de base du jeu. En revanche, le caractère mutuellement
//! exclusif des modes scan / minage / récupération est **déduit** du fait que
//! CIG leur donne des catégories séparées ; c'est cohérent avec le jeu, mais
//! non documenté. En cas de doute, ce module préfère signaler un conflit
//! plutôt que d'en taire un : une fausse alerte se voit, un conflit tu ne se
//! découvre qu'en vol.
//!
//! # Ce qui n'existe pas
//!
//! Les modes de vol **SCM et NAV** n'ont pas de catégorie propre : ils
//! partagent `spaceship_movement`. Rien ne permet donc de les distinguer au
//! niveau des assignations, et deux commandes de vol restent bien en conflit
//! même si le joueur les utilise dans des modes différents.

use serde::{Deserialize, Serialize};

/// Situation de jeu dans laquelle une catégorie est active.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Context {
    /// À pied, en gravité.
    OnFoot,
    /// Assis aux commandes d'un vaisseau.
    ShipSeat,
    /// Sous-modes du siège, exclusifs entre eux mais actifs assis.
    ShipScanning,
    ShipMining,
    ShipSalvage,
    /// En tourelle : les commandes de vol ne répondent plus.
    Turret,
    /// En apesanteur, hors du siège.
    Eva,
    /// Au volant d'un véhicule terrestre.
    GroundVehicle,
    /// Actif quoi qu'il arrive : mobiGlas, interface, chronomètre.
    Always,
    /// Hors du jeu proprement dit : débogage, spectateur, éditeur de
    /// personnage. Jamais concerné par un conflit d'assignation.
    OutOfGame,
}

/// Situation dans laquelle une catégorie s'applique.
///
/// Toute catégorie inconnue retombe sur [`Context::Always`] : mieux vaut un
/// conflit signalé à tort qu'un conflit passé sous silence, et une catégorie
/// ajoutée par un patch ne doit pas disparaître des vérifications.
pub fn context_of(actionmap: &str) -> Context {
    match actionmap {
        // À pied. `mining` sans préfixe est le minage portatif, distinct de
        // `spaceship_mining` : un seul geste, et il se fait debout.
        "player"
        | "player_choice"
        | "player_emotes"
        | "player_input_optical_tracking"
        | "prone"
        | "hacking"
        | "tractor_beam"
        | "mining"
        | "incapacitated" => Context::OnFoot,

        // Sous-modes du vaisseau, exclusifs entre eux.
        "spaceship_scanning" => Context::ShipScanning,
        "spaceship_mining" => Context::ShipMining,
        "spaceship_salvage" => Context::ShipSalvage,

        // Tourelle : on n'y pilote pas.
        "turret_movement" | "turret_advanced" => Context::Turret,

        // Apesanteur.
        "zero_gravity_eva" | "zero_gravity_traversal" => Context::Eva,

        // Véhicule terrestre.
        "vehicle_general" | "vehicle_driver" => Context::GroundVehicle,

        // Superpositions permanentes : le mobiGlas s'ouvre partout.
        "default" | "mapui" | "ui_textfield" | "ui_notification" | "vehicle_mobiglas"
        | "stopwatch" => Context::Always,

        // Hors jeu.
        "debug"
        | "spectator"
        | "flycam"
        | "view_director_mode"
        | "character_customizer"
        | "RemoteRigidEntityController"
        | "server_renderer" => Context::OutOfGame,

        // Tout le reste du vaisseau : vol, énergie, armement, vue, MFD…
        other if other.starts_with("spaceship_") => Context::ShipSeat,
        "seat_general" | "vehicle_mfd" | "lights_controller" | "IFCS_controls" => Context::ShipSeat,

        _ => Context::Always,
    }
}

/// Deux situations peuvent-elles coexister ?
///
/// C'est la seule question qui décide d'un conflit.
pub fn can_collide(a: Context, b: Context) -> bool {
    use Context::*;

    // Ce qui n'appartient pas au jeu ne gêne personne.
    if a == OutOfGame || b == OutOfGame {
        return false;
    }
    // Ce qui est toujours actif se heurte à tout, y compris à lui-même.
    if a == Always || b == Always {
        return true;
    }
    if a == b {
        return true;
    }

    // Les sous-modes restent pilotés depuis le siège : leurs commandes
    // cohabitent avec celles du vol.
    let sub_mode = |c: Context| matches!(c, ShipScanning | ShipMining | ShipSalvage);
    if (a == ShipSeat && sub_mode(b)) || (b == ShipSeat && sub_mode(a)) {
        return true;
    }

    // Deux sous-modes différents ne sont jamais actifs ensemble : c'est tout
    // l'intérêt d'avoir des catégories séparées.
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn walking_never_collides_with_flying() {
        // Le cas qui a motivé ce module : une touche partagée entre le siège
        // et la marche n'est pas un conflit.
        assert!(!can_collide(
            context_of("player"),
            context_of("spaceship_movement")
        ));
        assert!(!can_collide(
            context_of("seat_general"),
            context_of("player_choice")
        ));
    }

    #[test]
    fn sub_modes_exclude_each_other_but_not_the_seat() {
        let mining = context_of("spaceship_mining");
        let salvage = context_of("spaceship_salvage");
        let scanning = context_of("spaceship_scanning");
        let seat = context_of("spaceship_movement");

        assert!(!can_collide(mining, salvage));
        assert!(!can_collide(mining, scanning));
        assert!(!can_collide(scanning, salvage));

        // En revanche on mine assis : le vol reste actif.
        assert!(can_collide(mining, seat));
        assert!(can_collide(salvage, seat));
    }

    #[test]
    fn a_turret_is_not_a_cockpit() {
        assert!(!can_collide(
            context_of("turret_movement"),
            context_of("spaceship_movement")
        ));
        // Mais deux commandes de tourelle, elles, se disputent bien un bouton.
        assert!(can_collide(
            context_of("turret_movement"),
            context_of("turret_advanced")
        ));
    }

    #[test]
    fn overlays_collide_with_everything() {
        // Le mobiGlas s'ouvre à pied comme aux commandes : une touche qui lui
        // est prise l'est partout.
        let mobiglas = context_of("vehicle_mobiglas");
        for other in ["player", "spaceship_movement", "zero_gravity_eva"] {
            assert!(can_collide(mobiglas, context_of(other)), "{other}");
        }
    }

    #[test]
    fn out_of_game_categories_are_ignored() {
        for name in ["debug", "spectator", "flycam", "character_customizer"] {
            assert_eq!(context_of(name), Context::OutOfGame, "{name}");
            assert!(!can_collide(context_of(name), context_of("player")));
            // Y compris entre elles : ce ne sont pas des commandes de jeu.
            assert!(!can_collide(context_of(name), context_of("debug")));
        }
    }

    #[test]
    fn every_spaceship_category_lands_in_the_seat_or_a_sub_mode() {
        // Relevé réel : toutes les catégories `spaceship_*` du profil par
        // défaut. Une nouvelle catégorie ajoutée par un patch doit hériter du
        // siège plutôt que de disparaître des vérifications.
        for name in [
            "spaceship_general",
            "spaceship_view",
            "spaceship_movement",
            "spaceship_quantum",
            "spaceship_docking",
            "spaceship_targeting",
            "spaceship_targeting_advanced",
            "spaceship_target_hailing",
            "spaceship_radar",
            "spaceship_weapons",
            "spaceship_missiles",
            "spaceship_defensive",
            "spaceship_auto_weapons",
            "spaceship_power",
            "spaceship_hud",
            "spaceship_inconnue_ajoutee_par_un_patch",
        ] {
            assert_eq!(context_of(name), Context::ShipSeat, "{name}");
        }
    }

    #[test]
    fn an_unknown_category_is_treated_as_always_active() {
        // Prudence délibérée : on préfère une fausse alerte visible à un
        // conflit tu, qui ne se découvrirait qu'en vol.
        assert_eq!(context_of("categorie_inedite"), Context::Always);
        assert!(can_collide(
            context_of("categorie_inedite"),
            context_of("player")
        ));
    }
}
