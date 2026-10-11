// Helpers shared by the camera window (app.js) and the screen light
// (light.js): each page loads this before its own script.
nw.Screen.Init();

function screenAt(x, y) {
  return nw.Screen.screens.find(
    ({ work_area: a }) =>
      x >= a.x && x < a.x + a.width && y >= a.y && y < a.y + a.height
  );
}

// The size is the content size: resizeTo() sets that, while win.width and
// win.height include the frame of a framed window (the screen light), so
// saving those would grow the window by its frame on every restore
function saveBounds(win, key) {
  localStorage.setItem(
    key,
    JSON.stringify({
      x: win.x,
      y: win.y,
      width: win.window.innerWidth,
      height: win.window.innerHeight,
    })
  );
}

// Restore a window's last size and position, falling back to the center of
// the primary screen if that spot is gone (e.g. a monitor was unplugged).
// Returns false if nothing was saved yet.
function restoreBounds(win, key) {
  let bounds;
  try {
    bounds = JSON.parse(localStorage.getItem(key));
  } catch {}
  if (!bounds) return false;
  // Resize before moving: on a framed window resizeTo() can push it back to
  // y = 0, i.e. off a monitor that sits above the primary one
  win.resizeTo(bounds.width, bounds.height);
  if (screenAt(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)) {
    win.moveTo(bounds.x, bounds.y);
  } else {
    let area = nw.Screen.screens[0].work_area;
    win.moveTo(
      Math.round(area.x + (area.width - bounds.width) / 2),
      Math.round(area.y + (area.height - bounds.height) / 2)
    );
  }
  return true;
}

function debounced(action, ms) {
  let timer;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(action, ms);
  };
}
