//! End-to-end capture test against a real X server, using `xclip` as the
//! clipboard owner. Skipped unless `$DISPLAY` is set and `xclip` is
//! installed; CI runs it under `xvfb-run`.

use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver};
use std::sync::Arc;
use std::time::{Duration, Instant};

use clipvault_lib::capture::Watcher;
use clipvault_lib::model::Captured;

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

    let paused = Arc::new(AtomicBool::new(false));
    let (tx, rx) = mpsc::channel();
    Watcher::connect()
        .expect("connect to X11")
        .spawn(paused.clone(), move |captured| {
            let _ = tx.send(captured);
        })
        .unwrap();

    copy("UTF8_STRING", "olá, ClipVault".as_bytes());
    expect(
        &rx,
        &Captured::Text {
            text: "olá, ClipVault".into(),
            html: None,
        },
    );

    // Large enough that xclip must use the INCR protocol.
    let big = "0123456789abcdef\n".repeat(200_000);
    copy("UTF8_STRING", big.as_bytes());
    expect(
        &rx,
        &Captured::Text {
            text: big,
            html: None,
        },
    );

    let small_png = fake_png(100);
    copy("image/png", &small_png);
    expect(
        &rx,
        &Captured::Image {
            bytes: small_png,
            mime: "image/png".into(),
        },
    );

    let big_png = fake_png(3 * 1024 * 1024);
    copy("image/png", &big_png);
    expect(
        &rx,
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
        &rx,
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
    assert_eq!(next(&rx, Duration::from_millis(1500)), None);
    paused.store(false, Ordering::Relaxed);

    copy("UTF8_STRING", b"after resume");
    expect(
        &rx,
        &Captured::Text {
            text: "after resume".into(),
            html: None,
        },
    );
}
