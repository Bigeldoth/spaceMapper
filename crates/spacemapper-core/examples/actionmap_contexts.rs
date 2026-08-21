//! Liste les catégories d'assignation du jeu, avec leur volume.
//!
//! ```powershell
//! cargo run -p spacemapper-core --release --example actionmap_contexts
//! ```
//!
//! Star Citizen n'active pas toutes les catégories à la fois : on ne marche
//! pas en pilotant, et le minage n'a pas les mêmes commandes que le combat.
//! Deux assignations qui partagent un bouton dans deux catégories qui ne
//! coexistent jamais **ne sont pas en conflit**.
//!
//! Le regroupement en contextes doit donc partir des noms réellement employés
//! par CIG, pas d'une liste supposée. Cet exemple les énumère.

use spacemapper_core::{cryxml, defaults, install, p4k};

fn main() {
    let Some(profile) = install::discover(&install::default_roots())
        .into_iter()
        .next()
    else {
        eprintln!("aucune installation de Star Citizen détectée");
        return;
    };

    let channel_root = profile
        .path
        .ancestors()
        .nth(6)
        .expect("arborescence inattendue");

    let archive = match p4k::Archive::open(p4k::Archive::path_for(channel_root)) {
        Ok(a) => a,
        Err(e) => {
            eprintln!("ouverture impossible: {e}");
            return;
        }
    };

    let entry = match archive.find(p4k::DEFAULT_PROFILE) {
        Ok(Some(e)) => e,
        Ok(None) => {
            eprintln!("{} absent de l'archive", p4k::DEFAULT_PROFILE);
            return;
        }
        Err(e) => {
            eprintln!("parcours impossible: {e}");
            return;
        }
    };

    let parsed = archive
        .read(&entry)
        .and_then(|raw| cryxml::to_xml(&raw))
        .and_then(|xml| defaults::parse_str(&xml));

    let profile_defaults = match parsed {
        Ok(p) => p,
        Err(e) => {
            eprintln!("analyse impossible: {e}");
            return;
        }
    };

    println!(
        "{} catégories\n",
        profile_defaults.action_maps.len()
    );
    println!("{:<34} {:>7} {:>9}", "catégorie", "actions", "assignées");
    println!("{}", "-".repeat(52));

    for map in &profile_defaults.action_maps {
        let bound = map.actions.iter().filter(|a| a.has_any_default()).count();
        println!(
            "{:<34} {:>7} {:>9}",
            map.name,
            map.actions.len(),
            bound
        );
    }
}
