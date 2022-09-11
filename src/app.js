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
    alert(id);
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
var submenu = new nw.Menu();
if (!navigator.mediaDevices?.enumerateDevices) {
  console.log("enumerateDevices() not supported.");
} else {
  // List cameras and microphones.
  navigator.mediaDevices
    .enumerateDevices()
    .then((devices) => {
      devices.forEach((device) => {
        if (device.kind === "videoinput") {
          submenu.append(
            new nw.MenuItem({
              label: device.label,
              click: function () {
                setVideo();
                if (typeof currentStream !== "undefined") {
                  stopMediaTracks(currentStream);
                }
                let videoConstraints = { facingMode: "user" };

                if (!id) {
                  videoConstraints.facingMode = "environment";
                } else {
                  alert(id);
                  videoConstraints.deviceId = { exact: id };
                }
                navigator.getUserMedia(
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

var shapeSubMenu = new nw.Menu();
shapes.map((shapeObj) =>
  shapeSubMenu.append(
    nw.MenuItem({
      type: "normal",
      label: shapeObj.label,
      click: function () {
        shape = shapeObj.label;
        localStorage.setItem("shape", shapeObj.label);
        updateVars();
      },
    })
  )
);

function rotate(rotateBy = 90) {
  deg += rotateBy * (isMirror ? 1 : -1);
  localStorage.setItem("deg", deg);
  updateVars();
}

var rotateSubMenu = new nw.Menu();
rotateSubMenu.append(
  nw.MenuItem({
    type: "normal",
    label: "Rotate CW",
    click: function () {
      rotate(-90);
    },
  })
);
rotateSubMenu.append(
  nw.MenuItem({
    type: "normal",
    label: "Rotate CCW",
    click: function () {
      rotate(90);
    },
  })
);

var menu = new nw.Menu();
let menuItems = [
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
    submenu,
  },
  {
    type: "normal",
    label: "Shape",
    submenu: shapeSubMenu,
  },
  {
    type: "normal",
    label: "Rotate",
    submenu: rotateSubMenu,
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

menuItems.forEach(function (item) {
  menu.append(new nw.MenuItem(item));
});
tray.menu = menu;

// Extend application menu for Mac OS
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
