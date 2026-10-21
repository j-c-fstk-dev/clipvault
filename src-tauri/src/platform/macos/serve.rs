//! Putting content back on the macOS clipboard.

use std::sync::atomic::Ordering;
use std::sync::Arc;

use objc2::rc::{autoreleasepool, Retained};
use objc2::runtime::ProtocolObject;
use objc2_app_kit::{NSPasteboard, NSPasteboardWriting};
use objc2_foundation::{NSArray, NSData, NSString, NSURL};

use super::capture::{to_png, Result, Shared, HTML, PNG, TEXT};
use crate::model::Outgoing;

/// Puts content on the clipboard from any thread.
#[derive(Clone)]
pub struct ClipboardHandle {
    shared: Arc<Shared>,
}

impl ClipboardHandle {
    pub(crate) fn new(shared: Arc<Shared>) -> Self {
        Self { shared }
    }

    /// Replaces the clipboard content with `out`.
    pub fn set(&self, out: &Outgoing) -> Result<()> {
        let _guard = self.shared.lock();
        autoreleasepool(|_| {
            let pasteboard = NSPasteboard::generalPasteboard();
            pasteboard.clearContents();
            let written = write(&pasteboard, out);
            self.shared
                .own_count
                .store(pasteboard.changeCount(), Ordering::Relaxed);
            if written {
                Ok(())
            } else {
                Err("could not write to the clipboard".into())
            }
        })
    }
}

fn write(pasteboard: &NSPasteboard, out: &Outgoing) -> bool {
    match out {
        Outgoing::Text { text, html } => {
            let written =
                pasteboard.setString_forType(&NSString::from_str(text), &NSString::from_str(TEXT));
            if let Some(html) = html {
                pasteboard.setString_forType(&NSString::from_str(html), &NSString::from_str(HTML));
            }
            written
        }
        Outgoing::Image { bytes, mime } => write_image(pasteboard, bytes, mime),
        Outgoing::Files { paths, image } => {
            // One item with a file URL per file, as Finder does.
            let urls: Vec<Retained<ProtocolObject<dyn NSPasteboardWriting>>> = paths
                .iter()
                .map(|path| {
                    let url = NSURL::fileURLWithPath(&NSString::from_str(&path.to_string_lossy()));
                    ProtocolObject::from_retained(url)
                })
                .collect();
            let written = pasteboard.writeObjects(&NSArray::from_retained_slice(&urls));
            // Also the picture, for apps that take images but not files.
            if let Some((bytes, mime)) = image {
                write_image(pasteboard, bytes, mime);
            }
            written
        }
    }
}

/// Offers the image as PNG, which every Mac app that takes images reads.
fn write_image(pasteboard: &NSPasteboard, bytes: &[u8], mime: &str) -> bool {
    let png = if mime == "image/png" {
        Some(bytes.to_vec())
    } else {
        to_png(&NSData::with_bytes(bytes))
    };
    png.is_some_and(|png| {
        pasteboard.setData_forType(Some(&NSData::from_vec(png)), &NSString::from_str(PNG))
    })
}
