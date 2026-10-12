# YouCam

A small webcam window for YouTubers and streamers. It keeps your camera on screen in a circle, hexagon or other shape, on top of everything, so you can see yourself while you record. OBS doesn't show you yourself while it records your camera; you'd need another app or a second monitor. YouCam is that app.

[Türkçe](README.md)

![YouCam](https://user-images.githubusercontent.com/1472881/100539154-81fe7000-3245-11eb-933d-9c6ad3253a8d.PNG)

## Features

- Circle, hexagon, rounded or square, with a coloured border if you like
- Stays on top of other windows; drag it to move it, scroll on it to resize it
- Digital zoom: `Ctrl`+scroll to zoom in on your face, `Ctrl`+drag to move the picture
- Background blur or dark blur, done on your computer (nothing is uploaded)
- Brightness, contrast, black and white, mirror and rotation
- Screen light: a second window that lights your face with a monitor, in white or an accent colour
- Hide and show it from anywhere with `Ctrl+Shift+Y`, even with a game in front; the camera is off while it is hidden
- Says what is wrong when the camera can't start, and reconnects by itself when it comes back
- Remembers the camera, the settings and where the window was
- In English or Turkish: it follows Windows' language, or you can pick one in the settings

## Download

For Windows 10 and 11, from [the latest release](https://github.com/codesignist/YouCam/releases/latest):

- `youcam-<version>-win-x64-setup.exe`: the installer
- `youcam-<version>-win-x64-portable.zip`: just `youcam.exe`, nothing to install

YouCam isn't code-signed, so Windows SmartScreen may warn you the first time you run it.

## Usage

Drag the camera to move it and scroll on it to resize it. With `Ctrl` held, scrolling zooms the picture in where the mouse is and dragging moves the picture. Right-click it for the menu: camera, background, mirror, screen light, settings, hide and exit. Everything else is in the settings window (Settings... or `S`), which opens next to the camera so you can see each change as you make it.

| Key | Action |
|---|---|
| `M` | Mirror |
| `R` / `Shift+R` | Rotate clockwise / counter-clockwise |
| `B` | Background: off / blur / dark blur |
| `T` | Always on top |
| `L` | Screen light |
| `H` | Hide |
| `S` | Settings |
| `0` | Reset zoom |
| `Q` / `Esc` | Exit |
| `Ctrl+Shift+Y` | Hide / show from anywhere, without taking the focus from a game (can be changed in the settings) |

Clicking the tray icon also hides and shows the window.

### Screen light

The screen light is a plain window for lighting your face with a monitor, e.g. a second monitor in fullscreen. Right-click it for its colour: White (6500K, the brightest), Daylight (5600K), Neutral (4500K) or Warm (3200K); pick the one closest to the other lights in the room. Red, Pink, Purple, Blue and Cyan are for a coloured side or back light; apart from Cyan they give far less light than white. Custom... picks any colour. Double-click, `F` or `F11` toggles fullscreen, `Esc` leaves it and `L` closes the light. It remembers its colour, place and fullscreen state.

## Building from source

You need [Node.js](https://nodejs.org/) with [pnpm](https://pnpm.io/), and what [Tauri needs](https://tauri.app/start/prerequisites/): Rust and, on Windows, the Visual Studio C++ build tools.

```
pnpm install
pnpm dev     # run it
pnpm build   # installer in src-tauri/target/release/bundle/nsis/
```

Built with [Tauri](https://tauri.app/), TypeScript and [Vite](https://vite.dev/). Background blur uses [MediaPipe](https://ai.google.dev/edge/mediapipe)'s selfie segmentation model (Apache-2.0).

## Contributing

Ideas and pull requests are welcome. Open an [issue](https://github.com/codesignist/YouCam/issues) for a feature you'd like to see.

## License

[ISC](LICENSE)
