import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// The PB&J peanut P, made 3D from the reference photo (public/peanut-p.webp). The photo's outline becomes the letter's
// silhouette, the shape is inflated into a puffy pillow (flat-ish face, rounded sides) the same size, height and depth
// as the butter B and the jelly J, and the photo itself is laid over it as the shell, so the real veins, grain and
// specks are the surface. It only turns: Spin 360, or drag it round.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let seed = 5;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ---------- renderer, camera, light (identical framing to the B and the J) ----------
const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
camera.position.set(0, 2.6, 9.6);
const look = new THREE.Vector3(0, 1.2, 0);

scene.add(new THREE.HemisphereLight(0xfff4e0, 0x5a3a22, 0.55));
const key = new THREE.DirectionalLight(0xfff0d6, 2.4);
key.position.set(3.5, 7, 5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -4, near: 1, far: 24 });
key.shadow.radius = 7; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
scene.add(key);
// in PBJ the light is a little higher, so each shadow still slants left but stays short; the frames are stacked left over right, so a shadow falls behind the letter on its left, never across it
if (location.search.includes("embed")) key.position.set(2.2, 8, 3.8);
const fill = new THREE.DirectionalLight(0xffd9b0, 0.8);
fill.position.set(-5, 3, 3);
scene.add(fill);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.18 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
scene.add(ground);
if (location.search.includes("embed")) ground.visible = false; // in PBJ the letters have no floor shadow


// ---------- the photo, its outline, and a puffy height map ----------
const Z0 = -0.105, HEIGHT = 2.43, DEPTH = 0.42, WIDTH = 1.75, GW = 300;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const grp = new THREE.Group();
grp.matrixAutoUpdate = false;

// PBJ: the three letters are measured on screen and scaled and shifted a hair, so that all stand on one baseline, are exactly
// the same height and are centred in their own space (perspective and the three different outlines would otherwise leave
// them a few pixels apart).
const fit = { s: 1, dx: 0, dy: 0 }, EMBED = location.search.includes("embed"), SC = new THREE.Matrix4();
function placeGroup(yaw) { grp.matrix.makeRotationY(yaw).premultiply(SC.makeScale(fit.s, fit.s, fit.s)).setPosition(fit.dx, 0.1 + fit.dy, 0); }
function normalise() {
  if (!EMBED) return;
  camera.position.set(0, 2.6, 9.6); camera.lookAt(look); camera.updateMatrixWorld(true);
  const v = new THREE.Vector3(), r0 = new THREE.Vector3(0, 0.1, 0).project(camera), r1 = new THREE.Vector3(0, 0.1 + HEIGHT, 0).project(camera), rx = new THREE.Vector3(1, 0.1, 0).project(camera);
  const kY = (r1.y - r0.y) / HEIGHT, kX = rx.x - r0.x;
  for (let pass = 0; pass < 3; pass++) {
    placeGroup(0); grp.updateMatrixWorld(true);
    let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9;
    grp.traverse((o) => {
      if (!o.isMesh) return;
      const a = o.geometry.attributes.position;
      for (let i = 0; i < a.count; i += 2) { v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld).project(camera); if (v.y < y0) y0 = v.y; if (v.y > y1) y1 = v.y; if (v.x < x0) x0 = v.x; if (v.x > x1) x1 = v.x; }
    });
    fit.s *= (r1.y - r0.y) / (y1 - y0);
    fit.dy += (r0.y - y0) / kY / fit.s * fit.s;
    fit.dx += (0 - (x0 + x1) / 2) / kX;
  }
  placeGroup(0);
}

scene.add(grp);

