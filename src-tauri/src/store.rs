//! Clipboard history persistence: SQLite for metadata, plain files under
//! `blobs/<hash>/` for images and file snapshots.

use std::fmt;
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::types::Value;
use rusqlite::{params, params_from_iter, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::locate::Identity;
use crate::model::{
    classify_files, classify_text, file_name, image_extension, png_dimensions, Captured, Category,
    FileEntry, Item, ItemKind, SnapshotStatus,
};
use crate::settings::Settings;

const DB_FILE: &str = "clipvault.db";
const BLOBS_DIR: &str = "blobs";
const SCHEMA_VERSION: i32 = 2;
const MAX_TAG_LEN: usize = 64;

#[derive(Debug)]
pub enum StoreError {
    Db(rusqlite::Error),
    Io(io::Error),
    NotFound(i64),
    InvalidTag,
}

impl fmt::Display for StoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            StoreError::Db(err) => write!(f, "database error: {err}"),
            StoreError::Io(err) => write!(f, "file error: {err}"),
            StoreError::NotFound(id) => write!(f, "item {id} not found"),
            StoreError::InvalidTag => write!(f, "tags must be 1-{MAX_TAG_LEN} characters"),
        }
    }
}

impl std::error::Error for StoreError {}

impl From<rusqlite::Error> for StoreError {
    fn from(err: rusqlite::Error) -> Self {
        StoreError::Db(err)
    }
}

impl From<io::Error> for StoreError {
    fn from(err: io::Error) -> Self {
        StoreError::Io(err)
    }
}

pub type Result<T> = std::result::Result<T, StoreError>;

/// Result of [`Store::insert`].
#[derive(Debug)]
pub struct Inserted {
    pub item: Item,
    /// `false` when the content was already stored and only moved to the top.
    pub is_new: bool,
    /// Items removed to respect `max_items`.
    pub pruned: Vec<i64>,
    /// Files are waiting to be copied by [`Store::process_snapshots`].
    pub snapshot_pending: bool,
}

/// History order, matching `SortOption` in the UI.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Sort {
    #[default]
    DateDesc,
    DateAsc,
    NameAsc,
    NameDesc,
}

impl Sort {
    fn order_by(self) -> &'static str {
        match self {
            Sort::DateDesc => "last_used_at DESC, id DESC",
            Sort::DateAsc => "last_used_at ASC, id ASC",
            Sort::NameAsc => "content COLLATE NOCASE ASC, id ASC",
            Sort::NameDesc => "content COLLATE NOCASE DESC, id DESC",
        }
    }
}

/// Filters and paging for [`Store::query`].
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Query {
    /// Matches content (including file paths) and tags, case-insensitively
    /// for ASCII.
    pub search: String,
    pub category: Option<Category>,
    pub favorites_only: bool,
    pub sort: Sort,
    /// Page size; 0 means [`Query::DEFAULT_LIMIT`].
    pub limit: u32,
    pub offset: u32,
}

impl Query {
    pub const DEFAULT_LIMIT: u32 = 100;
    pub const MAX_LIMIT: u32 = 1000;
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Page {
    pub items: Vec<Item>,
    /// Matching items across all pages.
    pub total: u64,
}

/// Number of items per category, for the sidebar.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct Counts {
    pub all: u64,
    pub text: u64,
    pub link: u64,
    pub image: u64,
    pub file: u64,
    pub folder: u64,
}

/// A complete item with paths relative to the data directory: the unit of
/// backups. Mirrors the `items`, `item_files` and `item_tags` rows.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemRecord {
    pub hash: String,
    pub kind: ItemKind,
    pub category: Category,
    pub content: String,
    pub html: Option<String>,
    pub mime: Option<String>,
    /// Image file, `blobs/<hash>/...`.
    pub blob: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub size: Option<u64>,
    pub is_favorite: bool,
    pub created_at: i64,
    pub last_used_at: i64,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub files: Vec<FileRecord>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileRecord {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub size: Option<u64>,
    /// Vault copy, `blobs/<hash>/...`.
    pub snapshot: Option<String>,
    pub status: SnapshotStatus,
}

/// Result of [`Store::import`].
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportStats {
    /// Items that were not in the history yet.
    pub added: usize,
    /// Items already present; tags and favorites were combined.
    pub merged: usize,
    /// Malformed records that were ignored.
    pub skipped: usize,
    /// Oldest items removed afterwards to respect `max_items`.
    pub pruned: usize,
}

pub struct Store {
    conn: Mutex<Connection>,
    data_dir: PathBuf,
}

