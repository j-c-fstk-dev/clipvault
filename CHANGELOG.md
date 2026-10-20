# Changelog

All notable changes to ClipVault are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/j-c-fstk-dev/clipvault/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/j-c-fstk-dev/clipvault/releases/tag/v0.1.0
