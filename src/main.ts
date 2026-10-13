// The camera window: a frameless, shaped webcam view with a right-click /
// tray menu for what is used most, keyboard shortcuts, and a settings window
// (settings.ts) for everything else.
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
import { emit, listen } from "@tauri-apps/api/event";
import { TrayIcon } from "@tauri-apps/api/tray";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getVersion } from "@tauri-apps/api/app";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { openUrl } from "@tauri-apps/plugin-opener";
import hexagonSvg from "../assets/hexagon.svg?raw";
import trayIconUrl from "../assets/icon-tray.png?url";
import type { BackgroundEffect, BackgroundMode, Crop } from "./background";
import {
  debounced,
  monitorAt,
  restoreBounds,
  saveBounds,
  type Bounds,
} from "./common";
import {
  CHANGE,
  SETTINGS_READY,
  STATE,
  aspectRatios,
  backgrounds,
  borderColors,
  borderWidthRange,
  hideShortcuts,
  isColor,
  opacityRange,
  pictureRange,
  qualities,
  shapes,
  zoomRange,
  type Background,
  type Change,
  type State,
} from "./options";
import {
  languages,
  option,
  savedLanguage,
  setLanguage,
  t,
  type Language,
} from "./i18n";
import "./app.css";

const win = getCurrentWindow();
const video = document.getElementById("camera") as HTMLVideoElement;
const backgroundCanvas = document.getElementById(
  "background"
) as HTMLCanvasElement;

let isMirror = localStorage.getItem("isMirror") === "true";
let alwaysOnTop = localStorage.getItem("alwaysOnTop") !== "false";
let opacity = savedNumber("opacity", opacityRange, 100);
let clickThrough = localStorage.getItem("clickThrough") === "true";
let deg = normalizeDeg(parseInt(localStorage.getItem("deg") ?? "", 10) || 0);
// Unbounded copy of deg for the CSS transform, so the transition always
// turns 90deg the short way (270 -> 360 instead of spinning back to 0)
let rotation = deg;
let shape = localStorage.getItem("shape") ?? "Hexagon";
let aspectRatio = localStorage.getItem("aspectRatio") ?? "1:1";
let videoDevices: MediaDeviceInfo[] = [];
let currentDeviceId: string | undefined;
let quality = localStorage.getItem("quality") ?? "720p";
let background = localStorage.getItem("background") as Background;
if (!backgrounds.includes(background)) background = "Blur";
let light: WebviewWindow | null = null; // the screen light while it is open
let lightOpening = false;
let hideShortcut = localStorage.getItem("hideShortcut") ?? "";
if (!hideShortcuts.some((s) => s.label === hideShortcut)) {
  hideShortcut = hideShortcuts[0].label;
}
let shortcutTaken = false; // by another app
let language = savedLanguage(); // already applied by i18n.ts
let hidden = false;
let brightness = savedNumber("brightness", pictureRange, 100);
let contrast = savedNumber("contrast", pictureRange, 100);
let blackAndWhite = localStorage.getItem("blackAndWhite") === "true";
// "off" or a colour; the last one picked in the settings window is kept for
// its custom swatch
let borderColor = savedColor("borderColor") ?? "off";
let customBorderColor = savedColor("borderCustomColor") ?? "#ffffff";
let borderWidth = savedNumber("borderWidth", borderWidthRange, borderWidthRange.initial);
// Whether to ask GitHub for a new version (see checkForUpdate), and a newer
// one than this once it is found
let checkUpdates = localStorage.getItem("checkUpdates") !== "false";
const version = await getVersion();
let newVersion = "";

// Digital zoom, and the point of the camera image to keep in the middle of
// the window as far as the image's edges allow, in fractions of its width
// and height
interface Framing {
  zoom: number;
  x: number;
  y: number;
}
// What it starts as: the whole picture, bottom-aligned
const WHOLE_PICTURE: Framing = { zoom: 1, x: 0.5, y: 1 };
let framing: Framing = {
  zoom: savedNumber("zoom", zoomRange, WHOLE_PICTURE.zoom),
  x: savedNumber("framingX", { min: 0, max: 1 }, WHOLE_PICTURE.x),
  y: savedNumber("framingY", { min: 0, max: 1 }, WHOLE_PICTURE.y),
};

function savedNumber(
  key: string,
  range: { min: number; max: number },
  fallback: number
): number {
  const value = parseFloat(localStorage.getItem(key) ?? "");
  return Number.isFinite(value) ? Math.min(Math.max(value, range.min), range.max) : fallback;
}

function savedColor(key: string): string | undefined {
  const value = localStorage.getItem(key);
  return isColor(value) ? value : undefined;
}

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
await win.setIgnoreCursorEvents(clickThrough);

// ---- Menu (right-click and tray) -------------------------------------------

interface MenuEntry {
  label?: string;
  checked?: boolean; // makes it a check item
  action?: () => void;
  submenu?: MenuEntry[];
  separator?: boolean;
}

