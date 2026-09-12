//! Lecture de `Data.p4k`, l'archive principale de Star Citizen.
//!
//! **Strictement en lecture.** Modifier cette archive serait à la fois inutile
//! — `actionmaps.xml` est la couche de surcharge prévue par CIG — et
//! dangereux : Easy Anti-Cheat contrôle l'intégrité des fichiers du jeu, et le
//! launcher retéléchargerait le fichier au patch suivant. Aucune fonction de
//! ce module n'ouvre l'archive en écriture.
//!
//! Le format, vérifié sur une archive réelle de 150 Go :
//!
//! - ZIP64 aux signatures standard (`PK\x03\x04`, `PK\x01\x02`, `PK\x06\x06`).
//! - Méthode de compression **100**, qui est du Zstandard sans enveloppe :
//!   les trames portent bien la signature `28 b5 2f fd`.
//! - Un champ « extra » propriétaire (`0xa4c1`) que les lecteurs ZIP courants
//!   refusent — d'où ce lecteur, qui ignore les champs qu'il ne comprend pas.
//! - `defaultProfile.xml` n'est pas chiffré.
//!
//! La table centrale pèse plusieurs centaines de méga-octets pour plus d'un
//! million d'entrées. On la parcourt donc **en flux**, sans jamais la charger
//! entière : l'application vise moins de 80 Mo de mémoire.

use crate::{Error, Result};
use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

/// Chemin du profil de contrôles par défaut, tel qu'il apparaît dans l'archive.
///
/// Les séparateurs sont des antislashs : c'est ainsi que CIG les écrit.
pub const DEFAULT_PROFILE: &str = r"Data\Libs\Config\defaultProfile.xml";

/// Les archives peuvent mélanger les séparateurs et la casse des chemins.
pub fn path_eq(left: &str, right: &str) -> bool {
    fn normalized(byte: u8) -> u8 {
        if byte == b'/' {
            b'\\'
        } else {
            byte.to_ascii_lowercase()
        }
    }
    left.bytes()
        .map(normalized)
        .eq(right.bytes().map(normalized))
}

/// Méthode de compression propre à CIG, en réalité du Zstandard.
const METHOD_ZSTD: u16 = 100;
const METHOD_STORED: u16 = 0;

const CENTRAL_SIGNATURE: [u8; 4] = *b"PK\x01\x02";
const LOCAL_SIGNATURE: [u8; 4] = *b"PK\x03\x04";
const EOCD64_SIGNATURE: [u8; 4] = *b"PK\x06\x06";

/// En-tête central de taille fixe, hors nom et champs extra.
const CENTRAL_FIXED: usize = 46;
const LOCAL_FIXED: usize = 30;

/// Garde-fou sur la taille décompressée d'une entrée.
///
/// On ne lit que des fichiers de configuration ; refuser au-delà évite qu'une
/// archive inattendue ne fasse gonfler la mémoire sans limite.
const MAX_ENTRY_SIZE: u64 = 64 * 1024 * 1024;

/// Une entrée localisée dans l'archive.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Entry {
    pub name: String,
    pub method: u16,
    pub compressed_size: u64,
    pub uncompressed_size: u64,
    /// Position de l'en-tête local, d'où commencer la lecture.
    pub local_offset: u64,
    /// L'entrée est chiffrée : on ne sait pas la lire.
    pub encrypted: bool,
}

/// Faut-il poursuivre le parcours de la table centrale ?
///
/// Chercher une entrée précise s'arrête au premier succès ; recenser les
/// langues disponibles va jusqu'au bout.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Walk {
    Continue,
    Stop,
}

pub struct Archive {
    path: PathBuf,
}

impl Archive {
    /// Ouvre l'archive sans rien en lire.
    pub fn open(path: impl Into<PathBuf>) -> Result<Self> {
        let path = path.into();
        if !path.is_file() {
            return Err(Error::io(
                &path,
                std::io::Error::new(std::io::ErrorKind::NotFound, "archive introuvable"),
            ));
        }
        Ok(Archive { path })
    }

