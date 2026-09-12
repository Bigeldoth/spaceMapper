//! Données de jeu partagées : un profil et au plus deux traductions en mémoire.
//!
//! La table centrale de Data.p4k est parcourue une seule fois par installation.
//! Seules les entrées du profil et des catalogues sont conservées, jamais
//! l'index complet de l'archive. Un changement de canal ou de fichier remplace
//! le cache ; l'anglais et la langue courante peuvent cohabiter sans relecture.

use spacemapper_core::localization::Catalog;
use spacemapper_core::{cryxml, defaults::DefaultProfile, localization, p4k};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

#[derive(Default)]
pub struct GameData {
    cache: Mutex<Cache>,
}

#[derive(Debug, PartialEq, Eq)]
struct ArchiveKey {
    path: PathBuf,
    metadata: Option<(u64, Option<SystemTime>)>,
}

impl ArchiveKey {
    fn for_actionmaps(actionmaps: &Path) -> Result<Self, String> {
        // <canal>/user/client/0/Profiles/default/actionmaps.xml
        let channel_root = actionmaps
            .ancestors()
            .nth(6)
            .ok_or_else(|| "arborescence de jeu inattendue".to_string())?;
        let path = p4k::Archive::path_for(channel_root);
        let metadata = std::fs::metadata(&path)
            .ok()
            .map(|meta| (meta.len(), meta.modified().ok()));
        Ok(Self { path, metadata })
    }
}

#[derive(Default)]
struct Cache {
    key: Option<ArchiveKey>,
    entries: Option<Result<Vec<p4k::Entry>, String>>,
    profile: Option<Result<Arc<DefaultProfile>, String>>,
    catalogs: Vec<(String, Catalog)>,
}

impl GameData {
    /// Le profil est immuable : chaque appel partage la même allocation.
    pub fn profile_for(&self, actionmaps: &Path) -> Result<Arc<DefaultProfile>, String> {
        self.with_cache(actionmaps, Cache::profile)
    }

    /// Un catalogue absent laisse l'interface employer ses propres libellés.
    pub fn catalog_for(&self, actionmaps: &Path, language: &str) -> Catalog {
        self.with_cache(actionmaps, |cache| cache.catalog(language))
            .unwrap_or_default()
    }

    pub fn languages_for(&self, actionmaps: &Path) -> Result<Vec<String>, String> {
        self.with_cache(actionmaps, |cache| {
            let mut languages: Vec<_> = cache
                .entries()?
                .iter()
                .filter(|entry| localization::is_catalog_path(&entry.name))
                .filter_map(|entry| localization::language_of(&entry.name).map(str::to_string))
                .collect();
            languages.sort();
            languages.dedup();
            Ok(languages)
        })
    }

    fn with_cache<T>(
        &self,
        actionmaps: &Path,
        load: impl FnOnce(&mut Cache) -> Result<T, String>,
    ) -> Result<T, String> {
        let key = ArchiveKey::for_actionmaps(actionmaps)?;
        let mut cache = self
            .cache
            .lock()
            .map_err(|_| "état des données de jeu corrompu".to_string())?;
        if cache.key.as_ref() != Some(&key) {
            *cache = Cache {
                key: Some(key),
                ..Cache::default()
            };
        }
        load(&mut cache)
    }
}

impl Cache {
    fn path(&self) -> &Path {
        &self.key.as_ref().expect("cache associé à une archive").path
    }

    fn entries(&mut self) -> Result<&[p4k::Entry], String> {
        if self.entries.is_none() {
            self.entries = Some(
                p4k::Archive::open(self.path())
                    .and_then(|archive| {
                        archive.scan(|name| {
                            p4k::path_eq(name, p4k::DEFAULT_PROFILE)
                                || localization::is_catalog_path(name)
                        })
                    })
                    .map_err(|error| error.to_string()),
            );
        }
        self.entries
            .as_ref()
            .expect("index chargé")
            .as_ref()
            .map(Vec::as_slice)
            .map_err(Clone::clone)
    }

