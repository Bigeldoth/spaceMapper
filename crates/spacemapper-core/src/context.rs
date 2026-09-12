//! Quels contextes doivent être comparés dans le diagnostic de conflits ?
//!
//! Le diagnostic compare les commandes à pied entre elles et avec l'interface
//! / HUD, dont le mobiGlas. Il exclut les commandes de véhicule terrestre,
//! de carte, de spectateur et d'EVA, et sépare les tourelles du vol et de ses
//! sous-modes. Ces règles expriment la politique du diagnostic, pas une
//! garantie sur les commandes réellement actives dans le jeu.
//!
//! Les catégories globales et inconnues sont comparées aux autres contextes
//! de jeu, sous réserve de ces exclusions. Les différents sous-modes de vol
//! restent séparés entre eux mais sont comparés au pilotage général.
//!
//! Le découpage part des catégories de `defaultProfile.xml`, relevées par
//! l'exemple `actionmap_contexts`. Les modes **SCM et NAV** partagent
//! `spaceship_movement` : ils ne sont pas distingués par ce classement.

use serde::{Deserialize, Serialize};

/// Groupe de catégories utilisé par le diagnostic.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Context {
    /// À pied, en gravité.
    OnFoot,
    /// Assis aux commandes d'un vaisseau.
    ShipSeat,
    /// Sous-modes comparés au siège, mais pas entre eux.
    ShipScanning,
    ShipMining,
    ShipSalvage,
    /// Tourelles, comparées séparément des commandes de vol.
    Turret,
    /// En apesanteur, hors du siège ; exclu du diagnostic de conflits.
    Eva,
    /// Véhicules terrestres, exclus du diagnostic de conflits.
    GroundVehicle,
    /// Carte, exclue du diagnostic de conflits.
    Map,
    /// Interface et HUD, dont le mobiGlas, comparés aussi aux commandes à pied.
    InterfaceHud,
    /// Commandes globales ou inconnues, sous réserve des exclusions.
    Always,
    /// Hors du jeu proprement dit : débogage, spectateur, éditeur de
    /// personnage. Jamais concerné par un conflit d'assignation.
    OutOfGame,
}

/// Groupe de diagnostic auquel appartient une catégorie.
///
/// Les nouvelles catégories d'une famille connue héritent de son contexte.
/// Les autres retombent sur [`Context::Always`], sans contourner les exclusions
/// du diagnostic.
pub fn context_of(actionmap: &str) -> Context {
    match actionmap {
        // À pied. `mining` sans préfixe est le minage portatif, distinct de
        // `spaceship_mining`.
        "player"
        | "player_choice"
        | "player_emotes"
        | "player_input_optical_tracking"
        | "prone"
        | "hacking"
        | "tractor_beam"
        | "mining"
        | "incapacitated" => Context::OnFoot,

        // Sous-modes du vaisseau, séparés dans le diagnostic.
        "spaceship_scanning" => Context::ShipScanning,
        "spaceship_mining" => Context::ShipMining,
        "spaceship_salvage" => Context::ShipSalvage,

        // Carte et apesanteur, exclues du diagnostic même entre elles.
        "mapui" => Context::Map,
        other if other.starts_with("mapui_") => Context::Map,
        other if other.starts_with("zero_gravity_") => Context::Eva,

        // Interface et HUD : les préfixes du mobiGlas et du HUD ne doivent
        // pas les assimiler aux commandes de conduite ou de vol.
        "default" | "vehicle_mobiglas" | "spaceship_hud" => Context::InterfaceHud,
        other if other.starts_with("ui_") => Context::InterfaceHud,

        "stopwatch" => Context::Always,

        // Hors jeu.
        "debug"
        | "spectator"
        | "flycam"
        | "view_director_mode"
        | "character_customizer"
        | "RemoteRigidEntityController"
        | "server_renderer" => Context::OutOfGame,
        other if other.starts_with("spectator_") => Context::OutOfGame,

        // Tout le reste du vaisseau : vol, énergie, armement, vue, MFD…
        other if other.starts_with("spaceship_") => Context::ShipSeat,
        "seat_general" | "vehicle_mfd" | "lights_controller" | "IFCS_controls" => Context::ShipSeat,

        // Familles connues, y compris les catégories ajoutées par un patch.
        // Les exceptions partagées `vehicle_mfd` et `vehicle_mobiglas` sont
        // traitées ci-dessus avant la famille des véhicules terrestres.
        other if other.starts_with("player_") => Context::OnFoot,
        other if other.starts_with("turret_") => Context::Turret,
        other if other.starts_with("vehicle_") => Context::GroundVehicle,

        _ => Context::Always,
    }
}

