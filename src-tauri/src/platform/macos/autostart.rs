//! Start on login through a LaunchAgent: a property list in
//! `~/Library/LaunchAgents` that launches ClipVault hidden in the menu bar.

use std::env;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

/// Command-line flag that starts ClipVault without showing its window.
pub const HIDDEN_ARG: &str = "--hidden";

const LABEL: &str = "com.jorgecristo.clipvault";

/// Creates or removes the LaunchAgent for the running executable.
pub fn set(enabled: bool) -> io::Result<()> {
    let home = env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "no home directory"))?;
    set_enabled(&home, enabled, &env::current_exe()?)
}

/// Creates or removes the LaunchAgent under `home`.
pub fn set_enabled(home: &Path, enabled: bool, exec: &Path) -> io::Result<()> {
    let path = home
        .join("Library/LaunchAgents")
        .join(format!("{LABEL}.plist"));
    if enabled {
        fs::create_dir_all(path.parent().unwrap_or(home))?;
        fs::write(&path, launch_agent(exec))
    } else {
        match fs::remove_file(&path) {
            Err(err) if err.kind() != io::ErrorKind::NotFound => Err(err),
            _ => Ok(()),
        }
    }
}

fn launch_agent(exec: &Path) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>{LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>{}</string>
    <string>{HIDDEN_ARG}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
"#,
        xml_escape(&exec.to_string_lossy())
    )
}

fn xml_escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_and_removes_the_launch_agent() {
        let home = tempfile::tempdir().unwrap();
        let exec = Path::new("/Applications/ClipVault & Co.app/Contents/MacOS/clipvault");
        set_enabled(home.path(), true, exec).unwrap();
        let plist = home
            .path()
            .join("Library/LaunchAgents/com.jorgecristo.clipvault.plist");
        let text = fs::read_to_string(&plist).unwrap();
        assert!(text.contains(
            "<string>/Applications/ClipVault &amp; Co.app/Contents/MacOS/clipvault</string>"
        ));
        assert!(text.contains("<string>--hidden</string>"));
        set_enabled(home.path(), false, exec).unwrap();
        assert!(!plist.exists());
        set_enabled(home.path(), false, exec).unwrap();
    }
}
