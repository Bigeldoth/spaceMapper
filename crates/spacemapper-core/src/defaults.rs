//! Profil de contrôles **par défaut**, extrait de `Data.p4k`.
//!
//! Ce fichier explique une observation déroutante : un joueur dont la
//! configuration fonctionne parfaitement ne retrouve pas ses axes dans
//! `actionmaps.xml`. Ce dernier ne contient que les **surcharges** ; tout ce
//! qui n'a jamais été modifié reste défini ici, et n'y est jamais recopié.
//!
//! Le schéma n'est pas celui d'un profil utilisateur. Racine `<profile>`, et
//! chaque action porte ses défauts en attributs, un par famille de
//! périphérique :
//!
//! ```xml
//! <action name="v_pitch" gamepad="thumbry" joystick="y"
//!         UILabel="@ui_CIPitch" UIDescription="@ui_CIPitchDesc"/>
//! ```
//!
//! Les valeurs sont des **noms de contrôle nus**, sans préfixe `js1_` : le jeu
//! les applique au périphérique correspondant, quel que soit son index.
//!
//! Les attributs `UILabel` et `UIDescription` sont des clés de localisation.
//! Le jeu possède donc son propre vocabulaire lisible pour chaque action —
//! bien plus complet et toujours à jour, comparé à un catalogue tenu à la main.

use crate::{Error, Result};
use serde::{Deserialize, Serialize};

/// Un profil par défaut décodé.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DefaultProfile {
    pub version: Option<String>,
    pub action_maps: Vec<DefaultActionMap>,
}

impl DefaultProfile {
    /// Défauts d'une action donnée, recherchés par catégorie puis par nom.
    pub fn action(&self, actionmap: &str, action: &str) -> Option<&DefaultAction> {
        self.action_maps
            .iter()
            .find(|m| m.name == actionmap)?
            .actions
            .iter()
            .find(|a| a.name == action)
    }

    /// Nombre d'actions portant au moins un défaut exploitable.
    pub fn bound_count(&self) -> usize {
        self.action_maps
            .iter()
            .flat_map(|m| &m.actions)
            .filter(|a| a.has_any_default())
            .count()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DefaultActionMap {
    pub name: String,
    /// Clé de localisation du nom de la catégorie, ex. `@ui_CGSpaceFlightMovement`.
    pub ui_label: Option<String>,
    pub actions: Vec<DefaultAction>,
}

/// Assignations par défaut d'une action, une par famille de périphérique.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct DefaultAction {
    pub name: String,
    pub keyboard: Option<String>,
    pub mouse: Option<String>,
    pub joystick: Option<String>,
    pub gamepad: Option<String>,
    /// Clé de localisation du libellé, ex. `@ui_CIPitch`.
    pub ui_label: Option<String>,
    /// Clé de localisation de la description — la réponse du jeu lui-même à
    /// « à quoi sert cette touche ? ».
    pub ui_description: Option<String>,
    /// `press`, `hold`, `double_tap`, `double_tap_nonblocking`… — la manière
    /// dont le jeu déclenche l'action quand elle n'a jamais été surchargée.
    ///
    /// Sans surcharge, `actionmaps.xml` ne dit rien de ce comportement : les
    /// esquives à pied (`melee_dodgeLeft` et consorts) sont un double-appui
    /// par défaut, sur les mêmes touches que le déplacement simple, et rien
    /// ne le distingue tant que ce champ n'est pas lu.
    pub activation_mode: Option<String>,
}

impl DefaultAction {
    pub fn has_any_default(&self) -> bool {
        self.keyboard.is_some()
            || self.mouse.is_some()
            || self.joystick.is_some()
            || self.gamepad.is_some()
    }

