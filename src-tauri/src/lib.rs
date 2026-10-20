//! ClipVault desktop backend.
//!
//! Clipboard capture, storage, tray and system integration will live here;
//! the React UI in `../src` talks to it through Tauri commands.

/// Version reported to the UI (matches `Cargo.toml`).
#[tauri::command]
fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![app_version])
        .run(tauri::generate_context!())
        .expect("error while running ClipVault");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_version_matches_cargo() {
        assert_eq!(app_version(), env!("CARGO_PKG_VERSION"));
    }
}
