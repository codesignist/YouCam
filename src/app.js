let tray = new nw.Tray({
  title: "YouCam",
  tooltip: "YouCam",
  icon: "assets/icon-tray.png",
});

let win = nw.Window.get();
restoreBounds(win, "bounds");
win.show();

let isMirror = localStorage.getItem("isMirror") === "true";
let alwaysOnTop = localStorage.getItem("alwaysOnTop") !== "false";
win.setAlwaysOnTop(alwaysOnTop);
let deg = normalizeDeg(parseInt(localStorage.getItem("deg"), 10) || 0);
// Unbounded copy of deg for the CSS transform, so the transition always
// turns 90deg the short way (270 -> 360 instead of spinning back to 0)
let rotation = deg;
let shape = localStorage.getItem("shape") ?? "Hexagon";
let dimensions = ["240x240", "360x360", "480x480"];
let aspectRatio = localStorage.getItem("aspectRatio") ?? "1:1";
let aspectRatios = ["None", "1:1", "3:4", "4:3", "16:9"];
let videoDevices = [];
let currentDeviceId;
let qualities = [
  { label: "480p", width: 640, height: 480 },
  { label: "720p", width: 1280, height: 720 },
  { label: "1080p", width: 1920, height: 1080 },
];
let quality = localStorage.getItem("quality") ?? "720p";
let backgrounds = ["Off", "Blur", "Dark blur"];
// Before "Dark blur" existed this was the on/off "backgroundBlur" setting
let background =
  localStorage.getItem("background") ??
  (localStorage.getItem("backgroundBlur") === "false" ? "Off" : "Blur");
if (!backgrounds.includes(background)) background = "Blur";
let lightWindow = null; // the screen light's NW window while it is open
let lightOpening = false;
let shapes = [
  {
    label: "Square",
    val: "0.1px",
  },
  {
    label: "Rounded",
    val: "16px",
  },
  {
    label: "Circle",
    val: "50%",
  },
  {
    label: "Hexagon",
    val: "50%",
  },
];

function buildContextMenuItems() {
  return [
    {
      type: "normal",
      label: "YouCam",
      click: function () {
        win.show();
      },
    },
    {
      type: "normal",
      label: "Cam source",
      submenu: videoDevices.map((device, i) => ({
        type: "checkbox",
        label: device.label || `Camera ${i + 1}`,
        checked: device.deviceId === currentDeviceId,
        click: function () {
          setVideo(device.deviceId);
        },
      })),
    },
    {
      type: "normal",
      label: "Quality",
      submenu: qualities.map((q) => ({
        type: "checkbox",
        label: q.label,
        checked: quality === q.label,
        click: function () {
          quality = q.label;
          localStorage.setItem("quality", quality);
          setVideo(currentDeviceId);
          rebuildMenu();
        },
      })),
    },
    {
      type: "normal",
      label: "Shape",
      submenu: shapes.map((shapeObj) => ({
        type: "checkbox",
        label: shapeObj.label,
        checked: shape === shapeObj.label,
        click: function () {
          shape = shapeObj.label;
          localStorage.setItem("shape", shape);
          updateVars();
          rebuildMenu();
        },
      })),
    },
    {
      type: "normal",
      label: "Dimensions",
      submenu: dimensions.map((dim) => {
        let dimW = parseInt(dim.split("x")[0], 10);
        return {
          type: "checkbox",
          label: dim,
          // Derived from the window so it stays right after a manual or
          // wheel resize and across restarts
          checked: win.width === dimW,
          click: function () {
            win.resizeTo(dimW, heightForWidth(dimW, dimW));
            rebuildMenu();
          },
        };
      }),
    },
    {
      type: "normal",
      label: "Aspect Ratio",
      submenu: aspectRatios.map((ratio) => ({
        type: "checkbox",
        label: ratio,
        checked: aspectRatio === ratio,
        click: function () {
          aspectRatio = ratio;
          localStorage.setItem("aspectRatio", ratio);
          updateAspectRatio();
          rebuildMenu();
        },
      })),
    },
    {
      type: "normal",
      label: "Rotate",
      submenu: [
        {
          type: "normal",
          label: "Rotate CW (R)",
          click: function () {
            rotate(90);
          },
        },
        {
          type: "normal",
          label: "Rotate CCW (Shift+R)",
          click: function () {
            rotate(-90);
          },
        },
      ],
    },
    {
      type: "normal",
      label: "Background (B)",
      submenu: backgrounds.map((bg) => ({
        type: "checkbox",
        label: bg,
        checked: background === bg,
        click: function () {
          setBackground(bg);
        },
      })),
    },
    {
      type: "checkbox",
      label: "Mirror (M)",
      checked: isMirror,
      click: toggleMirror,
    },
    {
      type: "checkbox",
      label: "Always on top (T)",
      checked: alwaysOnTop,
      click: toggleAlwaysOnTop,
    },
    {
      type: "checkbox",
      label: "Screen light (L)",
      checked: lightWindow !== null,
      click: toggleScreenLight,
    },
    {
      type: "separator",
    },
    {
      type: "normal",
      label: "Exit (Q)",
      click: function () {
        win.close();
      },
    },
  ];
}

