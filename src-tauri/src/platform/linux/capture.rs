//! X11 clipboard watcher.
//!
//! Listens for XFixes selection-owner changes on `CLIPBOARD` (no polling),
//! asks the owner for its `TARGETS`, picks the richest format we understand
//! and reads it, including the INCR protocol used for large transfers.
//! The same connection serves our own clipboard offers (see [`super::serve`]).

use std::collections::HashMap;
use std::error::Error;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use x11rb::connection::Connection;
use x11rb::protocol::xfixes::{self, ConnectionExt as _, SelectionEventMask};
use x11rb::protocol::xproto::{
    Atom, AtomEnum, ConnectionExt as _, CreateWindowAux, EventMask, Property, Window, WindowClass,
};
use x11rb::protocol::Event;
use x11rb::rust_connection::RustConnection;
use x11rb::{CURRENT_TIME, NONE};

use super::serve::{ClipboardHandle, Server};
use crate::model::{decode_html, decode_latin1, parse_uri_list, Captured, ClipboardAccess};

pub(crate) type BoxError = Box<dyn Error + Send + Sync>;
pub(crate) type Result<T> = std::result::Result<T, BoxError>;

/// How long the selection owner gets to answer each request or INCR chunk.
const REPLY_TIMEOUT: Duration = Duration::from_secs(3);
/// Transfers larger than this are abandoned.
const MAX_TRANSFER_BYTES: usize = 256 * 1024 * 1024;
/// Text larger than this is not stored.
const MAX_TEXT_BYTES: usize = 16 * 1024 * 1024;
/// GetProperty request size, in 32-bit units (4 MiB).
const PROPERTY_CHUNK: u32 = 1024 * 1024;

/// Clipboard formats ClipVault understands.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) enum Target {
    /// Set by KeePassXC and other password managers on secrets.
    PasswordHint,
    UriList,
    GnomeCopiedFiles,
    Png,
    Webp,
    Jpeg,
    Gif,
    Bmp,
    Utf8String,
    TextPlainUtf8,
    TextPlain,
    String,
    Text,
    Html,
}

const TARGET_NAMES: &[(Target, &str)] = &[
    (Target::PasswordHint, "x-kde-passwordManagerHint"),
    (Target::UriList, "text/uri-list"),
    (Target::GnomeCopiedFiles, "x-special/gnome-copied-files"),
    (Target::Png, "image/png"),
    (Target::Webp, "image/webp"),
    (Target::Jpeg, "image/jpeg"),
    (Target::Gif, "image/gif"),
    (Target::Bmp, "image/bmp"),
    (Target::Utf8String, "UTF8_STRING"),
    (Target::TextPlainUtf8, "text/plain;charset=utf-8"),
    (Target::TextPlain, "text/plain"),
    (Target::String, "STRING"),
    (Target::Text, "TEXT"),
    (Target::Html, "text/html"),
];

impl Target {
    pub(crate) fn from_mime(mime: &str) -> Option<Self> {
        TARGET_NAMES
            .iter()
            .find(|(_, name)| *name == mime)
            .map(|(t, _)| *t)
    }

    pub(crate) fn mime(self) -> &'static str {
        TARGET_NAMES
            .iter()
            .find(|(t, _)| *t == self)
            .map(|(_, name)| *name)
            .unwrap_or_default()
    }
}

/// X11 has no permission for reading the clipboard.
pub fn access() -> Option<ClipboardAccess> {
    None
}

pub fn open_access_settings() -> std::result::Result<(), String> {
    Err("there is no clipboard permission to change".into())
}

fn is_secret(offered: &[Target]) -> bool {
    offered.contains(&Target::PasswordHint)
}

fn file_target(offered: &[Target]) -> Option<Target> {
    [Target::UriList, Target::GnomeCopiedFiles]
        .into_iter()
        .find(|t| offered.contains(t))
}

/// PNG first: it is lossless and what browsers and editors usually offer.
fn image_target(offered: &[Target]) -> Option<Target> {
    [
        Target::Png,
        Target::Webp,
        Target::Jpeg,
        Target::Gif,
        Target::Bmp,
    ]
    .into_iter()
    .find(|t| offered.contains(t))
}

