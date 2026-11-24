import { resolve } from "node:path";
import { defineConfig } from "vite";

// Two pages: the main site and the scroll-flip magazine
// Event addresses (/e/<name>-<id>) are served by event.html, like the rewrite in vercel.json does on the live site
const eventAddresses = {
  name: "event-addresses",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => { if (/^\/e\/[^/]+\/?(\?|$)/.test(req.url)) req.url = "/event.html"; next(); });
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, _res, next) => { if (/^\/e\/[^/]+\/?(\?|$)/.test(req.url)) req.url = "/event.html"; next(); });
  },
};

export default defineConfig({
  plugins: [eventAddresses],
  // The 3D letter pages load this file late; naming it here makes the dev server prepare it at start-up, so the
  // letters never fail with "Outdated Optimize Dep" after a restart
  optimizeDeps: { include: ["three", "three/examples/jsm/environments/RoomEnvironment.js", "three/examples/jsm/utils/BufferGeometryUtils.js"] },
  build: {
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, "index.html"), magazine: resolve(import.meta.dirname, "magazine.html"), dashboard: resolve(import.meta.dirname, "dashboard.html"), event: resolve(import.meta.dirname, "event.html"), spontys: resolve(import.meta.dirname, "spontys.html"), pbj: resolve(import.meta.dirname, "pbj.html"), peanutp3d: resolve(import.meta.dirname, "peanutp3d.html"), butter3dglossy: resolve(import.meta.dirname, "butter3dglossy.html"), jellyhero3d: resolve(import.meta.dirname, "jellyhero3d.html") },
    },
  },
});
