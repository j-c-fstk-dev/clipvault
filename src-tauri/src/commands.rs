//! Tauri commands invoked by the UI.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

use crate::backup::{self, ExportStats};
use crate::locate;
use crate::model::{image_mime, Category, FileEntry, Item, ItemKind, SnapshotStatus};
use crate::open::{self as opener, AppChoice};
use crate::serve::Outgoing;
use crate::settings::Settings;
use crate::store::{Counts, ImportStats, Page, Query};
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
pub async fn copy_item(app: AppHandle, id: i64) -> CmdResult<Item> {
    run_blocking(move || {
        let state = app.state::<AppState>();
        let clipboard = state
            .clipboard
            .as_ref()
            .ok_or("the clipboard is not available")?;
        let item = find_moved(&app, load_item(&state, id)?)?;
        clipboard
            .set(&outgoing_for(&item)?)
            .map_err(|e| e.to_string())?;
        state.store.touch(id).map_err(|e| e.to_string())
    })
    .await
}

fn load_item(state: &AppState, id: i64) -> CmdResult<Item> {
    state
        .store
        .get(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("item {id} not found"))
}

/// Looks for the files of `item` that are gone with no saved copy (moved
/// after the tracker stopped following them, or while ClipVault was not
/// running) and records where they are now.
fn find_moved(app: &AppHandle, item: Item) -> CmdResult<Item> {
    let state = app.state::<AppState>();
    let mut relocated = false;
    for (position, file) in item.files.iter().enumerate() {
        if file.exists || openable_path(file).is_ok() {
            continue;
        }
        let Some(identity) = state
            .store
            .file_identity(item.id, position)
            .map_err(|e| e.to_string())?
        else {
            continue;
        };
        let mut roots: Vec<PathBuf> = Path::new(&file.path)
            .parent()
            .map(Path::to_path_buf)
            .into_iter()
            .collect();
        roots.extend(locate::default_roots());
        if let Some(found) = locate::find(&identity, &roots, locate::SEARCH_BUDGET) {
            log::info!("{} found at {}", file.name, found.display());
            state
                .store
                .relocate_file(item.id, position, &found)
                .map_err(|e| e.to_string())?;
            relocated = true;
        }
    }
    if !relocated {
        return Ok(item);
    }
    let _ = app.emit(crate::HISTORY_EVENT, ());
    load_item(&state, item.id)
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
            let image = match paths.as_slice() {
                [only] if item.category == Category::Image => image_contents(only),
                _ => None,
            };
            Outgoing::Files { paths, image }
        }
    })
}

/// Outcome of [`open_file`].
#[derive(Debug, Clone, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum OpenResult {
    /// Opened with the application remembered for its type.
    Opened,
    /// The user has to pick an application.
    Choose {
        name: String,
        content_type: String,
        description: String,
        apps: Vec<AppChoice>,
    },
}

/// Opens one of an item's files: with the app remembered via "Always" for its
/// type, or by returning the apps to choose from.
#[tauri::command]
pub async fn open_file(app: AppHandle, id: i64, position: usize) -> CmdResult<OpenResult> {
    run_blocking(move || {
        let state = app.state::<AppState>();
        let file = item_file(&find_moved(&app, load_item(&state, id)?)?, position)?;
        let path = openable_path(&file)?;
        let content_type = opener::content_type(&path);
        if let Some(app_id) = state.settings().open_with.get(&content_type) {
            if opener::app_exists(app_id) {
                opener::launch(app_id, &path)?;
                return Ok(OpenResult::Opened);
            }
        }
        Ok(OpenResult::Choose {
            name: file.name,
            description: opener::describe(&content_type),
            apps: opener::apps_for(&content_type),
            content_type,
        })
    })
    .await
}

/// Opens one of an item's files with `app_id`; `always` remembers the choice
/// for files of the same type.
#[tauri::command]
pub fn open_file_with(
    app: AppHandle,
    id: i64,
    position: usize,
    app_id: String,
    always: bool,
) -> CmdResult<()> {
    let state = app.state::<AppState>();
    let path = openable_path(&item_file(&load_item(&state, id)?, position)?)?;
    opener::launch(&app_id, &path)?;
    if always {
        let mut settings = state.settings();
        settings
            .open_with
            .insert(opener::content_type(&path), app_id);
        crate::apply_settings(&app, settings)?;
    }
    Ok(())
}

