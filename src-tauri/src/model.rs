//! Data types shared by the capture, storage and command layers, plus the
//! pure parsing helpers used to turn raw clipboard bytes into them.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Content read from the system clipboard, before it is stored.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Captured {
    Text { text: String, html: Option<String> },
    Image { bytes: Vec<u8>, mime: String },
    Files { paths: Vec<PathBuf> },
}

impl Captured {
    pub fn kind(&self) -> ItemKind {
        match self {
            Captured::Text { .. } => ItemKind::Text,
            Captured::Image { .. } => ItemKind::Image,
            Captured::Files { .. } => ItemKind::Files,
        }
    }

    /// Stable identity used to detect duplicates. HTML is ignored: the same visible content copied twice is the same item.
    pub fn hash(&self) -> String {
        let mut hasher = Sha256::new();
        hasher.update(self.kind().as_str().as_bytes());
        hasher.update([0]);
        match self {
            Captured::Text { text, .. } => hasher.update(text.as_bytes()),
            Captured::Image { bytes, .. } => hasher.update(bytes),
            Captured::Files { paths } => {
                for path in paths {
                    hasher.update(path.as_os_str().as_encoded_bytes());
                    hasher.update([0]);
                }
            }
        }
        hasher
            .finalize()
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ItemKind {
    Text,
    Image,
    Files,
}

impl ItemKind {
    pub fn as_str(self) -> &'static str {
        match self {
            ItemKind::Text => "text",
            ItemKind::Image => "image",
            ItemKind::Files => "files",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "text" => Some(ItemKind::Text),
            "image" => Some(ItemKind::Image),
            "files" => Some(ItemKind::Files),
            _ => None,
        }
    }
}

/// UI category, matching `ClipboardCategory` in `src/types`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Category {
    Text,
    Link,
    Image,
    File,
    Folder,
}

impl Category {
    pub fn as_str(self) -> &'static str {
        match self {
            Category::Text => "text",
            Category::Link => "link",
            Category::Image => "image",
            Category::File => "file",
            Category::Folder => "folder",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "text" => Some(Category::Text),
            "link" => Some(Category::Link),
            "image" => Some(Category::Image),
            "file" => Some(Category::File),
            "folder" => Some(Category::Folder),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SnapshotStatus {
    /// A copy of the file lives in the vault.
    Stored,
    /// The copied files exceed the snapshot size limit; only the path is kept.
    TooLarge,
    /// The path did not exist or could not be read when it was copied.
    Unavailable,
}

impl SnapshotStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            SnapshotStatus::Stored => "stored",
            SnapshotStatus::TooLarge => "too_large",
            SnapshotStatus::Unavailable => "unavailable",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "stored" => Some(SnapshotStatus::Stored),
            "too_large" => Some(SnapshotStatus::TooLarge),
            "unavailable" => Some(SnapshotStatus::Unavailable),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    /// Original location the file was copied from.
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    /// Size in bytes; `None` for folders too large to measure fully.
    pub size: Option<u64>,
    /// Absolute path of the copy inside the vault, when stored.
    pub snapshot_path: Option<String>,
    pub status: SnapshotStatus,
}

/// A stored clipboard entry as sent to the UI.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: i64,
    pub kind: ItemKind,
    pub category: Category,
    /// Text content, or a human-readable summary for images and files.
    pub content: String,
    pub html: Option<String>,
    pub mime: Option<String>,
    /// Absolute path of the stored image file.
    pub image_path: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub size: Option<u64>,
    pub files: Vec<FileEntry>,
    pub is_favorite: bool,
    pub tags: Vec<String>,
    /// Unix time in milliseconds.
    pub created_at: i64,
    /// Unix time in milliseconds; bumped when the same content is copied again.
    pub last_used_at: i64,
}

/// `link` for a single URL, `text` for anything else.
pub fn classify_text(text: &str) -> Category {
    let trimmed = text.trim();
    if trimmed.is_empty() || trimmed.chars().any(char::is_whitespace) {
        return Category::Text;
    }
    match url::Url::parse(trimmed) {
        Ok(url) if matches!(url.scheme(), "http" | "https" | "ftp") && url.has_host() => {
            Category::Link
        }
        _ => Category::Text,
    }
}

/// `folder` when every copied path is a directory, `file` otherwise.
pub fn classify_files(paths: &[PathBuf]) -> Category {
    if !paths.is_empty() && paths.iter().all(|p| p.is_dir()) {
        Category::Folder
    } else {
        Category::File
    }
}

/// Parses `text/uri-list` (RFC 2483) or `x-special/gnome-copied-files`
/// content into local paths. Non-`file://` URIs are ignored.
pub fn parse_uri_list(data: &str) -> Vec<PathBuf> {
    data.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        // gnome-copied-files starts with an action line ("copy" / "cut").
        .filter(|line| *line != "copy" && *line != "cut")
        .filter_map(|line| url::Url::parse(line).ok())
        .filter(|url| url.scheme() == "file")
        .filter_map(|url| url.to_file_path().ok())
        .collect()
}

