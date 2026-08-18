// Masque la console Windows en release, sans priver le debug de ses logs.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    spacemapper_lite_lib::run()
}
