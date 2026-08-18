//! Réécriture chirurgicale d'une assignation.
//!
//! On repasse le document en flux d'événements et on recopie tout à
//! l'identique, sauf l'attribut `input` de la balise visée. Le client Star
//! Citizen est pointilleux sur ce fichier : moins on y touche, mieux on se
//! porte. Une réécriture complète depuis un modèle typé perdrait l'ordre des
//! attributs, l'indentation et les éléments qu'on ne modélise pas — et
//! introduirait des régressions invisibles jusqu'au lancement du jeu.

use crate::{Error, Result};
use quick_xml::events::{BytesStart, Event};
use quick_xml::{Reader, Writer};

/// Une modification d'assignation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BindingEdit {
    pub actionmap: String,
    pub action: String,
    /// Nouvelle valeur de `input`. `None` efface l'assignation.
    pub input: Option<String>,
}

impl BindingEdit {
    pub fn set(actionmap: &str, action: &str, input: &str) -> Self {
        Self {
            actionmap: actionmap.to_string(),
            action: action.to_string(),
            input: Some(input.to_string()),
        }
    }

    pub fn clear(actionmap: &str, action: &str) -> Self {
        Self {
            actionmap: actionmap.to_string(),
            action: action.to_string(),
            input: None,
        }
    }

    /// Valeur à écrire. Effacer revient à `input=""`, la forme que le jeu
    /// emploie lui-même pour une action délibérément non assignée.
    fn value(&self) -> &str {
        self.input.as_deref().unwrap_or("")
    }
}

/// Applique une modification au document et renvoie le XML résultant.
///
/// Échoue si l'action visée n'existe pas : mieux vaut refuser bruyamment que
/// rendre un fichier inchangé en laissant croire à un succès.
pub fn apply(xml: &str, edit: &BindingEdit) -> Result<String> {
    let mut reader = Reader::from_str(xml);
    let mut writer = Writer::new(Vec::new());

    let mut current_map: Option<String> = None;
    let mut current_action: Option<String> = None;
    let mut applied = false;

    loop {
        let event = reader.read_event().map_err(|e| Error::Xml(e.to_string()))?;

        match event {
            Event::Eof => break,

            // Les bras gardés doivent précéder les bras généraux de même
            // forme, sinon ils sont inatteignables et la balise visée est
            // recopiée telle quelle.

            // `<rebind .../>` — la forme quasi universelle dans ce fichier.
            Event::Empty(ref e) if is_target(e, &current_map, &current_action, edit, applied) => {
                let replaced = with_input(e, edit.value())?;
                write(&mut writer, &Event::Empty(replaced))?;
                applied = true;
            }

            // `<rebind ...></rebind>` — rare, mais valide.
            Event::Start(ref e) if is_target(e, &current_map, &current_action, edit, applied) => {
                let replaced = with_input(e, edit.value())?;
                write(&mut writer, &Event::Start(replaced))?;
                applied = true;
            }

            Event::Start(ref e) => {
                match e.name().as_ref() {
                    b"actionmap" => current_map = attribute(e, b"name"),
                    b"action" => current_action = attribute(e, b"name"),
                    _ => {}
                }
                write(&mut writer, &event)?;
            }

            Event::End(ref e) => {
                match e.name().as_ref() {
                    b"actionmap" => current_map = None,
                    b"action" => current_action = None,
                    _ => {}
                }
                write(&mut writer, &event)?;
            }

            other => write(&mut writer, &other)?,
        }
    }

    if !applied {
        return Err(Error::ActionNotFound {
            actionmap: edit.actionmap.clone(),
            action: edit.action.clone(),
        });
    }

    String::from_utf8(writer.into_inner()).map_err(|e| Error::Xml(e.to_string()))
}

fn is_target(
    element: &BytesStart,
    current_map: &Option<String>,
    current_action: &Option<String>,
    edit: &BindingEdit,
    already_applied: bool,
) -> bool {
    !already_applied
        && element.name().as_ref() == b"rebind"
        && current_map.as_deref() == Some(edit.actionmap.as_str())
        && current_action.as_deref() == Some(edit.action.as_str())
}

/// Recopie une balise en remplaçant la seule valeur de `input`.
///
/// L'ordre des autres attributs est préservé, et `input` est ajouté s'il
/// manquait.
fn with_input<'a>(element: &BytesStart<'a>, input: &str) -> Result<BytesStart<'a>> {
    let name = String::from_utf8_lossy(element.name().as_ref()).into_owned();
    let mut out = BytesStart::new(name);
    let mut seen = false;

    for attribute in element.attributes() {
        let attribute = attribute.map_err(|e| Error::Xml(e.to_string()))?;
        if attribute.key.as_ref() == b"input" {
            out.push_attribute(("input", input));
            seen = true;
        } else {
            out.push_attribute(attribute);
        }
    }

    if !seen {
        out.push_attribute(("input", input));
    }
    Ok(out)
}

