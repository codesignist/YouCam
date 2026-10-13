// The settings window: everything about the camera window that isn't in its
// right-click menu. It shows the state the camera window (main.ts) sends and
// sends back each change, which the camera window applies before sending
// the new state.
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import hexagonSvg from "../assets/hexagon.svg?raw";
import { languages, option, setLanguage, t, type Language } from "./i18n";
import {
  CHANGE,
  SETTINGS_READY,
  STATE,
  aspectRatios,
  backgrounds,
  borderColors,
  borderWidthRange,
  hideShortcuts,
  opacityRange,
  pictureRange,
  qualities,
  shapes,
  sizes,
  zoomRange,
  type Change,
  type State,
} from "./options";
import "./settings.css";

const win = getCurrentWindow();
const send = (change: Change) => void emit(CHANGE, change);
const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// Controls that are being used keep their value; the state may lag behind
// them while a slider is dragged
const inUse = (el: Element) => el === document.activeElement;

// ---- Words ----------------------------------------------------------------------

// The words for a key such as "settings.source" or "shape.Hexagon"; a key
// with no words (such as "quality.720p") shows its value
function words(key: string): string {
  const dot = key.indexOf(".");
  return option(key.slice(0, dot), key.slice(dot + 1));
}

// Fills in every text marked with a key, here and in settings.html
function translatePage(): void {
  for (const el of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    el.textContent = words(el.dataset.i18n ?? "");
  }
  for (const el of document.querySelectorAll<HTMLElement>("[data-i18n-title]")) {
    el.title = words(el.dataset.i18nTitle ?? "");
    el.setAttribute("aria-label", el.title);
  }
  for (const el of document.querySelectorAll<HTMLElement>("[data-i18n-aria]")) {
    el.setAttribute("aria-label", words(el.dataset.i18nAria ?? ""));
  }
}

// ---- Tabs ---------------------------------------------------------------------------

// The open one is remembered for the next time the window opens
const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
function selectTab(tab: HTMLButtonElement): void {
  for (const t of tabs) {
    const selected = t === tab;
    t.setAttribute("aria-selected", String(selected));
    t.tabIndex = selected ? 0 : -1; // Tab moves into the panel, arrows between tabs
    byId(t.getAttribute("aria-controls") ?? "").hidden = !selected;
  }
  localStorage.setItem("settingsTab", tab.id);
}
for (const tab of tabs) tab.addEventListener("click", () => selectTab(tab));
byId("tab-camera").parentElement?.addEventListener("keydown", (ev) => {
  const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  const next = {
    ArrowLeft: (i - 1 + tabs.length) % tabs.length,
    ArrowRight: (i + 1) % tabs.length,
    Home: 0,
    End: tabs.length - 1,
  }[ev.key];
  if (next === undefined) return;
  ev.preventDefault();
  selectTab(tabs[next]);
  tabs[next].focus();
});
selectTab(tabs.find((t) => t.id === localStorage.getItem("settingsTab")) ?? tabs[0]);

// ---- Building blocks ----------------------------------------------------------

// Radio buttons that read as one control, each named by a key. Returns what
// checks a value.
function segmented(
  id: string,
  options: { value: string; key: string }[],
  pick: (value: string) => void
): (value: string) => void {
  const group = byId(id);
  for (const option of options) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = id;
    input.value = option.value;
    input.addEventListener("change", () => pick(option.value));
    const text = document.createElement("span");
    text.dataset.i18n = option.key;
    label.append(input, text);
    group.append(label);
  }
  return (value) => {
    for (const input of group.querySelectorAll("input")) {
      input.checked = input.value === value;
    }
  };
}

