//! SpaceMapper **Lite** — édition gratuite.
//!
//! Cette édition est délibérément incapable d'écrire quoi que ce soit. Elle ne
//! dépend que de `spacemapper-core`, qui est un crate de lecture seule : aucun
//! chemin de code de ce binaire n'ouvre un fichier en écriture, et aucune
//! commande exposée au frontend ne prend de chemin de destination.
//!
//! Ce n'est pas une restriction d'interface qu'on pourrait contourner en
//! modifiant le JavaScript : le code de mutation n'existe pas dans ce binaire.
//!
//! Lite n'effectue par ailleurs **aucun appel réseau**. Pas de télémétrie, pas
//! de vérification de licence, pas de mise à jour silencieuse.

mod commands;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::list_devices,
            commands::locate_actionmaps,
            commands::read_flight_bindings,
            commands::build_info,
        ])
        .run(tauri::generate_context!())
        .expect("échec du démarrage de SpaceMapper Lite");
}
