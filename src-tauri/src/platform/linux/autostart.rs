//! Start on login through the XDG autostart spec: a `.desktop` file in
//! `~/.config/autostart` that launches ClipVault hidden in the tray.

use std::env;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

/// Command-line flag that starts ClipVault without showing its window.
pub const HIDDEN_ARG: &str = "--hidden";

const FILE_NAME: &str = "clipvault.desktop";

/// The executable to launch at login. Inside an AppImage the running binary
/// lives in a temporary mount, so the AppImage file itself is used instead.
pub fn exec_path() -> io::Result<PathBuf> {
    match env::var_os("APPIMAGE") {
        Some(appimage) if !appimage.is_empty() => Ok(PathBuf::from(appimage)),
        _ => env::current_exe(),
    }
}

/// Creates or removes the autostart entry in the user's config directory.
pub fn set(enabled: bool) -> io::Result<()> {
    let config_home = env::var_os("XDG_CONFIG_HOME")
        .filter(|v| !v.is_empty())
        .map(PathBuf::from)
        .or_else(|| env::var_os("HOME").map(|home| PathBuf::from(home).join(".config")))
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "no home directory"))?;
    set_enabled(&config_home, enabled, &exec_path()?)
}

/// Creates or removes the autostart entry under `config_home`
/// (normally `~/.config`).
pub fn set_enabled(config_home: &Path, enabled: bool, exec: &Path) -> io::Result<()> {
    let path = config_home.join("autostart").join(FILE_NAME);
    if enabled {
        fs::create_dir_all(path.parent().unwrap_or(config_home))?;
        fs::write(&path, desktop_entry(exec))
    } else {
        match fs::remove_file(&path) {
            Err(err) if err.kind() != io::ErrorKind::NotFound => Err(err),
            _ => Ok(()),
        }
    }
}

fn desktop_entry(exec: &Path) -> String {
    format!(
        "[Desktop Entry]\n\
         Type=Application\n\
         Name=ClipVault\n\
         Comment=Clipboard manager\n\
         Exec={} {HIDDEN_ARG}\n\
         Icon=clipvault\n\
         Terminal=false\n\
         X-GNOME-Autostart-enabled=true\n",
        quote_exec(&exec.to_string_lossy())
    )
}

/// Quotes a path for a desktop entry `Exec` key when it needs it.
fn quote_exec(path: &str) -> String {
    const RESERVED: &[char] = &[
        ' ', '\t', '"', '\'', '\\', '>', '<', '~', '|', '&', ';', '$', '*', '?', '#', '(', ')', '`',
    ];
    if !path.contains(RESERVED) {
        return path.to_string();
    }
    let mut quoted = String::from("\"");
    for c in path.chars() {
        if matches!(c, '"' | '`' | '$' | '\\') {
            quoted.push('\\');
        }
        quoted.push(c);
    }
    quoted.push('"');
    quoted
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_and_removes_entry() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("autostart").join(FILE_NAME);

        set_enabled(dir.path(), true, Path::new("/usr/bin/clipvault")).unwrap();
        let entry = fs::read_to_string(&file).unwrap();
        assert!(
            entry.contains("Exec=/usr/bin/clipvault --hidden\n"),
            "{entry}"
        );

        set_enabled(dir.path(), false, Path::new("/usr/bin/clipvault")).unwrap();
        assert!(!file.exists());
        // Disabling twice is fine.
        set_enabled(dir.path(), false, Path::new("/usr/bin/clipvault")).unwrap();
    }

    #[test]
    fn quotes_paths_with_spaces() {
        assert_eq!(quote_exec("/opt/clipvault"), "/opt/clipvault");
        assert_eq!(
            quote_exec("/home/me/My Apps/ClipVault.AppImage"),
            "\"/home/me/My Apps/ClipVault.AppImage\""
        );
        assert_eq!(quote_exec("/tmp/a$b"), "\"/tmp/a\\$b\"");
    }
}
