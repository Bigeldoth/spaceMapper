//! Lecture de l'état d'un périphérique, pour capturer l'appui d'un bouton.
//!
//! On passe par DirectInput plutôt que par l'API Gamepad du navigateur, alors
//! que celle-ci aurait évité tout code natif. La raison est décisive : Chromium
//! remappe les manettes reconnues sur une disposition « standard », si bien que
//! son `buttons[0]` ne correspond pas nécessairement au bouton 1 de
//! DirectInput. Star Citizen, lui, lit DirectInput. Un décalage d'indice
//! produirait une assignation silencieusement fausse — précisément ce que ce
//! logiciel existe pour éviter.
//!
//! En lisant la même API que le jeu, le bouton 5 est le bouton 5.

use super::DeviceGuid;
use crate::{Error, Result};
use std::cell::Cell;

// `Interface` doit être en portée pour accéder à `IDirectInput8W::IID`.
use windows::core::{Interface, GUID};
use windows::Win32::Devices::HumanInterfaceDevice::{
    DirectInput8Create, GUID_RxAxis, GUID_RyAxis, GUID_RzAxis, GUID_Slider, GUID_XAxis, GUID_YAxis,
    GUID_ZAxis, IDirectInput8W, IDirectInputDevice8W, DIDATAFORMAT, DIDFT_ANYINSTANCE, DIDFT_AXIS,
    DIDFT_BUTTON, DIDFT_POV, DIDF_ABSAXIS, DIDOI_ASPECTPOSITION, DIJOYSTATE2, DIOBJECTDATAFORMAT,
    DIRECTINPUT_VERSION, DISCL_BACKGROUND, DISCL_NONEXCLUSIVE, GUID_POV,
};
use windows::Win32::Foundation::{HINSTANCE, HWND};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;

/// Écart minimal, sur l'échelle brute d'un axe, pour considérer qu'il a bougé.
///
/// Les axes reposent rarement exactement au centre et dérivent avec l'usure.
/// Un seuil trop bas capterait ce bruit à la place de l'intention du joueur.
const AXIS_THRESHOLD: i32 = 12_000;

/// Vitesse à laquelle le repos rejoint la position courante d'un axe.
///
/// Un huitième de l'écart à chaque relevé : un axe immobile est rattrapé en
/// une fraction de seconde, tandis qu'un mouvement franc dépasse le seuil bien
/// avant que le repos n'ait le temps de suivre.
const BASELINE_FOLLOW: i32 = 8;

/// Un contrôle actionné, nommé comme Star Citizen le nomme.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CapturedControl {
    /// Ex. `button5`, `x`, `hat1_up`.
    pub control: String,
}

/// Capture simultanée sur plusieurs périphériques.
///
/// Sonder tous les manches à la fois plutôt qu'un seul évite à l'utilisateur
/// de désigner d'abord le bon : il actionne ce qu'il veut assigner, et
/// l'application reconnaît lequel a bougé. C'est aussi le seul moyen de
/// distinguer deux exemplaires identiques d'un même modèle, cas courant en
/// HOSAS.
pub struct MultiCaptureSession {
    sessions: Vec<(DeviceGuid, CaptureSession)>,
}

/// Ce qu'a produit un périphérique identifié.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CapturedFrom {
    pub guid: DeviceGuid,
    pub control: String,
}

impl MultiCaptureSession {
    /// Ouvre une session sur chaque périphérique désigné.
    ///
    /// Les échecs individuels sont conservés et rapportés, sans empêcher les
    /// autres de fonctionner : un manche capricieux ne doit pas rendre la
    /// capture indisponible pour tous.
    pub fn open(guids: &[DeviceGuid], hwnd: isize) -> (Self, Vec<String>) {
        let mut sessions = Vec::new();
        let mut failures = Vec::new();

        for guid in guids {
            match CaptureSession::open(guid, hwnd) {
                Ok(session) => sessions.push((guid.clone(), session)),
                Err(e) => failures.push(format!("{guid} : {e}")),
            }
        }

        (MultiCaptureSession { sessions }, failures)
    }

    pub fn is_empty(&self) -> bool {
        self.sessions.is_empty()
    }

