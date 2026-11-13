// Takes screenshots of a built site folder: node scripts/screenshots.mjs <distDir> <outDir>
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const [dist, out] = process.argv.slice(2);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json" };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  try {
    const f = await readFile(join(dist, normalize(p)));
    res.writeHead(200, { "content-type": types[extname(p)] || "application/octet-stream" });
    res.end(f);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const sizes = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
for (const [name, viewport] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: name === "phone", reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[${name}] page error: ${e.message}`));
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(6000); // loading intro + hero opening
  for (let i = 0; i < 3; i++) {
    // The 3D home page is slow to draw on the checking computer (no graphics card), so allow up to 3 minutes
    await page.screenshot({ path: join(out, `${name}-${i + 1}.png`), timeout: 180000 });
    await page.evaluate((h) => window.scrollBy(0, h), viewport.height * 1.5);
    await page.waitForTimeout(2000);
  }
  await ctx.close();
}
await browser.close();
server.close();