/// Le diagnostic doit-il comparer ces deux contextes ?
///
/// Une réponse positive autorise la comparaison des boutons, modificateurs
/// et modes d'appui ; elle ne suffit pas, seule, à établir un conflit.
pub fn can_collide(a: Context, b: Context) -> bool {
    use Context::*;

    // Ces contextes sont toujours exclus, même deux commandes du même
    // contexte ou face à l'interface ou à une commande globale.
    if matches!(a, OutOfGame | GroundVehicle | Map | Eva)
        || matches!(b, OutOfGame | GroundVehicle | Map | Eva)
    {
        return false;
    }
    // L'interface/HUD est la seule exception à l'isolement des commandes à
    // pied. Cette règle précède le cas global pour préserver cet isolement.
    if a == OnFoot || b == OnFoot {
        return a == b || a == InterfaceHud || b == InterfaceHud;
    }
    // L'interface et les commandes globales restent comparées aux contextes
    // non exclus.
    if matches!(a, Always | InterfaceHud) || matches!(b, Always | InterfaceHud) {
        return true;
    }
    if a == b {
        return true;
    }

    // Le pilotage général reste comparé à chacun de ses sous-modes.
    let sub_mode = |c: Context| matches!(c, ShipScanning | ShipMining | ShipSalvage);
    if (a == ShipSeat && sub_mode(b)) || (b == ShipSeat && sub_mode(a)) {
        return true;
    }

    // Les autres contextes sont séparés, notamment les tourelles de tous
    // les contextes de vol et les sous-modes de vol entre eux.
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn diagnostic_policy_covers_every_context_pair_symmetrically() {
        use Context::*;

        // Chaque ligne donne explicitement tous les contextes autorisés,
        // indépendamment de l'implémentation des règles ci-dessus.
        let policy: [(Context, &[Context]); 12] = [
            (OnFoot, &[OnFoot, InterfaceHud]),
            (
                ShipSeat,
                &[
                    ShipSeat,
                    ShipScanning,
                    ShipMining,
                    ShipSalvage,
                    InterfaceHud,
                    Always,
                ],
            ),
            (
                ShipScanning,
                &[ShipSeat, ShipScanning, InterfaceHud, Always],
            ),
            (ShipMining, &[ShipSeat, ShipMining, InterfaceHud, Always]),
            (ShipSalvage, &[ShipSeat, ShipSalvage, InterfaceHud, Always]),
            (Turret, &[Turret, InterfaceHud, Always]),
            (Eva, &[]),
            (GroundVehicle, &[]),
            (Map, &[]),
            (
                InterfaceHud,
                &[
                    OnFoot,
                    ShipSeat,
                    ShipScanning,
                    ShipMining,
                    ShipSalvage,
                    Turret,
                    InterfaceHud,
                    Always,
                ],
            ),
            (
                Always,
                &[
                    ShipSeat,
                    ShipScanning,
                    ShipMining,
                    ShipSalvage,
                    Turret,
                    InterfaceHud,
                    Always,
                ],
            ),
            (OutOfGame, &[]),
        ];

        for &(a, allowed) in &policy {
            for &(b, _) in &policy {
                let expected = allowed.contains(&b);
                assert_eq!(can_collide(a, b), expected, "{a:?} / {b:?}");
                assert_eq!(can_collide(b, a), expected, "{b:?} / {a:?}");
            }
        }
    }

    #[test]
    fn on_foot_categories_are_compared_with_each_other_and_interface_hud() {
        for name in [
            "player",
            "player_choice",
            "player_emotes",
            "player_input_optical_tracking",
            "prone",
            "hacking",
            "tractor_beam",
            "mining",
            "incapacitated",
            "player_future_controls",
        ] {
            let context = context_of(name);
            assert_eq!(context, Context::OnFoot, "{name}");
            assert!(can_collide(context, context_of("player")), "{name}");
            for other in [
                "default",
                "vehicle_mobiglas",
                "spaceship_hud",
                "ui_notification",
            ] {
                assert!(can_collide(context, context_of(other)), "{name} / {other}");
                assert!(can_collide(context_of(other), context), "{other} / {name}");
            }
            for other in [
                "stopwatch",
                "categorie_inedite",
                "spaceship_movement",
                "zero_gravity_eva",
                "mapui",
            ] {
                assert!(!can_collide(context, context_of(other)), "{name} / {other}");
                assert!(!can_collide(context_of(other), context), "{other} / {name}");
            }
        }
    }

    #[test]
    fn ground_vehicle_categories_are_excluded_even_from_each_other() {
        for name in [
            "vehicle_general",
            "vehicle_driver",
            "vehicle_future_controls",
        ] {
            let context = context_of(name);
            assert_eq!(context, Context::GroundVehicle, "{name}");
            for other in [
                "vehicle_general",
                "vehicle_driver",
                "default",
                "vehicle_mobiglas",
                "spaceship_movement",
            ] {
                assert!(!can_collide(context, context_of(other)), "{name} / {other}");
                assert!(!can_collide(context_of(other), context), "{other} / {name}");
            }
        }
    }

    #[test]
    fn shared_vehicle_categories_keep_their_specific_context() {
        assert_eq!(context_of("vehicle_mfd"), Context::ShipSeat);
        assert_eq!(context_of("vehicle_mobiglas"), Context::InterfaceHud);
        assert!(can_collide(
            context_of("vehicle_mfd"),
            context_of("spaceship_movement")
        ));
        assert!(can_collide(
            context_of("vehicle_mobiglas"),
            context_of("spaceship_movement")
        ));
    }

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

        // Le diagnostic conserve la comparaison avec le pilotage général.
        assert!(can_collide(mining, seat));
        assert!(can_collide(salvage, seat));
    }

    #[test]
    fn turret_categories_are_separate_from_every_flight_context() {
        for name in [
            "turret_movement",
            "turret_advanced",
            "turret_future_controls",
        ] {
            let context = context_of(name);
            assert_eq!(context, Context::Turret, "{name}");
            for other in [
                "spaceship_movement",
                "spaceship_scanning",
                "spaceship_mining",
                "spaceship_salvage",
                "seat_general",
                "vehicle_mfd",
            ] {
                assert!(!can_collide(context, context_of(other)), "{name} / {other}");
                assert!(!can_collide(context_of(other), context), "{other} / {name}");
            }
            assert!(
                can_collide(context, context_of("turret_advanced")),
                "{name}"
            );
        }
    }

    #[test]
    fn overlays_respect_diagnostic_exclusions() {
        let mobiglas = context_of("vehicle_mobiglas");
        for other in ["spaceship_movement", "player", "turret_movement"] {
            assert!(can_collide(mobiglas, context_of(other)), "{other}");
        }
        for other in ["zero_gravity_eva", "mapui", "vehicle_driver", "spectator"] {
            assert!(!can_collide(mobiglas, context_of(other)), "{other}");
            assert!(!can_collide(context_of(other), mobiglas), "{other}");
        }
    }

    #[test]
    fn out_of_game_categories_are_ignored() {
        for name in [
            "debug",
            "spectator",
            "spectator_future_controls",
            "flycam",
            "character_customizer",
        ] {
            assert_eq!(context_of(name), Context::OutOfGame, "{name}");
            assert!(!can_collide(context_of(name), context_of("player")));
            // Y compris entre elles : ce ne sont pas des commandes de jeu.
            assert!(!can_collide(context_of(name), context_of("debug")));
        }
    }

    #[test]
    fn spaceship_categories_other_than_hud_land_in_the_seat_or_a_sub_mode() {
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
            "spaceship_inconnue_ajoutee_par_un_patch",
        ] {
            assert_eq!(context_of(name), Context::ShipSeat, "{name}");
        }
    }

    #[test]
    fn an_unknown_category_respects_the_global_diagnostic_policy() {
        assert_eq!(context_of("categorie_inedite"), Context::Always);
        assert!(can_collide(
            context_of("categorie_inedite"),
            context_of("spaceship_movement")
        ));
        for other in [
            "player",
            "vehicle_driver",
            "spectator",
            "mapui",
            "zero_gravity_eva",
        ] {
            assert!(
                !can_collide(context_of("categorie_inedite"), context_of(other)),
                "{other}"
            );
        }
    }

    #[test]
    fn map_and_eva_categories_are_excluded_even_from_themselves() {
        for (name, expected) in [
            ("mapui", Context::Map),
            ("mapui_future_controls", Context::Map),
            ("zero_gravity_eva", Context::Eva),
            ("zero_gravity_traversal", Context::Eva),
            ("zero_gravity_future_controls", Context::Eva),
        ] {
            let context = context_of(name);
            assert_eq!(context, expected, "{name}");
            for other in [
                name,
                "mapui",
                "zero_gravity_eva",
                "default",
                "spaceship_hud",
                "vehicle_mobiglas",
                "stopwatch",
                "player",
                "spaceship_movement",
            ] {
                assert!(!can_collide(context, context_of(other)), "{name} / {other}");
                assert!(!can_collide(context_of(other), context), "{other} / {name}");
            }
        }
    }

    #[test]
    fn interface_hud_categories_are_shared_with_on_foot_and_flight() {
        for name in [
            "default",
            "ui_textfield",
            "ui_notification",
            "ui_future_controls",
            "vehicle_mobiglas",
            "spaceship_hud",
        ] {
            let context = context_of(name);
            assert_eq!(context, Context::InterfaceHud, "{name}");
            for other in [
                "player",
                "player_choice",
                "spaceship_movement",
                "turret_movement",
                "vehicle_mobiglas",
            ] {
                assert!(can_collide(context, context_of(other)), "{name} / {other}");
                assert!(can_collide(context_of(other), context), "{other} / {name}");
            }
        }
    }

    #[test]
    fn new_contexts_have_stable_serialized_names() {
        assert_eq!(serde_json::to_string(&Context::Map).unwrap(), "\"map\"");
        assert_eq!(
            serde_json::to_string(&Context::InterfaceHud).unwrap(),
            "\"interface_hud\""
        );
    }
}
