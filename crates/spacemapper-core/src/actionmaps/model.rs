//! Modèle typé de `actionmaps.xml`.
//!
//! Ce modèle est calqué sur un fichier **réel** produit par le client Star
//! Citizen (LIVE, août 2026), pas sur une reconstitution. Deux détails
//! comptent et sont contre-intuitifs :
//!
//! 1. La racine `<ActionMaps>` ne porte aucun attribut ; tout est imbriqué
//!    dans un `<ActionProfiles>` qui, lui, porte `profileName` et les versions.
//! 2. Les GUID des joysticks n'apparaissent pas forcément dans `<options>`.
//!    Le client les écrit dans `<deviceoptions name="NOM  {GUID}">` dès qu'un
//!    axe a été réglé, et laisse souvent `<options type="joystick"/>` nu.
//!    Il faut donc lire les deux sources.

use crate::device::DeviceGuid;
use serde::{Deserialize, Serialize};

/// Racine du document.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ActionMaps {
    pub version: Option<String>,
    pub options_version: Option<String>,
    pub rebind_version: Option<String>,
    pub profile_name: Option<String>,
    /// Blocs `<options type="..." instance="N">`.
    pub options: Vec<DeviceOptions>,
    /// Blocs `<deviceoptions name="NOM  {GUID}">` : réglages d'axes, et
    /// surtout seconde source de GUID.
    pub device_options: Vec<NamedDeviceOptions>,
    /// Présent dans les profils *exportés* (`layout_*.xml`), absent du
    /// `actionmaps.xml` vivant.
    pub declared_devices: Vec<DeclaredDevice>,
    pub action_maps: Vec<ActionMap>,
}

impl ActionMaps {
    pub fn joystick_options(&self, instance: u8) -> Option<&DeviceOptions> {
        self.options
            .iter()
            .find(|o| o.device_kind == DeviceKind::Joystick && o.instance == instance)
    }

    /// Toutes les assignations, aplaties, dans l'ordre du fichier.
    pub fn rebinds(&self) -> impl Iterator<Item = (&ActionMap, &Action, &Rebind)> {
        self.action_maps.iter().flat_map(|map| {
            map.actions
                .iter()
                .flat_map(move |action| action.rebinds.iter().map(move |r| (map, action, r)))
        })
    }

    /// Tous les GUID connus du document, quelle que soit leur provenance.
    ///
    /// Utile pour confronter le fichier au matériel réellement branché sans
    /// présumer de l'endroit où le client a écrit l'information.
    pub fn known_guids(&self) -> Vec<&DeviceGuid> {
        self.options
            .iter()
            .filter_map(|o| o.guid.as_ref())
            .chain(self.device_options.iter().filter_map(|d| d.guid.as_ref()))
            .collect()
    }

    /// Les index de joystick (`N` de `jsN_`) réellement utilisés par au moins
    /// une assignation — à distinguer des slots simplement déclarés.
    pub fn joystick_instances_in_use(&self) -> Vec<u8> {
        let mut used: Vec<u8> = self
            .rebinds()
            .filter_map(|(_, _, r)| r.input.as_ref())
            .filter(|i| i.device_kind == DeviceKind::Joystick)
            .map(|i| i.instance)
            .collect();
        used.sort_unstable();
        used.dedup();
        used
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum DeviceKind {
    Joystick,
    Keyboard,
    Mouse,
    Gamepad,
}

impl DeviceKind {
    pub fn prefix(self) -> &'static str {
        match self {
            DeviceKind::Joystick => "js",
            DeviceKind::Keyboard => "kb",
            DeviceKind::Mouse => "mo",
            DeviceKind::Gamepad => "gp",
        }
    }

    pub fn from_prefix(prefix: &str) -> Option<Self> {
        match prefix {
            "js" => Some(DeviceKind::Joystick),
            "kb" => Some(DeviceKind::Keyboard),
            "mo" => Some(DeviceKind::Mouse),
            "gp" => Some(DeviceKind::Gamepad),
            _ => None,
        }
    }

    /// Valeur de l'attribut `type` sur `<options>`.
    pub fn from_options_type(value: &str) -> Option<Self> {
        match value {
            "joystick" => Some(DeviceKind::Joystick),
            "keyboard" => Some(DeviceKind::Keyboard),
            "mouse" => Some(DeviceKind::Mouse),
            "gamepad" => Some(DeviceKind::Gamepad),
            _ => None,
        }
    }
}

/// Sépare `"T.16000M  {B10A044F-...}"` en nom + GUID.
///
/// Le client laisse volontiers deux espaces avant l'accolade ; on ne s'y fie
/// pas et on découpe sur l'accolade elle-même.
pub fn split_named_guid(raw: &str) -> (Option<String>, Option<DeviceGuid>) {
    match raw.rfind('{') {
        Some(idx) => {
            let name = raw[..idx].trim();
            (
                (!name.is_empty()).then(|| name.to_string()),
                DeviceGuid::parse(&raw[idx..]),
            )
        }
        None => {
            let name = raw.trim();
            ((!name.is_empty()).then(|| name.to_string()), None)
        }
    }
}

/// Un bloc `<options type="joystick" instance="1" Product="NOM  {GUID}">`.
///
/// `Product` est fréquemment absent sur les joysticks : c'est précisément ce
/// qui rend l'ordre d'énumération fragile, puisque plus rien dans le fichier
/// ne rattache `js1` à un exemplaire physique.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DeviceOptions {
    pub device_kind: DeviceKind,
    pub instance: u8,
    pub product_raw: Option<String>,
    pub product_name: Option<String>,
    pub guid: Option<DeviceGuid>,
}

