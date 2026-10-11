// The camera window: a frameless, shaped webcam view with a right-click /
// tray menu and keyboard shortcuts.
import {
  availableMonitors,
  getCurrentWindow,
  PhysicalPosition,
  PhysicalSize,
  type Monitor,
} from "@tauri-apps/api/window";
import {
  CheckMenuItem,
  Menu,
  MenuItem,
  PredefinedMenuItem,
  Submenu,
} from "@tauri-apps/api/menu";
import { TrayIcon } from "@tauri-apps/api/tray";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import trayIconUrl from "../assets/icon-tray.png?url";
import type { BackgroundEffect, BackgroundMode } from "./background";
import {
  debounced,
  monitorAt,
  restoreBounds,
  saveBounds,
  type Bounds,
} from "./common";
import "./app.css";

const win = getCurrentWindow();
const video = document.getElementById("camera") as HTMLVideoElement;
const backgroundCanvas = document.getElementById(
  "background"
) as HTMLCanvasElement;

let isMirror = localStorage.getItem("isMirror") === "true";
let alwaysOnTop = localStorage.getItem("alwaysOnTop") !== "false";
let deg = normalizeDeg(parseInt(localStorage.getItem("deg") ?? "", 10) || 0);
// Unbounded copy of deg for the CSS transform, so the transition always
// turns 90deg the short way (270 -> 360 instead of spinning back to 0)
let rotation = deg;
let shape = localStorage.getItem("shape") ?? "Hexagon";
const dimensions = [240, 360, 480]; // logical pixels
let aspectRatio = localStorage.getItem("aspectRatio") ?? "1:1";
const aspectRatios = ["None", "1:1", "3:4", "4:3", "16:9"];
let videoDevices: MediaDeviceInfo[] = [];
let currentDeviceId: string | undefined;
const qualities = [
  { label: "480p", width: 640, height: 480 },
  { label: "720p", width: 1280, height: 720 },
  { label: "1080p", width: 1920, height: 1080 },
];
let quality = localStorage.getItem("quality") ?? "720p";
type Background = "Off" | BackgroundMode;
const backgrounds: Background[] = ["Off", "Blur", "Dark blur"];
let background = localStorage.getItem("background") as Background;
if (!backgrounds.includes(background)) background = "Blur";
let light: WebviewWindow | null = null; // the screen light while it is open
let lightOpening = false;
const shapes = [
  { label: "Square", val: "0.1px" },
  { label: "Rounded", val: "16px" },
  { label: "Circle", val: "50%" },
  { label: "Hexagon", val: "50%" },
];

// Physical pixels per CSS pixel on the window's current monitor
const pixelRatio = () => window.devicePixelRatio;

// On Windows the frameless window still has a title bar and borders until it
// is first shown, and loses them a moment later; sizes set before that come
// out wrong. So show it first (it is fully transparent until the camera
// starts) and wait for the frame to go before restoring its bounds.
await win.show();
await untilFrameless();
async function untilFrameless(): Promise<void> {
  const deadline = performance.now() + 1500;
  while (performance.now() < deadline) {
    const [inner, outer] = await Promise.all([win.innerSize(), win.outerSize()]);
    const frameless = inner.width === outer.width && inner.height === outer.height;
    // ...and for the page's viewport, which bounds() reads, to catch up
    const viewportCaughtUp =
      Math.round(window.innerWidth * window.devicePixelRatio) === inner.width &&
      Math.round(window.innerHeight * window.devicePixelRatio) === inner.height;
    if (frameless && viewportCaughtUp) return;
    await new Promise((r) => setTimeout(r, 16));
  }
}

// Tauri reports window geometry asynchronously. The size is taken from the
// page's own viewport, which is always current; the position is followed
// from Tauri's move events.
await restoreBounds(win, "bounds");
let position = await win.outerPosition();
function bounds(): Bounds {
  return {
    x: position.x,
    y: position.y,
    width: Math.round(window.innerWidth * pixelRatio()),
    height: Math.round(window.innerHeight * pixelRatio()),
  };
}
let monitors: Monitor[] = await availableMonitors();
await win.setAlwaysOnTop(alwaysOnTop);

