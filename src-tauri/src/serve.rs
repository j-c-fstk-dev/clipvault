//! Putting content back on the X11 clipboard.
//!
//! ClipVault takes ownership of `CLIPBOARD` and answers `SelectionRequest`s
//! from the app that pastes, on the watcher's connection and thread. Large
//! payloads are sent with the INCR protocol.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use x11rb::connection::{Connection, RequestConnection};
use x11rb::protocol::xproto::{
    Atom, AtomEnum, ChangeWindowAttributesAux, ConnectionExt as _, EventMask, PropMode, Property,
    SelectionNotifyEvent, SelectionRequestEvent, Window, SELECTION_NOTIFY_EVENT,
};
use x11rb::protocol::Event;
use x11rb::rust_connection::RustConnection;
use x11rb::wrapper::ConnectionExt as _;
use x11rb::{CURRENT_TIME, NONE};

use crate::capture::{Atoms, Result, Target};

/// Largest payload sent in one property; bigger ones use INCR.
const MAX_CHUNK: usize = 256 * 1024;
/// INCR transfers whose requestor stops reading are dropped after this.
const INCR_TIMEOUT: Duration = Duration::from_secs(30);

/// Content to put on the clipboard.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Outgoing {
    Text { text: String, html: Option<String> },
    Image { bytes: Vec<u8>, mime: String },
    Files { paths: Vec<PathBuf> },
}

/// The formats offered for `out`, best first.
pub(crate) fn offer_entries(out: &Outgoing) -> Vec<(Target, Vec<u8>)> {
    match out {
        Outgoing::Text { text, html } => {
            let mut entries = vec![
                (Target::Utf8String, text.as_bytes().to_vec()),
                (Target::TextPlainUtf8, text.as_bytes().to_vec()),
            ];
            // STRING and text/plain are Latin-1; only offer them when that
            // cannot mangle the text.
            if text.is_ascii() {
                entries.push((Target::TextPlain, text.as_bytes().to_vec()));
                entries.push((Target::String, text.as_bytes().to_vec()));
            }
            if let Some(html) = html {
                entries.push((Target::Html, html.as_bytes().to_vec()));
            }
            entries
        }
        Outgoing::Image { bytes, mime } => Target::from_mime(mime)
            .map(|target| vec![(target, bytes.clone())])
            .unwrap_or_default(),
        Outgoing::Files { paths } => {
            let uris: Vec<String> = paths
                .iter()
                .filter_map(|p| url::Url::from_file_path(p).ok())
                .map(String::from)
                .collect();
            let uri_list: String = uris.iter().map(|u| format!("{u}\r\n")).collect();
            let gnome = format!("copy\n{}", uris.join("\n"));
            let plain = paths
                .iter()
                .map(|p| p.to_string_lossy())
                .collect::<Vec<_>>()
                .join("\n");
            vec![
                (Target::UriList, uri_list.into_bytes()),
                (Target::GnomeCopiedFiles, gnome.into_bytes()),
                (Target::Utf8String, plain.into_bytes()),
            ]
        }
    }
}

/// What we currently offer, by target atom (also used as the reply type).
#[derive(Clone, Default)]
pub(crate) struct Offer {
    entries: Vec<(Atom, Arc<Vec<u8>>)>,
}

type SharedOffer = Arc<Mutex<Option<Offer>>>;

/// Puts content on the clipboard from any thread.
#[derive(Clone)]
pub struct ClipboardHandle {
    conn: Arc<RustConnection>,
    window: Window,
    atoms: Arc<Atoms>,
    offer: SharedOffer,
}

impl ClipboardHandle {
    pub(crate) fn new(
        conn: Arc<RustConnection>,
        window: Window,
        atoms: Arc<Atoms>,
        offer: SharedOffer,
    ) -> Self {
        Self {
            conn,
            window,
            atoms,
            offer,
        }
    }