// A range input with its value beside it. Returns what sets the value.
function slider(
  id: string,
  range: { min: number; max: number; step: number },
  format: (value: number) => string,
  change: (value: number) => void
): (value: number) => void {
  const input = byId<HTMLInputElement>(id);
  const output = byId<HTMLOutputElement>(`${id}-value`);
  Object.assign(input, { min: range.min, max: range.max, step: range.step });
  const show = (value: number) => {
    output.textContent = format(value);
    const fill = ((value - range.min) / (range.max - range.min)) * 100;
    input.style.setProperty("--fill", `${fill}%`);
  };
  input.addEventListener("input", () => {
    show(input.valueAsNumber);
    change(input.valueAsNumber);
  });
  return (value) => {
    if (!inUse(input)) input.value = String(value);
    show(inUse(input) ? input.valueAsNumber : value);
  };
}

function toggle(id: string, change: (on: boolean) => void): (on: boolean) => void {
  const input = byId<HTMLInputElement>(id);
  input.addEventListener("change", () => change(input.checked));
  return (on) => {
    input.checked = on;
  };
}

// ---- Camera -----------------------------------------------------------------------

const cameraSelect = byId<HTMLSelectElement>("camera");
cameraSelect.addEventListener("change", () =>
  send({ key: "deviceId", value: cameraSelect.value })
);
let shownCameras = "";
function showCameras(state: State): void {
  const list = JSON.stringify(state.cameras);
  if (list !== shownCameras) {
    shownCameras = list;
    cameraSelect.replaceChildren(
      ...state.cameras.map((c) => new Option(c.label, c.deviceId))
    );
    if (!state.cameras.length) {
      cameraSelect.append(new Option(t("settings.noCamera"), "", true, true));
    }
    cameraSelect.disabled = !state.cameras.length;
  }
  if (!inUse(cameraSelect) && state.cameras.length) cameraSelect.value = state.deviceId;
}

const setQuality = segmented(
  "quality",
  qualities.map((q) => ({ value: q.label, key: `quality.${q.label}` })),
  (value) => send({ key: "quality", value })
);
const setMirror = toggle("mirror", (value) => send({ key: "mirror", value }));
byId("rotate-left").addEventListener("click", () => send({ key: "rotate", value: -90 }));
byId("rotate-right").addEventListener("click", () => send({ key: "rotate", value: 90 }));

const setZoom = slider(
  "zoom",
  zoomRange,
  (value) => `${Math.round(value * 100)}%`,
  (value) => send({ key: "zoom", value })
);
const resetFraming = byId<HTMLButtonElement>("reset-framing");
resetFraming.addEventListener("click", () => send({ key: "resetFraming" }));

// ---- Shape and size ---------------------------------------------------------------

const SVG = "http://www.w3.org/2000/svg";
const hexagonPath = /\sd="([^"]+)"/.exec(hexagonSvg)?.[1] ?? "";
const hexagonViewBox = /viewBox="([^"]+)"/.exec(hexagonSvg)?.[1] ?? "0 0 196 196";

// Each shape drawn the way the camera window cuts the video
function shapeDrawing(shape: string): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  let el: SVGElement;
  if (shape === "Hexagon") {
    svg.setAttribute("viewBox", hexagonViewBox);
    el = document.createElementNS(SVG, "path");
    el.setAttribute("d", `${hexagonPath}Z`);
  } else if (shape === "Circle") {
    svg.setAttribute("viewBox", "0 0 52 52");
    el = document.createElementNS(SVG, "circle");
    el.setAttribute("cx", "26");
    el.setAttribute("cy", "26");
    el.setAttribute("r", "25");
  } else {
    svg.setAttribute("viewBox", "0 0 52 52");
    el = document.createElementNS(SVG, "rect");
    el.setAttribute("x", "1");
    el.setAttribute("y", "1");
    el.setAttribute("width", "50");
    el.setAttribute("height", "50");
    el.setAttribute("rx", shape === "Rounded" ? "9" : "1");
  }
  el.classList.add("shape");
  svg.append(el);
  svg.setAttribute("aria-hidden", "true");
  return svg;
}

