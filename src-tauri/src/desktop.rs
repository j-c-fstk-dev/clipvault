//! Desktop integration: main window visibility, tray icon, global shortcut
//! and notifications.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use raw_window_handle::{HasWindowHandle, RawWindowHandle};
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow, Wry};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_notification::NotificationExt;
use x11rb::connection::Connection;
use x11rb::protocol::xproto::{AtomEnum, ConnectionExt as _};

use crate::i18n::{self, Lang};
use crate::model::Item;

const MAIN_WINDOW: &str = "main";
/// Emitted when the window is brought up, so the UI can focus the search.
pub const WINDOW_SHOWN_EVENT: &str = "window-shown";
/// At most one capture notification per this interval.
const NOTIFY_INTERVAL: Duration = Duration::from_secs(2);

const MENU_SHOW: &str = "show";
const MENU_PAUSE: &str = "pause";
const MENU_QUIT: &str = "quit";

pub fn show_main(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return;
    };
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
    let _ = app.emit(WINDOW_SHOWN_EVENT, ());
}

pub fn hide_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.hide();
    }
}

/// Hides the window if it is in front, otherwise brings it up.
pub fn toggle_main(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return;
    };
    if is_in_front(&window) {
        hide_main(app);
    } else {
        show_main(app);
    }
}

fn main_window_focused(app: &AppHandle) -> bool {
    app.get_webview_window(MAIN_WINDOW)
        .is_some_and(|w| is_in_front(&w))
}

/// Whether the window is shown and is the one the user is working in.
fn is_in_front(window: &WebviewWindow) -> bool {
    if !window.is_visible().unwrap_or(false) || window.is_minimized().unwrap_or(false) {
        return false;
    }
    // GTK misses focus given by the window manager (e.g. at startup), so ask
    // the window manager first and fall back to GTK.
    let active = x11_window_id(window).and_then(|id| active_x11_window().map(|a| a == id));
    let focused = active.unwrap_or_else(|| window.is_focused().unwrap_or(false));
    log::debug!(
        "window in front: {focused} (window manager: {active:?}, gtk: {:?})",
        window.is_focused()
    );
    focused
}

fn x11_window_id(window: &WebviewWindow) -> Option<u32> {
    match window.window_handle().ok()?.as_raw() {
        RawWindowHandle::Xlib(handle) => u32::try_from(handle.window).ok(),
        RawWindowHandle::Xcb(handle) => Some(handle.window.get()),
        _ => None,
    }
}

/// The window manager's `_NET_ACTIVE_WINDOW`, if it publishes one (EWMH).
fn active_x11_window() -> Option<u32> {
    let (conn, screen) = x11rb::connect(None).ok()?;
    let root = conn.setup().roots[screen].root;
    let atom = conn
        .intern_atom(true, b"_NET_ACTIVE_WINDOW")
        .ok()?
        .reply()
        .ok()?
        .atom;
    if atom == x11rb::NONE {
        return None;
    }
    let reply = conn
        .get_property(false, root, atom, AtomEnum::WINDOW, 0, 1)
        .ok()?
        .reply()
        .ok()?;
    let active = reply.value32()?.next();
    active.filter(|&id| id != x11rb::NONE)
}

/// The tray's menu items, kept to mirror the settings.
pub struct Tray {
    show: MenuItem<Wry>,
    pause: CheckMenuItem<Wry>,
    quit: MenuItem<Wry>,
}

impl Tray {
    pub fn set_paused(&self, paused: bool) {
        let _ = self.pause.set_checked(paused);
    }

    pub fn set_language(&self, lang: Lang) {
        let texts = i18n::tray(lang);
        let _ = self.show.set_text(texts.show);
        let _ = self.pause.set_text(texts.pause);
        let _ = self.quit.set_text(texts.quit);
    }
}

