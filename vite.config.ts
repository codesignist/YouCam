import { defineConfig } from "vite";

// Two pages: the camera window (index.html) and the screen light
// (light.html). Tauri serves the build from dist/ and, in `pnpm dev`, uses
// this dev server.
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
      },
    },
  },
});