fn attribute(element: &BytesStart, key: &[u8]) -> Option<String> {
    element
        .attributes()
        .filter_map(|a| a.ok())
        .find(|a| a.key.as_ref() == key)
        .and_then(|a| String::from_utf8(a.value.into_owned()).ok())
}

fn write(writer: &mut Writer<Vec<u8>>, event: &Event) -> Result<()> {
    writer
        .write_event(event.borrow())
        .map_err(|e| Error::Xml(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    const DOC: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<ActionMaps>
 <ActionProfiles version="1" profileName="default">
  <actionmap name="spaceship_movement">
   <action name="v_boost">
    <rebind input="js1_button5" activationMode="press"/>
   </action>
   <action name="v_brake">
    <rebind input="js2_ "/>
   </action>
  </actionmap>
  <actionmap name="spaceship_weapons">
   <action name="v_boost">
    <rebind input="js1_button1"/>
   </action>
  </actionmap>
 </ActionProfiles>
</ActionMaps>
"#;

    #[test]
    fn replaces_only_the_targeted_binding() {
        let out = apply(
            DOC,
            &BindingEdit::set("spaceship_movement", "v_boost", "js1_button9"),
        )
        .unwrap();

        assert!(out.contains(r#"input="js1_button9""#));
        // L'homonyme dans une autre catégorie ne doit pas bouger.
        assert!(out.contains(r#"input="js1_button1""#));
        assert!(!out.contains(r#"input="js1_button5""#));
    }

    #[test]
    fn preserves_sibling_attributes() {
        let out = apply(
            DOC,
            &BindingEdit::set("spaceship_movement", "v_boost", "js1_x"),
        )
        .unwrap();
        assert!(
            out.contains(r#"<rebind input="js1_x" activationMode="press"/>"#),
            "activationMode perdu: {out}"
        );
    }

    #[test]
    fn clearing_writes_the_games_own_unbound_form() {
        let out = apply(DOC, &BindingEdit::clear("spaceship_movement", "v_brake")).unwrap();
        assert!(out.contains(r#"<rebind input=""/>"#), "{out}");
    }

    #[test]
    fn leaves_the_rest_of_the_document_untouched() {
        let out = apply(
            DOC,
            &BindingEdit::set("spaceship_movement", "v_boost", "js1_x"),
        )
        .unwrap();

        // Tout ce qu'on ne vise pas doit survivre au passage, y compris la
        // déclaration XML et les attributs de ActionProfiles.
        assert!(out.contains(r#"<?xml version="1.0" encoding="UTF-8"?>"#));
        assert!(out.contains(r#"profileName="default""#));
        assert!(out.contains(r#"<actionmap name="spaceship_weapons">"#));

        // Et le document doit rester relisible par notre propre parseur.
        let reparsed = spacemapper_core::actionmaps::parse_str(&out).unwrap();
        assert_eq!(reparsed.profile_name.as_deref(), Some("default"));
    }

    #[test]
    fn unknown_action_is_a_loud_failure() {
        let err = apply(
            DOC,
            &BindingEdit::set("spaceship_movement", "v_inexistante", "js1_x"),
        )
        .unwrap_err();
        assert!(matches!(err, Error::ActionNotFound { .. }));
    }

    #[test]
    fn unknown_actionmap_is_a_loud_failure() {
        let err = apply(
            DOC,
            &BindingEdit::set("categorie_absente", "v_boost", "js1_x"),
        )
        .unwrap_err();
        assert!(matches!(err, Error::ActionNotFound { .. }));
    }

    #[test]
    fn handles_the_non_empty_rebind_form() {
        // `<rebind ...></rebind>` est rare mais valide. Un bras de `match` mal
        // ordonné le laissait passer sans modification, et l'échec était
        // silencieux côté utilisateur.
        let doc = r#"<ActionMaps><ActionProfiles>
  <actionmap name="player">
   <action name="v_jump"><rebind input="kb1_space"></rebind></action>
  </actionmap>
 </ActionProfiles></ActionMaps>"#;

        let out = apply(doc, &BindingEdit::set("player", "v_jump", "js1_button3")).unwrap();
        assert!(out.contains(r#"input="js1_button3""#), "{out}");
    }

    #[test]
    fn editing_is_idempotent() {
        let once = apply(
            DOC,
            &BindingEdit::set("spaceship_movement", "v_boost", "js1_x"),
        )
        .unwrap();
        let twice = apply(
            &once,
            &BindingEdit::set("spaceship_movement", "v_boost", "js1_x"),
        )
        .unwrap();
        assert_eq!(once, twice);
    }
}
