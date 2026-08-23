//! Échange `js1` et `js2` dans un profil exporté, sur une **copie**.
//!
//! ```powershell
//! cargo run -p spacemapper-edit --example swap_sticks -- "chemin\layout_X.xml"
//! ```
//!
//! C'est l'opération que réclame l'import d'un profil communautaire. Deux
//! manches identiques portent le même GUID et le même nom : rien, dans le
//! fichier, ne dit lequel l'auteur tenait de la main droite. Si l'ordre
//! d'énumération diffère du sien, la moitié des commandes atterrit sur le
//! mauvais manche.
//!
//! Cet exemple mesure la faisabilité : la réécriture chirurgicale tient-elle
//! sur un profil réel de 191 assignations, sans rien perdre au passage ?

use spacemapper_core::actionmaps;
use spacemapper_edit::{apply_all_to_file, scope, BindingEdit};

fn main() {
    let Some(path) = std::env::args().nth(1) else {
        eprintln!("usage: swap_sticks <chemin du layout_*.xml>");
        return;
    };

    let maps = match actionmaps::parse_file(&path) {
        Ok(m) => m,
        Err(e) => {
            eprintln!("lecture impossible: {e}");
            return;
        }
    };

    // On construit la permutation js1 <-> js2 sur les seules assignations
    // exploitables. Les formes `jsN_ ` sont laissées telles quelles : elles ne
    // désignent aucun contrôle, les échanger n'apporterait rien.
    let mut edits = Vec::new();
    let mut refused = 0;
    for (map, action, rebind) in maps.rebinds() {
        let Some(input) = &rebind.input else { continue };
        if rebind.is_unbound() || input.control.is_empty() {
            continue;
        }
        // Le périmètre Lite refuse une bonne part d'un profil communautaire —
        // catégories de combat, actions irréversibles. C'est voulu : adapter
        // un profil entier est une opération Premium.
        if !scope::is_editable(&map.name, &action.name) {
            refused += 1;
            continue;
        }
        let swapped = match input.instance {
            1 => 2,
            2 => 1,
            _ => continue,
        };
        let control = match &input.modifier {
            Some(m) => format!("{m}+{}", input.control),
            None => input.control.clone(),
        };
        // Une action peut porter à la fois un js1 et un js2 : sans préciser
        // laquelle des deux surcharges on vise, la seconde permutation de la
        // même action toucherait la première déjà réécrite au lieu de la
        // sienne. `targeting` fixe la cible sur la valeur d'avant permutation.
        edits.push(
            BindingEdit::set(
                &map.name,
                &action.name,
                &format!("{}{swapped}_{control}", input.device_kind.prefix()),
            )
            .targeting(&input.to_string()),
        );
    }

    let work = std::env::temp_dir().join("spacemapper-swap");
    let _ = std::fs::remove_dir_all(&work);
    std::fs::create_dir_all(&work).unwrap();
    let target = work.join("layout_swapped.xml");
    std::fs::copy(&path, &target).unwrap();

    println!(
        "{} permutation(s) à appliquer · {refused} refusée(s) par le périmètre Lite",
        edits.len()
    );

    if let Err(e) = apply_all_to_file(&target, &edits) {
        eprintln!("écriture impossible: {e}");
        return;
    }

    // Relecture : c'est la seule preuve qui vaille.
    let after = match actionmaps::parse_file(&target) {
        Ok(m) => m,
        Err(e) => {
            eprintln!("relecture impossible — le fichier est cassé: {e}");
            return;
        }
    };

    let count = |maps: &actionmaps::ActionMaps, instance: u8| {
        maps.rebinds()
            .filter_map(|(_, _, r)| r.input.as_ref())
            .filter(|i| {
                i.device_kind == actionmaps::DeviceKind::Joystick
                    && i.instance == instance
                    && !i.control.is_empty()
            })
            .count()
    };

    println!(
        "avant  js1={} js2={}\naprès  js1={} js2={}",
        count(&maps, 1),
        count(&maps, 2),
        count(&after, 1),
        count(&after, 2)
    );

    let before_total = maps.rebinds().count();
    let after_total = after.rebinds().count();
    println!(
        "assignations conservées : {after_total} / {before_total}{}",
        if after_total == before_total {
            ""
        } else {
            "  ⚠ PERTE"
        }
    );
    println!("écrit dans {}", target.display());
}
