let gui = require("nw.gui");
let tray = new nw.Tray({
  title: "YouCam",
  tooltip: "YouCam",
  icon: "assets/icon-tray.png",
});

var win = gui.Window.get();
win.show();

let isMirror = localStorage.getItem("isMirror") === "true";
let alwaysOnTop = localStorage.getItem("alwaysOnTop") !== "false";
win.setAlwaysOnTop(alwaysOnTop);
let deg = parseInt(localStorage.getItem("deg"), 10);
if (isNaN(deg)) deg = 0;
let shape = localStorage.getItem("shape") ?? "Hexagon";
let dimensions = ["240x240", "360x360", "480x480"];
let currentDim;
let aspectRatio = localStorage.getItem("aspectRatio") ?? "1:1";
let aspectRatios = ["None", "1:1", "3:4", "4:3", "16:9"];
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
        nw.Window.get().show();
      },
    },
    {
      type: "normal",
      label: "Cam source",
      submenu: () => {
        let camMenu = new nw.Menu();
        if (!navigator.mediaDevices?.enumerateDevices) {
          console.log("enumerateDevices() not supported.");
        } else {
          navigator.mediaDevices
            .enumerateDevices()
            .then((devices) => {
              devices.forEach((device) => {
                if (device.kind === "videoinput") {
                  camMenu.append(
                    new nw.MenuItem({
                      label: device.label,
                      click: function () {
                        setVideo(device.deviceId);
                      },
                    })
                  );
                }
              });
            })
            .catch((err) => {
              console.error(`${err.name}: ${err.message}`);
            });
        }
        return camMenu;
      },
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
      submenu: dimensions.map((dim) => ({
        type: "checkbox",
        label: dim,
        checked: currentDim === dim,
        click: function () {
          let dimW = parseInt(dim.split("x")[0], 10);
          win.width = dimW;
          win.height = dimW;
          currentDim = dim;
          rebuildMenu();
        },
      })),
    },
    {
      type: "normal",
      label: "Aspect Ratio",
      submenu: aspectRatios.map((ratio) => ({
        type: "checkbox",
        label: ratio,
        checked: aspectRatio === ratio,
        click: function () {
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
      type: "separator",
    },
    {
      type: "normal",
      label: "Exit (Q)",
      click: function () {
        nw.Window.get().close();
      },
    },
  ];
}

function createMenuItem(options) {
  try {
    if (Object.hasOwn(options, "submenu")) {
      const { submenu } = options;
      let subMenu = new nw.Menu();
      if (typeof submenu == "function") {
        subMenu = submenu();
      } else {
        options.submenu.forEach((item) => {
          subMenu.append(createMenuItem(item));
        });
      }
      options.submenu = subMenu;
    }
    let menuItem = nw.MenuItem(options);
    return menuItem;
  } catch (error) {
    alert("ERROR: " + error);
  }
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

function rotate(rotateBy = 90) {
  deg = (deg + rotateBy) % 360; // [0, 90, 180, 270]
  if (Math.abs(deg % 90) > 0) {
    deg -= deg % 90; // etc. 182 -> 180. get rid of excess value
  }
  localStorage.setItem("deg", deg);
  updateVars();
  if (aspectRatio != "None") {
    aspectRatio = aspectRatio.split(":").reverse().join(":");
    localStorage.setItem("aspectRatio", aspectRatio);
  }
  win.resizeTo(win.height, win.width);
  updateAspectRatio();
  rebuildMenu();
}

function updateVars() {
  const docStyle = document.documentElement.style;
  const body = document.getElementsByTagName("BODY")[0];
  docStyle.setProperty("--scaleX", isMirror ? -1 : 1);
  docStyle.setProperty("--rotate", `${deg}deg`);
  let shapeVal = shapes.find((o) => o.label === shape).val ?? "50%";
  docStyle.setProperty("--radius", shapeVal);
  if (shape === "Hexagon") {
    body.classList.add("hexagon");
  } else {
    body.classList.remove("hexagon");
  }
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

window.addEventListener("keydown", function (ev) {
  switch (ev.key.toLowerCase()) {
    case "m":
      toggleMirror();
      break;
    case "r":
      rotate(ev.shiftKey ? -90 : 90);
      break;
    case "t":
      toggleAlwaysOnTop();
      break;
    case "q":
    case "escape":
      nw.Window.get().close();
      break;
  }
});

let currentStream;
function stopMediaTracks(stream) {
  stream.getTracks().forEach((track) => {
    track.stop();
  });
}
function setVideo(id) {
  if (typeof currentStream !== "undefined") {
    stopMediaTracks(currentStream);
  }
  let videoConstraints = { facingMode: "user" };

  if (!id) {
    videoConstraints.facingMode = "environment";
  } else {
    videoConstraints.deviceId = { exact: id };
    localStorage.setItem("deviceId", id);
  }
  navigator.mediaDevices
    .getUserMedia({ video: videoConstraints })
    .then((stream) => {
      const video = document.getElementById("camera");
      currentStream = stream;
      video.srcObject = stream;
    })
    .catch((err) => {
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

if (process.platform == "darwin") {
  let macMenu = new gui.Menu({ type: "menubar" });
  macMenu.createMacBuiltin && macMenu.createMacBuiltin(window.document.title);
  gui.Window.get().menu = macMenu;
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

let mousePos = { x: 0, y: 0 };
function mouseMove(ev) {
  win.moveTo(ev.screenX - mousePos.x, ev.screenY - mousePos.y);
}

document.body.addEventListener("mousedown", function (ev) {
  mousePos = { x: ev.x, y: ev.y };
  window.addEventListener("mousemove", mouseMove);
});

document.body.addEventListener("mouseup", function (ev) {
  window.removeEventListener("mousemove", mouseMove);
});

function updateAspectRatio() {
  let docStyle = document.documentElement.style;
  aspectRatio = localStorage.getItem("aspectRatio") ?? "1:1";
  if (aspectRatio != "None") {
    let [vertical, horizontal] = aspectRatio
      .split(":")
      .map((ratio) => parseInt(ratio));
    win.height = Math.round((win.width / vertical) * horizontal);
  }

  docStyle.setProperty(
    "--width",
    ([90, 270].includes(Math.abs(deg)) ? win.height : win.width) + "px"
  );
  docStyle.setProperty(
    "--height",
    ([90, 270].includes(Math.abs(deg)) ? win.width : win.height) + "px"
  );
}
updateAspectRatio();

win.on("resize", () => {
  debounceFn(() => {
    updateAspectRatio();
  }, 200);
});

let debounce;
function debounceFn(action, ms) {
  clearTimeout(debounce);
  debounce = setTimeout(() => action(), ms);
}