function createMenuItem(options) {
  if (Object.hasOwn(options, "submenu")) {
    let subMenu = new nw.Menu();
    options.submenu.forEach((item) => {
      subMenu.append(createMenuItem(item));
    });
    options.submenu = subMenu;
  }
  return new nw.MenuItem(options);
}

var menu;
function rebuildMenu() {
  try {
    menu = new nw.Menu();
    buildContextMenuItems()
      .map((item) => createMenuItem(item))
      .forEach((item) => menu.append(item));
    tray.menu = menu;
  } catch (error) {
    alert("ERROR: " + error);
  }
}
rebuildMenu();

function normalizeDeg(value) {
  // Snap to a multiple of 90 within [0, 360)
  return (((Math.round(value / 90) * 90) % 360) + 360) % 360;
}

function rotate(rotateBy = 90) {
  deg = normalizeDeg(deg + rotateBy);
  rotation += rotateBy;
  localStorage.setItem("deg", deg);
  updateVars();
  if (aspectRatio != "None") {
    aspectRatio = aspectRatio.split(":").reverse().join(":");
    localStorage.setItem("aspectRatio", aspectRatio);
  }
  // The swapped size already matches the reversed ratio; the resize
  // handler re-applies it once the window has actually been resized
  win.resizeTo(win.height, win.width);
  rebuildMenu();
}

function updateVars() {
  const docStyle = document.documentElement.style;
  docStyle.setProperty("--scaleX", isMirror ? -1 : 1);
  docStyle.setProperty("--rotate", `${rotation}deg`);
  let shapeVal = shapes.find((o) => o.label === shape)?.val ?? "50%";
  docStyle.setProperty("--radius", shapeVal);
  document.body.classList.toggle("hexagon", shape === "Hexagon");
  document.body.classList.toggle("sideways", deg % 180 !== 0);
}

updateVars();

function toggleMirror() {
  isMirror = !isMirror;
  localStorage.setItem("isMirror", isMirror);
  updateVars();
  rebuildMenu();
}

function toggleAlwaysOnTop() {
  alwaysOnTop = !alwaysOnTop;
  localStorage.setItem("alwaysOnTop", alwaysOnTop);
  win.setAlwaysOnTop(alwaysOnTop);
  rebuildMenu();
}

// Screen light: a separate plain white window (light.html) to light your
// face with a monitor, e.g. the second one in fullscreen
function toggleScreenLight() {
  if (lightWindow) {
    lightWindow.close(); // light.js saves its bounds, then "closed" fires
    return;
  }
  if (lightOpening) return;
  lightOpening = true;
  let options = {
    title: "YouCam Light",
    icon: "assets/icon.png",
    width: 800,
    height: 600,
    frame: true,
    transparent: false,
    resizable: true,
    show: false, // light.js shows it once its saved bounds are applied
  };
  // The first time, prefer a monitor other than the camera's
  if (!localStorage.getItem("lightBounds")) {
    let camScreen = screenAt(win.x + win.width / 2, win.y + win.height / 2);
    let other = nw.Screen.screens.find((s) => s.id !== camScreen?.id);
    if (other) {
      let area = other.work_area;
      options.x = Math.round(area.x + (area.width - options.width) / 2);
      options.y = Math.round(area.y + (area.height - options.height) / 2);
    } else {
      options.position = "center";
    }
  }
  nw.Window.open(new URL("light.html", location.href).href, options, (w) => {
    lightOpening = false;
    lightWindow = w;
    w.on("closed", () => {
      lightWindow = null;
      rebuildMenu();
    });
    rebuildMenu();
  });
}

function setBackground(value) {
  background = value;
  localStorage.setItem("background", background);
  updateBackground();
  rebuildMenu();
}

// B steps through Off -> Blur -> Dark blur
function cycleBackground() {
  let next = (backgrounds.indexOf(background) + 1) % backgrounds.length;
  setBackground(backgrounds[next]);
}

// The effect is drawn on a canvas over the video, so the plain video keeps
// showing while the model loads. backgroundEffect holds a promise of the
// controller returned by background.mjs while an effect is on.
let backgroundEffect = null;
function updateBackground() {
  let on = background !== "Off";
  document.body.classList.toggle("background-effect", on);
  if (on && !backgroundEffect) {
    backgroundEffect = import("./background.mjs")
      .then(({ startBackground }) =>
        startBackground(
          document.getElementById("camera"),
          document.getElementById("background"),
          background
        )
      )
      .catch((err) => {
        console.error("background:", err);
        backgroundEffect = null;
        background = "Off";
        localStorage.setItem("background", background);
        document.body.classList.remove("background-effect");
        rebuildMenu();
        alert("could not start the background effect");
      });
  } else if (on) {
    backgroundEffect.then((effect) => effect?.setMode(background));
  } else if (backgroundEffect) {
    backgroundEffect.then((effect) => effect?.stop());
    backgroundEffect = null;
  }
}

window.addEventListener("keydown", function (ev) {
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
      win.close();
      break;
  }
});

