//! Whether our window is the active one, asked of the window manager.

use raw_window_handle::{HasWindowHandle, RawWindowHandle};
use tauri::WebviewWindow;
use x11rb::connection::Connection;
use x11rb::protocol::xproto::{AtomEnum, ConnectionExt as _};

/// Whether `window` is the window manager's active window, or `None` when
/// it does not say (no EWMH, or not running on X11). GTK misses focus given
/// by the window manager, e.g. at startup.
pub fn is_active(window: &WebviewWindow) -> Option<bool> {
    let id = x11_window_id(window)?;
    active_x11_window().map(|active| active == id)
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