    /// Emplacement habituel de l'archive pour une racine de canal donnée.
    pub fn path_for(channel_root: &Path) -> PathBuf {
        channel_root.join("Data.p4k")
    }

    /// Cherche une entrée par son nom exact, en parcourant la table centrale.
    ///
    /// Renvoie `None` si elle est absente : c'est un cas normal après un patch
    /// qui déplacerait le fichier, pas une erreur.
    pub fn find(&self, name: &str) -> Result<Option<Entry>> {
        let mut found = None;
        self.walk(|entry_name, entry| {
            if path_eq(entry_name, name) {
                let mut entry = entry.clone();
                entry.name = entry_name.to_owned();
                found = Some(entry);
                Walk::Stop
            } else {
                Walk::Continue
            }
        })?;
        Ok(found)
    }

    /// Toutes les entrées dont le nom satisfait un prédicat.
    ///
    /// Un seul parcours suffit, là où appeler [`Self::find`] en boucle en
    /// relancerait un par nom cherché.
    pub fn scan(&self, keep: impl Fn(&str) -> bool) -> Result<Vec<Entry>> {
        let mut found = Vec::new();
        self.walk(|name, entry| {
            if keep(name) {
                let mut entry = entry.clone();
                entry.name = name.to_owned();
                found.push(entry);
            }
            Walk::Continue
        })?;
        Ok(found)
    }

    /// Parcourt la table centrale en flux, une entrée à la fois.
    fn walk(&self, mut visit: impl FnMut(&str, &Entry) -> Walk) -> Result<()> {
        let file = File::open(&self.path).map_err(|e| Error::io(&self.path, e))?;
        let size = file.metadata().map_err(|e| Error::io(&self.path, e))?.len();
        let mut reader = BufReader::with_capacity(1 << 20, file);

        let (cd_offset, cd_size) = self.central_directory(&mut reader, size)?;
        reader
            .seek(SeekFrom::Start(cd_offset))
            .map_err(|e| Error::io(&self.path, e))?;

        let mut consumed = 0u64;
        let mut header = [0u8; CENTRAL_FIXED];
        // La table compte plus d'un million d'entrées. Réutiliser ces deux
        // tampons évite trois allocations par entrée ignorée (nom compris).
        let mut name_bytes = Vec::new();
        let mut extra = Vec::new();

        while consumed + CENTRAL_FIXED as u64 <= cd_size {
            reader
                .read_exact(&mut header)
                .map_err(|e| Error::io(&self.path, e))?;
            if header[..4] != CENTRAL_SIGNATURE {
                break;
            }

            let flags = u16::from_le_bytes([header[8], header[9]]);
            let method = u16::from_le_bytes([header[10], header[11]]);
            let mut compressed = u32::from_le_bytes(header[20..24].try_into().unwrap()) as u64;
            let mut uncompressed = u32::from_le_bytes(header[24..28].try_into().unwrap()) as u64;
            let name_len = u16::from_le_bytes([header[28], header[29]]) as usize;
            let extra_len = u16::from_le_bytes([header[30], header[31]]) as usize;
            let comment_len = u16::from_le_bytes([header[32], header[33]]) as usize;
            let mut offset = u32::from_le_bytes(header[42..46].try_into().unwrap()) as u64;

            name_bytes.resize(name_len, 0);
            reader
                .read_exact(&mut name_bytes)
                .map_err(|e| Error::io(&self.path, e))?;
            extra.resize(extra_len, 0);
            reader
                .read_exact(&mut extra)
                .map_err(|e| Error::io(&self.path, e))?;
            if comment_len > 0 {
                std::io::copy(
                    &mut reader.by_ref().take(comment_len as u64),
                    &mut std::io::sink(),
                )
                .map_err(|e| Error::io(&self.path, e))?;
            }

            apply_zip64(&extra, &mut compressed, &mut uncompressed, &mut offset);
            consumed += (CENTRAL_FIXED + name_len + extra_len + comment_len) as u64;

            // Les noms sont en Windows-1252 dans le pire des cas ; une
            // conversion tolérante suffit pour comparer un chemin ASCII.
            let entry = Entry {
                name: String::new(),
                method,
                compressed_size: compressed,
                uncompressed_size: uncompressed,
                local_offset: offset,
                encrypted: flags & 1 != 0,
            };

            if visit(&String::from_utf8_lossy(&name_bytes), &entry) == Walk::Stop {
                return Ok(());
            }
        }

        Ok(())
    }