function refreshDevices() {
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

let currentStream;
let videoRequest = 0;
function stopMediaTracks(stream) {
  stream.getTracks().forEach((track) => {
    track.stop();
  });
}
function setVideo(id) {
  // Lets a slower, outdated request be dropped if the camera is switched again
  const request = ++videoRequest;
  if (currentStream) {
    stopMediaTracks(currentStream);
  }
  // "ideal" lets cameras that can't reach the resolution fall back to the
  // closest mode instead of failing
  let { width, height } =
    qualities.find((q) => q.label === quality) ?? qualities[1];
  let videoConstraints = { width: { ideal: width }, height: { ideal: height } };
  if (id) {
    videoConstraints.deviceId = { exact: id };
  } else {
    videoConstraints.facingMode = "user";
  }

  navigator.mediaDevices
    .getUserMedia({ video: videoConstraints })
    .then((stream) => {
      if (request !== videoRequest) {
        stopMediaTracks(stream);
        return;
      }
      const video = document.getElementById("camera");
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

if (process.platform == "darwin") {
  let macMenu = new nw.Menu({ type: "menubar" });
  macMenu.createMacBuiltin && macMenu.createMacBuiltin(window.document.title);
  win.menu = macMenu;
}

document.body.addEventListener(
  "contextmenu",
  function (ev) {
    ev.preventDefault();
    menu.popup(ev.x, ev.y);
    return false;
  },
  false
);

// Drag the frameless window with the left button. Pointer capture keeps the
// events coming even if the cursor briefly outruns the window.
let dragOffset = null;
document.body.addEventListener("pointerdown", function (ev) {
  if (ev.button !== 0) return;
  dragOffset = { x: ev.clientX, y: ev.clientY };
  document.body.setPointerCapture(ev.pointerId);
});

document.body.addEventListener("pointermove", function (ev) {
  if (!dragOffset) return;
  win.moveTo(ev.screenX - dragOffset.x, ev.screenY - dragOffset.y);
});

function endDrag() {
  dragOffset = null;
}
document.body.addEventListener("pointerup", endDrag);
document.body.addEventListener("pointercancel", endDrag);

// Window height that matches the selected aspect ratio for the given width
function heightForWidth(width, fallback) {
  if (aspectRatio == "None") return fallback;
  let [ratioW, ratioH] = aspectRatio
    .split(":")
    .map((ratio) => parseInt(ratio, 10));
  return Math.round((width / ratioW) * ratioH);
}

// Assigning win.width/win.height is a no-op in NW.js, so always use resizeTo
function updateAspectRatio() {
  let height = heightForWidth(win.width, win.height);
  if (height !== win.height) win.resizeTo(win.width, height);
}
updateAspectRatio();

// Mouse wheel scales the window around its center, keeping its proportions.
// Wheel events can arrive faster than NW.js reports the new bounds, so a
// burst of them works from its own state instead of re-reading win.
const MIN_SIZE = 140; // Windows won't make the window narrower than ~134px
let zoom = null;
const endZoom = debounced(() => {
  zoom = null;
}, 300);

function zoomWindow(scale) {
  zoom ??= {
    centerX: win.x + win.width / 2,
    centerY: win.y + win.height / 2,
    width: win.width,
    ratio: win.height / win.width,
  };
  endZoom();
  let area = (screenAt(zoom.centerX, zoom.centerY) ?? nw.Screen.screens[0])
    .work_area;
  // Keep both sides between MIN_SIZE and the size of the current screen,
  // without ever growing on zoom out (or shrinking on zoom in) when the
  // window is already outside those limits
  let minW = Math.min(Math.max(MIN_SIZE, MIN_SIZE / zoom.ratio), zoom.width);
  let maxW = Math.max(
    Math.min(area.width, area.height / zoom.ratio),
    zoom.width
  );
  zoom.width = Math.min(Math.max(zoom.width * scale, minW), maxW);
  let width = Math.round(zoom.width);
  let height = heightForWidth(width, Math.round(width * zoom.ratio));
  win.moveTo(
    Math.round(zoom.centerX - width / 2),
    Math.round(zoom.centerY - height / 2)
  );
  win.resizeTo(width, height);
}

document.body.addEventListener(
  "wheel",
  function (ev) {
    ev.preventDefault(); // also stops Ctrl+wheel from zooming the page
    zoomWindow(Math.exp(-ev.deltaY / 1000)); // ~10% per wheel notch
  },
  { passive: false }
);

const onResizeEnd = debounced(() => {
  updateAspectRatio();
  rebuildMenu(); // refresh the Dimensions check mark
}, 200);
const saveBoundsLater = debounced(() => saveBounds(win, "bounds"), 500);

win.on("resize", () => {
  onResizeEnd();
  saveBoundsLater();
});
win.on("move", saveBoundsLater);

// Save right away on exit, in case a move is still waiting on the debounce.
// The screen light is closed too, or the app would keep running for it.
win.on("close", function () {
  saveBounds(win, "bounds");
  lightWindow?.close();
  win.close(true);
});
