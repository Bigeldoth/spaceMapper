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

/// Avance minimale du mouvement dominant sur les autres axes pour l'assigner.
///
/// Quand on pousse un manche sur Y, la mécanique entraîne souvent légèrement X
/// (et inversement). Sans cette marge, le premier axe dans le format
/// DirectInput gagnait simplement par son ordre, même si ce n'était que la
/// dérive latérale du geste. La marge porte sur le déplacement cumulé depuis le
/// repos : elle filtre l'ambiguïté sans pénaliser un mouvement volontaire lent.
const AXIS_CAPTURE_DOMINANCE_MARGIN: i32 = 4_000;

/// Écart à partir duquel le mouvement devient visible dans le retour en direct.
///
/// Ce seuil est volontairement plus bas que [`AXIS_THRESHOLD`] : un petit
/// mouvement doit se voir sans pour autant devenir aussitôt le candidat que le
/// sélecteur va assigner. Deux seuils séparés évitent donc qu'un axe un peu
/// bruité vole une capture de bouton.
const LIVE_AXIS_THRESHOLD: i32 = 2_000;

/// Demi-étendue usuelle d'un axe DirectInput (plage 0..=65_535).
///
/// La valeur live exprime un **mouvement par rapport au repos adaptatif**, pas
/// une position absolue. C'est indispensable pour une manette des gaz qui peut
/// rester garée n'importe où sans paraître active en permanence.
const AXIS_NORMALIZER: f32 = 32_767.0;

/// Étendue maximale d'une fenêtre de relevés pour considérer qu'un axe est posé.
///
/// La stabilité est mesurée par rapport au début de la fenêtre, pas seulement
/// entre deux frames : une course continue de 100 unités par frame reste lente
/// localement, mais quitte rapidement cette fenêtre et ne peut donc pas être
/// prise pour une nouvelle position de repos.
const PARKED_DELTA_THRESHOLD: i32 = 256;

/// Nombre de frames stables avant d'adopter une nouvelle position de repos.
/// À 60 Hz, douze frames représentent environ 200 ms.
const PARKED_SAMPLES: u8 = 12;

/// Nature d'un contrôle DirectInput relevé.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CapturedControlKind {
    Button,
    Hat,
    Axis,
}

/// Un contrôle actionné, nommé comme Star Citizen le nomme.
#[derive(Debug, Clone, PartialEq)]
pub struct CapturedControl {
    /// Ex. `button5`, `x`, `hat1_up`.
    pub control: String,
    pub kind: CapturedControlKind,
    /// Intensité signée. Les contrôles numériques valent `1`; un axe vit
    /// dans `[-1, 1]`, dont le signe donne la direction.
    pub value: f32,
    /// Peut devenir le candidat persistant du sélecteur d'assignation.
    ///
    /// Les petits mouvements d'axe sont visibles mais ne franchissent pas le
    /// seuil de capture. Un bouton et la direction canonique d'un HAT sont
    /// capturables ; la seconde composante d'une diagonale HAT ne sert qu'au
    /// retour visuel.
    pub capturable: bool,
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
#[derive(Debug, Clone, PartialEq)]
pub struct CapturedFrom {
    pub guid: DeviceGuid,
    pub control: String,
    pub kind: CapturedControlKind,
    pub value: f32,
    pub capturable: bool,
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

    /// Tous les contrôles actionnés, tous périphériques confondus.
    ///
    /// Une panne isolée ne masque pas les autres manches. L'ordre reste
    /// déterministe : ordre des périphériques, puis boutons, HAT et axes.
    pub fn poll_all(&self) -> Vec<CapturedFrom> {
        let mut found = Vec::new();
        for (guid, session) in &self.sessions {
            // Un périphérique en panne ne doit pas masquer les autres : on
            // passe au suivant plutôt que d'interrompre le balayage.
            if let Ok(controls) = session.poll_all() {
                found.extend(controls.into_iter().map(|control| CapturedFrom {
                    guid: guid.clone(),
                    control: control.control,
                    kind: control.kind,
                    value: control.value,
                    capturable: control.capturable,
                }));
            }
        }
        found
    }

