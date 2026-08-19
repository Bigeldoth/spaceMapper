//! Extrait le vocabulaire clavier **réel** du jeu depuis `Data.p4k`.
//!
//! ```powershell
//! cargo run -p spacemapper-core --example keyboard_vocabulary
//! ```
//!
//! `lib/keyboard.ts` traduit un appui du navigateur vers un nom de touche
//! Star Citizen. Cette table a longtemps suivi la convention CryEngine sans
//! confirmation : un nom inexact produit une assignation que le jeu ignore en
//! silence, ce qui est la pire des pannes — l'application dit avoir enregistré,
//! et rien ne se passe en jeu.
//!
//! `defaultProfile.xml` porte des centaines d'assignations clavier écrites par
//! CIG. C'est la source d'autorité. Cet exemple les liste pour qu'on puisse
//! confronter la table à la réalité plutôt que d'en débattre.

use spacemapper_core::{cryxml, defaults, install, p4k};
use std::collections::BTreeSet;

/// Ce que `lib/keyboard.ts` sait produire aujourd'hui. Tenu à jour à la main :
/// la comparaison n'a de sens que si les deux listes parlent du même moment.
const PRODUCED: &[&str] = &[
    // Modificateurs
    "lshift", "rshift", "lctrl", "rctrl", "lalt", "ralt",
    // Touches nommées
    "space", "enter", "escape", "tab", "backspace", "capslock", "up", "down", "left", "right",
    "insert", "delete", "home", "end", "pgup", "pgdn", "minus", "equals", "lbracket", "rbracket",
    "semicolon", "apostrophe", "tilde", "backslash", "comma", "period", "slash", "np_add",
    "np_subtract", "np_multiply", "np_divide", "np_period", "np_enter", "print", "scrolllock",
    "pause",
];

fn main() {
    let Some(install) = install::discover(&install::default_roots())
        .into_iter()
        .next()
    else {
        eprintln!("aucune installation de Star Citizen détectée");
        return;
    };

    let channel_root = install
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

    let profile = match archive
        .read(&entry)
        .and_then(|raw| cryxml::to_xml(&raw))
        .and_then(|xml| defaults::parse_str(&xml))
    {
        Ok(p) => p,
        Err(e) => {
            eprintln!("analyse impossible: {e}");
            return;
        }
    };

    // Un défaut clavier peut valoir `lshift+f` : on veut les touches, pas les
    // combinaisons.
    let mut used: BTreeSet<String> = BTreeSet::new();
    for map in &profile.action_maps {
        for action in &map.actions {
            let Some(kb) = &action.keyboard else { continue };
            for part in kb.split('+') {
                let part = part.trim();
                if !part.is_empty() {
                    used.insert(part.to_string());
                }
            }
        }
    }

    println!("touches distinctes employées par le jeu : {}\n", used.len());

    let produced: BTreeSet<&str> = PRODUCED.iter().copied().collect();

    // Les lettres, chiffres et touches de fonction suivent une règle dans
    // `keyboard.ts` plutôt qu'une table ; on les reconnaît pour ne pas les
    // signaler à tort.
    let by_rule = |name: &str| {
        (name.len() == 1 && name.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit()))
            || (name.starts_with('f')
                && name[1..].parse::<u8>().is_ok_and(|n| (1..=12).contains(&n)))
            || name
                .strip_prefix("np_")
                .is_some_and(|rest| rest.parse::<u8>().is_ok_and(|n| n <= 9))
    };

    let missing: Vec<&String> = used
        .iter()
        .filter(|name| !produced.contains(name.as_str()) && !by_rule(name))
        .collect();

    if missing.is_empty() {
        println!("✅ toutes les touches du jeu sont couvertes par la capture");
    } else {
        println!("⚠️  employées par le jeu, absentes de keyboard.ts ({}) :", missing.len());
        for name in &missing {
            println!("    {name}");
        }
    }

    let unused: Vec<&&str> = produced
        .iter()
        .filter(|name| !used.contains(**name))
        .collect();

    if !unused.is_empty() {
        println!(
            "\n❓ produites par keyboard.ts, jamais employées par le jeu ({}) :",
            unused.len()
        );
        println!("    (non concluant : le jeu n'utilise pas toutes les touches par défaut)");
        for name in &unused {
            println!("    {name}");
        }
    }

    println!("\n== Vocabulaire complet ==");
    for name in &used {
        println!("  {name}");
    }
}
