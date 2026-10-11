// Helpers shared by the camera window (main.ts) and the screen light
// (light.ts).
import {
  availableMonitors,
  primaryMonitor,
  PhysicalPosition,
  PhysicalSize,
  type Monitor,
  type Window,
} from "@tauri-apps/api/window";

// Window geometry in physical pixels, the way Tauri reports it: the outer
// position and the inner (content) size, which is also what setSize() sets
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function getBounds(win: Window): Promise<Bounds> {
  const [position, size] = await Promise.all([
    win.outerPosition(),
    win.innerSize(),
  ]);
  return { x: position.x, y: position.y, width: size.width, height: size.height };
}

export function monitorAt(
  monitors: Monitor[],
  x: number,
  y: number
): Monitor | undefined {
  return monitors.find(
    ({ workArea: { position: p, size: s } }) =>
      x >= p.x && x < p.x + s.width && y >= p.y && y < p.y + s.height
  );
}

export function saveBounds(key: string, bounds: Bounds): void {
  localStorage.setItem(key, JSON.stringify(bounds));
}

function loadBounds(key: string): Bounds | null {
  try {
    const bounds = JSON.parse(localStorage.getItem(key) ?? "null");
    const valid = ["x", "y", "width", "height"].every((k) =>
      Number.isFinite(bounds?.[k])
    );
    return valid ? bounds : null;
  } catch {
    return null;
  }
}

export async function centerOn(
  win: Window,
  monitor: Monitor,
  size: { width: number; height: number }
): Promise<void> {
  const { position: p, size: s } = monitor.workArea;
  await win.setPosition(
    new PhysicalPosition(
      Math.round(p.x + (s.width - size.width) / 2),
      Math.round(p.y + (s.height - size.height) / 2)
    )
  );
}

// Restore a window's last size and position, falling back to the center of
// the primary monitor if that spot is gone (e.g. a monitor was unplugged).
// Returns false if nothing was saved yet.
export async function restoreBounds(win: Window, key: string): Promise<boolean> {
  const bounds = loadBounds(key);
  if (!bounds) return false;
  const monitors = await availableMonitors();
  // Resize before moving, so the move has the last word on the position
  await win.setSize(new PhysicalSize(bounds.width, bounds.height));
  if (monitorAt(monitors, bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)) {
    await win.setPosition(new PhysicalPosition(bounds.x, bounds.y));
  } else {
    const primary = (await primaryMonitor()) ?? monitors[0];
    if (primary) await centerOn(win, primary, bounds);
  }
  return true;
}

export function debounced(action: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(action, ms);
  };
}
