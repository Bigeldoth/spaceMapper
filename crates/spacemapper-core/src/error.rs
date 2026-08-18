use std::path::PathBuf;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("impossible de lire {path}: {source}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },

    #[error("XML invalide: {0}")]
    Xml(#[from] roxmltree::Error),

    /// Le fichier est du XML valide mais ne ressemble pas à un `actionmaps.xml`.
    #[error("structure actionmaps inattendue: {0}")]
    Schema(String),

    #[error("énumération des périphériques impossible: {0}")]
    DeviceEnumeration(String),
}

impl Error {
    pub(crate) fn io(path: impl Into<PathBuf>, source: std::io::Error) -> Self {
        Error::Io {
            path: path.into(),
            source,
        }
    }
}