impl Store {
    pub fn open(data_dir: &Path) -> Result<Self> {
        fs::create_dir_all(data_dir.join(BLOBS_DIR))?;
        let conn = Connection::open(data_dir.join(DB_FILE))?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        // Safe with WAL (a crash can lose the latest commits, never corrupt
        // the database) and avoids waiting for the disk on every capture.
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        conn.pragma_update(None, "foreign_keys", true)?;
        migrate(&conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
            data_dir: data_dir.to_path_buf(),
        })
    }

    fn conn(&self) -> MutexGuard<'_, Connection> {
        // A panic while holding the lock cannot leave SQLite inconsistent
        // (statements are transactional), so recover from poisoning.
        self.conn.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Stores captured content, or moves it to the top if it already exists.
    pub fn insert(&self, captured: Captured, settings: &Settings) -> Result<Inserted> {
        let hash = captured.hash();

        {
            let conn = self.conn();
            let existing: Option<i64> = conn
                .query_row("SELECT id FROM items WHERE hash = ?1", [&hash], |r| {
                    r.get(0)
                })
                .optional()?;
            if let Some(id) = existing {
                conn.execute(
                    "UPDATE items SET last_used_at = ?1 WHERE id = ?2",
                    params![next_timestamp(&conn)?, id],
                )?;
                let item = self.load(&conn, id)?.ok_or(StoreError::NotFound(id))?;
                return Ok(Inserted {
                    item,
                    is_new: false,
                    pruned: Vec::new(),
                    snapshot_pending: false,
                });
            }
        }

        // Write blobs without holding the lock: snapshots can take a while and
        // the capture thread is the only writer of new items.
        let blob_dir = self.data_dir.join(BLOBS_DIR).join(&hash);
        if blob_dir.exists() {
            fs::remove_dir_all(&blob_dir)?; // leftover from an interrupted insert
        }
        let row = match self.prepare_row(captured, &hash, &blob_dir, settings) {
            Ok(row) => row,
            Err(err) => {
                let _ = fs::remove_dir_all(&blob_dir);
                return Err(err);
            }
        };

        let mut conn = self.conn();
        let result = (|| {
            let tx = conn.transaction()?;
            let now = next_timestamp(&tx)?;
            tx.execute(
                "INSERT INTO items (hash, kind, category, content, html, mime, blob, width, height,
                                    size, created_at, last_used_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)",
                params![
                    hash,
                    row.kind.as_str(),
                    row.category.as_str(),
                    row.content,
                    row.html,
                    row.mime,
                    row.blob,
                    row.width,
                    row.height,
                    row.size.map(|s| s as i64),
                    now,
                ],
            )?;
            let id = tx.last_insert_rowid();
            for (position, file) in row.files.iter().enumerate() {
                tx.execute(
                    "INSERT INTO item_files (item_id, position, path, name, is_dir, size, snapshot,
                                             status, dev, ino)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                    params![
                        id,
                        position as i64,
                        file.path,
                        file.name,
                        file.is_dir,
                        file.size.map(|s| s as i64),
                        file.snapshot,
                        file.status.as_str(),
                        file.identity.map(|(dev, _)| dev as i64),
                        file.identity.map(|(_, ino)| ino as i64),
                    ],
                )?;
            }
            tx.commit()?;
            Ok::<_, StoreError>(id)
        })();
        let id = match result {
            Ok(id) => id,
            Err(err) => {
                let _ = fs::remove_dir_all(&blob_dir);
                return Err(err);
            }
        };

        let pruned = self.prune_locked(&conn, settings.max_items)?;
        let item = self.load(&conn, id)?.ok_or(StoreError::NotFound(id))?;
        let snapshot_pending = item
            .files
            .iter()
            .any(|f| f.status == SnapshotStatus::Pending);
        Ok(Inserted {
            item,
            is_new: true,
            pruned,
            snapshot_pending,
        })
    }

    fn prepare_row(
        &self,
        captured: Captured,
        hash: &str,
        blob_dir: &Path,
        settings: &Settings,
    ) -> Result<NewRow> {
        let kind = captured.kind();
        Ok(match captured {
            Captured::Text { text, html } => NewRow {
                kind,
                category: classify_text(&text),
                size: Some(text.len() as u64),
                content: text,
                html,
                ..NewRow::empty(kind)
            },
            Captured::Image { bytes, mime } => {
                fs::create_dir_all(blob_dir)?;
                let file = format!("image.{}", image_extension(&mime));
                fs::write(blob_dir.join(&file), &bytes)?;
                let dims = png_dimensions(&bytes);
                let content = match dims {
                    Some((w, h)) => format!("Image {w}×{h}"),
                    None => "Image".to_string(),
                };
                NewRow {
                    kind,
                    category: Category::Image,
                    content,
                    mime: Some(mime),
                    blob: Some(format!("{BLOBS_DIR}/{hash}/{file}")),
                    width: dims.map(|d| d.0),
                    height: dims.map(|d| d.1),
                    size: Some(bytes.len() as u64),
                    ..NewRow::empty(kind)
                }
            }
            Captured::Files { paths } => {
                let files = measure_files(&paths, settings.snapshot_limit_bytes());
                let size = files.iter().map(|f| f.size).sum::<Option<u64>>();
                NewRow {
                    kind,
                    category: classify_files(&paths),
                    content: paths
                        .iter()
                        .map(|p| p.to_string_lossy())
                        .collect::<Vec<_>>()
                        .join("\n"),
                    size,
                    files,
                    ..NewRow::empty(kind)
                }
            }
        })
    }

    /// Most recently used first.
    pub fn list(&self, limit: u32, offset: u32) -> Result<Vec<Item>> {
        Ok(self
            .query(&Query {
                limit,
                offset,
                ..Query::default()
            })?
            .items)
    }

    pub fn query(&self, query: &Query) -> Result<Page> {
        let mut conditions = Vec::new();
        let mut args = Vec::new();
        let search = query.search.trim();
        if !search.is_empty() {
            let pattern = format!("%{}%", escape_like(search));
            conditions.push(
                "(content LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM item_tags t \
                 WHERE t.item_id = items.id AND t.tag LIKE ? ESCAPE '\\'))",
            );
            args.push(Value::Text(pattern.clone()));
            args.push(Value::Text(pattern));
        }
        if let Some(category) = query.category {
            conditions.push("category = ?");
            args.push(Value::Text(category.as_str().to_string()));
        }
        if query.favorites_only {
            conditions.push("is_favorite = 1");
        }
        let filter = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        let conn = self.conn();
        let total: i64 = conn.query_row(
            &format!("SELECT COUNT(*) FROM items {filter}"),
            params_from_iter(args.iter()),
            |r| r.get(0),
        )?;

        let limit = match query.limit {
            0 => Query::DEFAULT_LIMIT,
            n => n.min(Query::MAX_LIMIT),
        };
        args.push(Value::Integer(limit.into()));
        args.push(Value::Integer(query.offset.into()));
        let ids = {
            let mut stmt = conn.prepare(&format!(
                "SELECT id FROM items {filter} ORDER BY {} LIMIT ? OFFSET ?",
                query.sort.order_by()
            ))?;
            let ids = stmt
                .query_map(params_from_iter(args.iter()), |r| r.get::<_, i64>(0))?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            ids
        };
        let items = ids
            .into_iter()
            .filter_map(|id| self.load(&conn, id).transpose())
            .collect::<Result<_>>()?;
        Ok(Page {
            items,
            total: total as u64,
        })
    }

    pub fn counts(&self) -> Result<Counts> {
        let conn = self.conn();
        let mut stmt = conn.prepare("SELECT category, COUNT(*) FROM items GROUP BY category")?;
        let mut counts = Counts::default();
        let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))?;
        for row in rows {
            let (category, n) = row?;
            let n = n as u64;
            counts.all += n;
            match Category::parse(&category) {
                Some(Category::Text) => counts.text += n,
                Some(Category::Link) => counts.link += n,
                Some(Category::Image) => counts.image += n,
                Some(Category::File) => counts.file += n,
                Some(Category::Folder) => counts.folder += n,
                None => {}
            }
        }
        Ok(counts)
    }

    /// Moves an item to the top, as when it is copied again.
    pub fn touch(&self, id: i64) -> Result<Item> {
        let conn = self.conn();
        conn.execute(
            "UPDATE items SET last_used_at = ?1 WHERE id = ?2",
            params![next_timestamp(&conn)?, id],
        )?;
        self.load(&conn, id)?.ok_or(StoreError::NotFound(id))
    }

    pub fn get(&self, id: i64) -> Result<Option<Item>> {
        let conn = self.conn();
        self.load(&conn, id)
    }

    pub fn count(&self) -> Result<u64> {
        let n: i64 = self
            .conn()
            .query_row("SELECT COUNT(*) FROM items", [], |r| r.get(0))?;
        Ok(n as u64)
    }

    pub fn delete(&self, id: i64) -> Result<()> {
        let conn = self.conn();
        let hash: String = conn
            .query_row("SELECT hash FROM items WHERE id = ?1", [id], |r| r.get(0))
            .optional()?
            .ok_or(StoreError::NotFound(id))?;
        conn.execute("DELETE FROM items WHERE id = ?1", [id])?;
        self.remove_blobs(&hash);
        Ok(())
    }

    pub fn set_favorite(&self, id: i64, favorite: bool) -> Result<Item> {
        let conn = self.conn();
        conn.execute(
            "UPDATE items SET is_favorite = ?1 WHERE id = ?2",
            params![favorite, id],
        )?;
        self.load(&conn, id)?.ok_or(StoreError::NotFound(id))
    }

    pub fn add_tag(&self, id: i64, tag: &str) -> Result<Item> {
        let tag = tag.trim();
        if tag.is_empty() || tag.chars().count() > MAX_TAG_LEN {
            return Err(StoreError::InvalidTag);
        }
        let conn = self.conn();
        if self.load(&conn, id)?.is_none() {
            return Err(StoreError::NotFound(id));
        }
        conn.execute(
            "INSERT OR IGNORE INTO item_tags (item_id, tag) VALUES (?1, ?2)",
            params![id, tag],
        )?;
        self.load(&conn, id)?.ok_or(StoreError::NotFound(id))
    }

    pub fn remove_tag(&self, id: i64, tag: &str) -> Result<Item> {
        let conn = self.conn();
        conn.execute(
            "DELETE FROM item_tags WHERE item_id = ?1 AND tag = ?2",
            params![id, tag],
        )?;
        self.load(&conn, id)?.ok_or(StoreError::NotFound(id))
    }

    /// Every item, most recently used first.
    pub fn records(&self) -> Result<Vec<ItemRecord>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, hash, kind, category, content, html, mime, blob, width, height, size,
                    is_favorite, created_at, last_used_at
             FROM items ORDER BY last_used_at DESC, id DESC",
        )?;
        let rows = stmt
            .query_map([], |r| {
                let kind: String = r.get(2)?;
                let category: String = r.get(3)?;
                Ok((
                    r.get::<_, i64>(0)?,
                    ItemRecord {
                        hash: r.get(1)?,
                        kind: ItemKind::parse(&kind).unwrap_or(ItemKind::Text),
                        category: Category::parse(&category).unwrap_or(Category::Text),
                        content: r.get(4)?,
                        html: r.get(5)?,
                        mime: r.get(6)?,
                        blob: r.get(7)?,
                        width: r.get(8)?,
                        height: r.get(9)?,
                        size: r.get::<_, Option<i64>>(10)?.map(|s| s as u64),
                        is_favorite: r.get(11)?,
                        created_at: r.get(12)?,
                        last_used_at: r.get(13)?,
                        tags: Vec::new(),
                        files: Vec::new(),
                    },
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        let mut files = conn.prepare_cached(
            "SELECT path, name, is_dir, size, snapshot, status FROM item_files
             WHERE item_id = ?1 ORDER BY position",
        )?;
        let mut tags =
            conn.prepare_cached("SELECT tag FROM item_tags WHERE item_id = ?1 ORDER BY rowid")?;
        rows.into_iter()
            .map(|(id, mut record)| {
                record.files = files
                    .query_map([id], |r| {
                        let status: String = r.get(5)?;
                        Ok(FileRecord {
                            path: r.get(0)?,
                            name: r.get(1)?,
                            is_dir: r.get(2)?,
                            size: r.get::<_, Option<i64>>(3)?.map(|s| s as u64),
                            snapshot: r.get(4)?,
                            status: SnapshotStatus::parse(&status)
                                .unwrap_or(SnapshotStatus::Unavailable),
                        })
                    })?
                    .collect::<rusqlite::Result<_>>()?;
                record.tags = tags
                    .query_map([id], |r| r.get(0))?
                    .collect::<rusqlite::Result<_>>()?;
                Ok(record)
            })
            .collect()
    }

    /// Copies every file still waiting for its snapshot. Returns the items
    /// that changed. Slow (it copies files); run it off the UI and capture
    /// threads.
    pub fn process_snapshots(&self) -> Result<Vec<i64>> {
        let pending: Vec<(i64, String, i64, String, String, bool)> = {
            let conn = self.conn();
            let mut stmt = conn.prepare(
                "SELECT f.item_id, i.hash, f.position, f.path, f.name, f.is_dir
                 FROM item_files f JOIN items i ON i.id = f.item_id
                 WHERE f.status = 'pending' ORDER BY f.item_id, f.position",
            )?;
            let rows = stmt
                .query_map([], |r| {
                    Ok((
                        r.get(0)?,
                        r.get(1)?,
                        r.get(2)?,
                        r.get(3)?,
                        r.get(4)?,
                        r.get(5)?,
                    ))
                })?
                .collect::<rusqlite::Result<_>>()?;
            rows
        };

        let mut changed = Vec::new();
        for (item_id, hash, position, path, name, is_dir) in pending {
            let relative = format!("{BLOBS_DIR}/{hash}/{position}/{name}");
            let target = self.data_dir.join(&relative);
            let _ = fs::remove_dir_all(target.parent().unwrap_or(&target));
            let (status, snapshot) = match copy_snapshot(Path::new(&path), is_dir, &target) {
                Ok(()) => (SnapshotStatus::Stored, Some(relative)),
                Err(err) => {
                    log::warn!("cannot snapshot {path}: {err}");
                    let _ = fs::remove_dir_all(target.parent().unwrap_or(&target));
                    (SnapshotStatus::Unavailable, None)
                }
            };
            let conn = self.conn();
            let updated = conn.execute(
                "UPDATE item_files SET status = ?1, snapshot = ?2
                 WHERE item_id = ?3 AND position = ?4 AND status = 'pending'",
                params![status.as_str(), snapshot, item_id, position],
            )?;
            if updated == 0 {
                // Deleted (or pruned) while copying.
                let exists: bool = conn
                    .query_row("SELECT 1 FROM items WHERE hash = ?1", [&hash], |_| Ok(true))
                    .optional()?
                    .unwrap_or(false);
                if !exists {
                    self.remove_blobs(&hash);
                }
            } else if changed.last() != Some(&item_id) {
                changed.push(item_id);
            }
        }
        Ok(changed)
    }

    /// Device, inode and details of a file as it was when copied, to find it
    /// after a move. `None` for imported items or paths that never existed.
    pub fn file_identity(&self, item_id: i64, position: usize) -> Result<Option<Identity>> {
        let conn = self.conn();
        let row = conn
            .query_row(
                "SELECT dev, ino, name, is_dir, size FROM item_files
                 WHERE item_id = ?1 AND position = ?2",
                params![item_id, position as i64],
                |r| {
                    Ok((
                        r.get::<_, Option<i64>>(0)?,
                        r.get::<_, Option<i64>>(1)?,
                        r.get::<_, String>(2)?,
                        r.get::<_, bool>(3)?,
                        r.get::<_, Option<i64>>(4)?,
                    ))
                },
            )
            .optional()?;
        Ok(match row {
            Some((Some(dev), Some(ino), name, is_dir, size)) => Some(Identity {
                dev: dev as u64,
                ino: ino as u64,
                name,
                is_dir,
                size: size.filter(|_| !is_dir).map(|s| s as u64),
            }),
            _ => None,
        })
    }

    /// Records that a file now lives at `new_path` (it was moved).
    pub fn relocate_file(&self, item_id: i64, position: usize, new_path: &Path) -> Result<()> {
        let mut conn = self.conn();
        let tx = conn.transaction()?;
        tx.execute(
            "UPDATE item_files SET path = ?1, name = ?2 WHERE item_id = ?3 AND position = ?4",
            params![
                new_path.to_string_lossy(),
                file_name(new_path),
                item_id,
                position as i64
            ],
        )?;
        // The content lists the paths; keep it (and search) current.
        let paths = {
            let mut stmt =
                tx.prepare("SELECT path FROM item_files WHERE item_id = ?1 ORDER BY position")?;
            let paths = stmt
                .query_map([item_id], |r| r.get::<_, String>(0))?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            paths
        };
        tx.execute(
            "UPDATE items SET content = ?1 WHERE id = ?2",
            params![paths.join("\n"), item_id],
        )?;
        tx.commit()?;
        Ok(())
    }

    /// Where the database and blobs live.
    pub fn data_dir(&self) -> &Path {
        &self.data_dir
    }

    /// Directory holding an item's image or file snapshots.
    pub fn blob_dir(&self, hash: &str) -> PathBuf {
        self.data_dir.join(BLOBS_DIR).join(hash)
    }

    /// Merges `records` into the history. New items take their blobs from
    /// `blobs_src/<hash>/` (moved, not copied); items already present keep
    /// theirs and gain the record's tags and favorite flag. Records with a
    /// malformed hash are skipped, and blob paths outside `blobs/<hash>/`
    /// are dropped.
    pub fn import(
        &self,
        records: Vec<ItemRecord>,
        blobs_src: &Path,
        max_items: u32,
    ) -> Result<ImportStats> {
        let mut stats = ImportStats::default();
        let mut conn = self.conn();
        let tx = conn.transaction()?;
        for mut record in records {
            if !is_valid_hash(&record.hash) {
                stats.skipped += 1;
                continue;
            }
            let hash = record.hash.clone();
            let existing: Option<i64> = tx
                .query_row("SELECT id FROM items WHERE hash = ?1", [&hash], |r| {
                    r.get(0)
                })
                .optional()?;
            let id = match existing {
                Some(id) => {
                    tx.execute(
                        "UPDATE items SET is_favorite = MAX(is_favorite, ?1),
                                          created_at = MIN(created_at, ?2),
                                          last_used_at = MAX(last_used_at, ?3)
                         WHERE id = ?4",
                        params![
                            record.is_favorite,
                            record.created_at,
                            record.last_used_at,
                            id
                        ],
                    )?;
                    // A local copy without its image or snapshots (e.g. the
                    // files were deleted before it was captured here) takes
                    // the backup's.
                    if !self.blob_dir(&hash).exists() {
                        sanitize_record(&mut record);
                        if self.adopt_blobs(&hash, blobs_src)? {
                            tx.execute(
                                "UPDATE items SET blob = COALESCE(blob, ?1) WHERE id = ?2",
                                params![record.blob, id],
                            )?;
                            let mut restored = false;
                            for (position, file) in record.files.iter().enumerate() {
                                if file.snapshot.is_some() {
                                    // The backup saw the files when they still
                                    // existed, so its details are the accurate ones.
                                    restored |= tx.execute(
                                        "UPDATE item_files SET snapshot = ?1, status = ?2,
                                                               is_dir = ?3, size = COALESCE(size, ?4)
                                         WHERE item_id = ?5 AND position = ?6 AND snapshot IS NULL",
                                        params![
                                            file.snapshot,
                                            SnapshotStatus::Stored.as_str(),
                                            file.is_dir,
                                            file.size.map(|s| s as i64),
                                            id,
                                            position as i64
                                        ],
                                    )? > 0;
                                }
                            }
                            if restored {
                                tx.execute(
                                    "UPDATE items SET category = ?1, size = COALESCE(size, ?2)
                                     WHERE id = ?3",
                                    params![
                                        record.category.as_str(),
                                        record.size.map(|s| s as i64),
                                        id
                                    ],
                                )?;
                            }
                        }
                    }
                    stats.merged += 1;
                    id
                }
                None => {
                    sanitize_record(&mut record);
                    self.adopt_blobs(&hash, blobs_src)?;
                    tx.execute(
                        "INSERT INTO items (hash, kind, category, content, html, mime, blob,
                                            width, height, size, is_favorite, created_at,
                                            last_used_at)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                        params![
                            hash,
                            record.kind.as_str(),
                            record.category.as_str(),
                            record.content,
                            record.html,
                            record.mime,
                            record.blob,
                            record.width,
                            record.height,
                            record.size.map(|s| s as i64),
                            record.is_favorite,
                            record.created_at,
                            record.last_used_at,
                        ],
                    )?;
                    let id = tx.last_insert_rowid();
                    for (position, file) in record.files.iter().enumerate() {
                        tx.execute(
                            "INSERT INTO item_files (item_id, position, path, name, is_dir, size,
                                                     snapshot, status)
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                            params![
                                id,
                                position as i64,
                                file.path,
                                file.name,
                                file.is_dir,
                                file.size.map(|s| s as i64),
                                file.snapshot,
                                file.status.as_str(),
                            ],
                        )?;
                    }
                    stats.added += 1;
                    id
                }
            };
            for tag in &record.tags {
                let tag = tag.trim();
                if !tag.is_empty() && tag.chars().count() <= MAX_TAG_LEN {
                    tx.execute(
                        "INSERT OR IGNORE INTO item_tags (item_id, tag) VALUES (?1, ?2)",
                        params![id, tag],
                    )?;
                }
            }
        }
        tx.commit()?;
        stats.pruned = self.prune_locked(&conn, max_items)?.len();
        Ok(stats)
    }

    /// Moves `blobs_src/<hash>/` into the data directory, replacing any
    /// leftover. Returns whether there was anything to move.
    fn adopt_blobs(&self, hash: &str, blobs_src: &Path) -> Result<bool> {
        let src = blobs_src.join(hash);
        if !src.is_dir() {
            return Ok(false);
        }
        let dest = self.blob_dir(hash);
        if dest.exists() {
            fs::remove_dir_all(&dest)?;
        }
        if fs::rename(&src, &dest).is_err() {
            copy_dir(&src, &dest)?;
        }
        Ok(true)
    }

    /// Removes the oldest non-favorite items beyond `max_items`.
    pub fn prune(&self, max_items: u32) -> Result<Vec<i64>> {
        let conn = self.conn();
        self.prune_locked(&conn, max_items)
    }

    fn prune_locked(&self, conn: &Connection, max_items: u32) -> Result<Vec<i64>> {
        let victims = {
            let mut stmt = conn.prepare(
                "SELECT id, hash FROM items WHERE is_favorite = 0
                 ORDER BY last_used_at DESC, id DESC LIMIT -1 OFFSET ?1",
            )?;
            let rows = stmt
                .query_map([max_items], |r| {
                    Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?))
                })?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            rows
        };
        for (id, hash) in &victims {
            conn.execute("DELETE FROM items WHERE id = ?1", [id])?;
            self.remove_blobs(hash);
        }
        Ok(victims.into_iter().map(|(id, _)| id).collect())
    }

    fn remove_blobs(&self, hash: &str) {
        let dir = self.data_dir.join(BLOBS_DIR).join(hash);
        if let Err(err) = fs::remove_dir_all(&dir) {
            if err.kind() != io::ErrorKind::NotFound {
                log::warn!("cannot remove {}: {err}", dir.display());
            }
        }
    }

    fn load(&self, conn: &Connection, id: i64) -> Result<Option<Item>> {
        let item = conn
            .query_row(
                "SELECT kind, category, content, html, mime, blob, width, height, size,
                        is_favorite, created_at, last_used_at
                 FROM items WHERE id = ?1",
                [id],
                |r| {
                    let kind: String = r.get(0)?;
                    let category: String = r.get(1)?;
                    let blob: Option<String> = r.get(5)?;
                    Ok(Item {
                        id,
                        kind: ItemKind::parse(&kind).unwrap_or(ItemKind::Text),
                        category: Category::parse(&category).unwrap_or(Category::Text),
                        content: r.get(2)?,
                        html: r.get(3)?,
                        mime: r.get(4)?,
                        image_path: blob.map(|b| self.absolute(&b)),
                        width: r.get(6)?,
                        height: r.get(7)?,
                        size: r.get::<_, Option<i64>>(8)?.map(|s| s as u64),
                        files: Vec::new(),
                        is_favorite: r.get(9)?,
                        tags: Vec::new(),
                        created_at: r.get(10)?,
                        last_used_at: r.get(11)?,
                    })
                },
            )
            .optional()?;
        let Some(mut item) = item else {
            return Ok(None);
        };

        let mut stmt = conn.prepare_cached(
            "SELECT path, name, is_dir, size, snapshot, status FROM item_files
             WHERE item_id = ?1 ORDER BY position",
        )?;
        item.files = stmt
            .query_map([id], |r| {
                let snapshot: Option<String> = r.get(4)?;
                let status: String = r.get(5)?;
                let path: String = r.get(0)?;
                Ok(FileEntry {
                    exists: Path::new(&path).exists(),
                    path,
                    name: r.get(1)?,
                    is_dir: r.get(2)?,
                    size: r.get::<_, Option<i64>>(3)?.map(|s| s as u64),
                    snapshot_path: snapshot.map(|s| self.absolute(&s)),
                    status: SnapshotStatus::parse(&status).unwrap_or(SnapshotStatus::Unavailable),
                })
            })?
            .collect::<rusqlite::Result<_>>()?;

        let mut stmt =
            conn.prepare_cached("SELECT tag FROM item_tags WHERE item_id = ?1 ORDER BY rowid")?;
        item.tags = stmt
            .query_map([id], |r| r.get(0))?
            .collect::<rusqlite::Result<_>>()?;

        Ok(Some(item))
    }

    fn absolute(&self, relative: &str) -> String {
        self.data_dir.join(relative).to_string_lossy().into_owned()
    }
}

