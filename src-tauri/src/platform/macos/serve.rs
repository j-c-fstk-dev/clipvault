//! Putting content on the clipboard: not ported yet.

use super::capture::Result;
use crate::model::Outgoing;

#[derive(Clone)]
pub struct ClipboardHandle {
    _private: (),
}

impl ClipboardHandle {
    pub(crate) fn new() -> Self {
        Self { _private: () }
    }

    pub fn set(&self, _out: &Outgoing) -> Result<()> {
        Err("copying is not available on macOS yet".into())
    }
}