    /// Premier contrôle actionné, tous périphériques confondus.
    pub fn poll(&self) -> Option<CapturedFrom> {
        for (guid, session) in &self.sessions {
            // Un périphérique en panne ne doit pas masquer les autres : on
            // passe au suivant plutôt que d'interrompre le balayage.
            if let Ok(Some(found)) = session.poll() {
                return Some(CapturedFrom {
                    guid: guid.clone(),
                    control: found.control,
                });
            }
        }
        None
    }
}

/// État brut d'un périphérique, tel que DirectInput le renvoie.
#[derive(Debug, Clone)]
pub struct RawSnapshot {
    pub axes: [i32; 8],
    /// Repos relevé à l'ouverture, auquel les axes sont comparés.
    pub baseline: [i32; 8],
    pub povs: [u32; 4],
    /// Numéros des boutons enfoncés, à partir de 1.
    pub pressed: Vec<usize>,
    /// Octets de bouton non nuls, y compris ceux dont le bit de poids fort
    /// n'est pas mis : distingue « rien ne remonte » de « le format ne
    /// correspond pas ».
    pub nonzero_bytes: usize,
}

/// Session de capture sur un périphérique.
///
/// Acquiert le périphérique à la création et le libère à la destruction.
pub struct CaptureSession {
    device: IDirectInputDevice8W,
    axes: AxisTracker,
}

/// Suivi du repos des axes.
///
/// Isolé du périphérique pour être éprouvable sans matériel : c'est ici que se
/// joue la distinction entre un axe qu'on actionne et un axe simplement posé
/// ailleurs qu'au centre.
///
/// Le repos est **suivi en continu**, et non figé à l'ouverture. Un manche
/// porte souvent des axes qui ne reviennent pas au centre : la manette des gaz
/// d'un T.16000M reste où on la laisse. Comparée à un repos figé, elle paraît
/// actionnée en permanence et écrase tout appui de bouton au relevé suivant.
#[derive(Debug, Default)]
struct AxisTracker {
    baseline: Cell<[i32; 8]>,
    /// Le premier relevé sert de repos initial et n'est jamais interprété.
    primed: Cell<bool>,
}

impl AxisTracker {
    /// Indice de l'axe qui vient de bouger, et mise à jour du repos.
    fn moved(&self, axes: [i32; 8]) -> Option<usize> {
        let mut baseline = self.baseline.get();

        // Le tout premier relevé définit le repos sans rien interpréter.
        if !self.primed.get() {
            self.baseline.set(axes);
            self.primed.set(true);
            return None;
        }

        let mut moved = None;
        for index in 0..axes.len() {
            let drift = axes[index] - baseline[index];
            if moved.is_none() && drift.abs() >= AXIS_THRESHOLD {
                moved = Some(index);
            }
            // Le repos rejoint la position courante, y compris pendant un
            // mouvement : un axe maintenu finit par se taire, ce qui évite
            // qu'il masque indéfiniment les appuis de boutons.
            baseline[index] += drift / BASELINE_FOLLOW;
        }

        self.baseline.set(baseline);
        moved
    }
}

impl CaptureSession {
    /// Ouvre une session sur le périphérique désigné.
    ///
    /// `hwnd` est la fenêtre de l'application : DirectInput l'exige pour fixer
    /// le niveau de coopération. On demande `BACKGROUND | NONEXCLUSIVE` afin de
    /// ne jamais priver un autre programme du périphérique.
    pub fn open(guid: &DeviceGuid, hwnd: isize) -> Result<Self> {
        // Un handle nul produirait un E_INVALIDARG opaque au moment de fixer
        // le niveau de coopération ; autant nommer la cause tout de suite.
        if hwnd == 0 {
            return Err(Error::DeviceEnumeration(
                "capture impossible sans fenêtre : DirectInput exige un handle valide".into(),
            ));
        }

        // SAFETY: interface créée et périphérique acquis pour la durée de vie
        // de la session ; aucun pointeur n'est conservé au-delà.
        unsafe { Self::open_inner(guid, hwnd) }
    }