const shapeGroup = byId("shape");
for (const { label } of shapes) {
  const option = document.createElement("label");
  const input = document.createElement("input");
  input.type = "radio";
  input.name = "shape";
  input.value = label;
  input.addEventListener("change", () => send({ key: "shape", value: label }));
  const tile = document.createElement("span");
  tile.className = "tile";
  const name = document.createElement("span");
  name.dataset.i18n = `shape.${label}`;
  tile.append(shapeDrawing(label), name);
  option.append(input, tile);
  shapeGroup.append(option);
}
function setShape(value: string): void {
  for (const input of shapeGroup.querySelectorAll("input")) {
    input.checked = input.value === value;
  }
}

const setSize = segmented(
  "size",
  sizes.map((s) => ({ value: String(s.width), key: `size.${s.label}` })),
  (value) => send({ key: "size", value: Number(value) })
);
const sizeHint = byId("size-hint");

const setAspect = segmented(
  "aspect",
  aspectRatios.map((r) => ({ value: r, key: `aspect.${r}` })),
  (value) => send({ key: "aspectRatio", value })
);

// ---- Picture ----------------------------------------------------------------------

const setBackground = segmented(
  "background",
  backgrounds.map((b) => ({ value: b, key: `background.${b}` })),
  (value) => {
    const background = backgrounds.find((b) => b === value);
    if (background) send({ key: "background", value: background });
  }
);
const percent = (value: number) => `${Math.round(value)}%`;
const setBrightness = slider("brightness", pictureRange, percent, (value) =>
  send({ key: "brightness", value })
);
const setContrast = slider("contrast", pictureRange, percent, (value) =>
  send({ key: "contrast", value })
);
const setBlackAndWhite = toggle("black-and-white", (value) =>
  send({ key: "blackAndWhite", value })
);
const resetPicture = byId<HTMLButtonElement>("reset-picture");
resetPicture.addEventListener("click", () => {
  send({ key: "brightness", value: 100 });
  send({ key: "contrast", value: 100 });
  send({ key: "blackAndWhite", value: false });
});

// ---- Border ---------------------------------------------------------------------

const swatches = byId("border-colors");
const customSwatch = swatches.querySelector(".custom") as HTMLLabelElement;
const customColor = byId<HTMLInputElement>("custom-color");
const presetSwatches = [
  { key: "settings.noBorder", color: "off" },
  ...borderColors.map((c) => ({ key: `color.${c.label}`, color: c.color })),
].map(({ key, color }) => {
  const swatch = document.createElement("button");
  swatch.type = "button";
  swatch.className = color === "off" ? "swatch off" : "swatch";
  swatch.dataset.i18nTitle = key;
  swatch.style.setProperty("--swatch", color);
  swatch.addEventListener("click", () => send({ key: "borderColor", value: color }));
  customSwatch.before(swatch);
  return { swatch, color };
});
// Fires while the colour changes in the picker too, so the border follows
customColor.addEventListener("input", () =>
  send({ key: "borderColor", value: customColor.value })
);

// Shown in pixels at the camera's current size, as it is drawn
let shorterSide = 0;
const setBorderWidth = slider(
  "border-width",
  borderWidthRange,
  (value) => `${Math.round((shorterSide * value) / 100)} px`,
  (value) => send({ key: "borderWidth", value })
);
const borderWidthInput = byId<HTMLInputElement>("border-width");

function showBorder(state: State): void {
  const off = state.borderColor === "off";
  const preset = presetSwatches.find((p) => p.color === state.borderColor);
  for (const { swatch, color } of presetSwatches) {
    swatch.setAttribute("aria-pressed", String(color === state.borderColor));
  }
  const custom = !off && !preset;
  customSwatch.setAttribute("aria-pressed", String(custom));
  customSwatch.style.setProperty("--swatch", state.customBorderColor);
  if (!inUse(customColor)) customColor.value = state.customBorderColor;

  shorterSide = Math.min(state.width, state.height);
  setBorderWidth(state.borderWidth);
  borderWidthInput.disabled = off;

  // The shape tiles wear the same border, scaled to their size
  shapeGroup.style.setProperty("--tile-border", off ? "none" : state.borderColor);
  shapeGroup.style.setProperty(
    "--tile-border-width",
    `${Math.max(1.5, (52 * state.borderWidth) / 100)}px`
  );
}

