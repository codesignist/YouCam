var gui = require("nw.gui");
let tray = new nw.Tray({
  title: "YouCam",
  tooltip: "YouCam",
  icon: "assets/icon-tray.png",
});

var menu = new nw.Menu();
let menuItems = [
  {
    type: "normal",
    label: "YouCam",
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

gui.Window.get().show();
