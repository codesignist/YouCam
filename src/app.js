var gui = require("nw.gui");
let tray = new nw.Tray({
  title: "YouCam",
  tooltip: "YouCam",
  icon: "assets/icon-tray.png",
});

let isMirror = localStorage.getItem("isMirror");
let deg = parseInt(localStorage.getItem("deg")) ?? 0;
if (isNaN(deg)) deg = 0;
let shape = localStorage.getItem("shape") ?? "Circle";
let aspectRatio = localStorage.getItem("aspectRatio") ?? "1:1";
let aspectRatios = ["None", "1:1", "3:4", "4:3", "16:9"];
var shapes = [
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
];

let contextMenuItems = [
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
      let menu = new nw.Menu();
      if (!navigator.mediaDevices?.enumerateDevices) {
        console.log("enumerateDevices() not supported.");
      } else {
        navigator.mediaDevices
          .enumerateDevices()
          .then((devices) => {
            devices.forEach((device) => {
              if (device.kind === "videoinput") {
                menu.append(
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
      return menu;
    },
  },
  {
    type: "normal",
    label: "Shape",
    submenu: shapes.map((shapeObj) => ({
      type: "normal",
      label: shapeObj.label,
      click: function () {
        shape = shapeObj.label;
        localStorage.setItem("shape", shapeObj.label);
        updateVars();
      },
    })),
  },
  {
    type: "normal",
    label: "Aspect Ratio",
    submenu: aspectRatios.map((ratio) => {
      return {
        type: "normal",
        label: ratio,
        click: function () {
          localStorage.setItem("aspectRatio", ratio);
          updateAspectRatio();
        },
      };
    }),
  },
  {
    type: "normal",
    label: "Rotate",
    submenu: [
      {
        type: "normal",
        label: "Rotate CW",
        click: function () {
          rotate(-90);
        },
      },
      {
        type: "normal",
        label: "Rotate CCW",
        click: function () {
          rotate(90);
        },
      },
    ],
  },
  {
    type: "checkbox",
    label: "Mirror",
    checked: isMirror,
    click: function () {
      isMirror = !isMirror;
      localStorage.setItem("isMirror", isMirror);
      updateVars();
    },
  },
  {
    type: "separator",
  },
  {
    type: "normal",
    label: "Exit",
    click: function () {
      nw.Window.get().close();
    },
  },
];

function createMenuItem(options) {
  try {
    if (Object.hasOwn(options, "submenu")) {
      const { submenu } = options;
      let menu = new nw.Menu();
      if (typeof submenu == "function") {
        menu = submenu();
      } else {
        options.submenu.forEach((item) => {
          menu.append(createMenuItem(item));
        });
      }
      options.submenu = menu;
    }
    let menuItem = nw.MenuItem(options);
    return menuItem;
  } catch (error) {
    alert("ERROR: " + error);
  }
}

var menu = new nw.Menu();

try {
  contextMenuItems
    .map((item) => createMenuItem(item))
    .forEach((item) => menu.append(item));

  tray.menu = menu;
} catch (error) {
  alert("ERROR: " + error);
}

async function rotate(rotateBy = 90) {
  deg = (deg + rotateBy) % 360; // [0, 90, 180, 270]
  if (Math.abs(deg % 90) > 0) {
    deg -= deg % 90; // etc. 182 -> 180. get rid of excess value
  }
  localStorage.setItem("deg", deg);
  updateVars();
  if (aspectRatio != "None") {
    await localStorage.setItem(
      "aspectRatio",
      aspectRatio.split(":").reverse().join(":")
    );
  }
  win.resizeTo(win.height, win.width);
}

function updateVars() {
  let docStyle = document.documentElement.style;
  docStyle.setProperty("--scaleX", isMirror ? -1 : 1);
  docStyle.setProperty("--rotate", `${deg}deg`);
  let shapeVal = shapes.find((o) => o.label === shape).val ?? "50%";
  docStyle.setProperty("--radius", shapeVal);
}

updateVars();

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
  }
  navigator.webkitGetUserMedia(
    { video: videoConstraints },
    function (stream) {
      const video = document.getElementById("camera");
      currentStream = stream;
      video.srcObject = stream;
    },
    function () {
      alert("could not connect stream");
    }
  );
}
setVideo();

if (process.platform == "darwin") {
  var menu = new gui.Menu({ type: "menubar" });
  menu.createMacBuiltin && menu.createMacBuiltin(window.document.title);
  gui.Window.get().menu = menu;
}

var win = gui.Window.get();
win.show();

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
