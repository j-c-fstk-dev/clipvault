//! Finding a file or folder after it was moved (cut and pasted, renamed, or
//! sent to the trash).
//!
//! On the same filesystem a move keeps the inode, so the file is found by
//! `(device, inode)` even under a new name. Directory listings already carry
//! inode numbers, so the walk reads directories only and never opens or
//! stats every file. Moves to another filesystem (e.g. a USB drive) get a
//! new inode; those are matched by name and size instead.

use std::collections::VecDeque;
use std::env;
use std::fs;
use std::os::unix::fs::{DirEntryExt, MetadataExt};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

/// What is known about the file from when it was copied.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Identity {
    pub dev: u64,
    pub ino: u64,
    pub name: String,
    pub is_dir: bool,
    /// Size of a regular file, for the cross-filesystem fallback.
    pub size: Option<u64>,
}

/// How long one search may take.
pub const SEARCH_BUDGET: Duration = Duration::from_secs(30);

/// Directories never worth descending into.
const SKIPPED_DIRS: &[&str] = &[
    ".cache",
    ".git",
    "node_modules",
    ".npm",
    ".cargo",
    ".rustup",
];

/// Where to look: the home folder (including the trash) and mounted drives.
pub fn default_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Some(home) = env::var_os("HOME") {
        roots.push(PathBuf::from(home));
    }
    let user = env::var("USER").unwrap_or_default();
    let mounts = if cfg!(target_os = "macos") {
        vec!["/Volumes".to_string()]
    } else {
        vec!["/media".into(), "/mnt".into(), format!("/run/media/{user}")]
    };
    for dir in &mounts {
        let dir = PathBuf::from(dir);
        if dir.is_dir() {
            roots.push(dir);
        }
    }
    roots
}

/// Searches `roots` breadth-first: by inode on the original device first,
/// then by name and size anywhere. Gives up after `budget`.
pub fn find(identity: &Identity, roots: &[PathBuf], budget: Duration) -> Option<PathBuf> {
    let deadline = Instant::now() + budget;
    walk(
        roots,
        deadline,
        true,
        &mut |entry_path, entry| {
            // Inodes are reused after deletion, so the kind must match too.
            entry.ino() == identity.ino
                && fs::symlink_metadata(entry_path)
                    .is_ok_and(|m| m.dev() == identity.dev && m.is_dir() == identity.is_dir)
        },
        identity.dev,
    )
    .or_else(|| {
        walk(
            roots,
            deadline,
            false,
            &mut |entry_path, entry| {
                entry.file_name().to_string_lossy() == identity.name
                    && fs::symlink_metadata(entry_path).is_ok_and(|m| {
                        m.is_dir() == identity.is_dir
                            && (identity.is_dir || Some(m.len()) == identity.size)
                    })
            },
            identity.dev,
        )
    })
}

/// Breadth-first walk calling `matches` on every entry. With `same_device`,
/// directories on other filesystems are not entered.
fn walk(
    roots: &[PathBuf],
    deadline: Instant,
    same_device: bool,
    matches: &mut dyn FnMut(&Path, &fs::DirEntry) -> bool,
    dev: u64,
) -> Option<PathBuf> {
    let mut queue: VecDeque<PathBuf> = roots.iter().cloned().collect();
    let mut visited = std::collections::HashSet::new();
    while let Some(dir) = queue.pop_front() {
        if Instant::now() >= deadline {
            log::info!("gave up looking for a moved file after {:?}", SEARCH_BUDGET);
            return None;
        }
        let Ok(meta) = fs::symlink_metadata(&dir) else {
            continue;
        };
        if (same_device && meta.dev() != dev) || !visited.insert((meta.dev(), meta.ino())) {
            continue;
        }
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if matches(&path, &entry) {
                return Some(path);
            }
            let is_dir = entry.file_type().is_ok_and(|t| t.is_dir());
            let skipped = SKIPPED_DIRS
                .iter()
                .any(|s| entry.file_name() == std::ffi::OsStr::new(s));
            if is_dir && !skipped {
                queue.push_back(path);
            }
        }
    }
    None
}

/// Identity of an existing path.
#[cfg(test)]
pub fn identify(path: &Path) -> Option<Identity> {
    let meta = fs::metadata(path).ok()?;
    Some(Identity {
        dev: meta.dev(),
        ino: meta.ino(),
        name: path.file_name()?.to_string_lossy().into_owned(),
        is_dir: meta.is_dir(),
        size: (!meta.is_dir()).then_some(meta.len()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_a_moved_and_renamed_file_by_inode() {
        let root = tempfile::tempdir().unwrap();
        let original = root.path().join("Desktop/report.pdf");
        fs::create_dir_all(original.parent().unwrap()).unwrap();
        fs::write(&original, "pdf").unwrap();
        let identity = identify(&original).unwrap();

        let moved = root.path().join("Documents/2026/final report.pdf");
        fs::create_dir_all(moved.parent().unwrap()).unwrap();
        fs::rename(&original, &moved).unwrap();
        // A different file with the old name must not be mistaken for it.
        fs::write(&original, "other").unwrap();

        let found = find(&identity, &[root.path().to_path_buf()], SEARCH_BUDGET);
        assert_eq!(found, Some(moved));
    }

    #[test]
    fn finds_a_moved_folder() {
        let root = tempfile::tempdir().unwrap();
        let original = root.path().join("Projeto");
        fs::create_dir(&original).unwrap();
        fs::write(original.join("main.rs"), "fn main() {}").unwrap();
        let identity = identify(&original).unwrap();
        let moved = root.path().join("code/Projeto");
        fs::create_dir(root.path().join("code")).unwrap();
        fs::rename(&original, &moved).unwrap();

        assert_eq!(
            find(&identity, &[root.path().to_path_buf()], SEARCH_BUDGET),
            Some(moved)
        );
    }

    #[test]
    fn falls_back_to_name_and_size() {
        let root = tempfile::tempdir().unwrap();
        // As after a move to another filesystem: same name and size, new inode.
        let identity = Identity {
            dev: u64::MAX,
            ino: u64::MAX,
            name: "song.mp3".into(),
            is_dir: false,
            size: Some(4),
        };
        let usb = root.path().join("usb/music");
        fs::create_dir_all(&usb).unwrap();
        fs::write(usb.join("song.mp3"), "1234").unwrap();
        fs::write(root.path().join("song.mp3"), "different size").unwrap();

        assert_eq!(
            find(&identity, &[root.path().to_path_buf()], SEARCH_BUDGET),
            Some(usb.join("song.mp3"))
        );
    }

    #[test]
    fn reports_files_that_are_gone() {
        let root = tempfile::tempdir().unwrap();
        let file = root.path().join("gone.txt");
        fs::write(&file, "x").unwrap();
        let identity = identify(&file).unwrap();
        fs::remove_file(&file).unwrap();
        assert_eq!(
            find(&identity, &[root.path().to_path_buf()], SEARCH_BUDGET),
            None
        );
    }

    #[test]
    fn skips_cache_directories() {
        let root = tempfile::tempdir().unwrap();
        let cached = root.path().join(".cache/thumbs/a.png");
        fs::create_dir_all(cached.parent().unwrap()).unwrap();
        fs::write(&cached, "x").unwrap();
        let identity = identify(&cached).unwrap();
        assert_eq!(
            find(&identity, &[root.path().to_path_buf()], SEARCH_BUDGET),
            None
        );
    }
}
