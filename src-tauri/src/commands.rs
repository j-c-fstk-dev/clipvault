//! Tauri commands invoked by the UI.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::State;

use crate::model::{Item, ItemKind, SnapshotStatus};
use crate::serve::Outgoing;
use crate::settings::Settings;
use crate::store::{Counts, Page, Query};
use crate::AppState;

type CmdResult<T> = Result<T, String>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureStatus {
    /// The X11 watcher is running.
    pub available: bool,
    pub paused: bool,
    /// Why capture is unavailable, if it is.
    pub error: Option<String>,
    /// Running in a Wayland session, where only X11 apps are captured.
    pub wayland: bool,
}

#[tauri::command]
pub fn query_items(state: State<'_, AppState>, query: Query) -> CmdResult<Page> {
    state.store.query(&query).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_counts(state: State<'_, AppState>) -> CmdResult<Counts> {
    state.store.counts().map_err(|e| e.to_string())
}

/// Puts an item back on the clipboard and moves it to the top.
#[tauri::command]
pub fn copy_item(state: State<'_, AppState>, id: i64) -> CmdResult<Item> {
    let clipboard = state
        .clipboard
        .as_ref()
        .ok_or("the clipboard is not available")?;
    let item = state
        .store
        .get(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("item {id} not found"))?;
    clipboard
        .set(&outgoing_for(&item)?)
        .map_err(|e| e.to_string())?;
    state.store.touch(id).map_err(|e| e.to_string())
}

/// What to put on the clipboard for `item`. Files come from their original
/// location when it still exists, otherwise from the vault snapshot.
fn outgoing_for(item: &Item) -> CmdResult<Outgoing> {
    Ok(match item.kind {
        ItemKind::Text => Outgoing::Text {
            text: item.content.clone(),
            html: item.html.clone(),
        },
        ItemKind::Image => {
            let path = item.image_path.as_ref().ok_or("image file missing")?;
            Outgoing::Image {
                bytes: fs::read(path).map_err(|e| format!("cannot read image: {e}"))?,
                mime: item.mime.clone().unwrap_or_else(|| "image/png".into()),
            }
        }
        ItemKind::Files => {
            let paths: Vec<PathBuf> = item
                .files
                .iter()
                .filter_map(|file| {
                    let original = Path::new(&file.path);
                    if original.exists() {
                        return Some(original.to_path_buf());
                    }
                    file.snapshot_path
                        .as_deref()
                        .filter(|_| file.status == SnapshotStatus::Stored)
                        .map(PathBuf::from)
                        .filter(|p| p.exists())
                })
                .collect();
            if paths.is_empty() {
                return Err("these files no longer exist and no copy was saved".into());
            }
            Outgoing::Files { paths }
        }
    })
}

#[tauri::command]
pub fn delete_item(state: State<'_, AppState>, id: i64) -> CmdResult<()> {
    state.store.delete(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_favorite(state: State<'_, AppState>, id: i64, favorite: bool) -> CmdResult<Item> {
    state
        .store
        .set_favorite(id, favorite)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_tag(state: State<'_, AppState>, id: i64, tag: String) -> CmdResult<Item> {
    state.store.add_tag(id, &tag).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_tag(state: State<'_, AppState>, id: i64, tag: String) -> CmdResult<Item> {
    state.store.remove_tag(id, &tag).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_capture_status(state: State<'_, AppState>) -> CaptureStatus {
    state.capture_status()
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Settings {
    state.settings()
}

#[tauri::command]
pub fn update_settings(state: State<'_, AppState>, settings: Settings) -> CmdResult<Settings> {
    state.update_settings(settings).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Category, FileEntry};

    fn files_item(files: Vec<FileEntry>) -> Item {
        Item {
            id: 1,
            kind: ItemKind::Files,
            category: Category::File,
            content: String::new(),
            html: None,
            mime: None,
            image_path: None,
            width: None,
            height: None,
            size: None,
            files,
            is_favorite: false,
            tags: Vec::new(),
            created_at: 0,
            last_used_at: 0,
        }
    }

    fn entry(path: &Path, snapshot: Option<&Path>) -> FileEntry {
        FileEntry {
            path: path.to_string_lossy().into_owned(),
            name: "x".into(),
            is_dir: false,
            size: None,
            snapshot_path: snapshot.map(|p| p.to_string_lossy().into_owned()),
            status: if snapshot.is_some() {
                SnapshotStatus::Stored
            } else {
                SnapshotStatus::TooLarge
            },
        }
    }

    #[test]
    fn files_fall_back_to_snapshots() {
        let dir = tempfile::tempdir().unwrap();
        let original = dir.path().join("here.txt");
        fs::write(&original, "a").unwrap();
        let snapshot = dir.path().join("snapshot.txt");
        fs::write(&snapshot, "b").unwrap();
        let moved = dir.path().join("moved.txt");
        let lost = dir.path().join("lost.txt");

        let item = files_item(vec![
            entry(&original, Some(&snapshot)),
            entry(&moved, Some(&snapshot)),
            entry(&lost, None),
        ]);
        assert_eq!(
            outgoing_for(&item).unwrap(),
            Outgoing::Files {
                paths: vec![original, snapshot]
            }
        );

        let gone = files_item(vec![entry(&lost, None)]);
        assert!(outgoing_for(&gone).is_err());
    }
}
