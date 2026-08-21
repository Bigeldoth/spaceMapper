//! Commandes Tauri communes à toutes les éditions de SpaceMapper.
//!
//! Tout ce qui vit ici est indépendant du périmètre d'édition
//! (`spacemapper_edit::scope`) : capture d'un appui, lecture des données de
//! jeu, inspection des profils exportés, préférences utilisateur. Une édition
//! (Lite, Premium…) les enregistre telles quelles dans son propre
//! `generate_handler!` — ce crate ne construit pas d'application, il n'en
//! fournit que la part générique.
//!
//! Le comportement propre à chaque édition (ce qui est modifiable, ce qui est
//! verrouillé) reste dans le crate applicatif de cette édition, jamais ici.

pub mod capture;
pub mod devices;
pub mod gamedata;
pub mod layouts;
pub mod settings;
