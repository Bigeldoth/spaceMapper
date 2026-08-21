//! SpaceMapper **Lite** — édition gratuite.
//!
//! Lite sait lire un profil et **réassigner les commandes de déplacement**, à
//! pied comme en vol, avec des points de restauration créés à la demande.
//!
//! Le **périmètre est restreint** aux catégories de déplacement, et cette
//! limite est appliquée en Rust par `spacemapper-edit`, pas dans l'interface :
//! armement, ciblage, énergie, systèmes de bord et tourelles sont refusés par
//! la couche d'écriture elle-même.
//!
//! Lite n'effectue **aucun appel réseau** — et pas seulement par convention :
//! son arbre de dépendances ne contient aucun client HTTP, le binaire est donc
//! techniquement incapable d'émettre une requête. Pas de télémétrie, pas de
//! compte, pas de mise à jour silencieuse. Le lien vers la page de vente est
//! remis au navigateur du système sur clic explicite.
//!
//! L'export, l'import, la synchronisation et les profils nommés relèvent de
//! l'édition Premium.

mod commands;
mod editing;

use spacemapper_app_support::{capture, gamedata, layouts};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(capture::CaptureState::default())
        .manage(gamedata::GameData::default())
        .invoke_handler(tauri::generate_handler![
            commands::list_devices,
            commands::locate_actionmaps,
            commands::diagnose_devices,
            commands::build_info,
            layouts::list_layouts,
            layouts::inspect_layout,
            editing::list_editable_bindings,
            editing::save_bindings,
            editing::create_backup,
            editing::list_backups,
            editing::delete_backup,
            editing::restore_backup,
            editing::list_game_languages,
            editing::get_settings,
            editing::set_settings,
            capture::start_capture,
            capture::poll_capture,
            capture::clear_capture,
            capture::stop_capture,
        ])
        .run(tauri::generate_context!())
        .expect("échec du démarrage de SpaceMapper Lite");
}
