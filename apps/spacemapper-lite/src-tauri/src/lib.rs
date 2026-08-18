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

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::list_devices,
            commands::locate_actionmaps,
            commands::read_flight_bindings,
            commands::build_info,
            editing::list_editable_bindings,
            editing::set_binding,
            editing::clear_binding,
            editing::create_backup,
            editing::list_backups,
            editing::restore_backup,
        ])
        .run(tauri::generate_context!())
        .expect("échec du démarrage de SpaceMapper Lite");
}
