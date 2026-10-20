//! `.zip` backups of the whole history.
//!
//! Layout: `manifest.json` (every [`ItemRecord`]) plus `blobs/<hash>/...`
//! holding images and file snapshots exactly as in the data directory.
//! Importing merges into the current history; nothing is deleted except
//! what the history limit prunes afterwards.

use std::fmt;
use std::fs::{self, File};
use std::io::{self, BufReader, BufWriter, Write};
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use crate::store::{is_valid_hash, ImportStats, ItemRecord, Store, StoreError};

const FORMAT: &str = "clipvault-backup";
const VERSION: u32 = 1;
const MANIFEST: &str = "manifest.json";
const BLOBS_DIR: &str = "blobs";

#[derive(Debug)]
pub enum BackupError {
    Io(io::Error),
    Store(StoreError),
    /// The file is not a ClipVault backup, or is damaged.
    Invalid(String),
}

impl fmt::Display for BackupError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BackupError::Io(err) => write!(f, "{err}"),
            BackupError::Store(err) => write!(f, "{err}"),
            BackupError::Invalid(why) => write!(f, "{why}"),
        }
    }
}

impl std::error::Error for BackupError {}

impl From<io::Error> for BackupError {
    fn from(err: io::Error) -> Self {
        BackupError::Io(err)
    }
}

impl From<StoreError> for BackupError {
    fn from(err: StoreError) -> Self {
        BackupError::Store(err)
    }
}

impl From<zip::result::ZipError> for BackupError {
    fn from(err: zip::result::ZipError) -> Self {
        match err {
            zip::result::ZipError::Io(err) => BackupError::Io(err),
            other => BackupError::Invalid(format!("damaged backup file: {other}")),
        }
    }
}

type Result<T> = std::result::Result<T, BackupError>;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Manifest {
    format: String,
    version: u32,
    app_version: String,
    /// Unix time in milliseconds.
    exported_at: i64,
    items: Vec<ItemRecord>,
}

/// Result of [`export`].
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportStats {
    pub items: usize,
    /// Images and snapshot files included.
    pub files: usize,
    /// Size of the written backup.
    pub bytes: u64,
}

/// Writes the whole history to `dest`. The file appears only once complete.
pub fn export(store: &Store, dest: &Path) -> Result<ExportStats> {
    let partial = dest.with_extension("zip.part");
    let result = write_archive(store, &partial);
    match result {
        Ok(mut stats) => {
            fs::rename(&partial, dest)?;
            stats.bytes = fs::metadata(dest)?.len();
            Ok(stats)
        }
        Err(err) => {
            let _ = fs::remove_file(&partial);
            Err(err)
        }
    }
}

fn write_archive(store: &Store, path: &Path) -> Result<ExportStats> {
    let records = store.records()?;
    let mut stats = ExportStats {
        items: records.len(),
        ..ExportStats::default()
    };
    let mut zip = ZipWriter::new(BufWriter::new(File::create(path)?));
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o644);

    for record in &records {
        let dir = store.blob_dir(&record.hash);
        if dir.is_dir() {
            let prefix = format!("{BLOBS_DIR}/{}", record.hash);
            add_dir(&mut zip, &dir, &prefix, options, &mut stats.files)?;
        }
    }

    let manifest = Manifest {
        format: FORMAT.into(),
        version: VERSION,
        app_version: env!("CARGO_PKG_VERSION").into(),
        exported_at: now_ms(),
        items: records,
    };
    zip.start_file(MANIFEST, options)?;
    serde_json::to_writer_pretty(&mut zip, &manifest).map_err(io::Error::other)?;
    zip.finish()?.flush()?;
    Ok(stats)
}

fn add_dir<W: Write + io::Seek>(
    zip: &mut ZipWriter<W>,
    dir: &Path,
    prefix: &str,
    options: SimpleFileOptions,
    files: &mut usize,
) -> Result<()> {
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        // Pruned while exporting.
        Err(err) if err.kind() == io::ErrorKind::NotFound => return Ok(()),
        Err(err) => return Err(err.into()),
    };
    for entry in entries {
        let entry = entry?;
        let meta = entry.metadata()?;
        let name = format!("{prefix}/{}", entry.file_name().to_string_lossy());
        if meta.is_dir() {
            add_dir(zip, &entry.path(), &name, options, files)?;
        } else if meta.is_file() {
            let mut source = match File::open(entry.path()) {
                Ok(file) => file,
                Err(err) if err.kind() == io::ErrorKind::NotFound => continue,
                Err(err) => return Err(err.into()),
            };
            zip.start_file(name, options.large_file(meta.len() >= u32::MAX as u64))?;
            io::copy(&mut source, zip)?;
            *files += 1;
        }
    }
    Ok(())
}

