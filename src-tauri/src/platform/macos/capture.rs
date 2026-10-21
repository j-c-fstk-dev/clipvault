//! Clipboard capture: not ported yet.

use std::io;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::thread::JoinHandle;

use super::serve::ClipboardHandle;
use crate::model::Captured;

pub(crate) type BoxError = Box<dyn std::error::Error + Send + Sync>;
pub(crate) type Result<T> = std::result::Result<T, BoxError>;

const NOT_YET: &str = "clipboard capture is not available on macOS yet";

pub struct Watcher {
    _private: (),
}

impl Watcher {
    pub fn connect() -> Result<Self> {
        Err(NOT_YET.into())
    }

    pub fn handle(&self) -> ClipboardHandle {
        ClipboardHandle::new()
    }

    pub fn spawn<F>(self, _paused: Arc<AtomicBool>, _on_capture: F) -> io::Result<JoinHandle<()>>
    where
        F: FnMut(Captured) + Send + 'static,
    {
        Err(io::Error::new(io::ErrorKind::Unsupported, NOT_YET))
    }
}
