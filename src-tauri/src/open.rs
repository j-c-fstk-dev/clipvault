//! Opening copied files with the applications installed on the system, the
//! way file managers do: GIO knows the content type of a file and which
//! desktop applications handle it.

use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use base64::Engine;
use gio::prelude::*;
use serde::Serialize;

/// Content type GIO uses for folders.
const DIRECTORY_TYPE: &str = "inode/directory";
/// Icons larger than this are not inlined.
const MAX_ICON_BYTES: u64 = 256 * 1024;

/// An application that can open a file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppChoice {
    /// Desktop file id, e.g. `org.xfce.mousepad.desktop`.
    pub id: String,
    pub name: String,
    /// `data:` URL of the app icon, when one was found.
    pub icon: Option<String>,
    /// The system default for this content type.
    pub is_default: bool,
}

/// Content type of a file or folder, e.g. `image/png`.
pub fn content_type(path: &Path) -> String {
    if path.is_dir() {
        return DIRECTORY_TYPE.to_string();
    }
    let head = read_head(path);
    gio::content_type_guess(Some(path), &head).0.to_string()
}

/// Human-readable name of a content type, e.g. "PNG image".
pub fn describe(content_type: &str) -> String {
    gio::content_type_get_description(content_type).to_string()
}

/// Applications for `content_type`: the system default first, then the
/// recommended ones, then any other registered handler.
pub fn apps_for(content_type: &str) -> Vec<AppChoice> {
    let default = gio::AppInfo::default_for_type(content_type, false);
    let default_id = default.as_ref().and_then(|app| app.id()).map(String::from);

    let mut seen = Vec::new();
    let mut choices = Vec::new();
    let candidates = default
        .into_iter()
        .chain(gio::AppInfo::recommended_for_type(content_type))
        .chain(gio::AppInfo::all_for_type(content_type));
    for app in candidates {
        let Some(id) = app.id().map(String::from) else {
            continue;
        };
        if seen.contains(&id) || !app.should_show() {
            continue;
        }
        seen.push(id.clone());
        choices.push(AppChoice {
            is_default: default_id.as_deref() == Some(id.as_str()),
            name: app.display_name().to_string(),
            icon: app.icon().and_then(|icon| icon_data_url(&icon)),
            id,
        });
    }
    choices
}

/// Whether `app_id` is an installed application.
pub fn app_exists(app_id: &str) -> bool {
    gio::DesktopAppInfo::new(app_id).is_some()
}

/// Opens `path` with the application `app_id`.
pub fn launch(app_id: &str, path: &Path) -> Result<(), String> {
    let app = gio::DesktopAppInfo::new(app_id)
        .ok_or_else(|| format!("application {app_id} is not installed"))?;
    app.launch(&[gio::File::for_path(path)], None::<&gio::AppLaunchContext>)
        .map_err(|e| format!("cannot open with {}: {e}", app.display_name()))
}

/// First bytes of a file, which make content sniffing more reliable.
fn read_head(path: &Path) -> Vec<u8> {
    use std::io::Read;
    let mut head = Vec::new();
    if let Ok(file) = fs::File::open(path) {
        let _ = file.take(4096).read_to_end(&mut head);
    }
    head
}

/// Inlines an application icon so the UI can show it without file access.
fn icon_data_url(icon: &gio::Icon) -> Option<String> {
    let path = match icon.downcast_ref::<gio::ThemedIcon>() {
        Some(themed) => themed
            .names()
            .iter()
            .find_map(|name| find_themed_icon(name))?,
        None => icon.downcast_ref::<gio::FileIcon>()?.file().path()?,
    };
    data_url(&path)
}

/// Looks an icon name up in the hicolor theme and pixmaps, where
/// applications install their icons.
fn find_themed_icon(name: &str) -> Option<PathBuf> {
    if Path::new(name).is_absolute() {
        return Some(PathBuf::from(name)).filter(|p| p.is_file());
    }
    const SIZES: &[&str] = &["64x64", "48x48", "128x128", "scalable", "256x256", "32x32"];
    let mut data_dirs: Vec<PathBuf> = Vec::new();
    if let Some(home) = env::var_os("HOME") {
        data_dirs.push(PathBuf::from(home).join(".local/share"));
    }
    let system = env::var("XDG_DATA_DIRS")
        .ok()
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| "/usr/local/share:/usr/share".into());
    data_dirs.extend(system.split(':').map(PathBuf::from));

    for dir in &data_dirs {
        for size in SIZES {
            for ext in ["png", "svg"] {
                let candidate = dir
                    .join("icons/hicolor")
                    .join(size)
                    .join("apps")
                    .join(format!("{name}.{ext}"));
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }
        for ext in ["png", "svg"] {
            let candidate = dir.join("pixmaps").join(format!("{name}.{ext}"));
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

fn data_url(path: &Path) -> Option<String> {
    let mime = match path.extension()?.to_str()? {
        "png" => "image/png",
        "svg" => "image/svg+xml",
        _ => return None,
    };
    if fs::metadata(path).ok()?.len() > MAX_ICON_BYTES {
        return None;
    }
    let bytes = fs::read(path).ok()?;
    Some(format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_content_types() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(content_type(dir.path()), DIRECTORY_TYPE);

        let png = dir.path().join("shot.png");
        fs::write(&png, b"\x89PNG\r\n\x1a\n\0\0\0\x0dIHDR").unwrap();
        assert_eq!(content_type(&png), "image/png");

        // Sniffed from the content when the name says nothing.
        let text = dir.path().join("untitled-note");
        fs::write(&text, "plain words\n").unwrap();
        assert_eq!(content_type(&text), "text/plain");
    }

    #[test]
    fn inlines_png_and_svg_icons() {
        let dir = tempfile::tempdir().unwrap();
        let svg = dir.path().join("app.svg");
        fs::write(&svg, "<svg/>").unwrap();
        assert_eq!(
            data_url(&svg).unwrap(),
            "data:image/svg+xml;base64,PHN2Zy8+"
        );
        let xpm = dir.path().join("app.xpm");
        fs::write(&xpm, "x").unwrap();
        assert_eq!(data_url(&xpm), None);
    }

    #[test]
    fn unknown_apps_are_reported() {
        assert!(!app_exists("definitely-not-installed.desktop"));
        let err = launch("definitely-not-installed.desktop", Path::new("/tmp")).unwrap_err();
        assert!(err.contains("not installed"), "{err}");
    }
}
