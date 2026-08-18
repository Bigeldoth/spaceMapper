//! SpaceMapper **Lite** — édition gratuite.
//!
//! Lite sait lire un profil et **réassigner les commandes de déplacement**, à
//! pied comme en vol. Deux garde-fous encadrent cette écriture, tous deux
//! appliqués en Rust par `spacemapper-edit` et non dans l'interface :
//!
//! - **Périmètre restreint.** Seules les catégories de déplacement sont
//!   modifiables. Armement, ciblage, énergie, systèmes de bord et tourelles
//!   sont refusés par la couche d'écriture elle-même.
//! - **Sauvegarde obligatoire.** Une copie horodatée précède chaque écriture.
//!   Si elle échoue, l'écriture n'a pas lieu. Ce n'est pas une option.
//!
//! Lite n'effectue par ailleurs **aucun appel réseau**. Pas de télémétrie, pas
//! de vérification de licence, pas de mise à jour silencieuse. L'export,
//! l'import et la synchronisation relèvent de l'édition Premium.

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
            editing::list_backups,
            editing::restore_backup,
        ])
        .run(tauri::generate_context!())
        .expect("échec du démarrage de SpaceMapper Lite");
}
