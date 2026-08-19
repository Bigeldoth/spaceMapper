//! Accès aux données du jeu : le profil de contrôles par défaut.
//!
//! `actionmaps.xml` ne contient que les **surcharges**. Tout ce qu'un joueur
//! n'a jamais modifié reste défini dans `Data.p4k`, et n'apparaît donc nulle
//! part dans son fichier — d'où l'impression déroutante qu'une configuration
//! qui fonctionne est en partie absente.
//!
//! Le profil est chargé une seule fois et conservé : parcourir la table
//! centrale d'une archive de 150 Go coûte trop cher pour être refait à chaque
//! affichage, même si l'opération ne prend qu'une fraction de seconde.

use spacemapper_core::{cryxml, defaults::DefaultProfile, p4k};
use std::path::Path;
use std::sync::Mutex;

/// Profil par défaut, chargé à la demande puis conservé.
#[derive(Default)]
pub struct GameData {
    profile: Mutex<Option<Result<DefaultProfile, String>>>,
}

impl GameData {
    /// Profil par défaut correspondant au `actionmaps.xml` donné.
    ///
    /// Un échec est mémorisé au même titre qu'un succès : réessayer à chaque
    /// affichage relancerait un parcours coûteux qui échouera de nouveau, et
    /// figerait l'interface.
    pub fn profile_for(&self, actionmaps: &Path) -> Result<DefaultProfile, String> {
        let mut guard = self
            .profile
            .lock()
            .map_err(|_| "état des données de jeu corrompu".to_string())?;

        if guard.is_none() {
            *guard = Some(load(actionmaps));
        }
        guard.as_ref().expect("chargé juste au-dessus").clone()
    }
}

fn load(actionmaps: &Path) -> Result<DefaultProfile, String> {
    // `actionmaps.xml` vit sous <canal>/user/client/0/Profiles/default/ ;
    // l'archive est à la racine du canal, six niveaux plus haut.
    let channel_root = actionmaps
        .ancestors()
        .nth(6)
        .ok_or_else(|| "arborescence de jeu inattendue".to_string())?;

    let archive_path = p4k::Archive::path_for(channel_root);
    let archive = p4k::Archive::open(&archive_path).map_err(|e| e.to_string())?;

    let entry = archive
        .find(p4k::DEFAULT_PROFILE)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| {
            format!(
                "« {} » absent de l'archive — un patch l'a peut-être déplacé",
                p4k::DEFAULT_PROFILE
            )
        })?;

    let raw = archive.read(&entry).map_err(|e| e.to_string())?;
    let xml = cryxml::to_xml(&raw).map_err(|e| e.to_string())?;
    spacemapper_core::defaults::parse_str(&xml).map_err(|e| e.to_string())
}
