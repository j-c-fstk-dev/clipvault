# Changelog

All notable changes to ClipVault are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Groundwork for macOS: code that depends on the operating system moved to
  `src-tauri/src/platform/` (Linux behavior is unchanged), CI also builds and
  tests on macOS, and `docs/macos-port.md` describes the port

## [0.2.1] - 2026-10-21

### Fixed

- Scrolling long text in the preview (and settings) no longer shows noise on
  older integrated graphics: dialogs are no longer fixed-position layers,
  which WebKitGTK composites on the GPU

### Added

- English and Portuguese: ClipVault follows the desktop's language, or pick
  one in Settings → Appearance → Language. The tray menu and notifications
  follow too
- README in Portuguese (`README.pt-BR.md`), linked from the English one

### Changed

- README: screenshots, the new features, updating and troubleshooting

## [0.2.0] - 2026-10-20

### Changed

- New look inspired by macOS: a floating glass sidebar and glass toolbar
  controls over a soft glow of the accent color, with quiet, solid cards for
  the history. The glass is drawn without blur, so it stays sharp on older
  integrated graphics
- The history is grouped by day (Today, Yesterday, …) when sorted by date,
  and cards are laid out in columns so images and long text fit without gaps
- Copied text is shown in a monospace font; links show their site first
- Clicking a card opens its preview; copy, favorite, tag, preview and delete
  are in a bar that appears on hover or keyboard selection
- Recording status and the pause button moved to the bottom of the sidebar
- Settings are grouped like System Settings, with switches, a theme toggle
  and round accent color swatches
- Interface font: Geist and Geist Mono, bundled with the app

## [0.1.1] - 2026-10-20

### Added

- Clicking a copied file opens it: an "Open with" chooser lists the system
  default first, then the other installed apps; pick "Just once" or
  "Always" (remembered by ClipVault only, resettable in Settings)
- Cut and moved files are followed: for 30 minutes after a copy, ClipVault
  notices when a file leaves its folder and finds where it went (renamed,
  pasted elsewhere, sent to the trash or to a drive). Files moved later are
  looked up when they are opened or copied again
- Badges show whether a file is still in place, only in the saved copy, or
  not found
- "Hardware acceleration" setting: turn it off if text looks noisy or
  flickers on older integrated graphics (applies after a restart)

### Changed

- Copied files are saved in the background at low disk priority after the
  copy is recorded, so large files and folders no longer compete with the
  system's own copy; files over the limit keep only their path
- Image files copied in the file manager (PNG, JPG, …) are listed as
  images, with a thumbnail, and paste as images in apps that accept them

### Fixed

- The sort menu was white and unreadable in the dark theme
- Text in the item window rendered with noise on some GPUs (blur effects
  removed from content)

## [0.1.0] - 2026-10-20

First release of the Rust rewrite.

### Install

- **Debian / Ubuntu / Kali:** download `clipvault_0.1.0_amd64.deb` and run
  `sudo apt install ./clipvault_0.1.0_amd64.deb`
- **Any distro:** download `clipvault_0.1.0_amd64.AppImage`, then
  `chmod +x clipvault_0.1.0_amd64.AppImage && ./clipvault_0.1.0_amd64.AppImage`
- Verify downloads with `sha256sum -c SHA256SUMS`

Runs on X11 desktops (XFCE, MATE, Cinnamon, KDE on X11…).

### Added

- Real-time clipboard capture on X11 for text, HTML, images, and files and
  folders copied in the file manager
- Saved copies of copied files (up to 25 MB per copy by default), so they
  can be pasted after the originals are moved or deleted
- Persistent history with categories, search, favorites and tags; copying
  something again moves it to the top
- Copy any item back: text, images, and files that paste into the file
  manager
- Tray icon, `Ctrl+Shift+V` global shortcut, keyboard navigation and
  start on login
- Optional notifications for new items
- `.zip` backup export and import (importing merges)
- Content marked secret by password managers is never stored; capture can
  be paused

[Unreleased]: https://github.com/j-c-fstk-dev/clipvault/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/j-c-fstk-dev/clipvault/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/j-c-fstk-dev/clipvault/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/j-c-fstk-dev/clipvault/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/j-c-fstk-dev/clipvault/releases/tag/v0.1.0