/// Column values for a new `items` row and its files.
struct NewRow {
    kind: ItemKind,
    category: Category,
    content: String,
    html: Option<String>,
    mime: Option<String>,
    blob: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    size: Option<u64>,
    files: Vec<FileRow>,
}

impl NewRow {
    fn empty(kind: ItemKind) -> Self {
        Self {
            kind,
            category: Category::Text,
            content: String::new(),
            html: None,
            mime: None,
            blob: None,
            width: None,
            height: None,
            size: None,
            files: Vec::new(),
        }
    }
}

struct FileRow {
    path: String,
    name: String,
    is_dir: bool,
    size: Option<u64>,
    /// Path relative to the data directory.
    snapshot: Option<String>,
    status: SnapshotStatus,
    /// Device and inode when copied, to find the file after it is moved.
    identity: Option<(u64, u64)>,
}

/// Describes copied paths: sizes, identity, and whether they will be copied
/// into the vault (`Pending`) — only when their combined size is within
/// `limit` bytes — or kept as paths only.
fn measure_files(paths: &[PathBuf], limit: u64) -> Vec<FileRow> {
    use std::os::unix::fs::MetadataExt;

    let mut over_limit = limit == 0;
    let mut remaining = limit;
    let mut rows: Vec<FileRow> = paths
        .iter()
        .map(|path| {
            let mut row = FileRow {
                path: path.to_string_lossy().into_owned(),
                name: file_name(path),
                is_dir: false,
                size: None,
                snapshot: None,
                status: SnapshotStatus::Pending,
                identity: None,
            };
            match fs::metadata(path) {
                Err(_) => row.status = SnapshotStatus::Unavailable,
                Ok(meta) => {
                    row.identity = Some((meta.dev(), meta.ino()));
                    if meta.is_dir() {
                        row.is_dir = true;
                        if !over_limit {
                            match dir_size(path, remaining) {
                                Some(size) => {
                                    remaining -= size;
                                    row.size = Some(size);
                                }
                                None => over_limit = true,
                            }
                        }
                    } else {
                        row.size = Some(meta.len());
                        if meta.len() > remaining {
                            over_limit = true;
                        } else {
                            remaining -= meta.len();
                        }
                    }
                }
            }
            row
        })
        .collect();
    if over_limit {
        for row in &mut rows {
            if row.status == SnapshotStatus::Pending {
                row.status = SnapshotStatus::TooLarge;
            }
        }
    }
    rows
}

