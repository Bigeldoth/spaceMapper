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

use crate::gamedata::GameData;
use serde::{Deserialize, Serialize};
use spacemapper_core::actionmaps::{self, ActionMaps, InputBinding};
use spacemapper_core::channel;
use spacemapper_core::context::{self, Context};
use spacemapper_core::defaults::DefaultProfile;
use spacemapper_edit::{backup, scope, BindingEdit, EditAccess, EditCategory};
use std::path::{Path, PathBuf};

type CmdResult<T> = Result<T, String>;

/// Pourquoi une assignation ne peut pas être modifiée ici.
///
/// Un code plutôt qu'une phrase : le texte affiché dépend de la langue de
/// l'interface, que seul le frontend connaît. Renvoyer du français figé
/// rendrait l'application intraduisible.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum LockReason {
    /// Action irréversible : autodestruction, éjection.
    DangerousAction,
    /// Catégorie de vitrine, réservée au Premium.
    PremiumCategory,
    /// Porte un modificateur que l'édition simplifiée ne sait pas restituer.
    HasModifier,
    /// Porte un mode d'activation, idem.
    HasActivationMode,
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
    /// Situation de jeu où cette commande est active.
    ///
    /// C'est elle qui décide d'un conflit : deux commandes ne se disputent un
    /// bouton que si elles peuvent répondre en même temps.
    pub context: Context,
    pub input_raw: String,
    pub device: Option<String>,
    /// Touche modificatrice, ex. `lshift` dans `kb1_lshift+f`.
    ///
    /// Séparée du contrôle et non repliée dedans : sans elle, l'interface
    /// affichait `kb1 f` pour une assignation qui exige en réalité Maj+F.
    pub modifier: Option<String>,
    pub control: Option<String>,
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
}