/// Decodes ISO-8859-1, the encoding of the X11 `STRING` target.
pub fn decode_latin1(bytes: &[u8]) -> String {
    bytes.iter().map(|&b| b as char).collect()
}

/// Decodes `text/html` clipboard data, which some browsers send as UTF-16
/// with a byte-order mark instead of UTF-8.
pub fn decode_html(bytes: &[u8]) -> String {
    let utf16 = |bytes: &[u8], from: fn([u8; 2]) -> u16| {
        let units: Vec<u16> = bytes.as_chunks::<2>().0.iter().map(|&c| from(c)).collect();
        String::from_utf16_lossy(&units)
    };
    let text = match bytes {
        [0xFF, 0xFE, rest @ ..] => utf16(rest, u16::from_le_bytes),
        [0xFE, 0xFF, rest @ ..] => utf16(rest, u16::from_be_bytes),
        [0xEF, 0xBB, 0xBF, rest @ ..] => String::from_utf8_lossy(rest).into_owned(),
        _ => String::from_utf8_lossy(bytes).into_owned(),
    };
    text.trim_end_matches('\0').to_string()
}

/// Width and height from a PNG header, without decoding the image.
pub fn png_dimensions(bytes: &[u8]) -> Option<(u32, u32)> {
    const SIGNATURE: &[u8] = b"\x89PNG\r\n\x1a\n";
    if bytes.len() < 24 || !bytes.starts_with(SIGNATURE) || &bytes[12..16] != b"IHDR" {
        return None;
    }
    let width = u32::from_be_bytes(bytes[16..20].try_into().ok()?);
    let height = u32::from_be_bytes(bytes[20..24].try_into().ok()?);
    Some((width, height))
}

/// File extension for an image MIME type.
pub fn image_extension(mime: &str) -> &'static str {
    match mime {
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/bmp" => "bmp",
        _ => "bin",
    }
}

/// Display name for a path: its last component, or the full path for `/`.
pub fn file_name(path: &Path) -> String {
    path.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_links_and_text() {
        assert_eq!(classify_text("https://github.com/x/y"), Category::Link);
        assert_eq!(
            classify_text("  http://example.com/a?b=c \n"),
            Category::Link
        );
        assert_eq!(classify_text("ftp://files.example.com"), Category::Link);
        assert_eq!(classify_text("see https://example.com"), Category::Text);
        assert_eq!(classify_text("mailto:a@b.c"), Category::Text);
        assert_eq!(classify_text("file:///etc/hosts"), Category::Text);
        assert_eq!(classify_text("npm install"), Category::Text);
        assert_eq!(classify_text(""), Category::Text);
    }

    #[test]
    fn parses_uri_lists() {
        let list =
            "# comment\r\nfile:///home/me/a%20b.txt\r\nhttps://example.com\r\nfile:///tmp/dir\r\n";
        assert_eq!(
            parse_uri_list(list),
            vec![PathBuf::from("/home/me/a b.txt"), PathBuf::from("/tmp/dir")]
        );
    }

    #[test]
    fn parses_gnome_copied_files() {
        let data = "copy\nfile:///home/me/one.pdf\nfile:///home/me/two.pdf";
        assert_eq!(
            parse_uri_list(data),
            vec![
                PathBuf::from("/home/me/one.pdf"),
                PathBuf::from("/home/me/two.pdf")
            ]
        );
    }

    #[test]
    fn decodes_latin1() {
        assert_eq!(decode_latin1(b"caf\xe9"), "café");
    }

    #[test]
    fn decodes_html_encodings() {
        assert_eq!(decode_html(b"<b>hi</b>\0"), "<b>hi</b>");
        assert_eq!(decode_html(b"\xEF\xBB\xBF<i>x</i>"), "<i>x</i>");
        assert_eq!(decode_html(b"\xFF\xFE<\0p\0>\0"), "<p>");
    }

    #[test]
    fn reads_png_dimensions() {
        let mut header = b"\x89PNG\r\n\x1a\n\0\0\0\x0dIHDR".to_vec();
        header.extend_from_slice(&640u32.to_be_bytes());
        header.extend_from_slice(&480u32.to_be_bytes());
        assert_eq!(png_dimensions(&header), Some((640, 480)));
        assert_eq!(png_dimensions(b"not a png at all, definitely"), None);
    }

    #[test]
    fn hash_ignores_html_but_not_kind() {
        let plain = Captured::Text {
            text: "hi".into(),
            html: None,
        };
        let rich = Captured::Text {
            text: "hi".into(),
            html: Some("<b>hi</b>".into()),
        };
        assert_eq!(plain.hash(), rich.hash());

        let image = Captured::Image {
            bytes: b"hi".to_vec(),
            mime: "image/png".into(),
        };
        assert_ne!(plain.hash(), image.hash());
    }
}