// Only what is used most; everything else is in the settings window
function buildMenuEntries(): MenuEntry[] {
  return [
    {
      label: t("menu.camera"),
      submenu: videoDevices.map((device, i) => ({
        label: cameraName(device, i),
        checked: device.deviceId === currentDeviceId,
        action: () => setVideo(device.deviceId),
      })),
    },
    {
      label: t("menu.background"),
      submenu: backgrounds.map((bg) => ({
        label: option("background", bg),
        checked: background === bg,
        action: () => setBackground(bg),
      })),
    },
    { label: t("menu.mirror"), checked: isMirror, action: toggleMirror },
    {
      label: t("menu.screenLight"),
      checked: light !== null,
      action: toggleScreenLight,
    },
    // Turned off from the tray menu, as this window then can't be clicked
    {
      label: t("menu.clickThrough"),
      checked: clickThrough,
      action: () => setClickThrough(!clickThrough),
    },
    { separator: true },
    { label: t("menu.settings"), action: () => void openSettings() },
    ...(newVersion
      ? [{ label: t("menu.download", { version: newVersion }), action: openDownloadPage }]
      : []),
    // Only the tray menu is there while the window is hidden
    {
      label: hidden ? t("menu.show") : t("menu.hide"),
      action: () => void setHidden(!hidden),
    },
    { separator: true },
    { label: t("menu.exit"), action: () => win.close() },
  ];
}

