//! Opening copied files. Until the native "open with" list is ported, the
//! only choice offered is the file's default app, through `open(1)`.

use std::path::Path;
use std::process::Command;

use serde::Serialize;

/// The single choice offered for now: whatever app macOS opens the file with.
const DEFAULT_APP: &str = "default";

/// An application that can open a file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppChoice {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub is_default: bool,
}

/// Content type of a file, from its extension; folders are
/// `inode/directory` as on Linux.
pub fn content_type(path: &Path) -> String {
    if path.is_dir() {
        return "inode/directory".into();
    }
    match crate::model::image_mime(path) {
        Some(mime) => mime.to_string(),
        None => path
            .extension()
            .map(|ext| format!("public.{}", ext.to_string_lossy().to_lowercase()))
            .unwrap_or_else(|| "public.data".into()),
    }
}

pub fn describe(content_type: &str) -> String {
    content_type.to_string()
}

pub fn apps_for(_content_type: &str) -> Vec<AppChoice> {
    vec![AppChoice {
        id: DEFAULT_APP.into(),
        name: "Default app".into(),
        icon: None,
        is_default: true,
    }]
}

pub fn app_exists(app_id: &str) -> bool {
    app_id == DEFAULT_APP
}

pub fn launch(app_id: &str, path: &Path) -> Result<(), String> {
    if app_id != DEFAULT_APP {
        return Err(format!("application {app_id} is not installed"));
    }
    let status = Command::new("/usr/bin/open")
        .arg(path)
        .status()
        .map_err(|e| format!("cannot open {}: {e}", path.display()))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("cannot open {}", path.display()))
    }
}
