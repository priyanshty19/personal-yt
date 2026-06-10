# Personal YT

A lightweight, **100% local** macOS desktop player & controller for YouTube Music,
built with Electron. It wraps the web player in a native window and adds a menu-bar
controller, a floating mini-player, and macOS Now Playing integration.

> **🔒 100% local. No account data ever leaves your machine.**
> There is no backend, no telemetry, and no analytics. Your password goes straight
> to Google — this app never sees it — and your login session is stored only on
> your own Mac, exactly like a browser profile.

## Features

- 🎵 **Host window** — the full YouTube Music web player, with login persisted across restarts.
- 🎛️ **macOS Now Playing** — track + artwork in Control Center and on the lock screen; hardware media keys are handled by the OS.
- 📊 **Menu-bar controller** — current track + play/pause/next/previous from the menu bar.
- 🎚️ **Floating mini-player** — a draggable, always-on-top bezel with artwork, title/artist, a seekable progress bar, and controls. Toggle with **⌘⇧M**. It shows on **every display** and floats over **all Spaces, including other apps' full-screen mode** (implemented as an `NSPanel`).
- 🪟 **Runs in the background** — closing the window keeps it alive in the menu bar.
- 🍎 **Native macOS feel** — custom app icon, About panel, fixed window title, and a proper app menu.

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘⇧M` | Toggle the floating mini-player (on all Spaces) |
| `⌘P` | Play / Pause |
| `⌘→` / `⌘←` | Next / Previous track |
| Hardware media keys | Play-pause / next / previous (handled by macOS Now Playing) |

## Requirements

- macOS (the prebuilt `.dmg` targets **Apple Silicon / arm64**; rebuild from source for Intel).
- For development: Node.js + npm (Electron is installed via `npm install`).

## Run from source

```bash
npm install
npm start
```

## Build a `.app` / `.dmg`

```bash
npm run dist
```

The output lands in `dist/`. The build is **unsigned**, so the first launch needs a
right-click → **Open** to get past Gatekeeper. To distribute without that warning,
add an Apple Developer signing identity + notarization to the `build` config in
`package.json`.

## How it works

- `src/main.js` — Electron main process: the host window, tray, app menu, the
  per-display mini-player panels, global shortcut, and IPC.
- `src/preload.js` — injected into the YouTube Music page. Reads now-playing info
  from `navigator.mediaSession` + the `<video>` element and drives the page's own
  player controls. No private API is used.
- `src/widget.html` / `src/widget.js` / `src/widget-preload.js` — the floating
  mini-player UI and its isolated bridge to the main process.
- `scripts/gen-icon.js` / `scripts/gen-app-icon.js` — generate the menu-bar
  template icon and the app icon (`build/icon.png` → `build/icon.icns`).

A couple of macOS-specific notes baked into `main.js`: hardware acceleration is
disabled (avoids a GPU-context crash on recent macOS), the `Electron/x` token is
stripped from the user agent (so Google sign-in works), and the app re-asserts a
`regular` activation policy so the floating panel never hides the Dock icon.

> ⚠️ YouTube Music has no public API; the page integration is unofficial and may
> need updating if the site's markup changes.

## Privacy & security

- **No backend / no telemetry.** The app makes no network calls of its own beyond
  loading YouTube Music itself.
- **Credentials are never stored or transmitted by this app.** Authentication is
  handled entirely by Google's own login page; only the resulting session cookie is
  kept locally in the app's data folder.
- **Opens no network ports / runs no server**, so there's no remote attack surface.
- Safe Electron defaults: `contextIsolation` on, `nodeIntegration` off, no remote
  code executed in the privileged process, external links open in your real browser.

## Roadmap ideas

- Configurable global hotkeys
- Settings window (themes, launch-at-login)
- last.fm / ListenBrainz scrobbling, Discord Rich Presence
- Auto-update (`electron-updater`)

## Disclaimer

Personal YT is an independent, open-source project. It is **not affiliated with,
endorsed by, or sponsored by Google or YouTube**. "YouTube" and "YouTube Music" are
trademarks of Google LLC. This app is a thin client for the existing YouTube Music
web experience and includes no ad-blocking or content-scraping.

## License

MIT