/// Un bloc `<deviceoptions name="NOM  {GUID}">`, porteur des réglages d'axes.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NamedDeviceOptions {
    pub name_raw: String,
    pub name: Option<String>,
    pub guid: Option<DeviceGuid>,
    pub axis_options: Vec<AxisOption>,
}

/// `<option input="rotz" deadzone="0.6" saturation="0.79"/>`
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AxisOption {
    pub input: String,
    pub deadzone: Option<f32>,
    pub saturation: Option<f32>,
}

impl Eq for AxisOption {}

/// Entrée de `<CustomisationUIHeader><devices>`, propre aux profils exportés.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DeclaredDevice {
    pub device_kind: DeviceKind,
    pub instance: u8,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ActionMap {
    pub name: String,
    pub actions: Vec<Action>,
}

impl ActionMap {
    /// Cette catégorie relève-t-elle du pilotage ?
    ///
    /// C'est le périmètre exact de l'aperçu offert par l'édition Lite.
    /// `seat_general` en fait partie : c'est là que vivent le mode quantique,
    /// le minage et l'entrée en tourelle.
    pub fn is_flight(&self) -> bool {
        self.name.starts_with("spaceship_")
            || self.name.starts_with("vehicle_")
            || self.name == "seat_general"
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Action {
    pub name: String,
    pub rebinds: Vec<Rebind>,
}

/// Une balise `<rebind input="js1_button5" activationMode="press"/>`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Rebind {
    /// Valeur brute de `input`, préservée même illisible : c'est la matière
    /// première du linter, qui doit pouvoir dire *ce qui* est cassé.
    pub input_raw: String,
    /// Décomposition de `input_raw`. `None` si la valeur est corrompue.
    pub input: Option<InputBinding>,
    /// `Some("")` est *différent* de `None` : la chaîne vide est exactement le
    /// bug que le client produit et que le linter Premium corrige.
    pub activation_mode: Option<String>,
    pub multi_tap: Option<String>,
    /// Ligne dans le fichier source, pour des diagnostics précis.
    pub line: u32,
}

impl Rebind {
    /// Action délibérément non assignée (`input=""`).
    pub fn is_unbound(&self) -> bool {
        self.input_raw.is_empty()
    }

    /// `input` non vide mais indéchiffrable — un vrai symptôme de corruption.
    ///
    /// Observé en conditions réelles sous la forme `js3_ ` : un périphérique
    /// fantôme avec un contrôle vide.
    pub fn is_corrupt(&self) -> bool {
        !self.is_unbound() && self.input.is_none()
    }
}

/// `js1_rctrl+button10` décomposé.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InputBinding {
    pub device_kind: DeviceKind,
    /// Le `N` de `jsN_`.
    pub instance: u8,
    /// Modificateur précédant le `+`, ex. `rctrl`, `lshift`.
    ///
    /// Le jeu accepte déjà un modificateur **clavier** devant un contrôle
    /// joystick (`js1_rctrl+button10`). Ce qu'il refuse, et que l'édition
    /// Premium apporte, c'est un *bouton de joystick* comme modificateur.
    pub modifier: Option<String>,
    /// Le contrôle proprement dit, ex. `button5`, `y`, `hat1_up`.
    pub control: String,
}

