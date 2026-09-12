//! Réécriture chirurgicale d'une assignation.
//!
//! On repasse le document en flux d'événements et on recopie tout à
//! l'identique, sauf l'attribut `input` de la balise visée. Les métadonnées
//! héritées `activationMode`/`multiTap` ne servent qu'à créer un `<rebind>`.
//! Seul un choix explicite `gesture` remplace ces attributs sur une balise
//! existante. Le client Star Citizen est
//! pointilleux sur ce fichier : moins on y touche, mieux on se porte. Une
//! réécriture complète depuis un modèle typé perdrait l'ordre des attributs,
//! l'indentation et les éléments qu'on ne modélise pas — et introduirait des
//! régressions invisibles jusqu'au lancement du jeu.

use crate::{Error, Result};
use quick_xml::events::{BytesEnd, BytesStart, Event};
use quick_xml::{Reader, Writer};
use spacemapper_core::actionmaps::InputBinding;
use std::borrow::Cow;

/// Choix explicite du joueur, distinct des métadonnées héritées du jeu.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BindingGesture {
    ShortPress,
    DoubleTap,
    LongPress,
}

impl BindingGesture {
    fn attributes(self) -> (&'static str, &'static str) {
        match self {
            Self::ShortPress => ("tap", "1"),
            Self::DoubleTap => ("double_tap", "2"),
            Self::LongPress => ("delayed_press", "1"),
        }
    }
}

/// Une modification d'assignation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BindingEdit {
    pub actionmap: String,
    pub action: String,
    /// Nouvelle valeur de `input`. `None` efface l'assignation.
    pub input: Option<String>,
    /// Métadonnées à recopier uniquement lors de l'insertion d'un nouveau
    /// `<rebind>`. Si une balise existante est remplacée, ses attributs voisins
    /// restent la source de vérité et ne sont jamais écrasés par ces champs.
    pub activation_mode: Option<String>,
    pub multi_tap: Option<String>,
    /// Seul ce choix explicite autorise à modifier le geste d'une ligne existante.
    pub gesture: Option<BindingGesture>,
    /// Valeur `input` **avant** modification, quand l'action visée porte déjà
    /// plusieurs `<rebind>` (une par famille de périphérique — clavier et
    /// manche peuvent coexister) et qu'il faut donc préciser lequel éditer.
    ///
    /// Une correspondance **exacte**, pas un préfixe de famille (`js1`) : un
    /// préfixe se serait aussi vu matcher `js10`, `js11`… — un vrai risque
    /// pour les configurations HOSAS/multi-manche que cible ce logiciel. La
    /// correspondance exacte a aussi une propriété plus importante encore :
    /// dans un lot de plusieurs modifications, chaque `<rebind>` continue de
    /// se reconnaître à sa valeur *d'avant le lot*, même après qu'une
    /// modification précédente du même lot a réécrit un `<rebind>` voisin —
    /// un filtrage par famille se serait fait tromper si cette réécriture
    /// venait à produire la même famille que la cible suivante.
    ///
    /// `None` cible le premier `<rebind>` trouvé, comme avant l'ajout de ce
    /// champ : c'est le seul cas courant tant qu'une action n'a qu'une
    /// assignation.
    pub original_input: Option<String>,
}

impl BindingEdit {
    pub fn set(actionmap: &str, action: &str, input: &str) -> Self {
        Self {
            actionmap: actionmap.to_string(),
            action: action.to_string(),
            input: Some(input.to_string()),
            activation_mode: None,
            multi_tap: None,
            gesture: None,
            original_input: None,
        }
    }

    pub fn clear(actionmap: &str, action: &str) -> Self {
        Self {
            actionmap: actionmap.to_string(),
            action: action.to_string(),
            input: None,
            activation_mode: None,
            multi_tap: None,
            gesture: None,
            original_input: None,
        }
    }

    /// Précise le `<rebind>` visé par sa valeur `input` d'avant modification,
    /// pour une action dont plus d'un `<rebind>` coexiste. Voir
    /// [`BindingEdit::original_input`].
    pub fn targeting(mut self, original_input: &str) -> Self {
        self.original_input = Some(original_input.to_string());
        self
    }

    /// Une suppression doit garder le périphérique (`kb1_ `, `js3_ `…).
    /// Sans ce préfixe, aucune famille n'est surchargée et son raccourci par
    /// défaut revient au chargement. Une valeur par défaut absente du XML
    /// fournit son périphérique via `original_input` ; sinon on lit la balise.
    fn value(&self, existing_input: Option<&str>) -> Cow<'_, str> {
        if let Some(input) = &self.input {
            return Cow::Borrowed(input);
        }
        let device = self
            .original_input
            .as_deref()
            .and_then(InputBinding::parse_head)
            .or_else(|| existing_input.and_then(InputBinding::parse_head));
        match device {
            Some((kind, instance)) => Cow::Owned(format!("{}{instance}_ ", kind.prefix())),
            None => Cow::Borrowed(""),
        }
    }
}

