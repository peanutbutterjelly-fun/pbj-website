// node film/sheet.mjs  -> film/out/sheet.png : one frame per beat (+ the last frame), tiled
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const beats = JSON.parse(readFileSync(dir + '/beats.json'));
const off = Number(process.argv[2] ?? 0.09);
rmSync(dir + '/out/sheet', { recursive: true, force: true });
mkdirSync(dir + '/out/sheet', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto('file://' + dir + '/index.html');
await page.evaluate(() => window.ready);
const n = beats.duration / beats.beatSec;
const times = [...Array(n)].map((_, i) => i * beats.beatSec + off).concat([beats.duration - 0.02]);
for (let i = 0; i < times.length; i++) {
  await page.evaluate((t) => window.seek(t), times[i]);
  await page.locator('#c').screenshot({ path: `${dir}/out/sheet/f${String(i).padStart(2, '0')}.png` });
}
await browser.close();
const r = spawnSync('ffmpeg', ['-y', '-framerate', '1', '-i', dir + '/out/sheet/f%02d.png',
  '-vf', 'scale=216:-1,tile=8x4:padding=6:color=0x808080', '-frames:v', '1', dir + '/out/sheet.png'], { stdio: 'inherit' });
console.log('sheet done', r.status);
