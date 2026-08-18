//! Vérification manuelle de l'énumération contre le matériel réellement
//! branché, et confrontation au `actionmaps.xml` trouvé sur la machine.
//!
//! ```powershell
//! cargo run -p spacemapper-core --example enumerate
//! ```
//!
//! Les tests unitaires ne peuvent pas couvrir cette partie : elle dépend d'un
//! joystick physique. C'est donc ici qu'on valide que les GUID renvoyés par
//! DirectInput correspondent bien à ceux que le jeu a écrits.

use spacemapper_core::{actionmaps, device::DeviceEnumerator, install};

fn main() {
    println!("== Périphériques détectés ==");

    #[cfg(windows)]
    let devices = spacemapper_core::device::directinput::DirectInputEnumerator::new().enumerate();
    #[cfg(not(windows))]
    let devices = spacemapper_core::device::FakeEnumerator::default().enumerate();

    let devices = match devices {
        Ok(d) => d,
        Err(e) => {
            eprintln!("échec de l'énumération: {e}");
            return;
        }
    };

    if devices.is_empty() {
        println!("(aucun contrôleur de jeu branché)");
    }
    for d in &devices {
        println!(
            "  {}\n    guid   {}\n    axes {} · boutons {} · chapeaux {}",
            d.product_name,
            d.instance_guid,
            d.capabilities.axes,
            d.capabilities.buttons,
            d.capabilities.povs
        );
    }

    println!("\n== Profils trouvés ==");
    let profiles = install::discover(&install::default_roots());
    if profiles.is_empty() {
        println!("(aucune installation de Star Citizen détectée)");
        return;
    }

    for profile in &profiles {
        println!("\n[{}] {}", profile.channel, profile.path.display());

        let maps = match actionmaps::parse_file(&profile.path) {
            Ok(m) => m,
            Err(e) => {
                eprintln!("  lecture impossible: {e}");
                continue;
            }
        };

        let total = maps.rebinds().count();
        let flight = maps
            .rebinds()
            .filter(|(m, _, r)| m.is_flight() && !r.is_unbound())
            .count();
        let corrupt: Vec<_> = maps
            .rebinds()
            .filter(|(_, _, r)| r.is_corrupt())
            .map(|(m, a, r)| (m.name.as_str(), a.name.as_str(), r))
            .collect();

        println!("  profil          {:?}", maps.profile_name);
        println!("  assignations    {total} ({flight} de vol)");
        println!("  joysticks       {:?}", maps.joystick_instances_in_use());

        println!("  GUID du fichier");
        for guid in maps.known_guids() {
            // Le point de vérité : ce GUID correspond-il à du matériel branché ?
            let plugged = devices.iter().any(|d| &d.instance_guid == guid);
            let mark = if plugged { "branché" } else { "ABSENT" };
            println!("    {guid}  [{mark}]");
        }

        if corrupt.is_empty() {
            println!("  corrompues      aucune");
        } else {
            println!("  corrompues      {}", corrupt.len());
            for (map, action, rebind) in &corrupt {
                println!(
                    "    ligne {:<5} {map}/{action}  input={:?}",
                    rebind.line, rebind.input_raw
                );
            }
        }
    }
}
