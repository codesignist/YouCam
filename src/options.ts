// The camera window's settings and their choices, shared by the camera window
// (main.ts) and the settings window (settings.ts), and what the two tell each
// other as Tauri events.
import type { Language } from "./i18n";

export const qualities = [
  { label: "480p", width: 640, height: 480 },
  { label: "720p", width: 1280, height: 720 },
  { label: "1080p", width: 1920, height: 1080 },
];

export const shapes = [
  { label: "Square", radius: "0.1px" },
  { label: "Rounded", radius: "16px" },
  { label: "Circle", radius: "50%" },
  { label: "Hexagon", radius: "50%" },
];

// The camera's opacity in percent; below 100 what is under it shows through
export const opacityRange = { min: 20, max: 100, step: 5 };

// Window widths in logical pixels; the mouse wheel gives any size in between
export const sizes = [
  { label: "Small", width: 240 },
  { label: "Medium", width: 360 },
  { label: "Large", width: 480 },
];

// "None" lets the window take any shape
export const aspectRatios = ["None", "1:1", "3:4", "4:3", "16:9"];

export const backgrounds = ["Off", "Blur", "Dark blur"] as const;
export type Background = (typeof backgrounds)[number];

// Brightness and contrast in percent; 100 leaves the picture as it is
export const pictureRange = { min: 50, max: 200, step: 5 };

// Digital zoom, as a factor of the whole picture. The window is usually much
// smaller than the camera image, so zooming in mostly uses pixels that would
// otherwise be scaled away.
export const zoomRange = { min: 1, max: 3, step: 0.1 };

// A coloured border along the shape, as streamers often put around their
// camera. Green is YouCam's own.
export const borderColors = [
  { label: "White", color: "#ffffff" },
  { label: "Black", color: "#000000" },
  { label: "Red", color: "#ff3b30" },
  { label: "Yellow", color: "#ffcc00" },
  { label: "Green", color: "#20be86" },
  { label: "Cyan", color: "#00c7e6" },
  { label: "Blue", color: "#2f7bff" },
  { label: "Purple", color: "#8e5cff" },
  { label: "Pink", color: "#ff2d92" },
];

// Border width in percent of the window's shorter side, so it scales with
// the window
export const borderWidthRange = { min: 1, max: 8, step: 0.5, initial: 3.5 };

// Hides and shows the window from anywhere, e.g. from a game; accelerators
// in the global shortcut plugin's syntax
export const hideShortcuts = [
  { label: "Ctrl+Shift+Y", accelerator: "Control+Shift+Y" },
  { label: "Ctrl+Alt+Y", accelerator: "Control+Alt+Y" },
  { label: "Scroll Lock", accelerator: "ScrollLock" },
  { label: "Off" },
];

export interface Settings {
  deviceId: string; // "" while the system's default camera is starting
  quality: string;
  mirror: boolean;
  shape: string;
  aspectRatio: string;
  zoom: number;
  background: Background;
  brightness: number;
  contrast: number;
  blackAndWhite: boolean;
  borderColor: string; // "off" or #rrggbb
  borderWidth: number;
  alwaysOnTop: boolean;
  opacity: number;
  clickThrough: boolean; // clicks go to the window underneath
  screenLight: boolean;
  hideShortcut: string;
  language: Language;
  checkUpdates: boolean; // ask GitHub for a new version
}

// What the settings window shows: the settings and what goes with them
export interface State extends Settings {
  cameras: { deviceId: string; label: string }[];
  // The camera window's size in logical pixels
  width: number;
  height: number;
  customBorderColor: string; // the last colour picked for the border
  shortcutTaken: boolean; // another app holds hideShortcut
  reframed: boolean; // zoomed or moved, so there is something to reset
  // Zoomed in past the camera's pixels, while a higher quality would have more
  zoomSoft: boolean;
  version: string; // this one's
  newVersion: string; // a newer one on GitHub, or ""
}

// A setting changed in the settings window, or one of its buttons
export type Change =
  | { [K in keyof Settings]: { key: K; value: Settings[K] } }[keyof Settings]
  | { key: "rotate"; value: 90 | -90 }
  | { key: "size"; value: number }
  | { key: "resetFraming" }
  | { key: "download" };

// The settings window asks for the state once it is listening
export const SETTINGS_READY = "youcam:settings-ready";
// The camera window sends the state on every change
export const STATE = "youcam:state";
// The settings window sends a Change
export const CHANGE = "youcam:change";

export const isColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