// ---- Window -------------------------------------------------------------------------

const setAlwaysOnTop = toggle("always-on-top", (value) =>
  send({ key: "alwaysOnTop", value })
);
const setOpacity = slider("opacity", opacityRange, percent, (value) =>
  send({ key: "opacity", value })
);
const setClickThrough = toggle("click-through", (value) =>
  send({ key: "clickThrough", value })
);
const setScreenLight = toggle("screen-light", (value) =>
  send({ key: "screenLight", value })
);
const shortcutSelect = byId<HTMLSelectElement>("hide-shortcut");
for (const { label } of hideShortcuts) {
  const choice = new Option(label, label);
  if (label === "Off") choice.dataset.i18n = "settings.noShortcut";
  shortcutSelect.append(choice);
}

const languageSelect = byId<HTMLSelectElement>("language");
languageSelect.addEventListener("change", () => {
  const value = languages.find((l) => l === languageSelect.value);
  if (value) send({ key: "language", value });
});

// The whole window follows the language, from the first state on
let shownLanguage: Language | undefined;
function showLanguage(state: State): void {
  if (state.language !== shownLanguage) {
    shownLanguage = state.language;
    setLanguage(state.language);
    translatePage();
    shownCameras = ""; // "No camera found" is in words too
    void win.setTitle(t("title.settings"));
  }
  if (!inUse(languageSelect)) languageSelect.value = state.language;
}
shortcutSelect.addEventListener("change", () =>
  send({ key: "hideShortcut", value: shortcutSelect.value })
);

const setCheckUpdates = toggle("check-updates", (value) =>
  send({ key: "checkUpdates", value })
);
const versionHint = byId("version-hint");
const downloadButton = byId("download");
downloadButton.addEventListener("click", () => send({ key: "download" }));

function showVersion(state: State): void {
  setCheckUpdates(state.checkUpdates);
  const current = t("settings.version", { version: state.version });
  versionHint.textContent = state.newVersion
    ? t("settings.newVersion", { new: state.newVersion, version: state.version })
    : state.checkUpdates
      ? `${current} ${t("settings.checkUpdatesHint")}`
      : current;
  downloadButton.hidden = !state.newVersion;
}

// ---- State ------------------------------------------------------------------------

function render(state: State): void {
  showLanguage(state);
  showCameras(state);
  setQuality(state.quality);
  setMirror(state.mirror);
  setZoom(state.zoom);
  resetFraming.disabled = !state.reframed;
  byId("zoom-soft").hidden = !state.zoomSoft;

  setShape(state.shape);
  setSize(String(state.width));
  sizeHint.textContent = t("settings.sizeHint", { width: state.width, height: state.height });
  setAspect(state.aspectRatio);

  setBackground(state.background);
  setBrightness(state.brightness);
  setContrast(state.contrast);
  setBlackAndWhite(state.blackAndWhite);
  resetPicture.disabled =
    state.brightness === 100 && state.contrast === 100 && !state.blackAndWhite;

  showBorder(state);

  setAlwaysOnTop(state.alwaysOnTop);
  setOpacity(state.opacity);
  setClickThrough(state.clickThrough);
  setScreenLight(state.screenLight);
  if (!inUse(shortcutSelect)) shortcutSelect.value = state.hideShortcut;
  byId("hide-shortcut-taken").hidden = !state.shortcutTaken;
  byId("hide-shortcut-hint").hidden = state.shortcutTaken || state.hideShortcut === "Off";
  showVersion(state);
}

// Shown once it has something to show (main.ts placed it next to the camera)
let shown = false;
await listen<State>(STATE, async ({ payload }) => {
  render(payload);
  if (!shown) {
    shown = true;
    await win.show();
    await win.setFocus();
  }
});
await emit(SETTINGS_READY);

window.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") void win.close();
});