fn text_targets(offered: &[Target]) -> Vec<Target> {
    [
        Target::Utf8String,
        Target::TextPlainUtf8,
        Target::String,
        Target::TextPlain,
        Target::Text,
    ]
    .into_iter()
    .filter(|t| offered.contains(t))
    .collect()
}

pub(crate) struct Atoms {
    pub(crate) clipboard: Atom,
    pub(crate) targets: Atom,
    pub(crate) incr: Atom,
    /// Property on our window that owners write the data into.
    transfer: Atom,
    by_atom: HashMap<Atom, Target>,
    by_target: HashMap<Target, Atom>,
}

impl Atoms {
    fn intern(conn: &RustConnection) -> Result<Self> {
        let intern = |name: &str| -> Result<Atom> {
            Ok(conn.intern_atom(false, name.as_bytes())?.reply()?.atom)
        };
        let mut by_atom = HashMap::new();
        let mut by_target = HashMap::new();
        for (target, name) in TARGET_NAMES {
            let atom = intern(name)?;
            by_atom.insert(atom, *target);
            by_target.insert(*target, atom);
        }
        Ok(Self {
            clipboard: intern("CLIPBOARD")?,
            targets: intern("TARGETS")?,
            incr: intern("INCR")?,
            transfer: intern("CLIPVAULT_TRANSFER")?,
            by_atom,
            by_target,
        })
    }

    pub(crate) fn atom(&self, target: Target) -> Atom {
        self.by_target[&target]
    }
}

/// An X11 connection with a hidden window subscribed to clipboard changes.
pub struct Watcher {
    conn: Arc<RustConnection>,
    window: Window,
    atoms: Arc<Atoms>,
    /// Answers paste requests while we own the clipboard.
    server: Server,
    /// The clipboard changed while we were busy reading it.
    pending: bool,
}

impl Watcher {
    /// Connects to `$DISPLAY`. Fails on systems without an X server.
    pub fn connect() -> Result<Self> {
        let (conn, screen_num) = x11rb::connect(None)?;
        let screen = &conn.setup().roots[screen_num];
        let window = conn.generate_id()?;
        conn.create_window(
            screen.root_depth,
            window,
            screen.root,
            0,
            0,
            1,
            1,
            0,
            WindowClass::INPUT_OUTPUT,
            screen.root_visual,
            &CreateWindowAux::new().event_mask(EventMask::PROPERTY_CHANGE),
        )?;
        conn.xfixes_query_version(5, 0)?.reply()?;
        let atoms = Atoms::intern(&conn)?;
        conn.xfixes_select_selection_input(
            window,
            atoms.clipboard,
            SelectionEventMask::SET_SELECTION_OWNER,
        )?;
        conn.flush()?;
        let server = Server::new(&conn);
        Ok(Self {
            conn: Arc::new(conn),
            window,
            atoms: Arc::new(atoms),
            server,
            pending: false,
        })
    }

    /// A handle other threads use to put content on the clipboard.
    pub fn handle(&self) -> ClipboardHandle {
        ClipboardHandle::new(
            self.conn.clone(),
            self.window,
            self.atoms.clone(),
            self.server.offer(),
        )
    }

    /// Runs the watcher on its own thread, calling `on_capture` for every
    /// clipboard change while `paused` is false. The current clipboard
    /// content is captured once at startup.
    pub fn spawn<F>(self, paused: Arc<AtomicBool>, on_capture: F) -> std::io::Result<JoinHandle<()>>
    where
        F: FnMut(Captured) + Send + 'static,
    {
        thread::Builder::new()
            .name("clipboard-watcher".into())
            .spawn(move || self.run(&paused, on_capture))
    }

    fn run(mut self, paused: &AtomicBool, mut on_capture: impl FnMut(Captured)) {
        self.pending = true;
        loop {
            while self.pending {
                self.pending = false;
                if paused.load(Ordering::Relaxed) {
                    continue;
                }
                match self.read_clipboard() {
                    Ok(Some(captured)) => on_capture(captured),
                    Ok(None) => {}
                    Err(err) => log::warn!("could not read clipboard: {err}"),
                }
            }
            match self.conn.wait_for_event() {
                Ok(event) => {
                    self.handle_event(&event);
                }
                Err(err) => {
                    log::error!("X11 connection lost, clipboard capture stopped: {err}");
                    return;
                }
            }
        }
    }