/// Merges the backup at `src` into the history. Blobs are unpacked into a
/// staging directory under `staging_root` (on the same filesystem as the
/// data directory, so they can be moved into place) and removed afterwards.
pub fn import(
    store: &Store,
    src: &Path,
    staging_root: &Path,
    max_items: u32,
) -> Result<ImportStats> {
    let not_a_backup = || BackupError::Invalid("this file is not a ClipVault backup".into());
    let mut archive =
        ZipArchive::new(BufReader::new(File::open(src)?)).map_err(|_| not_a_backup())?;

    let manifest: Manifest = {
        let entry = archive.by_name(MANIFEST).map_err(|_| not_a_backup())?;
        serde_json::from_reader(entry)
            .map_err(|e| BackupError::Invalid(format!("damaged backup manifest: {e}")))?
    };
    if manifest.format != FORMAT {
        return Err(not_a_backup());
    }
    if manifest.version > VERSION {
        return Err(BackupError::Invalid(format!(
            "this backup was made by a newer ClipVault ({}); please update",
            manifest.app_version
        )));
    }

    let staging = Staging::create(staging_root)?;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index)?;
        if entry.is_dir() {
            continue;
        }
        let Some(target) = entry.enclosed_name().and_then(|name| blob_target(&name)) else {
            continue;
        };
        let out = staging.path.join(target);
        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent)?;
        }
        io::copy(&mut entry, &mut File::create(&out)?)?;
    }

    Ok(store.import(manifest.items, &staging.path, max_items)?)
}

/// `blobs/<hash>/<rest>` → `<hash>/<rest>`, for well-formed entries only.
fn blob_target(name: &Path) -> Option<PathBuf> {
    let mut parts = Vec::new();
    for component in name.components() {
        match component {
            Component::Normal(part) => parts.push(part.to_str()?),
            _ => return None,
        }
    }
    match parts.as_slice() {
        [BLOBS_DIR, hash, rest @ ..] if is_valid_hash(hash) && !rest.is_empty() => {
            Some(std::iter::once(*hash).chain(rest.iter().copied()).collect())
        }
        _ => None,
    }
}

/// A scratch directory removed when dropped.
struct Staging {
    path: PathBuf,
}

impl Staging {
    fn create(root: &Path) -> io::Result<Self> {
        let path = root.join(format!(".import-{}-{}", std::process::id(), now_ms()));
        fs::create_dir_all(&path)?;
        Ok(Self { path })
    }
}