// ---- Menu (right-click and tray) -------------------------------------------

interface MenuEntry {
  label?: string;
  checked?: boolean; // makes it a check item
  action?: () => void;
  submenu?: MenuEntry[];
  separator?: boolean;
}

function buildMenuEntries(): MenuEntry[] {
  return [
    { label: "YouCam", action: showWindow },
    {
      label: "Cam source",
      submenu: videoDevices.map((device, i) => ({
        label: device.label || `Camera ${i + 1}`,
        checked: device.deviceId === currentDeviceId,
        action: () => setVideo(device.deviceId),
      })),
    },
    {
      label: "Quality",
      submenu: qualities.map((q) => ({
        label: q.label,
        checked: quality === q.label,
        action: () => {
          quality = q.label;
          localStorage.setItem("quality", quality);
          setVideo(currentDeviceId);
          rebuildMenu();
        },
      })),
    },
    {
      label: "Shape",
      submenu: shapes.map((s) => ({
        label: s.label,
        checked: shape === s.label,
        action: () => {
          shape = s.label;
          localStorage.setItem("shape", shape);
          updateVars();
          rebuildMenu();
        },
      })),
    },
    {
      label: "Dimensions",
      submenu: dimensions.map((dim) => ({
        label: `${dim}x${dim}`,
        // Derived from the window so it stays right after a manual or wheel
        // resize and across restarts
        checked: Math.round(window.innerWidth) === dim,
        action: () => {
          const width = dim * pixelRatio();
          resizeWindow(width, heightForWidth(width, width));
        },
      })),
    },
    {
      label: "Aspect Ratio",
      submenu: aspectRatios.map((ratio) => ({
        label: ratio,
        checked: aspectRatio === ratio,
        action: () => {
          aspectRatio = ratio;
          localStorage.setItem("aspectRatio", ratio);
          updateAspectRatio();
          rebuildMenu();
        },
      })),
    },
    {
      label: "Rotate",
      submenu: [
        { label: "Rotate CW (R)", action: () => rotate(90) },
        { label: "Rotate CCW (Shift+R)", action: () => rotate(-90) },
      ],
    },
    {
      label: "Background (B)",
      submenu: backgrounds.map((bg) => ({
        label: bg,
        checked: background === bg,
        action: () => setBackground(bg),
      })),
    },
    { label: "Mirror (M)", checked: isMirror, action: toggleMirror },
    {
      label: "Always on top (T)",
      checked: alwaysOnTop,
      action: toggleAlwaysOnTop,
    },
    {
      label: "Screen light (L)",
      checked: light !== null,
      action: toggleScreenLight,
    },
    { separator: true },
    { label: "Exit (Q)", action: () => win.close() },
  ];
}

type MenuResource = { close(): Promise<void> };
type MenuPart = MenuItem | CheckMenuItem | Submenu | PredefinedMenuItem;

// Menu items live on the Rust side; everything created for one version of
// the menu is collected so it can be freed when the next one replaces it
async function createItem(
  entry: MenuEntry,
  created: MenuResource[]
): Promise<MenuPart> {
  let item: MenuPart;
  if (entry.separator) {
    item = await PredefinedMenuItem.new({ item: "Separator" });
  } else if (entry.submenu) {
    item = await Submenu.new({
      text: entry.label ?? "",
      items: await Promise.all(entry.submenu.map((e) => createItem(e, created))),
    });
  } else if (entry.checked !== undefined) {
    item = await CheckMenuItem.new({
      text: entry.label ?? "",
      checked: entry.checked,
      action: entry.action,
    });
  } else {
    item = await MenuItem.new({ text: entry.label ?? "", action: entry.action });
  }
  created.push(item);
  return item;
}

