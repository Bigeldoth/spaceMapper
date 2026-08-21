//! Lecture de `actionmaps.xml` vers le modèle typé.
//!
//! On utilise `roxmltree` parce qu'il conserve les positions dans le source :
//! le linter de l'édition Premium doit pouvoir pointer une ligne précise.
//!
//! Ce parseur est **tolérant par conception**. Un `actionmaps.xml` réel est
//! souvent abîmé — c'est la raison d'être du produit. On conserve donc les
//! valeurs brutes même illisibles plutôt que d'échouer : seul un XML
//! syntaxiquement invalide produit une erreur.

use super::model::*;
use crate::{Error, Result};
use std::path::Path;

pub fn parse_file(path: impl AsRef<Path>) -> Result<ActionMaps> {
    let path = path.as_ref();
    let text = std::fs::read_to_string(path).map_err(|e| Error::io(path, e))?;
    parse_str(&text)
}

pub fn parse_str(text: &str) -> Result<ActionMaps> {
    let doc = roxmltree::Document::parse(text)?;
    let root = doc.root_element();

    if !root.has_tag_name("ActionMaps") {
        return Err(Error::Schema(format!(
            "racine <{}> au lieu de <ActionMaps>",
            root.tag_name().name()
        )));
    }

    // Le contenu utile vit dans <ActionProfiles>. Certains profils exportés
    // l'omettent et placent tout directement sous la racine : on accepte les
    // deux formes plutôt que d'imposer la nôtre.
    let container = root
        .children()
        .find(|n| n.is_element() && n.has_tag_name("ActionProfiles"))
        .unwrap_or(root);

    let mut options = Vec::new();
    let mut device_options = Vec::new();
    let mut declared_devices = Vec::new();
    let mut action_maps = Vec::new();
    let mut header_label = None;
    let mut header_description = None;

    for node in container.children().filter(|n| n.is_element()) {
        match node.tag_name().name() {
            "options" => {
                if let Some(parsed) = parse_options(&node) {
                    options.push(parsed);
                }
            }
            "deviceoptions" => {
                if let Some(parsed) = parse_named_device_options(&node) {
                    device_options.push(parsed);
                }
            }
            "CustomisationUIHeader" => {
                // Le nom que l'auteur a donné à son profil, et sa description.
                // Propres aux exports : c'est ce que le jeu montre dans sa
                // liste de dispositions, et la seule chose qui distingue deux
                // fichiers dont les noms sont cryptiques.
                header_label = attr(&node, "label");
                header_description = attr(&node, "description");
                declared_devices.extend(parse_declared_devices(&node));
            }
            "actionmap" => {
                if let Some(map) = parse_action_map(&doc, &node) {
                    action_maps.push(map);
                }
            }
            _ => {}
        }
    }

    Ok(ActionMaps {
        version: attr(&container, "version"),
        options_version: attr(&container, "optionsVersion"),
        rebind_version: attr(&container, "rebindVersion"),
        profile_name: attr(&container, "profileName"),
        header_label,
        header_description,
        options,
        device_options,
        declared_devices,
        action_maps,
    })
}

fn attr(node: &roxmltree::Node, name: &str) -> Option<String> {
    node.attribute(name).map(str::to_string)
}

fn parse_options(node: &roxmltree::Node) -> Option<DeviceOptions> {
    // Sans `type` ni `instance` exploitables, le bloc ne se rattache à aucun
    // périphérique : mieux vaut l'ignorer que d'inventer un index.
    let device_kind = DeviceKind::from_options_type(node.attribute("type")?)?;
    let instance = node.attribute("instance")?.parse::<u8>().ok()?;
    let product_raw = attr(node, "Product");
    let (product_name, guid) = match product_raw.as_deref() {
        Some(raw) => split_named_guid(raw),
        None => (None, None),
    };

    Some(DeviceOptions {
        device_kind,
        instance,
        product_raw,
        product_name,
        guid,
    })
}

fn parse_named_device_options(node: &roxmltree::Node) -> Option<NamedDeviceOptions> {
    let name_raw = attr(node, "name")?;
    let (name, guid) = split_named_guid(&name_raw);

    let axis_options = node
        .children()
        .filter(|n| n.is_element() && n.has_tag_name("option"))
        .filter_map(|opt| {
            Some(AxisOption {
                input: attr(&opt, "input")?,
                deadzone: opt.attribute("deadzone").and_then(|v| v.parse().ok()),
                saturation: opt.attribute("saturation").and_then(|v| v.parse().ok()),
            })
        })
        .collect();

    Some(NamedDeviceOptions {
        name_raw,
        name,
        guid,
        axis_options,
    })
}