    fn profile(&mut self) -> Result<Arc<DefaultProfile>, String> {
        if self.profile.is_none() {
            let loaded = (|| {
                let entry = self
                    .entries()?
                    .iter()
                    .find(|entry| p4k::path_eq(&entry.name, p4k::DEFAULT_PROFILE))
                    .cloned()
                    .ok_or_else(|| {
                        format!(
                            "« {} » absent de l'archive — un patch l'a peut-être déplacé",
                            p4k::DEFAULT_PROFILE
                        )
                    })?;
                let archive = p4k::Archive::open(self.path()).map_err(|error| error.to_string())?;
                let raw = archive.read(&entry).map_err(|error| error.to_string())?;
                let xml = if cryxml::is_cryxml(&raw) {
                    let xml = cryxml::to_xml(&raw).map_err(|error| error.to_string())?;
                    drop(raw);
                    xml
                } else {
                    String::from_utf8(raw).map_err(|error| error.to_string())?
                };
                spacemapper_core::defaults::parse_str(&xml)
                    .map(Arc::new)
                    .map_err(|error| error.to_string())
            })();
            self.profile = Some(loaded);
        }
        self.profile.as_ref().expect("profil chargé").clone()
    }

    fn catalog(&mut self, language: &str) -> Result<Catalog, String> {
        if let Some((_, catalog)) = self.catalogs.iter().find(|(cached, _)| cached == language) {
            return Ok(catalog.clone());
        }

        let loaded = (|| {
            let profile = self.profile()?;
            let wanted = referenced_catalog_keys(&profile);
            let name = localization::catalog_path(language);
            let entry = self
                .entries()?
                .iter()
                .find(|entry| p4k::path_eq(&entry.name, &name))
                .cloned()
                .ok_or_else(|| format!("langue « {language} » absente de l'installation"))?;
            let archive = p4k::Archive::open(self.path()).map_err(|error| error.to_string())?;
            let raw = archive.read(&entry).map_err(|error| error.to_string())?;
            Ok::<_, String>(Catalog::parse_referenced(
                &String::from_utf8_lossy(&raw),
                &|key| wanted.contains(key),
            ))
        })()
        .unwrap_or_default();

        // Conserver le repli anglais tout en remplaçant la langue précédente.
        // Les anciens canaux sont déjà évincés par with_cache.
        if self.catalogs.len() == 2 {
            let evicted = self
                .catalogs
                .iter()
                .position(|(cached, _)| cached != localization::ENGLISH)
                .unwrap_or(0);
            self.catalogs.remove(evicted);
        }
        self.catalogs.push((language.to_string(), loaded.clone()));
        Ok(loaded)
    }
}