let menu: Menu | undefined;
let menuResources: MenuResource[] = [];
let tray: TrayIcon | undefined;
let menuQueue: Promise<void> = Promise.resolve();
let rebuildPending = false;

// Rebuilds run one after another, and several requests made while one is
// waiting collapse into a single rebuild with the latest state
function rebuildMenu(): Promise<void> {
  if (rebuildPending) return menuQueue;
  rebuildPending = true;
  menuQueue = menuQueue
    .then(async () => {
      rebuildPending = false;
      const created: MenuResource[] = [];
      const items = await Promise.all(
        buildMenuEntries().map((e) => createItem(e, created))
      );
      const next = await Menu.new({ items });
      created.push(next);
      menu = next;
      await tray?.setMenu(next);
      const previous = menuResources;
      menuResources = created;
      await Promise.all(previous.map((r) => r.close()));
    })
    .catch((err) => console.error("menu:", err));
  return menuQueue;
}

async function showWindow(): Promise<void> {
  await win.show();
  await win.setFocus();
}

await rebuildMenu();
// A dev-server reload runs this again; don't leave the old icon behind
// (removeById would throw when there is none)
await (await TrayIcon.getById("main"))?.close();
tray = await TrayIcon.new({
  id: "main",
  icon: new Uint8Array(await (await fetch(trayIconUrl)).arrayBuffer()),
  tooltip: "YouCam",
  menu,
  showMenuOnLeftClick: false,
  action: (event) => {
    if (
      event.type === "Click" &&
      event.button === "Left" &&
      event.buttonState === "Up"
    ) {
      void showWindow();
    }
  },
});

document.body.addEventListener("contextmenu", (ev) => {
  ev.preventDefault();
  void menu?.popup();
});

// ---- Look: shape, rotation, mirroring ---------------------------------------

function normalizeDeg(value: number): number {
  // Snap to a multiple of 90 within [0, 360)
  return (((Math.round(value / 90) * 90) % 360) + 360) % 360;
}

function rotate(rotateBy: number): void {
  deg = normalizeDeg(deg + rotateBy);
  rotation += rotateBy;
  localStorage.setItem("deg", String(deg));
  updateVars();
  if (aspectRatio !== "None") {
    aspectRatio = aspectRatio.split(":").reverse().join(":");
    localStorage.setItem("aspectRatio", aspectRatio);
  }
  // The swapped size already matches the reversed ratio
  const { width, height } = bounds();
  resizeWindow(height, width);
  rebuildMenu();
}

function updateVars(): void {
  const docStyle = document.documentElement.style;
  docStyle.setProperty("--scaleX", isMirror ? "-1" : "1");
  docStyle.setProperty("--rotate", `${rotation}deg`);
  const shapeVal = shapes.find((s) => s.label === shape)?.val ?? "50%";
  docStyle.setProperty("--radius", shapeVal);
  document.body.classList.toggle("hexagon", shape === "Hexagon");
  document.body.classList.toggle("sideways", deg % 180 !== 0);
}
updateVars();

function toggleMirror(): void {
  isMirror = !isMirror;
  localStorage.setItem("isMirror", String(isMirror));
  updateVars();
  rebuildMenu();
}

function toggleAlwaysOnTop(): void {
  alwaysOnTop = !alwaysOnTop;
  localStorage.setItem("alwaysOnTop", String(alwaysOnTop));
  void win.setAlwaysOnTop(alwaysOnTop);
  rebuildMenu();
}

// ---- Screen light ------------------------------------------------------------

// A separate plain window (light.html) to light your face with a monitor,
// e.g. the second one in fullscreen
function toggleScreenLight(): void {
  if (light) {
    void light.close(); // light.ts saves its bounds, then it is destroyed
    return;
  }
  if (lightOpening) return;
  lightOpening = true;
  const w = new WebviewWindow("light", {
    url: "light.html",
    title: "YouCam Light",
    width: 800,
    height: 600,
    decorations: true,
    transparent: false,
    resizable: true,
    visible: false, // light.ts shows it once its saved bounds are applied
  });
  void w.once("tauri://created", () => {
    lightOpening = false;
    light = w;
    rebuildMenu();
  });
  void w.once("tauri://error", (e) => {
    lightOpening = false;
    console.error("screen light:", e.payload);
  });
  void w.once("tauri://destroyed", () => {
    light = null;
    rebuildMenu();
  });
}