    /// Contenu décompressé d'une entrée.
    pub fn read(&self, entry: &Entry) -> Result<Vec<u8>> {
        if entry.encrypted {
            return Err(Error::Schema(format!(
                "l'entrée « {} » est chiffrée et ne peut pas être lue",
                entry.name
            )));
        }
        if entry.uncompressed_size > MAX_ENTRY_SIZE {
            return Err(Error::Schema(format!(
                "l'entrée « {} » dépasse la taille admise ({} octets)",
                entry.name, entry.uncompressed_size
            )));
        }

        let mut file = File::open(&self.path).map_err(|e| Error::io(&self.path, e))?;
        file.seek(SeekFrom::Start(entry.local_offset))
            .map_err(|e| Error::io(&self.path, e))?;

        let mut header = [0u8; LOCAL_FIXED];
        file.read_exact(&mut header)
            .map_err(|e| Error::io(&self.path, e))?;
        if header[..4] != LOCAL_SIGNATURE {
            return Err(Error::Schema(format!(
                "en-tête local absent pour « {} »",
                entry.name
            )));
        }

        // Les longueurs de l'en-tête local diffèrent de celles de la table
        // centrale : c'est celles-ci qui donnent le début des données.
        let name_len = u16::from_le_bytes([header[26], header[27]]) as u64;
        let extra_len = u16::from_le_bytes([header[28], header[29]]) as u64;
        file.seek(SeekFrom::Start(
            entry.local_offset + LOCAL_FIXED as u64 + name_len + extra_len,
        ))
        .map_err(|e| Error::io(&self.path, e))?;

        // Décompresser depuis le fichier : conserver aussi toute l'entrée
        // compressée doublait inutilement le pic de mémoire. La limite porte
        // sur les octets réellement produits, pas seulement sur l'en-tête.
        let mut compressed = file.take(entry.compressed_size);
        match entry.method {
            METHOD_STORED => {
                if entry.compressed_size != entry.uncompressed_size {
                    return Err(Error::Schema(
                        "tailles incohérentes pour une entrée non compressée".into(),
                    ));
                }
                read_bounded(&mut compressed, entry.uncompressed_size)
            }
            METHOD_ZSTD => {
                let mut decoder =
                    zstd::stream::read::Decoder::new(&mut compressed).map_err(|e| {
                        Error::Schema(format!("décompression Zstandard impossible: {e}"))
                    })?;
                // Le flux lui-même peut annoncer une fenêtre gigantesque,
                // même si la taille ZIP déclare un petit fichier.
                decoder
                    .window_log_max(26)
                    .map_err(|e| Error::Schema(format!("fenêtre Zstandard invalide: {e}")))?;
                read_bounded(decoder, entry.uncompressed_size)
            }
            other => Err(Error::Schema(format!(
                "méthode de compression {other} non prise en charge"
            ))),
        }
    }

    /// Position et taille de la table centrale, lues dans l'enregistrement
    /// de fin ZIP64.
    fn central_directory(&self, reader: &mut BufReader<File>, size: u64) -> Result<(u64, u64)> {
        // L'enregistrement de fin se trouve dans le dernier méga-octet.
        let window = size.min(1 << 20);
        reader
            .seek(SeekFrom::Start(size - window))
            .map_err(|e| Error::io(&self.path, e))?;
        let mut tail = vec![0u8; window as usize];
        reader
            .read_exact(&mut tail)
            .map_err(|e| Error::io(&self.path, e))?;

        let found = tail
            .windows(4)
            .rposition(|w| w == EOCD64_SIGNATURE)
            .ok_or_else(|| {
                Error::Schema("fin d'archive ZIP64 introuvable — archive tronquée ?".into())
            })?;

        let base = found;
        if base + 56 > tail.len() {
            return Err(Error::Schema("fin d'archive ZIP64 incomplète".into()));
        }
        let cd_size = u64::from_le_bytes(tail[base + 40..base + 48].try_into().unwrap());
        let cd_offset = u64::from_le_bytes(tail[base + 48..base + 56].try_into().unwrap());
        Ok((cd_offset, cd_size))
    }
}

