//! Following copied files that get moved (cut and pasted, renamed, trashed)
//! soon after they were copied.
//!
//! Only the folders the files were copied from are watched, with inotify,
//! for [`TRACK_FOR`]. When a tracked file leaves its folder, it is looked up
//! in the background with [`crate::locate`] and the item is updated.

use std::collections::HashMap;
use std::os::fd::AsRawFd;
use std::path::PathBuf;
use std::sync::mpsc::{self, Receiver, Sender, TryRecvError};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use inotify::{EventMask, Inotify, WatchDescriptor, WatchMask};

use crate::locate::{self, Identity};
use crate::store::Store;

/// How long after a copy its files are followed.
pub const TRACK_FOR: Duration = Duration::from_secs(30 * 60);
/// How often the watcher wakes to take new items and drop expired ones.
const TICK: Duration = Duration::from_secs(1);

/// A copied file being followed.
struct Tracked {
    item_id: i64,
    position: usize,
    name: String,
    identity: Identity,
    folder: PathBuf,
    until: Instant,
}

/// Sends items to the watcher thread.
#[derive(Clone)]
pub struct Tracker {
    items: Sender<i64>,
}

impl Tracker {
    /// Starts the watcher. `on_relocated` runs after an item was updated with
    /// a file's new location.
    pub fn start(
        store: Arc<Store>,
        on_relocated: impl Fn() + Send + Sync + 'static,
    ) -> std::io::Result<Self> {
        let inotify = Inotify::init()?;
        let (items, incoming) = mpsc::channel();
        let on_relocated = Arc::new(on_relocated);
        thread::Builder::new()
            .name("file-tracker".into())
            .spawn(move || run(inotify, incoming, store, on_relocated))?;
        Ok(Self { items })
    }

    /// Follows the files of `item_id` for [`TRACK_FOR`].
    pub fn track(&self, item_id: i64) {
        let _ = self.items.send(item_id);
    }
}

fn run(
    mut inotify: Inotify,
    incoming: Receiver<i64>,
    store: Arc<Store>,
    on_relocated: Arc<dyn Fn() + Send + Sync>,
) {
    let mut watched: HashMap<WatchDescriptor, Vec<Tracked>> = HashMap::new();
    let mut buffer = [0u8; 4096];
    loop {
        loop {
            match incoming.try_recv() {
                Ok(item_id) => add(&mut inotify, &mut watched, &store, item_id),
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => return,
            }
        }

        let now = Instant::now();
        watched.retain(|wd, files| {
            files.retain(|f| f.until > now);
            let keep = !files.is_empty();
            if !keep {
                let _ = inotify.watches().remove(wd.clone());
            }
            keep
        });

        if !wait_readable(&inotify, TICK) {
            continue;
        }
        let gone: Vec<(WatchDescriptor, String)> = match inotify.read_events(&mut buffer) {
            Ok(events) => events
                .filter(|e| e.mask.intersects(EventMask::MOVED_FROM | EventMask::DELETE))
                .filter_map(|e| Some((e.wd, e.name?.to_string_lossy().into_owned())))
                .collect(),
            Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => continue,
            Err(err) => {
                log::error!("file tracking stopped: {err}");
                return;
            }
        };
        for (wd, name) in gone {
            let Some(files) = watched.get_mut(&wd) else {
                continue;
            };
            let (moved, staying): (Vec<_>, Vec<_>) = files.drain(..).partition(|f| f.name == name);
            *files = staying;
            for file in moved {
                relocate(file, store.clone(), on_relocated.clone());
            }
        }
    }
}

