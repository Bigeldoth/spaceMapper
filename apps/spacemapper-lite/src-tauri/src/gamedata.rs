//! Accès aux données du jeu : profil par défaut et traductions.
//!
//! `actionmaps.xml` ne contient que les **surcharges**. Tout ce qu'un joueur
//! n'a jamais modifié reste défini dans `Data.p4k`, et n'apparaît donc nulle
//! part dans son fichier — d'où l'impression déroutante qu'une configuration
//! qui fonctionne est en partie absente.
//!
//! L'archive fournit aussi le vocabulaire du jeu : plus d'un millier d'actions
//! nommées et traduites, contre quelques centaines dans un catalogue tenu à la
//! main.
//!
//! Tout est chargé à la demande puis conservé : parcourir la table centrale
//! d'une archive de 150 Go à chaque affichage serait absurde.

use spacemapper_core::localization::Catalog;
use spacemapper_core::{cryxml, defaults::DefaultProfile, localization, p4k};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Default)]
pub struct GameData {
    profile: Mutex<Option<Result<DefaultProfile, String>>>,
    /// Catalogue courant, avec la langue qui l'a produit : changer de langue
    /// doit le remplacer, pas s'y ajouter.
    catalog: Mutex<Option<(String, Catalog)>>,
    languages: Mutex<Option<Vec<String>>>,
}

impl GameData {
    /// Profil par défaut correspondant au `actionmaps.xml` donné.
    ///
    /// Un échec est mémorisé au même titre qu'un succès : réessayer à chaque
    /// affichage relancerait un parcours coûteux qui échouera de nouveau, et
    /// figerait l'interface.
    pub fn profile_for(&self, actionmaps: &Path) -> Result<DefaultProfile, String> {
        let mut guard = self.profile.lock().map_err(|_| poisoned())?;
        if guard.is_none() {
            *guard = Some(load_profile(actionmaps));
        }
        guard.as_ref().expect("chargé juste au-dessus").clone()
    }

    /// Catalogue de traductions pour la langue demandée.
    ///
    /// Une langue absente de l'installation n'est pas une erreur : on renvoie
    /// un catalogue vide, et l'appelant retombe sur ses propres libellés.
    pub fn catalog_for(&self, actionmaps: &Path, language: &str) -> Catalog {
        let mut guard = match self.catalog.lock() {
            Ok(g) => g,
            Err(_) => return Catalog::default(),
        };

        if guard.as_ref().is_none_or(|(cached, _)| cached != language) {
            let loaded = load_catalog(actionmaps, language).unwrap_or_default();
            *guard = Some((language.to_string(), loaded));
        }
        guard.as_ref().expect("chargé juste au-dessus").1.clone()
    }

    /// Langues réellement présentes dans l'installation du joueur.
    pub fn languages_for(&self, actionmaps: &Path) -> Result<Vec<String>, String> {
        let mut guard = self.languages.lock().map_err(|_| poisoned())?;
        if guard.is_none() {
            let archive = open_archive(actionmaps)?;
            *guard = Some(localization::available(&archive).map_err(|e| e.to_string())?);
        }
        Ok(guard.clone().expect("chargé juste au-dessus"))
    }
}

fn poisoned() -> String {
    "état des données de jeu corrompu".to_string()
}

/// Ouvre l'archive correspondant à un `actionmaps.xml`.
fn open_archive(actionmaps: &Path) -> Result<p4k::Archive, String> {
    // `actionmaps.xml` vit sous <canal>/user/client/0/Profiles/default/ ;
    // l'archive est à la racine du canal, six niveaux plus haut.
    let channel_root = actionmaps
        .ancestors()
        .nth(6)
        .ok_or_else(|| "arborescence de jeu inattendue".to_string())?;
    p4k::Archive::open(archive_path(channel_root)).map_err(|e| e.to_string())
}

fn archive_path(channel_root: &Path) -> PathBuf {
    p4k::Archive::path_for(channel_root)
}

fn load_profile(actionmaps: &Path) -> Result<DefaultProfile, String> {
    let archive = open_archive(actionmaps)?;
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

fn load_catalog(actionmaps: &Path, language: &str) -> Result<Catalog, String> {
    let archive = open_archive(actionmaps)?;
    let entry = archive
        .find(&localization::catalog_path(language))
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("langue « {language} » absente de l'installation"))?;

    let raw = archive.read(&entry).map_err(|e| e.to_string())?;
    // Seules les clés d'interface nous concernent : le catalogue complet
    // dépasse dix méga-octets et décrit surtout des missions et des objets.
    Ok(Catalog::parse(&String::from_utf8_lossy(&raw), &|key| {
        key.starts_with("ui_")
    }))
}
