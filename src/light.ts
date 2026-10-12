// Screen light: a plain window to light your face with a monitor, or to
// add a coloured accent light. Right-click picks the colour; double-click
// or F / F11 toggles fullscreen, Esc leaves it, L closes it.
import {
  availableMonitors,
  getCurrentWindow,
  Window,
} from "@tauri-apps/api/window";
import {
  CheckMenuItem,
  Menu,
  MenuItem,
  PredefinedMenuItem,
} from "@tauri-apps/api/menu";
import { listen } from "@tauri-apps/api/event";
import {
  centerOn,
  debounced,
  getBounds,
  monitorAt,
  restoreBounds,
  saveBounds,
  type Bounds,
} from "./common";
import { option, savedLanguage, setLanguage, t } from "./i18n";
import { STATE, type State } from "./options";

const win = getCurrentWindow();
// Tracked here rather than asked from the window, which lags behind while
// it is still animating in or out of fullscreen
let fullscreen = false;

// Named in the menu by id (light.<id> in i18n.ts)
interface LightColor {
  id: string;
  color: string;
  accent?: boolean;
}

// Colour temperatures, the presets video lights (ring lights, bi-colour LED
// panels) offer. 6500K is the monitor's own white (sRGB's white point) and
// the brightest; the others are blackbody colours converted to sRGB with
// Tanner Helland's approximation.
const lightColors: LightColor[] = [
  { id: "6500", color: "#ffffff" }, // White
  { id: "5600", color: "#ffefe1" }, // Daylight
  { id: "4500", color: "#ffdabb" }, // Neutral
  { id: "3200", color: "#ffb87b" }, // Warm
  // The accent colours streamers use most for a coloured side or back light,
  // in colour wheel order. Fully saturated, so apart from cyan they give far
  // less light than white (red and pink ~1/5 of it, purple and blue ~1/10)
  { id: "red", color: "#ff0000", accent: true },
  { id: "pink", color: "#ff0080", accent: true },
  { id: "purple", color: "#8000ff", accent: true },
  { id: "blue", color: "#0000ff", accent: true },
  { id: "cyan", color: "#00ffff", accent: true },
];
// Any other colour, picked with the colour picker
const savedCustom = localStorage.getItem("lightCustomColor") ?? "";
const customColor: LightColor = {
  id: "custom",
  color: /^#[0-9a-f]{6}$/i.test(savedCustom) ? savedCustom : "#ffffff",
  accent: true,
};
lightColors.push(customColor);
let lightColor =
  lightColors.find((c) => c.id === localStorage.getItem("lightColor")) ??
  lightColors[0];

const customInput = document.getElementById("custom-color") as HTMLInputElement;
let menuX = 0;
let menuY = 0;

const colorItems = new Map<LightColor, CheckMenuItem>();
const menuItems: (CheckMenuItem | MenuItem | PredefinedMenuItem)[] = [];
for (const [i, c] of lightColors.entries()) {
  // A separator between the white light presets and the accent colours
  if (c.accent && !lightColors[i - 1].accent) {
    menuItems.push(await PredefinedMenuItem.new({ item: "Separator" }));
  }
  const item = await CheckMenuItem.new({
    text: option("light", c.id),
    checked: c === lightColor,
    action: () => (c === customColor ? pickCustomColor() : setLightColor(c)),
  });
  colorItems.set(c, item);
  menuItems.push(item);
}
menuItems.push(await PredefinedMenuItem.new({ item: "Separator" }));
const fullscreenItem = await CheckMenuItem.new({
  text: t("light.fullscreen"),
  checked: false,
  action: () => void setFullscreen(!fullscreen),
});
const closeItem = await MenuItem.new({
  text: t("light.close"),
  action: () => void win.close(),
});
menuItems.push(fullscreenItem, closeItem);
const menu = await Menu.new({ items: menuItems });

// Follows the language picked in the settings window, which the camera
// window sends with every change
let language = savedLanguage();
await listen<State>(STATE, ({ payload }) => {
  if (payload.language === language) return;
  language = payload.language;
  setLanguage(language);
  for (const [c, item] of colorItems) void item.setText(option("light", c.id));
  void fullscreenItem.setText(t("light.fullscreen"));
  void closeItem.setText(t("light.close"));
  void win.setTitle(t("title.light"));
});