/// Copies a file or folder to `target` (whose parent is created first).
fn copy_snapshot(source: &Path, is_dir: bool, target: &Path) -> io::Result<()> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    if is_dir {
        copy_dir(source, target)
    } else {
        fs::copy(source, target).map(|_| ())
    }
}

/// Total size of regular files under `dir`, or `None` once it exceeds
/// `budget` or cannot be read. Symlinks are not followed.
fn dir_size(dir: &Path, budget: u64) -> Option<u64> {
    let mut total: u64 = 0;
    let mut stack = vec![dir.to_path_buf()];
    while let Some(current) = stack.pop() {
        for entry in fs::read_dir(&current).ok()? {
            let entry = entry.ok()?;
            let meta = entry.metadata().ok()?; // does not follow symlinks
            if meta.is_dir() {
                stack.push(entry.path());
            } else if meta.is_file() {
                total = total.checked_add(meta.len())?;
                if total > budget {
                    return None;
                }
            }
        }
    }
    Some(total)
}

/// Recursively copies regular files and directories; symlinks are skipped.
fn copy_dir(from: &Path, to: &Path) -> io::Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let meta = entry.metadata()?;
        let target = to.join(entry.file_name());
        if meta.is_dir() {
            copy_dir(&entry.path(), &target)?;
        } else if meta.is_file() {
            fs::copy(entry.path(), &target)?;
        }
    }
    Ok(())
}