    /// Défaut pour une famille donnée, sous forme de jeton complet.
    ///
    /// Le profil ne stocke que le nom du contrôle ; c'est l'appelant qui sait
    /// à quel index de périphérique il s'applique.
    pub fn token_for(&self, prefix: &str) -> Option<String> {
        let control = match prefix.get(..2)? {
            "js" => self.joystick.as_deref(),
            "kb" => self.keyboard.as_deref(),
            "mo" => self.mouse.as_deref(),
            "gp" => self.gamepad.as_deref(),
            _ => None,
        }?;
        Some(format!("{prefix}_{control}"))
    }
}

/// Analyse un profil par défaut déjà décodé en texte XML.
pub fn parse_str(xml: &str) -> Result<DefaultProfile> {
    let doc = roxmltree::Document::parse(xml)?;
    let root = doc.root_element();

    if !root.has_tag_name("profile") {
        return Err(Error::Schema(format!(
            "racine <{}> au lieu de <profile>",
            root.tag_name().name()
        )));
    }

    let action_maps = root
        .children()
        .filter(|n| n.is_element() && n.has_tag_name("actionmap"))
        .filter_map(|node| {
            Some(DefaultActionMap {
                name: node.attribute("name")?.to_string(),
                ui_label: attr(&node, "UILabel"),
                actions: node
                    .children()
                    .filter(|n| n.is_element() && n.has_tag_name("action"))
                    .filter_map(|action| {
                        Some(DefaultAction {
                            name: action.attribute("name")?.to_string(),
                            keyboard: attr(&action, "keyboard"),
                            mouse: attr(&action, "mouse"),
                            joystick: attr(&action, "joystick"),
                            gamepad: attr(&action, "gamepad"),
                            ui_label: attr(&action, "UILabel"),
                            ui_description: attr(&action, "UIDescription"),
                            activation_mode: attr(&action, "activationMode"),
                        })
                    })
                    .collect(),
            })
        })
        .collect();

    Ok(DefaultProfile {
        version: attr(&root, "version"),
        action_maps,
    })
}

/// Lit un attribut en traitant le blanc comme une absence.
///
/// Le profil écrit `joystick=" "` pour « aucun défaut sur cette famille ».
/// Confondre cette valeur avec un contrôle produirait des jetons du type
/// `js1_ `, exactement l'anomalie qu'on trouve déjà dans les fichiers
/// utilisateur.
fn attr(node: &roxmltree::Node, name: &str) -> Option<String> {
    node.attribute(name)
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Fidèle au profil par défaut réel, attributs compris.
    const SAMPLE: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<profile version="1" optionsVersion="2" rebindVersion="2">
 <platforms><PC keyboard="1" joystick="1"/></platforms>
 <actionmap name="spaceship_movement" version="18" UILabel="@ui_CGSpaceFlightMovement">
  <action name="v_pitch_up" onPress="1" keyboard="down" gamepad=" " joystick=" " UILabel="@ui_CIPitchUp"/>
  <action name="v_pitch" gamepad="thumbry" joystick="y" UILabel="@ui_CIPitch" UIDescription="@ui_CIPitchDesc"/>
  <action name="v_yaw" gamepad="thumblx" joystick="x" UILabel="@ui_CIYaw"/>
  <action name="v_roll" gamepad="thumbrx" joystick="rotz" UILabel="@ui_CIRoll"/>
  <action name="v_pitch_mouse" mouse="maxis_y"/>
 </actionmap>
 <actionmap name="player">
  <action name="melee_dodgeLeft" activationMode="double_tap_nonblocking" keyboard="a" UILabel="@ui_CIFPSMoveDodgeLeft"/>
 </actionmap>
</profile>"#;

    #[test]
    fn reads_the_flight_axis_defaults() {
        // Ce sont précisément les assignations absentes d'un actionmaps.xml
        // réel, et qui font pourtant voler le joueur.
        let profile = parse_str(SAMPLE).unwrap();

        let pitch = profile.action("spaceship_movement", "v_pitch").unwrap();
        assert_eq!(pitch.joystick.as_deref(), Some("y"));
        assert_eq!(
            profile
                .action("spaceship_movement", "v_roll")
                .unwrap()
                .joystick
                .as_deref(),
            Some("rotz")
        );
        assert_eq!(
            profile
                .action("spaceship_movement", "v_yaw")
                .unwrap()
                .joystick
                .as_deref(),
            Some("x")
        );
    }

    #[test]
    fn blank_attributes_mean_no_default() {
        // Le profil écrit joystick=" " pour « rien sur cette famille ». Le
        // prendre pour un contrôle produirait un jeton `js1_ `, l'anomalie
        // même qu'on rencontre dans les fichiers utilisateur.
        let profile = parse_str(SAMPLE).unwrap();
        let pitch_up = profile.action("spaceship_movement", "v_pitch_up").unwrap();

        assert!(pitch_up.joystick.is_none());
        assert!(pitch_up.gamepad.is_none());
        assert_eq!(pitch_up.keyboard.as_deref(), Some("down"));
    }

    #[test]
    fn tokens_carry_the_device_index_from_the_caller() {
        // Le profil ne stocke que le nom du contrôle : l'index vient de
        // l'appelant, qui seul sait quel manche occupe quelle place.
        let profile = parse_str(SAMPLE).unwrap();
        let pitch = profile.action("spaceship_movement", "v_pitch").unwrap();

        assert_eq!(pitch.token_for("js1").as_deref(), Some("js1_y"));
        assert_eq!(pitch.token_for("js2").as_deref(), Some("js2_y"));
        assert_eq!(pitch.token_for("gp1").as_deref(), Some("gp1_thumbry"));
        // Aucun défaut clavier sur cette action.
        assert!(pitch.token_for("kb1").is_none());
    }

    #[test]
    fn localisation_keys_are_preserved() {
        // Le jeu possède son propre vocabulaire lisible ; c'est la source la
        // plus fiable pour nommer une action.
        let profile = parse_str(SAMPLE).unwrap();
        let pitch = profile.action("spaceship_movement", "v_pitch").unwrap();

        assert_eq!(pitch.ui_label.as_deref(), Some("@ui_CIPitch"));
        assert_eq!(pitch.ui_description.as_deref(), Some("@ui_CIPitchDesc"));
        assert_eq!(
            profile.action_maps[0].ui_label.as_deref(),
            Some("@ui_CGSpaceFlightMovement")
        );
    }

    #[test]
    fn counts_only_actions_with_a_real_default() {
        // `v_pitch_up` compte grâce au clavier, `v_pitch_mouse` grâce à la
        // souris ; aucune action du fragment n'est totalement dépourvue.
        assert_eq!(parse_str(SAMPLE).unwrap().bound_count(), 6);
    }

    #[test]
    fn reads_the_default_activation_mode() {
        // Sans surcharge, c'est la seule source qui dit qu'une esquive est un
        // double-appui : `actionmaps.xml` ne le mentionne que si le joueur y
        // a lui-même touché.
        let profile = parse_str(SAMPLE).unwrap();
        let dodge = profile.action("player", "melee_dodgeLeft").unwrap();
        assert_eq!(
            dodge.activation_mode.as_deref(),
            Some("double_tap_nonblocking")
        );

        // Les actions sans l'attribut n'inventent rien.
        let pitch = profile.action("spaceship_movement", "v_pitch").unwrap();
        assert!(pitch.activation_mode.is_none());
    }

    #[test]
    fn a_user_profile_is_refused() {
        // Les deux schémas se ressemblent assez pour être confondus.
        let err = parse_str("<ActionMaps><ActionProfiles/></ActionMaps>").unwrap_err();
        assert!(matches!(err, Error::Schema(_)));
    }
}