// Clicking a check item toggles it by itself; this puts every mark back
// where the current state says
function updateMenu(): void {
  for (const [c, item] of colorItems) void item.setChecked(c === lightColor);
  void fullscreenItem.setChecked(fullscreen);
}

function setLightColor(c: LightColor): void {
  lightColor = c;
  localStorage.setItem("lightColor", c.id);
  if (c === customColor) localStorage.setItem("lightCustomColor", c.color);
  document.body.style.backgroundColor = c.color;
  updateMenu();
}

function pickCustomColor(): void {
  // Undo the check mark the click toggled; it moves once a colour is picked
  updateMenu();
  customInput.value = lightColor.color; // start from the current light
  customInput.style.left = `${menuX}px`;
  customInput.style.top = `${menuY}px`;
  customInput.click();
}
// Fires while changing the colour in the picker too, so the light follows
customInput.addEventListener("input", () => {
  customColor.color = customInput.value;
  setLightColor(customColor);
});

// The windowed bounds; fullscreen is kept as its own setting. As in main.ts
// the size comes from the page viewport and the position from move events.
let position = await win.outerPosition();
function bounds(): Bounds {
  return {
    x: position.x,
    y: position.y,
    width: Math.round(window.innerWidth * window.devicePixelRatio),
    height: Math.round(window.innerHeight * window.devicePixelRatio),
  };
}

async function setFullscreen(on: boolean): Promise<void> {
  if (on === fullscreen) return;
  // Remember the windowed size and spot; leaving fullscreen returns there
  if (on) saveBounds("lightBounds", bounds());
  fullscreen = on;
  localStorage.setItem("lightFullscreen", String(on));
  updateMenu();
  await win.setFullscreen(on);
}

// The first time, open in the middle of a different monitor than the camera
// window, or of the camera's own monitor if there is only one
async function placeFirstTime(): Promise<void> {
  const monitors = await availableMonitors();
  const camera = await Window.getByLabel("main");
  const cam = camera ? await getBounds(camera) : null;
  const camMonitor = cam
    ? monitorAt(monitors, cam.x + cam.width / 2, cam.y + cam.height / 2)
    : undefined;
  const target = monitors.find((m) => m !== camMonitor) ?? camMonitor;
  if (target) await centerOn(win, target, await win.innerSize());
}

// Apply the saved colour before showing, so the window doesn't flash white
setLightColor(lightColor);
if (!(await restoreBounds(win, "lightBounds"))) await placeFirstTime();
position = await win.outerPosition();
await win.show();
await win.setFocus();
if (localStorage.getItem("lightFullscreen") === "true") await setFullscreen(true);

document.body.addEventListener("contextmenu", (ev) => {
  ev.preventDefault();
  menuX = ev.clientX;
  menuY = ev.clientY;
  void menu.popup();
});

document.addEventListener("dblclick", () => void setFullscreen(!fullscreen));

window.addEventListener("keydown", (ev) => {
  if (ev.repeat) return;
  switch (ev.key.toLowerCase()) {
    case "f":
    case "f11":
      ev.preventDefault();
      void setFullscreen(!fullscreen);
      break;
    case "escape":
      void setFullscreen(false);
      break;
    case "l":
      void win.close();
      break;
  }
});

// Hide the cursor once it rests, so it doesn't sit in the middle of the light
let idleTimer: ReturnType<typeof setTimeout> | undefined;
function wake(): void {
  document.body.classList.remove("idle");
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add("idle"), 2000);
}
document.addEventListener("mousemove", wake);
wake();

const onBoundsSettled = debounced(async () => {
  if (fullscreen) return;
  position = await win.outerPosition();
  saveBounds("lightBounds", bounds());
}, 300);
await win.onMoved(({ payload }) => {
  if (fullscreen) return;
  position = payload;
  onBoundsSettled();
});
window.addEventListener("resize", onBoundsSettled);
await win.onCloseRequested(() => {
  if (!fullscreen) saveBounds("lightBounds", bounds());
});
