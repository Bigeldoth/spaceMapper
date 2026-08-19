//! Énumération des périphériques d'entrée.
//!
//! On énumère via DirectInput, et non via l'API HID générique : c'est le seul
//! moyen d'obtenir des GUID **identiques au bit près** à ceux que le jeu écrit
//! lui-même.
//!
//! ⚠️ Star Citizen écrit le GUID **produit**, pas le GUID d'instance —
//! vérifié sur un fichier réel. Le GUID produit étant dérivé du couple
//! VID/PID, deux exemplaires d'un même modèle le partagent. Toute comparaison
//! fichier ↔ matériel doit donc passer par [`InputDevice::product_guid`], et
//! accepter qu'elle ne distingue pas deux manches identiques. Voir
//! [`diagnosis`] pour le détail et les relevés qui l'établissent.

#[cfg(windows)]
pub mod capture;
pub mod diagnosis;
#[cfg(windows)]
pub mod directinput;

use serde::{Deserialize, Serialize};

/// Un GUID normalisé sous la forme `{231D044F-0000-0000-0000-504944564944}`.
///
/// On stocke la représentation textuelle plutôt que les 16 octets bruts parce
/// que la comparaison utile se fait toujours contre le texte du XML.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct DeviceGuid(String);

impl DeviceGuid {
    /// Normalise une chaîne de GUID : majuscules, entourée d'accolades.
    ///
    /// Accepte les formes avec ou sans accolades, en majuscules ou minuscules,
    /// parce que ni le jeu ni les profils communautaires ne sont cohérents.
    pub fn parse(raw: &str) -> Option<Self> {
        let trimmed = raw.trim().trim_start_matches('{').trim_end_matches('}');
        if trimmed.len() != 36 {
            return None;
        }
        let valid = trimmed.chars().enumerate().all(|(i, c)| match i {
            8 | 13 | 18 | 23 => c == '-',
            _ => c.is_ascii_hexdigit(),
        });
        if !valid {
            return None;
        }
        Some(DeviceGuid(format!("{{{}}}", trimmed.to_ascii_uppercase())))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for DeviceGuid {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

/// Ce que le jeu peut faire d'un périphérique — nécessaire au canevas visuel
/// de la Phase 2, collecté dès maintenant pour éviter une seconde énumération.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct DeviceCapabilities {
    pub axes: u32,
    pub buttons: u32,
    pub povs: u32,
}

/// Famille du périphérique, telle que Star Citizen la distingue.
///
/// La différence n'est pas cosmétique : le jeu écrit `gp1_` pour une manette
/// et `js1_` pour un manche. Assigner un bouton de manette sous un préfixe
/// `js` produirait une touche muette.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeviceCategory {
    /// Manche, palonnier, boîte à interrupteurs — tout ce qui n'est pas une
    /// manette de salon.
    Joystick,
    /// Manette à deux poignées, type Xbox.
    Gamepad,
}

impl DeviceCategory {
    /// Préfixe employé par le jeu dans `actionmaps.xml`.
    pub fn prefix(self) -> &'static str {
        match self {
            DeviceCategory::Joystick => "js",
            DeviceCategory::Gamepad => "gp",
        }
    }

