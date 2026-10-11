# YouCam

Advanced desktop webcam application for youtube streamers.

[Türkçe/Turkish](README.md)

![YouCamSS](https://user-images.githubusercontent.com/1472881/100539154-81fe7000-3245-11eb-933d-9c6ad3253a8d.PNG)

### Motivation

Unfortunately in OBS studio you cant see yourself while having your camera recorded. For that you need an extra application or a referrence monitor. This app was made because of that extra application not existing and to try out NW.js

### Install

Install dependencies (downloads the NW.js binary):

```
pnpm install
```

To run the app:

```
pnpm start
```

To package the app:

```
pnpm build
```

By default a win64 package is written to `./dist`. To target other platforms/architectures, edit the `nwbuild` section in `package.json`.
For more info; [nw-builder](https://github.com/nwutils/nw-builder)

## Used Package(s)

- [NW.js](https://nwjs.io/) — desktop runtime
- [nw-builder](https://github.com/nwutils/nw-builder) — packager
- [MediaPipe](https://ai.google.dev/edge/mediapipe) — background blur (selfie segmentation model, Apache-2.0)

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `M` | Toggle mirror |
| `R` / `Shift+R` | Rotate clockwise / counter-clockwise |
| `B` | Toggle background blur |
| `T` | Toggle always on top |
| `Q` / `Esc` | Exit |
| Mouse wheel | Resize the window |
| Right click | Context menu |

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

## Contributing

You can submit the features you would like to see or contribute by making a PR.
