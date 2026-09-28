import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// mode === "web" builds the static GitHub Pages site (served from a repo
// sub-path); the default mode builds the frontend for the Tauri desktop app.
export default defineConfig(({ mode }) => ({
  base: mode === "web" ? "/stem-visual-explorer/" : "/",
  plugins: [react()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));