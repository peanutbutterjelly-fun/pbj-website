// A blank magazine whose pages turn like real paper when you tap (or swipe, or press the arrow keys).
// Each leaf (one sheet, two pages) is a grid of points that is re-bent every frame: the sheet pivots on the spine,
// its free edge trails behind in a deep curl with a slight ripple, and the bottom corner trails a little more than the top.
// Neighbouring sheets follow one another a beat apart, so a run of pages ripples rather than moving as one block.
// The surface is glossy: reflections slide across it as the paper curves.
//
// createMagazine(canvas, { inner }): inner = number of inside pages (cover and back cover are extra), rounded up to even.
// Returns { next, prev, go(spread), get spread, get spreads, destroy }.
import * as THREE from "three";
import { makeStudio, paperMaterial } from "./studio.js";

const W = 1, H = 1.34; // one page, in scene units
const SX = 64, SY = 12; // grid of points per sheet
const EPS = 0.006; // gap between stacked sheets (it also shows as the thin edge of the stack)
const STAGGER_MS = 95; // how far apart neighbouring sheets set off
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (x) => x * x * x * (x * (x * 6 - 15) + 10); // smootherstep: slow start, flowing middle, soft landing

export function createMagazine(canvas, { inner = 24, flipMs = 1250 } = {}) { // flipMs: how long one turn takes
  const L = Math.max(1, Math.ceil(inner / 2)) + 1; // sheets: cover/p1, ..., last page/back cover
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);

  const studio = makeStudio(renderer);
  scene.environment = studio.texture;

  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-1.8, 2.6, 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 12 });
  sun.shadow.radius = 6;
  scene.add(sun);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.ShadowMaterial({ opacity: 0.22 }));
  wall.position.z = -0.3 - L * EPS * 0.5;
  wall.receiveShadow = true;
  scene.add(wall);

  // ---- the sheets ----
  const book = new THREE.Group();
  scene.add(book);
  const ends = (i) => i === 0 || i === L - 1; // covers are stiffer: they bend less
  const sheets = Array.from({ length: L }, (_, i) => {
    const geo = new THREE.PlaneGeometry(W, H, SX, SY);
    geo.translate(W / 2, 0, 0); // x runs 0..W from the spine
    const mesh = new THREE.Mesh(geo, paperMaterial(ends(i)));
    mesh.castShadow = true;
    book.add(mesh);
    // t: 0 = lying on the right, 1 = lying on the left. A turn is a timed move from `from` to `to`.
    return { mesh, geo, pos: geo.attributes.position, stiff: ends(i) ? 0.45 : 1, t: 0, from: 0, to: 0, start: 0, dur: flipMs, key: "", vel: 0 };
  });

  // Bend one sheet. theta: how far it has turned (0 flat on the right .. PI flat on the left).
  // lag: how far its free edge trails. wave: a ripple along it. tw: how much more the bottom corner trails than the top.
  // rest: the gentle bow it sits in when still.
  function bend(s, theta, lag, wave, tw, rest) {
    const ds = W / SX;
    for (let j = 0; j <= SY; j++) {
      const v = j / SY, y = (v - 0.5) * H;
      const k1 = 1 + tw * (1 - 2 * v);
      let x = 0, z = 0;
      for (let i = 0; i <= SX; i++) {
        s.pos.setXYZ(j * (SX + 1) + i, x, y, z);
        const u = (i + 0.5) / SX;
        const phi = theta - lag * k1 * Math.pow(u, 1.25) + wave * k1 * Math.sin(u * Math.PI * 1.7) + rest * (1 - u) * (1 - u);
        x += ds * Math.cos(phi);
        z += ds * Math.sin(phi);
      }
    }
    s.pos.needsUpdate = true;
    s.geo.computeVertexNormals();
    s.geo.computeBoundingSphere();
  }

  // ---- which spread we are on: 0 = closed front, L = closed back, 1..L-1 = open spreads ----
  let spread = 0, now = performance.now(), px = 0, pxCur = 0, dirty = true, raf = 0;
  // opts.ms / opts.stagger make a quicker run of turns (used when closing the book)
  function go(n, opts = {}) {
    n = clamp(Math.round(n), 0, L);
    if (n === spread) return;
    const forward = n > spread;
    const first = forward ? spread : n; // the sheets that change are first .. first+|n-spread|-1
    sheets.forEach((s, i) => {
      const to = i < n ? 1 : 0;
      if (to === s.to) return;
      const order = forward ? i - first : first + Math.abs(n - spread) - 1 - i; // the first sheet in the direction of travel goes first
      s.from = s.t; s.to = to;
      s.dur = opts.ms ?? flipMs;
      s.start = performance.now() + order * (opts.stagger ?? STAGGER_MS);
    });
    spread = n;
    dirty = true;
  }
  // snap everything shut at once (no animation)
  function reset() {
    sheets.forEach((s) => { s.t = s.from = s.to = 0; s.vel = 0; s.key = ""; });
    spread = 0; dirty = true;
  }
  const next = () => go(spread + 1);
  const prev = () => go(spread - 1);

  // ---- tap / swipe / keys ----
  let down = null, enabled = true;
  const rect = () => canvas.getBoundingClientRect();
  const onDown = (e) => { if (!enabled) return; down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
  const onUp = (e) => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    down = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) return dx < 0 ? next() : prev(); // swipe
    if (Math.hypot(dx, dy) < 12) (e.clientX - rect().left > rect().width / 2 ? next : prev)(); // tap: right half forward, left half back
  };
  const onKey = (e) => {
    if (!enabled || !canvas.clientWidth) return;
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
  };
  const onMove = (e) => { const r = rect(); px = clamp(((e.clientX - r.left) / (r.width || 1)) * 2 - 1, -1, 1); };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  addEventListener("keydown", onKey);
  addEventListener("pointermove", onMove, { passive: true });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return; // hidden
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const half = Math.tan((camera.fov * Math.PI) / 360);
    camera.userData = { d: Math.max((H * 1.5) / (2 * half), (2 * W * 1.3) / (2 * half * camera.aspect)), half };
    camera.updateProjectionMatrix();
    dirty = true;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // where the closed cover sits on screen, in pixels from the canvas's top-left (so a grid cover can fly to exactly here)
  function closedCoverRect() {
    const ch = canvas.clientHeight, cw = canvas.clientWidth;
    const { d, half } = camera.userData;
    const h = (H * ch) / (2 * d * half);
    return { cx: cw / 2, cy: ch / 2, w: h * (W / H), h };
  }

  function update(t, dt) {
    let moving = false;
    sheets.forEach((s, i) => {
      if (s.t !== s.to) {
        const p = reduced ? 1 : clamp((t - s.start) / s.dur, 0, 1);
        const nt = p <= 0 ? s.from : s.from + (s.to - s.from) * ease(p);
        s.vel += ((nt - s.t) / Math.max(dt, 1e-3) - s.vel) * 0.3; // how fast this sheet is moving
        s.t = p >= 1 ? s.to : nt;
        if (p >= 1) s.vel = 0;
        moving = true;
      }
      const bow = Math.sin(Math.PI * s.t); // zero when flat, most while turning
      const speed = reduced ? 0 : clamp(Math.abs(s.vel) / 1.8, 0, 1);
      const lag = (0.75 + 0.85 * speed) * bow * s.stiff;
      const wave = (0.12 + 0.2 * speed) * bow * s.stiff;
      const rest = (1 - 2 * s.t) * 0.2 * s.stiff;
      const key = s.t.toFixed(4) + "|" + lag.toFixed(3);
      if (key !== s.key) {
        s.key = key;
        bend(s, Math.PI * s.t, lag, wave, 0.4, rest);
        // earlier sheets sit on top when closed, later ones when open; a sheet in the air lifts clear of both stacks
        s.mesh.position.z = (1 - s.t) * (L - i) * EPS + s.t * i * EPS;
      }
    });
    book.position.x = (-0.5 + sheets[0].t * 0.5 + sheets[L - 1].t * 0.5) * W; // centre the cover, the spread, or the back cover
    const mid = sheets.reduce((a, s) => a + s.t, 0) / L;
    scene.environmentRotation.y = mid * 2.4 + pxCur * 0.35; // reflections drift as pages turn: the shine travels
    const d = camera.userData.d;
    camera.position.set(pxCur * 0.22, d * 0.024, d);
    camera.lookAt(0, 0, 0);
    return moving;
  }

  function frame(t) {
    const dt = Math.min(0.05, (t - now) / 1000); now = t;
    pxCur += (px - pxCur) * (reduced ? 1 : 1 - Math.exp(-dt * 4));
    const sway = Math.abs(px - pxCur) > 0.002;
    if (!canvas.clientWidth) { raf = requestAnimationFrame(frame); return; }
    if (dirty || sway || sheets.some((s) => s.t !== s.to)) {
      const moving = update(t, dt);
      renderer.render(scene, camera);
      dirty = moving;
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    next, prev, go, reset, resize, closedCoverRect,
    get enabled() { return enabled; },
    set enabled(v) { enabled = v; },
    get spread() { return spread; },
    get spreads() { return L; },
    destroy() {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      removeEventListener("keydown", onKey);
      removeEventListener("pointermove", onMove);
      ro.disconnect();
      sheets.forEach((s) => { s.geo.dispose(); s.mesh.material.dispose(); });
    
      renderer.dispose();
    },
  };
}