/// Creates the tray icon. `on_toggle_pause` runs when the user clicks
/// "Pause recording". Linux trays only deliver menu clicks, so the menu has
/// an explicit "Show" entry.
pub fn build_tray(
    app: &AppHandle,
    paused: bool,
    lang: Lang,
    on_toggle_pause: impl Fn(&AppHandle) + Send + Sync + 'static,
) -> tauri::Result<Tray> {
    let texts = i18n::tray(lang);
    let show = MenuItem::with_id(app, MENU_SHOW, texts.show, true, None::<&str>)?;
    let pause = CheckMenuItem::with_id(app, MENU_PAUSE, texts.pause, true, paused, None::<&str>)?;
    let quit = MenuItem::with_id(app, MENU_QUIT, texts.quit, true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[&show, &pause, &PredefinedMenuItem::separator(app)?, &quit],
    )?;

    let mut builder = TrayIconBuilder::with_id("main")
        .tooltip("ClipVault")
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            MENU_SHOW => show_main(app),
            MENU_PAUSE => on_toggle_pause(app),
            MENU_QUIT => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(Tray { show, pause, quit })
}

/// Parses an accelerator such as `Ctrl+Shift+V`.
pub fn parse_shortcut(accelerator: &str) -> Result<Shortcut, String> {
    accelerator
        .parse::<Shortcut>()
        .map_err(|e| format!("invalid shortcut \"{accelerator}\": {e}"))
}

/// Makes `accelerator` the global show/hide shortcut, replacing any other.
/// An empty accelerator disables it.
pub fn register_toggle_shortcut(app: &AppHandle, accelerator: &str) -> Result<(), String> {
    let shortcuts = app.global_shortcut();
    shortcuts
        .unregister_all()
        .map_err(|e| format!("cannot release the previous shortcut: {e}"))?;
    if accelerator.trim().is_empty() {
        return Ok(());
    }
    let shortcut = parse_shortcut(accelerator)?;
    shortcuts
        .register(shortcut)
        .map_err(|e| format!("cannot use \"{accelerator}\" (another app may be using it): {e}"))
}

/// Global-shortcut plugin that toggles the main window.
pub fn shortcut_plugin() -> tauri::plugin::TauriPlugin<Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                toggle_main(app);
            }
        })
        .build()
}

/// Shows a desktop notification for a new capture, unless the window is
/// in front or one was shown moments ago.
pub fn notify_capture(app: &AppHandle, item: &Item, lang: Lang) {
    static LAST: Mutex<Option<Instant>> = Mutex::new(None);
    if main_window_focused(app) {
        return;
    }
    {
        let mut last = LAST.lock().unwrap_or_else(|e| e.into_inner());
        if last.is_some_and(|t| t.elapsed() < NOTIFY_INTERVAL) {
            return;
        }
        *last = Some(Instant::now());
    }
    let result = app
        .notification()
        .builder()
        .title(format!(
            "ClipVault · {}",
            i18n::category(item.category, lang)
        ))
        .body(summary(&item.content, 120))
        .show();
    if let Err(err) = result {
        log::debug!("cannot show notification: {err}");
    }
}

/// First line of `text`, shortened to `max` characters.
fn summary(text: &str, max: usize) -> String {
    let line = text.lines().find(|l| !l.trim().is_empty()).unwrap_or("");
    let line = line.trim();
    if line.chars().count() <= max {
        line.to_string()
    } else {
        let cut: String = line.chars().take(max - 1).collect();
        format!("{cut}…")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_default_and_recorded_shortcuts() {
        for accelerator in [
            "Ctrl+Shift+V",
            "Super+V",
            "Alt+Space",
            "Ctrl+Alt+Delete",
            "Ctrl+Shift+ArrowUp",
            "Shift+F12",
            "Ctrl+1",
        ] {
            assert!(
                parse_shortcut(accelerator).is_ok(),
                "{accelerator} should parse"
            );
        }
        assert!(parse_shortcut("Ctrl+Shift+").is_err());
        assert!(parse_shortcut("Hyper+Banana").is_err());
    }

    #[test]
    fn summarizes_first_line() {
        assert_eq!(summary("\n  hello world  \nsecond", 50), "hello world");
        assert_eq!(summary("abcdef", 4), "abc…");
        assert_eq!(summary("", 4), "");
    }
}