async function build() {
  const img = new Image(); img.src = "/peanut-p.webp"; await img.decode();
  const IW = img.naturalWidth, IH = img.naturalHeight;
  const pc = document.createElement("canvas"); pc.width = IW; pc.height = IH;
  const px = pc.getContext("2d", { willReadFrequently: true }); px.drawImage(img, 0, 0);
  const data = px.getImageData(0, 0, IW, IH).data;
  // everything near-white and colourless is background (and so is the hole); the shell is the largest piece of what is left
  const raw = new Uint8Array(IW * IH);
  for (let i = 0; i < IW * IH; i++) { const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]; const lo = Math.min(r, g, b), hi = Math.max(r, g, b); raw[i] = data[i * 4 + 3] > 128 && !(lo > 232 && hi - lo < 24) ? 1 : 0; }
  const label = new Int32Array(IW * IH), stack = new Int32Array(IW * IH);
  let best = 0, bestN = 0, n = 0;
  for (let s0 = 0; s0 < IW * IH; s0++) {
    if (!raw[s0] || label[s0]) continue;
    n++; let sp = 0, cnt = 0; stack[sp++] = s0; label[s0] = n;
    while (sp) { const k = stack[--sp]; cnt++; const x = k % IW; if (x > 0 && raw[k - 1] && !label[k - 1]) { label[k - 1] = n; stack[sp++] = k - 1; } if (x < IW - 1 && raw[k + 1] && !label[k + 1]) { label[k + 1] = n; stack[sp++] = k + 1; } if (k >= IW && raw[k - IW] && !label[k - IW]) { label[k - IW] = n; stack[sp++] = k - IW; } if (k < IW * IH - IW && raw[k + IW] && !label[k + IW]) { label[k + IW] = n; stack[sp++] = k + IW; } }
    if (cnt > bestN) { bestN = cnt; best = n; }
  }
  const inside = new Uint8Array(IW * IH);
  let x0 = IW, x1 = 0, y0 = IH, y1 = 0;
  for (let y = 0; y < IH; y++) for (let x = 0; x < IW; x++) {
    if (label[y * IW + x] === best) { inside[y * IW + x] = 1; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  // a clean alpha for the cut-out: the mask, lightly blurred, so the edge is smooth
  const mc = document.createElement("canvas"); mc.width = IW; mc.height = IH;
  const mx = mc.getContext("2d"), md = mx.createImageData(IW, IH);
  for (let i = 0; i < IW * IH; i++) { const v = inside[i] ? 255 : 0; md.data[i * 4] = md.data[i * 4 + 1] = md.data[i * 4 + 2] = v; md.data[i * 4 + 3] = 255; }
  mx.putImageData(md, 0, 0);
  const mc2 = document.createElement("canvas"); mc2.width = IW; mc2.height = IH;
  const m2 = mc2.getContext("2d"); m2.filter = "blur(1.5px)"; m2.drawImage(mc, 0, 0);
  const alphaMap = new THREE.CanvasTexture(mc2);
  const map = new THREE.CanvasTexture(pc); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const gray = document.createElement("canvas"); gray.width = IW; gray.height = IH;
  const gx = gray.getContext("2d"); gx.filter = "grayscale(1) contrast(1.4)"; gx.drawImage(img, 0, 0);
  const bump = new THREE.CanvasTexture(gray); bump.anisotropy = 8;

  // a grid over the letter's box
  const bw = x1 - x0, bh = y1 - y0, cs = bw / GW, GH = Math.round(bh / cs), pad = 3;
  const W = GW + 2 * pad + 1, H = GH + 2 * pad + 1;
  const sx = (i) => x0 + (i - pad) * cs, sy = (j) => y0 + (j - pad) * cs;
  const ins = new Uint8Array(W * H), lum = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const X = Math.round(sx(i)), Y = Math.round(sy(j));
    if (X < 0 || Y < 0 || X >= IW || Y >= IH) continue;
    ins[j * W + i] = inside[Y * IW + X];
    const o = (Y * IW + X) * 4; lum[j * W + i] = 0.3 * data[o] + 0.59 * data[o + 1] + 0.11 * data[o + 2];
  }
  // distance from the edge (two-pass chamfer), in grid cells
  const d = new Float32Array(W * H).map((_, k) => (ins[k] ? 1e6 : 0));
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i; if (!ins[k]) continue; let v = d[k]; if (i) v = Math.min(v, d[k - 1] + 1); if (j) v = Math.min(v, d[k - W] + 1); if (i && j) v = Math.min(v, d[k - W - 1] + 1.414); if (j && i < W - 1) v = Math.min(v, d[k - W + 1] + 1.414); d[k] = v; }
  for (let j = H - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) { const k = j * W + i; if (!ins[k]) continue; let v = d[k]; if (i < W - 1) v = Math.min(v, d[k + 1] + 1); if (j < H - 1) v = Math.min(v, d[k + W] + 1); if (i < W - 1 && j < H - 1) v = Math.min(v, d[k + W + 1] + 1.414); if (j < H - 1 && i) v = Math.min(v, d[k + W - 1] + 1.414); d[k] = v; }
  // the pillow: rounded at the edge, nearly flat across the face
  const D = 0.3 * GW;
  let h = new Float32Array(W * H);
  for (let k = 0; k < W * H; k++) { const t = clamp((d[k] - 1) / D, 0, 1); h[k] = ins[k] ? Math.sin((t * Math.PI) / 2) : 0; }
  const blur = (a) => { const o = new Float32Array(a.length); for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) { let s = 0; for (let q = -1; q <= 1; q++) for (let r = -1; r <= 1; r++) s += a[(j + q) * W + i + r]; o[j * W + i] = s / 9; } return o; };
  h = blur(blur(blur(h)));
  // the seam: a soft raised lip on each side of the join, like the ridge that runs round a real peanut shell
  for (let k = 0; k < W * H; k++) if (ins[k]) h[k] = d[k] <= 1.2 ? 0 : h[k] + 0.012 * Math.exp(-(((d[k] - 3) / 1.6) ** 2));
  // a little of the photo's own relief, so the ribs and veins stand up a touch
  let lo = lum; for (let n = 0; n < 6; n++) lo = blur(lo);
  for (let k = 0; k < W * H; k++) h[k] += clamp(((lum[k] - lo[k]) / 255) * 0.5, -0.06, 0.06) * smooth(2, 12, d[k]);

  // Sides: the photo's own edge is a pale halo, and a wall stretches whatever lies at the edge. So near the rim the
  // picture is read from a little further in, and front and back read the very same spot at the rim: no seam, no halo.
  let db = d.slice(); for (let n = 0; n < 3; n++) db = blur(db);
  const E0 = 18, DF = 42, uvx = new Float32Array(W * H), uvy = new Float32Array(W * H);
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
    const k = j * W + i, gx = db[k + 1] - db[k - 1], gy = db[k + W] - db[k - W], gl = Math.hypot(gx, gy) || 1;
    const sh = E0 * (1 - clamp(d[k] / DF, 0, 1)) ** 2 * cs;
    uvx[k] = sx(i) + (gx / gl) * sh; uvy[k] = sy(j) + (gy / gl) * sh;
  }
  const sc = HEIGHT / bh, cxp = (x0 + x1) / 2, wx = WIDTH / (bw * sc); // every letter is exactly HEIGHT tall, WIDTH wide
  const surf = (front) => {
    const pos = new Float32Array(W * H * 3), uv = new Float32Array(W * H * 2), idx = [];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i, X = sx(i), Y = sy(j);
      pos[k * 3] = (X - cxp) * sc * wx; pos[k * 3 + 1] = (y1 - Y) * sc; pos[k * 3 + 2] = Z0 + (front ? 1 : -1) * Math.max(0, h[k]) * DEPTH;
      uv[k * 2] = (uvx[k] || X) / IW; uv[k * 2 + 1] = 1 - (uvy[k] || Y) / IH;
    }
    for (let j = 0; j < H - 1; j++) for (let i = 0; i < W - 1; i++) {
      const a = j * W + i, b = a + 1, c = a + W, e = c + 1;
      if (!(ins[a] && ins[b] && ins[c] && ins[e])) continue;
      if (front) idx.push(a, c, b, b, c, e); else idx.push(a, b, c, b, e, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  };
  const mat = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 0.5, roughness: 0.9 });
  const geos = [surf(true), surf(false)];
  // the rim: front and back share these points, so give them one shared normal and the join disappears
  const nf = geos[0].attributes.normal, nb = geos[1].attributes.normal;
  for (let k = 0; k < W * H; k++) {
    if (!ins[k] || d[k] > 1.5) continue;
    const x = nf.getX(k) + nb.getX(k), y = nf.getY(k) + nb.getY(k), z = nf.getZ(k) + nb.getZ(k), l = Math.hypot(x, y, z) || 1;
    nf.setXYZ(k, x / l, y / l, z / l); nb.setXYZ(k, x / l, y / l, z / l);
  }
  for (const g of geos) { const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; grp.add(m); }
  normalise();
  parent.postMessage("letter-ready", "*");
}
build();

