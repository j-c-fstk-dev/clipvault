//! ClipVault desktop backend.
//!
//! An X11 watcher thread captures every clipboard change into a SQLite-backed
//! [`store::Store`]; the React UI in `../src` reads it through the commands in
//! [`commands`] and is notified of new captures with the
//! [`CAPTURED_EVENT`] event.

pub mod capture;
mod commands;
pub mod model;
pub mod serve;
pub mod settings;
pub mod store;

use std::error::Error;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, RwLock};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::capture::Watcher;
use crate::commands::CaptureStatus;
use crate::model::Item;
use crate::serve::ClipboardHandle;
use crate::settings::{Settings, SettingsFile};
use crate::store::Store;

/// Emitted with a [`CapturedPayload`] after each stored clipboard change.
pub const CAPTURED_EVENT: &str = "clipboard-captured";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CapturedPayload {
    item: Item,
    /// `false` when existing content was copied again and moved to the top.
    is_new: bool,
    /// Ids removed to respect the history limit.
    pruned: Vec<i64>,
}

pub struct AppState {
    store: Arc<Store>,
    settings: Arc<RwLock<Settings>>,
    settings_file: SettingsFile,
    paused: Arc<AtomicBool>,
    capture_error: Option<String>,
    /// `None` when there is no X11 display.
    clipboard: Option<ClipboardHandle>,
}

impl AppState {
    fn settings(&self) -> Settings {
        self.settings
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }

    fn update_settings(&self, new: Settings) -> Result<Settings, Box<dyn Error>> {
        let new = new.sanitized();
        self.settings_file.save(&new)?;
        *self.settings.write().unwrap_or_else(|e| e.into_inner()) = new.clone();
        self.paused.store(!new.capture_enabled, Ordering::Relaxed);
        self.store.prune(new.max_items)?;
        Ok(new)
    }

    fn capture_status(&self) -> CaptureStatus {
        CaptureStatus {
            available: self.capture_error.is_none(),
            paused: self.paused.load(Ordering::Relaxed),
            error: self.capture_error.clone(),
            wayland: is_wayland_session(),
        }
    }
}

fn is_wayland_session() -> bool {
    std::env::var_os("WAYLAND_DISPLAY").is_some()
        || std::env::var("XDG_SESSION_TYPE").is_ok_and(|t| t == "wayland")
}

/// Starts the clipboard watcher and returns a handle for copying back, or
/// why it could not start.
fn start_capture(
    app: AppHandle,
    store: Arc<Store>,
    settings: Arc<RwLock<Settings>>,
    paused: Arc<AtomicBool>,
) -> Result<ClipboardHandle, String> {
    let watcher = match Watcher::connect() {
        Ok(watcher) => watcher,
        Err(err) => {
            log::error!("clipboard capture unavailable: {err}");
            return Err(format!("cannot connect to the X11 display: {err}"));
        }
    };
    let clipboard = watcher.handle();
    let spawned = watcher.spawn(paused, move |captured| {
        let settings = settings.read().unwrap_or_else(|e| e.into_inner()).clone();
        match store.insert(captured, &settings) {
            Ok(inserted) => {
                let payload = CapturedPayload {
                    item: inserted.item,
                    is_new: inserted.is_new,
                    pruned: inserted.pruned,
                };
                if let Err(err) = app.emit(CAPTURED_EVENT, payload) {
                    log::warn!("cannot notify UI: {err}");
                }
            }
            Err(err) => log::error!("cannot store clipboard item: {err}"),
        }
    });
    match spawned {
        Ok(_) => {
            log::info!("clipboard capture started");
            Ok(clipboard)
        }
        Err(err) => Err(format!("cannot start capture thread: {err}")),
    }
}

pub fn run() {
    env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("clipvault_lib=info"),
    )
    .init();

    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let settings_file = SettingsFile::new(&app.path().app_config_dir()?);
            let settings = settings_file.load();
            let paused = Arc::new(AtomicBool::new(!settings.capture_enabled));
            let settings = Arc::new(RwLock::new(settings));
            let store = Arc::new(Store::open(&data_dir)?);
            log::info!("history stored in {}", data_dir.display());

            let capture = start_capture(
                app.handle().clone(),
                store.clone(),
                settings.clone(),
                paused.clone(),
            );
            app.manage(AppState {
                store,
                settings,
                settings_file,
                paused,
                capture_error: capture.as_ref().err().cloned(),
                clipboard: capture.ok(),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::query_items,
            commands::get_counts,
            commands::copy_item,
            commands::delete_item,
            commands::set_favorite,
            commands::add_tag,
            commands::remove_tag,
            commands::get_capture_status,
            commands::get_settings,
            commands::update_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ClipVault");
}