// Device labels may be empty until the camera has been allowed
function cameraName(device: MediaDeviceInfo, i: number): string {
  return device.label || t("camera.unnamed", { n: i + 1 });
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
      action: () => {
        // Clicking toggles the mark by itself, so put the marks back where
        // the state says even if the click changed nothing
        menuSignature = "";
        entry.action?.();
        rebuildMenu();
      },
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
// The menu as last built, without its actions
let menuSignature = "";

// Rebuilds run one after another, and several requests made while one is
// waiting collapse into a single rebuild with the latest state. Most changes
// (e.g. dragging a slider in the settings window) don't show in the menu
// and don't rebuild it.
function rebuildMenu(): Promise<void> {
  if (rebuildPending) return menuQueue;
  rebuildPending = true;
  menuQueue = menuQueue
    .then(async () => {
      rebuildPending = false;
      const entries = buildMenuEntries();
      const signature = JSON.stringify(entries);
      if (signature === menuSignature) return;
      menuSignature = signature;
      const created: MenuResource[] = [];
      const items = await Promise.all(entries.map((e) => createItem(e, created)));
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
      void setHidden(!hidden);
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
  stateChanged();
}

function updateVars(): void {
  const docStyle = document.documentElement.style;
  docStyle.setProperty("--scaleX", isMirror ? "-1" : "1");
  docStyle.setProperty("--rotate", `${rotation}deg`);
  const radius = shapes.find((s) => s.label === shape)?.radius ?? "50%";
  docStyle.setProperty("--radius", radius);
  document.body.classList.toggle("hexagon", shape === "Hexagon");
  document.body.classList.toggle("sideways", deg % 180 !== 0);
  updateFraming(); // turning sideways swaps the video's box
}
updateVars();

function setMirror(value: boolean): void {
  isMirror = value;
  localStorage.setItem("isMirror", String(isMirror));
  updateVars();
  stateChanged();
}

function toggleMirror(): void {
  setMirror(!isMirror);
}

function setShape(value: string): void {
  shape = value;
  localStorage.setItem("shape", shape);
  updateVars();
  stateChanged();
}

// ---- Framing: digital zoom and moving the picture ---------------------------

// The part of the camera image shown in a box of the given size (only its
// proportions count): what object-fit: cover would show, made smaller by the
// zoom, with its middle as close to the framing point as the edges allow
function cropFor(width: number, height: number, f = framing): Crop {
  const { videoWidth, videoHeight } = video;
  const scale = Math.min(videoWidth / width, videoHeight / height) / f.zoom;
  const sw = width * scale;
  const sh = height * scale;
  const start = (middle: number, size: number, whole: number) =>
    Math.min(Math.max(middle * whole - size / 2, 0), whole - size);
  return { sx: start(f.x, sw, videoWidth), sy: start(f.y, sh, videoHeight), sw, sh };
}

// What the video shows now; undefined until the camera has a picture
function shownCrop(): Crop | undefined {
  const { videoWidth, clientWidth, clientHeight } = video;
  return videoWidth && clientWidth && clientHeight
    ? cropFor(clientWidth, clientHeight)
    : undefined;
}

// The background effect draws the same crop itself (see updateBackground)
function updateFraming(): void {
  const crop = shownCrop();
  let viewBox = "none";
  if (crop) {
    const { videoWidth: w, videoHeight: h } = video;
    const { sx, sy, sw, sh } = crop;
    const percent = (part: number, whole: number) =>
      `${((part / whole) * 100).toFixed(4)}%`;
    viewBox = `inset(${percent(sy, h)} ${percent(w - sx - sw, w)} ${percent(h - sy - sh, h)} ${percent(sx, w)})`;
  }
  document.documentElement.style.setProperty("--view-box", viewBox);
}
// The camera's picture changes size with the camera and the quality, the
// box with the window
video.addEventListener("resize", () => {
  updateFraming();
  stateChanged(); // for zoomSoft()
});
window.addEventListener("resize", updateFraming);

function setFraming(value: Framing): void {
  framing = value;
  localStorage.setItem("zoom", String(framing.zoom));
  localStorage.setItem("framingX", String(framing.x));
  localStorage.setItem("framingY", String(framing.y));
  updateFraming();
  stateChanged();
}

function resetFraming(): void {
  setFraming(WHOLE_PICTURE);
}

// A move on the screen as a move across the picture, which may be mirrored
// and turned
function onPicture(x: number, y: number): [number, number] {
  const mx = isMirror ? -x : x;
  const cos = Math.round(Math.cos((deg * Math.PI) / 180));
  const sin = Math.round(Math.sin((deg * Math.PI) / 180));
  return [cos * mx + sin * y, cos * y - sin * mx];
}

// Zooms to `zoom`, keeping the point (atX, atY) CSS pixels from the middle
// of the window in place (the mouse, or the middle itself), and moves the
// picture by (byX, byY). What is saved is where the edges of the image
// stopped it, so moving back from an edge starts at once.
function reframe(zoom: number, atX = 0, atY = 0, byX = 0, byY = 0): void {
  if (!Number.isFinite(zoom)) return;
  zoom = Math.min(Math.max(zoom, zoomRange.min), zoomRange.max);
  const shown = shownCrop();
  if (!shown) {
    setFraming({ ...framing, zoom });
    return;
  }
  const { videoWidth, videoHeight, clientWidth, clientHeight } = video;
  const perPixel = shown.sw / clientWidth; // camera pixels per CSS pixel
  const [ax, ay] = onPicture(atX, atY);
  const [bx, by] = onPicture(byX, byY);
  // The point at (ax, ay) is that far from the middle at the new zoom too
  const keep = 1 - framing.zoom / zoom;
  const crop = cropFor(clientWidth, clientHeight, {
    zoom,
    x: (shown.sx + shown.sw / 2 + (ax * keep - bx) * perPixel) / videoWidth,
    y: (shown.sy + shown.sh / 2 + (ay * keep - by) * perPixel) / videoHeight,
  });
  // Already at an edge, or at the end of the zoom range
  const moved =
    Math.abs(crop.sx - shown.sx) > 0.01 || Math.abs(crop.sy - shown.sy) > 0.01;
  if (zoom === framing.zoom && !moved) return;
  setFraming({
    zoom,
    x: (crop.sx + crop.sw / 2) / videoWidth,
    y: (crop.sy + crop.sh / 2) / videoHeight,
  });
}

// Zoomed in so far that the window has more pixels across than the part of
// the camera image it shows, while a higher quality would give it more
function zoomSoft(): boolean {
  const crop = shownCrop();
  return (
    crop !== undefined &&
    framing.zoom > 1 &&
    quality !== qualities[qualities.length - 1].label &&
    crop.sw < video.clientWidth * pixelRatio()
  );
}

// ---- Image and border ----------------------------------------------------------

// The filter goes on the video and on the background effect's canvas
function updateImage(): void {
  const filters: string[] = [];
  if (brightness !== 100) filters.push(`brightness(${brightness}%)`);
  if (contrast !== 100) filters.push(`contrast(${contrast}%)`);
  if (blackAndWhite) filters.push("grayscale(1)");
  document.documentElement.style.setProperty("--filter", filters.join(" ") || "none");
}
updateImage();

function setPicture(
  key: "brightness" | "contrast" | "blackAndWhite",
  value: number | boolean
): void {
  if (key === "blackAndWhite") {
    blackAndWhite = value === true;
    localStorage.setItem(key, String(blackAndWhite));
  } else {
    const percent = Math.min(Math.max(Number(value), pictureRange.min), pictureRange.max);
    if (!Number.isFinite(percent)) return;
    if (key === "brightness") brightness = percent;
    else contrast = percent;
    localStorage.setItem(key, String(percent));
  }
  updateImage();
  stateChanged();
}

// The hexagon's outline, from the same file as its mask
const hexagonPath = /\sd="([^"]+)"/.exec(hexagonSvg)?.[1] ?? "";
const hexagonViewBox = /viewBox="([^"]+)"/.exec(hexagonSvg)?.[1] ?? "0 0 196 196";
const hexagonSize = Number(hexagonViewBox.split(" ")[2]);