fn read_bounded(mut reader: impl Read, expected_size: u64) -> Result<Vec<u8>> {
    // Lire un octet de plus permet de rejeter un flux mensonger sans jamais
    // décompresser le reste d'une éventuelle bombe de compression.
    let mut data = Vec::with_capacity(expected_size as usize);
    reader
        .by_ref()
        .take(expected_size)
        .read_to_end(&mut data)
        .map_err(|e| Error::Schema(format!("lecture de l'entrée impossible: {e}")))?;
    if data.len() as u64 != expected_size {
        return Err(Error::Schema(format!(
            "taille décompressée incohérente : {} octets au lieu de {expected_size}",
            data.len()
        )));
    }
    // L'octet sentinelle reste sur la pile : le pousser dans un Vec plein
    // pourrait doubler sa capacité juste avant de rejeter le fichier.
    let mut extra = [0u8; 1];
    if reader
        .read(&mut extra)
        .map_err(|e| Error::Schema(format!("lecture de l'entrée impossible: {e}")))?
        != 0
    {
        return Err(Error::Schema(
            "l'entrée dépasse la taille décompressée annoncée".into(),
        ));
    }
    Ok(data)
}

/// Remplace les champs saturés à `0xFFFFFFFF` par leurs valeurs 64 bits.
///
/// Les autres champs extra — dont celui, propriétaire, que CIG ajoute — sont
/// franchis sans être interprétés. C'est ce qui permet de lire une archive que
/// les bibliothèques ZIP courantes refusent.
fn apply_zip64(extra: &[u8], compressed: &mut u64, uncompressed: &mut u64, offset: &mut u64) {
    const ZIP64_TAG: u16 = 0x0001;
    let mut pos = 0usize;

    while pos + 4 <= extra.len() {
        let tag = u16::from_le_bytes([extra[pos], extra[pos + 1]]);
        let len = u16::from_le_bytes([extra[pos + 2], extra[pos + 3]]) as usize;
        let body_start = pos + 4;
        let body_end = body_start.saturating_add(len).min(extra.len());
        pos = body_start + len;

        if tag != ZIP64_TAG {
            continue;
        }

        // Seuls les champs saturés sont présents, dans cet ordre.
        let body = &extra[body_start..body_end];
        let mut cursor = 0usize;
        for field in [&mut *uncompressed, &mut *compressed, &mut *offset] {
            if *field != u32::MAX as u64 {
                continue;
            }
            if cursor + 8 > body.len() {
                break;
            }
            *field = u64::from_le_bytes(body[cursor..cursor + 8].try_into().unwrap());
            cursor += 8;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    struct TestArchive(PathBuf);

    impl TestArchive {
        fn entry(data: &[u8], method: u16, uncompressed_size: u64) -> (Self, Entry) {
            static NEXT: AtomicUsize = AtomicUsize::new(0);
            let path = std::env::temp_dir().join(format!(
                "spacemapper-p4k-{}-{}.p4k",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            let mut file = vec![0u8; LOCAL_FIXED];
            file[..4].copy_from_slice(&LOCAL_SIGNATURE);
            file.extend_from_slice(data);
            std::fs::write(&path, file).unwrap();
            (
                Self(path),
                Entry {
                    name: "test".to_string(),
                    method,
                    compressed_size: data.len() as u64,
                    uncompressed_size,
                    local_offset: 0,
                    encrypted: false,
                },
            )
        }
    }

    impl Drop for TestArchive {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.0);
        }
    }

    #[test]
    fn reads_stored_and_zstandard_entries_from_the_file() {
        let content = b"<profile><actionmap name=\"player\"/></profile>";
        for method in [METHOD_STORED, METHOD_ZSTD] {
            let data = if method == METHOD_ZSTD {
                zstd::stream::encode_all(&content[..], 1).unwrap()
            } else {
                content.to_vec()
            };
            let (fixture, entry) = TestArchive::entry(&data, method, content.len() as u64);
            assert_eq!(
                Archive::open(&fixture.0).unwrap().read(&entry).unwrap(),
                content
            );
        }
    }

    #[test]
    fn compressed_content_cannot_exceed_its_declared_size() {
        let content = vec![b'a'; 100_000];
        let compressed = zstd::stream::encode_all(&content[..], 1).unwrap();
        let (fixture, entry) = TestArchive::entry(&compressed, METHOD_ZSTD, 16);
        assert!(Archive::open(&fixture.0).unwrap().read(&entry).is_err());
    }

    #[test]
    fn truncated_compressed_and_stored_entries_are_rejected() {
        let content = b"configuration";
        let mut compressed = zstd::stream::encode_all(&content[..], 1).unwrap();
        compressed.pop();
        let (fixture, entry) = TestArchive::entry(&compressed, METHOD_ZSTD, content.len() as u64);
        assert!(Archive::open(&fixture.0).unwrap().read(&entry).is_err());
        let (fixture, mut entry) =
            TestArchive::entry(content, METHOD_STORED, content.len() as u64 + 1);
        entry.compressed_size += 1;
        assert!(Archive::open(&fixture.0).unwrap().read(&entry).is_err());
    }

    #[test]
    fn an_oversized_stream_is_only_read_up_to_the_limit_plus_one_byte() {
        let content = [b'a'; 1024];
        let mut remaining = &content[..];
        assert!(read_bounded(&mut remaining, 8).is_err());
        assert_eq!(remaining.len(), content.len() - 9);
    }

    #[test]
    fn zip64_extra_replaces_only_saturated_fields() {
        // Taille brute et décalage saturés, taille compressée non : seuls les
        // deux premiers doivent être remplacés, et dans le bon ordre.
        let mut extra = vec![0x01, 0x00, 16, 0x00];
        extra.extend_from_slice(&183_915u64.to_le_bytes());
        extra.extend_from_slice(&50_182_033_408u64.to_le_bytes());

        let mut compressed = 37_950u64;
        let mut uncompressed = u32::MAX as u64;
        let mut offset = u32::MAX as u64;

        apply_zip64(&extra, &mut compressed, &mut uncompressed, &mut offset);

        assert_eq!(uncompressed, 183_915);
        assert_eq!(offset, 50_182_033_408);
        assert_eq!(compressed, 37_950, "champ non saturé modifié à tort");
    }

    #[test]
    fn foreign_extra_fields_are_skipped() {
        // Le champ propriétaire 0xa4c1 de CIG est précisément ce qui fait
        // échouer les lecteurs ZIP courants : il doit être franchi sans être
        // interprété, sans empêcher la lecture du bloc ZIP64 qui le suit.
        let mut extra = vec![0xC1, 0xA4, 8, 0x00];
        extra.extend_from_slice(&[0xDE; 8]);
        extra.extend_from_slice(&[0x01, 0x00, 8, 0x00]);
        extra.extend_from_slice(&4_242u64.to_le_bytes());

        let mut compressed = 1u64;
        let mut uncompressed = u32::MAX as u64;
        let mut offset = 2u64;

        apply_zip64(&extra, &mut compressed, &mut uncompressed, &mut offset);
        assert_eq!(uncompressed, 4_242);
    }

    #[test]
    fn truncated_extra_field_does_not_panic() {
        // Une longueur annoncée plus grande que le contenu ne doit pas faire
        // sortir des bornes : l'archive vient de l'extérieur.
        let extra = vec![0x01, 0x00, 0xFF, 0xFF, 0x00, 0x00];
        let mut compressed = u32::MAX as u64;
        let mut uncompressed = u32::MAX as u64;
        let mut offset = 0u64;
        apply_zip64(&extra, &mut compressed, &mut uncompressed, &mut offset);
    }

    #[test]
    fn opening_a_missing_archive_is_an_error() {
        assert!(Archive::open("Z:/aucune/archive/Data.p4k").is_err());
    }
}
