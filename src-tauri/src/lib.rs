//! ClipVault desktop backend.
//!
//! An X11 watcher thread captures every clipboard change into a SQLite-backed
//! [`store::Store`]; the React UI in `../src` reads it through the commands in
//! [`commands`] and is notified of new captures with the
//! [`CAPTURED_EVENT`] event. [`desktop`] adds the tray icon, global shortcut
//! and notifications; [`autostart`] the start-on-login entry.

pub mod autostart;
pub mod backup;
pub mod capture;
mod commands;
mod desktop;
pub mod model;
pub mod serve;
pub mod settings;
pub mod store;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, RwLock};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, WindowEvent};

use crate::capture::Watcher;
use crate::commands::CaptureStatus;
use crate::desktop::Tray;
use crate::model::Item;
use crate::serve::ClipboardHandle;
use crate::settings::{Settings, SettingsFile};
use crate::store::Store;

/// Emitted with a [`CapturedPayload`] after each stored clipboard change.
pub const CAPTURED_EVENT: &str = "clipboard-captured";
/// Emitted when the history changed as a whole (e.g. after an import).
pub const HISTORY_EVENT: &str = "history-changed";
/// Emitted with the new [`Settings`] whenever they change, including from
/// the tray menu.
pub const SETTINGS_EVENT: &str = "settings-changed";

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
    /// `None` when the desktop has no tray.
    tray: Option<Tray>,
}

impl AppState {
    fn settings(&self) -> Settings {
        self.settings
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
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

/// Validates, applies and saves new settings. Nothing is saved when the
/// shortcut cannot be registered or the autostart entry cannot be written.
pub(crate) fn apply_settings(app: &AppHandle, new: Settings) -> Result<Settings, String> {
    let state = app.state::<AppState>();
    let new = new.sanitized();
    let old = state.settings();

    if new.shortcuts.toggle_app != old.shortcuts.toggle_app {
        if let Err(err) = desktop::register_toggle_shortcut(app, &new.shortcuts.toggle_app) {
            let _ = desktop::register_toggle_shortcut(app, &old.shortcuts.toggle_app);
            return Err(err);
        }
    }
    if new.start_on_boot != old.start_on_boot {
        set_autostart(app, new.start_on_boot)?;
    }

    state
        .settings_file
        .save(&new)
        .map_err(|e| format!("cannot save settings: {e}"))?;
    *state.settings.write().unwrap_or_else(|e| e.into_inner()) = new.clone();
    state.paused.store(!new.capture_enabled, Ordering::Relaxed);
    if let Some(tray) = &state.tray {
        tray.set_paused(!new.capture_enabled);
    }
    state
        .store
        .prune(new.max_items)
        .map_err(|e| e.to_string())?;
    let _ = app.emit(SETTINGS_EVENT, &new);
    Ok(new)
}

fn set_autostart(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let config_home = app.path().config_dir().map_err(|e| e.to_string())?;
    let exec = autostart::exec_path().map_err(|e| e.to_string())?;
    autostart::set_enabled(&config_home, enabled, &exec)
        .map_err(|e| format!("cannot update the autostart entry: {e}"))
}

fn toggle_capture(app: &AppHandle) {
    let mut settings = app.state::<AppState>().settings();
    settings.capture_enabled = !settings.capture_enabled;
    if let Err(err) = apply_settings(app, settings) {
        log::error!("cannot toggle capture: {err}");
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
                if settings.notifications && inserted.is_new {
                    desktop::notify_capture(&app, &inserted.item);
                }
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

    let start_hidden = std::env::args().any(|a| a == autostart::HIDDEN_ARG);

    tauri::Builder::default()
        // Must come first: a second launch just brings up the running app.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            desktop::show_main(app);
        }))
        .plugin(desktop::shortcut_plugin())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            let data_dir = app.path().app_data_dir()?;
            let settings_file = SettingsFile::new(&app.path().app_config_dir()?);
            let settings = settings_file.load();
            let paused = Arc::new(AtomicBool::new(!settings.capture_enabled));
            let settings = Arc::new(RwLock::new(settings));
            let store = Arc::new(Store::open(&data_dir)?);
            log::info!("history stored in {}", data_dir.display());

            let handle = app.handle();
            let current = settings.read().unwrap_or_else(|e| e.into_inner()).clone();
            let capture = start_capture(
                handle.clone(),
                store.clone(),
                settings.clone(),
                paused.clone(),
            );
            let tray = desktop::build_tray(handle, !current.capture_enabled, toggle_capture)
                .map_err(|err| log::warn!("no tray icon: {err}"))
                .ok();
            if let Err(err) =
                desktop::register_toggle_shortcut(handle, &current.shortcuts.toggle_app)
            {
                log::warn!("global shortcut unavailable: {err}");
            }
            // Rewrite the entry so it follows the app if it was moved.
            if current.start_on_boot {
                if let Err(err) = set_autostart(handle, true) {
                    log::warn!("{err}");
                }
            }

            app.manage(AppState {
                store,
                settings,
                settings_file,
                paused,
                capture_error: capture.as_ref().err().cloned(),
                clipboard: capture.ok(),
                tray,
            });
            if !start_hidden {
                desktop::show_main(handle);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                if app.state::<AppState>().settings().minimize_to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
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
            commands::hide_window,
            commands::export_backup,
            commands::import_backup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ClipVault");
}
