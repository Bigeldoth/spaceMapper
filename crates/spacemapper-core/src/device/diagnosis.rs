//! Confrontation entre les périphériques nommés dans `actionmaps.xml` et le
//! matériel réellement branché.
//!
//! # Ce que ce module a appris d'un fichier réel
//!
//! Le plan de conception partait du principe que l'*instance GUID* DirectInput
//! est l'identité stable d'un exemplaire, et que le jeu l'écrit dans
//! `actionmaps.xml`. **C'est faux, et le vérifier a changé la conception.**
//!
//! Sur une installation LIVE réelle (août 2026, deux T.16000M) :
//!
//! ```text
//! fichier   <deviceoptions name="T.16000M  {B10A044F-0000-0000-0000-504944564944}">
//! fichier   <deviceoptions name="T.16000M Joystick  {B10A044F-0000-0000-0000-504944564944}">
//! matériel  instance {5724A890-99A1-11F0-8004-444553540000}
//! matériel  produit  {B10A044F-0000-0000-0000-504944564944}
//! ```
//!
//! Trois conséquences, toutes structurantes :
//!
//! 1. Le jeu écrit le **GUID produit**, pas le GUID d'instance. Comparer au
//!    GUID d'instance fait déclarer « absent » un manche posé sur le bureau.
//! 2. Le GUID produit est dérivé du couple VID/PID — son suffixe est
//!    littéralement `PIDVID` en ASCII. **Deux exemplaires du même modèle le
//!    partagent.** Or deux manches identiques, c'est la configuration HOSAS la
//!    plus répandue. Le GUID ne peut donc pas, à lui seul, réparer l'ordre des
//!    périphériques : c'est une limite du format, pas de l'outil.
//! 3. Les huit `<options type="joystick" instance="N"/>` du fichier réel sont
//!    **nus** : aucun attribut `Product`. Rien, dans le fichier, ne rattache
//!    `js1_` ou `js2_` à un exemplaire physique. C'est la cause racine de
//!    l'inversion des manches, et elle est visible noir sur blanc.
//!
//! Ce module se contente donc de **constater**. Il ne devine pas quel manche
//! le jeu appellera `js1` : il montre ce que le fichier dit, ce qui est
//! branché, et où les deux ne se recoupent pas.

use super::{DeviceCategory, DeviceGuid, InputDevice};
use crate::actionmaps::{ActionMaps, DeviceKind};
use serde::{Deserialize, Serialize};

/// Nature d'un GUID DirectInput, déduite de son suffixe.
///
/// DirectInput fabrique ces GUID selon deux recettes distinctes et repérables,
/// dont la confusion est exactement l'erreur que ce module documente.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GuidKind {
    /// Suffixe `504944564944` — « PIDVID » en ASCII. Dérivé du couple VID/PID,
    /// donc **commun à tous les exemplaires d'un même modèle**.
    Product,
    /// Suffixe `444553540000` — « DEST » en ASCII. Généré par DirectInput pour
    /// un exemplaire donné sur une machine donnée.
    Instance,
    /// GUID système fixe (clavier, souris) ou forme inattendue.
    Other,
}

impl GuidKind {
    pub fn of(guid: &DeviceGuid) -> Self {
        // Le suffixe est le dernier groupe du GUID, avant l'accolade fermante.
        let s = guid.as_str();
        if s.ends_with("504944564944}") {
            GuidKind::Product
        } else if s.ends_with("444553540000}") {
            GuidKind::Instance
        } else {
            GuidKind::Other
        }
    }
}

/// Un périphérique branché, tel que l'énumération le rapporte.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LiveDevice {
    pub product_name: String,
    pub instance_name: String,
    pub product_guid: String,
    pub instance_guid: String,
    pub category: DeviceCategory,
    pub axes: u32,
    pub buttons: u32,
    pub povs: u32,
    /// Rang parmi les périphériques de la même famille, à partir de 1.
    ///
    /// C'est le numéro que le jeu utilise vraisemblablement pour `jsN_` — il
    /// numérote dans l'ordre d'énumération. « Vraisemblablement » est délibéré :
    /// l'ordre exact retenu par le client n'est pas documenté, et l'outil ne
    /// prétend pas le connaître.
    pub rank: u8,
    /// Ce périphérique est-il nommé quelque part dans le fichier ?
    pub declared_in_file: bool,
}

/// Un périphérique nommé dans le fichier, via `<deviceoptions>` ou
/// `<options Product="...">`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DeclaredDevice {
    pub name: String,
    pub guid: Option<String>,
    pub guid_kind: Option<GuidKind>,
    /// Nombre de périphériques branchés partageant ce GUID produit.
    ///
    /// `0` = rien de compatible n'est branché. `2` ou plus = le GUID ne suffit
    /// pas à désigner un exemplaire.
    pub matching_devices: usize,
}

