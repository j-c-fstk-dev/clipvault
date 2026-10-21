//! Whether our window is the active one.

use tauri::WebviewWindow;

/// `None`: the toolkit's own focus state is reliable on macOS.
pub fn is_active(_window: &WebviewWindow) -> Option<bool> {
    None
}
