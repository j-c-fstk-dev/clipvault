# 🧠 ClipVault

<div align="center">
  <img src="src-tauri/icons/128x128.png" alt="ClipVault Logo" width="120" height="120">

  **Your Memory Companion**

  *A clipboard manager for Linux that remembers everything you copy — text, links, images, files and folders.*

  [![CI](https://github.com/j-c-fstk-dev/clipvault/actions/workflows/ci.yml/badge.svg)](https://github.com/j-c-fstk-dev/clipvault/actions/workflows/ci.yml)
  [![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
  [![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB.svg)](https://v2.tauri.app/)
  [![Rust](https://img.shields.io/badge/Rust-stable-orange.svg)](https://www.rust-lang.org/)
  [![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)

</div>

---

> **Status:** early development. The desktop shell and UI are in place; real
> clipboard capture and persistent history are being built (see
> [Roadmap](#-roadmap)).

## ✨ Features

- **Category tabs** — text, links, images, files and folders, plus an "All" view
- **Grid and list views**, sorting by date or name, instant search
- **Favorites and custom tags** to organize what matters
- **Light and dark themes** with 12 accent colors
- **Full-screen preview** with metadata and quick actions
- **Native and lightweight** — Rust backend with the system WebKitGTK, ~2 MB `.deb`

Planned for the first release: real-time capture of every clipboard format,
persistent history in SQLite, file snapshots (copies the files you copy, up
to a size limit), tray icon, global shortcut, autostart and `.zip`
export/import for backups.

## 📦 Install

Pre-built `.deb` and `.AppImage` packages will be published on the
[Releases](https://github.com/j-c-fstk-dev/clipvault/releases) page.

```bash
# Debian / Ubuntu / Kali
sudo apt install ./clipvault_<version>_amd64.deb

# Any distro
chmod +x clipvault_<version>_amd64.AppImage
./clipvault_<version>_amd64.AppImage
```

Currently targeting **X11** desktops (XFCE, MATE, Cinnamon, KDE on X11…).
Wayland support is on the roadmap.

## 🛠️ Development

### Prerequisites

- [Rust](https://rustup.rs/) (stable)
- Node.js 20+ and npm
- System libraries (Debian / Ubuntu / Kali):

```bash
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
  librsvg2-dev libxdo-dev libssl-dev build-essential curl wget file patchelf
```

### Run

```bash
npm install
npm run tauri dev       # desktop app with hot reload
npm run tauri build     # .deb + .AppImage in src-tauri/target/release/bundle/
```

### Checks (same as CI)

```bash
npm run lint && npm run build
cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```

### Project structure

```
clipvault/
├── src/                     # React + TypeScript UI
│   ├── components/          # Header, Sidebar, views, modal, settings
│   ├── hooks/               # useClipboard, useSettings, useTheme
│   └── types/               # Shared types
├── src-tauri/               # Rust backend (Tauri 2)
│   ├── src/                 # main.rs, lib.rs
│   ├── capabilities/        # Window permissions
│   ├── icons/               # App icons
│   └── tauri.conf.json      # App and bundle config
└── .github/workflows/       # CI
```

### Tech stack

- **Backend:** Rust + [Tauri 2](https://v2.tauri.app/)
- **UI:** React 18, TypeScript, Tailwind CSS, Lucide icons, Vite
- **Packaging:** Tauri bundler (`.deb`, `.AppImage`)

## 📋 Roadmap

- [x] **Stage 1 — Foundation:** Tauri 2 app, AGPL-3.0, CI
- [ ] **Stage 2 — Core:** X11 clipboard watcher (text, HTML, images, files), dedup, SQLite history, file snapshots, password-manager filtering
- [ ] **Stage 3 — UI wiring:** real data instead of mocks, copy back any format, persistent settings
- [ ] **Stage 4 — System:** tray, global shortcut, autostart, notifications
- [ ] **Stage 5 — Backup:** `.zip` export / import with merge
- [ ] **Stage 6 — Releases:** tag → GitHub Release with `.deb` + `.AppImage`
- [ ] **Later:** `.rpm`, Flatpak, AUR, Wayland, auto-update, cloud sync (paid plans)

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

ClipVault is free software licensed under the
[GNU Affero General Public License v3.0](LICENSE).

---

<div align="center">

  *Your memory companion is always watching over your clipboard* 🧠✨

</div>