    /// Handles clipboard owner changes and requests for our own offer.
    /// Returns true if the event was consumed.
    fn handle_event(&mut self, event: &Event) -> bool {
        match event {
            Event::XfixesSelectionNotify(ev) if ev.selection == self.atoms.clipboard => {
                if ev.subtype == xfixes::SelectionEvent::SET_SELECTION_OWNER {
                    self.pending = true;
                }
                true
            }
            _ => self
                .server
                .handle_event(&self.conn, &self.atoms, self.window, event),
        }
    }

    fn read_clipboard(&mut self) -> Result<Option<Captured>> {
        let owner = self
            .conn
            .get_selection_owner(self.atoms.clipboard)?
            .reply()?
            .owner;
        if owner == NONE || owner == self.window {
            return Ok(None);
        }

        let offered = self.read_offered_targets()?;
        if is_secret(&offered) {
            log::debug!("skipping clipboard content marked as secret");
            return Ok(None);
        }

        if let Some(target) = file_target(&offered) {
            if let Some(bytes) = self.read_target(target)? {
                let paths = parse_uri_list(&String::from_utf8_lossy(&bytes));
                if !paths.is_empty() {
                    return Ok(Some(Captured::Files { paths }));
                }
            }
        }

        // Plain text wins over images: spreadsheets and office apps offer a
        // rendered picture next to the text, while browsers and image editors
        // copying a picture offer no plain text at all.
        let Some(text) = self.read_text(&offered)? else {
            return self.read_image(&offered);
        };
        let html = if offered.contains(&Target::Html) {
            self.read_target(Target::Html)?
                .map(|bytes| decode_html(&bytes))
                .filter(|html| !html.trim().is_empty())
        } else {
            None
        };
        Ok(Some(Captured::Text { text, html }))
    }

    fn read_image(&mut self, offered: &[Target]) -> Result<Option<Captured>> {
        let Some(target) = image_target(offered) else {
            return Ok(None);
        };
        Ok(self
            .read_target(target)?
            .filter(|bytes| !bytes.is_empty())
            .map(|bytes| Captured::Image {
                bytes,
                mime: target.mime().to_string(),
            }))
    }

    fn read_offered_targets(&mut self) -> Result<Vec<Target>> {
        let Some(bytes) = self.read_atom(self.atoms.targets)? else {
            return Ok(Vec::new());
        };
        Ok(bytes
            .as_chunks::<4>()
            .0
            .iter()
            .map(|&c| u32::from_ne_bytes(c))
            .filter_map(|atom| self.atoms.by_atom.get(&atom).copied())
            .collect())
    }

    /// First non-blank text in the best available encoding.
    fn read_text(&mut self, offered: &[Target]) -> Result<Option<String>> {
        for target in text_targets(offered) {
            let Some(bytes) = self.read_target(target)? else {
                continue;
            };
            if bytes.len() > MAX_TEXT_BYTES {
                log::info!("skipping {} MiB of text", bytes.len() / (1024 * 1024));
                return Ok(None);
            }
            let text = match target {
                Target::String => decode_latin1(&bytes),
                _ => String::from_utf8_lossy(&bytes).into_owned(),
            };
            let text = text.trim_end_matches('\0').to_string();
            if !text.trim().is_empty() {
                return Ok(Some(text));
            }
        }
        Ok(None)
    }

    fn read_target(&mut self, target: Target) -> Result<Option<Vec<u8>>> {
        let atom = self.atoms.atom(target);
        self.read_atom(atom)
    }

    /// Converts the clipboard to `target` and returns the bytes, or `None`
    /// if the owner refused.
    fn read_atom(&mut self, target: Atom) -> Result<Option<Vec<u8>>> {
        let (window, transfer) = (self.window, self.atoms.transfer);
        self.conn.delete_property(window, transfer)?;
        self.conn.convert_selection(
            window,
            self.atoms.clipboard,
            target,
            transfer,
            CURRENT_TIME,
        )?;
        self.conn.flush()?;

        let property = self.wait_for(|event| match event {
            Event::SelectionNotify(ev) if ev.requestor == window && ev.target == target => {
                Some(ev.property)
            }
            _ => None,
        })?;
        if property == NONE {
            return Ok(None);
        }

        let (kind, data) = self.read_property()?;
        if kind == self.atoms.incr {
            return self.read_incr().map(Some);
        }
        Ok(Some(data))
    }

