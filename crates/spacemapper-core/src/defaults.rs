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

use crate::triggers::{self, TriggerAttributes};
use crate::{actionmaps::DeviceKind, Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Un profil par défaut décodé.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DefaultProfile {
    pub version: Option<String>,
    pub action_maps: Vec<DefaultActionMap>,
    #[serde(default)]
    pub activation_modes: BTreeMap<String, TriggerAttributes>,
}

impl DefaultProfile {
    pub fn resolve_trigger_attributes(
        &self,
        mode: Option<&str>,
        attributes: &TriggerAttributes,
    ) -> TriggerAttributes {
        triggers::resolve(&self.activation_modes, mode, attributes)
    }
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
    /// Modes propres aux familles, définis par les balises enfants du jeu.
    /// Ils s'appliquent même si aucun contrôle par défaut n'est associé.
    #[serde(default)]
    pub device_activation_modes: DeviceActivationModes,
    /// Attributs déclarés sur l'action, sans expansion du mode nommé.
    #[serde(default)]
    pub trigger_attributes: TriggerAttributes,
    /// Attributs explicites action + famille, y compris sans contrôle lié.
    #[serde(default)]
    pub device_trigger_attributes: BTreeMap<String, TriggerAttributes>,
    /// Les mêmes attributs, après expansion des modes du profil.
    #[serde(default)]
    pub resolved_trigger_attributes: BTreeMap<String, TriggerAttributes>,
    /// Toutes les entrées, y compris les contrôles des balises enfants.
    #[serde(default)]
    pub inputs: Vec<DefaultInput>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DefaultInput {
    pub device_kind: DeviceKind,
    pub control: String,
    pub activation_mode: Option<String>,
    pub trigger_attributes: TriggerAttributes,
    pub explicit_trigger_attributes: TriggerAttributes,
}

fn family_name(kind: DeviceKind) -> &'static str {
    match kind {
        DeviceKind::Keyboard => "keyboard",
        DeviceKind::Mouse => "mouse",
        DeviceKind::Joystick => "joystick",
        DeviceKind::Gamepad => "gamepad",
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct DeviceActivationModes {
    pub keyboard: Option<String>,
    pub mouse: Option<String>,
    pub joystick: Option<String>,
    pub gamepad: Option<String>,
}

impl DefaultAction {
    pub fn explicit_trigger_attributes_for(&self, kind: DeviceKind) -> TriggerAttributes {
        self.device_trigger_attributes
            .get(family_name(kind))
            .cloned()
            .unwrap_or_else(|| self.trigger_attributes.clone())
    }

    pub fn trigger_attributes_for(&self, kind: DeviceKind) -> TriggerAttributes {
        self.resolved_trigger_attributes
            .get(family_name(kind))
            .cloned()
            .unwrap_or_else(|| self.explicit_trigger_attributes_for(kind))
    }

    /// Une valeur par déclaration réelle, sans perdre les alternatives
    /// imbriquées. Le repli garde utilisables les anciens objets sérialisés.
    pub fn inputs_for(&self, kind: DeviceKind) -> Vec<DefaultInput> {
        let inputs: Vec<_> = self
            .inputs
            .iter()
            .filter(|input| input.device_kind == kind)
            .cloned()
            .collect();
        if !inputs.is_empty() {
            return inputs;
        }
        let control = match kind {
            DeviceKind::Keyboard => self.keyboard.as_ref(),
            DeviceKind::Mouse => self.mouse.as_ref(),
            DeviceKind::Joystick => self.joystick.as_ref(),
            DeviceKind::Gamepad => self.gamepad.as_ref(),
        };
        control
            .map(|control| {
                vec![DefaultInput {
                    device_kind: kind,
                    control: control.clone(),
                    activation_mode: self.activation_mode_for(kind).map(str::to_string),
                    trigger_attributes: self.trigger_attributes_for(kind),
                    explicit_trigger_attributes: self.explicit_trigger_attributes_for(kind),
                }]
            })
            .unwrap_or_default()
    }
    /// Une famille peut préciser son propre mode ; sinon celui de l'action
    /// reste actif, y compris sur un contrôle ajouté par le joueur.
    pub fn activation_mode_for(&self, device_kind: DeviceKind) -> Option<&str> {
        let device_mode = match device_kind {
            DeviceKind::Keyboard => &self.device_activation_modes.keyboard,
            DeviceKind::Mouse => &self.device_activation_modes.mouse,
            DeviceKind::Joystick => &self.device_activation_modes.joystick,
            DeviceKind::Gamepad => &self.device_activation_modes.gamepad,
        };
        device_mode.as_deref().or(self.activation_mode.as_deref())
    }

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

    let activation_modes: BTreeMap<String, TriggerAttributes> = root
        .children()
        .filter(|node| {
            node.is_element()
                && node
                    .tag_name()
                    .name()
                    .eq_ignore_ascii_case("ActivationModes")
        })
        .flat_map(|node| node.children())
        .filter(|node| {
            node.is_element()
                && node
                    .tag_name()
                    .name()
                    .eq_ignore_ascii_case("ActivationMode")
        })
        .filter_map(|node| {
            Some((
                node.attribute("name")?.to_string(),
                triggers::attributes_of(&node),
            ))
        })
        .collect();

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
                    .filter_map(|action| parse_action(&action, &activation_modes))
                    .collect(),
            })
        })
        .collect();

    Ok(DefaultProfile {
        version: attr(&root, "version"),
        action_maps,
        activation_modes,
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

fn declared_attributes(node: &roxmltree::Node<'_, '_>) -> TriggerAttributes {
    let mut attributes = triggers::attributes_of(node);
    // Dans les défauts, un mode blanc ne remplace pas celui du parent.
    if attributes
        .get("activationMode")
        .is_some_and(|value| value.trim().is_empty())
    {
        attributes.remove("activationMode");
    }
    attributes
}

fn parse_action(
    node: &roxmltree::Node<'_, '_>,
    definitions: &BTreeMap<String, TriggerAttributes>,
) -> Option<DefaultAction> {
    let action_attributes = declared_attributes(node);
    let mut action = DefaultAction {
        name: node.attribute("name")?.to_string(),
        ui_label: attr(node, "UILabel"),
        ui_description: attr(node, "UIDescription"),
        activation_mode: action_attributes.get("activationMode").cloned(),
        trigger_attributes: action_attributes.clone(),
        ..DefaultAction::default()
    };
    for kind in [
        DeviceKind::Keyboard,
        DeviceKind::Mouse,
        DeviceKind::Joystick,
        DeviceKind::Gamepad,
    ] {
        let family = family_name(kind);
        let family_node = node
            .children()
            .find(|child| child.is_element() && child.has_tag_name(family));
        let mut attributes = action_attributes.clone();
        let own_family_attributes = family_node
            .map(|child| declared_attributes(&child))
            .unwrap_or_default();
        let family_mode = own_family_attributes.get("activationMode").cloned();
        attributes.extend(own_family_attributes);
        match kind {
            DeviceKind::Keyboard => action.device_activation_modes.keyboard = family_mode,
            DeviceKind::Mouse => action.device_activation_modes.mouse = family_mode,
            DeviceKind::Joystick => action.device_activation_modes.joystick = family_mode,
            DeviceKind::Gamepad => action.device_activation_modes.gamepad = family_mode,
        }
        action
            .device_trigger_attributes
            .insert(family.to_string(), attributes.clone());
        action.resolved_trigger_attributes.insert(
            family.to_string(),
            triggers::resolve(definitions, None, &attributes),
        );

        let mut add_input = |control: String, explicit: TriggerAttributes| {
            let input = DefaultInput {
                device_kind: kind,
                control,
                activation_mode: explicit.get("activationMode").cloned(),
                trigger_attributes: triggers::resolve(definitions, None, &explicit),
                explicit_trigger_attributes: explicit,
            };
            if !action.inputs.contains(&input) {
                action.inputs.push(input);
            }
        };
        if let Some(control) = attr(node, family) {
            add_input(control, attributes.clone());
        }
        if let Some(family_node) = family_node {
            for input_node in family_node.descendants().filter(|child| child.is_element()) {
                let Some(control) = attr(&input_node, "input") else {
                    continue;
                };
                let mut explicit = attributes.clone();
                let mut ancestors: Vec<_> = input_node
                    .ancestors()
                    .take_while(|ancestor| *ancestor != family_node)
                    .collect();
                ancestors.reverse();
                for ancestor in ancestors {
                    explicit.extend(declared_attributes(&ancestor));
                }
                add_input(control, explicit);
            }
        }
        let first_control = action
            .inputs
            .iter()
            .find(|input| input.device_kind == kind)
            .map(|input| input.control.clone());
        match kind {
            DeviceKind::Keyboard => action.keyboard = first_control,
            DeviceKind::Mouse => action.mouse = first_control,
            DeviceKind::Joystick => action.joystick = first_control,
            DeviceKind::Gamepad => action.gamepad = first_control,
        }
    }
    Some(action)
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

    #[test]
    fn action_activation_applies_without_a_default_control_on_the_family() {
        let profile = parse_str(
            r#"<profile><actionmap name="spaceship_general">
             <action name="v_self_destruct" activationMode="delayed_press_medium"
                     keyboard="backspace" joystick=" "/>
            </actionmap></profile>"#,
        )
        .unwrap();
        let action = profile
            .action("spaceship_general", "v_self_destruct")
            .unwrap();
        assert!(action.joystick.is_none());
        for family in [
            DeviceKind::Keyboard,
            DeviceKind::Mouse,
            DeviceKind::Joystick,
            DeviceKind::Gamepad,
        ] {
            assert_eq!(
                action.activation_mode_for(family),
                Some("delayed_press_medium")
            );
        }
    }

    #[test]
    fn device_activation_overrides_only_its_family_even_with_blank_input() {
        let profile = parse_str(
            r#"<profile><actionmap name="player">
             <action name="mixed" activationMode="tap" keyboard="a">
              <gamepad input=" " activationMode="hold"/>
             </action>
             <action name="per_device">
              <keyboard input=" " activationMode="double_tap"/>
              <mouse activationMode="delayed_press"/>
              <joystick input=" " activationMode="press"/>
              <gamepad input="button1" activationMode="tap"/>
             </action>
             <action name="empty_mode" activationMode="press">
              <gamepad activationMode=" "/>
             </action>
            </actionmap></profile>"#,
        )
        .unwrap();
        let mixed = profile.action("player", "mixed").unwrap();
        assert_eq!(mixed.activation_mode_for(DeviceKind::Gamepad), Some("hold"));
        for family in [
            DeviceKind::Keyboard,
            DeviceKind::Mouse,
            DeviceKind::Joystick,
        ] {
            assert_eq!(mixed.activation_mode_for(family), Some("tap"));
        }
        assert!(mixed.gamepad.is_none());

        let per_device = profile.action("player", "per_device").unwrap();
        for (family, expected) in [
            (DeviceKind::Keyboard, "double_tap"),
            (DeviceKind::Mouse, "delayed_press"),
            (DeviceKind::Joystick, "press"),
            (DeviceKind::Gamepad, "tap"),
        ] {
            assert_eq!(per_device.activation_mode_for(family), Some(expected));
        }
        // Le contrôle réellement déclaré dans la balise enfant reste présent.
        assert!(per_device.has_any_default());
        assert_eq!(per_device.gamepad.as_deref(), Some("button1"));
        assert!(per_device.keyboard.is_none());
        assert_eq!(
            profile
                .action("player", "empty_mode")
                .unwrap()
                .activation_mode_for(DeviceKind::Gamepad),
            Some("press")
        );
    }

    #[test]
    fn older_serialized_actions_keep_the_action_activation_fallback() {
        let action: DefaultAction = serde_json::from_str(
            r#"{"name":"v_self_destruct","activation_mode":"delayed_press_medium"}"#,
        )
        .unwrap();
        assert_eq!(
            action.device_activation_modes,
            DeviceActivationModes::default()
        );
        assert_eq!(
            action.activation_mode_for(DeviceKind::Joystick),
            Some("delayed_press_medium")
        );
        assert_eq!(
            DefaultAction::default().activation_mode_for(DeviceKind::Gamepad),
            None
        );
    }

    const TRIGGERS: &str = r#"<profile><ActivationModes>
      <ActivationMode name="press" onPress="1" onHold="0" onRelease="0" multiTap="1" pressTriggerThreshold="-1"/>
      <ActivationMode name="double_tap" onPress="1" onHold="0" onRelease="0" multiTap="2" pressTriggerThreshold="-1"/>
      <ActivationMode name="delayed_press" onPress="1" onHold="0" onRelease="0" multiTap="1" pressTriggerThreshold="0.25"/>
      <ActivationMode name="delayed_press_medium" onPress="1" onHold="0" onRelease="0" multiTap="1" pressTriggerThreshold="0.5"/>
    </ActivationModes><actionmap name="test">
      <action name="destruct" ActivationMode="delayed_press_medium" keyboard="backspace" joystick=" "/>
      <action name="power_max" onHold="1" holdTriggerDelay="0.25" keyboard="f5"/>
      <action name="family" activationMode="delayed_press" multiTap="3" keyboard="a">
        <gamepad input=" " activationmode="double_tap" multiTap="2"/>
      </action>
      <action name="nested" activationMode="press" keyboard="enter">
        <keyboard>
          <inputdata input="enter"/>
          <binding holdTriggerDelay="0.5"><input input="np_enter" activationMode="double_tap" multiTap="4"/></binding>
        </keyboard>
      </action>
      <action name="canonical" activationMode="press" ActivationMode="double_tap" keyboard="b"/>
    </actionmap></profile>"#;

    #[test]
    fn named_modes_and_inline_hold_delays_are_resolved_without_losing_family_overrides() {
        let profile = parse_str(TRIGGERS).unwrap();
        assert_eq!(profile.activation_modes.len(), 4);
        let destruct = profile.action("test", "destruct").unwrap();
        assert_eq!(
            destruct.activation_mode_for(DeviceKind::Joystick),
            Some("delayed_press_medium")
        );
        assert_eq!(
            destruct.trigger_attributes_for(DeviceKind::Joystick)["pressTriggerThreshold"],
            "0.5"
        );
        let power = profile.action("test", "power_max").unwrap();
        assert_eq!(
            power.trigger_attributes_for(DeviceKind::Keyboard)["holdTriggerDelay"],
            "0.25"
        );
        assert_eq!(
            power.trigger_attributes_for(DeviceKind::Keyboard)["onHold"],
            "1"
        );
        let family = profile.action("test", "family").unwrap();
        let keyboard = family.trigger_attributes_for(DeviceKind::Keyboard);
        let gamepad = family.trigger_attributes_for(DeviceKind::Gamepad);
        assert_eq!(keyboard["pressTriggerThreshold"], "0.25");
        assert_eq!(keyboard["multiTap"], "3");
        assert_eq!(gamepad["pressTriggerThreshold"], "-1");
        assert_eq!(gamepad["multiTap"], "2");
        assert!(family.inputs_for(DeviceKind::Gamepad).is_empty());
    }

    #[test]
    fn nested_inputs_keep_each_control_and_its_own_activation_attributes() {
        let profile = parse_str(TRIGGERS).unwrap();
        let action = profile.action("test", "nested").unwrap();
        let inputs = action.inputs_for(DeviceKind::Keyboard);
        assert_eq!(inputs.len(), 2); // The repeated enter declaration is identical.
        assert_eq!(inputs[0].control, "enter");
        assert_eq!(inputs[0].trigger_attributes["multiTap"], "1");
        assert_eq!(inputs[1].control, "np_enter");
        assert_eq!(inputs[1].activation_mode.as_deref(), Some("double_tap"));
        assert_eq!(inputs[1].trigger_attributes["multiTap"], "4");
        assert_eq!(inputs[1].trigger_attributes["holdTriggerDelay"], "0.5");
        assert!(!action
            .trigger_attributes_for(DeviceKind::Keyboard)
            .contains_key("holdTriggerDelay"));
    }

    #[test]
    fn override_mode_replaces_the_old_expansion_and_preserves_explicit_values() {
        let profile = parse_str(TRIGGERS).unwrap();
        let action = profile.action("test", "destruct").unwrap();
        let overrides = crate::actionmaps::parse_str(r#"<ActionMaps><actionmap name="test">
            <action name="destruct"><rebind input="js2_button5" activationMode="double_tap" multiTap="3" holdTriggerDelay="0.75"/></action>
        </actionmap></ActionMaps>"#).unwrap();
        let rebind = &overrides.action_maps[0].actions[0].rebinds[0];
        let mut explicit = action.explicit_trigger_attributes_for(DeviceKind::Joystick);
        explicit.extend(rebind.trigger_attributes.clone());
        let resolved =
            profile.resolve_trigger_attributes(rebind.activation_mode.as_deref(), &explicit);
        assert_eq!(resolved["activationMode"], "double_tap");
        assert_eq!(resolved["pressTriggerThreshold"], "-1");
        assert_eq!(resolved["multiTap"], "3");
        assert_eq!(resolved["holdTriggerDelay"], "0.75");
        let inherited = profile.resolve_trigger_attributes(
            None,
            &action.explicit_trigger_attributes_for(DeviceKind::Joystick),
        );
        assert_eq!(inherited["pressTriggerThreshold"], "0.5");
    }

    #[test]
    fn canonical_mode_attribute_wins_over_case_aliases() {
        let profile = parse_str(TRIGGERS).unwrap();
        let action = profile.action("test", "canonical").unwrap();
        assert_eq!(action.activation_mode.as_deref(), Some("press"));
        assert_eq!(
            action.trigger_attributes_for(DeviceKind::Keyboard)["multiTap"],
            "1"
        );
    }
}