    /// Makes ClipVault the clipboard owner, offering `out`.
    pub fn set(&self, out: &Outgoing) -> Result<()> {
        let entries: Vec<_> = offer_entries(out)
            .into_iter()
            .map(|(target, data)| (self.atoms.atom(target), Arc::new(data)))
            .collect();
        if entries.is_empty() {
            return Err("nothing to copy".into());
        }
        *self.offer.lock().unwrap_or_else(|e| e.into_inner()) = Some(Offer { entries });

        let clipboard = self.atoms.clipboard;
        self.conn
            .set_selection_owner(self.window, clipboard, CURRENT_TIME)?;
        let owner = self.conn.get_selection_owner(clipboard)?.reply()?.owner;
        if owner != self.window {
            return Err("could not take ownership of the clipboard".into());
        }
        Ok(())
    }
}

/// An INCR transfer in progress.
struct IncrTransfer {
    requestor: Window,
    property: Atom,
    target: Atom,
    data: Arc<Vec<u8>>,
    offset: usize,
    /// The final zero-length chunk has been written.
    finished: bool,
    last_activity: Instant,
}

/// Answers paste requests for the current [`Offer`].
pub(crate) struct Server {
    offer: SharedOffer,
    transfers: Vec<IncrTransfer>,
    chunk: usize,
}

impl Server {
    pub(crate) fn new(conn: &RustConnection) -> Self {
        Self {
            offer: SharedOffer::default(),
            transfers: Vec::new(),
            chunk: MAX_CHUNK.min(conn.maximum_request_bytes().saturating_sub(1024)),
        }
    }

    pub(crate) fn offer(&self) -> SharedOffer {
        self.offer.clone()
    }

    /// Returns true if the event was consumed.
    pub(crate) fn handle_event(
        &mut self,
        conn: &RustConnection,
        atoms: &Atoms,
        window: Window,
        event: &Event,
    ) -> bool {
        match event {
            Event::SelectionRequest(req) if req.owner == window => {
                if let Err(err) = self.answer(conn, atoms, req) {
                    log::warn!("could not answer paste request: {err}");
                }
                true
            }
            Event::SelectionClear(ev) if ev.selection == atoms.clipboard => {
                *self.offer.lock().unwrap_or_else(|e| e.into_inner()) = None;
                true
            }
            Event::PropertyNotify(ev) if ev.state == Property::DELETE => {
                let Some(index) = self
                    .transfers
                    .iter()
                    .position(|t| t.requestor == ev.window && t.property == ev.atom)
                else {
                    return false;
                };
                if let Err(err) = self.send_next_chunk(conn, index) {
                    log::warn!("clipboard transfer failed: {err}");
                    self.transfers.remove(index);
                }
                true
            }
            _ => false,
        }
    }

    fn answer(
        &mut self,
        conn: &RustConnection,
        atoms: &Atoms,
        req: &SelectionRequestEvent,
    ) -> Result<()> {
        self.transfers
            .retain(|t| !t.finished && t.last_activity.elapsed() < INCR_TIMEOUT);

        // Obsolete clients leave the property empty and expect the target.
        let property = if req.property == NONE {
            req.target
        } else {
            req.property
        };
        let offer = self.offer.lock().unwrap_or_else(|e| e.into_inner()).clone();

        let mut answered = NONE;
        if let (true, Some(offer)) = (req.selection == atoms.clipboard, offer) {
            if req.target == atoms.targets {
                let mut targets = vec![atoms.targets];
                targets.extend(offer.entries.iter().map(|(atom, _)| *atom));
                conn.change_property32(
                    PropMode::REPLACE,
                    req.requestor,
                    property,
                    AtomEnum::ATOM,
                    &targets,
                )?;
                answered = property;
            } else if let Some((target, data)) =
                offer.entries.iter().find(|(atom, _)| *atom == req.target)
            {
                if data.len() <= self.chunk {
                    conn.change_property8(
                        PropMode::REPLACE,
                        req.requestor,
                        property,
                        *target,
                        data,
                    )?;
                } else {
                    // The requestor deletes the property to ask for each chunk.
                    conn.change_window_attributes(
                        req.requestor,
                        &ChangeWindowAttributesAux::new().event_mask(EventMask::PROPERTY_CHANGE),
                    )?;
                    conn.change_property32(
                        PropMode::REPLACE,
                        req.requestor,
                        property,
                        atoms.incr,
                        &[u32::try_from(data.len()).unwrap_or(u32::MAX)],
                    )?;
                    self.transfers.push(IncrTransfer {
                        requestor: req.requestor,
                        property,
                        target: *target,
                        data: data.clone(),
                        offset: 0,
                        finished: false,
                        last_activity: Instant::now(),
                    });
                }
                answered = property;
            }
        }

        let notify = SelectionNotifyEvent {
            response_type: SELECTION_NOTIFY_EVENT,
            sequence: 0,
            time: req.time,
            requestor: req.requestor,
            selection: req.selection,
            target: req.target,
            property: answered,
        };
        conn.send_event(false, req.requestor, EventMask::NO_EVENT, notify)?;
        conn.flush()?;
        Ok(())
    }

