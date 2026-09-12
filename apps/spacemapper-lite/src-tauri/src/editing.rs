//! Commandes d'édition et de points de restauration.
//!
//! L'édition Lite se limite au pilotage et au déplacement à pied. Cette limite
//! est appliquée par `spacemapper-edit`, en Rust : ces commandes ne font que
//! transmettre, elles ne décident pas du périmètre. Une action hors périmètre
//! est refusée même si le frontend la propose.
//!
//! Les modifications s'accumulent côté interface et ne touchent le disque qu'au
//! moment où l'utilisateur enregistre, via [`save_bindings`]. Le point de
//! restauration est proposé à cet instant précis, plutôt qu'imposé à chaque
//! écriture : c'est le seul moment où l'utilisateur sait ce qu'il s'apprête à
//! changer.

use serde::{Deserialize, Serialize};
use spacemapper_app_support::conflict_reviews::{self, ConflictReview};
use spacemapper_app_support::gamedata::GameData;
use spacemapper_app_support::settings as app_settings;
use spacemapper_core::actionmaps::{self, ActionMaps, DeviceKind, InputBinding};
use spacemapper_core::channel;
use spacemapper_core::context::{self, Context};
use spacemapper_core::defaults::DefaultProfile;
use spacemapper_core::triggers::TriggerAttributes;
use spacemapper_edit::{backup, scope, BindingEdit, EditAccess, EditCategory};
use std::collections::{BTreeMap, HashSet};
use std::path::{Path, PathBuf};

type CmdResult<T> = Result<T, String>;

/// Pourquoi une assignation ne peut pas être modifiée ici.
///
/// Un code plutôt qu'une phrase : le texte affiché dépend de la langue de
/// l'interface, que seul le frontend connaît. Renvoyer du français figé
/// rendrait l'application intraduisible.
///
/// Les deux seuls motifs restants relèvent du périmètre commercial de Lite.
/// Un modificateur ou un mode d'activation ne verrouillent plus rien : la
/// capture sait déjà produire un jeton complet (`kb1_lshift+f`), et
/// `spacemapper_edit::writer` réécrit `input` sans toucher aux attributs
/// `activationMode`/`multiTap` voisins — les verrouiller relevait d'une
/// prudence de l'éditeur à champ unique, pas d'une limite réelle.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum LockReason {
    /// Action irréversible : autodestruction, éjection.
    DangerousAction,
    /// Catégorie de vitrine, réservée au Premium.
    PremiumCategory,
}

/// D'où vient une assignation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Origin {
    /// Écrite dans `actionmaps.xml` par le joueur ou par le jeu.
    Override,
    /// Fournie par le jeu et jamais modifiée : elle n'existe que dans
    /// `Data.p4k`. C'est la majorité d'une configuration qui fonctionne.
    GameDefault,
}

/// Une assignation présentée à l'édition.
#[derive(Debug, Serialize)]
pub struct EditableBinding {
    pub actionmap: String,
    pub category: EditCategory,
    /// Niveau d'accès : modifiable, ou verrouillé derrière le Premium.
    pub access: EditAccess,
    pub origin: Origin,
    pub action: String,
    /// Libellé fourni par le jeu, dans la langue choisie. `None` si l'action
    /// n'est pas cataloguée : l'interface retombe alors sur ses propres noms.
    pub label: Option<String>,
    /// Description fournie par le jeu — sa réponse à « à quoi sert cette
    /// touche ? ». Souvent vide hors anglais.
    pub description: Option<String>,
    /// Groupe utilisé par la politique de diagnostic des conflits.
    pub context: Context,
    pub input_raw: String,
    pub device: Option<String>,
    /// Touche modificatrice, ex. `lshift` dans `kb1_lshift+f`.
    ///
    /// Séparée du contrôle et non repliée dedans : sans elle, l'interface
    /// affichait `kb1 f` pour une assignation qui exige en réalité Maj+F.
    pub modifier: Option<String>,
    pub control: Option<String>,
    /// `Some("press")`, etc. — jamais un motif de verrouillage, seulement une
    /// information affichée pour qui édite une assignation qui en porte un.
    pub activation_mode: Option<String>,
    pub multi_tap: Option<String>,
    pub trigger_attributes: TriggerAttributes,
    /// Action/device/rebind attributes, before expanding the activation mode.
    pub explicit_trigger_attributes: TriggerAttributes,
    /// Motif du verrouillage, ou `None` si l'assignation est modifiable.
    pub lock: Option<LockReason>,
}

/// Une modification en attente, telle que la transmet l'interface.
#[derive(Debug, Deserialize)]
pub struct PendingEdit {
    pub actionmap: String,
    pub action: String,
    /// `None` efface l'assignation.
    pub input: Option<String>,
    /// Valeur `input` de la ligne éditée avant modification, quand l'action
    /// en porte plusieurs — voir [`spacemapper_edit::BindingEdit::original_input`].
    pub original_input: Option<String>,
}

