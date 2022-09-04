var gui = require("nw.gui");
let tray = new nw.Tray({
  title: "YouCam",
  tooltip: "YouCam",
  icon: "assets/icon-tray.png",
});

let isMirror = false;
let deg = 0;

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
    type: "checkbox",
    label: "Mirror",
    checked: isMirror,
    click: function () {
      isMirror = !isMirror;
      document.documentElement.style.setProperty("--scaleX", isMirror ? -1 : 1);
    },
  },
  {
    type: "normal",
    label: "Rotate",
    click: function () {
      deg -= 90;
      document.documentElement.style.setProperty("--rotate", `${deg}deg`);
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
