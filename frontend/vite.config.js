import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";

// Dev only: keeps a copy of the host drafts in frontend/.dev-data/ so they survive the preview browser being reset (see src/devBackup.js)
const devDrafts = () => ({
  name: "pbj-dev-drafts",
  apply: "serve",
  configureServer(server) {
    const file = resolve(import.meta.dirname, ".dev-data/host-events.json");
    server.middlewares.use("/__drafts", (req, res) => {
      if (req.method === "GET") { res.setHeader("content-type", "application/json"); res.end(existsSync(file) ? readFileSync(file, "utf8") : "[]"); return; }
      if (req.method === "PUT") {
        let body = "";
        req.on("data", (c) => { body += c; });
        req.on("end", () => { try { JSON.parse(body); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, body); res.statusCode = 204; } catch { res.statusCode = 400; } res.end(); });
        return;
      }
      res.statusCode = 405; res.end();
    });
  },
});

// Two pages: the main site and the scroll-flip magazine
export default defineConfig({
  plugins: [devDrafts()],
  // The 3D letter pages load this file late; naming it here makes the dev server prepare it at start-up, so the
  // letters never fail with "Outdated Optimize Dep" after a restart
  optimizeDeps: { include: ["three", "three/examples/jsm/environments/RoomEnvironment.js", "three/examples/jsm/utils/BufferGeometryUtils.js"] },
  build: {
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, "index.html"), magazine: resolve(import.meta.dirname, "magazine.html"), dashboard: resolve(import.meta.dirname, "dashboard.html"), event: resolve(import.meta.dirname, "event.html"), spontys: resolve(import.meta.dirname, "spontys.html"), pbj: resolve(import.meta.dirname, "pbj.html"), peanutp3d: resolve(import.meta.dirname, "peanutp3d.html"), butter3dglossy: resolve(import.meta.dirname, "butter3dglossy.html"), jellyhero3d: resolve(import.meta.dirname, "jellyhero3d.html") },
    },
  },
});
