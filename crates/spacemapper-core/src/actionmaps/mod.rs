//! Lecture et modélisation de `actionmaps.xml`.

pub mod model;
pub mod parse;

pub use model::{
    split_named_guid, Action, ActionMap, ActionMaps, AxisOption, DeclaredDevice, DeviceKind,
    DeviceOptions, InputBinding, NamedDeviceOptions, Rebind,
};
pub use parse::{parse_file, parse_str};