    fn send_next_chunk(&mut self, conn: &RustConnection, index: usize) -> Result<()> {
        let transfer = &mut self.transfers[index];
        if transfer.finished {
            self.transfers.remove(index);
            return Ok(());
        }
        let end = (transfer.offset + self.chunk).min(transfer.data.len());
        let chunk = &transfer.data[transfer.offset..end];
        conn.change_property8(
            PropMode::REPLACE,
            transfer.requestor,
            transfer.property,
            transfer.target,
            chunk,
        )?;
        // An empty chunk tells the requestor the transfer is complete.
        transfer.finished = chunk.is_empty();
        transfer.offset = end;
        transfer.last_activity = Instant::now();
        conn.flush()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn targets(out: &Outgoing) -> Vec<Target> {
        offer_entries(out).into_iter().map(|(t, _)| t).collect()
    }

    #[test]
    fn offers_text_encodings() {
        let ascii = Outgoing::Text {
            text: "hi".into(),
            html: Some("<b>hi</b>".into()),
        };
        assert_eq!(
            targets(&ascii),
            vec![
                Target::Utf8String,
                Target::TextPlainUtf8,
                Target::TextPlain,
                Target::String,
                Target::Html
            ]
        );

        let accented = Outgoing::Text {
            text: "olá".into(),
            html: None,
        };
        assert_eq!(
            targets(&accented),
            vec![Target::Utf8String, Target::TextPlainUtf8]
        );
    }

    #[test]
    fn offers_images_by_mime() {
        let png = Outgoing::Image {
            bytes: vec![1, 2, 3],
            mime: "image/png".into(),
        };
        assert_eq!(offer_entries(&png), vec![(Target::Png, vec![1, 2, 3])]);
        let unknown = Outgoing::Image {
            bytes: vec![1],
            mime: "image/x-unknown".into(),
        };
        assert!(offer_entries(&unknown).is_empty());
    }

    #[test]
    fn offers_files_for_file_managers() {
        let files = Outgoing::Files {
            paths: vec![
                PathBuf::from("/home/me/My Docs/a.pdf"),
                PathBuf::from("/tmp"),
            ],
        };
        let entries = offer_entries(&files);
        let text = |i: usize| String::from_utf8(entries[i].1.clone()).unwrap();
        assert_eq!(entries[0].0, Target::UriList);
        assert_eq!(
            text(0),
            "file:///home/me/My%20Docs/a.pdf\r\nfile:///tmp\r\n"
        );
        assert_eq!(entries[1].0, Target::GnomeCopiedFiles);
        assert_eq!(
            text(1),
            "copy\nfile:///home/me/My%20Docs/a.pdf\nfile:///tmp"
        );
        assert_eq!(entries[2].0, Target::Utf8String);
        assert_eq!(text(2), "/home/me/My Docs/a.pdf\n/tmp");
    }
}
