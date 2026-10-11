// Screen light: a plain window to light your face with a monitor, or to
// add a coloured accent light. Right-click picks the colour; double-click
// or F / F11 toggles fullscreen, Esc leaves it, L closes it.
let win = nw.Window.get();
// Tracked here rather than read from win.isFullscreen, which lags behind
// while the window is still animating in or out of fullscreen
let fullscreen = false;

// Colour temperatures, the presets video lights (ring lights, bi-colour LED
// panels) offer. 6500K is the monitor's own white (sRGB's white point) and
// the brightest; the others are blackbody colours converted to sRGB with
// Tanner Helland's approximation.
const lightColors = [
  { id: "6500", label: "White (6500K)", color: "#ffffff" },
  { id: "5600", label: "Daylight (5600K)", color: "#ffefe1" },
  { id: "4500", label: "Neutral (4500K)", color: "#ffdabb" },
  { id: "3200", label: "Warm (3200K)", color: "#ffb87b" },
  // The accent colours streamers use most for a coloured side or back light,
  // in colour wheel order. Fully saturated, so apart from cyan they give far
  // less light than white (red and pink ~1/5 of it, purple and blue ~1/10)
  { id: "red", label: "Red", color: "#ff0000", accent: true },
  { id: "pink", label: "Pink", color: "#ff0080", accent: true },
  { id: "purple", label: "Purple", color: "#8000ff", accent: true },
  { id: "blue", label: "Blue", color: "#0000ff", accent: true },
  { id: "cyan", label: "Cyan", color: "#00ffff", accent: true },
];
// Any other colour, picked with the system colour picker
let savedCustom = localStorage.getItem("lightCustomColor");
const customColor = {
  id: "custom",
  label: "Custom...",
  color: /^#[0-9a-f]{6}$/i.test(savedCustom) ? savedCustom : "#ffffff",
  accent: true,
};
lightColors.push(customColor);
let lightColor =
  lightColors.find((c) => c.id === localStorage.getItem("lightColor")) ??
  lightColors[0];

let menu = new nw.Menu();
let colorItems = [];
lightColors.forEach((c, i) => {
  // A separator between the white light presets and the accent colours
  if (c.accent && !lightColors[i - 1].accent) {
    menu.append(new nw.MenuItem({ type: "separator" }));
  }
  let item = new nw.MenuItem({
    type: "checkbox",
    label: c.label,
    click: function () {
      if (c === customColor) {
        pickCustomColor();
      } else {
        setLightColor(c);
      }
    },
  });
  colorItems.push(item);
  menu.append(item);
});
menu.append(new nw.MenuItem({ type: "separator" }));
let fullscreenItem = new nw.MenuItem({
  type: "checkbox",
  label: "Fullscreen (F)",
  click: function () {
    setFullscreen(!fullscreen);
  },
});
menu.append(fullscreenItem);
menu.append(
  new nw.MenuItem({
    label: "Close (L)",
    click: function () {
      win.close();
    },
  })
);

function updateMenu() {
  colorItems.forEach((item, i) => {
    item.checked = lightColors[i] === lightColor;
  });
  fullscreenItem.checked = fullscreen;
}

function setLightColor(c) {
  lightColor = c;
  localStorage.setItem("lightColor", c.id);
  if (c === customColor) localStorage.setItem("lightCustomColor", c.color);
  document.body.style.backgroundColor = c.color;
  updateMenu();
}

let customInput = document.getElementById("custom-color");
let menuX = 0;
let menuY = 0;
function pickCustomColor() {
  // Undo the check mark the click toggled; it moves once a colour is picked
  updateMenu();
  customInput.value = lightColor.color; // start from the current light
  customInput.style.left = `${menuX}px`;
  customInput.style.top = `${menuY}px`;
  customInput.click();
}
// Fires while dragging in the picker too, so the light follows live
customInput.addEventListener("input", function () {
  customColor.color = customInput.value;
  setLightColor(customColor);
});

function setFullscreen(on) {
  if (on === fullscreen) return;
  // Remember the windowed size and spot; leaving fullscreen returns there
  if (on) saveBounds(win, "lightBounds");
  fullscreen = on;
  localStorage.setItem("lightFullscreen", on);
  if (on) {
    win.enterFullscreen();
  } else {
    win.leaveFullscreen();
  }
  updateMenu();
}

// Apply the saved colour before showing, so the window doesn't flash white
setLightColor(lightColor);
restoreBounds(win, "lightBounds");
win.show();
if (localStorage.getItem("lightFullscreen") === "true") setFullscreen(true);

document.body.addEventListener("contextmenu", function (ev) {
  ev.preventDefault();
  menuX = ev.x;
  menuY = ev.y;
  menu.popup(ev.x, ev.y);
});

document.addEventListener("dblclick", function () {
  setFullscreen(!fullscreen);
});

window.addEventListener("keydown", function (ev) {
  if (ev.repeat) return;
  switch (ev.key.toLowerCase()) {
    case "f":
    case "f11":
      setFullscreen(!fullscreen);
      break;
    case "escape":
      setFullscreen(false);
      break;
    case "l":
      win.close();
      break;
  }
});

// Hide the cursor once it rests, so it doesn't sit in the middle of the light
let idleTimer;
function wake() {
  document.body.classList.remove("idle");
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add("idle"), 2000);
}
document.addEventListener("mousemove", wake);
wake();

// Only the windowed bounds are kept; fullscreen is its own setting
const saveBoundsLater = debounced(() => {
  if (!fullscreen) saveBounds(win, "lightBounds");
}, 500);
win.on("move", saveBoundsLater);
win.on("resize", saveBoundsLater);

win.on("close", function () {
  if (!fullscreen) saveBounds(win, "lightBounds");
  win.close(true);
});