// The hexagon can't take a border-radius shape's inset box-shadow, so its
// border is a mask: the closed outline stroked twice as wide and cut to the
// hexagon, which leaves the inner half, laid over the video like its mask
function hexagonBorderMask(widthPercent: number): string {
  const d = `${hexagonPath}Z`;
  const stroke = ((widthPercent / 100) * hexagonSize * 2).toFixed(2);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${hexagonSize}" height="${hexagonSize}" viewBox="${hexagonViewBox}">` +
    `<clipPath id="c"><path d="${d}"/></clipPath>` +
    `<path d="${d}" fill="none" stroke="#000" stroke-width="${stroke}" clip-path="url(#c)"/>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function updateBorder(): void {
  const on = borderColor !== "off";
  document.body.classList.toggle("bordered", on);
  if (!on) return;
  const docStyle = document.documentElement.style;
  docStyle.setProperty("--border-color", borderColor);
  docStyle.setProperty("--border-width", `${borderWidth}vmin`);
  docStyle.setProperty("--border-mask", hexagonBorderMask(borderWidth));
}
updateBorder();

function setBorderColor(value: string): void {
  if (value !== "off" && !isColor(value)) return;
  borderColor = value;
  localStorage.setItem("borderColor", borderColor);
  if (isColor(value) && !borderColors.some((c) => c.color === value)) {
    customBorderColor = value;
    localStorage.setItem("borderCustomColor", customBorderColor);
  }
  updateBorder();
  stateChanged();
}

function setBorderWidth(value: number): void {
  const { min, max } = borderWidthRange;
  if (!Number.isFinite(value)) return;
  borderWidth = Math.min(Math.max(value, min), max);
  localStorage.setItem("borderWidth", String(borderWidth));
  updateBorder();
  stateChanged();
}

function setAlwaysOnTop(value: boolean): void {
  alwaysOnTop = value;
  localStorage.setItem("alwaysOnTop", String(alwaysOnTop));
  void win.setAlwaysOnTop(alwaysOnTop);
  stateChanged();
}

function toggleAlwaysOnTop(): void {
  setAlwaysOnTop(!alwaysOnTop);
}

function updateOpacity(): void {
  document.documentElement.style.setProperty("--opacity", String(opacity / 100));
}
updateOpacity();

function setOpacity(value: number): void {
  if (!Number.isFinite(value)) return;
  opacity = Math.min(Math.max(value, opacityRange.min), opacityRange.max);
  localStorage.setItem("opacity", String(opacity));
  updateOpacity();
  stateChanged();
}

// Clicks, the wheel and right-clicks go to whatever is under the window, e.g.
// a game, so it can't be dragged, resized or right-clicked meanwhile
function setClickThrough(value: boolean): void {
  clickThrough = value;
  localStorage.setItem("clickThrough", String(clickThrough));
  void win.setIgnoreCursorEvents(clickThrough);
  if (clickThrough) showClickThroughNotice();
  stateChanged();
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
    title: t("title.light"),
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
    stateChanged();
  });
  void w.once("tauri://error", (e) => {
    lightOpening = false;
    console.error("screen light:", e.payload);
  });
  void w.once("tauri://destroyed", () => {
    light = null;
    stateChanged();
  });
}

// ---- Settings window -----------------------------------------------------------

// Logical pixels
const SETTINGS_WIDTH = 400;
const SETTINGS_HEIGHT = 504; // the tallest tab, Shape, without scrolling

// Opens it next to the camera window, so changes can be seen while making
// them, or brings it to the front if it is open (also after a dev-server
// reload of this page)
async function openSettings(): Promise<void> {
  const open = await WebviewWindow.getByLabel("settings");
  if (open) {
    await open.unminimize();
    await open.setFocus();
    return;
  }
  const w = new WebviewWindow("settings", {
    url: "settings.html",
    title: t("title.settings"),
    width: SETTINGS_WIDTH,
    height: SETTINGS_HEIGHT,
    minWidth: 360,
    minHeight: 360,
    resizable: true,
    visible: false, // settings.ts shows it once it has the state
  });
  void w.once("tauri://created", async () => {
    const at = await besideCamera();
    if (at) await w.setPosition(at);
  });
  void w.once("tauri://error", (e) => console.error("settings:", e.payload));
}

// Beside the camera window on whichever side has room, top edges lined up,
// within the monitor; centred on it if neither side has room
async function besideCamera(): Promise<PhysicalPosition | undefined> {
  monitors = await availableMonitors();
  const b = bounds();
  const monitor = monitorAt(monitors, b.x + b.width / 2, b.y + b.height / 2) ?? monitors[0];
  if (!monitor) return undefined;
  const { position: area, size: areaSize } = monitor.workArea;
  const width = SETTINGS_WIDTH * monitor.scaleFactor;
  const height = SETTINGS_HEIGHT * monitor.scaleFactor;
  const gap = 16 * monitor.scaleFactor;
  let x = b.x + b.width + gap;
  if (x + width > area.x + areaSize.width) x = b.x - gap - width;
  if (x < area.x) x = area.x + (areaSize.width - width) / 2;
  const y = Math.min(Math.max(b.y, area.y), area.y + areaSize.height - height);
  return new PhysicalPosition(Math.round(x), Math.round(Math.max(y, area.y)));
}

function currentState(): State {
  return {
    deviceId: currentDeviceId ?? "",
    quality,
    mirror: isMirror,
    shape,
    aspectRatio,
    zoom: framing.zoom,
    background,
    brightness,
    contrast,
    blackAndWhite,
    borderColor,
    borderWidth,
    alwaysOnTop,
    opacity,
    clickThrough,
    screenLight: light !== null,
    hideShortcut,
    language,
    checkUpdates,
    cameras: videoDevices.map((device, i) => ({
      deviceId: device.deviceId,
      label: cameraName(device, i),
    })),
    width: Math.round(window.innerWidth),
    height: Math.round(window.innerHeight),
    customBorderColor,
    shortcutTaken,
    reframed:
      framing.zoom !== WHOLE_PICTURE.zoom ||
      framing.x !== WHOLE_PICTURE.x ||
      framing.y !== WHOLE_PICTURE.y,
    zoomSoft: zoomSoft(),
    version,
    newVersion,
  };
}

// Something changed: update the menu and the settings window. Changes made
// together (e.g. by one drag of a slider) are sent once.
let statePending = false;
function stateChanged(): void {
  rebuildMenu();
  if (statePending) return;
  statePending = true;
  setTimeout(() => {
    statePending = false;
    void emit(STATE, currentState());
  });
}

function applyChange(change: Change): void {
  switch (change.key) {
    case "deviceId":
      setVideo(change.value || undefined);
      break;
    case "quality":
      setQuality(change.value);
      break;
    case "mirror":
      setMirror(change.value);
      break;
    case "shape":
      setShape(change.value);
      break;
    case "aspectRatio":
      setAspectRatio(change.value);
      break;
    case "zoom":
      reframe(change.value);
      break;
    case "resetFraming":
      resetFraming();
      break;
    case "background":
      setBackground(change.value);
      break;
    case "brightness":
    case "contrast":
    case "blackAndWhite":
      setPicture(change.key, change.value);
      break;
    case "borderColor":
      setBorderColor(change.value);
      break;
    case "borderWidth":
      setBorderWidth(change.value);
      break;
    case "alwaysOnTop":
      setAlwaysOnTop(change.value);
      break;
    case "opacity":
      setOpacity(change.value);
      break;
    case "clickThrough":
      setClickThrough(change.value);
      break;
    case "screenLight":
      if (change.value !== (light !== null)) toggleScreenLight();
      break;
    case "hideShortcut":
      setHideShortcut(change.value);
      break;
    case "language":
      changeLanguage(change.value);
      break;
    case "checkUpdates":
      setCheckUpdates(change.value);
      break;
    case "download":
      openDownloadPage();
      break;
    case "rotate":
      rotate(change.value);
      break;
    case "size":
      setWidth(change.value);
      break;
  }
}

// Every window follows the language: this one's menu and messages here, the
// settings window and the screen light when they get the new state
function changeLanguage(value: Language): void {
  if (!languages.includes(value)) return;
  language = value;
  localStorage.setItem("language", language);
  setLanguage(language);
  if (cameraProblem) setCameraMessage(messageFor(cameraProblem));
  stateChanged();
}

await listen(SETTINGS_READY, () => void emit(STATE, currentState()));
await listen<Change>(CHANGE, ({ payload }) => applyChange(payload));

// ---- Messages ----------------------------------------------------------------

// Shown in the window, in its shape: what is wrong with the camera while it
// is not working, or a short notice that goes away by itself
interface Message {
  title: string;
  hint?: string;
  actions?: { label: string; action: () => void }[];
}

const statusBox = document.getElementById("status") as HTMLDivElement;
let cameraMessage: Message | null = null;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;

function renderMessage(message: Message | null): void {
  statusBox.hidden = !message;
  statusBox.replaceChildren();
  if (!message) return;
  const title = document.createElement("strong");
  title.textContent = message.title;
  statusBox.append(title);
  if (message.hint) {
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = message.hint;
    statusBox.append(hint);
  }
  for (const { label, action } of message.actions ?? []) {
    const button = document.createElement("button");
    button.textContent = label;
    button.addEventListener("click", action);
    statusBox.append(button);
  }
}

function setCameraMessage(message: Message | null): void {
  // Each retry repeats the message; rendering it again would swallow a click
  // in progress on its buttons (JSON leaves the actions out, their labels in)
  if (JSON.stringify(message) === JSON.stringify(cameraMessage)) return;
  cameraMessage = message;
  clearTimeout(noticeTimer);
  renderMessage(message);
}

// Returns whether it was shown
function showNotice(message: Message, ms = 4000): boolean {
  if (cameraMessage) return false; // the camera not working matters more
  clearTimeout(noticeTimer);
  renderMessage(message);
  noticeTimer = setTimeout(() => renderMessage(null), ms);
  return true;
}

// Says how to get the window back, which otherwise looks stuck
function showClickThroughNotice(): void {
  showNotice({ title: t("message.clickThrough"), hint: t("message.clickThroughHint") });
}
// Also at start, when it is still on from last time
if (clickThrough) showClickThroughNotice();

// ---- Hiding ------------------------------------------------------------------

// The camera is off while the window is hidden, leaving the CPU (and the
// camera) to other apps, e.g. a game. focus: false shows the window without
// taking the focus from the app in front: the shortcut may be pressed in a
// game, which would lose its keys to this window (and Q would close it).
async function setHidden(value: boolean, focus = true): Promise<void> {
  if (value === hidden) {
    if (!hidden && focus) await win.setFocus(); // brings it to the front
    return;
  }
  hidden = value;
  stateChanged();
  setVideo(currentDeviceId); // stops the camera while hidden
  if (hidden) {
    await win.hide();
    return;
  }
  // Rather than an empty shape until the camera has started
  await firstFrame();
  if (hidden) return; // hidden again in the meantime
  if (focus) {
    await win.show();
    await win.setFocus();
  } else {
    // On Windows show() also activates the window, unless it can't take
    // the focus
    await win.setFocusable(false);
    await win.show();
    await win.setFocusable(true);
  }
}

// Resolves once the video plays, or after a while if it doesn't (the camera
// message is up then)
function firstFrame(): Promise<void> {
  return new Promise((resolve) => {
    video.addEventListener("playing", () => resolve(), { once: true });
    setTimeout(resolve, 1500);
  });
}

// Registrations run one after another, so a quick change of mind can't
// leave two shortcuts registered
let shortcutQueue: Promise<void> = Promise.resolve();
function applyHideShortcut(): void {
  shortcutQueue = shortcutQueue.then(async () => {
    // Also drops the one a previous page load registered (a dev-server reload)
    await unregisterAll().catch((err) => console.error("shortcut:", err));
    const { label, accelerator } =
      hideShortcuts.find((s) => s.label === hideShortcut) ?? hideShortcuts[0];
    shortcutTaken = false;
    if (accelerator) {
      try {
        await register(accelerator, (event) => {
          if (event.state === "Pressed") void setHidden(!hidden, false);
        });
      } catch (err) {
        console.error("shortcut:", err);
        shortcutTaken = true;
        showNotice({
          title: t("message.shortcutTaken", { shortcut: label }),
          hint: t("message.shortcutTakenHint"),
        });
      }
    }
    stateChanged();
  });
}
applyHideShortcut();

function setHideShortcut(label: string): void {
  if (!hideShortcuts.some((s) => s.label === label)) return;
  hideShortcut = label;
  localStorage.setItem("hideShortcut", label);
  applyHideShortcut();
}

// Starting YouCam again (e.g. from the Start menu while it is hidden) brings
// this window back instead of opening a second one (see src-tauri). Not
// awaited: events must wait until the rest of this page is set up.
void listen("youcam:second-instance", () => void setHidden(false));

// ---- New versions --------------------------------------------------------------

// Unless it is turned off, YouCam asks GitHub for its latest release at start
// and once a day; nothing else is sent. A newer one is offered in the menu
// and the settings window, and said once in a notice.
const LATEST_RELEASE = "https://api.github.com/repos/codesignist/YouCam/releases/latest";
// The only page YouCam may open (see src-tauri/capabilities)
const DOWNLOAD_PAGE = "https://github.com/codesignist/YouCam/releases/latest";

// "2.1.0" or "v2.1.0" as numbers to compare
function versionParts(value: string): number[] | undefined {
  return /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value)?.slice(1).map(Number);
}

function isNewer(a: string, b: string): boolean {
  const [pa, pb] = [versionParts(a), versionParts(b)];
  if (!pa || !pb) return false;
  const i = pa.findIndex((n, j) => n !== pb[j]);
  return i >= 0 && pa[i] > pb[i];
}

async function checkForUpdate(): Promise<void> {
  if (!checkUpdates) return;
  let latest: string;
  try {
    const response = await fetch(LATEST_RELEASE, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const release: { tag_name?: unknown } = await response.json();
    latest = String(release.tag_name ?? "").replace(/^v/, "");
  } catch (err) {
    console.error("update check:", err); // e.g. offline; asked again tomorrow
    return;
  }
  if (!checkUpdates) return; // turned off while asking
  const found = isNewer(latest, version) ? latest : "";
  if (found !== newVersion) {
    newVersion = found;
    stateChanged();
  }
  if (!found || hidden || localStorage.getItem("updateNotice") === found) return;
  const shown = showNotice(
    {
      title: t("message.newVersion", { version: found }),
      hint: t("message.newVersionHint"),
      actions: [
        {
          label: t("message.download"),
          action: () => {
            renderMessage(null);
            openDownloadPage();
          },
        },
      ],
    },
    10000
  );
  // Once for each version; the menu keeps offering it
  if (shown) localStorage.setItem("updateNotice", found);
}

function openDownloadPage(): void {
  openUrl(DOWNLOAD_PAGE).catch((err) => console.error("download page:", err));
}

function setCheckUpdates(value: boolean): void {
  checkUpdates = value;
  localStorage.setItem("checkUpdates", String(checkUpdates));
  if (checkUpdates) void checkForUpdate();
  else newVersion = "";
  stateChanged();
}

void checkForUpdate();
setInterval(() => void checkForUpdate(), 24 * 60 * 60 * 1000);

// ---- Background effects ------------------------------------------------------

function setBackground(value: Background): void {
  if (!backgrounds.includes(value)) return;
  background = value;
  localStorage.setItem("background", background);
  updateBackground();
  stateChanged();
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
        startBackground(video, backgroundCanvas, background as BackgroundMode, cropFor)
      )
      .catch((err) => {
        console.error("background:", err);
        backgroundEffect = null;
        background = "Off";
        localStorage.setItem("background", background);
        document.body.classList.remove("background-effect");
        stateChanged();
        showNotice({
          title: t("message.backgroundFailed"),
          hint: t("message.backgroundFailedHint"),
        });
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
    case "h":
      void setHidden(true);
      break;
    case "s":
      void openSettings();
      break;
    case "0":
      resetFraming();
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
      stateChanged();
    })
    .catch((err) => {
      console.error(`${err.name}: ${err.message}`);
    });
}
let currentStream: MediaStream | undefined;
let videoRequest = 0;
function stopMediaTracks(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

// orDefault: at startup, a saved camera that is gone gives way to the
// default one. Otherwise a camera that can't be used is waited for.
function setVideo(id?: string, orDefault = false): void {
  // Lets a slower, outdated request be dropped if the camera is switched again
  const request = ++videoRequest;
  // The camera picked is the one to wait for if it doesn't work, and the one
  // the menu checks
  if (id !== currentDeviceId) {
    currentDeviceId = id;
    stateChanged();
  }
  stopWaiting();
  if (currentStream) stopMediaTracks(currentStream);
  if (hidden) {
    // Started again when the window is shown
    currentStream = undefined;
    video.srcObject = null;
    return;
  }
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
      const track = stream.getVideoTracks()[0];
      currentDeviceId = track?.getSettings().deviceId;
      // Fires when the camera goes away (e.g. unplugged), not when YouCam
      // stops it
      track?.addEventListener("ended", () => {
        if (stream === currentStream) cameraDown("missing");
      });
      if (id) localStorage.setItem("deviceId", id);
      document.body.classList.remove("camera-off");
      cameraProblem = undefined;
      setCameraMessage(null);
      // Device labels may only be exposed once a stream is active
      refreshDevices();
    })
    .catch((err) => {
      if (request !== videoRequest) return;
      console.error(`getUserMedia: ${err.name}: ${err.message}`);
      if (orDefault && id && err.name === "OverconstrainedError") {
        localStorage.removeItem("deviceId");
        setVideo();
        return;
      }
      cameraDown(problemOf(err.name));
    });
}

type CameraProblem = "denied" | "missing" | "busy" | "failed";
// While the camera is down, so its message can change language
let cameraProblem: CameraProblem | undefined;

function problemOf(errorName: string): CameraProblem {
  switch (errorName) {
    case "NotAllowedError": // by WebView2 or Windows' privacy settings
    case "SecurityError":
      return "denied";
    case "NotFoundError":
    case "OverconstrainedError": // the exact deviceId isn't there
      return "missing";
    case "NotReadableError": // on Windows: another app has the camera
      return "busy";
    default:
      return "failed";
  }
}

function messageFor(problem: CameraProblem): Message {
  const tryAgain = { label: t("message.tryAgain"), action: () => setVideo(currentDeviceId) };
  switch (problem) {
    case "denied":
      return {
        title: t("message.denied"),
        hint: t("message.deniedHint"),
        actions: [tryAgain],
      };
    case "missing":
      return currentDeviceId
        ? { title: t("message.disconnected"), hint: t("message.disconnectedHint") }
        : { title: t("message.noCamera"), hint: t("message.noCameraHint") };
    case "busy": {
      const picked = videoDevices.find((d) => d.deviceId === currentDeviceId);
      if (picked && /OBS Virtual Camera/i.test(picked.label)) {
        // It can't be opened until it is started in OBS
        return { title: t("message.obsOff"), hint: t("message.obsOffHint") };
      }
      // OBS usually keeps the camera it records to itself, but can pass the
      // picture on through its Virtual Camera
      const obs = videoDevices.find(
        (d) => /OBS Virtual Camera/i.test(d.label) && d.deviceId !== currentDeviceId
      );
      return obs
        ? {
            title: t("message.busy"),
            hint: t("message.busyObsHint"),
            actions: [{ label: t("message.useObs"), action: () => setVideo(obs.deviceId) }],
          }
        : { title: t("message.busy"), hint: t("message.busyHint") };
    }
    case "failed":
      return {
        title: t("message.failed"),
        hint: t("message.failedHint"),
        actions: [tryAgain],
      };
  }
}

// Says what is wrong in the window and, unless only the user can fix it,
// keeps trying to connect
function cameraDown(problem: CameraProblem): void {
  if (currentStream) stopMediaTracks(currentStream);
  currentStream = undefined;
  video.srcObject = null;
  document.body.classList.add("camera-off");
  cameraProblem = problem;
  setCameraMessage(messageFor(problem));
  if (problem !== "denied") waitForCamera();
}

// While the camera is down: how often to try again. Nothing tells when a busy
// camera is free, and a camera plugged back in may not be ready at once.
const RETRY_MS = 3000;
let waiting = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

function waitForCamera(): void {
  waiting = true;
  clearTimeout(retryTimer);
  retryTimer = setTimeout(retryCamera, RETRY_MS);
}

function stopWaiting(): void {
  waiting = false;
  clearTimeout(retryTimer);
}

// Only asks for the camera once it is listed, so an unplugged one isn't
// opened (and failed) over and over
async function retryCamera(): Promise<void> {
  if (!waiting) return;
  clearTimeout(retryTimer);
  const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
  if (!waiting) return; // another retry or a camera picked from the menu
  const cameras = devices.filter((device) => device.kind === "videoinput");
  const there = currentDeviceId
    ? cameras.some((device) => device.deviceId === currentDeviceId)
    : cameras.length > 0;
  if (there) setVideo(currentDeviceId);
  else waitForCamera();
}

// Plugging a camera in fires devicechange more than once
const retrySoon = debounced(() => void retryCamera(), 1000);
navigator.mediaDevices.addEventListener("devicechange", () => {
  refreshDevices();
  retrySoon();
});
refreshDevices();

function setQuality(value: string): void {
  if (!qualities.some((q) => q.label === value)) return;
  quality = value;
  localStorage.setItem("quality", quality);
  setVideo(currentDeviceId);
  stateChanged();
}

setVideo(localStorage.getItem("deviceId") || undefined, true);
updateBackground();

// ---- Window size and position --------------------------------------------------

// Drag the frameless window with the left button; the OS does the moving.
// With Ctrl held, the drag moves the picture instead. The status message's
// buttons are there to be clicked instead.
let panFrom: { x: number; y: number } | null = null;
document.body.addEventListener("mousedown", (ev) => {
  if (ev.button !== 0 || (ev.target as Element).closest("button")) return;
  if (ev.ctrlKey) {
    ev.preventDefault();
    panFrom = { x: ev.clientX, y: ev.clientY };
    document.body.classList.add("panning");
  } else {
    void win.startDragging();
  }
});

// The mouse keeps being followed outside the window while the button is held
window.addEventListener("mousemove", (ev) => {
  if (!panFrom) return;
  if (!(ev.buttons & 1)) {
    endPan(); // let go where the mouseup wasn't seen
    return;
  }
  reframe(framing.zoom, 0, 0, ev.clientX - panFrom.x, ev.clientY - panFrom.y);
  panFrom = { x: ev.clientX, y: ev.clientY };
});
window.addEventListener("mouseup", () => endPan());

function endPan(): void {
  panFrom = null;
  document.body.classList.remove("panning");
}

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

function setAspectRatio(value: string): void {
  if (!aspectRatios.includes(value)) return;
  aspectRatio = value;
  localStorage.setItem("aspectRatio", aspectRatio);
  updateAspectRatio();
  stateChanged();
}

// Width in logical pixels; the height follows the aspect ratio
function setWidth(logical: number): void {
  const width = logical * pixelRatio();
  resizeWindow(width, heightForWidth(width, width));
}

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

// With Ctrl, the wheel zooms the picture where the mouse is instead
document.body.addEventListener(
  "wheel",
  (ev) => {
    ev.preventDefault(); // also stops Ctrl+wheel from zooming the page
    const scale = Math.exp(-ev.deltaY / 1000); // ~10% per wheel notch
    if (ev.ctrlKey) {
      reframe(
        framing.zoom * scale,
        ev.clientX - window.innerWidth / 2,
        ev.clientY - window.innerHeight / 2
      );
    } else {
      zoomWindow(scale);
    }
  },
  { passive: false }
);

// Once a move or resize settles, read the position back (in case an event
// was missed), save the bounds and re-apply the aspect ratio
const onBoundsSettled = debounced(async () => {
  position = await win.outerPosition();
  saveBounds("bounds", bounds());
  updateAspectRatio();
  stateChanged(); // the settings window shows the size
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
