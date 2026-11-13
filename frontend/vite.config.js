import { resolve } from "node:path";
import { defineConfig } from "vite";

// Two pages: the main site and the scroll-flip magazine
export default defineConfig({
  // The 3D letter pages load this file late; naming it here makes the dev server prepare it at start-up, so the
  // letters never fail with "Outdated Optimize Dep" after a restart
  optimizeDeps: { include: ["three", "three/examples/jsm/environments/RoomEnvironment.js", "three/examples/jsm/utils/BufferGeometryUtils.js"] },
  build: {
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, "index.html"), magazine: resolve(import.meta.dirname, "magazine.html"), dashboard: resolve(import.meta.dirname, "dashboard.html"), event: resolve(import.meta.dirname, "event.html"), pbj: resolve(import.meta.dirname, "pbj.html"), peanutp3d: resolve(import.meta.dirname, "peanutp3d.html"), butter3dglossy: resolve(import.meta.dirname, "butter3dglossy.html"), jellyhero3d: resolve(import.meta.dirname, "jellyhero3d.html") },
    },
  },
});