fn migrate(conn: &Connection) -> Result<()> {
    let version: i32 = conn.pragma_query_value(None, "user_version", |r| r.get(0))?;
    if version < 1 {
        conn.execute_batch(
            "BEGIN;
             CREATE TABLE items (
                 id           INTEGER PRIMARY KEY,
                 hash         TEXT    NOT NULL UNIQUE,
                 kind         TEXT    NOT NULL,
                 category     TEXT    NOT NULL,
                 content      TEXT    NOT NULL,
                 html         TEXT,
                 mime         TEXT,
                 blob         TEXT,
                 width        INTEGER,
                 height       INTEGER,
                 size         INTEGER,
                 is_favorite  INTEGER NOT NULL DEFAULT 0,
                 created_at   INTEGER NOT NULL,
                 last_used_at INTEGER NOT NULL
             );
             CREATE INDEX items_last_used ON items (last_used_at DESC, id DESC);
             CREATE TABLE item_files (
                 item_id  INTEGER NOT NULL REFERENCES items (id) ON DELETE CASCADE,
                 position INTEGER NOT NULL,
                 path     TEXT    NOT NULL,
                 name     TEXT    NOT NULL,
                 is_dir   INTEGER NOT NULL,
                 size     INTEGER,
                 snapshot TEXT,
                 status   TEXT    NOT NULL,
                 PRIMARY KEY (item_id, position)
             );
             CREATE TABLE item_tags (
                 item_id INTEGER NOT NULL REFERENCES items (id) ON DELETE CASCADE,
                 tag     TEXT    NOT NULL,
                 PRIMARY KEY (item_id, tag)
             );
             COMMIT;",
        )?;
    }
    if version < 2 {
        // v2: file identity (device + inode) to find moved files, and image
        // files copied in a file manager count as images.
        let image_names = crate::model::IMAGE_EXTENSIONS
            .iter()
            .map(|(ext, _)| format!("lower(f.name) LIKE '%.{ext}'"))
            .collect::<Vec<_>>()
            .join(" OR ");
        conn.execute_batch(&format!(
            "BEGIN;
             ALTER TABLE item_files ADD COLUMN dev INTEGER;
             ALTER TABLE item_files ADD COLUMN ino INTEGER;
             UPDATE items SET category = 'image'
             WHERE kind = 'files'
               AND EXISTS (SELECT 1 FROM item_files f WHERE f.item_id = items.id)
               AND NOT EXISTS (
                   SELECT 1 FROM item_files f
                   WHERE f.item_id = items.id AND (f.is_dir = 1 OR NOT ({image_names}))
               );
             COMMIT;"
        ))?;
    }
    conn.pragma_update(None, "user_version", SCHEMA_VERSION)?;
    Ok(())
}