impl InputBinding {
    /// Analyse `js1_rctrl+button10` → `(Joystick, 1, Some("rctrl"), "button10")`.
    ///
    /// Renvoie `None` sur tout ce qui ne suit pas la forme attendue : jetons
    /// corrompus, contrôle vide ou réduit à des espaces (`js3_ `).
    pub fn parse(raw: &str) -> Option<Self> {
        let (head, rest) = raw.split_once('_')?;

        // Un contrôle vide ou blanc n'est pas assignable. Le client écrit
        // pourtant `js3_ ` : à traiter comme corrompu, pas comme valide.
        let rest = rest.trim();
        if rest.is_empty() {
            return None;
        }

        let split = head
            .char_indices()
            .find(|(_, c)| c.is_ascii_digit())
            .map(|(i, _)| i)?;
        let (prefix, index) = head.split_at(split);
        let device_kind = DeviceKind::from_prefix(prefix)?;
        let instance = index.parse::<u8>().ok()?;

        let (modifier, control) = match rest.split_once('+') {
            Some((m, c)) => {
                let (m, c) = (m.trim(), c.trim());
                if m.is_empty() || c.is_empty() {
                    return None;
                }
                (Some(m.to_string()), c.to_string())
            }
            None => (None, rest.to_string()),
        };

        Some(InputBinding {
            device_kind,
            instance,
            modifier,
            control,
        })
    }
}

impl std::fmt::Display for InputBinding {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}{}_", self.device_kind.prefix(), self.instance)?;
        if let Some(modifier) = &self.modifier {
            write!(f, "{modifier}+")?;
        }
        f.write_str(&self.control)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn input_binding_roundtrips() {
        for raw in [
            "js1_button5",
            "js2_y",
            "kb1_space",
            "mo1_mouse1",
            "gp1_x",
            "js1_hat1_up",
            "kb1_lshift+f",
            "js1_rctrl+button10",
            "js1_rctrl+hat1_right",
        ] {
            let parsed = InputBinding::parse(raw).unwrap_or_else(|| panic!("échec sur {raw}"));
            assert_eq!(parsed.to_string(), raw);
        }
    }

    #[test]
    fn input_binding_splits_modifier() {
        let parsed = InputBinding::parse("js1_rctrl+button10").unwrap();
        assert_eq!(parsed.device_kind, DeviceKind::Joystick);
        assert_eq!(parsed.instance, 1);
        assert_eq!(parsed.modifier.as_deref(), Some("rctrl"));
        assert_eq!(parsed.control, "button10");
    }

    #[test]
    fn input_binding_keeps_multipart_controls_intact() {
        let parsed = InputBinding::parse("js1_hat1_up").unwrap();
        assert_eq!(parsed.control, "hat1_up");
        assert!(parsed.modifier.is_none());
    }

    #[test]
    fn input_binding_rejects_corrupt_tokens() {
        for raw in [
            "",
            "BAD TOKEN",
            "js_button5",
            "xx1_button5",
            "js1_",
            "jsA_button5",
            "js3_ ",     // observé en conditions réelles
            "js1_+f",    // modificateur vide
            "js1_rctrl+", // contrôle vide
        ] {
            assert!(
                InputBinding::parse(raw).is_none(),
                "aurait dû échouer: {raw:?}"
            );
        }
    }

    #[test]
    fn split_named_guid_handles_double_space() {
        // Le client écrit bien deux espaces avant l'accolade.
        let (name, guid) = split_named_guid("T.16000M  {B10A044F-0000-0000-0000-504944564944}");
        assert_eq!(name.as_deref(), Some("T.16000M"));
        assert_eq!(
            guid.unwrap().as_str(),
            "{B10A044F-0000-0000-0000-504944564944}"
        );
    }

    #[test]
    fn split_named_guid_survives_missing_guid() {
        let (name, guid) = split_named_guid("Mouse");
        assert_eq!(name.as_deref(), Some("Mouse"));
        assert!(guid.is_none());
    }

    #[test]
    fn flight_filter_covers_seat_general() {
        for name in ["spaceship_movement", "vehicle_driver", "seat_general"] {
            let map = ActionMap { name: name.into(), actions: vec![] };
            assert!(map.is_flight(), "{name} devrait être du vol");
        }
        for name in ["player", "OnFoot", "player_emotes"] {
            let map = ActionMap { name: name.into(), actions: vec![] };
            assert!(!map.is_flight(), "{name} ne devrait pas être du vol");
        }
    }
}
