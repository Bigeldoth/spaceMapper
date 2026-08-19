//! Cœur de lecture de SpaceMapper.
//!
//! Ce crate est volontairement **en lecture seule** : il sait énumérer les
//! périphériques d'entrée et analyser un `actionmaps.xml`, mais il n'écrit
//! jamais sur le disque et ne touche jamais aux fichiers du jeu. Toute la
//! logique de mutation (réparation, correction du linter, sauvegarde,
//! injection) vit dans l'édition Premium.
//!
//! Cette séparation n'est pas cosmétique : elle garantit que l'édition Lite,
//! qui ne dépend que de ce crate, est incapable de modifier quoi que ce soit.

pub mod actionmaps;
pub mod channel;
pub mod cryxml;
pub mod defaults;
pub mod device;
pub mod error;
pub mod install;
pub mod locale;
pub mod localization;
pub mod p4k;

pub use error::{Error, Result};