    unsafe fn open_inner(guid: &DeviceGuid, hwnd: isize) -> Result<Self> {
        // Chaque étape est nommée : sans cela, toutes les pannes se
        // ressemblent, et l'utilisateur comme le développeur ignorent laquelle
        // du format, du niveau de coopération ou de l'acquisition a cédé.
        let module = GetModuleHandleW(None).map_err(|e| step("handle de module", e))?;

        let mut raw: Option<IDirectInput8W> = None;
        DirectInput8Create(
            HINSTANCE(module.0),
            DIRECTINPUT_VERSION,
            &IDirectInput8W::IID,
            &mut raw as *mut _ as *mut _,
            None,
        )
        .map_err(|e| step("création de DirectInput", e))?;

        let dinput = raw.ok_or_else(|| {
            Error::DeviceEnumeration("DirectInput8Create n'a renvoyé aucune interface".into())
        })?;

        let mut device = None;
        dinput
            .CreateDevice(&parse_guid(guid)?, &mut device, None)
            .map_err(|e| step("ouverture du périphérique", e))?;
        let device =
            device.ok_or_else(|| Error::DeviceEnumeration("périphérique introuvable".into()))?;

        device
            .SetDataFormat(&mut joystick_format())
            .map_err(|e| step("format de données", e))?;
        device
            .SetCooperativeLevel(HWND(hwnd as *mut _), DISCL_BACKGROUND | DISCL_NONEXCLUSIVE)
            .map_err(|e| step("niveau de coopération", e))?;
        device
            .Acquire()
            .map_err(|e| step("acquisition du périphérique", e))?;

        // Le repos s'établit au premier relevé de `poll`, pas ici : un
        // périphérique tout juste acquis ne renvoie pas toujours des valeurs
        // représentatives.
        Ok(CaptureSession {
            device,
            axes: AxisTracker::default(),
        })
    }

    /// Relève le premier contrôle actionné, s'il y en a un.
    pub fn poll(&self) -> Result<Option<CapturedControl>> {
        let state = unsafe { self.read() }.map_err(|e| Error::DeviceEnumeration(e.to_string()))?;

        // Les boutons d'abord : c'est ce que l'utilisateur vise dans la très
        // grande majorité des cas, et un axe légèrement bruité ne doit pas
        // prendre la priorité sur un appui franc.
        for (index, raw) in state.rgbButtons.iter().enumerate() {
            if raw & 0x80 != 0 {
                return Ok(Some(CapturedControl {
                    control: format!("button{}", index + 1),
                }));
            }
        }

        for (index, angle) in state.rgdwPOV.iter().enumerate() {
            if let Some(direction) = pov_direction(*angle) {
                return Ok(Some(CapturedControl {
                    control: format!("hat{}_{}", index + 1, direction),
                }));
            }
        }

        Ok(self
            .axes
            .moved(axes_of(&state))
            .map(|index| CapturedControl {
                control: AXIS_NAMES[index].to_string(),
            }))
    }

    /// Relevé brut de l'état, pour diagnostic.
    ///
    /// Quand la capture ne réagit pas, il faut pouvoir distinguer « DirectInput
    /// ne renvoie rien » de « il renvoie quelque chose que nous interprétons
    /// mal ». Sans cette lecture, les deux se ressemblent.
    pub fn snapshot(&self) -> Result<RawSnapshot> {
        let state = unsafe { self.read() }.map_err(|e| step("lecture d'état", e))?;
        Ok(RawSnapshot {
            axes: axes_of(&state),
            baseline: self.axes.baseline.get(),
            povs: state.rgdwPOV,
            pressed: state
                .rgbButtons
                .iter()
                .enumerate()
                .filter(|(_, b)| *b & 0x80 != 0)
                .map(|(i, _)| i + 1)
                .collect(),
            nonzero_bytes: state.rgbButtons.iter().filter(|b| **b != 0).count(),
        })
    }

    unsafe fn read(&self) -> windows::core::Result<DIJOYSTATE2> {
        // Un périphérique peut être perdu (verrouillage de session, autre
        // application exclusive) : on tente de le réacquérir plutôt que
        // d'abandonner la capture en cours.
        if self.device.Poll().is_err() {
            let _ = self.device.Acquire();
            self.device.Poll()?;
        }

        let mut state = DIJOYSTATE2::default();
        self.device.GetDeviceState(
            core::mem::size_of::<DIJOYSTATE2>() as u32,
            &mut state as *mut _ as *mut core::ffi::c_void,
        )?;
        Ok(state)
    }
}