/// Item hashes are lowercase hex SHA-256; they name blob directories, so
/// anything else is rejected.
pub fn is_valid_hash(hash: &str) -> bool {
    hash.len() == 64 && hash.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

/// Drops a record's blob paths that point outside its `blobs/<hash>/`.
fn sanitize_record(record: &mut ItemRecord) {
    record.blob = sanitize_blob_path(&record.hash, record.blob.take());
    for file in &mut record.files {
        file.snapshot = sanitize_blob_path(&record.hash, file.snapshot.take());
        if file.snapshot.is_none() && file.status == SnapshotStatus::Stored {
            file.status = SnapshotStatus::Unavailable;
        }
    }
}

/// Keeps `path` only if it points inside `blobs/<hash>/`.
fn sanitize_blob_path(hash: &str, path: Option<String>) -> Option<String> {
    let path = path?;
    let rest = path.strip_prefix(&format!("{BLOBS_DIR}/{hash}/"))?;
    let safe = !rest.is_empty()
        && Path::new(rest)
            .components()
            .all(|c| matches!(c, Component::Normal(_)));
    safe.then_some(path)
}

/// Escapes `%`, `_` and `\\` for a `LIKE ... ESCAPE '\\'` pattern.
fn escape_like(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        if matches!(c, '%' | '_' | '\\') {
            out.push('\\');
        }
        out.push(c);
    }
    out
}

