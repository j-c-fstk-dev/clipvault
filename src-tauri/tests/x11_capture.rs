//! End-to-end clipboard tests against a real X server, using `xclip` as the
//! other application (owner when capturing, requestor when pasting). Skipped unless `$DISPLAY` is set and `xclip` is
//! installed; CI runs it under `xvfb-run`.
#![cfg(target_os = "linux")]

use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver};
use std::sync::{Arc, Mutex, MutexGuard, OnceLock};
use std::time::{Duration, Instant};

use clipvault_lib::model::{Captured, Outgoing};
use clipvault_lib::platform::capture::Watcher;
use clipvault_lib::platform::serve::ClipboardHandle;

/// One watcher shared by every test in this process: watcher threads never
/// stop, and a leftover one would read the clipboard alongside the next
/// test's (xclip cannot serve two INCR readers at once). The mutex also
/// keeps tests from overlapping, since the clipboard is global to the X
/// server.
struct Shared {
    captures: Receiver<Captured>,
    paused: Arc<AtomicBool>,
    clipboard: ClipboardHandle,
}

fn shared() -> MutexGuard<'static, Shared> {
    static SHARED: OnceLock<Mutex<Shared>> = OnceLock::new();
    let guard = SHARED
        .get_or_init(|| {
            let paused = Arc::new(AtomicBool::new(false));
            let (tx, captures) = mpsc::channel();
            let watcher = Watcher::connect().expect("connect to X11");
            let clipboard = watcher.handle();
            watcher
                .spawn(paused.clone(), move |captured| {
                    let _ = tx.send(captured);
                })
                .unwrap();
            Mutex::new(Shared {
                captures,
                paused,
                clipboard,
            })
        })
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    // Drop captures left over from startup or an earlier test.
    while next(&guard.captures, Duration::from_millis(500)).is_some() {}
    guard
}

fn xclip_available() -> bool {
    std::env::var_os("DISPLAY").is_some()
        && Command::new("xclip")
            .arg("-version")
            .stderr(Stdio::null())
            .status()
            .is_ok()
}

/// Makes `xclip` own the clipboard, offering `data` as `target`.
fn copy(target: &str, data: &[u8]) {
    let mut child = Command::new("xclip")
        .args(["-selection", "clipboard", "-t", target, "-i"])
        .stdin(Stdio::piped())
        .spawn()
        .expect("run xclip");
    child.stdin.take().unwrap().write_all(data).unwrap();
    // xclip forks a server process and the parent exits once it owns the selection.
    assert!(child.wait().unwrap().success());
}

/// Reads the clipboard as `target`, like an application pasting.
fn paste(target: &str) -> Vec<u8> {
    let out = Command::new("xclip")
        .args(["-selection", "clipboard", "-t", target, "-o"])
        .output()
        .expect("run xclip");
    assert!(out.status.success(), "xclip -o -t {target} failed");
    out.stdout
}

/// Waits for the next capture, skipping repeats of earlier content.
fn next(rx: &Receiver<Captured>, timeout: Duration) -> Option<Captured> {
    let deadline = Instant::now() + timeout;
    rx.recv_timeout(deadline.saturating_duration_since(Instant::now()))
        .ok()
}

fn expect(rx: &Receiver<Captured>, wanted: &Captured) {
    let deadline = Instant::now() + Duration::from_secs(10);
    while Instant::now() < deadline {
        match next(rx, Duration::from_secs(10)) {
            Some(got) if &got == wanted => return,
            Some(_) => continue,
            None => break,
        }
    }
    panic!("did not capture {:.200}", format!("{wanted:?}"));
}

fn fake_png(extra: usize) -> Vec<u8> {
    let mut png = b"\x89PNG\r\n\x1a\n\0\0\0\x0dIHDR".to_vec();
    png.extend_from_slice(&64u32.to_be_bytes());
    png.extend_from_slice(&32u32.to_be_bytes());
    png.extend((0..extra).map(|i| (i * 31 % 251) as u8));
    png
}

