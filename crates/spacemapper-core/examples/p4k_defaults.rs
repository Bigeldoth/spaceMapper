//! Extrait le profil de contrôles par défaut de `Data.p4k` et l'analyse.
//!
//! ```powershell
//! cargo run -p spacemapper-core --example p4k_defaults --release
//! ```
//!
//! L'archive pèse environ 150 Go et sa table centrale compte plus d'un million
//! d'entrées : à lancer en `--release`, la version de débogage étant nettement
//! plus lente sur le parcours.

use spacemapper_core::{actionmaps, cryxml, defaults, install, p4k};
use std::time::Instant;

fn main() {
    let Some(profile) = install::discover(&install::default_roots())
        .into_iter()
        .next()
    else {
        eprintln!("aucune installation de Star Citizen détectée");
        return;
    };

    // `actionmaps.xml` vit sous <canal>/user/... : l'archive est à la racine
    // du canal, quatre niveaux plus haut.
    let channel_root = profile
        .path
        .ancestors()
        .nth(6)
        .expect("arborescence inattendue");
    let archive_path = p4k::Archive::path_for(channel_root);
    println!("archive : {}", archive_path.display());

    let archive = match p4k::Archive::open(&archive_path) {
        Ok(a) => a,
        Err(e) => {
            eprintln!("ouverture impossible : {e}");
            return;
        }
    };

    let started = Instant::now();
    let entry = match archive.find(p4k::DEFAULT_PROFILE) {
        Ok(Some(e)) => e,
        Ok(None) => {
            eprintln!("« {} » absent de l'archive", p4k::DEFAULT_PROFILE);
            return;
        }
        Err(e) => {
            eprintln!("parcours impossible : {e}");
            return;
        }
    };
    println!(
        "trouvé en {:.1} s — méthode {}, {} octets compressés, {} bruts",
        started.elapsed().as_secs_f32(),
        entry.method,
        entry.compressed_size,
        entry.uncompressed_size
    );

    let raw = match archive.read(&entry) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("lecture impossible : {e}");
            return;
        }
    };
    println!(
        "décompressé : {} octets, CryXmlB : {}",
        raw.len(),
        cryxml::is_cryxml(&raw)
    );

    let xml = match cryxml::to_xml(&raw) {
        Ok(x) => x,
        Err(e) => {
            eprintln!("décodage impossible : {e}");
            return;
        }
    };
    println!("XML produit : {} caractères", xml.len());

    // Trace de mise au point : le schéma du profil par défaut n'est pas celui
    // d'un profil utilisateur, et il faut pouvoir l'examiner.
    let dump = std::env::temp_dir().join("defaultProfile.decoded.xml");
    if std::fs::write(&dump, &xml).is_ok() {
        println!("écrit dans {}", dump.display());
    }

    let profile_defaults = match defaults::parse_str(&xml) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("analyse impossible : {e}");
            return;
        }
    };

    let actions: usize = profile_defaults
        .action_maps
        .iter()
        .map(|m| m.actions.len())
        .sum();
    println!(
        "\n{} catégories, {} actions, {} avec au moins un défaut",
        profile_defaults.action_maps.len(),
        actions,
        profile_defaults.bound_count()
    );

    // Ce qui manquait au fichier utilisateur : les axes de vol par défaut.
    println!("\n=== défauts joystick du pilotage ===");
    if let Some(map) = profile_defaults
        .action_maps
        .iter()
        .find(|m| m.name == "spaceship_movement")
    {
        for action in map.actions.iter().filter(|a| a.joystick.is_some()) {
            println!(
                "  {:<30} {:<10} {}",
                action.name,
                action.joystick.as_deref().unwrap_or(""),
                action.ui_description.as_deref().unwrap_or("")
            );
        }
    }

    // Confrontation au profil de l'utilisateur : ce que le jeu fournit et que
    // le fichier ne dit pas.
    println!("\n=== ce que le fichier utilisateur ne montre pas ===");
    match actionmaps::parse_file(&profile.path) {
        Ok(user) => {
            let mut hidden = 0;
            for map in &profile_defaults.action_maps {
                for action in map.actions.iter().filter(|a| a.joystick.is_some()) {
                    let overridden = user.rebinds().any(|(m, a, r)| {
                        m.name == map.name && a.name == action.name && !r.is_unbound()
                    });
                    if !overridden {
                        hidden += 1;
                    }
                }
            }
            println!("  {hidden} assignations joystick par défaut, absentes des surcharges");
        }
        Err(e) => eprintln!("  lecture du profil utilisateur impossible : {e}"),
    }
}
