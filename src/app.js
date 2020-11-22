var gui = require("nw.gui");

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