impl From<&PendingEdit> for BindingEdit {
    fn from(p: &PendingEdit) -> Self {
        BindingEdit {
            actionmap: p.actionmap.clone(),
            action: p.action.clone(),
            input: p.input.clone(),
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

    let language = crate::settings::load(APP_NAME).game_language;
    let catalog = state.catalog_for(Path::new(&path), &language);

    let mut bindings = collect_editable(&maps, defaults.as_ref());
    label_from_game(&mut bindings, defaults.as_ref(), &catalog);

    Ok(MergedBindings {
        bindings,
        defaults_error,
        colliding_contexts: colliding_contexts(),
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
pub fn get_settings() -> crate::settings::Settings {
    crate::settings::load(APP_NAME)
}

#[tauri::command]
pub fn set_settings(settings: crate::settings::Settings) -> CmdResult<()> {
    crate::settings::save(APP_NAME, &settings)
}

#[derive(Debug, Serialize)]
pub struct MergedBindings {
    pub bindings: Vec<EditableBinding>,
    /// Motif d'indisponibilité des valeurs par défaut, le cas échéant.
    pub defaults_error: Option<String>,
    /// Couples de situations qui peuvent coexister.
    ///
    /// Transmis une seule fois plutôt que réimplémenté côté interface : la
    /// règle est testée en Rust, et la dupliquer en TypeScript garantirait de
    /// les voir diverger au premier patch du jeu.
    pub colliding_contexts: Vec<[Context; 2]>,
}

/// Toutes les paires de situations compatibles, y compris réflexives.
fn colliding_contexts() -> Vec<[Context; 2]> {
    const ALL: [Context; 10] = [
        Context::OnFoot,
        Context::ShipSeat,
        Context::ShipScanning,
        Context::ShipMining,
        Context::ShipSalvage,
        Context::Turret,
        Context::Eva,
        Context::GroundVehicle,
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
fn collect_editable(maps: &ActionMaps, defaults: Option<&DefaultProfile>) -> Vec<EditableBinding> {
    let mut bindings = collect_overrides(maps);

    let Some(defaults) = defaults else {
        return bindings;
    };

    let known: std::collections::HashSet<(String, String)> = bindings
        .iter()
        .map(|b| (b.actionmap.clone(), b.action.clone()))
        .collect();

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
            if known.contains(&(map.name.clone(), action.name.clone())) {
                continue;
            }
            // Le profil par défaut ne donne qu'un nom de contrôle, sans index
            // de périphérique : le jeu l'applique au premier de la famille.
            let Some(token) = default_token(action) else {
                continue;
            };

            let input = InputBinding::parse(&token);
            let locked_reason = lock_reason(access, &action.name, input.as_ref(), None, None);

            bindings.push(EditableBinding {
                actionmap: map.name.clone(),
                category,
                access,
                origin: Origin::GameDefault,
                context: context::context_of(&map.name),
                action: action.name.clone(),
                // Renseignés ensuite, une fois le catalogue chargé.
                label: None,
                description: None,
                input_raw: token.clone(),
                device: input
                    .as_ref()
                    .map(|i| format!("{}{}", i.device_kind.prefix(), i.instance)),
                modifier: input.as_ref().and_then(|i| i.modifier.clone()),
                control: input.as_ref().map(|i| i.control.clone()),
                lock: locked_reason,
            });
        }
    }

    bindings
}

/// Jeton d'une valeur par défaut, en privilégiant le manche.
///
/// Le profil décrit une même action pour plusieurs familles ; on retient celle
/// qui intéresse le plus l'utilisateur de ce logiciel, puis on retombe sur le
/// clavier.
fn default_token(action: &spacemapper_core::defaults::DefaultAction) -> Option<String> {
    action
        .token_for("js1")
        .or_else(|| action.token_for("kb1"))
        .or_else(|| action.token_for("gp1"))
}

/// Motif de verrouillage, commun aux deux origines.
fn lock_reason(
    access: EditAccess,
    action: &str,
    input: Option<&InputBinding>,
    activation_mode: Option<&str>,
    multi_tap: Option<&str>,
) -> Option<LockReason> {
    // L'ordre compte : c'est la raison la plus spécifique qu'il faut afficher.
    if scope::is_dangerous(action) {
        Some(LockReason::DangerousAction)
    } else if access == EditAccess::PremiumTeaser {
        Some(LockReason::PremiumCategory)
    } else if input.is_some_and(|i| i.modifier.is_some()) {
        Some(LockReason::HasModifier)
    } else if activation_mode.is_some_and(|m| !m.is_empty()) || multi_tap.is_some() {
        Some(LockReason::HasActivationMode)
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

            let locked_reason = lock_reason(
                access,
                &action.name,
                rebind.input.as_ref(),
                rebind.activation_mode.as_deref(),
                rebind.multi_tap.as_deref(),
            );

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
                lock: locked_reason,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const DOC: &str = r#"<ActionMaps><ActionProfiles profileName="default">
  <actionmap name="spaceship_movement">
   <action name="v_afterburner"><rebind input="js1_button5"/></action>
   <action name="v_pitch_up"><rebind input="js1_rctrl+button6"/></action>
   <action name="v_roll_left"><rebind input="js1_hat1_down" multiTap="2"/></action>
   <action name="v_strafe_up"><rebind input="js2_ "/></action>
  </actionmap>
  <actionmap name="player">
   <action name="moveforward"><rebind input="kb1_w"/></action>
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
</profile>"#;

    fn merged() -> Vec<EditableBinding> {
        let defaults = spacemapper_core::defaults::parse_str(DEFAULTS).unwrap();
        collect_editable(&actionmaps::parse_str(DOC).unwrap(), Some(&defaults))
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
    fn bindings_with_modifiers_are_locked_not_hidden() {
        // Les masquer laisserait croire qu'elles n'existent pas ; les éditer
        // écraserait un réglage invisible dans l'interface simplifiée.
        let list = editable();
        let pitch = list.iter().find(|b| b.action == "v_pitch_up").unwrap();
        assert_eq!(pitch.lock, Some(LockReason::HasModifier));
    }

    #[test]
    fn bindings_with_activation_modes_are_locked() {
        let list = editable();
        let roll = list.iter().find(|b| b.action == "v_roll_left").unwrap();
        assert_eq!(roll.lock, Some(LockReason::HasActivationMode));
    }
}
