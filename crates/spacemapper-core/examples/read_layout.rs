//! Lit un profil **exporté** (`layout_*.xml`) et le résume.
//!
//! ```powershell
//! cargo run -p spacemapper-core --example read_layout -- "chemin\layout_X.xml"
//! ```
//!
//! Les profils que s'échange la communauté ne sont pas des `actionmaps.xml` :
//! ce sont des exports du jeu, au schéma voisin mais distinct. Savoir si notre
//! parseur les lit tels quels décide de la faisabilité de l'import.

use spacemapper_core::actionmaps;
use std::collections::BTreeMap;

fn main() {
    let Some(path) = std::env::args().nth(1) else {
        eprintln!("usage: read_layout <chemin du layout_*.xml>");
        return;
    };

    let maps = match actionmaps::parse_file(&path) {
        Ok(m) => m,
        Err(e) => {
            eprintln!("lecture impossible: {e}");
            return;
        }
    };

    println!("profil          {:?}", maps.profile_name);
    println!(
        "versions        {:?} / {:?}",
        maps.version, maps.rebind_version
    );
    println!("catégories      {}", maps.action_maps.len());
    println!("périphériques déclarés (CustomisationUIHeader)");
    for d in &maps.declared_devices {
        println!("    {:?} instance {}", d.device_kind, d.instance);
    }

    println!("blocs <options>");
    for o in &maps.options {
        println!(
            "    {:?} instance {} · {:?}",
            o.device_kind, o.instance, o.product_raw
        );
    }

    println!("blocs <deviceoptions>");
    for d in &maps.device_options {
        println!(
            "    {:?} · guid {:?} · {} axe(s) réglé(s)",
            d.name,
            d.guid.as_ref().map(|g| g.to_string()),
            d.axis_options.len()
        );
    }

    // Ce que le profil exige réellement.
    let mut per_device: BTreeMap<String, usize> = BTreeMap::new();
    let mut with_modifier = 0;
    let mut with_activation = 0;
    let mut with_multitap = 0;
    let mut corrupt = 0;
    let mut usable = 0;

    for (_, _, rebind) in maps.rebinds() {
        if rebind.is_corrupt() {
            corrupt += 1;
            continue;
        }
        if rebind.is_unbound() {
            continue;
        }
        usable += 1;

        if let Some(input) = &rebind.input {
            *per_device
                .entry(format!("{}{}", input.device_kind.prefix(), input.instance))
                .or_default() += 1;
            if input.modifier.is_some() {
                with_modifier += 1;
            }
        }
        if rebind.activation_mode.is_some() {
            with_activation += 1;
        }
        if rebind.multi_tap.is_some() {
            with_multitap += 1;
        }
    }

    println!("\nassignations exploitables : {usable}   illisibles : {corrupt}");
    for (device, count) in &per_device {
        println!("    {device:<6} {count}");
    }
    println!("\nce que l'édition Lite refuserait de modifier :");
    println!("    avec modificateur   {with_modifier}");
    println!("    avec activationMode {with_activation}");
    println!("    avec multiTap       {with_multitap}");
}