    /// Déduit la famille de l'octet de poids faible de `dwDevType`.
    ///
    /// DirectInput range les manches de vol, volants et autres sous des types
    /// distincts ; seul `GAMEPAD` correspond à ce que le jeu traite comme une
    /// manette, tout le reste relevant du manche.
    pub fn from_dev_type(dev_type: u32) -> Self {
        // `DI8DEVTYPE_GAMEPAD`, non exporté comme octet par le crate.
        const GAMEPAD: u32 = 21;
        if dev_type & 0xFF == GAMEPAD {
            DeviceCategory::Gamepad
        } else {
            DeviceCategory::Joystick
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InputDevice {
    /// Identité stable de cet exemplaire précis. C'est la clé de tout.
    pub instance_guid: DeviceGuid,
    /// Identité du *modèle*. Deux VKB Gladiator identiques la partagent.
    pub product_guid: DeviceGuid,
    /// Nom tel que Windows le rapporte, ex. « VKB Gladiator NXT ».
    pub product_name: String,
    /// Nom de l'exemplaire, parfois suffixé par Windows en cas de doublon.
    pub instance_name: String,
    pub category: DeviceCategory,
    pub capabilities: DeviceCapabilities,
}

impl InputDevice {
    /// La chaîne que Star Citizen écrit dans `options@Product` et
    /// `deviceoptions@name`.
    ///
    /// Le client insère **deux** espaces avant l'accolade (vérifié sur un
    /// fichier LIVE réel). On reproduit sa mise en forme à l'octet près :
    /// l'édition Premium réécrit ce champ, et un diff parasite sur un espace
    /// rendrait ses rapports de réparation illisibles.
    pub fn product_field(&self) -> String {
        format!("{}  {}", self.product_name, self.instance_guid)
    }
}

/// Abstraction de l'énumération, pour que toute la logique métier soit
/// testable sans matériel branché.
pub trait DeviceEnumerator {
    fn enumerate(&self) -> crate::Result<Vec<InputDevice>>;
}

/// Énumérateur de test, alimenté par une liste fixe.
#[derive(Debug, Clone, Default)]
pub struct FakeEnumerator {
    pub devices: Vec<InputDevice>,
}

impl FakeEnumerator {
    pub fn new(devices: Vec<InputDevice>) -> Self {
        Self { devices }
    }
}

impl DeviceEnumerator for FakeEnumerator {
    fn enumerate(&self) -> crate::Result<Vec<InputDevice>> {
        Ok(self.devices.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn guid_parse_normalises_case_and_braces() {
        let expected = "{231D044F-0000-0000-0000-504944564944}";
        for raw in [
            "{231d044f-0000-0000-0000-504944564944}",
            "231D044F-0000-0000-0000-504944564944",
            "  {231D044F-0000-0000-0000-504944564944}  ",
        ] {
            assert_eq!(DeviceGuid::parse(raw).unwrap().as_str(), expected, "{raw}");
        }
    }

    #[test]
    fn guid_parse_rejects_malformed() {
        for raw in [
            "",
            "not-a-guid",
            "231D044F-0000-0000-0000-50494456494", // trop court
            "231D044F-0000-0000-0000-5049445649444", // trop long
            "231D044FX0000-0000-0000-504944564944", // séparateur manquant
            "231D044G-0000-0000-0000-504944564944", // 'G' n'est pas hexadécimal
        ] {
            assert!(
                DeviceGuid::parse(raw).is_none(),
                "aurait dû échouer: {raw:?}"
            );
        }
    }

    #[test]
    fn gamepads_and_joysticks_use_different_prefixes() {
        // Confondre les deux produirait une assignation muette en jeu.
        assert_eq!(DeviceCategory::from_dev_type(21), DeviceCategory::Gamepad);
        assert_eq!(DeviceCategory::Gamepad.prefix(), "gp");

        // Manche (20), volant (22), manche de vol (23) : tous des joysticks.
        for dev_type in [20, 22, 23] {
            assert_eq!(
                DeviceCategory::from_dev_type(dev_type),
                DeviceCategory::Joystick,
                "type {dev_type}"
            );
        }
        assert_eq!(DeviceCategory::Joystick.prefix(), "js");
    }

    #[test]
    fn device_type_ignores_the_subtype_byte() {
        // `dwDevType` empile le sous-type dans les octets hauts ; seul le
        // poids faible désigne la famille.
        assert_eq!(
            DeviceCategory::from_dev_type(0x0001_0015),
            DeviceCategory::Gamepad
        );
    }

    #[test]
    fn product_field_matches_game_format() {
        // Modelé sur une ligne réelle : `T.16000M  {B10A044F-...}`, deux espaces.
        let guid = "B10A044F-0000-0000-0000-504944564944";
        let device = InputDevice {
            instance_guid: DeviceGuid::parse(guid).unwrap(),
            product_guid: DeviceGuid::parse(guid).unwrap(),
            product_name: "T.16000M".into(),
            instance_name: "T.16000M".into(),
            category: DeviceCategory::Joystick,
            capabilities: DeviceCapabilities::default(),
        };
        assert_eq!(
            device.product_field(),
            "T.16000M  {B10A044F-0000-0000-0000-504944564944}"
        );

        // Et le résultat doit se re-découper correctement.
        let (name, parsed) = crate::actionmaps::split_named_guid(&device.product_field());
        assert_eq!(name.as_deref(), Some("T.16000M"));
        assert_eq!(parsed.unwrap(), device.instance_guid);
    }
}
