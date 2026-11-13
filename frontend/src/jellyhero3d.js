import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// The PB&J jelly J, made 3D from the reference photo (public/jelly-j-hero.webp), the same way as the butter B and the peanut P:
// the photo's outline becomes the silhouette of a flat-faced slab with a rounded edge and a straight wall, the same
// height, width and thickness as the other letters, and the photo is laid over it. Spin 360, or drag it round.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let seed = 5;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ---------- renderer, camera, light (identical framing to the B and the J) ----------
const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1.5;
const scene = new THREE.Scene();
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.25;
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
camera.position.set(0, 2.6, 9.6);
const look = new THREE.Vector3(0, 1.2, 0);

scene.add(new THREE.HemisphereLight(0xfff4e0, 0x8a6a40, 1.0));
const key = new THREE.DirectionalLight(0xfff0d6, 1.5);
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
  const img = new Image(); img.src = "/jelly-j-hero.webp"; await img.decode();
  const IW = img.naturalWidth, IH = img.naturalHeight;
  const pc = document.createElement("canvas"); pc.width = IW; pc.height = IH;
  const px = pc.getContext("2d", { willReadFrequently: true }); px.drawImage(img, 0, 0);
  const data = px.getImageData(0, 0, IW, IH).data;
  // The backdrop is pale, colourless checkerboard (or transparent). Butter is yellow. Big pale colourless regions are
  // backdrop - the outside and the B's two counters - while small pale specks inside the butter are just highlights.
  const cc = (m) => {
    const label = new Int32Array(IW * IH), sizes = [0], stack = new Int32Array(IW * IH);
    for (let s0 = 0; s0 < IW * IH; s0++) {
      if (!m[s0] || label[s0]) continue;
      const id = sizes.length; let sp = 0, cnt = 0; stack[sp++] = s0; label[s0] = id;
      while (sp) { const k = stack[--sp]; cnt++; const x = k % IW; if (x > 0 && m[k - 1] && !label[k - 1]) { label[k - 1] = id; stack[sp++] = k - 1; } if (x < IW - 1 && m[k + 1] && !label[k + 1]) { label[k + 1] = id; stack[sp++] = k + 1; } if (k >= IW && m[k - IW] && !label[k - IW]) { label[k - IW] = id; stack[sp++] = k - IW; } if (k < IW * IH - IW && m[k + IW] && !label[k + IW]) { label[k + IW] = id; stack[sp++] = k + IW; } }
      sizes.push(cnt);
    }
    return { label, sizes };
  };
  const pale = new Uint8Array(IW * IH);
  for (let i = 0; i < IW * IH; i++) { const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], hi = Math.max(r, g, b), lo = Math.min(r, g, b); pale[i] = data[i * 4 + 3] <= 128 || (hi - lo < 14 && lo > 170) ? 1 : 0; }
  const pc2 = cc(pale), raw = new Uint8Array(IW * IH);
  for (let i = 0; i < IW * IH; i++) raw[i] = pale[i] && pc2.sizes[pc2.label[i]] > 6000 ? 0 : 1;
  const sc2 = cc(raw);
  let best = 1; for (let i = 1; i < sc2.sizes.length; i++) if (sc2.sizes[i] > sc2.sizes[best]) best = i;
  const label = sc2.label;
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
  // A heavily blurred copy of the photo for the sides. A wall stretches the photo along the surface, which streaks every
  // sharp highlight into a "tear"; the blurred copy is smooth, so the sides read as plain glossy butter.
  // The sides take their colour from a very soft, local copy of the photo: each pixel blurred only with the butter around
  // it (the backdrop is left out, so no pale halo bleeds in). Face and wall both fade to it near the rim, so the colour runs
  // from the face over the edge and down the wall without a join.
  let mr = 0, mg = 0, mb = 0, mn = 0;
  for (let i = 0; i < IW * IH; i += 7) if (inside[i]) { mr += data[i * 4]; mg += data[i * 4 + 1]; mb += data[i * 4 + 2]; mn++; }
  // colours are taken from the face only: the photo's outermost ring is darker and more orange, and would tint the walls
  const ec = document.createElement("canvas"); ec.width = IW; ec.height = IH;
  const ex = ec.getContext("2d"); ex.filter = "blur(16px)"; ex.drawImage(mc, 0, 0);
  const ed = ex.getImageData(0, 0, IW, IH).data;
  const bd = px.createImageData(IW, IH);
  for (let i = 0; i < IW * IH; i++) { const on = inside[i] && ed[i * 4] > 235; bd.data[i * 4] = data[i * 4]; bd.data[i * 4 + 1] = data[i * 4 + 1]; bd.data[i * 4 + 2] = data[i * 4 + 2]; bd.data[i * 4 + 3] = on ? 255 : 0; }
  const bc0 = document.createElement("canvas"); bc0.width = IW; bc0.height = IH; bc0.getContext("2d").putImageData(bd, 0, 0);
  const bc = document.createElement("canvas"); bc.width = IW; bc.height = IH;
  const bx = bc.getContext("2d"); bx.filter = "blur(42px)"; bx.drawImage(bc0, 0, 0);
  const blurMap = new THREE.CanvasTexture(bc); blurMap.colorSpace = THREE.SRGBColorSpace; blurMap.anisotropy = 8;
  // A plain patch of the jam, cut from the calmest part of the face (no highlights, well inside the edge). The sides are
  // covered with it from all three directions, so they have the same colour, grain and bubbles as the face, with no join.
  // The sides must match the rounded rim the viewer sees all the way round the front: the darker, grainier red in the
  // outer band of the photo, not the lighter flat red of the middle. So the target colour is the band's average.
  let tr = 0, tg = 0, tb = 0, tc = 0;
  for (let i = 0; i < IW * IH; i += 3) if (inside[i] && ed[i * 4] > 40 && ed[i * 4] < 235) { const l = 0.3 * data[i * 4] + 0.59 * data[i * 4 + 1] + 0.11 * data[i * 4 + 2]; if (l < 150) { tr += data[i * 4]; tg += data[i * 4 + 1]; tb += data[i * 4 + 2]; tc++; } }
  tr /= Math.max(1, tc); tg /= Math.max(1, tc); tb /= Math.max(1, tc);
  const PS = 80; let calm = null;
  for (let y = 0; y + PS < IH; y += 16) for (let x = 0; x + PS < IW; x += 16) {
    let ok = true, n = 0, sr = 0, sg = 0, sb = 0, sl = 0, sl2 = 0, mx = 0;
    for (let yy = 0; yy < PS && ok; yy += 4) for (let xx = 0; xx < PS; xx += 4) {
      const k = (y + yy) * IW + x + xx;
      if (!inside[k] || ed[k * 4] < 235) { ok = false; break; }
      const r = data[k * 4], g = data[k * 4 + 1], b2 = data[k * 4 + 2], l = 0.3 * r + 0.59 * g + 0.11 * b2;
      sr += r; sg += g; sb += b2; sl += l; sl2 += l * l; n++; if (l > mx) mx = l;
    }
    if (!ok || mx > 150) continue;
    const dist = Math.hypot(sr / n - tr, sg / n - tg, sb / n - tb), variance = sl2 / n - (sl / n) ** 2, score = dist * 2 + Math.sqrt(Math.max(0, variance)) * 1.5; // closest to the rim's colour, with some grain
    if (!calm || score < calm.v) calm = { x, y, v: score };
  }
  const pcv = document.createElement("canvas"); pcv.width = pcv.height = 256;
  if (calm) pcv.getContext("2d").drawImage(pc, calm.x, calm.y, PS, PS, 0, 0, 256, 256);
  // make the patch tile without a seam: blend it with a copy of itself shifted half a tile, weighted so the join falls where the weight is zero
  { const px2 = pcv.getContext("2d"), src = px2.getImageData(0, 0, 256, 256), out = px2.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const wx = Math.sin((Math.PI * x) / 256) ** 2, wy = Math.sin((Math.PI * y) / 256) ** 2, w = wx * wy, o = (y * 256 + x) * 4, o2 = (((y + 128) % 256) * 256 + ((x + 128) % 256)) * 4;
      for (let c = 0; c < 3; c++) out.data[o + c] = src.data[o + c] * w + src.data[o2 + c] * (1 - w);
      out.data[o + 3] = 255;
    }
    px2.putImageData(out, 0, 0); }
  // keep only the patch's fine grain: take out its slow light and dark blotches, so the sides are an even red with no blocks
  { const c3 = document.createElement("canvas"); c3.width = c3.height = 768; const x3 = c3.getContext("2d");
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) x3.drawImage(pcv, i * 256, j * 256);
    const lo = document.createElement("canvas"); lo.width = lo.height = 768; const xl = lo.getContext("2d"); xl.filter = "blur(22px)"; xl.drawImage(c3, 0, 0);
    const L = xl.getImageData(256, 256, 256, 256).data, pxx = pcv.getContext("2d"), S = pxx.getImageData(0, 0, 256, 256);
    let ar = 0, ag = 0, ab = 0; for (let i = 0; i < 256 * 256; i++) { ar += S.data[i * 4]; ag += S.data[i * 4 + 1]; ab += S.data[i * 4 + 2]; }
    ar /= 65536; ag /= 65536; ab /= 65536;
    for (let i = 0; i < 256 * 256; i++) { S.data[i * 4] = clamp(S.data[i * 4] - L[i * 4] + ar, 0, 255); S.data[i * 4 + 1] = clamp(S.data[i * 4 + 1] - L[i * 4 + 1] + ag, 0, 255); S.data[i * 4 + 2] = clamp(S.data[i * 4 + 2] - L[i * 4 + 2] + ab, 0, 255); }
    pxx.putImageData(S, 0, 0); }
  const patchMap = new THREE.CanvasTexture(pcv); patchMap.colorSpace = THREE.SRGBColorSpace; patchMap.wrapS = patchMap.wrapT = THREE.RepeatWrapping; patchMap.anisotropy = 8;
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
  // A butter CUTOUT, not a balloon: a flat face, a short rounded edge, and a straight wall of butter all the way round.
  // The face height rises from the rim along a quarter circle over R cells and then stays flat.
  const blur = (a) => { const o = new Float32Array(a.length); for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) { let s = 0; for (let q = -1; q <= 1; q++) for (let r = -1; r <= 1; r++) s += a[(j + q) * W + i + r]; o[j * W + i] = s / 9; } return o; };
  const R = 62; // a bead of jam is a dome: the rounded edge reaches nearly to the middle of each stroke
  let h = new Float32Array(W * H);
  for (let k = 0; k < W * H; k++) { const t = clamp((d[k] - 1) / R, 0, 1); h[k] = ins[k] ? Math.sqrt(1 - (1 - t) ** 2) : 0; }
  for (let n = 0; n < 7; n++) h = blur(h);

  // Sides: the photo's own edge is a pale halo, and a wall stretches whatever lies at the edge. So near the rim the
  // picture is read from a little further in, and front and back read the very same spot at the rim: no seam, no halo.
  let db = d.slice(); for (let n = 0; n < 3; n++) db = blur(db);
  const E0 = 5, DF = 16, uvx = new Float32Array(W * H), uvy = new Float32Array(W * H);
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
    const k = j * W + i, gx = db[k + 1] - db[k - 1], gy = db[k + W] - db[k - W], gl = Math.hypot(gx, gy) || 1;
    const sh = E0 * (1 - clamp(d[k] / DF, 0, 1)) ** 2 * cs;
    uvx[k] = sx(i) + (gx / gl) * sh; uvy[k] = sy(j) + (gy / gl) * sh;
  }
  const sc = HEIGHT / bh, cxp = (x0 + x1) / 2, wx = WIDTH / (bw * sc); // every letter is exactly HEIGHT tall, WIDTH wide
  // one closed solid: the front face, the back face, and a straight wall joining them round the whole outline
  const N0 = W * H, ZW = 0.1, pos = new Float32Array(N0 * 6), uv = new Float32Array(N0 * 4), wall = new Float32Array(N0 * 2), idx = [];
  for (let side = 0; side < 2; side++) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, o = side * N0 + k, X = sx(i), Y = sy(j), z = ZW + (DEPTH - ZW) * h[k];
    pos[o * 3] = (X - cxp) * sc * wx; pos[o * 3 + 1] = (y1 - Y) * sc; pos[o * 3 + 2] = Z0 + (side ? -z : z);
    wall[o] = 1 - smooth(10, 30, d[k]); // the whole rounded edge and the wall share one soft colour
    uv[o * 2] = (uvx[k] || X) / IW; uv[o * 2 + 1] = 1 - (uvy[k] || Y) / IH;
  }
  const edges = new Map(), ends = new Map();
  for (let j = 0; j < H - 1; j++) for (let i = 0; i < W - 1; i++) {
    const a = j * W + i, b = a + 1, c = a + W, e = c + 1;
    if (!(ins[a] && ins[b] && ins[c] && ins[e])) continue;
    idx.push(a, c, b, b, c, e, N0 + a, N0 + b, N0 + c, N0 + b, N0 + e, N0 + c);
    for (const [p, q] of [[a, b], [b, e], [e, c], [c, a]]) { const key = Math.min(p, q) * N0 + Math.max(p, q); edges.set(key, (edges.get(key) || 0) + 1); ends.set(key, [p, q]); }
  }
  const base = new THREE.BufferGeometry();
  base.setAttribute("position", new THREE.BufferAttribute(pos, 3)); base.setIndex(idx); base.computeVertexNormals();
  const bn = base.attributes.normal.array;
  // the wall gets its own vertices, each with a plain outward normal read from the outline, so it shades as one clean band
  const wp = [], wu = [], wn = [], ww = [], wi = [];
  let dn = d.slice(); for (let n = 0; n < 14; n++) dn = blur(dn);
  const outN = (k) => { const gx = dn[k + 3] - dn[k - 3] + dn[k + W * 3 + 3] - dn[k - W * 3 - 3] * 0 + dn[k + 2] - dn[k - 2], gy = dn[k + W * 3] - dn[k - W * 3] + dn[k + W * 2] - dn[k - W * 2], l = Math.hypot(gx, gy) || 1; return [-gx / l, gy / l]; };
  // Shading normals for the faces, worked out from the edge profile itself instead of from the stair-stepped grid. At the rim
  // the rounded edge is exactly vertical, so it meets the wall's normal with no crease, and nothing bands.
  const PRIME = (DEPTH - ZW) / (R * cs * sc);
  for (let k = 0; k < N0; k++) {
    if (!ins[k]) continue;
    const t = clamp((db[k] - 0.4) / R, 0, 1);
    if (t >= 1) { bn[k * 3] = 0; bn[k * 3 + 1] = 0; bn[k * 3 + 2] = 1; bn[(N0 + k) * 3] = 0; bn[(N0 + k) * 3 + 1] = 0; bn[(N0 + k) * 3 + 2] = -1; continue; }
    const arcP = (1 - t) / Math.sqrt(Math.max(1e-4, 1 - (1 - t) ** 2)), fp = Math.min(40, PRIME * arcP), no = outN(k);
    const L = Math.hypot(no[0] * fp, no[1] * fp, 1);
    bn[k * 3] = (no[0] * fp) / L; bn[k * 3 + 1] = (no[1] * fp) / L; bn[k * 3 + 2] = 1 / L;
    bn[(N0 + k) * 3] = (no[0] * fp) / L; bn[(N0 + k) * 3 + 1] = (no[1] * fp) / L; bn[(N0 + k) * 3 + 2] = -1 / L;
  }
  for (const [key, n] of edges) {
    if (n !== 1) continue;
    const [p, q] = ends.get(key), v0 = wp.length / 3;
    for (const [k, side] of [[p, 0], [q, 0], [q, 1], [p, 1]]) {
      const o = side * N0 + k, nn = outN(k);
      wp.push(pos[o * 3], pos[o * 3 + 1], pos[o * 3 + 2]); wu.push(uv[o * 2], uv[o * 2 + 1]); wn.push(nn[0], nn[1], 0); ww.push(1);
    }
    const ex = wp[(v0 + 1) * 3] - wp[v0 * 3], ey = wp[(v0 + 1) * 3 + 1] - wp[v0 * 3 + 1], ez = wp[(v0 + 2) * 3 + 2] - wp[v0 * 3 + 2];
    // face normal of (0, 1, 2) = e x (0, 0, ez) = (ey * ez, -ex * ez, 0); keep it facing the outward normal
    if ((ey * ez) * wn[v0 * 3] + (-ex * ez) * wn[v0 * 3 + 1] >= 0) wi.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3); else wi.push(v0, v0 + 2, v0 + 1, v0, v0 + 3, v0 + 2);
  }
  const cat = (A, B) => { const o = new Float32Array(A.length + B.length); o.set(A); o.set(B, A.length); return o; };
  const geoSolid = new THREE.BufferGeometry();
  geoSolid.setAttribute("position", new THREE.BufferAttribute(cat(pos, new Float32Array(wp)), 3));
  geoSolid.setAttribute("normal", new THREE.BufferAttribute(cat(bn, new Float32Array(wn)), 3));
  geoSolid.setAttribute("uv", new THREE.BufferAttribute(cat(uv, new Float32Array(wu)), 2));
  geoSolid.setAttribute("wall", new THREE.BufferAttribute(cat(wall, new Float32Array(ww)), 1));
  geoSolid.setAttribute("seam", new THREE.BufferAttribute(new Float32Array(N0 * 2 + ww.length), 1));
  geoSolid.setIndex(idx.concat(wi.map((v) => v + N0 * 2)));
  // the sides are one plain buttery yellow: the photo's edge pixels (rim light, dark fringe) would only stripe them
  const wallColor = new THREE.Color().setRGB(mr / mn / 255, mg / mn / 255, mb / mn / 255, THREE.SRGBColorSpace);
  wallColor.multiplyScalar(1.0);
  const mat = new THREE.MeshPhysicalMaterial({ map, roughness: 0.22, clearcoat: 0.4, clearcoatRoughness: 0.08, specularIntensity: 0.5 });
  mat.toneMapped = false; // the photo's own colours, shown as they are, from every side
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.blurMap = { value: blurMap }; sh.uniforms.patchMap = { value: patchMap }; sh.uniforms.wallColor = { value: wallColor };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float wall; attribute float seam; varying float vWall; varying float vSeam; varying vec3 vOP; varying vec3 vON;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvWall = wall; vSeam = seam; vOP = position; vON = normal;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform sampler2D blurMap; uniform sampler2D patchMap; uniform vec3 wallColor; varying float vWall; varying float vSeam; varying vec3 vOP; varying vec3 vON;").replace("#include <map_fragment>", "#ifdef USE_MAP\n vec3 tw = pow(abs(normalize(vON)), vec3(5.0)); tw /= tw.x + tw.y + tw.z + 1e-4;\n vec3 tri = texture2D(patchMap, vOP.zy * 0.7).rgb * tw.x + texture2D(patchMap, vOP.xz * 0.7).rgb * tw.y + texture2D(patchMap, vOP.xy * 0.7).rgb * tw.z;\n vec3 side = tri * 0.88;\n diffuseColor.rgb *= mix(texture2D(map, vMapUv).rgb, side, vWall);\n diffuseColor.rgb *= 1.0 - 0.09 * vSeam;\n#endif").replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * 1.0; diffuseColor.rgb *= 0.12;").replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.62, vWall);").replace("#include <lights_physical_fragment>", "#include <lights_physical_fragment>\n material.clearcoat *= 1.0 - vWall;");
  };
  // the letter throws a shadow but never receives its own
  const m = new THREE.Mesh(geoSolid, mat); m.castShadow = true; grp.add(m);
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