    /// Reads and deletes the transfer property; returns its type and bytes.
    fn read_property(&mut self) -> Result<(Atom, Vec<u8>)> {
        let mut data = Vec::new();
        let mut offset = 0;
        loop {
            let reply = self
                .conn
                .get_property(
                    false,
                    self.window,
                    self.atoms.transfer,
                    AtomEnum::ANY,
                    offset,
                    PROPERTY_CHUNK,
                )?
                .reply()?;
            data.extend_from_slice(&reply.value);
            if data.len() > MAX_TRANSFER_BYTES {
                return Err("clipboard content too large".into());
            }
            if reply.bytes_after == 0 {
                // Deleting the property is also what asks an INCR owner for
                // the first chunk.
                self.conn
                    .delete_property(self.window, self.atoms.transfer)?;
                self.conn.flush()?;
                return Ok((reply.type_, data));
            }
            offset += reply.value.len() as u32 / 4;
        }
    }

    /// Receives an INCR transfer: each chunk arrives as a new value of the
    /// transfer property; a zero-length chunk ends it.
    fn read_incr(&mut self) -> Result<Vec<u8>> {
        let (window, transfer) = (self.window, self.atoms.transfer);
        let mut data = Vec::new();
        loop {
            self.wait_for(|event| match event {
                Event::PropertyNotify(ev)
                    if ev.window == window
                        && ev.atom == transfer
                        && ev.state == Property::NEW_VALUE =>
                {
                    Some(())
                }
                _ => None,
            })?;
            let (_, chunk) = self.read_property()?;
            if chunk.is_empty() {
                return Ok(data);
            }
            data.extend_from_slice(&chunk);
            if data.len() > MAX_TRANSFER_BYTES {
                return Err("clipboard content too large".into());
            }
        }
    }

    /// Processes events until `matches` accepts one or the owner times out.
    /// Clipboard changes seen meanwhile are remembered in `pending`.
    fn wait_for<T>(&mut self, mut matches: impl FnMut(&Event) -> Option<T>) -> Result<T> {
        let deadline = Instant::now() + REPLY_TIMEOUT;
        loop {
            while let Some(event) = self.conn.poll_for_event()? {
                if self.handle_event(&event) {
                    continue;
                }
                if let Some(value) = matches(&event) {
                    return Ok(value);
                }
            }
            if Instant::now() >= deadline {
                return Err("clipboard owner did not respond".into());
            }
            thread::sleep(Duration::from_millis(1));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn secrets_are_detected() {
        assert!(is_secret(&[Target::Utf8String, Target::PasswordHint]));
        assert!(!is_secret(&[Target::Utf8String]));
    }

    #[test]
    fn files_win_over_text() {
        let thunar = [
            Target::GnomeCopiedFiles,
            Target::UriList,
            Target::Utf8String,
        ];
        assert_eq!(file_target(&thunar), Some(Target::UriList));
        assert_eq!(
            file_target(&[Target::GnomeCopiedFiles]),
            Some(Target::GnomeCopiedFiles)
        );
        assert_eq!(file_target(&[Target::Utf8String]), None);
    }

    #[test]
    fn prefers_png_images() {
        let browser = [Target::Html, Target::Jpeg, Target::Png, Target::Bmp];
        assert_eq!(image_target(&browser), Some(Target::Png));
        assert_eq!(image_target(&[Target::Bmp]), Some(Target::Bmp));
        assert_eq!(image_target(&[Target::Utf8String]), None);
    }

    #[test]
    fn orders_text_encodings() {
        let offered = [Target::Text, Target::String, Target::Utf8String];
        assert_eq!(
            text_targets(&offered),
            vec![Target::Utf8String, Target::String, Target::Text]
        );
    }

    #[test]
    fn every_target_has_a_name() {
        for (target, name) in TARGET_NAMES {
            assert_eq!(target.mime(), *name);
        }
    }
}