/// Un emplacement `jsN` porteur d'assignations.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SlotUsage {
    pub instance: u8,
    /// Assignations exploitables visant ce slot.
    pub bindings: usize,
    /// Le bloc `<options>` de ce slot nomme-t-il un périphérique ?
    pub named: bool,
}

/// Un constat, destiné à être affiché tel quel à l'utilisateur.
///
/// Un code plutôt qu'une phrase : la formulation dépend de la langue de
/// l'interface, que le cœur de lecture n'a pas à connaître.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Finding {
    /// Des slots portent des assignations sans que le fichier dise à quel
    /// exemplaire ils s'adressent. Cause racine de l'inversion des manches.
    AnonymousSlots { instances: Vec<u8> },
    /// Plusieurs exemplaires branchés partagent un même GUID produit.
    AmbiguousModel { product_name: String, count: usize },
    /// Le fichier nomme un périphérique dont aucun modèle n'est branché.
    DeclaredButAbsent { name: String },
    /// Un manche est branché mais aucune assignation ne le vise.
    PluggedButUnused { name: String },
    /// Le fichier vise plus de slots qu'il n'y a de manches branchés.
    MoreSlotsThanDevices { slots: usize, devices: usize },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Diagnosis {
    pub live: Vec<LiveDevice>,
    pub declared: Vec<DeclaredDevice>,
    pub slots: Vec<SlotUsage>,
    pub findings: Vec<Finding>,
}

/// Confronte un fichier au matériel branché.
///
/// Fonction pure : tout le comportement est testable avec un `FakeEnumerator`,
/// sans matériel.
pub fn diagnose(maps: &ActionMaps, devices: &[InputDevice]) -> Diagnosis {
    let live = live_devices(maps, devices);
    let declared = declared_devices(maps, devices);
    let slots = slot_usage(maps);
    let findings = findings(&live, &declared, &slots);

    Diagnosis {
        live,
        declared,
        slots,
        findings,
    }
}

fn live_devices(maps: &ActionMaps, devices: &[InputDevice]) -> Vec<LiveDevice> {
    let file_guids: Vec<&DeviceGuid> = maps.known_guids();

    let mut ranks: std::collections::HashMap<DeviceCategory, u8> = std::collections::HashMap::new();

    devices
        .iter()
        .map(|d| {
            // Le rang se compte par famille : un gamepad ne consomme pas un
            // numéro de joystick, puisque le jeu les préfixe différemment.
            let rank = ranks.entry(d.category).or_insert(0);
            *rank += 1;

            LiveDevice {
                product_name: d.product_name.clone(),
                instance_name: d.instance_name.clone(),
                product_guid: d.product_guid.to_string(),
                instance_guid: d.instance_guid.to_string(),
                category: d.category,
                axes: d.capabilities.axes,
                buttons: d.capabilities.buttons,
                povs: d.capabilities.povs,
                rank: *rank,
                // On compare au GUID **produit** : c'est celui que le jeu écrit.
                declared_in_file: file_guids.iter().any(|g| **g == d.product_guid),
            }
        })
        .collect()
}

fn declared_devices(maps: &ActionMaps, devices: &[InputDevice]) -> Vec<DeclaredDevice> {
    let mut out = Vec::new();

    // Les deux sources d'identité du fichier, traitées à égalité : le client
    // écrit tantôt dans l'une, tantôt dans l'autre.
    let from_options = maps
        .options
        .iter()
        .filter(|o| o.device_kind == DeviceKind::Joystick)
        .filter_map(|o| o.product_name.clone().map(|name| (name, o.guid.clone())));

    // `<deviceoptions>` ne dit pas de quelle famille il parle. On s'appuie sur
    // la forme du GUID : seul un GUID produit désigne un contrôleur de jeu.
    // Cela écarte d'office `name="Mouse"` (sans GUID) et le clavier, dont le
    // GUID système partage pourtant le suffixe des GUID d'instance.
    let from_device_options = maps
        .device_options
        .iter()
        .filter(|d| d.guid.as_ref().map(GuidKind::of) == Some(GuidKind::Product))
        .map(|d| {
            (
                d.name.clone().unwrap_or_else(|| d.name_raw.clone()),
                d.guid.clone(),
            )
        });

    for (name, guid) in from_options.chain(from_device_options) {
        let matching = match &guid {
            Some(g) => devices.iter().filter(|d| &d.product_guid == g).count(),
            None => 0,
        };

        out.push(DeclaredDevice {
            name,
            guid: guid.as_ref().map(|g| g.to_string()),
            guid_kind: guid.as_ref().map(GuidKind::of),
            matching_devices: matching,
        });
    }

    out
}