/// Current time in ms, but always later than any stored `last_used_at` so
/// that recency order is strict even within the same millisecond.
fn next_timestamp(conn: &Connection) -> Result<i64> {
    let latest: Option<i64> =
        conn.query_row("SELECT MAX(last_used_at) FROM items", [], |r| r.get(0))?;
    Ok(latest.map_or(now_ms(), |latest| now_ms().max(latest + 1)))
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn text(s: &str) -> Captured {
        Captured::Text {
            text: s.to_string(),
            html: None,
        }
    }

    fn open() -> (tempfile::TempDir, Store) {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::open(dir.path()).unwrap();
        (dir, store)
    }

    #[test]
    fn inserts_and_lists_most_recent_first() {
        let (_dir, store) = open();
        let s = Settings::default();
        store.insert(text("first"), &s).unwrap();
        store.insert(text("https://example.com"), &s).unwrap();

        let items = store.list(10, 0).unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].content, "https://example.com");
        assert_eq!(items[0].category, Category::Link);
        assert_eq!(items[1].content, "first");
        assert_eq!(items[1].size, Some(5));
    }

    #[test]
    fn duplicate_moves_to_top_without_new_row() {
        let (_dir, store) = open();
        let s = Settings::default();
        let first = store.insert(text("a"), &s).unwrap();
        store.insert(text("b"), &s).unwrap();
        let again = store.insert(text("a"), &s).unwrap();

        assert!(!again.is_new);
        assert_eq!(again.item.id, first.item.id);
        assert_eq!(store.count().unwrap(), 2);
        assert_eq!(store.list(10, 0).unwrap()[0].content, "a");
    }

    #[test]
    fn prunes_oldest_but_keeps_favorites() {
        let (_dir, store) = open();
        let s = Settings {
            max_items: 2,
            ..Settings::default()
        };
        let keep = store.insert(text("old favorite"), &s).unwrap().item.id;
        store.set_favorite(keep, true).unwrap();
        let dropped = store.insert(text("old"), &s).unwrap().item.id;
        store.insert(text("mid"), &s).unwrap();
        let last = store.insert(text("new"), &s).unwrap();

        assert_eq!(last.pruned, vec![dropped]);
        let contents: Vec<_> = store
            .list(10, 0)
            .unwrap()
            .into_iter()
            .map(|i| i.content)
            .collect();
        assert_eq!(contents, vec!["new", "mid", "old favorite"]);
    }

    #[test]
    fn stores_images_and_deletes_their_blobs() {
        let (dir, store) = open();
        let mut png = b"\x89PNG\r\n\x1a\n\0\0\0\x0dIHDR".to_vec();
        png.extend_from_slice(&3u32.to_be_bytes());
        png.extend_from_slice(&2u32.to_be_bytes());
        let item = store
            .insert(
                Captured::Image {
                    bytes: png.clone(),
                    mime: "image/png".into(),
                },
                &Settings::default(),
            )
            .unwrap()
            .item;

        assert_eq!(item.category, Category::Image);
        assert_eq!((item.width, item.height), (Some(3), Some(2)));
        assert_eq!(item.content, "Image 3×2");
        let path = PathBuf::from(item.image_path.unwrap());
        assert!(path.starts_with(dir.path()));
        assert_eq!(fs::read(&path).unwrap(), png);

        store.delete(item.id).unwrap();
        assert!(!path.exists());
        assert_eq!(store.count().unwrap(), 0);
    }

    #[test]
    fn snapshots_files_within_limit() {
        let (_dir, store) = open();
        let src = tempfile::tempdir().unwrap();
        let file = src.path().join("notes.txt");
        fs::write(&file, "hello").unwrap();
        let folder = src.path().join("project");
        fs::create_dir_all(folder.join("sub")).unwrap();
        fs::write(folder.join("sub/a.txt"), "abc").unwrap();
        let missing = src.path().join("gone.txt");

        let inserted = store
            .insert(
                Captured::Files {
                    paths: vec![file.clone(), folder.clone(), missing],
                },
                &Settings::default(),
            )
            .unwrap();
        // Stored right away; the copies are made afterwards.
        assert!(inserted.snapshot_pending);
        let statuses: Vec<_> = inserted.item.files.iter().map(|f| f.status).collect();
        assert_eq!(
            statuses,
            vec![
                SnapshotStatus::Pending,
                SnapshotStatus::Pending,
                SnapshotStatus::Unavailable
            ]
        );
        assert_eq!(store.process_snapshots().unwrap(), vec![inserted.item.id]);
        assert!(
            store.process_snapshots().unwrap().is_empty(),
            "nothing left"
        );
        let item = store.get(inserted.item.id).unwrap().unwrap();

        assert_eq!(item.category, Category::File);
        assert_eq!(item.files.len(), 3);
        let [f, d, m] = &item.files[..] else {
            unreachable!()
        };
        assert_eq!(f.status, SnapshotStatus::Stored);
        assert_eq!(f.size, Some(5));
        assert_eq!(
            fs::read_to_string(f.snapshot_path.as_ref().unwrap()).unwrap(),
            "hello"
        );
        assert_eq!(d.status, SnapshotStatus::Stored);
        assert!(d.is_dir);
        assert_eq!(d.size, Some(3));
        let copied = PathBuf::from(d.snapshot_path.as_ref().unwrap()).join("sub/a.txt");
        assert_eq!(fs::read_to_string(copied).unwrap(), "abc");
        assert_eq!(m.status, SnapshotStatus::Unavailable);
        assert_eq!(item.size, None); // unknown because one entry is missing
    }

    #[test]
    fn snapshot_of_deleted_item_is_discarded() {
        let (dir, store) = open();
        let src = tempfile::tempdir().unwrap();
        let file = src.path().join("a.txt");
        fs::write(&file, "a").unwrap();
        let item = store
            .insert(Captured::Files { paths: vec![file] }, &Settings::default())
            .unwrap()
            .item;
        store.delete(item.id).unwrap();
        assert!(store.process_snapshots().unwrap().is_empty());
        let blobs = fs::read_dir(dir.path().join(BLOBS_DIR)).unwrap().count();
        assert_eq!(blobs, 0, "no orphan copies");
    }

    #[test]
    fn skips_snapshots_over_limit() {
        let (_dir, store) = open();
        let src = tempfile::tempdir().unwrap();
        let big = src.path().join("big.bin");
        fs::write(&big, vec![0u8; 2 * 1024 * 1024]).unwrap();
        let s = Settings {
            snapshot_limit_mb: 1,
            ..Settings::default()
        };

        let item = store
            .insert(Captured::Files { paths: vec![big] }, &s)
            .unwrap()
            .item;
        assert_eq!(item.files[0].status, SnapshotStatus::TooLarge);
        assert_eq!(item.files[0].snapshot_path, None);
        assert_eq!(item.size, Some(2 * 1024 * 1024));
    }

    #[test]
    fn folder_category_when_all_paths_are_dirs() {
        let (_dir, store) = open();
        let src = tempfile::tempdir().unwrap();
        let item = store
            .insert(
                Captured::Files {
                    paths: vec![src.path().to_path_buf()],
                },
                &Settings::default(),
            )
            .unwrap()
            .item;
        assert_eq!(item.category, Category::Folder);
    }

    #[test]
    fn manages_tags() {
        let (_dir, store) = open();
        let id = store
            .insert(text("x"), &Settings::default())
            .unwrap()
            .item
            .id;
        store.add_tag(id, " work ").unwrap();
        store.add_tag(id, "work").unwrap();
        let item = store.add_tag(id, "urgent").unwrap();
        assert_eq!(item.tags, vec!["work", "urgent"]);
        assert!(matches!(
            store.add_tag(id, "  "),
            Err(StoreError::InvalidTag)
        ));
        assert_eq!(store.remove_tag(id, "work").unwrap().tags, vec!["urgent"]);
    }

    #[test]
    fn queries_filter_sort_and_page() {
        let (_dir, store) = open();
        let s = Settings::default();
        for t in [
            "banana",
            "Apple pie",
            "https://apple.com",
            "cherry",
            "100%_done",
        ] {
            store.insert(text(t), &s).unwrap();
        }
        let id = store.list(1, 0).unwrap()[0].id; // "100%_done"
        store.add_tag(id, "fruit-salad").unwrap();
        let cherry = store.list(10, 0).unwrap()[1].id;
        store.set_favorite(cherry, true).unwrap();

        let contents = |q: Query| -> (Vec<String>, u64) {
            let page = store.query(&q).unwrap();
            (
                page.items.into_iter().map(|i| i.content).collect(),
                page.total,
            )
        };

        let (found, total) = contents(Query {
            search: "APPLE".into(),
            ..Query::default()
        });
        assert_eq!(found, vec!["https://apple.com", "Apple pie"]);
        assert_eq!(total, 2);

        let (found, _) = contents(Query {
            search: "fruit".into(),
            ..Query::default()
        });
        assert_eq!(found, vec!["100%_done"], "matches tags");

        let (found, _) = contents(Query {
            search: "%_".into(),
            ..Query::default()
        });
        assert_eq!(found, vec!["100%_done"], "LIKE wildcards are literal");

        let (found, _) = contents(Query {
            category: Some(Category::Link),
            ..Query::default()
        });
        assert_eq!(found, vec!["https://apple.com"]);

        let (found, _) = contents(Query {
            favorites_only: true,
            ..Query::default()
        });
        assert_eq!(found, vec!["cherry"]);

        let (found, total) = contents(Query {
            sort: Sort::NameAsc,
            limit: 2,
            offset: 1,
            ..Query::default()
        });
        assert_eq!(found, vec!["Apple pie", "banana"]);
        assert_eq!(total, 5);

        assert_eq!(
            store.counts().unwrap(),
            Counts {
                all: 5,
                text: 4,
                link: 1,
                ..Counts::default()
            }
        );
    }

    #[test]
    fn touch_moves_item_to_top() {
        let (_dir, store) = open();
        let s = Settings::default();
        let first = store.insert(text("first"), &s).unwrap().item.id;
        store.insert(text("second"), &s).unwrap();
        store.touch(first).unwrap();
        assert_eq!(store.list(1, 0).unwrap()[0].id, first);
        assert!(matches!(store.touch(999), Err(StoreError::NotFound(999))));
    }

    #[test]
    fn exports_and_imports_records_with_merge() {
        let s = Settings::default();
        let (src_dir, src) = open();
        let image = src
            .insert(
                Captured::Image {
                    bytes: b"\x89PNG fake".to_vec(),
                    mime: "image/png".into(),
                },
                &s,
            )
            .unwrap()
            .item;
        let shared = src.insert(text("in both"), &s).unwrap().item.id;
        src.add_tag(shared, "from-backup").unwrap();
        src.set_favorite(shared, true).unwrap();
        let records = src.records().unwrap();
        assert_eq!(records.len(), 2);

        let (_dst_dir, dst) = open();
        let local = dst.insert(text("in both"), &s).unwrap().item.id;
        dst.add_tag(local, "local").unwrap();
        dst.insert(text("only here"), &s).unwrap();

        // Blobs come from a directory laid out like the backup's blobs/.
        let staging = tempfile::tempdir().unwrap();
        let hash = records
            .iter()
            .find(|r| r.kind == ItemKind::Image)
            .unwrap()
            .hash
            .clone();
        copy_dir(
            &src_dir.path().join(BLOBS_DIR).join(&hash),
            &staging.path().join(&hash),
        )
        .unwrap();

        let stats = dst.import(records, staging.path(), 1000).unwrap();
        assert_eq!(
            stats,
            ImportStats {
                added: 1,
                merged: 1,
                skipped: 0,
                pruned: 0
            }
        );
        let merged = dst.get(local).unwrap().unwrap();
        assert!(merged.is_favorite);
        assert_eq!(merged.tags, vec!["local", "from-backup"]);

        let imported = dst
            .list(10, 0)
            .unwrap()
            .into_iter()
            .find(|i| i.kind == ItemKind::Image)
            .unwrap();
        assert_eq!(imported.created_at, image.created_at);
        assert_eq!(
            fs::read(imported.image_path.unwrap()).unwrap(),
            b"\x89PNG fake"
        );
        assert_eq!(dst.count().unwrap(), 3);
    }

    #[test]
    fn merge_restores_snapshots_missing_locally() {
        let s = Settings::default();
        let files = tempfile::tempdir().unwrap();
        let doc = files.path().join("docs");
        fs::create_dir(&doc).unwrap();
        fs::write(doc.join("a.txt"), "precious").unwrap();

        let (src_dir, src) = open();
        src.insert(
            Captured::Files {
                paths: vec![doc.clone()],
            },
            &s,
        )
        .unwrap();
        src.process_snapshots().unwrap();
        let records = src.records().unwrap();
        let hash = records[0].hash.clone();

        // The folder is gone by the time it is copied on the other machine.
        fs::remove_dir_all(&doc).unwrap();
        let (_dst_dir, dst) = open();
        let local = dst
            .insert(
                Captured::Files {
                    paths: vec![doc.clone()],
                },
                &s,
            )
            .unwrap()
            .item;
        assert_eq!(local.files[0].status, SnapshotStatus::Unavailable);
        assert_eq!(
            local.category,
            Category::File,
            "cannot tell it was a folder"
        );

        let staging = tempfile::tempdir().unwrap();
        copy_dir(
            &src_dir.path().join(BLOBS_DIR).join(&hash),
            &staging.path().join(&hash),
        )
        .unwrap();
        let stats = dst.import(records, staging.path(), 1000).unwrap();
        assert_eq!((stats.added, stats.merged), (0, 1));

        let restored = dst.get(local.id).unwrap().unwrap();
        assert_eq!(restored.files[0].status, SnapshotStatus::Stored);
        assert!(restored.files[0].is_dir);
        assert_eq!(restored.category, Category::Folder);
        let snapshot = PathBuf::from(restored.files[0].snapshot_path.as_ref().unwrap());
        assert_eq!(
            fs::read_to_string(snapshot.join("a.txt")).unwrap(),
            "precious"
        );
    }

    #[test]
    fn import_rejects_unsafe_records() {
        let (dir, store) = open();
        let good_hash = "a".repeat(64);
        let record = |hash: &str, blob: &str| ItemRecord {
            hash: hash.into(),
            kind: ItemKind::Image,
            category: Category::Image,
            content: "x".into(),
            html: None,
            mime: Some("image/png".into()),
            blob: Some(blob.into()),
            width: None,
            height: None,
            size: None,
            is_favorite: false,
            created_at: 1,
            last_used_at: 1,
            tags: vec![],
            files: vec![],
        };
        let stats = store
            .import(
                vec![
                    record("../../etc", "blobs/../../etc/passwd"),
                    record(
                        &good_hash,
                        &format!("blobs/{good_hash}/../../../escape.png"),
                    ),
                ],
                dir.path(),
                1000,
            )
            .unwrap();
        assert_eq!((stats.added, stats.skipped), (1, 1));
        let item = &store.list(10, 0).unwrap()[0];
        assert_eq!(item.image_path, None, "path escaping blobs/<hash>/ dropped");
    }

    #[test]
    fn uses_wal_without_fsync_per_commit() {
        let (_dir, store) = open();
        let conn = store.conn();
        let mode: String = conn
            .pragma_query_value(None, "journal_mode", |r| r.get(0))
            .unwrap();
        let synchronous: i64 = conn
            .pragma_query_value(None, "synchronous", |r| r.get(0))
            .unwrap();
        assert_eq!((mode.as_str(), synchronous), ("wal", 1)); // 1 = NORMAL
    }

    #[test]
    fn migration_v2_reclassifies_image_files() {
        let dir = tempfile::tempdir().unwrap();
        let src = tempfile::tempdir().unwrap();
        let shot = src.path().join("screenshot.PNG");
        let doc = src.path().join("notes.txt");
        fs::write(&shot, "png").unwrap();
        fs::write(&doc, "txt").unwrap();
        {
            let store = Store::open(dir.path()).unwrap();
            let s = Settings::default();
            store
                .insert(Captured::Files { paths: vec![shot] }, &s)
                .unwrap();
            store
                .insert(Captured::Files { paths: vec![doc] }, &s)
                .unwrap();
            // Rewind to a v0.1.0 database: no identity columns, images as files.
            let conn = store.conn();
            conn.execute_batch(
                "UPDATE items SET category = 'file';
                 ALTER TABLE item_files DROP COLUMN dev;
                 ALTER TABLE item_files DROP COLUMN ino;
                 PRAGMA user_version = 1;",
            )
            .unwrap();
        }
        let store = Store::open(dir.path()).unwrap();
        let categories: Vec<_> = store
            .list(10, 0)
            .unwrap()
            .into_iter()
            .map(|i| (i.files[0].name.clone(), i.category))
            .collect();
        assert_eq!(
            categories,
            vec![
                ("notes.txt".to_string(), Category::File),
                ("screenshot.PNG".to_string(), Category::Image)
            ]
        );
    }

    #[test]
    fn remembers_identity_and_relocates_files() {
        let (_dir, store) = open();
        let src = tempfile::tempdir().unwrap();
        let file = src.path().join("a.txt");
        fs::write(&file, "abc").unwrap();
        let item = store
            .insert(
                Captured::Files {
                    paths: vec![file.clone()],
                },
                &Settings::default(),
            )
            .unwrap()
            .item;
        assert!(item.files[0].exists);

        let identity = store.file_identity(item.id, 0).unwrap().unwrap();
        assert_eq!(identity, crate::locate::identify(&file).unwrap());

        let moved = src.path().join("b.txt");
        fs::rename(&file, &moved).unwrap();
        assert!(!store.get(item.id).unwrap().unwrap().files[0].exists);

        store.relocate_file(item.id, 0, &moved).unwrap();
        let item = store.get(item.id).unwrap().unwrap();
        assert_eq!(item.files[0].path, moved.to_string_lossy());
        assert_eq!(item.files[0].name, "b.txt");
        assert!(item.files[0].exists);
        assert_eq!(item.content, moved.to_string_lossy());
    }

    #[test]
    fn reopening_keeps_history() {
        let dir = tempfile::tempdir().unwrap();
        Store::open(dir.path())
            .unwrap()
            .insert(text("persisted"), &Settings::default())
            .unwrap();
        let items = Store::open(dir.path()).unwrap().list(10, 0).unwrap();
        assert_eq!(items[0].content, "persisted");
    }
}