fn item_file(item: &Item, position: usize) -> CmdResult<FileEntry> {
    item.files
        .get(position)
        .cloned()
        .ok_or_else(|| format!("item {} has no file {position}", item.id))
}

/// The original file if it is still there, otherwise the vault copy.
fn openable_path(file: &FileEntry) -> CmdResult<PathBuf> {
    let original = PathBuf::from(&file.path);
    if original.exists() {
        return Ok(original);
    }
    file.snapshot_path
        .as_deref()
        .filter(|_| file.status == SnapshotStatus::Stored)
        .map(PathBuf::from)
        .filter(|p| p.exists())
        .ok_or_else(|| {
            format!(
                "{} is no longer at {} and no copy was saved",
                file.name, file.path
            )
        })
}

/// Bytes and MIME type of an image file small enough to keep in memory.
fn image_contents(path: &Path) -> Option<(Vec<u8>, String)> {
    const MAX_IMAGE_BYTES: u64 = 64 * 1024 * 1024;
    let mime = image_mime(path)?;
    if fs::metadata(path).ok()?.len() > MAX_IMAGE_BYTES {
        return None;
    }
    Some((fs::read(path).ok()?, mime.to_string()))
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
pub fn update_settings(app: AppHandle, settings: Settings) -> CmdResult<Settings> {
    crate::apply_settings(&app, settings)
}

/// Asks where to save and writes a `.zip` backup of the whole history.
/// Returns `None` if the user cancels.
#[tauri::command]
pub async fn export_backup(app: AppHandle) -> CmdResult<Option<ExportStats>> {
    run_blocking(move || {
        let Some(path) = app
            .dialog()
            .file()
            .set_title("Export ClipVault backup")
            .add_filter("ClipVault backup", &["zip"])
            .set_file_name(backup::default_file_name(backup::now_ms()))
            .blocking_save_file()
        else {
            return Ok(None);
        };
        let mut path = path.into_path().map_err(|e| e.to_string())?;
        if path.extension().is_none_or(|ext| ext != "zip") {
            path.as_mut_os_string().push(".zip");
        }
        let state = app.state::<AppState>();
        backup::export(&state.store, &path)
            .map(Some)
            .map_err(|e| format!("export failed: {e}"))
    })
    .await
}

/// Asks for a backup and merges it into the history. Returns `None` if the
/// user cancels.
#[tauri::command]
pub async fn import_backup(app: AppHandle) -> CmdResult<Option<ImportStats>> {
    run_blocking(move || {
        let Some(path) = app
            .dialog()
            .file()
            .set_title("Import ClipVault backup")
            .add_filter("ClipVault backup", &["zip"])
            .blocking_pick_file()
        else {
            return Ok(None);
        };
        let path = path.into_path().map_err(|e| e.to_string())?;
        let state = app.state::<AppState>();
        let max_items = state.settings().max_items;
        let stats = backup::import(&state.store, &path, state.store.data_dir(), max_items)
            .map_err(|e| format!("import failed: {e}"))?;
        let _ = state.snapshots.send(()); // imported items may still need copies
        let _ = app.emit(crate::HISTORY_EVENT, ());
        Ok(Some(stats))
    })
    .await
}

/// Runs slow work (file dialogs, zipping) off the async runtime.
async fn run_blocking<T: Send + 'static>(
    work: impl FnOnce() -> CmdResult<T> + Send + 'static,
) -> CmdResult<T> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|e| e.to_string())?
}

/// Sends the window to the tray, e.g. after copying an item so the user can
/// paste where they were.
#[tauri::command]
pub fn hide_window(app: AppHandle) {
    crate::desktop::hide_main(&app);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::FileEntry;

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
            exists: path.exists(),
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
                paths: vec![original, snapshot],
                image: None,
            }
        );

        let gone = files_item(vec![entry(&lost, None)]);
        assert!(outgoing_for(&gone).is_err());
    }
}
