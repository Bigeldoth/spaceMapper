//! Diagnostic de la capture, contre du matériel réellement branché.
//!
//! ```powershell
//! cargo run -p spacemapper-core --example capture_smoke
//! ```
//!
//! Affiche l'état **brut** renvoyé par DirectInput pendant vingt secondes.
//! Quand la capture ne réagit pas, il faut pouvoir distinguer trois situations
//! qui se ressemblent de l'extérieur : l'ouverture échoue, DirectInput ne
//! renvoie rien, ou il renvoie quelque chose que nous interprétons mal.

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

    let hwnd = console_window();
    println!("HWND : {hwnd:#x}\n");

    let mut sessions = Vec::new();
    for device in &devices {
        print!("{} [{}] : ", device.product_name, device.category.prefix());
        match CaptureSession::open(&device.instance_guid, hwnd) {
            Ok(s) => {
                println!("ouverture OK");
                sessions.push((device.product_name.clone(), s));
            }
            Err(e) => println!("ÉCHEC — {e}"),
        }
    }

    if sessions.is_empty() {
        return;
    }

    println!("\n>>> ACTIONNEZ VOS BOUTONS MAINTENANT (20 secondes) <<<\n");

    let started = Instant::now();
    let mut last_print = Instant::now();
    let mut ever_pressed = false;

    while started.elapsed() < Duration::from_secs(20) {
        for (name, session) in &sessions {
            match session.snapshot() {
                Ok(snap) => {
                    if !snap.pressed.is_empty() {
                        ever_pressed = true;
                        println!("  {name} : boutons {:?}", snap.pressed);
                    }

                    // Relevé périodique même au repos : c'est lui qui révèle
                    // si les axes bougent ou si tout reste obstinément à zéro.
                    if last_print.elapsed() >= Duration::from_secs(4) {
                        println!(
                            "  [{name}] axes {:?} | repos {:?} | povs {:?} | octets non nuls {}",
                            snap.axes, snap.baseline, snap.povs, snap.nonzero_bytes
                        );
                    }
                }
                Err(e) => println!("  {name} : lecture ÉCHEC — {e}"),
            }
        }
        if last_print.elapsed() >= Duration::from_secs(4) {
            last_print = Instant::now();
        }
        std::thread::sleep(Duration::from_millis(60));
    }

    println!(
        "\nBilan : {}",
        if ever_pressed {
            "au moins un appui a été détecté."
        } else {
            "AUCUN appui détecté."
        }
    );
}

/// Une fenêtre valide, que DirectInput exige pour le niveau de coopération.
///
/// `GetConsoleWindow` renvoie zéro quand la sortie est redirigée — c'est le cas
/// dès qu'on passe par un tube — d'où le repli sur la fenêtre au premier plan.
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