fn slot_usage(maps: &ActionMaps) -> Vec<SlotUsage> {
    maps.joystick_instances_in_use()
        .into_iter()
        .map(|instance| {
            let bindings = maps
                .rebinds()
                .filter_map(|(_, _, r)| r.input.as_ref())
                .filter(|i| i.device_kind == DeviceKind::Joystick && i.instance == instance)
                .count();

            let named = maps
                .joystick_options(instance)
                .is_some_and(|o| o.product_raw.is_some());

            SlotUsage {
                instance,
                bindings,
                named,
            }
        })
        .collect()
}

fn findings(live: &[LiveDevice], declared: &[DeclaredDevice], slots: &[SlotUsage]) -> Vec<Finding> {
    let mut out = Vec::new();

    let anonymous: Vec<u8> = slots.iter().filter(|s| !s.named).map(|s| s.instance).collect();
    if !anonymous.is_empty() {
        out.push(Finding::AnonymousSlots {
            instances: anonymous,
        });
    }

    // Ambiguïté de modèle : plusieurs exemplaires branchés, un seul GUID.
    let mut seen: Vec<&str> = Vec::new();
    for d in live.iter().filter(|d| d.category == DeviceCategory::Joystick) {
        if seen.contains(&d.product_guid.as_str()) {
            continue;
        }
        seen.push(&d.product_guid);
        let count = live
            .iter()
            .filter(|o| o.product_guid == d.product_guid && o.category == DeviceCategory::Joystick)
            .count();
        if count > 1 {
            out.push(Finding::AmbiguousModel {
                product_name: d.product_name.clone(),
                count,
            });
        }
    }

    for d in declared.iter().filter(|d| d.matching_devices == 0) {
        out.push(Finding::DeclaredButAbsent {
            name: d.name.clone(),
        });
    }

    let joysticks: Vec<&LiveDevice> = live
        .iter()
        .filter(|d| d.category == DeviceCategory::Joystick)
        .collect();

    for d in joysticks.iter().filter(|d| !d.declared_in_file) {
        out.push(Finding::PluggedButUnused {
            name: d.product_name.clone(),
        });
    }

    if slots.len() > joysticks.len() {
        out.push(Finding::MoreSlotsThanDevices {
            slots: slots.len(),
            devices: joysticks.len(),
        });
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::actionmaps;
    use crate::device::{DeviceCapabilities, DeviceGuid};

    /// GUID produit d'un T.16000M, relevé sur du matériel réel.
    const T16000: &str = "{B10A044F-0000-0000-0000-504944564944}";
    /// GUID d'instance du même exemplaire, généré par DirectInput.
    const T16000_INSTANCE: &str = "{5724A890-99A1-11F0-8004-444553540000}";

    fn stick(product_name: &str, instance_name: &str, product: &str, instance: &str) -> InputDevice {
        InputDevice {
            instance_guid: DeviceGuid::parse(instance).unwrap(),
            product_guid: DeviceGuid::parse(product).unwrap(),
            product_name: product_name.into(),
            instance_name: instance_name.into(),
            category: DeviceCategory::Joystick,
            capabilities: DeviceCapabilities::default(),
        }
    }

    /// Calqué sur le fichier LIVE réel : slots joystick **nus**, identités
    /// reléguées dans `<deviceoptions>`, et le même GUID pour les deux manches.
    const REAL_SHAPE: &str = r#"<ActionMaps>
 <ActionProfiles profileName="default">
  <deviceoptions name="T.16000M  {B10A044F-0000-0000-0000-504944564944}">
   <option input="x" deadzone="0.02"/>
  </deviceoptions>
  <deviceoptions name="T.16000M Joystick  {B10A044F-0000-0000-0000-504944564944}">
   <option input="y" deadzone="0.02"/>
  </deviceoptions>
  <options type="joystick" instance="1"/>
  <options type="joystick" instance="2"/>
  <actionmap name="spaceship_movement">
   <action name="v_pitch"><rebind input="js1_y"/></action>
   <action name="v_yaw"><rebind input="js2_x"/></action>
   <action name="v_roll"><rebind input="js2_rotz"/></action>
   <action name="v_ignore"><rebind input="js3_ "/></action>
  </actionmap>
 </ActionProfiles>
</ActionMaps>"#;

    #[test]
    fn guid_kind_separates_the_two_directinput_recipes() {
        // La distinction dont la méconnaissance faisait déclarer « absent » un
        // manche branché.
        let product = DeviceGuid::parse(T16000).unwrap();
        let instance = DeviceGuid::parse(T16000_INSTANCE).unwrap();
        assert_eq!(GuidKind::of(&product), GuidKind::Product);
        assert_eq!(GuidKind::of(&instance), GuidKind::Instance);

        // `GUID_SysKeyboard` partage le suffixe des GUID d'instance : le
        // suffixe seul ne suffit donc pas à écarter le clavier, et c'est
        // pourquoi `declared_devices` ne retient que les GUID *produit*.
        let keyboard = DeviceGuid::parse("{6F1D2B61-D5A0-11CF-BFC7-444553540000}").unwrap();
        assert_eq!(GuidKind::of(&keyboard), GuidKind::Instance);
    }

    #[test]
    fn a_plugged_stick_is_matched_on_its_product_guid() {
        let maps = actionmaps::parse_str(REAL_SHAPE).unwrap();
        let devices = vec![stick("T.16000M", "T.16000M", T16000, T16000_INSTANCE)];

        let d = diagnose(&maps, &devices);

        // Le test de non-régression du bug : comparer au GUID d'instance
        // donnerait `false` ici, et l'interface annoncerait un manche absent.
        assert!(d.live[0].declared_in_file);
        assert!(d.declared.iter().all(|x| x.matching_devices == 1));
        assert!(!d
            .findings
            .iter()
            .any(|f| matches!(f, Finding::DeclaredButAbsent { .. })));
    }

    #[test]
    fn two_identical_sticks_are_reported_as_indistinguishable() {
        let maps = actionmaps::parse_str(REAL_SHAPE).unwrap();
        // Windows suffixe le second exemplaire ; le GUID, lui, est identique.
        let devices = vec![
            stick("T.16000M", "T.16000M", T16000, T16000_INSTANCE),
            stick(
                "T.16000M",
                "T.16000M Joystick",
                T16000,
                "{5724A890-99A1-11F0-8005-444553540000}",
            ),
        ];

        let d = diagnose(&maps, &devices);

        assert!(d.findings.iter().any(|f| matches!(
            f,
            Finding::AmbiguousModel { count: 2, .. }
        )));
        // Chaque déclaration correspond aux *deux* exemplaires : c'est bien
        // l'ambiguïté qui est constatée, pas une correspondance.
        assert!(d.declared.iter().all(|x| x.matching_devices == 2));
    }

    #[test]
    fn anonymous_slots_are_the_headline_finding() {
        let maps = actionmaps::parse_str(REAL_SHAPE).unwrap();
        let devices = vec![stick("T.16000M", "T.16000M", T16000, T16000_INSTANCE)];

        let d = diagnose(&maps, &devices);

        // js1 et js2 portent des assignations et ne nomment personne.
        let anonymous = d
            .findings
            .iter()
            .find_map(|f| match f {
                Finding::AnonymousSlots { instances } => Some(instances.clone()),
                _ => None,
            })
            .expect("les slots nus doivent être signalés");
        assert_eq!(anonymous, vec![1, 2]);
    }

    #[test]
    fn slot_usage_counts_only_usable_bindings() {
        let maps = actionmaps::parse_str(REAL_SHAPE).unwrap();
        let d = diagnose(&maps, &[]);

        // `js3_ ` n'est pas une assignation : le slot 3 n'existe pas ici.
        assert_eq!(d.slots.len(), 2);
        assert_eq!(d.slots[0].instance, 1);
        assert_eq!(d.slots[0].bindings, 1);
        assert_eq!(d.slots[1].instance, 2);
        assert_eq!(d.slots[1].bindings, 2);
    }

    #[test]
    fn ranks_are_counted_per_family() {
        let maps = actionmaps::parse_str(REAL_SHAPE).unwrap();
        let mut pad = stick("Controller", "Controller", T16000, T16000_INSTANCE);
        pad.category = DeviceCategory::Gamepad;
        // La manette est énumérée en premier, comme sur la machine de test.
        let devices = vec![
            pad,
            stick("T.16000M", "T.16000M", T16000, T16000_INSTANCE),
        ];

        let d = diagnose(&maps, &devices);

        // Le manche reste `js1` : la manette occupe `gp1`, pas un slot joystick.
        assert_eq!(d.live[0].rank, 1);
        assert_eq!(d.live[1].rank, 1);
        assert_eq!(d.live[1].category, DeviceCategory::Joystick);
    }

    #[test]
    fn an_unplugged_declaration_is_reported_absent() {
        let maps = actionmaps::parse_str(REAL_SHAPE).unwrap();
        let d = diagnose(&maps, &[]);

        let absent = d
            .findings
            .iter()
            .filter(|f| matches!(f, Finding::DeclaredButAbsent { .. }))
            .count();
        assert_eq!(absent, 2);
        assert!(d.findings.iter().any(|f| matches!(
            f,
            Finding::MoreSlotsThanDevices {
                slots: 2,
                devices: 0
            }
        )));
    }
}
