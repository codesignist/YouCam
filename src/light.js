// Screen light: a plain white window to light your face with a monitor.
// Double-click or F / F11 toggles fullscreen, Esc leaves it, L closes it.
let win = nw.Window.get();
// Tracked here rather than read from win.isFullscreen, which lags behind
// while the window is still animating in or out of fullscreen
let fullscreen = false;

restoreBounds(win, "lightBounds");
win.show();
if (localStorage.getItem("lightFullscreen") === "true") setFullscreen(true);

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
}

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
