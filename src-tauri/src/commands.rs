//! Tauri commands invoked by the UI.

use serde::Serialize;
use tauri::State;

use crate::model::Item;
use crate::settings::Settings;
use crate::AppState;

type CmdResult<T> = Result<T, String>;

const DEFAULT_PAGE: u32 = 500;

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
pub fn list_items(
    state: State<'_, AppState>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> CmdResult<Vec<Item>> {
    state
        .store
        .list(limit.unwrap_or(DEFAULT_PAGE), offset.unwrap_or(0))
        .map_err(|e| e.to_string())
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
pub fn set_capture_paused(state: State<'_, AppState>, paused: bool) -> CaptureStatus {
    state.set_paused(paused);
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
