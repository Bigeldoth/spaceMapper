//! Énumération via DirectInput 8.
//!
//! Pourquoi DirectInput et non l'API HID générique : Star Citizen est
//! lui-même un client DirectInput, et les GUID qu'il écrit dans
//! `actionmaps.xml` sont les `guidInstance` renvoyés ici. Passer par HID
//! obligerait à réconcilier VID/PID/numéro de série avec un GUID DirectInput,
//! une correspondance qui n'est pas fiable quand deux exemplaires identiques
//! sont branchés — exactement le cas HOSAS qui nous intéresse le plus.

use super::{DeviceCapabilities, DeviceEnumerator, DeviceGuid, InputDevice};
use crate::{Error, Result};

// `Interface` doit être en portée pour accéder à `IDirectInput8W::IID`.
use windows::core::{Interface, GUID};
use windows::Win32::Devices::HumanInterfaceDevice::{
    DirectInput8Create, IDirectInput8W, DIDEVCAPS, DIDEVICEINSTANCEW, DIEDFL_ATTACHEDONLY,
    DIRECTINPUT_VERSION,
};
use windows::Win32::Foundation::{BOOL, HINSTANCE, TRUE};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;

/// Classe DirectInput des contrôleurs de jeu (joysticks, manches, palonniers).
/// La constante n'est pas exposée par le crate `windows`.
const DI8DEVCLASS_GAMECTRL: u32 = 4;

/// Valeur de retour du callback signifiant « continuer l'énumération ».
const DIENUM_CONTINUE: BOOL = TRUE;

pub struct DirectInputEnumerator;

impl DirectInputEnumerator {
    pub fn new() -> Self {
        Self
    }
}

impl Default for DirectInputEnumerator {
    fn default() -> Self {
        Self::new()
    }
}

impl DeviceEnumerator for DirectInputEnumerator {
    fn enumerate(&self) -> Result<Vec<InputDevice>> {
        // SAFETY: on crée une interface DirectInput8 pour la durée de l'appel,
        // on énumère de façon synchrone, et on ne conserve aucun pointeur
        // au-delà. Le callback n'écrit que dans le `Vec` qu'on lui confie.
        unsafe { enumerate_inner() }.map_err(|e| Error::DeviceEnumeration(e.to_string()))
    }
}

unsafe fn enumerate_inner() -> windows::core::Result<Vec<InputDevice>> {
    let module = GetModuleHandleW(None)?;
    let hinstance = HINSTANCE(module.0);

    let mut raw: Option<IDirectInput8W> = None;
    DirectInput8Create(
        hinstance,
        DIRECTINPUT_VERSION,
        &IDirectInput8W::IID,
        &mut raw as *mut _ as *mut _,
        None,
    )?;
    let dinput = raw.ok_or_else(|| {
        windows::core::Error::new(
            windows::Win32::Foundation::E_FAIL,
            "DirectInput8Create n'a renvoyé aucune interface",
        )
    })?;

    let mut instances: Vec<DIDEVICEINSTANCEW> = Vec::new();
    dinput.EnumDevices(
        DI8DEVCLASS_GAMECTRL,
        Some(enum_callback),
        &mut instances as *mut _ as *mut core::ffi::c_void,
        DIEDFL_ATTACHEDONLY,
    )?;

    let mut devices = Vec::with_capacity(instances.len());
    for instance in &instances {
        let instance_guid = match DeviceGuid::parse(&format_guid(&instance.guidInstance)) {
            Some(g) => g,
            // Un périphérique sans GUID exploitable ne peut pas être suivi de
            // façon stable : l'ignorer vaut mieux que de l'afficher comme sûr.
            None => continue,
        };
        let product_guid = DeviceGuid::parse(&format_guid(&instance.guidProduct))
            .unwrap_or_else(|| instance_guid.clone());

        devices.push(InputDevice {
            instance_guid,
            product_guid,
            product_name: wide_to_string(&instance.tszProductName),
            instance_name: wide_to_string(&instance.tszInstanceName),
            category: super::DeviceCategory::from_dev_type(instance.dwDevType),
            capabilities: read_capabilities(&dinput, &instance.guidInstance),
        });
    }

    Ok(devices)
}