impl Drop for Staging {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

/// `clipvault-backup-YYYY-MM-DD.zip` for the given Unix time in ms (UTC).
pub fn default_file_name(unix_ms: i64) -> String {
    let (year, month, day) = civil_from_days(unix_ms.div_euclid(86_400_000));
    format!("clipvault-backup-{year:04}-{month:02}-{day:02}.zip")
}

/// Days since 1970-01-01 to a proleptic Gregorian date (Howard Hinnant's
/// `civil_from_days`).
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let month = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let year = yoe + era * 400 + i64::from(month <= 2);
    (year, month, day)
}

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Captured, ItemKind, SnapshotStatus};
    use crate::settings::Settings;

    fn text(s: &str) -> Captured {
        Captured::Text {
            text: s.into(),
            html: None,
        }
    }

    #[test]
    fn round_trips_history_with_images_and_snapshots() {
        let settings = Settings::default();
        let src_dir = tempfile::tempdir().unwrap();
        let src = Store::open(src_dir.path()).unwrap();
        src.insert(text("olá backup"), &settings).unwrap();
        src.insert(
            Captured::Image {
                bytes: b"\x89PNG image bytes".to_vec(),
                mime: "image/png".into(),
            },
            &settings,
        )
        .unwrap();
        let files = tempfile::tempdir().unwrap();
        fs::create_dir(files.path().join("Projeto")).unwrap();
        fs::write(files.path().join("Projeto/main.rs"), "fn main() {}").unwrap();
        let folder = src
            .insert(
                Captured::Files {
                    paths: vec![files.path().join("Projeto")],
                },
                &settings,
            )
            .unwrap()
            .item;
        src.add_tag(folder.id, "code").unwrap();
        src.process_snapshots().unwrap();

        let out = tempfile::tempdir().unwrap();
        let zip_path = out.path().join("backup.zip");
        let stats = export(&src, &zip_path).unwrap();
        assert_eq!((stats.items, stats.files), (3, 2));
        assert!(stats.bytes > 0);
        assert!(!out.path().join("backup.zip.part").exists());

        let dst_dir = tempfile::tempdir().unwrap();
        let dst = Store::open(dst_dir.path()).unwrap();
        let imported = import(&dst, &zip_path, dst_dir.path(), 1000).unwrap();
        assert_eq!((imported.added, imported.merged), (3, 0));

        let items = dst.list(10, 0).unwrap();
        let image = items.iter().find(|i| i.kind == ItemKind::Image).unwrap();
        assert_eq!(
            fs::read(image.image_path.as_ref().unwrap()).unwrap(),
            b"\x89PNG image bytes"
        );
        let restored = items.iter().find(|i| i.kind == ItemKind::Files).unwrap();
        assert_eq!(restored.tags, vec!["code"]);
        assert_eq!(restored.files[0].status, SnapshotStatus::Stored);
        let snapshot = PathBuf::from(restored.files[0].snapshot_path.as_ref().unwrap());
        assert!(snapshot.starts_with(dst_dir.path()));
        assert_eq!(
            fs::read_to_string(snapshot.join("main.rs")).unwrap(),
            "fn main() {}"
        );
        // Staging directories are cleaned up.
        let leftovers: Vec<_> = fs::read_dir(dst_dir.path())
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().starts_with(".import-"))
            .collect();
        assert!(leftovers.is_empty());

        // Importing the same backup again only merges.
        let again = import(&dst, &zip_path, dst_dir.path(), 1000).unwrap();
        assert_eq!((again.added, again.merged), (0, 3));
        assert_eq!(dst.count().unwrap(), 3);
    }

    #[test]
    fn rejects_files_that_are_not_backups() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::open(dir.path()).unwrap();

        let not_zip = dir.path().join("notes.zip");
        fs::write(&not_zip, "just text").unwrap();
        let err = import(&store, &not_zip, dir.path(), 10).unwrap_err();
        assert!(err.to_string().contains("not a ClipVault backup"), "{err}");

        let other_zip = dir.path().join("other.zip");
        let mut zip = ZipWriter::new(File::create(&other_zip).unwrap());
        zip.start_file("readme.txt", SimpleFileOptions::default())
            .unwrap();
        zip.write_all(b"hello").unwrap();
        zip.finish().unwrap();
        let err = import(&store, &other_zip, dir.path(), 10).unwrap_err();
        assert!(err.to_string().contains("not a ClipVault backup"), "{err}");

        let newer = dir.path().join("newer.zip");
        let mut zip = ZipWriter::new(File::create(&newer).unwrap());
        zip.start_file(MANIFEST, SimpleFileOptions::default())
            .unwrap();
        zip.write_all(
            br#"{"format":"clipvault-backup","version":99,"appVersion":"9.0.0","exportedAt":0,"items":[]}"#,
        )
        .unwrap();
        zip.finish().unwrap();
        let err = import(&store, &newer, dir.path(), 10).unwrap_err();
        assert!(err.to_string().contains("newer ClipVault"), "{err}");
    }

    #[test]
    fn malicious_entries_cannot_escape_the_data_directory() {
        let root = tempfile::tempdir().unwrap();
        let data = root.path().join("data");
        let store = Store::open(&data).unwrap();
        let hash = "c".repeat(64);
        let evil = root.path().join("evil.zip");
        let mut zip = ZipWriter::new(File::create(&evil).unwrap());
        for name in [
            "../escaped-1.txt".to_string(),
            format!("blobs/{hash}/../../../escaped-2.txt"),
            "/tmp/clipvault-escaped-3.txt".to_string(),
        ] {
            zip.start_file(name, SimpleFileOptions::default()).unwrap();
            zip.write_all(b"pwned").unwrap();
        }
        zip.start_file(MANIFEST, SimpleFileOptions::default())
            .unwrap();
        zip.write_all(br#"{"format":"clipvault-backup","version":1,"appVersion":"0.1.0","exportedAt":0,"items":[]}"#)
            .unwrap();
        zip.finish().unwrap();

        import(&store, &evil, &data, 10).unwrap();
        assert!(!root.path().join("escaped-1.txt").exists());
        assert!(!root.path().join("escaped-2.txt").exists());
        assert!(!data.join("escaped-1.txt").exists());
        assert!(!Path::new("/tmp/clipvault-escaped-3.txt").exists());
    }

    #[test]
    fn only_unpacks_blob_entries() {
        let hash = "b".repeat(64);
        assert_eq!(
            blob_target(Path::new(&format!("blobs/{hash}/0/a.txt"))),
            Some(PathBuf::from(format!("{hash}/0/a.txt")))
        );
        assert_eq!(blob_target(Path::new(&format!("blobs/{hash}"))), None);
        assert_eq!(blob_target(Path::new("blobs/not-a-hash/a.txt")), None);
        assert_eq!(blob_target(Path::new("manifest.json")), None);
        assert_eq!(blob_target(Path::new("../blobs/x")), None);
    }

    #[test]
    fn names_backups_by_date() {
        assert_eq!(default_file_name(0), "clipvault-backup-1970-01-01.zip");
        // 2026-10-20T07:30:00Z
        assert_eq!(
            default_file_name(1_792_481_400_000),
            "clipvault-backup-2026-10-20.zip"
        );
        // 2024-02-29 (leap day)
        assert_eq!(
            default_file_name(1_709_164_800_000),
            "clipvault-backup-2024-02-29.zip"
        );
    }
}
