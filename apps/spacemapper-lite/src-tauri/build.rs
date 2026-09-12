fn main() {
    if !tauri_build::is_dev() {
        println!("cargo:rerun-if-changed=../dist");
    }
    tauri_build::build()
}