/// Starts following the files of an item that are where they were copied.
fn add(
    inotify: &mut Inotify,
    watched: &mut HashMap<WatchDescriptor, Vec<Tracked>>,
    store: &Store,
    item_id: i64,
) {
    let Ok(Some(item)) = store.get(item_id) else {
        return;
    };
    for (position, file) in item.files.iter().enumerate() {
        let path = PathBuf::from(&file.path);
        let (Some(folder), true) = (path.parent(), file.exists) else {
            continue;
        };
        let Ok(Some(identity)) = store.file_identity(item_id, position) else {
            continue;
        };
        let wd = match inotify
            .watches()
            .add(folder, WatchMask::MOVED_FROM | WatchMask::DELETE)
        {
            Ok(wd) => wd,
            Err(err) => {
                log::debug!("cannot watch {}: {err}", folder.display());
                continue;
            }
        };
        let files = watched.entry(wd).or_default();
        files.retain(|f| !(f.item_id == item_id && f.position == position));
        files.push(Tracked {
            item_id,
            position,
            name: file.name.clone(),
            identity,
            folder: folder.to_path_buf(),
            until: Instant::now() + TRACK_FOR,
        });
    }
}

/// Looks for a file that left its folder and records where it went.
fn relocate(file: Tracked, store: Arc<Store>, on_relocated: Arc<dyn Fn() + Send + Sync>) {
    let spawned = thread::Builder::new()
        .name("file-locator".into())
        .spawn(move || {
            // The folder it left first (renames), then home, trash and drives.
            let mut roots = vec![file.folder.clone()];
            roots.extend(locate::default_roots());
            match locate::find(&file.identity, &roots, locate::SEARCH_BUDGET) {
                Some(found) => {
                    log::info!("{} moved to {}", file.name, found.display());
                    match store.relocate_file(file.item_id, file.position, &found) {
                        Ok(()) => on_relocated(),
                        Err(err) => log::warn!("cannot record new location: {err}"),
                    }
                }
                None => log::info!("{} was moved or deleted; not found", file.name),
            }
        });
    if let Err(err) = spawned {
        log::warn!("cannot start file search: {err}");
    }
}

/// Waits up to `timeout` for inotify events.
fn wait_readable(inotify: &Inotify, timeout: Duration) -> bool {
    let mut fd = libc::pollfd {
        fd: inotify.as_raw_fd(),
        events: libc::POLLIN,
        revents: 0,
    };
    // SAFETY: one valid pollfd for the inotify descriptor we own.
    let ready = unsafe { libc::poll(&mut fd, 1, timeout.as_millis() as libc::c_int) };
    ready > 0
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Captured;
    use crate::settings::Settings;
    use std::fs;

    fn wait_for(mut condition: impl FnMut() -> bool) -> bool {
        let deadline = Instant::now() + Duration::from_secs(10);
        while Instant::now() < deadline {
            if condition() {
                return true;
            }
            thread::sleep(Duration::from_millis(50));
        }
        false
    }

    #[test]
    fn follows_a_file_moved_after_copying() {
        let data = tempfile::tempdir().unwrap();
        let store = Arc::new(Store::open(data.path()).unwrap());
        let src = tempfile::tempdir().unwrap();
        let file = src.path().join("Desktop/report.pdf");
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        fs::write(&file, "pdf").unwrap();
        let item = store
            .insert(
                Captured::Files {
                    paths: vec![file.clone()],
                },
                &Settings::default(),
            )
            .unwrap()
            .item;

        let relocated = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let counter = relocated.clone();
        let tracker = Tracker::start(store.clone(), move || {
            counter.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        })
        .unwrap();
        tracker.track(item.id);
        thread::sleep(Duration::from_millis(1500)); // let the watch be set up

        // A rename inside the same folder: found in the folder it left.
        let renamed = src.path().join("Desktop/report-final.pdf");
        fs::rename(&file, &renamed).unwrap();
        assert!(
            wait_for(
                || store.get(item.id).unwrap().unwrap().files[0].path == renamed.to_string_lossy()
            ),
            "rename not followed"
        );
        assert_eq!(relocated.load(std::sync::atomic::Ordering::SeqCst), 1);
    }
}