impl From<&PendingEdit> for BindingEdit {
    fn from(p: &PendingEdit) -> Self {
        BindingEdit {
            actionmap: p.actionmap.clone(),
            action: p.action.clone(),
            input: p.input.clone(),
            // Lite réassigne le contrôle sans modifier son geste d'activation.
            activation_mode: None,
            multi_tap: None,
            gesture: None,
            original_input: p.original_input.clone(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct BackupView {
    pub path: String,
    pub timestamp: String,
}

/// Nom d'application utilisé pour isoler les données de Lite de toute autre
/// édition (Premium) sur la même machine — voir `spacemapper_core::channel`.
const APP_NAME: &str = "SpaceMapper";

/// Emplacement des sauvegardes, isolé par canal et par édition.
fn backup_dir() -> CmdResult<PathBuf> {
    channel::data_dir(APP_NAME)
        .map(|d| d.join("Backups"))
        .ok_or_else(|| "APPDATA introuvable".to_string())
}

/// Les assignations que l'édition Lite peut modifier.
///
/// Les surcharges du joueur et les valeurs par défaut du jeu sont fusionnées :
/// sans cela, la liste ne montrerait qu'une fraction d'une configuration qui
/// fonctionne, et le joueur chercherait en vain ses axes de vol.
///
/// L'indisponibilité du profil par défaut n'est pas bloquante : on affiche
/// alors les seules surcharges, et l'appelant en est informé.
#[tauri::command]
pub fn list_editable_bindings(
    state: tauri::State<'_, GameData>,
    path: String,
) -> CmdResult<MergedBindings> {
    let maps = actionmaps::parse_file(PathBuf::from(&path)).map_err(|e| e.to_string())?;

    let (defaults, defaults_error) = match state.profile_for(Path::new(&path)) {
        Ok(profile) => (Some(profile), None),
        Err(message) => (None, Some(message)),
    };

    let language = app_settings::load(APP_NAME).game_language;
    let catalog = state.catalog_for(Path::new(&path), &language);

    let mut bindings = collect_editable(&maps, defaults.as_deref());
    label_from_game(&mut bindings, defaults.as_deref(), &catalog);

    let (conflict_reviews, conflict_reviews_error) =
        conflict_reviews::load(APP_NAME, Path::new(&path));
    Ok(MergedBindings {
        bindings,
        defaults_error,
        colliding_contexts: colliding_contexts(),
        conflict_reviews,
        conflict_reviews_error,
        activation_modes: defaults
            .as_deref()
            .map(|p| p.activation_modes.clone())
            .unwrap_or_default(),
    })
}

/// Complète chaque assignation avec le vocabulaire du jeu.
///
/// Les clés de libellé vivent dans le profil par défaut, y compris pour les
/// actions que le joueur a surchargées : c'est donc lui qu'on interroge, quelle
/// que soit l'origine de l'assignation.
fn label_from_game(
    bindings: &mut [EditableBinding],
    defaults: Option<&DefaultProfile>,
    catalog: &spacemapper_core::localization::Catalog,
) {
    let Some(defaults) = defaults else {
        return;
    };
    if catalog.is_empty() {
        return;
    }

    for binding in bindings {
        let Some(action) = defaults.action(&binding.actionmap, &binding.action) else {
            continue;
        };
        // Une traduction vide ne vaut pas mieux qu'une absence : elle
        // afficherait une ligne sans nom.
        binding.label = action
            .ui_label
            .as_deref()
            .and_then(|key| catalog.get(key))
            .filter(|value| !value.is_empty())
            .map(str::to_string);
        binding.description = action
            .ui_description
            .as_deref()
            .and_then(|key| catalog.get(key))
            .filter(|value| !value.is_empty())
            .map(str::to_string);
    }
}

/// Une langue proposée à l'utilisateur.
#[derive(Debug, Serialize)]
pub struct Language {
    /// Identifiant employé par l'archive, ex. `french_(france)`.
    pub id: String,
    pub label: String,
}

/// Langues réellement présentes dans l'installation du joueur.
#[tauri::command]
pub fn list_game_languages(
    state: tauri::State<'_, GameData>,
    path: String,
) -> CmdResult<Vec<Language>> {
    Ok(state
        .languages_for(Path::new(&path))?
        .into_iter()
        .map(|id| Language {
            label: spacemapper_core::localization::display_name(&id),
            id,
        })
        .collect())
}

#[tauri::command]
pub fn get_settings() -> app_settings::Settings {
    app_settings::load(APP_NAME)
}

#[tauri::command]
pub fn set_settings(settings: app_settings::Settings) -> CmdResult<()> {
    app_settings::save(APP_NAME, &settings)
}

#[derive(Debug, Serialize)]
pub struct MergedBindings {
    pub bindings: Vec<EditableBinding>,
    /// Motif d'indisponibilité des valeurs par défaut, le cas échéant.
    pub defaults_error: Option<String>,
    /// Paires de groupes comparés par le diagnostic.
    ///
    /// Transmis une seule fois plutôt que réimplémenté côté interface : la
    /// règle est testée en Rust, et la dupliquer en TypeScript garantirait de
    /// les voir diverger au premier patch du jeu.
    pub colliding_contexts: Vec<[Context; 2]>,
    pub conflict_reviews: Vec<ConflictReview>,
    pub conflict_reviews_error: Option<String>,
    pub activation_modes: BTreeMap<String, TriggerAttributes>,
}

/// Toutes les paires autorisées par le diagnostic, y compris réflexives.
fn colliding_contexts() -> Vec<[Context; 2]> {
    const ALL: [Context; 12] = [
        Context::OnFoot,
        Context::ShipSeat,
        Context::ShipScanning,
        Context::ShipMining,
        Context::ShipSalvage,
        Context::Turret,
        Context::Eva,
        Context::GroundVehicle,
        Context::Map,
        Context::InterfaceHud,
        Context::Always,
        Context::OutOfGame,
    ];

    let mut pairs = Vec::new();
    for (i, a) in ALL.iter().enumerate() {
        for b in &ALL[i..] {
            if context::can_collide(*a, *b) {
                pairs.push([*a, *b]);
            }
        }
    }
    pairs
}

/// Enregistre un lot de modifications en une seule écriture.
///
/// Les modifications s'accumulent côté interface jusqu'à ce que l'utilisateur
/// valide : le fichier du jeu n'est touché qu'ici, et une seule fois. Si
/// `create_restore_point` est vrai, une copie du profil est déposée **avant**
/// l'écriture ; son chemin est renvoyé.
///
/// Un lot invalide est refusé en bloc : mieux vaut ne rien écrire qu'un état
/// intermédiaire que l'utilisateur n'a pas demandé.
#[tauri::command]
pub fn save_bindings(
    path: String,
    edits: Vec<PendingEdit>,
    create_restore_point: bool,
) -> CmdResult<Option<String>> {
    if edits.is_empty() {
        return Ok(None);
    }

    let target = Path::new(&path);
    let converted: Vec<BindingEdit> = edits.iter().map(BindingEdit::from).collect();

    let saved = if create_restore_point {
        let dir = backup_dir()?;
        Some(
            backup::create(target, &dir)
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .into_owned(),
        )
    } else {
        None
    };

    spacemapper_edit::apply_all_to_file(target, &converted).map_err(|e| e.to_string())?;
    Ok(saved)
}

/// Crée un point de restauration du profil courant.
///
/// Renvoie le chemin du fichier créé, pour que l'interface puisse indiquer à
/// l'utilisateur où se trouve son filet.
#[tauri::command]
pub fn create_backup(path: String) -> CmdResult<String> {
    let dir = backup_dir()?;
    backup::create(Path::new(&path), &dir)
        .map(|saved| saved.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_backups() -> CmdResult<Vec<BackupView>> {
    let dir = backup_dir()?;
    backup::list(&dir)
        .map_err(|e| e.to_string())
        .map(|entries| entries.into_iter().map(BackupView::from).collect())
}

/// Supprime définitivement un point de restauration.
///
/// Le dossier de sauvegardes est déterminé **ici**, jamais transmis par
/// l'interface : c'est ce qui permet à `backup::delete` de refuser toute cible
/// qui n'est pas une sauvegarde de SpaceMapper.
#[tauri::command]
pub fn delete_backup(backup_path: String) -> CmdResult<()> {
    let dir = backup_dir()?;
    backup::delete(Path::new(&backup_path), &dir).map_err(|e| e.to_string())
}

/// Restaure un point de restauration par-dessus le profil courant.
#[tauri::command]
pub fn restore_backup(path: String, backup_path: String) -> CmdResult<()> {
    backup::restore(Path::new(&backup_path), Path::new(&path)).map_err(|e| e.to_string())
}

impl From<backup::BackupEntry> for BackupView {
    fn from(entry: backup::BackupEntry) -> Self {
        BackupView {
            path: entry.path.to_string_lossy().into_owned(),
            // L'horodatage brut est mis en forme côté interface, qui connaît
            // la locale de l'utilisateur.
            timestamp: entry.timestamp.to_string(),
        }
    }
}

/// Fusionne surcharges et valeurs par défaut.
///
/// Une surcharge l'emporte toujours : c'est ce que le jeu fait lui-même. Les
/// défauts qui n'ont pas été surchargés sont ajoutés ensuite, marqués comme
/// tels, afin que la liste reflète la configuration réellement en vigueur.
///
/// La fusion se fait **par famille de périphérique**, pas par action entière.
/// Une action peut porter une surcharge clavier et une surcharge manche à la
/// fois — et inversement, surcharger le manche seul (même pour dire « rien
/// ici », la forme `jsN_ ` que le jeu écrit en masse) ne dit rien du clavier,
/// qui reste au défaut. Traiter « une surcharge existe » comme « le fichier
/// fait autorité pour toute l'action » faisait disparaître des touches
/// parfaitement actives : c'est le bug derrière l'absence
/// d'« Avancer/Reculer/Aller à gauche/droite », dont le clavier n'a jamais
/// été touché mais dont le manche 3 porte un `jsN_ ` vide.
fn collect_editable(maps: &ActionMaps, defaults: Option<&DefaultProfile>) -> Vec<EditableBinding> {
    let mut bindings = collect_overrides(maps);

    let Some(defaults) = defaults else {
        return bindings;
    };

    // Un rebind sans activationMode change le bouton, pas le geste défini par
    // l'action du jeu. Une valeur explicite, même vide, reste prioritaire.
    for binding in &mut bindings {
        let Some((kind, _)) = InputBinding::parse_head(&binding.input_raw) else {
            continue;
        };
        let action = defaults.action(&binding.actionmap, &binding.action);
        let mut attributes = action
            .map(|a| a.explicit_trigger_attributes_for(kind))
            .unwrap_or_default();
        attributes.extend(binding.trigger_attributes.clone());
        binding.explicit_trigger_attributes = attributes.clone();
        if binding.activation_mode.is_none() {
            binding.activation_mode = action
                .and_then(|a| a.activation_mode_for(kind))
                .map(str::to_string);
        }
        binding.trigger_attributes =
            defaults.resolve_trigger_attributes(binding.activation_mode.as_deref(), &attributes);
        if binding.multi_tap.is_none() {
            binding.multi_tap = binding.trigger_attributes.get("multiTap").cloned();
        }
    }

    // Familles déjà couvertes par une surcharge, par action — dérivé du
    // document brut via `Rebind::kind()`, la même classification que le reste
    // du crate utilise déjà pour distinguer « rien sur ce périphérique » de
    // « illisible ». Une surcharge dont le périphérique ne se laisse pas
    // identifier (`Unbound`/`Unparseable`) ne renseigne aucune famille : elle
    // ne bloque donc plus les familles voisines, correctement identifiées,
    // qui doivent quand même recevoir leur défaut.
    let mut known_families: HashSet<(String, String, DeviceKind)> = HashSet::new();

    for (map, action, rebind) in maps.rebinds() {
        let device_kind = match rebind.kind() {
            actionmaps::RebindKind::Bound => rebind.input.as_ref().map(|i| i.device_kind),
            actionmaps::RebindKind::UnboundOn { device_kind, .. } => Some(device_kind),
            actionmaps::RebindKind::Unbound | actionmaps::RebindKind::Unparseable => None,
        };
        if let Some(device_kind) = device_kind {
            known_families.insert((map.name.clone(), action.name.clone(), device_kind));
        }
    }

    for map in &defaults.action_maps {
        let Some(access) = scope::access_of(&map.name) else {
            continue;
        };
        if access == EditAccess::PremiumOnly {
            continue;
        }
        let Some(category) = scope::category_of(&map.name) else {
            continue;
        };

        for action in &map.actions {
            // Le profil par défaut peut définir plusieurs familles à la fois
            // (ex. clavier ET manche) : une ligne par famille non couverte,
            // pas une seule pour toute l'action.
            for device_kind in [
                DeviceKind::Joystick,
                DeviceKind::Keyboard,
                DeviceKind::Mouse,
                DeviceKind::Gamepad,
            ] {
                if known_families.contains(&(map.name.clone(), action.name.clone(), device_kind)) {
                    continue;
                }
                // Le profil par défaut applique toujours la valeur au premier
                // exemplaire de la famille — voir `default_token`/`token_for`.
                let prefix = format!("{}1", device_kind.prefix());
                for default_input in action.inputs_for(device_kind) {
                    let token = format!("{prefix}_{}", default_input.control);

                    let input = InputBinding::parse(&token);
                    let locked_reason = lock_reason(access, &action.name);

                    bindings.push(EditableBinding {
                        actionmap: map.name.clone(),
                        category,
                        access,
                        origin: Origin::GameDefault,
                        context: context::context_of(&map.name),
                        action: action.name.clone(),
                        // Renseigné ensuite, une fois le catalogue chargé.
                        label: None,
                        description: None,
                        input_raw: token.clone(),
                        device: input
                            .as_ref()
                            .map(|i| format!("{}{}", i.device_kind.prefix(), i.instance)),
                        modifier: input.as_ref().and_then(|i| i.modifier.clone()),
                        control: input.as_ref().map(|i| i.control.clone()),
                        activation_mode: default_input.activation_mode.clone(),
                        multi_tap: default_input.trigger_attributes.get("multiTap").cloned(),
                        trigger_attributes: default_input.trigger_attributes.clone(),
                        explicit_trigger_attributes: default_input
                            .explicit_trigger_attributes
                            .clone(),
                        lock: locked_reason,
                    });
                }
            }
        }
    }

    bindings
}

/// Motif de verrouillage, commun aux deux origines.
///
/// Uniquement le périmètre commercial : un modificateur ou un mode
/// d'activation ne verrouillent plus rien, voir [`LockReason`].
fn lock_reason(access: EditAccess, action: &str) -> Option<LockReason> {
    if scope::is_dangerous(action) {
        Some(LockReason::DangerousAction)
    } else if access == EditAccess::PremiumTeaser {
        Some(LockReason::PremiumCategory)
    } else {
        None
    }
}

fn collect_overrides(maps: &ActionMaps) -> Vec<EditableBinding> {
    maps.rebinds()
        .filter_map(|(map, action, rebind)| {
            // Les catégories réservées au Premium sans intérêt de vitrine sont
            // absentes de la liste, pas seulement grisées.
            let access = scope::access_of(&map.name)?;
            if access == EditAccess::PremiumOnly {
                return None;
            }
            let category = scope::category_of(&map.name)?;

            let (device, modifier, control) = match &rebind.input {
                Some(input) => (
                    Some(format!("{}{}", input.device_kind.prefix(), input.instance)),
                    input.modifier.clone(),
                    Some(input.control.clone()),
                ),
                None => (None, None, None),
            };

            let locked_reason = lock_reason(access, &action.name);

            Some(EditableBinding {
                actionmap: map.name.clone(),
                category,
                access,
                origin: Origin::Override,
                context: context::context_of(&map.name),
                action: action.name.clone(),
                label: None,
                description: None,
                input_raw: rebind.input_raw.clone(),
                device,
                modifier,
                control,
                // `Some("")` distingue un attribut vide (bug connu du client)
                // d'une absence : on transmet tel quel, l'interface décide de
                // ce qu'elle affiche.
                activation_mode: rebind.activation_mode.clone(),
                multi_tap: rebind.multi_tap.clone(),
                trigger_attributes: rebind.trigger_attributes.clone(),
                explicit_trigger_attributes: rebind.trigger_attributes.clone(),
                lock: locked_reason,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn merged_bindings_serializes_the_context_conflict_policy() {
        let response = MergedBindings {
            bindings: Vec::new(),
            defaults_error: None,
            colliding_contexts: colliding_contexts(),
            conflict_reviews: Vec::new(),
            conflict_reviews_error: None,
            activation_modes: BTreeMap::new(),
        };
        let serialized = serde_json::to_value(response).unwrap();

        // Le HUD/interface peut croiser les commandes à pied. Carte, EVA,
        // véhicules et spectateur sont exclus, y compris entre eux.
        assert_eq!(
            serialized["colliding_contexts"],
            serde_json::json!([
                ["on_foot", "on_foot"],
                ["on_foot", "interface_hud"],
                ["ship_seat", "ship_seat"],
                ["ship_seat", "ship_scanning"],
                ["ship_seat", "ship_mining"],
                ["ship_seat", "ship_salvage"],
                ["ship_seat", "interface_hud"],
                ["ship_seat", "always"],
                ["ship_scanning", "ship_scanning"],
                ["ship_scanning", "interface_hud"],
                ["ship_scanning", "always"],
                ["ship_mining", "ship_mining"],
                ["ship_mining", "interface_hud"],
                ["ship_mining", "always"],
                ["ship_salvage", "ship_salvage"],
                ["ship_salvage", "interface_hud"],
                ["ship_salvage", "always"],
                ["turret", "turret"],
                ["turret", "interface_hud"],
                ["turret", "always"],
                ["interface_hud", "interface_hud"],
                ["interface_hud", "always"],
                ["always", "always"]
            ])
        );
    }

    const DOC: &str = r#"<ActionMaps><ActionProfiles profileName="default">
  <actionmap name="spaceship_movement">
   <action name="v_afterburner"><rebind input="js1_button5"/></action>
   <action name="v_pitch_up"><rebind input="js1_rctrl+button6"/></action>
   <action name="v_roll_left"><rebind input="js1_hat1_down" multiTap="2"/></action>
   <action name="v_strafe_up"><rebind input="js2_ "/></action>
  </actionmap>
  <actionmap name="player">
   <action name="moveforward"><rebind input="kb1_w"/></action>
   <action name="moveleft"><rebind input="js3_ "/></action>
   <action name="moveright"><rebind input="BAD TOKEN"/></action>
  </actionmap>
  <actionmap name="vehicle_driver">
   <action name="v_boost"><rebind input="js1_button2"/></action>
  </actionmap>
  <actionmap name="player_emotes">
   <action name="emote_wave"><rebind input="kb1_1"/></action>
  </actionmap>
  <actionmap name="prone">
   <action name="prone_rollleft"><rebind input="kb1_q"/></action>
  </actionmap>
  <actionmap name="spaceship_power">
   <action name="v_power_toggle"><rebind input="js1_button7"/></action>
  </actionmap>
  <actionmap name="spaceship_general">
   <action name="v_self_destruct"><rebind input="js1_button8"/></action>
  </actionmap>
  <actionmap name="spaceship_weapons">
   <action name="v_attack1"><rebind input="js1_button1"/></action>
  </actionmap>
 </ActionProfiles></ActionMaps>"#;

    fn editable() -> Vec<EditableBinding> {
        collect_editable(&actionmaps::parse_str(DOC).unwrap(), None)
    }

    /// Profil par défaut minimal, calqué sur le fichier réel.
    const DEFAULTS: &str = r#"<profile version="1">
 <actionmap name="spaceship_movement" UILabel="@ui_CGSpaceFlightMovement">
  <action name="v_pitch" joystick="y" gamepad="thumbry"/>
  <action name="v_roll" joystick="rotz"/>
  <action name="v_afterburner" joystick="button8"/>
  <action name="v_sans_defaut" joystick=" " gamepad=" "/>
 </actionmap>
 <actionmap name="spaceship_weapons">
  <action name="v_attack1" joystick="button1"/>
 </actionmap>
 <actionmap name="player">
  <action name="moveleft" activationMode="hold" keyboard="a" joystick=" "/>
  <action name="moveright" activationMode="hold" keyboard="d" joystick=" "/>
 </actionmap>
</profile>"#;

    fn merged() -> Vec<EditableBinding> {
        let defaults = spacemapper_core::defaults::parse_str(DEFAULTS).unwrap();
        collect_editable(&actionmaps::parse_str(DOC).unwrap(), Some(&defaults))
    }

    #[test]
    fn overridden_self_destruct_and_eject_keep_their_default_activation_gestures() {
        let defaults = spacemapper_core::defaults::parse_str(
            r#"<profile><actionmap name="spaceship_general">
             <action name="v_self_destruct" activationMode="delayed_press_medium" keyboard="backspace"/>
             <action name="v_eject" activationMode="double_tap" keyboard="ralt+l"/>
            </actionmap></profile>"#,
        )
        .unwrap();
        let maps = actionmaps::parse_str(
            r#"<ActionMaps><ActionProfiles profileName="default">
             <actionmap name="spaceship_general">
              <action name="v_self_destruct"><rebind input="js2_rctrl+button5"/></action>
              <action name="v_eject"><rebind input="js2_rctrl+button5" multiTap="2"/></action>
             </actionmap></ActionProfiles></ActionMaps>"#,
        )
        .unwrap();

        let bindings = collect_editable(&maps, Some(&defaults));
        for (action, mode, multi_tap) in [
            ("v_self_destruct", "delayed_press_medium", None),
            ("v_eject", "double_tap", Some("2")),
        ] {
            let overridden = bindings
                .iter()
                .find(|binding| binding.action == action && binding.origin == Origin::Override)
                .unwrap();
            assert_eq!(overridden.activation_mode.as_deref(), Some(mode));
            assert_eq!(overridden.multi_tap.as_deref(), multi_tap);
            assert_eq!(overridden.input_raw, "js2_rctrl+button5");
            assert_eq!(overridden.device.as_deref(), Some("js2"));
            assert_eq!(overridden.modifier.as_deref(), Some("rctrl"));
            assert_eq!(overridden.control.as_deref(), Some("button5"));
            assert_eq!(overridden.lock, Some(LockReason::DangerousAction));

            let keyboard = bindings
                .iter()
                .find(|binding| binding.action == action && binding.origin == Origin::GameDefault)
                .unwrap();
            assert_eq!(keyboard.activation_mode, overridden.activation_mode);
            assert!(keyboard.multi_tap.is_none());
        }
    }

    #[test]
    fn an_explicit_override_activation_wins_even_when_empty() {
        let defaults = spacemapper_core::defaults::parse_str(
            r#"<profile><actionmap name="spaceship_general">
             <action name="v_self_destruct" activationMode="delayed_press_medium"/>
            </actionmap></profile>"#,
        )
        .unwrap();

        for mode in ["", "press", "double_tap", "future_mode"] {
            let xml = format!(
                r#"<ActionMaps><ActionProfiles profileName="default">
                 <actionmap name="spaceship_general"><action name="v_self_destruct">
                  <rebind input="js2_rctrl+button5" activationMode="{mode}" multiTap="3"/>
                 </action></actionmap></ActionProfiles></ActionMaps>"#
            );
            let bindings = collect_editable(&actionmaps::parse_str(&xml).unwrap(), Some(&defaults));
            assert_eq!(bindings.len(), 1);
            assert_eq!(bindings[0].activation_mode.as_deref(), Some(mode));
            assert_eq!(bindings[0].multi_tap.as_deref(), Some("3"));
            assert_eq!(bindings[0].input_raw, "js2_rctrl+button5");
        }
    }

    #[test]
    fn inherited_activation_uses_the_input_family_for_overrides_and_defaults() {
        let defaults = spacemapper_core::defaults::parse_str(
            r#"<profile><actionmap name="player">
             <action name="melee_dodgeLeft" activationMode="double_tap_nonblocking" keyboard="a">
              <gamepad input=" " activationMode="press"/>
             </action>
             <action name="moveleft" activationMode="tap" keyboard="a" gamepad="thumblx">
              <gamepad activationMode="hold"/>
             </action>
            </actionmap></profile>"#,
        )
        .unwrap();
        let maps = actionmaps::parse_str(
            r#"<ActionMaps><ActionProfiles profileName="default">
             <actionmap name="player"><action name="melee_dodgeLeft">
              <rebind input="gp2_button1"/>
              <rebind input="js2_button1"/>
              <rebind input="BAD TOKEN"/>
             </action></actionmap></ActionProfiles></ActionMaps>"#,
        )
        .unwrap();

        let bindings = collect_editable(&maps, Some(&defaults));
        for (action, input, mode, origin) in [
            (
                "melee_dodgeLeft",
                "gp2_button1",
                Some("press"),
                Origin::Override,
            ),
            (
                "melee_dodgeLeft",
                "js2_button1",
                Some("double_tap_nonblocking"),
                Origin::Override,
            ),
            ("melee_dodgeLeft", "BAD TOKEN", None, Origin::Override),
            (
                "melee_dodgeLeft",
                "kb1_a",
                Some("double_tap_nonblocking"),
                Origin::GameDefault,
            ),
            ("moveleft", "kb1_a", Some("tap"), Origin::GameDefault),
            ("moveleft", "gp1_thumblx", Some("hold"), Origin::GameDefault),
        ] {
            let binding = bindings
                .iter()
                .find(|binding| binding.action == action && binding.input_raw == input)
                .unwrap();
            assert_eq!(binding.activation_mode.as_deref(), mode, "{input}");
            assert_eq!(binding.origin, origin);
        }
        assert_eq!(bindings.len(), 6);
    }

    #[test]
    fn activation_stays_absent_without_a_matching_default() {
        let maps = actionmaps::parse_str(
            r#"<ActionMaps><ActionProfiles profileName="default">
             <actionmap name="spaceship_general"><action name="v_self_destruct">
              <rebind input="js2_rctrl+button5" multiTap="2"/>
             </action></actionmap></ActionProfiles></ActionMaps>"#,
        )
        .unwrap();
        for xml in [
            "<profile/>",
            r#"<profile><actionmap name="spaceship_general">
             <action name="v_eject" activationMode="double_tap"/>
            </actionmap></profile>"#,
            r#"<profile><actionmap name="spaceship_movement">
             <action name="v_self_destruct" activationMode="delayed_press_medium"/>
            </actionmap></profile>"#,
            r#"<profile><actionmap name="spaceship_general">
             <action name="v_self_destruct"/>
            </actionmap></profile>"#,
        ] {
            let defaults = spacemapper_core::defaults::parse_str(xml).unwrap();
            for profile in [None, Some(&defaults)] {
                let bindings = collect_editable(&maps, profile);
                assert_eq!(bindings.len(), 1);
                assert!(bindings[0].activation_mode.is_none());
                assert_eq!(bindings[0].multi_tap.as_deref(), Some("2"));
                assert_eq!(bindings[0].input_raw, "js2_rctrl+button5");
            }
        }
    }

    #[test]
    fn clearing_a_keyboard_default_survives_reload_and_keeps_the_joystick() {
        let defaults = spacemapper_core::defaults::parse_str(
            r#"<profile><actionmap name="spaceship_movement">
             <action name="v_strafe_left" keyboard="a" joystick="x"/>
            </actionmap></profile>"#,
        )
        .unwrap();
        let pending: PendingEdit = serde_json::from_str(
            r#"{"actionmap":"spaceship_movement","action":"v_strafe_left",
                "input":null,"original_input":"kb1_a"}"#,
        )
        .unwrap();

        for (xml, joystick_input, joystick_origin) in [
            (
                r#"<ActionMaps><ActionProfiles profileName="default"></ActionProfiles></ActionMaps>"#,
                "js1_x",
                Origin::GameDefault,
            ),
            (
                r#"<ActionMaps><ActionProfiles profileName="default">
                 <actionmap name="spaceship_movement"><action name="v_strafe_left">
                  <rebind input="js2_button3"/>
                 </action></actionmap></ActionProfiles></ActionMaps>"#,
                "js2_button3",
                Origin::Override,
            ),
        ] {
            let before = collect_editable(&actionmaps::parse_str(xml).unwrap(), Some(&defaults));
            assert!(before.iter().any(|binding| {
                binding.input_raw == "kb1_a" && binding.origin == Origin::GameDefault
            }));

            // Même chemin que l'enregistrement de l'interface, puis sa relecture.
            let written =
                spacemapper_edit::writer::apply(xml, &BindingEdit::from(&pending)).unwrap();
            let reloaded = actionmaps::parse_str(&written).unwrap();
            let bindings = collect_editable(&reloaded, Some(&defaults));
            assert_eq!(bindings.len(), 2, "{bindings:?}");
            assert!(bindings.iter().all(|binding| binding.input_raw != "kb1_a"));

            let keyboard = bindings
                .iter()
                .find(|binding| binding.input_raw == "kb1_ ")
                .expect("la suppression doit garder le périphérique clavier");
            assert_eq!(keyboard.origin, Origin::Override);
            assert!(keyboard.control.is_none());

            let joystick = bindings
                .iter()
                .find(|binding| binding.input_raw == joystick_input)
                .expect("la suppression clavier a masqué l'assignation du manche");
            assert_eq!(joystick.origin, joystick_origin);
            assert!(joystick.control.is_some());
        }
    }

    #[test]
    fn game_defaults_fill_the_gaps_left_by_overrides() {
        // Le cœur de la fusion : ces axes font voler le joueur sans figurer
        // nulle part dans son fichier.
        let list = merged();
        let pitch = list
            .iter()
            .find(|b| b.action == "v_pitch")
            .expect("v_pitch absente de la fusion");

        assert_eq!(pitch.origin, Origin::GameDefault);
        assert_eq!(pitch.input_raw, "js1_y");
        assert_eq!(pitch.control.as_deref(), Some("y"));
        assert!(pitch.lock.is_none());
    }

    #[test]
    fn an_override_wins_over_the_game_default() {
        // `v_afterburner` est surchargée dans DOC : c'est cette valeur qui
        // s'applique en jeu, et elle ne doit pas apparaître deux fois.
        let list = merged();
        let found: Vec<_> = list
            .iter()
            .filter(|b| b.action == "v_afterburner")
            .collect();

        assert_eq!(found.len(), 1, "action présente en double");
        assert_eq!(found[0].origin, Origin::Override);
        assert_eq!(found[0].input_raw, "js1_button5");
    }

    #[test]
    fn a_blank_override_on_one_family_does_not_hide_the_default_on_another() {
        // Le bug réel signalé par Patrice : `moveleft` ne porte qu'un `js3_ `
        // vide (« rien sur ce manche ») dans son fichier. Le clavier n'a
        // jamais été touché et reste au défaut du jeu — il doit apparaître en
        // plus de la ligne manche vide, pas disparaître derrière elle.
        let list = merged();
        let rows: Vec<_> = list.iter().filter(|b| b.action == "moveleft").collect();
        assert_eq!(
            rows.len(),
            2,
            "attendu une ligne clavier (défaut) + une ligne manche (surcharge): {rows:?}"
        );

        let keyboard = rows
            .iter()
            .find(|b| b.origin == Origin::GameDefault)
            .expect("ligne clavier absente");
        assert_eq!(keyboard.input_raw, "kb1_a");
        assert_eq!(keyboard.activation_mode.as_deref(), Some("hold"));

        let joystick = rows
            .iter()
            .find(|b| b.origin == Origin::Override)
            .expect("ligne manche absente");
        assert_eq!(joystick.input_raw, "js3_ ");
    }

    #[test]
    fn a_genuinely_corrupt_override_does_not_hide_the_default_on_another_family() {
        // `moveright` porte une surcharge totalement illisible (« BAD TOKEN »,
        // aucun périphérique identifiable). Avant, ça bloquait tout défaut
        // pour l'action entière ; maintenant, seule l'information qu'on ne
        // peut pas en tirer est absente — le défaut clavier, sur une famille
        // que rien ne dit couverte, doit quand même apparaître.
        let list = merged();
        let keyboard = list
            .iter()
            .find(|b| b.action == "moveright" && b.origin == Origin::GameDefault)
            .expect("le défaut clavier de moveright a disparu derrière la surcharge illisible");
        assert_eq!(keyboard.input_raw, "kb1_d");

        // La ligne illisible reste, elle, bien présente et signalée comme
        // surcharge — on ne la fait pas disparaître, on arrête juste de la
        // laisser décider pour les autres familles.
        assert!(list
            .iter()
            .any(|b| b.action == "moveright" && b.origin == Origin::Override));
    }

    #[test]
    fn defaults_respect_the_lite_scope() {
        // La fusion ne doit pas faire entrer par la fenêtre une catégorie
        // que le périmètre refuse.
        let list = merged();
        assert!(list.iter().all(|b| b.actionmap != "spaceship_weapons"));
    }

    #[test]
    fn actions_without_any_default_are_skipped() {
        // `joystick=" "` signifie « aucun défaut » : l'ajouter produirait une
        // ligne vide sans information.
        let list = merged();
        assert!(list.iter().all(|b| b.action != "v_sans_defaut"));
    }

    #[test]
    fn out_of_domain_categories_are_absent() {
        let names: Vec<_> = editable().iter().map(|b| b.actionmap.clone()).collect();
        assert!(names.iter().all(|n| n != "spaceship_weapons"));
    }

    #[test]
    fn prone_is_hidden_entirely_from_lite() {
        // Contrairement aux catégories de vitrine, celle-ci ne doit même pas
        // apparaître : elle est reportée à l'édition Premium.
        let names: Vec<_> = editable().iter().map(|b| b.actionmap.clone()).collect();
        assert!(names.iter().all(|n| n != "prone"));
    }

    #[test]
    fn teaser_categories_appear_but_stay_locked() {
        // Elles sont là pour montrer ce que débloque le Premium ; les cacher
        // supprimerait l'incitation, les rendre modifiables la viderait.
        for (actionmap, action) in [
            ("vehicle_driver", "v_boost"),
            ("player_emotes", "emote_wave"),
        ] {
            let list = editable();
            let found = list
                .iter()
                .find(|b| b.action == action)
                .unwrap_or_else(|| panic!("{actionmap} absente de la liste"));

            assert_eq!(found.access, EditAccess::PremiumTeaser);
            assert_eq!(
                found.lock,
                Some(LockReason::PremiumCategory),
                "{actionmap} devrait être verrouillée"
            );
        }
    }

    #[test]
    fn powering_the_ship_is_editable() {
        // Sans cette catégorie, on ne peut pas décoller : c'est le manque qui
        // rendait l'édition Lite inutilisable pour configurer un vol.
        let list = editable();
        let power = list.iter().find(|b| b.action == "v_power_toggle").unwrap();
        assert_eq!(power.access, EditAccess::Lite);
        assert!(power.lock.is_none());
    }

    #[test]
    fn self_destruct_is_locked_and_says_why() {
        let list = editable();
        let boom = list.iter().find(|b| b.action == "v_self_destruct").unwrap();
        assert_eq!(boom.lock, Some(LockReason::DangerousAction));
    }

    #[test]
    fn plain_bindings_are_editable() {
        let list = editable();
        let boost = list.iter().find(|b| b.action == "v_afterburner").unwrap();
        assert_eq!(boost.access, EditAccess::Lite);
        assert!(boost.lock.is_none());
        assert_eq!(boost.device.as_deref(), Some("js1"));
        assert_eq!(boost.control.as_deref(), Some("button5"));
    }

    #[test]
    fn unassigned_actions_are_offered_for_assignment() {
        // Assigner une action vierge fait partie du périmètre Lite.
        let list = editable();
        let libre = list.iter().find(|b| b.action == "v_strafe_up").unwrap();
        assert!(libre.lock.is_none());
        assert!(libre.control.is_none());
    }

    #[test]
    fn bindings_with_modifiers_are_editable_and_expose_the_modifier() {
        // La capture sait déjà composer « modificateur + contrôle » ; verrouiller
        // l'édition ne protégeait rien de réel.
        let list = editable();
        let pitch = list.iter().find(|b| b.action == "v_pitch_up").unwrap();
        assert!(pitch.lock.is_none());
        assert_eq!(pitch.modifier.as_deref(), Some("rctrl"));
    }

    #[test]
    fn bindings_with_activation_modes_are_editable_and_expose_the_mode() {
        // `writer::apply` ne touche qu'à `input` : `multiTap` survit à une
        // réassignation sans intervention de ce module, voir
        // `spacemapper_edit::writer::preserves_sibling_attributes`.
        let list = editable();
        let roll = list.iter().find(|b| b.action == "v_roll_left").unwrap();
        assert!(roll.lock.is_none());
        assert_eq!(roll.multi_tap.as_deref(), Some("2"));
    }
}