/// Callback d'énumération. `context` pointe sur le `Vec<DIDEVICEINSTANCEW>`
/// alloué par `enumerate_inner`.
///
/// DirectInput déclare le paramètre `*mut` bien qu'il ne s'agisse que d'une
/// lecture ; on respecte sa signature et on se contente de copier.
unsafe extern "system" fn enum_callback(
    instance: *mut DIDEVICEINSTANCEW,
    context: *mut core::ffi::c_void,
) -> BOOL {
    if let (Some(instance), false) = (instance.as_ref(), context.is_null()) {
        let devices = &mut *(context as *mut Vec<DIDEVICEINSTANCEW>);
        devices.push(*instance);
    }
    DIENUM_CONTINUE
}

/// Nombre d'axes, de boutons et de chapeaux.
///
/// Un échec ici n'est pas fatal : on sait toujours *quel* périphérique est
/// branché, on ignore juste sa forme. Le canevas visuel de la Phase 2 s'en
/// contentera avec un rendu générique.
unsafe fn read_capabilities(dinput: &IDirectInput8W, guid: &GUID) -> DeviceCapabilities {
    let mut device = None;
    if dinput.CreateDevice(guid, &mut device, None).is_err() {
        return DeviceCapabilities::default();
    }
    let Some(device) = device else {
        return DeviceCapabilities::default();
    };

    let mut caps = DIDEVCAPS {
        dwSize: core::mem::size_of::<DIDEVCAPS>() as u32,
        ..Default::default()
    };
    if device.GetCapabilities(&mut caps).is_err() {
        return DeviceCapabilities::default();
    }

    DeviceCapabilities {
        axes: caps.dwAxes,
        buttons: caps.dwButtons,
        povs: caps.dwPOVs,
    }
}

/// Formate un `GUID` Win32 en `{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}`,
/// c'est-à-dire exactement ce que Star Citizen écrit dans `actionmaps.xml`.
fn format_guid(guid: &GUID) -> String {
    format!(
        "{{{:08X}-{:04X}-{:04X}-{:02X}{:02X}-{:02X}{:02X}{:02X}{:02X}{:02X}{:02X}}}",
        guid.data1,
        guid.data2,
        guid.data3,
        guid.data4[0],
        guid.data4[1],
        guid.data4[2],
        guid.data4[3],
        guid.data4[4],
        guid.data4[5],
        guid.data4[6],
        guid.data4[7],
    )
}

/// Convertit un tampon UTF-16 terminé par NUL en `String`.
fn wide_to_string(buffer: &[u16]) -> String {
    let end = buffer.iter().position(|&c| c == 0).unwrap_or(buffer.len());
    String::from_utf16_lossy(&buffer[..end]).trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_guid_matches_game_notation() {
        // Le GUID d'un VKB : les quatre derniers octets épellent "PIDVID".
        let guid = GUID::from_values(
            0x231D_044F,
            0x0000,
            0x0000,
            [0x00, 0x00, 0x50, 0x49, 0x44, 0x56, 0x49, 0x44],
        );
        assert_eq!(format_guid(&guid), "{231D044F-0000-0000-0000-504944564944}");
        // Et il doit survivre au parseur qui l'attend.
        assert!(DeviceGuid::parse(&format_guid(&guid)).is_some());
    }

    #[test]
    fn wide_to_string_stops_at_nul() {
        let mut buffer = [0u16; 16];
        for (i, c) in "VKB NXT".encode_utf16().enumerate() {
            buffer[i] = c;
        }
        assert_eq!(wide_to_string(&buffer), "VKB NXT");
    }
}
