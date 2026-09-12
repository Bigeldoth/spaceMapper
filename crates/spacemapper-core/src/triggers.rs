//! Attributs de déclenchement déclarés par le jeu, sans simulation des événements.

use std::collections::BTreeMap;

pub type TriggerAttributes = BTreeMap<String, String>;

/// Accepte les variantes de casse présentes dans les XML du jeu ; la forme
/// canonique a priorité lorsqu'elle coexiste avec un alias.
pub fn attributes_of(node: &roxmltree::Node<'_, '_>) -> TriggerAttributes {
    const NAMES: &[&str] = &[
        "activationMode",
        "onPress",
        "onHold",
        "onRelease",
        "multiTap",
        "multiTapBlock",
        "pressTriggerThreshold",
        "releaseTriggerThreshold",
        "pressTriggerDelay",
        "holdTriggerDelay",
        "releaseTriggerDelay",
        "holdRepeatDelay",
        "retriggerable",
        "useAnalogCompare",
        "analogCompareVal",
        "analogCompareOp",
        "noModifiers",
        "always",
        "priority",
        "modifiers",
        "inputBlockTime",
        "inputBlockMode",
        "inputBlockInputs",
        "inputBlockDevice",
        "inputBlockActivation",
        "blockSubsequentInputs",
        "ignoreModifiers",
    ];
    let mut result = TriggerAttributes::new();
    for &name in NAMES {
        let value = node.attribute(name).or_else(|| {
            node.attributes()
                .find(|attribute| attribute.name().eq_ignore_ascii_case(name))
                .map(|attribute| attribute.value())
        });
        if let Some(value) = value {
            result.insert(name.to_string(), value.to_string());
        }
    }
    result
}

/// Le mode sélectionné est développé avant les attributs explicites, afin
/// qu'un `multiTap`, un délai ou un événement local ne soit jamais écrasé.
pub fn resolve(
    definitions: &BTreeMap<String, TriggerAttributes>,
    mode: Option<&str>,
    attributes: &TriggerAttributes,
) -> TriggerAttributes {
    let mode = mode.or_else(|| attributes.get("activationMode").map(String::as_str));
    let mut resolved = mode
        .and_then(|name| definitions.get(name.trim()))
        .cloned()
        .unwrap_or_default();
    resolved.extend(attributes.clone());
    if let Some(mode) = mode {
        resolved.insert("activationMode".to_string(), mode.to_string());
    }
    resolved
}