// ---------- turning: Spin 360, or drag ----------
const ease = (u) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2);
let yaw = -0.18, vel = 0, dragging = false, lastX = 0, lastT = 0, spin = null, ty = 0, ry = 0;
function startSpin() { if (!spin) { spin = { from: yaw, t0: performance.now() }; vel = 0; } }
canvas.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; lastT = e.timeStamp; vel = 0; canvas.setPointerCapture(e.pointerId); spin = null; });
canvas.addEventListener("pointermove", (e) => {
  ty = (e.clientY / innerHeight - 0.5) * 2;
  if (!dragging) return;
  const dx = e.clientX - lastX, dt = Math.max(1, e.timeStamp - lastT) / 1000;
  yaw += dx * 0.012; vel = clamp((dx * 0.012) / dt, -14, 14); lastX = e.clientX; lastT = e.timeStamp;
});
canvas.addEventListener("pointerup", () => { dragging = false; });
document.getElementById("spin").addEventListener("click", startSpin);
addEventListener("message", (e) => { if (e.data === "spin") startSpin(); else if (e.data && typeof e.data.yaw === "number") { yaw = e.data.yaw; vel = 0; spin = null; } }); // in PBJ one shared angle drives all three letters
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = Math.max(19, (2 * Math.atan(3.9 / Math.min(1, w / h) / 2 / 9.6) * 180) / Math.PI);
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize); resize();
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
let prev = 0;
renderer.setAnimationLoop((t) => {
  const dt = Math.min(0.04, (t - prev) / 1000 || 0.016); prev = t;
  if (spin) {
    const u = clamp((performance.now() - spin.t0) / (reduce ? 1 : 1500), 0, 1);
    yaw = spin.from + Math.PI * 2 * ease(u);
    if (u >= 1) spin = null;
  } else if (!dragging) { yaw += vel * dt; vel *= Math.pow(0.04, dt); }
  ry += (ty * 0.12 - ry) * 0.06;
  placeGroup(yaw);
  grp.matrixWorldNeedsUpdate = true; grp.updateMatrixWorld(true);
  camera.position.set(0, 2.6 + ry * 1.2, 9.6);
  camera.lookAt(look);
  renderer.render(scene, camera);
});