// ---- Background effects ------------------------------------------------------

function setBackground(value: Background): void {
  background = value;
  localStorage.setItem("background", background);
  updateBackground();
  rebuildMenu();
}

// B steps through Off -> Blur -> Dark blur
function cycleBackground(): void {
  const next = (backgrounds.indexOf(background) + 1) % backgrounds.length;
  setBackground(backgrounds[next]);
}

// The effect is drawn on a canvas over the video, so the plain video keeps
// showing while the model loads. backgroundEffect holds a promise of the
// controller from background.ts while an effect is on.
let backgroundEffect: Promise<BackgroundEffect | undefined> | null = null;
function updateBackground(): void {
  const on = background !== "Off";
  document.body.classList.toggle("background-effect", on);
  if (on && !backgroundEffect) {
    backgroundEffect = import("./background")
      .then(({ startBackground }) =>
        startBackground(video, backgroundCanvas, background as BackgroundMode)
      )
      .catch((err) => {
        console.error("background:", err);
        backgroundEffect = null;
        background = "Off";
        localStorage.setItem("background", background);
        document.body.classList.remove("background-effect");
        rebuildMenu();
        alert("could not start the background effect");
        return undefined;
      });
  } else if (on) {
    void backgroundEffect?.then((effect) =>
      effect?.setMode(background as BackgroundMode)
    );
  } else if (backgroundEffect) {
    void backgroundEffect.then((effect) => effect?.stop());
    backgroundEffect = null;
  }
}

// ---- Keyboard ----------------------------------------------------------------

window.addEventListener("keydown", (ev) => {
  if (ev.repeat) return;
  switch (ev.key.toLowerCase()) {
    case "b":
      cycleBackground();
      break;
    case "m":
      toggleMirror();
      break;
    case "r":
      rotate(ev.shiftKey ? -90 : 90);
      break;
    case "t":
      toggleAlwaysOnTop();
      break;
    case "l":
      toggleScreenLight();
      break;
    case "q":
    case "escape":
      void win.close();
      break;
  }
});

// ---- Camera ------------------------------------------------------------------

function refreshDevices(): void {
  navigator.mediaDevices
    .enumerateDevices()
    .then((devices) => {
      videoDevices = devices.filter((device) => device.kind === "videoinput");
      rebuildMenu();
    })
    .catch((err) => {
      console.error(`${err.name}: ${err.message}`);
    });
}
navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
refreshDevices();

