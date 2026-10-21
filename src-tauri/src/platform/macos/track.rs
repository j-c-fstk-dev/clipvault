//! Following moved files: not ported yet (bookmarks will do it on macOS).

use std::io;
use std::sync::Arc;

use crate::store::Store;

#[derive(Clone)]
pub struct Tracker {
    _private: (),
}

impl Tracker {
    pub fn start(
        _store: Arc<Store>,
        _on_relocated: impl Fn() + Send + Sync + 'static,
    ) -> io::Result<Self> {
        Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "following moved files is not available on macOS yet",
        ))
    }

    pub fn track(&self, _item_id: i64) {}
}