impl Drop for CaptureSession {
    fn drop(&mut self) {
        // SAFETY: le périphérique nous appartient et n'est plus utilisé après.
        unsafe {
            let _ = self.device.Unacquire();
        }
    }
}

/// Noms Star Citizen des huit axes, dans l'ordre de [`axes_of`].
const AXIS_NAMES: [&str; 8] = ["x", "y", "z", "rotx", "roty", "rotz", "slider1", "slider2"];

/// Composition du format de données, telle que [`joystick_format`] la décrit.
const NAMED_AXES: usize = 6;
const SLIDERS: usize = 2;
const POVS: usize = 4;
const BUTTONS: usize = 128;
const OBJECT_COUNT: usize = NAMED_AXES + SLIDERS + POVS + BUTTONS;

/// Rend un objet facultatif dans le format de données.
///
/// Le crate `windows` n'expose pas cette constante. Sans elle, DirectInput
/// exige que le périphérique possède **tous** les objets déclarés : un format
/// décrivant 128 boutons serait refusé par un manche qui n'en a que seize, ce
/// qui est le cas de tous les manches réels.
const DIDFT_OPTIONAL: u32 = 0x8000_0000;

fn axes_of(state: &DIJOYSTATE2) -> [i32; 8] {
    [
        state.lX,
        state.lY,
        state.lZ,
        state.lRx,
        state.lRy,
        state.lRz,
        state.rglSlider[0],
        state.rglSlider[1],
    ]
}

/// Traduit l'angle d'un chapeau en direction.
///
/// DirectInput renvoie des centièmes de degré, et `0xFFFF` (ou tout mot haut
/// à `0xFFFF`) quand le chapeau est au repos. Les huit positions sont ramenées
/// aux quatre directions cardinales, seules nommées par le jeu.
fn pov_direction(angle: u32) -> Option<&'static str> {
    if angle == u32::MAX || (angle & 0xFFFF) == 0xFFFF {
        return None;
    }
    let degrees = (angle / 100) % 360;
    Some(match degrees {
        45..135 => "right",
        135..225 => "down",
        225..315 => "left",
        // Le secteur du haut enjambe zéro : il réunit 315..360 et 0..45.
        _ => "up",
    })
}

/// Nomme l'étape qui a échoué, pour que l'erreur soit exploitable.
fn step(stage: &str, source: windows::core::Error) -> Error {
    Error::DeviceEnumeration(format!("{stage}: {source}"))
}

fn parse_guid(guid: &DeviceGuid) -> Result<GUID> {
    let text = guid.as_str().trim_matches(|c| c == '{' || c == '}');
    let hex: String = text.chars().filter(|c| *c != '-').collect();
    u128::from_str_radix(&hex, 16)
        .map(GUID::from_u128)
        .map_err(|_| Error::DeviceEnumeration(format!("GUID illisible: {guid}")))
}

