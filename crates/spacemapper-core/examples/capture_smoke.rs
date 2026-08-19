//! Diagnostic de la capture, contre du matériel réellement branché.
//!
//! ```powershell
//! cargo run -p spacemapper-core --example capture_smoke
//! ```
//!
//! Chaque étape de l'ouverture est tracée séparément : quand la capture ne
//! réagit pas, il faut savoir *laquelle* échoue plutôt que de supposer.

use spacemapper_core::device::{capture::CaptureSession, DeviceEnumerator};
use std::time::{Duration, Instant};

fn main() {
    let devices =
        match spacemapper_core::device::directinput::DirectInputEnumerator::new().enumerate() {
            Ok(d) => d,
            Err(e) => {
                eprintln!("énumération impossible: {e}");
                return;
            }
        };

    if devices.is_empty() {
        eprintln!("aucun contrôleur branché");
        return;
    }

    println!("== {} périphérique(s) ==", devices.len());
    for d in &devices {
        println!(
            "  {} | {} | {} axes, {} boutons, {} chapeaux",
            d.product_name,
            d.instance_guid,
            d.capabilities.axes,
            d.capabilities.buttons,
            d.capabilities.povs
        );
    }

    // Une fenêtre est nécessaire au niveau de coopération. En console, celle
    // du terminal fait l'affaire.
    let hwnd = console_window();
    println!("\nHWND utilisé : {hwnd:#x}");

    for device in &devices {
        println!("\n== {} ==", device.product_name);

        let session = match CaptureSession::open(&device.instance_guid, hwnd) {
            Ok(s) => {
                println!("  ouverture : OK");
                s
            }
            Err(e) => {
                println!("  ouverture : ÉCHEC — {e}");
                continue;
            }
        };

        println!("  actionnez un bouton ou un axe (8 secondes)…");
        let started = Instant::now();
        let mut seen: Vec<String> = Vec::new();
        let mut errors = 0usize;

        while started.elapsed() < Duration::from_secs(8) {
            match session.poll() {
                Ok(Some(found)) => {
                    if !seen.contains(&found.control) {
                        println!("    détecté : {}", found.control);
                        seen.push(found.control);
                    }
                }
                Ok(None) => {}
                Err(e) => {
                    errors += 1;
                    if errors == 1 {
                        println!("    lecture : ÉCHEC — {e}");
                    }
                }
            }
            std::thread::sleep(Duration::from_millis(16));
        }

        if seen.is_empty() && errors == 0 {
            println!("  aucun contrôle détecté (lecture réussie mais toujours au repos)");
        }
        println!("  erreurs de lecture : {errors}");
    }
}

/// Une fenêtre valide, que DirectInput exige pour le niveau de coopération.
///
/// `GetConsoleWindow` renvoie zéro quand la sortie est redirigée — c'est le cas
/// dès qu'on passe par un tube — d'où le repli sur la fenêtre au premier plan,
/// qui est le terminal lui-même.
#[cfg(windows)]
fn console_window() -> isize {
    use windows::Win32::System::Console::GetConsoleWindow;
    use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

    // SAFETY: appels sans paramètre, renvoyant un handle ou zéro.
    unsafe {
        let console = GetConsoleWindow().0 as isize;
        if console != 0 {
            return console;
        }
        GetForegroundWindow().0 as isize
    }
}

#[cfg(not(windows))]
fn console_window() -> isize {
    0
}