fn parse_declared_devices(header: &roxmltree::Node) -> Vec<DeclaredDevice> {
    header
        .children()
        .filter(|n| n.is_element() && n.has_tag_name("devices"))
        .flat_map(|devices| devices.children().filter(|n| n.is_element()))
        .filter_map(|node| {
            Some(DeclaredDevice {
                device_kind: DeviceKind::from_options_type(node.tag_name().name())?,
                instance: node.attribute("instance")?.parse::<u8>().ok()?,
            })
        })
        .collect()
}

fn parse_action_map(doc: &roxmltree::Document, node: &roxmltree::Node) -> Option<ActionMap> {
    let name = attr(node, "name")?;
    let actions = node
        .children()
        .filter(|n| n.is_element() && n.has_tag_name("action"))
        .filter_map(|action| parse_action(doc, &action))
        .collect();

    Some(ActionMap { name, actions })
}

fn parse_action(doc: &roxmltree::Document, node: &roxmltree::Node) -> Option<Action> {
    let name = attr(node, "name")?;
    let rebinds = node
        .children()
        .filter(|n| n.is_element() && n.has_tag_name("rebind"))
        .map(|rebind| parse_rebind(doc, &rebind))
        .collect();

    Some(Action { name, rebinds })
}

fn parse_rebind(doc: &roxmltree::Document, node: &roxmltree::Node) -> Rebind {
    let input_raw = node.attribute("input").unwrap_or_default().to_string();
    let input = InputBinding::parse(&input_raw);
    let line = doc.text_pos_at(node.range().start).row;

    Rebind {
        input_raw,
        input,
        activation_mode: attr(node, "activationMode"),
        multi_tap: attr(node, "multiTap"),
        line,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Fidèle à la structure d'un `actionmaps.xml` LIVE observé en août 2026.
    const REAL_SHAPE: &str = r#"<ActionMaps>
 <ActionProfiles version="1" optionsVersion="2" rebindVersion="2" profileName="default">
  <deviceoptions name="Mouse">
   <option input="@pause_OptionsMouseSmoothing" saturation="0"/>
  </deviceoptions>
  <deviceoptions name="T.16000M  {B10A044F-0000-0000-0000-504944564944}">
   <option input="x" deadzone="0.098999992"/>
   <option input="rotz" deadzone="0.60390002" saturation="0.79199994"/>
  </deviceoptions>
  <options type="keyboard" instance="1" Product="Clavier  {6F1D2B61-D5A0-11CF-BFC7-444553540000}"/>
  <options type="joystick" instance="1"/>
  <options type="joystick" instance="8"/>
  <modifiers />
  <actionmap name="seat_general">
   <action name="v_toggle_quantum_mode">
    <rebind input="js1_button12"/>
   </action>
   <action name="v_enter_remote_turret_1">
    <rebind input="kb1_lshift+f"/>
   </action>
  </actionmap>
  <actionmap name="spaceship_movement">
   <action name="v_boost">
    <rebind input="js1_rctrl+button10"/>
   </action>
   <action name="v_decoy_launch">
    <rebind input="js1_hat1_down" multiTap="2"/>
   </action>
   <action name="v_unbound_on_js3">
    <rebind input="js3_ " activationMode="press"/>
   </action>
   <action name="v_broken">
    <rebind input="BAD TOKEN"/>
   </action>
  </actionmap>
  <actionmap name="player">
   <action name="v_use"><rebind input="kb1_f"/></action>
  </actionmap>
 </ActionProfiles>
</ActionMaps>
"#;

    #[test]
    fn reads_metadata_from_nested_actionprofiles() {
        // Le piège principal : ces attributs sont sur <ActionProfiles>, pas
        // sur la racine <ActionMaps>.
        let maps = parse_str(REAL_SHAPE).unwrap();
        assert_eq!(maps.profile_name.as_deref(), Some("default"));
        assert_eq!(maps.version.as_deref(), Some("1"));
        assert_eq!(maps.rebind_version.as_deref(), Some("2"));
    }

    #[test]
    fn collects_guids_from_both_sources() {
        let maps = parse_str(REAL_SHAPE).unwrap();
        let guids: Vec<_> = maps.known_guids().iter().map(|g| g.as_str()).collect();

        // Un GUID vient de <options Product=...>, l'autre de <deviceoptions>.
        assert!(guids.contains(&"{6F1D2B61-D5A0-11CF-BFC7-444553540000}"));
        assert!(guids.contains(&"{B10A044F-0000-0000-0000-504944564944}"));
    }

    #[test]
    fn joystick_options_may_carry_no_product() {
        // Cas réel : le slot est déclaré mais rien ne le rattache à un
        // exemplaire physique. C'est la racine du problème d'ordre USB.
        let maps = parse_str(REAL_SHAPE).unwrap();
        let js1 = maps.joystick_options(1).unwrap();
        assert!(js1.product_raw.is_none());
        assert!(js1.guid.is_none());
    }

    #[test]
    fn reads_axis_options() {
        let maps = parse_str(REAL_SHAPE).unwrap();
        let thrustmaster = maps
            .device_options
            .iter()
            .find(|d| d.name.as_deref() == Some("T.16000M"))
            .expect("T.16000M absent");

        let rotz = thrustmaster
            .axis_options
            .iter()
            .find(|o| o.input == "rotz")
            .unwrap();

        // Le jeu écrit plus de décimales qu'un f32 n'en retient. On compare
        // donc au parsing de la chaîne d'origine plutôt qu'à un littéral, qui
        // serait arrondi différemment selon la valeur.
        assert_eq!(rotz.deadzone, "0.60390002".parse::<f32>().ok());
        assert_eq!(rotz.saturation, "0.79199994".parse::<f32>().ok());
    }

    #[test]
    fn parses_rebinds_with_modifiers_and_multitap() {
        let maps = parse_str(REAL_SHAPE).unwrap();

        let boost = maps
            .rebinds()
            .find(|(_, a, _)| a.name == "v_boost")
            .unwrap()
            .2;
        let input = boost.input.as_ref().unwrap();
        assert_eq!(input.modifier.as_deref(), Some("rctrl"));
        assert_eq!(input.control, "button10");

        let decoy = maps
            .rebinds()
            .find(|(_, a, _)| a.name == "v_decoy_launch")
            .unwrap()
            .2;
        assert_eq!(decoy.multi_tap.as_deref(), Some("2"));
    }

    #[test]
    fn blank_control_is_not_reported_as_corruption() {
        // `js3_ ` est la forme normale d'une action non assignée sur un
        // périphérique donné — 325 occurrences sur 403 dans un fichier réel.
        // La signaler comme un défaut noierait l'utilisateur de fausses alertes.
        let maps = parse_str(REAL_SHAPE).unwrap();
        let unbound = maps
            .rebinds()
            .find(|(_, a, _)| a.name == "v_unbound_on_js3")
            .unwrap()
            .2;

        assert!(!unbound.is_corrupt());
        assert!(unbound.is_unbound());
        assert_eq!(unbound.input_raw, "js3_ ");
    }

    #[test]
    fn genuinely_unreadable_input_is_reported() {
        let maps = parse_str(REAL_SHAPE).unwrap();
        let broken = maps
            .rebinds()
            .find(|(_, a, _)| a.name == "v_broken")
            .unwrap()
            .2;

        assert!(broken.is_corrupt());
        assert_eq!(broken.input_raw, "BAD TOKEN");
    }

    #[test]
    fn joystick_instances_in_use_ignores_empty_slots() {
        // Huit slots peuvent être déclarés alors qu'un seul sert vraiment.
        let maps = parse_str(REAL_SHAPE).unwrap();
        assert_eq!(maps.joystick_instances_in_use(), vec![1]);
    }

    #[test]
    fn flight_filter_excludes_on_foot() {
        let maps = parse_str(REAL_SHAPE).unwrap();
        let flight: Vec<_> = maps
            .action_maps
            .iter()
            .filter(|m| m.is_flight())
            .map(|m| m.name.as_str())
            .collect();
        assert_eq!(flight, ["seat_general", "spaceship_movement"]);
    }

    #[test]
    fn tolerates_documents_without_actionprofiles_wrapper() {
        // Certains profils exportés placent tout sous la racine.
        let flat = r#"<ActionMaps profileName="exported">
  <actionmap name="spaceship_weapons">
    <action name="v_attack1"><rebind input="js1_button1" activationMode=""/></action>
  </actionmap>
</ActionMaps>"#;

        let maps = parse_str(flat).unwrap();
        assert_eq!(maps.profile_name.as_deref(), Some("exported"));
        let rebind = maps.rebinds().next().unwrap().2;
        // La chaîne vide est conservée, distincte de l'absence d'attribut.
        assert_eq!(rebind.activation_mode.as_deref(), Some(""));
    }

    #[test]
    fn records_line_numbers_for_diagnostics() {
        let maps = parse_str(REAL_SHAPE).unwrap();
        let quantum = maps
            .rebinds()
            .find(|(_, a, _)| a.name == "v_toggle_quantum_mode")
            .unwrap()
            .2;

        // La position pointe la balise <rebind> elle-même, pas le <action>
        // parent : c'est l'attribut `input` que le linter devra corriger.
        let line = REAL_SHAPE
            .lines()
            .nth(quantum.line as usize - 1)
            .expect("ligne hors du document");
        assert!(
            line.contains("<rebind") && line.contains("js1_button12"),
            "la ligne {} pointe ailleurs: {line:?}",
            quantum.line
        );
    }

    #[test]
    fn rejects_documents_that_are_not_actionmaps() {
        assert!(matches!(
            parse_str("<Nope/>").unwrap_err(),
            Error::Schema(_)
        ));
    }
}
