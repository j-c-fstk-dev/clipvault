//! Backend settings, persisted as JSON in the app config directory.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

/// Mirrors `Settings` in `src/types`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// History size; favorites are never pruned and do not count against it.
    pub max_items: u32,
    /// Copied files are snapshotted into the vault when their total size is
    /// at most this many megabytes. 0 disables snapshots.
    pub snapshot_limit_mb: u64,
    /// Record clipboard changes; false pauses capture.
    pub capture_enabled: bool,
    pub notifications: bool,
    pub start_on_boot: bool,
    pub minimize_to_tray: bool,
    pub shortcuts: Shortcuts,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            max_items: 1000,
            snapshot_limit_mb: 25,
            capture_enabled: true,
            notifications: true,
            start_on_boot: false,
            minimize_to_tray: true,
            shortcuts: Shortcuts::default(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Shortcuts {
    pub toggle_app: String,
    pub copy_selected: String,
    pub delete_selected: String,
}

impl Default for Shortcuts {
    fn default() -> Self {
        Self {
            toggle_app: "Ctrl+Shift+V".into(),
            copy_selected: "Ctrl+C".into(),
            delete_selected: "Delete".into(),
        }
    }
}

impl Settings {
    pub const MAX_ITEMS_LIMIT: u32 = 99_999;

    pub fn snapshot_limit_bytes(&self) -> u64 {
        self.snapshot_limit_mb.saturating_mul(1024 * 1024)
    }

    /// Clamps values into their supported ranges.
    pub fn sanitized(mut self) -> Self {
        self.max_items = self.max_items.clamp(1, Self::MAX_ITEMS_LIMIT);
        self
    }
}

/// Loads and saves [`Settings`] at a fixed path.
pub struct SettingsFile {
    path: PathBuf,
}

impl SettingsFile {
    pub fn new(dir: &Path) -> Self {
        Self {
            path: dir.join("settings.json"),
        }
    }

    /// Returns defaults when the file is missing or unreadable, so a corrupt
    /// file never prevents the app from starting.
    pub fn load(&self) -> Settings {
        match fs::read_to_string(&self.path) {
            Ok(json) => serde_json::from_str::<Settings>(&json)
                .map(Settings::sanitized)
                .unwrap_or_else(|err| {
                    log::warn!("ignoring invalid {}: {err}", self.path.display());
                    Settings::default()
                }),
            Err(err) if err.kind() == io::ErrorKind::NotFound => Settings::default(),
            Err(err) => {
                log::warn!("cannot read {}: {err}", self.path.display());
                Settings::default()
            }
        }
    }

    pub fn save(&self, settings: &Settings) -> io::Result<()> {
        if let Some(dir) = self.path.parent() {
            fs::create_dir_all(dir)?;
        }
        let json = serde_json::to_string_pretty(settings).map_err(io::Error::other)?;
        // Write then rename so a crash never leaves a truncated file.
        let tmp = self.path.with_extension("json.tmp");
        fs::write(&tmp, json)?;
        fs::rename(tmp, &self.path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_and_fills_defaults() {
        let dir = tempfile::tempdir().unwrap();
        let file = SettingsFile::new(dir.path());
        assert_eq!(file.load(), Settings::default());

        let custom = Settings {
            max_items: 50,
            snapshot_limit_mb: 0,
            capture_enabled: false,
            shortcuts: Shortcuts {
                toggle_app: "Super+V".into(),
                ..Shortcuts::default()
            },
            ..Settings::default()
        };
        file.save(&custom).unwrap();
        assert_eq!(file.load(), custom);

        fs::write(
            dir.path().join("settings.json"),
            r#"{"maxItems": 7, "shortcuts": {"toggleApp": "Alt+V"}}"#,
        )
        .unwrap();
        assert_eq!(
            file.load(),
            Settings {
                max_items: 7,
                shortcuts: Shortcuts {
                    toggle_app: "Alt+V".into(),
                    ..Shortcuts::default()
                },
                ..Settings::default()
            }
        );
    }

    #[test]
    fn invalid_file_falls_back_to_defaults() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("settings.json"), "{not json").unwrap();
        assert_eq!(SettingsFile::new(dir.path()).load(), Settings::default());
    }

    #[test]
    fn clamps_max_items() {
        let s = Settings {
            max_items: 0,
            ..Settings::default()
        };
        assert_eq!(s.sanitized().max_items, 1);
    }
}
