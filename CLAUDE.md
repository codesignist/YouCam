# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

YouCam is a Windows-only (WebView2, NSIS installer) Tauri 2 app: a frameless, shaped, always-on-top webcam window for streamers, plus a "screen light" window and a settings window. The frontend is TypeScript + Vite with no UI framework. Almost all logic runs in TypeScript through `@tauri-apps/api`. The Rust side ([src-tauri/src/main.rs](src-tauri/src/main.rs)) only registers the single-instance, global-shortcut and opener plugins and quits the app when the `main` window is destroyed. A second launch emits `youcam:second-instance`, which `main.ts` answers by showing its window.

## Commands

```
pnpm install
pnpm dev         # tauri dev: Vite on port 1420 (strictPort) + the app
pnpm build       # tauri build: installer in src-tauri/target/release/bundle/nsis/
pnpm typecheck   # tsc --noEmit (strict, noUnusedLocals/Parameters)
```

There is no test suite and no linter. `pnpm typecheck` is the check to run after TS changes. Rust changes are compiled by `pnpm dev`/`pnpm build`, or check them with `cargo check` in `src-tauri/`.

`cache/` (gitignored) holds NW.js downloads left over from before the move to Tauri. It is not used.

## Architecture

### Three windows, one owner

The windows are Vite pages listed in [vite.config.ts](vite.config.ts):

| Label | Page | Script |
|---|---|---|
| `main` | `index.html` | [src/main.ts](src/main.ts): camera, menu, tray, shortcuts |
| `light` | `light.html` | [src/light.ts](src/light.ts): screen light |
| `settings` | `settings.html` | [src/settings.ts](src/settings.ts): settings UI |

Only `main` is declared in [tauri.conf.json](src-tauri/tauri.conf.json). `main.ts` creates `light` and `settings` at runtime with `new WebviewWindow(...)`. [src-tauri/capabilities/default.json](src-tauri/capabilities/default.json) grants permissions to all three labels. Any new window API call (or a new window label) needs its permission added there, or it fails at runtime.

`main.ts` owns all camera-window settings. Each setting is a module-level variable persisted under its own `localStorage` key. The settings window is only a view, synced through Tauri events defined in [src/options.ts](src/options.ts):

1. When `settings` loads, it emits `SETTINGS_READY`.
2. `main` emits `STATE`, built by `currentState()`. It emits it again after every change, batched via `stateChanged()`.
3. `settings` sends user edits as `CHANGE` events (the `Change` union). `main` applies them in `applyChange()` and broadcasts the new `STATE`.

`light` also listens to `STATE`, but only for the language. Its own colour, position and fullscreen state live in its own `localStorage` keys. All windows share one origin, so they share `localStorage`.

**Adding a setting** touches several places:
- `options.ts`: the `Settings` interface and the choices list. `Change` derives from `Settings` automatically.
- `main.ts`: the variable and `localStorage` load, a `setX()` that persists and applies it then calls `stateChanged()`, plus `currentState()`, `applyChange()`, and the menu if it belongs there.
- `settings.html` and `settings.ts`: the control.
- `i18n.ts`: its words.

### Menu and tray

The right-click menu and the tray menu are the same `Menu`, built from `buildMenuEntries()` in `main.ts`. Tauri menu items live on the Rust side, so the menu is rebuilt (and the old items closed) on every state change. `rebuildMenu()` serializes these rebuilds through a queue.

### Background effects

[src/background.ts](src/background.ts) runs MediaPipe selfie segmentation on downscaled frames, using the CPU delegate on purpose (the GPU delegate measured slower). The model is [assets/models/selfie_segmenter.tflite](assets/models/selfie_segmenter.tflite). `main.ts` loads this module with a dynamic `import("./background")` only while an effect is on, so keep it out of static imports. MediaPipe's license in `assets/licenses/` is bundled into the installer via `bundle.resources`.

### i18n

[src/i18n.ts](src/i18n.ts) holds the `en` dictionary (the source of truth for `MessageKey`) and `tr`. `tr` is typed `Record<MessageKey, string>`, so a key missing from `tr` fails `pnpm typecheck`. Every user-facing string needs both languages.

- `t(key, params)` fills in `{name}` placeholders.
- `option(group, value)` translates a setting value such as `shape.Hexagon`. A value with no key (for example `720p`) is shown as is.
- Static text in `settings.html` carries keys in `data-i18n`, `data-i18n-title` and `data-i18n-aria` attributes, which `settings.ts` fills in.
- The `"system"` language follows `navigator.language`, which is Windows' display language.

## Conventions

- Commit subjects are plain imperative sentences describing the user-visible change, with no type prefix. For example: "Add Turkish, picked in the settings or followed from Windows".
- A release is its own commit whose subject is just the version (for example `2.1.0`). It bumps the version in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock`. `tauri.conf.json` reads the version from `package.json`.
- [README.md](README.md) is Turkish and [README_EN.md](README_EN.md) is English. They mirror each other, so a feature or shortcut change goes into both.
