//! Everything that depends on the operating system, behind the same names on
//! each one: `capture::Watcher` and `serve::ClipboardHandle` (the clipboard),
//! `open` (apps that open a file), `track::Tracker` (following moved files),
//! `autostart`, `window` and `lower_priority`.

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "linux")]
pub use linux::*;

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub use macos::*;
