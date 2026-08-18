//! Vérification manuelle de l'édition sur un `actionmaps.xml` **réel**.
//!
//! ```powershell
//! cargo run -p spacemapper-edit --example edit_smoke
//! ```
//!
//! Travaille sur une copie temporaire : le fichier du jeu n'est jamais touché.
//! Les fixtures de tests font quelques lignes ; un profil réel en fait des
//! milliers, avec des éléments qu'on ne modélise pas. C'est ici qu'on vérifie
//! que la réécriture chirurgicale ne perd rien au passage.

use spacemapper_core::install;
use spacemapper_edit::{apply_to_file, BindingEdit};

fn main() {
    let Some(profile) = install::discover(&install::default_roots())
        .into_iter()
        .next()
    else {
        eprintln!("aucune installation de Star Citizen détectée");
        return;
    };
    println!("source : {}", profile.path.display());

    let work = std::env::temp_dir().join("spacemapper-smoke");
    let _ = std::fs::remove_dir_all(&work);
    std::fs::create_dir_all(&work).unwrap();

    let target = work.join("actionmaps.xml");
    std::fs::copy(&profile.path, &target).unwrap();
    let before = std::fs::read_to_string(&target).unwrap();
    println!("copie  : {} ({} octets)", target.display(), before.len());

    // Une action de pilotage présente dans tout profil. Le nom exact compte :
    // le boost du vaisseau s'appelle `v_afterburner`, pas `v_boost` — ce
    // dernier existe, mais dans `vehicle_driver`, pour les véhicules au sol.
    let edit = BindingEdit::set("spaceship_movement", "v_afterburner", "js1_button31");
    println!(
        "\nédition: {}/{} → js1_button31",
        edit.actionmap, edit.action
    );

    // Point de restauration explicite, comme le ferait l'utilisateur.
    let backup = spacemapper_edit::backup::create(&target, &work.join("Backups")).unwrap();
    println!("sauvegarde : {}", backup.display());

    if let Err(e) = apply_to_file(&target, &edit) {
        eprintln!("échec: {e}");
        return;
    }

    let after = std::fs::read_to_string(&target).unwrap();

    // Le document doit rester lisible, et n'avoir bougé que d'une ligne.
    let parsed = spacemapper_core::actionmaps::parse_str(&after).expect("document illisible");
    println!("relecture  : {} assignations", parsed.rebinds().count());

    let changed: Vec<_> = before
        .lines()
        .zip(after.lines())
        .enumerate()
        .filter(|(_, (a, b))| a != b)
        .collect();

    println!("\nlignes modifiées : {}", changed.len());
    for (line, (a, b)) in &changed {
        println!("  {} :\n    - {}\n    + {}", line + 1, a.trim(), b.trim());
    }

    if before.lines().count() != after.lines().count() {
        println!(
            "\n⚠ nombre de lignes modifié : {} → {}",
            before.lines().count(),
            after.lines().count()
        );
    }

    // Le refus hors périmètre doit tenir aussi sur un fichier réel.
    let refused = apply_to_file(
        &target,
        &BindingEdit::set("spaceship_weapons", "v_attack1", "js1_button1"),
    );
    println!(
        "\nhors périmètre refusé : {}",
        match refused {
            Err(e) => format!("oui — {e}"),
            Ok(_) => "NON — la limite ne tient pas".to_string(),
        }
    );
}