#[test]
fn captures_clipboard_changes_from_other_apps() {
    if !xclip_available() {
        eprintln!("skipping: needs $DISPLAY and xclip");
        return;
    }
    let shared = shared();
    let (rx, paused) = (&shared.captures, &shared.paused);

    copy("UTF8_STRING", "olá, ClipVault".as_bytes());
    expect(
        rx,
        &Captured::Text {
            text: "olá, ClipVault".into(),
            html: None,
        },
    );

    // Large enough that xclip must use the INCR protocol.
    let big = "0123456789abcdef\n".repeat(200_000);
    copy("UTF8_STRING", big.as_bytes());
    expect(
        rx,
        &Captured::Text {
            text: big,
            html: None,
        },
    );

    let small_png = fake_png(100);
    copy("image/png", &small_png);
    expect(
        rx,
        &Captured::Image {
            bytes: small_png,
            mime: "image/png".into(),
        },
    );

    let big_png = fake_png(3 * 1024 * 1024);
    copy("image/png", &big_png);
    expect(
        rx,
        &Captured::Image {
            bytes: big_png,
            mime: "image/png".into(),
        },
    );

    copy(
        "text/uri-list",
        b"file:///home/me/My%20Docs/report.pdf\r\nfile:///tmp\r\n",
    );
    expect(
        rx,
        &Captured::Files {
            paths: vec![
                PathBuf::from("/home/me/My Docs/report.pdf"),
                PathBuf::from("/tmp"),
            ],
        },
    );

    // Nothing is captured while paused.
    paused.store(true, Ordering::Relaxed);
    copy("UTF8_STRING", b"while paused");
    assert_eq!(next(rx, Duration::from_millis(1500)), None);
    paused.store(false, Ordering::Relaxed);

    copy("UTF8_STRING", b"after resume");
    expect(
        rx,
        &Captured::Text {
            text: "after resume".into(),
            html: None,
        },
    );
}

#[test]
fn serves_copied_items_to_other_apps() {
    if !xclip_available() {
        eprintln!("skipping: needs $DISPLAY and xclip");
        return;
    }
    let shared = shared();
    let (rx, clipboard) = (&shared.captures, &shared.clipboard);

    clipboard
        .set(&Outgoing::Text {
            text: "olá mundo".into(),
            html: Some("<b>olá</b>".into()),
        })
        .unwrap();
    let targets = String::from_utf8(paste("TARGETS")).unwrap();
    for target in ["UTF8_STRING", "text/plain;charset=utf-8", "text/html"] {
        assert!(targets.contains(target), "missing {target} in {targets}");
    }
    assert_eq!(paste("UTF8_STRING"), "olá mundo".as_bytes());
    assert_eq!(paste("text/html"), "<b>olá</b>".as_bytes());

    // Larger than one property: sent with INCR.
    let png = fake_png(1024 * 1024);
    clipboard
        .set(&Outgoing::Image {
            bytes: png.clone(),
            mime: "image/png".into(),
        })
        .unwrap();
    assert_eq!(paste("image/png"), png);

    clipboard
        .set(&Outgoing::Files {
            paths: vec![PathBuf::from("/home/me/a b.txt")],
            image: None,
        })
        .unwrap();
    assert_eq!(paste("text/uri-list"), b"file:///home/me/a%20b.txt\r\n");
    assert_eq!(
        paste("x-special/gnome-copied-files"),
        b"copy\nfile:///home/me/a%20b.txt"
    );

    // Our own clipboard changes are not captured again.
    assert_eq!(next(rx, Duration::from_millis(800)), None);

    // Another app taking the clipboard is captured as usual.
    copy("UTF8_STRING", b"from another app");
    expect(
        rx,
        &Captured::Text {
            text: "from another app".into(),
            html: None,
        },
    );
}
