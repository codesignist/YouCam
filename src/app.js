var gui = require("nw.gui");
let tray = new nw.Tray({
  title: "YouCam",
  tooltip: "YouCam",
  icon: "assets/icon-tray.png",
});

let deg = 0;

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
    label: "Mirror",
    click: function () {
      const video = document.getElementById("camera");
      video.classList.toggle("mirror");
    },
  },
  {
    type: "normal",
    label: "Rotate",
    click: function () {
      deg += 90;
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

navigator.webkitGetUserMedia(
  { video: true },
  function (stream) {
    const video = document.getElementById("camera");
    video.srcObject = stream;
  },
  function () {
    alert("could not connect stream");
  }
);

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