fn referenced_catalog_keys(profile: &DefaultProfile) -> HashSet<&str> {
    profile
        .action_maps
        .iter()
        .flat_map(|map| {
            map.ui_label.iter().chain(
                map.actions
                    .iter()
                    .flat_map(|action| action.ui_label.iter().chain(action.ui_description.iter())),
            )
        })
        .map(|key| key.strip_prefix('@').unwrap_or(key))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    /// Vérification en lecture seule d'une installation réelle. Exemple :
    /// SPACEMAPPER_ACTIONMAPS=<chemin>/actionmaps.xml cargo test
    /// -p spacemapper-app-support real_archive_cache -- --ignored --nocapture
    #[test]
    #[ignore = "nécessite SPACEMAPPER_ACTIONMAPS et une installation de Star Citizen"]
    fn real_archive_cache() {
        let path = PathBuf::from(
            std::env::var_os("SPACEMAPPER_ACTIONMAPS").expect("définir SPACEMAPPER_ACTIONMAPS"),
        );
        let state = GameData::default();
        let start = std::time::Instant::now();
        let profile = state.profile_for(&path).unwrap();
        let languages = state.languages_for(&path).unwrap();
        let english = state.catalog_for(&path, localization::ENGLISH);
        let french = state.catalog_for(&path, localization::FRENCH);
        assert!(!profile.action_maps.is_empty());
        if languages
            .iter()
            .any(|language| language == localization::ENGLISH)
        {
            assert!(!english.is_empty());
        }
        println!("chargement initial {:?}; {} catégories, {} actions, {} langues; EN {} clés, FR {} clés", start.elapsed(), profile.action_maps.len(), profile.action_maps.iter().map(|map| map.actions.len()).sum::<usize>(), languages.len(), english.len(), french.len());
        let start = std::time::Instant::now();
        let rounds = std::env::var("SPACEMAPPER_CACHE_ROUNDS")
            .ok()
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or(100);
        for _ in 0..rounds {
            assert!(Arc::ptr_eq(&profile, &state.profile_for(&path).unwrap()));
            assert_eq!(
                english.len(),
                state.catalog_for(&path, localization::ENGLISH).len()
            );
            assert_eq!(
                french.len(),
                state.catalog_for(&path, localization::FRENCH).len()
            );
        }
        println!(
            "{rounds} relectures profil + EN + FR : {:?}",
            start.elapsed()
        );
        let cache = state.cache.lock().unwrap();
        assert_eq!(cache.catalogs.len(), 2);
        println!(
            "index conservé : {} entrées",
            cache.entries.as_ref().unwrap().as_ref().unwrap().len()
        );
    }

    struct Installation(PathBuf);

    impl Installation {
        fn new() -> Self {
            static NEXT: AtomicUsize = AtomicUsize::new(0);
            let directory = std::env::temp_dir().join(format!(
                "spacemapper-cache-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            std::fs::create_dir(&directory).unwrap();
            Self(directory)
        }

        fn actionmaps(&self) -> PathBuf {
            self.0.join("user/client/0/Profiles/default/actionmaps.xml")
        }

        fn write(&self, files: &[(&str, &str)]) {
            let mut bytes = Vec::new();
            let mut central = Vec::new();
            for (name, content) in files {
                let mut local = [0u8; 30];
                local[..4].copy_from_slice(b"PK\x03\x04");
                local[26..28].copy_from_slice(&(name.len() as u16).to_le_bytes());
                let mut entry = [0u8; 46];
                entry[..4].copy_from_slice(b"PK\x01\x02");
                entry[20..24].copy_from_slice(&(content.len() as u32).to_le_bytes());
                entry[24..28].copy_from_slice(&(content.len() as u32).to_le_bytes());
                entry[28..30].copy_from_slice(&(name.len() as u16).to_le_bytes());
                entry[42..46].copy_from_slice(&(bytes.len() as u32).to_le_bytes());
                bytes.extend_from_slice(&local);
                bytes.extend_from_slice(name.as_bytes());
                bytes.extend_from_slice(content.as_bytes());
                central.extend_from_slice(&entry);
                central.extend_from_slice(name.as_bytes());
            }
            let mut end = [0u8; 56];
            end[..4].copy_from_slice(b"PK\x06\x06");
            end[40..48].copy_from_slice(&(central.len() as u64).to_le_bytes());
            end[48..56].copy_from_slice(&(bytes.len() as u64).to_le_bytes());
            bytes.extend_from_slice(&central);
            bytes.extend_from_slice(&end);
            std::fs::write(self.0.join("Data.p4k"), bytes).unwrap();
        }
    }

    impl Drop for Installation {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(self.0.join("Data.p4k"));
            let _ = std::fs::remove_dir(&self.0);
        }
    }

    #[test]
    fn archive_index_is_filtered_and_a_patch_reloads_the_profile() {
        let installation = Installation::new();
        installation.write(&[
            ("Data/Textures/irrelevant.dds", "not retained in the index"),
            ("Data/Libs/Config/defaultProfile.xml", r#"<profile version="1"><actionmap name="player"><action name="helmet" UILabel="@interaction_helmet"/></actionmap></profile>"#),
            ("Data/Localization/english/global.ini", "interaction_helmet,P=Helmet\nmission=Discarded"),
            ("Data/Localization/french_(france)/global.ini", "interaction_helmet=Casque\nmission=Ignorée"),
        ]);
        let state = GameData::default();
        let actionmaps = installation.actionmaps();
        let profile = state.profile_for(&actionmaps).unwrap();
        assert!(Arc::ptr_eq(
            &profile,
            &state.profile_for(&actionmaps).unwrap()
        ));
        assert_eq!(
            state
                .catalog_for(&actionmaps, "english")
                .get("interaction_helmet"),
            Some("Helmet")
        );
        let french = state.catalog_for(&actionmaps, "french_(france)");
        assert_eq!(french.get("interaction_helmet"), Some("Casque"));
        assert_eq!(french.len(), 1);
        assert_eq!(
            state.languages_for(&actionmaps).unwrap(),
            ["english", "french_(france)"]
        );
        assert_eq!(
            state
                .cache
                .lock()
                .unwrap()
                .entries
                .as_ref()
                .unwrap()
                .as_ref()
                .unwrap()
                .len(),
            3
        );

        installation.write(&[(p4k::DEFAULT_PROFILE, "<profile version=\"patched\"/>")]);
        assert_eq!(
            state.profile_for(&actionmaps).unwrap().version.as_deref(),
            Some("patched")
        );
        assert!(state.languages_for(&actionmaps).unwrap().is_empty());
        assert!(state.catalog_for(&actionmaps, "french_(france)").is_empty());
    }

    #[test]
    fn keeps_exact_referenced_keys_even_without_ui_prefix() {
        let profile = spacemapper_core::defaults::parse_str(
            r#"<profile><actionmap name="player" UILabel="@ui_player"><action name="helmet" UILabel="@interaction_toggleEquipHelmet" UIDescription="@ui_helmet_desc"/></actionmap></profile>"#,
        ).unwrap();
        let keys = referenced_catalog_keys(&profile);
        assert!(keys.contains("ui_player"));
        assert!(keys.contains("interaction_toggleEquipHelmet"));
        assert!(keys.contains("ui_helmet_desc"));
    }

    #[test]
    fn repeated_profile_requests_share_the_same_allocation() {
        let profile = Arc::new(spacemapper_core::defaults::parse_str("<profile/>").unwrap());
        let mut cache = Cache {
            profile: Some(Ok(profile.clone())),
            ..Cache::default()
        };
        assert!(Arc::ptr_eq(&profile, &cache.profile().unwrap()));
    }

    #[test]
    fn catalogs_are_bounded_and_keep_the_english_fallback() {
        let mut cache = Cache {
            profile: Some(Err("archive indisponible".to_string())),
            ..Cache::default()
        };
        for language in [
            "english",
            "french_(france)",
            "german_(germany)",
            "spanish_(spain)",
        ] {
            cache.catalog(language).unwrap();
        }
        assert_eq!(cache.catalogs.len(), 2);
        assert_eq!(cache.catalogs[0].0, "english");
        assert_eq!(cache.catalogs[1].0, "spanish_(spain)");
    }

    #[test]
    fn switching_installations_releases_the_previous_profile() {
        let state = GameData::default();
        let live = Path::new("C:/StarCitizen/LIVE/user/client/0/Profiles/default/actionmaps.xml");
        let ptu = Path::new("C:/StarCitizen/PTU/user/client/0/Profiles/default/actionmaps.xml");
        let profile = Arc::new(spacemapper_core::defaults::parse_str("<profile/>").unwrap());
        let retained = Arc::downgrade(&profile);
        state
            .with_cache(live, |cache| {
                cache.profile = Some(Ok(profile));
                Ok(())
            })
            .unwrap();
        assert!(retained.upgrade().is_some());
        state.with_cache(ptu, |_| Ok(())).unwrap();
        assert!(retained.upgrade().is_none());
    }
}