/// Applique plusieurs modifications d'affilée.
///
/// Les modifications de l'utilisateur s'accumulent avant d'être validées d'un
/// bloc ; on ne réécrit donc le fichier qu'une fois. Une seule modification
/// invalide fait échouer l'ensemble, et rien n'est renvoyé : un enregistrement
/// à moitié appliqué serait pire qu'un refus.
pub fn apply_many(xml: &str, edits: &[BindingEdit]) -> Result<String> {
    let mut document = xml.to_string();
    for edit in edits {
        document = apply(&document, edit)?;
    }
    Ok(document)
}

/// Applique une modification au document et renvoie le XML résultant.
///
/// Si l'action visée n'existe pas encore, elle est **créée**. C'est le cas
/// courant depuis qu'on affiche aussi les assignations par défaut du jeu :
/// `actionmaps.xml` ne contient que les surcharges, donc surcharger un défaut
/// revient à écrire une entrée qui n'existait pas. La catégorie elle-même est
/// créée si besoin.
pub fn apply(xml: &str, edit: &BindingEdit) -> Result<String> {
    let mut reader = Reader::from_str(xml);
    let mut writer = Writer::new(Vec::new());

    let mut current_map: Option<String> = None;
    let mut current_action: Option<String> = None;
    let mut applied = false;
    // La catégorie et l'action visées ont-elles été rencontrées ? C'est ce
    // qui distingue « à créer » de « à remplacer ».
    let mut map_seen = false;
    let mut action_seen = false;
    let mut indent = String::new();

    loop {
        let event = reader.read_event().map_err(|e| Error::Xml(e.to_string()))?;

        match event {
            Event::Eof => break,

            // Sortie de l'action visée sans avoir trouvé de `<rebind>` :
            // l'action existe mais n'a aucune assignation, on en insère une.
            Event::End(ref e)
                if !applied
                    && action_seen
                    && e.name().as_ref() == b"action"
                    && current_map.as_deref() == Some(edit.actionmap.as_str())
                    && current_action.as_deref() == Some(edit.action.as_str()) =>
            {
                write_raw(&mut writer, &format!("{indent}  "))?;
                write_rebind(&mut writer, edit)?;
                write_raw(&mut writer, &indent)?;
                write(&mut writer, &event)?;
                current_action = None;
                applied = true;
            }

            // Sortie de la catégorie visée sans avoir trouvé l'action : on
            // ajoute l'action complète avant de refermer.
            Event::End(ref e)
                if !applied
                    && map_seen
                    && e.name().as_ref() == b"actionmap"
                    && current_map.as_deref() == Some(edit.actionmap.as_str()) =>
            {
                write_raw(&mut writer, &format!("{indent} "))?;
                write_action(&mut writer, edit)?;
                write_raw(&mut writer, &indent)?;
                write(&mut writer, &event)?;
                current_map = None;
                applied = true;
            }

            // La catégorie n'existe pas du tout : on la crée avant de refermer
            // le conteneur.
            Event::End(ref e)
                if !applied
                    && !map_seen
                    && matches!(e.name().as_ref(), b"ActionProfiles" | b"ActionMaps") =>
            {
                write_raw(&mut writer, &format!("{indent} "))?;
                write_actionmap(&mut writer, edit)?;
                write_raw(&mut writer, &indent)?;
                write(&mut writer, &event)?;
                applied = true;
            }

            // Les bras gardés doivent précéder les bras généraux de même
            // forme, sinon ils sont inatteignables et la balise visée est
            // recopiée telle quelle.

            // `<rebind .../>` — la forme quasi universelle dans ce fichier.
            Event::Empty(ref e) if is_target(e, &current_map, &current_action, edit, applied) => {
                let replaced = with_input(e, edit)?;
                write(&mut writer, &Event::Empty(replaced))?;
                applied = true;
            }

            // `<rebind ...></rebind>` — rare, mais valide.
            Event::Start(ref e) if is_target(e, &current_map, &current_action, edit, applied) => {
                let replaced = with_input(e, edit)?;
                write(&mut writer, &Event::Start(replaced))?;
                applied = true;
            }

            Event::Start(ref e) => {
                match e.name().as_ref() {
                    b"actionmap" => {
                        current_map = attribute(e, b"name");
                        if current_map.as_deref() == Some(edit.actionmap.as_str()) {
                            map_seen = true;
                        }
                    }
                    b"action" => {
                        current_action = attribute(e, b"name");
                        if map_seen && current_action.as_deref() == Some(edit.action.as_str()) {
                            action_seen = true;
                        }
                    }
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

            // On retient la dernière indentation vue, pour que les éléments
            // insérés s'alignent sur le fichier plutôt que de le déformer.
            Event::Text(ref t) => {
                if let Ok(text) = std::str::from_utf8(t.as_ref()) {
                    if let Some(last) = text.rsplit('\n').next() {
                        if !last.is_empty() && last.chars().all(char::is_whitespace) {
                            indent = last.to_string();
                        }
                    }
                }
                write(&mut writer, &event)?;
            }

            other => write(&mut writer, &other)?,
        }
    }

    if !applied {
        return Err(Error::NoInsertionPoint {
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
    if already_applied
        || element.name().as_ref() != b"rebind"
        || current_map.as_deref() != Some(edit.actionmap.as_str())
        || current_action.as_deref() != Some(edit.action.as_str())
    {
        return false;
    }

    // Plusieurs `<rebind>` peuvent coexister sous la même action — clavier et
    // manche pouvant chacun porter le leur. Sans précision, on cible le
    // premier trouvé, exactement comme avant l'ajout de ce champ.
    match &edit.original_input {
        Some(original) => attribute(element, b"input").as_deref() == Some(original.as_str()),
        None => true,
    }
}

/// Recopie une balise en remplaçant `input` et, sur choix explicite, le geste.
///
/// L'ordre des autres attributs est préservé, et `input` est ajouté s'il
/// manquait.
fn with_input<'a>(element: &BytesStart<'a>, edit: &BindingEdit) -> Result<BytesStart<'a>> {
    let name = String::from_utf8_lossy(element.name().as_ref()).into_owned();
    let mut out = BytesStart::new(name);
    let mut seen = false;
    let gesture = edit.gesture.filter(|_| edit.input.is_some());
    let existing_input = attribute(element, b"input");
    let input = edit.value(existing_input.as_deref());

    for attribute in element.attributes() {
        let attribute = attribute.map_err(|e| Error::Xml(e.to_string()))?;
        if attribute.key.as_ref() == b"input" {
            out.push_attribute(("input", input.as_ref()));
            seen = true;
        } else if gesture.is_some()
            && matches!(attribute.key.as_ref(), b"activationMode" | b"multiTap")
        {
            // Remplacer les deux attributs évite de garder multiTap=2 après
            // le choix d'un appui court, y compris par héritage du jeu.
        } else {
            out.push_attribute(attribute);
        }
    }

    if !seen {
        out.push_attribute(("input", input.as_ref()));
    }
    if let Some(gesture) = gesture {
        let (mode, taps) = gesture.attributes();
        out.push_attribute(("activationMode", mode));
        out.push_attribute(("multiTap", taps));
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

/// Écrit du texte brut, pour l'indentation des éléments insérés.
fn write_raw(writer: &mut Writer<Vec<u8>>, text: &str) -> Result<()> {
    use std::io::Write;
    writer
        .get_mut()
        .write_all(text.as_bytes())
        .map_err(|e| Error::Xml(e.to_string()))
}

fn write_rebind(writer: &mut Writer<Vec<u8>>, edit: &BindingEdit) -> Result<()> {
    let mut element = BytesStart::new("rebind");
    let input = edit.value(None);
    element.push_attribute(("input", input.as_ref()));
    if let Some(gesture) = edit.gesture.filter(|_| edit.input.is_some()) {
        let (mode, taps) = gesture.attributes();
        element.push_attribute(("activationMode", mode));
        element.push_attribute(("multiTap", taps));
    } else {
        if let Some(activation_mode) = &edit.activation_mode {
            element.push_attribute(("activationMode", activation_mode.as_str()));
        }
        if let Some(multi_tap) = &edit.multi_tap {
            element.push_attribute(("multiTap", multi_tap.as_str()));
        }
    }
    write(writer, &Event::Empty(element))
}

/// `<action name="X"><rebind input="…"/></action>`, sur une seule ligne.
fn write_action(writer: &mut Writer<Vec<u8>>, edit: &BindingEdit) -> Result<()> {
    let mut element = BytesStart::new("action");
    element.push_attribute(("name", edit.action.as_str()));
    write(writer, &Event::Start(element))?;
    write_rebind(writer, edit)?;
    write(writer, &Event::End(BytesEnd::new("action")))
}

fn write_actionmap(writer: &mut Writer<Vec<u8>>, edit: &BindingEdit) -> Result<()> {
    let mut element = BytesStart::new("actionmap");
    element.push_attribute(("name", edit.actionmap.as_str()));
    write(writer, &Event::Start(element))?;
    write_action(writer, edit)?;
    write(writer, &Event::End(BytesEnd::new("actionmap")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clearing_preserves_every_device_family_and_instance() {
        for (bound, unbound) in [
            ("kb1_a", "kb1_ "),
            ("kb1_lshift+a", "kb1_ "),
            ("mo1_mouse1", "mo1_ "),
            ("gp1_x", "gp1_ "),
            ("js3_button5", "js3_ "),
            ("js10_rctrl+button10", "js10_ "),
        ] {
            for closing in ["/>", "></rebind>"] {
                let doc = format!(
                    r#"<ActionMaps><actionmap name="spaceship_movement"><action name="v_strafe_left"><rebind input="{bound}" activationMode="press"{closing}</action></actionmap></ActionMaps>"#
                );
                let out = apply(
                    &doc,
                    &BindingEdit::clear("spaceship_movement", "v_strafe_left"),
                )
                .unwrap();
                assert_eq!(out, doc.replace(bound, unbound));
                let parsed = spacemapper_core::actionmaps::parse_str(&out).unwrap();
                let (_, _, rebind) = parsed.rebinds().next().unwrap();
                assert!(rebind.is_unbound(), "{bound}: {out}");
                assert_eq!(
                    InputBinding::parse_head(&rebind.input_raw),
                    InputBinding::parse_head(bound)
                );
            }
        }
    }

    #[test]
    fn clearing_an_implicit_keyboard_default_creates_a_device_override() {
        // Le jeu fournit `kb1_a` même si aucune surcharge n'est encore écrite.
        for doc in [
            r#"<ActionMaps><ActionProfiles></ActionProfiles></ActionMaps>"#,
            r#"<ActionMaps><actionmap name="spaceship_movement"></actionmap></ActionMaps>"#,
            r#"<ActionMaps><actionmap name="spaceship_movement"><action name="v_strafe_left"></action></actionmap></ActionMaps>"#,
        ] {
            let out = apply(
                doc,
                &BindingEdit::clear("spaceship_movement", "v_strafe_left").targeting("kb1_a"),
            )
            .unwrap();
            assert_eq!(
                reparse(&out, "spaceship_movement", "v_strafe_left").as_deref(),
                Some("kb1_ ")
            );
            assert_eq!(out.matches("<rebind").count(), 1, "{out}");
        }
    }

    #[test]
    fn clearing_a_target_leaves_other_bindings_and_instances_untouched() {
        let doc = r#"<ActionMaps><actionmap name="spaceship_movement"><action name="v_strafe_left"><rebind input="kb1_a"/><rebind input="js10_button1"/><rebind input="js1_button1"/><rebind input="js1_button2"/></action></actionmap></ActionMaps>"#;
        let out = apply(
            doc,
            &BindingEdit::clear("spaceship_movement", "v_strafe_left").targeting("js1_button1"),
        )
        .unwrap();
        assert_eq!(out, doc.replace("js1_button1", "js1_ "));
    }

    #[test]
    fn clearing_a_default_inserts_next_to_another_device_override() {
        let doc = r#"<ActionMaps><actionmap name="spaceship_movement"><action name="v_strafe_left"><rebind input="js3_x" activationMode="press"/></action></actionmap></ActionMaps>"#;
        let out = apply(
            doc,
            &BindingEdit::clear("spaceship_movement", "v_strafe_left").targeting("kb1_a"),
        )
        .unwrap();
        assert!(out.contains(r#"<rebind input="js3_x" activationMode="press"/>"#));
        let parsed = spacemapper_core::actionmaps::parse_str(&out).unwrap();
        let inputs: Vec<_> = parsed
            .rebinds()
            .map(|(_, _, rebind)| rebind.input_raw.as_str())
            .collect();
        assert_eq!(inputs, ["js3_x", "kb1_ "]);
    }

    #[test]
    fn clearing_an_already_unbound_device_is_idempotent() {
        for edit in [
            BindingEdit::clear("spaceship_movement", "v_brake"),
            BindingEdit::clear("spaceship_movement", "v_brake").targeting("js2_ "),
        ] {
            let once = apply(DOC, &edit).unwrap();
            let twice = apply(&once, &edit).unwrap();
            assert_eq!(once, DOC);
            assert_eq!(twice, once);
        }
    }

    #[test]
    fn clearing_without_an_identifiable_device_keeps_the_empty_fallback() {
        for binding in [
            r#"<rebind/>"#,
            r#"<rebind input=""/>"#,
            r#"<rebind input="unknown"/>"#,
            "",
        ] {
            let doc = format!(
                r#"<ActionMaps><actionmap name="player"><action name="jump">{binding}</action></actionmap></ActionMaps>"#
            );
            let out = apply(&doc, &BindingEdit::clear("player", "jump")).unwrap();
            assert_eq!(reparse(&out, "player", "jump").as_deref(), Some(""));
        }
    }

    #[test]
    fn explicit_gesture_changes_only_the_target_and_clears_stale_multi_tap() {
        for (gesture, mode, taps) in [
            (BindingGesture::ShortPress, "tap", "1"),
            (BindingGesture::DoubleTap, "double_tap", "2"),
            (BindingGesture::LongPress, "delayed_press", "1"),
        ] {
            for closing in ["/>", "></rebind>"] {
                let xml = format!(
                    r#"<ActionMaps><actionmap name="player"><action name="test"><rebind input="kb1_lctrl+f" activationMode="hold_toggle" multiTap="3" custom="keep"{closing}<rebind input="js2_button1" activationMode="hold"/></action></actionmap></ActionMaps>"#
                );
                let mut edit =
                    BindingEdit::set("player", "test", "kb1_lctrl+g").targeting("kb1_lctrl+f");
                edit.gesture = Some(gesture);
                let updated = apply(&xml, &edit).unwrap();
                assert!(updated.contains(&format!(
                    r#"input="kb1_lctrl+g" custom="keep" activationMode="{mode}" multiTap="{taps}""#
                )));
                assert!(updated.contains(r#"input="js2_button1" activationMode="hold""#));
                assert!(!updated.contains("hold_toggle"));
                assert!(!updated.contains(r#"multiTap="3""#));
                spacemapper_core::actionmaps::parse_str(&updated).unwrap();
            }
        }
    }

    #[test]
    fn gesture_only_edit_and_new_default_override_are_persisted() {
        let mut edit = BindingEdit::set("player", "test", "js1_button7");
        edit.activation_mode = Some("double_tap".into());
        edit.multi_tap = Some("2".into());
        edit.gesture = Some(BindingGesture::LongPress);
        let created = apply(
            "<ActionMaps><ActionProfiles></ActionProfiles></ActionMaps>",
            &edit,
        )
        .unwrap();
        assert!(
            created.contains(r#"input="js1_button7" activationMode="delayed_press" multiTap="1""#)
        );
        edit.gesture = Some(BindingGesture::ShortPress);
        edit.original_input = Some("js1_button7".into());
        let changed = apply(&created, &edit).unwrap();
        assert!(changed.contains(r#"input="js1_button7" activationMode="tap" multiTap="1""#));
        assert!(!changed.contains("delayed_press"));
    }

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

    fn with_gesture(
        mut edit: BindingEdit,
        activation_mode: Option<&str>,
        multi_tap: Option<&str>,
    ) -> BindingEdit {
        edit.activation_mode = activation_mode.map(str::to_string);
        edit.multi_tap = multi_tap.map(str::to_string);
        edit
    }

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
    fn replacing_never_overwrites_existing_gesture_attributes() {
        let doc = r#"<ActionMaps><ActionProfiles>
  <actionmap name="player">
   <action name="v_use">
    <rebind input="kb1_f" activationMode="tap" multiTap="2" custom="kept"/>
   </action>
  </actionmap>
 </ActionProfiles></ActionMaps>"#;
        // Ces métadonnées accompagnent la modification parce que le frontend
        // ne sait pas à l'avance si le writer devra insérer ou remplacer. Sur
        // une ligne existante, elles ne doivent jamais supplanter le XML.
        let edit = with_gesture(
            BindingEdit::set("player", "v_use", "kb1_e"),
            Some("hold"),
            Some("3"),
        );
        let out = apply(doc, &edit).unwrap();

        assert!(
            out.contains(
                r#"<rebind input="kb1_e" activationMode="tap" multiTap="2" custom="kept"/>"#
            ),
            "les attributs voisins ont été écrasés: {out}"
        );
        assert!(!out.contains(r#"activationMode="hold""#), "{out}");
        assert!(!out.contains(r#"multiTap="3""#), "{out}");
    }

    #[test]
    fn clearing_writes_the_games_own_unbound_form() {
        let out = apply(DOC, &BindingEdit::clear("spaceship_movement", "v_boost")).unwrap();
        assert_eq!(
            out,
            DOC.replacen(r#"input="js1_button5""#, r#"input="js1_ ""#, 1)
        );
    }

    #[test]
    fn clearing_preserves_each_device_and_existing_gesture() {
        for (original, cleared) in [
            ("kb1_lshift+a", "kb1_ "),
            ("mo1_mouse1", "mo1_ "),
            ("gp1_x", "gp1_ "),
            ("js3_button5", "js3_ "),
            ("js10_rctrl+button1", "js10_ "),
            ("js2_ ", "js2_ "),
        ] {
            for closing in ["/>", "></rebind>"] {
                let xml = format!(
                    r#"<ActionMaps><actionmap name="spaceship_movement"><action name="v_strafe_left"><rebind input="{original}" activationMode="hold" multiTap="2"{closing}</action></actionmap></ActionMaps>"#
                );
                for edit in [
                    BindingEdit::clear("spaceship_movement", "v_strafe_left"),
                    BindingEdit::clear("spaceship_movement", "v_strafe_left").targeting(original),
                ] {
                    let out = apply(&xml, &edit).unwrap();
                    let maps = spacemapper_core::actionmaps::parse_str(&out).unwrap();
                    let rebind = maps.rebinds().next().unwrap().2;
                    assert_eq!(rebind.input_raw, cleared);
                    assert!(rebind.is_unbound());
                    assert_eq!(rebind.activation_mode.as_deref(), Some("hold"));
                    assert_eq!(rebind.multi_tap.as_deref(), Some("2"));
                    let clear_again = BindingEdit::clear("spaceship_movement", "v_strafe_left")
                        .targeting(cleared);
                    assert_eq!(apply(&out, &clear_again).unwrap(), out);
                }
            }
        }
    }

    #[test]
    fn clearing_an_implicit_default_creates_a_device_specific_override() {
        let edit = BindingEdit::clear("spaceship_movement", "v_strafe_left").targeting("kb1_a");
        for xml in [
            "<ActionMaps><ActionProfiles></ActionProfiles></ActionMaps>",
            r#"<ActionMaps><actionmap name="spaceship_movement"></actionmap></ActionMaps>"#,
            r#"<ActionMaps><actionmap name="spaceship_movement"><action name="v_strafe_left"></action></actionmap></ActionMaps>"#,
            r#"<ActionMaps><actionmap name="spaceship_movement"><action name="v_strafe_left"><rebind input="js3_button1"/></action></actionmap></ActionMaps>"#,
        ] {
            let out = apply(xml, &edit).unwrap();
            let maps = spacemapper_core::actionmaps::parse_str(&out).unwrap();
            let keyboard = maps
                .rebinds()
                .find(|(_, _, r)| r.input_raw == "kb1_ ")
                .unwrap()
                .2;
            assert!(matches!(
                keyboard.kind(),
                spacemapper_core::actionmaps::RebindKind::UnboundOn {
                    device_kind: spacemapper_core::actionmaps::DeviceKind::Keyboard,
                    instance: 1
                }
            ));
            assert_eq!(out.contains("js3_button1"), xml.contains("js3_button1"));
            assert_eq!(out.matches(r#"name="v_strafe_left""#).count(), 1);
        }
    }

    #[test]
    fn clearing_one_sibling_preserves_all_other_devices() {
        let xml = r#"<ActionMaps><actionmap name="spaceship_movement"><action name="v_strafe_left"><rebind input="kb1_a"/><rebind input="js1_button1"/><rebind input="js10_button1"/></action></actionmap></ActionMaps>"#;
        let out = apply_many(
            xml,
            &[
                BindingEdit::clear("spaceship_movement", "v_strafe_left").targeting("kb1_a"),
                BindingEdit::clear("spaceship_movement", "v_strafe_left").targeting("js1_button1"),
            ],
        )
        .unwrap();
        let maps = spacemapper_core::actionmaps::parse_str(&out).unwrap();
        let inputs: Vec<_> = maps
            .rebinds()
            .map(|(_, _, r)| r.input_raw.as_str())
            .collect();
        assert_eq!(inputs, ["kb1_ ", "js1_ ", "js10_button1"]);
    }

    #[test]
    fn clearing_without_any_device_keeps_the_generic_empty_form() {
        let out = apply(
            "<ActionMaps><ActionProfiles></ActionProfiles></ActionMaps>",
            &BindingEdit::clear("spaceship_movement", "v_strafe_left"),
        )
        .unwrap();
        assert_eq!(
            reparse(&out, "spaceship_movement", "v_strafe_left").as_deref(),
            Some("")
        );
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

    /// Relit le document produit et renvoie l'assignation demandée.
    ///
    /// Vérifier le texte à la main laisserait passer un XML mal formé ; on
    /// exige que notre propre parseur y retrouve la valeur.
    fn reparse(xml: &str, actionmap: &str, action: &str) -> Option<String> {
        let maps = spacemapper_core::actionmaps::parse_str(xml).ok()?;
        let found = maps
            .rebinds()
            .find(|(m, a, _)| m.name == actionmap && a.name == action)
            .map(|(_, _, r)| r.input_raw.clone());
        found
    }

    #[test]
    fn a_missing_action_is_created() {
        // Surcharger une valeur par défaut du jeu revient à écrire une action
        // absente du fichier : c'est devenu le cas courant.
        let out = apply(
            DOC,
            &BindingEdit::set("spaceship_movement", "v_pitch", "js1_y"),
        )
        .unwrap();

        assert_eq!(
            reparse(&out, "spaceship_movement", "v_pitch").as_deref(),
            Some("js1_y")
        );
        // Le reste du document survit.
        assert_eq!(
            reparse(&out, "spaceship_movement", "v_boost").as_deref(),
            Some("js1_button5")
        );
    }

    #[test]
    fn a_first_override_keeps_the_default_gesture_on_insertion() {
        // Une assignation `game_default` n'a encore aucune balise dans
        // actionmaps.xml. Sa première surcharge doit matérialiser le geste
        // effectif, sinon un double-appui devient silencieusement un appui
        // simple dès que l'utilisateur change seulement sa touche.
        let edit = with_gesture(
            BindingEdit::set("spaceship_movement", "v_pitch", "js1_button7"),
            Some("double_tap_nonblocking"),
            Some("2"),
        );
        let out = apply(DOC, &edit).unwrap();
        let maps = spacemapper_core::actionmaps::parse_str(&out).unwrap();
        let inserted = maps
            .rebinds()
            .find(|(map, action, _)| map.name == "spaceship_movement" && action.name == "v_pitch")
            .map(|(_, _, rebind)| rebind)
            .expect("première surcharge absente");

        assert_eq!(inserted.input_raw, "js1_button7");
        assert_eq!(
            inserted.activation_mode.as_deref(),
            Some("double_tap_nonblocking")
        );
        assert_eq!(inserted.multi_tap.as_deref(), Some("2"));
    }

    #[test]
    fn a_first_override_on_a_second_device_family_keeps_its_gesture() {
        // L'action existe déjà à cause d'une surcharge clavier, mais son défaut
        // joystick n'a encore aucune balise. Le ciblage ne trouve donc pas
        // `js1_y` et doit ajouter un frère sans modifier le clavier.
        let doc = r#"<ActionMaps><ActionProfiles>
  <actionmap name="spaceship_movement">
   <action name="v_pitch"><rebind input="kb1_up"/></action>
  </actionmap>
 </ActionProfiles></ActionMaps>"#;
        let edit = with_gesture(
            BindingEdit::set("spaceship_movement", "v_pitch", "js2_y").targeting("js1_y"),
            Some("hold"),
            None,
        );
        let out = apply(doc, &edit).unwrap();
        let maps = spacemapper_core::actionmaps::parse_str(&out).unwrap();
        let rows: Vec<_> = maps
            .rebinds()
            .filter(|(map, action, _)| map.name == "spaceship_movement" && action.name == "v_pitch")
            .map(|(_, _, rebind)| rebind)
            .collect();

        assert_eq!(rows.len(), 2, "le défaut aurait remplacé le clavier: {out}");
        assert!(rows.iter().any(|row| row.input_raw == "kb1_up"));
        let joystick = rows
            .iter()
            .find(|row| row.input_raw == "js2_y")
            .expect("surcharge joystick absente");
        assert_eq!(joystick.activation_mode.as_deref(), Some("hold"));
        assert!(joystick.multi_tap.is_none());
    }

    #[test]
    fn a_missing_actionmap_is_created() {
        let out = apply(DOC, &BindingEdit::set("player", "moveforward", "kb1_w")).unwrap();
        assert_eq!(
            reparse(&out, "player", "moveforward").as_deref(),
            Some("kb1_w")
        );
    }

    #[test]
    fn an_action_without_any_rebind_receives_one() {
        // Forme rare mais valide : l'action existe, sans assignation.
        let doc = r#"<ActionMaps><ActionProfiles>
  <actionmap name="spaceship_movement">
   <action name="v_pitch"></action>
  </actionmap>
 </ActionProfiles></ActionMaps>"#;

        let out = apply(
            doc,
            &BindingEdit::set("spaceship_movement", "v_pitch", "js2_rotz"),
        )
        .unwrap();
        assert_eq!(
            reparse(&out, "spaceship_movement", "v_pitch").as_deref(),
            Some("js2_rotz")
        );
    }

    #[test]
    fn creation_stays_idempotent() {
        // Deux passages successifs ne doivent pas produire deux actions du
        // même nom, que le jeu lirait de façon imprévisible.
        let once = apply(
            DOC,
            &BindingEdit::set("spaceship_movement", "v_pitch", "js1_y"),
        )
        .unwrap();
        let twice = apply(
            &once,
            &BindingEdit::set("spaceship_movement", "v_pitch", "js1_y"),
        )
        .unwrap();

        assert_eq!(once, twice);
        assert_eq!(once.matches(r#"name="v_pitch""#).count(), 1);
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
    fn apply_many_applies_every_edit() {
        let out = apply_many(
            DOC,
            &[
                BindingEdit::set("spaceship_movement", "v_boost", "js1_button9"),
                BindingEdit::clear("spaceship_movement", "v_brake"),
            ],
        )
        .unwrap();

        assert!(out.contains(r#"input="js1_button9""#));
        assert!(out.contains(r#"<rebind input="js2_ "/>"#));
    }

    #[test]
    fn apply_many_stops_at_the_first_failure() {
        // Un enregistrement partiel laisserait l'utilisateur avec un fichier
        // dans un état qu'il n'a pas demandé et ne peut pas deviner. Un
        // document sans point d'insertion fait donc échouer tout le lot.
        let err = apply_many(
            "<Nope/>",
            &[
                BindingEdit::set("spaceship_movement", "v_boost", "js1_button9"),
                BindingEdit::set("spaceship_movement", "v_pitch", "js1_y"),
            ],
        )
        .unwrap_err();

        assert!(matches!(err, Error::NoInsertionPoint { .. }));
    }

    #[test]
    fn targeting_hits_the_right_sibling_rebind() {
        // Une action à deux surcharges (clavier + manche) : sans précision,
        // on toucherait la première trouvée — ici le clavier — alors que
        // c'est le manche qu'on veut changer.
        let doc = r#"<ActionMaps><ActionProfiles>
  <actionmap name="player">
   <action name="moveforward">
    <rebind input="kb1_w"/>
    <rebind input="js3_button1"/>
   </action>
  </actionmap>
 </ActionProfiles></ActionMaps>"#;

        let out = apply(
            doc,
            &BindingEdit::set("player", "moveforward", "js3_button2").targeting("js3_button1"),
        )
        .unwrap();

        assert!(out.contains(r#"input="js3_button2""#), "{out}");
        assert!(
            out.contains(r#"input="kb1_w""#),
            "le clavier n'aurait pas dû bouger: {out}"
        );
    }

    #[test]
    fn targeting_does_not_confuse_a_short_instance_with_a_longer_one() {
        // Un préfixe de famille (`js1`) aurait aussi matché `js10` : un vrai
        // risque pour les configurations HOSAS/multi-manche. La
        // correspondance exacte sur `original_input` n'a pas ce problème.
        let doc = r#"<ActionMaps><ActionProfiles>
  <actionmap name="player">
   <action name="moveforward">
    <rebind input="js1_button1"/>
    <rebind input="js10_button1"/>
   </action>
  </actionmap>
 </ActionProfiles></ActionMaps>"#;

        let out = apply(
            doc,
            &BindingEdit::set("player", "moveforward", "js1_button9").targeting("js1_button1"),
        )
        .unwrap();

        assert!(out.contains(r#"input="js1_button9""#), "{out}");
        assert!(
            out.contains(r#"input="js10_button1""#),
            "js10 n'aurait pas dû bouger: {out}"
        );
    }

    #[test]
    fn targeting_survives_a_batch_that_reassigns_a_sibling_into_the_same_family() {
        // Le cas piégeux : dans un même lot, la ligne clavier est réassignée
        // vers le manche 3 (même famille que l'autre ligne de l'action), et
        // la ligne manche 3 d'origine est éditée elle aussi. Un filtrage par
        // simple préfixe de famille se serait fait tromper par la première
        // réécriture ; `original_input` continue de désigner l'élément
        // d'avant le lot, quel que soit l'ordre d'application.
        let doc = r#"<ActionMaps><ActionProfiles>
  <actionmap name="player">
   <action name="moveforward">
    <rebind input="kb1_w"/>
    <rebind input="js3_button1"/>
   </action>
  </actionmap>
 </ActionProfiles></ActionMaps>"#;

        let edits = [
            BindingEdit::set("player", "moveforward", "js3_button5").targeting("kb1_w"),
            BindingEdit::set("player", "moveforward", "js3_button9").targeting("js3_button1"),
        ];

        for ordered in [edits.clone(), [edits[1].clone(), edits[0].clone()]] {
            let out = apply_many(doc, &ordered).unwrap();
            assert!(
                out.contains(r#"input="js3_button5""#) && out.contains(r#"input="js3_button9""#),
                "les deux modifications doivent aboutir, quel que soit l'ordre: {out}"
            );
        }
    }

    #[test]
    fn targeting_appends_a_new_rebind_when_nothing_matches() {
        // L'action n'a qu'une surcharge clavier : lui assigner un manche pour
        // la première fois doit ajouter un second `<rebind>`, pas remplacer
        // celui du clavier. C'est aussi le cas d'une ligne « défaut » jamais
        // écrite dans le fichier : son `original_input` (ex. `kb1_w`) ne
        // correspond à rien de réel, donc rien ne matche et une entrée est
        // créée — le comportement voulu.
        let doc = r#"<ActionMaps><ActionProfiles>
  <actionmap name="player">
   <action name="moveforward">
    <rebind input="kb1_w"/>
   </action>
  </actionmap>
 </ActionProfiles></ActionMaps>"#;

        let out = apply(
            doc,
            &BindingEdit::set("player", "moveforward", "js3_button2").targeting("js3_ "),
        )
        .unwrap();

        assert!(out.contains(r#"input="kb1_w""#), "{out}");
        assert!(out.contains(r#"input="js3_button2""#), "{out}");
        assert_eq!(out.matches("<rebind").count(), 2);
    }

    #[test]
    fn without_targeting_the_first_rebind_is_still_hit() {
        // Rétrocompatibilité : les appelants qui ne précisent rien (tout le
        // code existant) doivent se comporter exactement comme avant.
        let doc = r#"<ActionMaps><ActionProfiles>
  <actionmap name="player">
   <action name="moveforward">
    <rebind input="kb1_w"/>
    <rebind input="js3_button1"/>
   </action>
  </actionmap>
 </ActionProfiles></ActionMaps>"#;

        let out = apply(doc, &BindingEdit::set("player", "moveforward", "kb1_o")).unwrap();

        assert!(out.contains(r#"input="kb1_o""#), "{out}");
        assert!(out.contains(r#"input="js3_button1""#), "{out}");
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
