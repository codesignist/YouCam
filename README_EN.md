# YouCam

Advanced desktop webcam application for youtube streamers.

[Türkçe/Turkish](README.md)

![YouCamSS](https://user-images.githubusercontent.com/1472881/100539154-81fe7000-3245-11eb-933d-9c6ad3253a8d.PNG)

### Motivation

Unfortunately in OBS studio you cant see yourself while having your camera recorded. For that you need an extra application or a referrence monitor. This app was made because of that extra application not existing and to try out NW.js. It has since moved to [Tauri](https://tauri.app/) and TypeScript.

### Install

Requirements: [Node.js](https://nodejs.org/) with [pnpm](https://pnpm.io/), [Rust](https://rustup.rs/) and, on Windows, the "Desktop development with C++" part of Visual Studio Build Tools. WebView2 already comes with Windows 10/11. For other platforms see the [Tauri prerequisites](https://tauri.app/start/prerequisites/).

Install dependencies:

```
pnpm install
```

To run the app in development mode:

```
pnpm dev
```

To build the installer:

```
pnpm build
```

The Windows installer is written to `src-tauri/target/release/bundle/nsis/` and the app itself to `src-tauri/target/release/youcam.exe`. Run `pnpm typecheck` to type-check.

## Used Package(s)

- [Tauri](https://tauri.app/) — desktop runtime (uses the system WebView)
- [TypeScript](https://www.typescriptlang.org/) and [Vite](https://vite.dev/) — language and build tool
- [MediaPipe](https://ai.google.dev/edge/mediapipe) — background blur (selfie segmentation model, Apache-2.0)

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `M` | Toggle mirror |
| `R` / `Shift+R` | Rotate clockwise / counter-clockwise |
| `B` | Background: off / blur / dark blur |
| `T` | Toggle always on top |
| `L` | Toggle screen light |
| `H` | Hide the window |
| `Ctrl+Shift+Y` | Hide / show the window from anywhere (even with a game in front, without taking its focus). Change it under "Hide/show shortcut" in the menu. |
| `Q` / `Esc` | Exit |
| Mouse wheel | Resize the window |
| Right click | Context menu |
| Tray icon click | Hide / show the window |

The screen light is a separate light window for lighting your face with a monitor (e.g. the second one in fullscreen). Right-click it to pick a colour temperature: White (6500K, brightest), Daylight (5600K), Neutral (4500K), Warm (3200K). For the best result, pick the one closest to the other lights in the room. There are also the accent colours streamers use most for a coloured side or back light: Red, Pink, Purple, Blue, Cyan. Apart from Cyan they give far less light than white, so use them as an accent rather than the main light. For any other colour, Custom... opens a colour picker. Double-click, `F` or `F11` toggles fullscreen, `Esc` leaves it and `L` closes it. Its colour, position, size and fullscreen state are remembered.

## Todo

- [x] Size setups
- [x] Curved sides and other shapes
- [x] Mirror feature
- [x] English ReadMe.md
- [x] Keyboard shortcuts
- [x] Remember selected camera
- [x] Video quality selection (480p / 720p / 1080p)
- [x] Remember window position and size
- [x] Background blur
- [x] Dark blurred background
- [x] Screen light
- [x] Camera problems shown in the window, automatic reconnect
- [x] Hide / show with a global shortcut and the tray (the camera is off while hidden)
- [x] Image adjustments: brightness, contrast, black and white
- [x] Coloured border that follows the shape

## Contributing

You can submit the features you would like to see or contribute by making a PR.