/// Format de données décrivant [`DIJOYSTATE2`].
///
/// On le construit plutôt que de lier le symbole `c_dfDIJoystick2` de
/// `dinput8.lib` : ce dernier n'est pas exposé par le crate `windows`, et
/// dépendre d'un symbole de données externe rendrait l'édition de liens
/// fragile. Les décalages sont dérivés de la structure elle-même, donc justes
/// par construction.
fn joystick_format() -> DIDATAFORMAT {
    // Les entrées vivent dans un tableau statique : DirectInput conserve le
    // pointeur le temps de l'appel, et un tableau local disparaîtrait.
    //
    // La taille est calculée depuis les parties plutôt que saisie à la main :
    // une première version comptait 134 au lieu de 140, et le débordement
    // tuait le thread de capture sans que rien ne le signale à l'utilisateur.
    static mut OBJECTS: [DIOBJECTDATAFORMAT; OBJECT_COUNT] = [DIOBJECTDATAFORMAT {
        pguid: std::ptr::null(),
        dwOfs: 0,
        dwType: 0,
        dwFlags: 0,
    }; OBJECT_COUNT];

    // SAFETY: initialisation unique, avant toute lecture, et l'application
    // n'ouvre qu'une session de capture à la fois.
    unsafe {
        let objects = &mut *std::ptr::addr_of_mut!(OBJECTS);
        let mut index = 0;

        // Six axes, chacun rattaché à son GUID pour que `lX` reçoive bien
        // l'axe X et non le premier axe rencontré.
        // Chaque objet est facultatif : aucun manche ne possède les six axes,
        // les deux curseurs, les quatre chapeaux et les cent vingt-huit
        // boutons décrits ici. `DIDOI_ASPECTPOSITION` précise qu'on veut la
        // position de l'axe et non sa vitesse ou l'effort appliqué.
        for (guid, offset) in [
            (&GUID_XAxis, std::mem::offset_of!(DIJOYSTATE2, lX)),
            (&GUID_YAxis, std::mem::offset_of!(DIJOYSTATE2, lY)),
            (&GUID_ZAxis, std::mem::offset_of!(DIJOYSTATE2, lZ)),
            (&GUID_RxAxis, std::mem::offset_of!(DIJOYSTATE2, lRx)),
            (&GUID_RyAxis, std::mem::offset_of!(DIJOYSTATE2, lRy)),
            (&GUID_RzAxis, std::mem::offset_of!(DIJOYSTATE2, lRz)),
        ] {
            objects[index] = DIOBJECTDATAFORMAT {
                pguid: guid,
                dwOfs: offset as u32,
                dwType: DIDFT_OPTIONAL | DIDFT_AXIS | DIDFT_ANYINSTANCE,
                dwFlags: DIDOI_ASPECTPOSITION,
            };
            index += 1;
        }

        for slot in 0..SLIDERS {
            objects[index] = DIOBJECTDATAFORMAT {
                pguid: &GUID_Slider,
                dwOfs: (std::mem::offset_of!(DIJOYSTATE2, rglSlider) + slot * 4) as u32,
                dwType: DIDFT_OPTIONAL | DIDFT_AXIS | DIDFT_ANYINSTANCE,
                dwFlags: DIDOI_ASPECTPOSITION,
            };
            index += 1;
        }

        for hat in 0..POVS {
            objects[index] = DIOBJECTDATAFORMAT {
                pguid: &GUID_POV,
                dwOfs: (std::mem::offset_of!(DIJOYSTATE2, rgdwPOV) + hat * 4) as u32,
                dwType: DIDFT_OPTIONAL | DIDFT_POV | DIDFT_ANYINSTANCE,
                dwFlags: 0,
            };
            index += 1;
        }

        // Les boutons n'ont pas de GUID imposé : DirectInput les affecte dans
        // l'ordre où le périphérique les déclare, qui est celui du jeu.
        for button in 0..BUTTONS {
            objects[index] = DIOBJECTDATAFORMAT {
                pguid: std::ptr::null(),
                dwOfs: (std::mem::offset_of!(DIJOYSTATE2, rgbButtons) + button) as u32,
                dwType: DIDFT_OPTIONAL | DIDFT_BUTTON | DIDFT_ANYINSTANCE,
                dwFlags: 0,
            };
            index += 1;
        }

        debug_assert_eq!(index, OBJECT_COUNT, "format incomplet ou débordant");

        DIDATAFORMAT {
            dwSize: core::mem::size_of::<DIDATAFORMAT>() as u32,
            dwObjSize: core::mem::size_of::<DIOBJECTDATAFORMAT>() as u32,
            dwFlags: DIDF_ABSAXIS,
            dwDataSize: core::mem::size_of::<DIJOYSTATE2>() as u32,
            dwNumObjs: index as u32,
            rgodf: objects.as_mut_ptr(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pov_rest_position_is_not_a_direction() {
        // Le repos se signale par un mot haut à 0xFFFF ; le confondre avec une
        // direction ferait capturer un chapeau que personne n'a touché.
        assert!(pov_direction(u32::MAX).is_none());
        assert!(pov_direction(0xFFFF).is_none());
    }

    #[test]
    fn pov_angles_map_to_cardinal_directions() {
        // DirectInput compte en centièmes de degré, sens horaire depuis le haut.
        assert_eq!(pov_direction(0), Some("up"));
        assert_eq!(pov_direction(9_000), Some("right"));
        assert_eq!(pov_direction(18_000), Some("down"));
        assert_eq!(pov_direction(27_000), Some("left"));
    }

    #[test]
    fn pov_diagonals_fall_on_the_nearest_cardinal() {
        // Le jeu ne nomme que quatre directions : une diagonale doit choisir,
        // pas être ignorée.
        assert_eq!(pov_direction(4_500), Some("right"));
        assert_eq!(pov_direction(31_500), Some("up"));
    }

    #[test]
    fn guid_roundtrips_through_directinput_form() {
        let text = "B10A044F-0000-0000-0000-504944564944";
        let parsed = parse_guid(&DeviceGuid::parse(text).unwrap()).unwrap();
        assert_eq!(parsed.data1, 0xB10A_044F);
    }

    #[test]
    fn data_format_declares_every_object_it_describes() {
        // Une première version dimensionnait le tableau à 134 pour 140
        // écritures. Le débordement tuait le thread de capture, et comme une
        // panique ne remplit aucun champ d'erreur, l'interface attendait un
        // appui qui ne viendrait jamais — sans le moindre message.
        assert_eq!(OBJECT_COUNT, NAMED_AXES + SLIDERS + POVS + BUTTONS);
        assert_eq!(joystick_format().dwNumObjs as usize, OBJECT_COUNT);
    }

    #[test]
    fn data_format_matches_the_state_structure() {
        let format = joystick_format();
        assert_eq!(
            format.dwDataSize as usize,
            core::mem::size_of::<DIJOYSTATE2>()
        );
        assert_eq!(
            format.dwObjSize as usize,
            core::mem::size_of::<DIOBJECTDATAFORMAT>()
        );
    }

    #[test]
    fn a_parked_axis_stops_being_reported() {
        // Le défaut qui rendait la capture inutilisable : la manette des gaz
        // d'un T.16000M reste où on la laisse. Comparée à un repos figé, elle
        // paraissait actionnée en permanence et écrasait chaque appui de
        // bouton au relevé suivant, à soixante relevés par seconde.
        let tracker = AxisTracker::default();
        let mut parked = [0; 8];
        parked[6] = 32_767; // slider1, posé loin du centre

        // Premier relevé : sert de repos, n'interprète rien.
        assert_eq!(tracker.moved(parked), None);

        // Les relevés suivants, à position identique, doivent rester muets.
        for _ in 0..50 {
            assert_eq!(tracker.moved(parked), None, "axe posé signalé à tort");
        }
    }

    #[test]
    fn an_axis_left_in_a_new_position_falls_silent_again() {
        // Après un déplacement, l'axe reste où l'utilisateur l'a laissé. Il ne
        // doit pas continuer à se signaler indéfiniment.
        let tracker = AxisTracker::default();
        let rest = [16_000; 8];
        assert_eq!(tracker.moved(rest), None);

        let mut shifted = rest;
        shifted[6] = 0;
        assert_eq!(tracker.moved(shifted), Some(6));

        for _ in 0..50 {
            tracker.moved(shifted);
        }
        assert_eq!(tracker.moved(shifted), None, "axe posé toujours signalé");
    }

    #[test]
    fn a_deliberate_movement_is_reported() {
        let tracker = AxisTracker::default();
        let rest = [16_000; 8];
        assert_eq!(tracker.moved(rest), None); // amorçage

        let mut pushed = rest;
        pushed[0] += AXIS_THRESHOLD; // axe X poussé franchement
        assert_eq!(tracker.moved(pushed), Some(0));
    }

    #[test]
    fn noise_below_the_threshold_is_ignored() {
        let tracker = AxisTracker::default();
        let rest = [16_000; 8];
        assert_eq!(tracker.moved(rest), None);

        let mut jitter = rest;
        jitter[3] += AXIS_THRESHOLD - 1;
        assert_eq!(tracker.moved(jitter), None);
    }

    #[test]
    fn axis_names_cover_every_slot() {
        // `axes_of` et `AXIS_NAMES` sont indexés ensemble : un décalage
        // nommerait un axe pour un autre.
        assert_eq!(AXIS_NAMES.len(), axes_of(&DIJOYSTATE2::default()).len());
    }
}
