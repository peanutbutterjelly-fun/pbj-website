import { resolve } from "node:path";
import { defineConfig } from "vite";

// Two pages: the main site and the scroll-flip magazine
export default defineConfig({
  build: {
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, "index.html"), magazine: resolve(import.meta.dirname, "magazine.html"), dashboard: resolve(import.meta.dirname, "dashboard.html"), pbj: resolve(import.meta.dirname, "pbj.html"), peanutp3d: resolve(import.meta.dirname, "peanutp3d.html"), butter3dglossy: resolve(import.meta.dirname, "butter3dglossy.html"), jellyhero3d: resolve(import.meta.dirname, "jellyhero3d.html") },
    },
  },
});