    /// Premier candidat capturable, conservé pour compatibilité.
    pub fn poll(&self) -> Option<CapturedFrom> {
        self.poll_all().into_iter().find(|input| input.capturable)
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
    /// Première position de la fenêtre de stabilité en cours, axe par axe.
    parked_origin: Cell<[i32; 8]>,
    /// Nombre de frames stables consécutives, axe par axe.
    parked_samples: Cell<[u8; 8]>,
    /// Nombre de relevés déjà vus, pour la période de chauffe.
    samples: Cell<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct AxisMotion {
    index: usize,
    /// Déplacement brut depuis le repos, utilisé avant normalisation pour ne
    /// pas perdre la dominance lorsque la valeur live est saturée à `1`.
    magnitude: i32,
    value: f32,
    capturable: bool,
}

/// Relevés ignorés avant de commencer à interpréter les axes.
///
/// Un périphérique tout juste acquis ne renvoie pas immédiatement des valeurs
/// représentatives : le premier relevé d'un T.16000M donne une manette des gaz
/// au centre, alors qu'elle est en butée. En s'y fiant, le repos mettait le
/// temps de sa convergence à rattraper la réalité, et l'axe se déclarait
/// pendant ce délai — un contrôle parasite à chaque ouverture.
const WARMUP_SAMPLES: u8 = 8;

impl AxisTracker {
    /// Axes qui viennent de bouger, puis mise à jour de leur repos.
    fn movements(&self, axes: [i32; 8]) -> Vec<AxisMotion> {
        let mut baseline = self.baseline.get();
        let mut parked_origin = self.parked_origin.get();
        let mut parked_samples = self.parked_samples.get();

        // Pendant la chauffe, le repos suit exactement la position lue et rien
        // n'est interprété.
        let samples = self.samples.get();
        if samples < WARMUP_SAMPLES {
            self.samples.set(samples + 1);
            self.baseline.set(axes);
            self.parked_origin.set(axes);
            self.parked_samples.set([0; 8]);
            return Vec::new();
        }

        let mut moved = Vec::new();
        for index in 0..axes.len() {
            let drift = axes[index] - baseline[index];
            if parked_samples[index] == 0
                || (axes[index] - parked_origin[index]).abs() > PARKED_DELTA_THRESHOLD
            {
                parked_origin[index] = axes[index];
                parked_samples[index] = 1;
            } else {
                parked_samples[index] = parked_samples[index].saturating_add(1);
            }

            // Le repos ne rejoint une position qu'après une vraie fenêtre
            // stable. Il reste donc figé pendant toute course continue, même
            // très lente, puis adopte une manette des gaz réellement garée.
            if parked_samples[index] >= PARKED_SAMPLES {
                baseline[index] = axes[index];
                parked_samples[index] = 0;
                continue;
            }

            if drift.abs() >= LIVE_AXIS_THRESHOLD {
                moved.push(AxisMotion {
                    index,
                    magnitude: drift.abs(),
                    value: (drift as f32 / AXIS_NORMALIZER).clamp(-1.0, 1.0),
                    // Le verdict est posé après avoir comparé tous les axes de
                    // cette même frame. Ils restent néanmoins tous visibles.
                    capturable: false,
                });
            }
        }

        // Un seul axe peut devenir candidat dans une frame. S'il est trop
        // proche de son concurrent, le geste reste ambigu et la capture attend
        // qu'une direction se détache au lieu de choisir X par simple ordre.
        if let Some((winner, strongest)) = moved
            .iter()
            .enumerate()
            .max_by_key(|(_, motion)| motion.magnitude)
            .map(|(index, motion)| (index, motion.magnitude))
        {
            let runner_up = moved
                .iter()
                .enumerate()
                .filter(|(index, _)| *index != winner)
                .map(|(_, motion)| motion.magnitude)
                .max()
                .unwrap_or(0);

            if strongest >= AXIS_THRESHOLD
                && strongest.saturating_sub(runner_up) >= AXIS_CAPTURE_DOMINANCE_MARGIN
            {
                moved[winner].capturable = true;
            }
        }

        self.baseline.set(baseline);
        self.parked_origin.set(parked_origin);
        self.parked_samples.set(parked_samples);
        moved
    }

    /// Compatibilité avec les tests et appelants qui ne cherchent que le
    /// premier axe assez franc pour être assigné.
    #[cfg(test)]
    fn moved(&self, axes: [i32; 8]) -> Option<usize> {
        self.movements(axes)
            .into_iter()
            .find(|motion| motion.capturable)
            .map(|motion| motion.index)
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

    /// Relève tous les contrôles actionnés dans un même état DirectInput.
    pub fn poll_all(&self) -> Result<Vec<CapturedControl>> {
        let state = unsafe { self.read() }.map_err(|e| Error::DeviceEnumeration(e.to_string()))?;
        Ok(controls_from_state(&state, &self.axes))
    }

    /// Relève le premier candidat capturable, conservé pour compatibilité.
    pub fn poll(&self) -> Result<Option<CapturedControl>> {
        Ok(self
            .poll_all()?
            .into_iter()
            .find(|control| control.capturable))
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

/// Interprète un relevé sans accès au matériel.
///
/// Cette frontière pure rend testables les appuis simultanés et surtout la
/// frame vide de relâchement, deux comportements que l'ancienne API "premier
/// contrôle" ne pouvait pas exprimer.
fn controls_from_state(state: &DIJOYSTATE2, axes: &AxisTracker) -> Vec<CapturedControl> {
    let mut controls = Vec::new();

    // Les boutons d'abord : le candidat persistant garde ainsi la priorité
    // historique, tandis que la frame live contient tout le reste aussi.
    controls.extend(
        state
            .rgbButtons
            .iter()
            .enumerate()
            .filter(|(_, raw)| *raw & 0x80 != 0)
            .map(|(index, _)| CapturedControl {
                control: format!("button{}", index + 1),
                kind: CapturedControlKind::Button,
                value: 1.0,
                capturable: true,
            }),
    );

    controls.extend(state.rgdwPOV.iter().enumerate().flat_map(|(index, angle)| {
        let canonical = pov_direction(*angle);
        pov_components(*angle)
            .into_iter()
            .flatten()
            .map(move |direction| CapturedControl {
                control: format!("hat{}_{}", index + 1, direction),
                kind: CapturedControlKind::Hat,
                value: 1.0,
                // Le nom persistant reste strictement compatible avec
                // l'ancien découpage cardinal. L'autre composante
                // d'une diagonale existe seulement dans la frame live.
                capturable: canonical == Some(direction),
            })
    }));

    controls.extend(
        axes.movements(axes_of(state))
            .into_iter()
            .map(|motion| CapturedControl {
                control: AXIS_NAMES[motion.index].to_string(),
                kind: CapturedControlKind::Axis,
                value: motion.value,
                capturable: motion.capturable,
            }),
    );

    controls
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

/// Décompose l'angle d'un POV en composantes cardinales pour le retour visuel.
///
/// Un périphérique quatre positions ne produit que les octants pairs. Un POV
/// huit positions produit aussi les octants impairs : deux flèches cardinales
/// s'allument alors ensemble, sans inventer un nouveau nom de contrôle dans le
/// format Star Citizen.
fn pov_components(angle: u32) -> [Option<&'static str>; 2] {
    if angle == u32::MAX || (angle & 0xFFFF) == 0xFFFF {
        return [None, None];
    }

    // DirectInput compte en centièmes de degré depuis le haut. Ajouter un demi
    // octant arrondit vers la position la plus proche ; le modulo accepte aussi
    // proprement les valeurs équivalentes après un tour complet.
    let octant = (((angle % 36_000) + 2_250) / 4_500) % 8;
    match octant {
        0 => [Some("up"), None],
        1 => [Some("up"), Some("right")],
        2 => [Some("right"), None],
        3 => [Some("right"), Some("down")],
        4 => [Some("down"), None],
        5 => [Some("down"), Some("left")],
        6 => [Some("left"), None],
        7 => [Some("left"), Some("up")],
        _ => unreachable!("un octant normalise reste toujours dans 0..8"),
    }
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
    /// Le format ne contient que des pointeurs vers les GUID immuables fournis
    /// par Windows. DirectInput lit ce tableau pendant `SetDataFormat` mais ne
    /// le modifie jamais ; il peut donc être partagé entre sessions.
    struct StaticObjects([DIOBJECTDATAFORMAT; OBJECT_COUNT]);
    // SAFETY: voir ci-dessus. Les pointeurs visent des constantes `GUID_*`
    // statiques (ou sont nuls), et le tableau est figé après `OnceLock`.
    unsafe impl Send for StaticObjects {}
    unsafe impl Sync for StaticObjects {}

    static OBJECTS: std::sync::OnceLock<StaticObjects> = std::sync::OnceLock::new();

    // Les entrées vivent dans un tableau statique : DirectInput reçoit leur
    // adresse pendant l'appel. `OnceLock` est décisif ici : la capture de
    // l'éditeur et le remappeur Premium peuvent ouvrir des sessions en même
    // temps sans réécrire un `static mut` partagé.
    let objects = &OBJECTS
        .get_or_init(|| {
            let mut objects = [DIOBJECTDATAFORMAT {
                pguid: std::ptr::null(),
                dwOfs: 0,
                dwType: 0,
                dwFlags: 0,
            }; OBJECT_COUNT];
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

            StaticObjects(objects)
        })
        .0;

    DIDATAFORMAT {
        dwSize: core::mem::size_of::<DIDATAFORMAT>() as u32,
        dwObjSize: core::mem::size_of::<DIOBJECTDATAFORMAT>() as u32,
        dwFlags: DIDF_ABSAXIS,
        dwDataSize: core::mem::size_of::<DIJOYSTATE2>() as u32,
        dwNumObjs: OBJECT_COUNT as u32,
        // L'API Windows utilise historiquement un pointeur mutable dans la
        // structure, bien que `SetDataFormat` ne fasse que lire les objets.
        rgodf: objects.as_ptr().cast_mut(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn state_with_axes(axes: [i32; 8]) -> DIJOYSTATE2 {
        let mut state = DIJOYSTATE2::default();
        state.lX = axes[0];
        state.lY = axes[1];
        state.lZ = axes[2];
        state.lRx = axes[3];
        state.lRy = axes[4];
        state.lRz = axes[5];
        state.rglSlider = [axes[6], axes[7]];
        state.rgdwPOV = [u32::MAX; 4];
        state
    }

    #[test]
    fn pov_rest_position_is_not_a_direction() {
        // Le repos se signale par un mot haut à 0xFFFF ; le confondre avec une
        // direction ferait capturer un chapeau que personne n'a touché.
        assert!(pov_direction(u32::MAX).is_none());
        assert!(pov_direction(0xFFFF).is_none());
        assert_eq!(pov_components(u32::MAX), [None, None]);
        assert_eq!(pov_components(0xFFFF), [None, None]);
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
    fn pov_components_cover_four_and_eight_position_hats() {
        let components = |angle| {
            pov_components(angle)
                .into_iter()
                .flatten()
                .collect::<Vec<_>>()
        };

        assert_eq!(components(0), ["up"]);
        assert_eq!(components(4_500), ["up", "right"]);
        assert_eq!(components(9_000), ["right"]);
        assert_eq!(components(13_500), ["right", "down"]);
        assert_eq!(components(18_000), ["down"]);
        assert_eq!(components(22_500), ["down", "left"]);
        assert_eq!(components(27_000), ["left"]);
        assert_eq!(components(31_500), ["left", "up"]);

        // Une valeur exprimant le même angle après un tour reste équivalente.
        assert_eq!(components(40_500), ["up", "right"]);
    }

    #[test]
    fn live_hat_components_keep_exactly_one_canonical_capture_candidate() {
        let cases = [
            (0, &["up"][..], "up"),
            (4_500, &["up", "right"][..], "right"),
            (9_000, &["right"][..], "right"),
            (13_500, &["right", "down"][..], "down"),
            (18_000, &["down"][..], "down"),
            (22_500, &["down", "left"][..], "left"),
            (27_000, &["left"][..], "left"),
            (31_500, &["left", "up"][..], "up"),
        ];

        for (angle, expected_directions, expected_canonical) in cases {
            let axes = AxisTracker::default();
            let rest = [8_000; 8];
            warm_up(&axes, rest);
            let mut state = state_with_axes(rest);
            state.rgdwPOV[0] = angle;

            let controls = controls_from_state(&state, &axes);
            let directions = controls
                .iter()
                .map(|control| control.control.strip_prefix("hat1_").unwrap())
                .collect::<Vec<_>>();
            let capturable = controls
                .iter()
                .filter(|control| control.capturable)
                .collect::<Vec<_>>();

            assert_eq!(directions, expected_directions, "angle {angle}");
            assert!(controls.iter().all(|control| {
                control.kind == CapturedControlKind::Hat && control.value == 1.0
            }));
            assert_eq!(capturable.len(), 1, "angle {angle}");
            assert_eq!(
                capturable[0].control,
                format!("hat1_{expected_canonical}"),
                "angle {angle}"
            );
        }
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
    fn data_format_is_initialized_once_across_parallel_sessions() {
        let workers = (0..8)
            .map(|_| std::thread::spawn(|| joystick_format().rgodf as usize))
            .collect::<Vec<_>>();
        let pointers = workers
            .into_iter()
            .map(|worker| worker.join().unwrap())
            .collect::<Vec<_>>();

        assert!(pointers.iter().all(|pointer| *pointer != 0));
        assert!(pointers.iter().all(|pointer| *pointer == pointers[0]));
    }

    /// Fait passer la période de chauffe à position constante.
    fn warm_up(tracker: &AxisTracker, axes: [i32; 8]) {
        for _ in 0..WARMUP_SAMPLES {
            assert_eq!(tracker.moved(axes), None, "relevé de chauffe interprété");
        }
    }

    #[test]
    fn nothing_is_reported_during_warm_up() {
        // Un périphérique fraîchement acquis renvoie d'abord des valeurs
        // trompeuses : la manette des gaz d'un T.16000M s'y annonce au centre
        // alors qu'elle est en butée. S'y fier faisait apparaître un contrôle
        // parasite à chaque ouverture de l'éditeur.
        let tracker = AxisTracker::default();
        let mut misleading = [0; 8];
        misleading[6] = 32_767;
        assert_eq!(tracker.moved(misleading), None);

        // Puis la vraie position, très différente.
        let mut real = [0; 8];
        real[6] = 0;
        for _ in 1..WARMUP_SAMPLES {
            assert_eq!(tracker.moved(real), None, "chauffe interrompue trop tôt");
        }
        assert_eq!(tracker.moved(real), None, "axe posé signalé après chauffe");
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

        warm_up(&tracker, parked);

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
        warm_up(&tracker, rest);

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
        warm_up(&tracker, rest);

        let mut pushed = rest;
        pushed[0] += AXIS_THRESHOLD; // axe X poussé franchement
        assert_eq!(tracker.moved(pushed), Some(0));
    }

    #[test]
    fn a_progressive_movement_is_not_absorbed_before_capture() {
        // Avec une baseline qui suivait même pendant le geste, une course
        // régulière mais lente plafonnait sous le seuil relatif et l'axe
        // n'était jamais assignable, malgré un grand déplacement total. Cent
        // unités par frame représentent environ deux secondes pour atteindre
        // le seuil de capture à 60 Hz.
        let tracker = AxisTracker::default();
        let rest = [16_000; 8];
        warm_up(&tracker, rest);

        let mut captured = false;
        let mut moved = rest;
        for step in 1..=130 {
            moved[0] = rest[0] + step * 100;
            captured |= tracker.moved(moved) == Some(0);
        }

        assert!(captured, "le déplacement progressif lent a été absorbé");

        // Une fois la course terminée, la nouvelle position doit malgré tout
        // redevenir silencieuse, comme une manette des gaz laissée en place.
        for _ in 0..(PARKED_SAMPLES + 2) {
            tracker.moved(moved);
        }
        assert_eq!(tracker.moved(moved), None, "l'axe garé reste actif");
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

    #[test]
    fn live_frame_reports_every_pressed_button_and_then_release() {
        let axes = AxisTracker::default();
        let rest = [16_000; 8];
        warm_up(&axes, rest);
        let mut pressed = state_with_axes(rest);
        pressed.rgbButtons[0] = 0x80;
        pressed.rgbButtons[4] = 0x80;

        let controls = controls_from_state(&pressed, &axes);
        assert_eq!(controls.len(), 2);
        assert_eq!(controls[0].control, "button1");
        assert_eq!(controls[1].control, "button5");
        assert!(controls
            .iter()
            .all(|control| control.kind == CapturedControlKind::Button));
        assert!(controls.iter().all(|control| control.capturable));

        let released = controls_from_state(&state_with_axes(rest), &axes);
        assert!(
            released.is_empty(),
            "le relâchement doit publier une frame vide"
        );
    }

    #[test]
    fn live_frame_keeps_hat_distinct_from_axes() {
        let axes = AxisTracker::default();
        let rest = [8_000; 8];
        warm_up(&axes, rest);
        let mut state = state_with_axes(rest);
        state.rgdwPOV[0] = 9_000;

        let controls = controls_from_state(&state, &axes);
        assert_eq!(controls.len(), 1);
        assert_eq!(controls[0].control, "hat1_right");
        assert_eq!(controls[0].kind, CapturedControlKind::Hat);
        assert_eq!(controls[0].value, 1.0);
    }

    #[test]
    fn subtle_axis_motion_is_live_but_not_a_capture_candidate() {
        let tracker = AxisTracker::default();
        let rest = [16_000; 8];
        warm_up(&tracker, rest);
        let mut moved = rest;
        moved[0] += LIVE_AXIS_THRESHOLD + 1_000;

        let controls = controls_from_state(&state_with_axes(moved), &tracker);
        assert_eq!(controls.len(), 1);
        assert_eq!(controls[0].control, "x");
        assert_eq!(controls[0].kind, CapturedControlKind::Axis);
        assert!(controls[0].value > 0.0);
        assert!(controls[0].value <= 1.0);
        assert!(!controls[0].capturable);
    }

    #[test]
    fn axis_live_values_preserve_direction_and_only_capture_the_dominant_axis() {
        let tracker = AxisTracker::default();
        let rest = [20_000; 8];
        warm_up(&tracker, rest);
        let mut moved = rest;
        moved[0] += 15_000;
        moved[1] -= 24_000;

        let controls = controls_from_state(&state_with_axes(moved), &tracker);
        assert_eq!(controls.len(), 2);
        assert_eq!(controls[0].control, "x");
        assert!(controls[0].value > 0.0);
        assert!(
            !controls[0].capturable,
            "la dérive X ne doit pas voler le mouvement Y plus ample"
        );
        assert_eq!(controls[1].control, "y");
        assert!(controls[1].value < 0.0);
        assert!(controls[1].value.abs() > controls[0].value.abs());
        assert!(controls[1].capturable);
    }

    #[test]
    fn close_simultaneous_axes_wait_until_one_clearly_dominates() {
        let tracker = AxisTracker::default();
        let rest = [16_000; 8];
        warm_up(&tracker, rest);

        // X arrive en premier dans DIJOYSTATE2 et dépasse déjà le seuil, mais
        // Y est presque aussi déplacé : choisir maintenant serait arbitraire.
        let mut ambiguous = rest;
        ambiguous[0] += AXIS_THRESHOLD + 2_000;
        ambiguous[1] += AXIS_THRESHOLD + 1_000;
        let controls = controls_from_state(&state_with_axes(ambiguous), &tracker);
        assert_eq!(controls.len(), 2);
        assert!(
            controls.iter().all(|control| !control.capturable),
            "un geste encore diagonal ne doit assigner aucun axe"
        );

        // Quand Y devient franchement dominant, X reste présent pour le retour
        // live mais seul Y devient assignable.
        ambiguous[1] += AXIS_CAPTURE_DOMINANCE_MARGIN + 4_000;
        let controls = controls_from_state(&state_with_axes(ambiguous), &tracker);
        assert_eq!(controls.len(), 2);
        assert_eq!(controls[0].control, "x");
        assert!(!controls[0].capturable);
        assert_eq!(controls[1].control, "y");
        assert!(controls[1].capturable);
    }

    #[test]
    fn slow_intentional_axis_survives_simultaneous_orthogonal_drift() {
        let tracker = AxisTracker::default();
        let rest = [16_000; 8];
        warm_up(&tracker, rest);

        // Y progresse lentement pendant environ deux secondes. X dérive aussi,
        // mais moins vite : la sélection repose sur les courses cumulées, pas
        // sur la vitesse instantanée du geste.
        let mut first_capture = None;
        let mut moved = rest;
        for step in 1..=130 {
            moved[0] = rest[0] + step * 40;
            moved[1] = rest[1] + step * 100;
            if first_capture.is_none() {
                first_capture = tracker.moved(moved);
            } else {
                tracker.moved(moved);
            }
        }

        assert_eq!(
            first_capture,
            Some(1),
            "la dérive X a masqué le mouvement Y progressif"
        );
    }

    #[test]
    fn axis_noise_below_live_deadzone_does_not_enter_frame() {
        let tracker = AxisTracker::default();
        let rest = [16_000; 8];
        warm_up(&tracker, rest);
        let mut jitter = rest;
        jitter[3] += LIVE_AXIS_THRESHOLD - 1;

        assert!(controls_from_state(&state_with_axes(jitter), &tracker).is_empty());
    }
}