let currentStream: MediaStream | undefined;
let videoRequest = 0;
function stopMediaTracks(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

function setVideo(id?: string): void {
  // Lets a slower, outdated request be dropped if the camera is switched again
  const request = ++videoRequest;
  if (currentStream) stopMediaTracks(currentStream);
  // "ideal" lets cameras that can't reach the resolution fall back to the
  // closest mode instead of failing
  const { width, height } =
    qualities.find((q) => q.label === quality) ?? qualities[1];
  const constraints: MediaTrackConstraints = {
    width: { ideal: width },
    height: { ideal: height },
  };
  if (id) {
    constraints.deviceId = { exact: id };
  } else {
    constraints.facingMode = "user";
  }

  navigator.mediaDevices
    .getUserMedia({ video: constraints })
    .then((stream) => {
      if (request !== videoRequest) {
        stopMediaTracks(stream);
        return;
      }
      currentStream = stream;
      video.srcObject = stream;
      currentDeviceId = stream.getVideoTracks()[0]?.getSettings().deviceId;
      if (id) localStorage.setItem("deviceId", id);
      // Device labels may only be exposed once a stream is active
      refreshDevices();
    })
    .catch((err) => {
      if (request !== videoRequest) return;
      console.error(`getUserMedia: ${err.name}: ${err.message}`);
      if (id && err.name === "OverconstrainedError") {
        localStorage.removeItem("deviceId");
        setVideo();
        return;
      }
      alert("could not connect stream");
    });
}
setVideo(localStorage.getItem("deviceId") || undefined);
updateBackground();

// ---- Window size and position --------------------------------------------------

// Drag the frameless window with the left button; the OS does the moving
document.body.addEventListener("mousedown", (ev) => {
  if (ev.button === 0) void win.startDragging();
});

function resizeWindow(width: number, height: number): void {
  void win.setSize(new PhysicalSize(Math.round(width), Math.round(height)));
}

// Window height that matches the selected aspect ratio for the given width
function heightForWidth(width: number, fallback: number): number {
  if (aspectRatio === "None") return fallback;
  const [ratioW, ratioH] = aspectRatio.split(":").map((n) => parseInt(n, 10));
  return Math.round((width / ratioW) * ratioH);
}

function updateAspectRatio(): void {
  const { width, height } = bounds();
  const wanted = heightForWidth(width, height);
  if (wanted !== height) resizeWindow(width, wanted);
}
updateAspectRatio();

// Mouse wheel scales the window around its center, keeping its proportions.
// A burst of wheel events works from its own state, since the window's
// bounds only catch up once each resize has actually happened.
const MIN_SIZE = 140; // logical pixels, for the shorter side
let zoom: { centerX: number; centerY: number; width: number; ratio: number } | null =
  null;
const endZoom = debounced(() => {
  zoom = null;
}, 300);

function zoomWindow(scale: number): void {
  if (!zoom) {
    const b = bounds();
    zoom = {
      centerX: b.x + b.width / 2,
      centerY: b.y + b.height / 2,
      width: b.width,
      ratio: b.height / b.width,
    };
    // Monitors rarely change; refresh the list for the next burst
    void availableMonitors().then((m) => (monitors = m));
  }
  endZoom();
  const area = (monitorAt(monitors, zoom.centerX, zoom.centerY) ?? monitors[0])
    ?.workArea.size;
  const minSize = MIN_SIZE * pixelRatio();
  // Keep both sides between MIN_SIZE and the size of the current monitor,
  // without ever growing on zoom out (or shrinking on zoom in) when the
  // window is already outside those limits
  const minW = Math.min(Math.max(minSize, minSize / zoom.ratio), zoom.width);
  const maxW = area
    ? Math.max(Math.min(area.width, area.height / zoom.ratio), zoom.width)
    : Infinity;
  zoom.width = Math.min(Math.max(zoom.width * scale, minW), maxW);
  const width = Math.round(zoom.width);
  const height = heightForWidth(width, Math.round(width * zoom.ratio));
  resizeWindow(width, height);
  void win.setPosition(
    new PhysicalPosition(
      Math.round(zoom.centerX - width / 2),
      Math.round(zoom.centerY - height / 2)
    )
  );
}

document.body.addEventListener(
  "wheel",
  (ev) => {
    ev.preventDefault(); // also stops Ctrl+wheel from zooming the page
    zoomWindow(Math.exp(-ev.deltaY / 1000)); // ~10% per wheel notch
  },
  { passive: false }
);

// Once a move or resize settles, read the position back (in case an event
// was missed), save the bounds and re-apply the aspect ratio
const onBoundsSettled = debounced(async () => {
  position = await win.outerPosition();
  saveBounds("bounds", bounds());
  updateAspectRatio();
  rebuildMenu(); // refresh the Dimensions check mark
}, 200);

await win.onMoved(({ payload }) => {
  position = payload;
  onBoundsSettled();
});
window.addEventListener("resize", onBoundsSettled);
// Save right away on exit, in case a move is still waiting on the debounce.
// Closing this window quits the app (see src-tauri), screen light included.
await win.onCloseRequested(() => {
  saveBounds("bounds", bounds());
});
