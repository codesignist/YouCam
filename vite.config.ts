import { defineConfig } from "vite";

// Three pages: the camera window (index.html), the screen light
// (light.html) and the settings window (settings.html). Tauri serves the
// build from dist/ and, in `pnpm dev`, uses this dev server.
export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: "es2022",
    rolldownOptions: {
      input: {
        main: "index.html",
        light: "light.html",
        settings: "settings.html",
      },
    },
  },
});
