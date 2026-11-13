// "Meet Our Hosts": an endless grid of magazine covers, one per host, ported step by step from the 197 Historias
// Ilustradas grid (its layout numbers, easing and timings are copied from that site):
//  - a staggered lattice that wraps forever in both directions, so there is never a gap
//  - it opens with a diamond of cards in the middle that bursts out into the full grid
//  - drag to move (the grid eases after your hand and zooms out a little while you drag), wheel / trackpad to scroll,
//    and a soft parallax follows the mouse
//  - tap a cover: every cover wipes away, nearest first and the tapped one last, then the magazine is revealed and opens wide
//  - [ CLOSE ] shuts it and the covers wipe back in
// The covers are flat and blank for now; real covers, names and the host roster come later.
import { gsap } from "gsap";
import { createMagazine } from "./magazine.js";

const HOST_COUNT = 30; // one cover per host; this becomes the real roster later
const INNER_PAGES = 24; // inside pages per magazine; each host's own count goes here later
const COVER_RATIO = 1.34; // cover height / width, the same as a magazine page

// The lattice is 197's idea (columns that alternate up and down, wrapping forever), but tuned so the spacing is perfectly even:
// every column is one step across, every other column sits half a step lower, and there is no per-row shift.
const BREAKPOINT = 768;
const ITEM_REM = { mobile: 5.4375, desktop: 7.875 }; // cover width, in rem (197's numbers)
const LAYOUT = {
  mobile: { title: 1.375, gapXk: 0.8, gapYk: 0.5, top: 5.5, side: 1 },
  desktop: { title: 1.875, gapXk: 0.85, gapYk: 0.45, top: 7.25, side: 2 }, // gaps are fractions of the cover width
};
const SMOOTH = 0.08; // how much of the remaining distance the grid covers each frame (at 60 frames a second)

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const pad = (n) => String(n).padStart(2, "0");
const rand = (a, b) => a + Math.random() * (b - a);

// a CSS-style cubic-bezier as an easing function (their "ease-80" curve)
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) { const d = (3 * ax * t + 2 * bx) * t + cx; if (Math.abs(d) < 1e-6) break; t -= (X(t) - x) / d; }
    return Y(Math.min(1, Math.max(0, t)));
  };
}
const ease80 = bezier(0.8, 0, 0.2, 1);

function createGrid(root) {
  const content = root.querySelector(".hg-content");
  let items = [], W = 0, H = 0, TW = 1, TH = 1, mobile = false, slots = 0;
  const s = { x: 0, y: 0 }, F = { x: 0, y: 0 }; // current and target grid offset
  const C = { x: 0.5, y: 0.5 }, w = { x: 0.5, y: 0.5 }; // mouse position target and eased (0..1 of the stage)
  let frozen = true, locked = false, visible = false, raf = 0, last = performance.now(), placed = false, hostTap = null, pitch = 1, itemW = 100, itemH = 134;
  let drag = null, dragged = false, holdTimer = 0;

  // ---- layout: exactly 197's staggered lattice ----
  function measure() {
    W = root.clientWidth; H = root.clientHeight;
    mobile = innerWidth < BREAKPOINT;
    const rem = parseFloat(getComputedStyle(document.body).fontSize) * 1.125; // our unit grows with the screen, like their rem
    const L = mobile ? LAYOUT.mobile : LAYOUT.desktop;
    const size = (mobile ? ITEM_REM.mobile : ITEM_REM.desktop) * rem;
    const g = { size, h: size * COVER_RATIO, title: L.title * rem, gapX: size * L.gapXk, top: L.top * rem, side: L.side * rem };
    g.colPitch = size + g.gapX;
    pitch = g.h + g.title + size * L.gapYk; // one step down a column
    g.shiftY = pitch / 2; // every other column sits half a step lower
    // the tile must be wider and taller than the screen (even zoomed out) so the wrap never shows. Columns are even so the up/down pattern lines up across the join
    let perRow = Math.max(4, Math.ceil((W / 0.8 + 4.5 * g.size) / g.colPitch));
    if (perRow % 2) perRow++;
    const rows = Math.max(3, Math.ceil((H / 0.8 + 4.5 * pitch) / pitch));
    g.perRow = perRow; g.rows = rows;
    g.tileW = perRow * g.colPitch;
    g.tileH = rows * pitch;
    return g;
  }

  function build() {
    const g = measure();
    const need = g.perRow * g.rows;
    if (need !== slots) {
      content.textContent = "";
      items = [];
      for (let i = 0; i < need; i++) {
        const n = (i % HOST_COUNT) + 1; // the slots cycle through the hosts so every slot is filled
        const el = document.createElement("button");
        el.type = "button";
        el.className = "hg-item";
        el.dataset.host = n - 1;
        el.setAttribute("aria-label", `Open magazine ${n}`);
        el.innerHTML = `<span class="hg-card"><span class="hg-cap"><span class="hg-line"><span>${pad(n)}.</span><span>Host name</span></span></span><span class="hg-media"><span class="hg-inner"><span class="hg-face"></span></span></span></span>`;
        content.appendChild(el);
        items.push({ el, line: el.querySelector(".hg-line"), cap: el.querySelector(".hg-cap"), card: el.querySelector(".hg-card"), inner: el.querySelector(".hg-inner"), face: el.querySelector(".hg-face"), x: 0, y: 0, w: 0, h: 0, ex: 0, ey: 0, tx: NaN, ty: NaN, ix: 0, iy: 0, sc: 1, cx: 0, cy: 0 });
      }
      slots = need;
      placed = false;
    }
    content.style.setProperty("--hg-w", g.size + "px");
    content.style.setProperty("--hg-title", g.title + "px");
    content.style.setProperty("--hg-gap", g.gapY + "px");
    // base positions of every item inside one tile
    items.forEach((it, i) => {
      const row = Math.floor(i / g.perRow), col = i % g.perRow;
      it.x = g.side + col * g.colPitch;
      it.y = g.top + row * pitch + (col % 2 === 0 ? 0 : g.shiftY);
      it.w = g.size; it.h = g.h + g.title;
    });
    TW = g.tileW; TH = g.tileH; itemW = g.size; itemH = g.h + g.title;
    if (!placed) {
      // centre the grid on the screen (as 197 does on first load), then bring each item to the tile copy nearest the middle
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      items.forEach((it) => { x0 = Math.min(x0, it.x); y0 = Math.min(y0, it.y); x1 = Math.max(x1, it.x + it.w); y1 = Math.max(y1, it.y + it.h); });
      const first = !s.x && !s.y && !F.x && !F.y;
      if (first) { s.x = F.x = W / 2 - (x0 + x1) / 2; s.y = F.y = H / 2 - (y0 + y1) / 2; }
      items.forEach((it) => { it.ex = -TW * Math.round((it.x + s.x + it.w / 2 - W / 2) / TW); it.ey = -TH * Math.round((it.y + s.y + it.h / 2 - H / 2) / TH); });
      placed = true;
    }
    paint(true);
  }

  // where the grid is zoomed to (it eases out to 0.8 while you drag, on computers)
  const zoom = () => gsap.getProperty(content, "scale") || 1;

  function paint(force) {
    const e = zoom();
    const um = (W / e - W) * 0.5 + 0.8 * 0; // extra margin when zoomed out
    for (const it of items) {
      const px = frozen ? 0 : -((w.x - 0.5) * it.w * 1.6), py = frozen ? 0 : -((w.y - 0.5) * it.h * 1.6);
      let a = it.x + s.x + it.ex + px, n = it.y + s.y + it.ey + py;
      if (!frozen) {
        const mx = um + it.w * 1.2, my = (H / e - H) * 0.5 + it.h * 1.2; // wrap just beyond the screen, out of sight
        if (a > W + mx) { it.ex -= TW; a -= TW; } else if (a + it.w < -mx) { it.ex += TW; a += TW; }
        if (n > H + my) { it.ey -= TH; n -= TH; } else if (n + it.h < -my) { it.ey += TH; n += TH; }
      }
      it.cx = a; it.cy = n; // where it sits on screen right now (the intro uses this)
      const X = a + it.ix, Y = n + it.iy;
      if (force || Math.abs(X - it.tx) > 0.01 || Math.abs(Y - it.ty) > 0.01 || it.sc !== it.tsc) {
        it.tx = X; it.ty = Y; it.tsc = it.sc;
        it.el.style.transform = `translate3d(${X}px, ${Y}px, 0) scale(${it.sc})`;
      }
    }
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (!visible || !W) return;
    const k = reduced() ? 1 : 1 - Math.pow(1 - SMOOTH, dt * 60);
    w.x += (C.x - w.x) * k; w.y += (C.y - w.y) * k;
    s.x += (F.x - s.x) * k; s.y += (F.y - s.y) * k;
    paint(false);
  }

  // ---- input ----
  const rect = () => root.getBoundingClientRect();
  const setMouse = (cx, cy) => { const r = rect(); C.x = (cx - r.left) / r.width; C.y = (cy - r.top) / r.height; };
  const zoomOut = () => { if (!mobile) gsap.to(content, { scale: 0.8, duration: 0.4, ease: "power2.out", overwrite: true }); };
  root.addEventListener("wheel", (e) => {
    if (locked || frozen) return;
    e.preventDefault();
    if (!e.shiftKey) return; // only Shift and scroll moves the grid; plain scrolling changes folder (see tabs.js)
    // With Shift held, browsers may turn an up/down scroll into a sideways one, so move by whatever arrives
    const dx = 0.8 * e.deltaX, dy = 0.8 * e.deltaY;
    F.x -= dx; F.y -= dy;
    if (drag) {
      // A held click is also a drag: move its starting point too, or the next tiny mouse move would snap the grid back
      drag.fx -= dx; drag.fy -= dy;
      if (!drag.moving) { clearTimeout(holdTimer); drag.moving = true; zoomOut(); }
      dragged = true; // so letting go of the click does not open the cover under the mouse
    }
  }, { passive: false });
  const touches = new Set();
  root.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") touches.add(e.pointerId);
    if (touches.size > 1) { // two or more fingers: never a grid drag (three fingers is the "change folder" gesture)
      clearTimeout(holdTimer);
      if (drag?.moving) gsap.to(content, { scale: 1, duration: 0.4, ease: "power2.inOut", overwrite: true });
      drag = null;
      return;
    }
    if (locked || frozen || (e.pointerType === "mouse" && e.button !== 0)) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, fx: F.x, fy: F.y, moving: false };
    dragged = false;
    setMouse(e.clientX, e.clientY);
    root.style.cursor = "grabbing";
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => { if (drag && !drag.moving) { drag.moving = true; zoomOut(); } }, 300);
  });
  addEventListener("pointermove", (e) => {
    if (locked || frozen || !visible) return;
    if (e.pointerType === "mouse") setMouse(e.clientX, e.clientY);
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moving) { if (Math.hypot(dx, dy) <= 8) return; clearTimeout(holdTimer); drag.moving = true; zoomOut(); }
    dragged = true;
    const r = mobile ? 2.6 : 1; // a finger moves the grid further than a mouse does
    F.x = drag.fx + dx * r; F.y = drag.fy + dy * r;
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    clearTimeout(holdTimer);
    const was = drag.moving;
    drag = null;
    root.style.cursor = "grab";
    if (was) gsap.to(content, { scale: 1, duration: 0.4, ease: "power2.inOut", overwrite: true });
  };
  const lift = (e) => { touches.delete(e.pointerId); release(e); };
  addEventListener("pointerup", lift);
  addEventListener("pointercancel", lift);
  // a drag must not count as a tap
  root.addEventListener("click", (e) => {
    if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; return; }
    const el = e.target.closest(".hg-item");
    if (el && !locked && !frozen) hostTap?.(el);
  }, true);

  // ---- helpers for the animations ----
  const onScreen = () =>
    items.map((it) => ({ it, ...(() => { const r = it.el.getBoundingClientRect(), rr = rect(); return { x: r.left - rr.left, y: r.top - rr.top, r: r.right - rr.left, b: r.bottom - rr.top, w: r.width, h: r.height }; })() }))
      .map((o) => ({ ...o, dist: Math.hypot(o.x + o.w / 2 - W / 2, o.y + o.h / 2 - H / 2), visible: o.r > -o.w && o.b > -o.h && o.x < W + o.w && o.y < H + o.h }))
      .filter((o) => o.visible)
      .sort((a, b) => a.dist - b.dist);

  // the opening: a diamond of 13 cards in the middle, which then bursts out into the whole grid
  function intro() {
    frozen = true; locked = true;
    gsap.set(content, { scale: 1 });
    const vis = onScreen();
    const lead = vis.slice(0, 13).sort((a, b) => a.y - b.y || a.x - b.x), leadSet = new Set(lead.map((o) => o.it));
    const rest = vis.filter((o) => !leadSet.has(o.it));
    const m = itemW, p = itemH, cx = W / 2, cy = H / 2;
    // the diamond keeps a clear gap between covers: steps a little wider and taller than a cover, shrunk to fit the screen
    const rx = 1.35 * m, ry = 0.95 * p, i = Math.min(1, (0.9 * W) / (4 * rx + m), (0.9 * H) / (4 * ry + p)), sc = 0.6 * i;
    const slotsD = [];
    [1, 3, 5, 3, 1].forEach((n, a) => { for (let k = 0; k < n; k++) { const x = cx + (k - (n - 1) / 2) * rx * i - m / 2, y = cy + (a - 2) * ry * i - p / 2; slotsD.push({ x, y, dist: Math.hypot(x + m / 2 - cx, y + p / 2 - cy) }); } });
    const sl = slotsD.sort((a, b) => a.dist - b.dist).slice(0, lead.length).sort((a, b) => a.y - b.y || a.x - b.x);
    // match cards to slots so the total travel is small (swap until no swap helps)
    const idx = sl.map((_, n) => n), d = (a, b) => Math.hypot(lead[a].x - sl[b].x, lead[a].y - sl[b].y);
    for (let changed = true; changed;) { changed = false; for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) if (d(a, idx[b]) + d(b, idx[a]) < d(a, idx[a]) + d(b, idx[b])) { [idx[a], idx[b]] = [idx[b], idx[a]]; changed = true; } }
    // only the covers on screen take part; the ones out of sight stay put (hiding them would leave holes when you scroll)
    items.forEach((it) => { it.card.style.visibility = "visible"; it.ix = it.iy = 0; it.sc = 1; });
    vis.forEach((o) => { o.it.card.style.visibility = "hidden"; });
    items.forEach((it) => gsap.set(it.cap, { opacity: 0, visibility: "hidden" }));
    lead.forEach((o, n) => { const u = sl[idx[n]]; o.it.ix = u.x - o.it.cx; o.it.iy = u.y - o.it.cy; o.it.sc = sc; });
    rest.forEach((o) => { // everything else waits off-screen, along the line from the middle through its own place
      const dx = o.x + m / 2 - cx, dy = o.y + p / 2 - cy, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const l = Math.min(ux > 0 ? (W - o.x) / ux : ux < 0 ? -(o.x + m) / ux : Infinity, uy > 0 ? (H - o.y) / uy : uy < 0 ? -(o.y + p) / uy : Infinity) + 0.5 * m;
      o.it.ix = o.x + ux * l - o.it.cx; o.it.iy = o.y + uy * l - o.it.cy;
      o.it.card.style.visibility = "visible";
    });
    paint(true);
    root.classList.add("is-ready");
    const tl = gsap.timeline({ onComplete: finish });
    function finish() { frozen = false; locked = false; items.forEach((it) => { it.ix = it.iy = 0; it.sc = 1; it.card.style.visibility = "visible"; gsap.set(it.cap, { clearProps: "opacity,visibility" }); }); root.style.cursor = "grab"; paint(true); }
    let A = 0.5;
    gsap.utils.shuffle([...lead]).forEach((o) => { A += rand(0.06, 0.14); tl.set(o.it.card, { visibility: "visible" }, A); });
    const b = A + 0.8;
    lead.forEach((o) => tl.to(o.it, { ix: 0, iy: 0, sc: 1, duration: 1.8, ease: "expo.inOut", onUpdate: () => paint(false) }, b + rand(0, 0.1)));
    tl.set(vis.map((o) => o.it.cap), { opacity: 1, visibility: "visible" }, b + 0.9);
    if (rest.length) {
      const e0 = b + 0.1, d0 = rest[0].dist, dr = (rest[rest.length - 1].dist - d0) || 1;
      rest.forEach((o) => tl.to(o.it, { ix: 0, iy: 0, duration: 1.8, ease: "expo.inOut", onUpdate: () => paint(false) }, e0 + ((o.dist - d0) / dr) * 0.4 + rand(0, 0.08)));
    }
    return tl;
  }

  // coming back to the grid: every cover wipes back in, nearest the middle first
  function reveal() {
    frozen = false; locked = true;
    gsap.killTweensOf(content);
    gsap.set(content, { scale: 1 });
    items.forEach((it) => { it.ix = it.iy = 0; it.sc = 1; it.card.style.visibility = "visible"; });
    paint(true);
    const vis = onScreen();
    root.classList.add("is-ready");
    const caps = vis.map((o) => o.it.cap), lines = vis.map((o) => o.it.line), inners = vis.map((o) => o.it.inner), faces = vis.map((o) => o.it.face);
    gsap.set(caps, { opacity: 1, visibility: "visible", transition: "none" });
    gsap.set(lines, { yPercent: -100 }); gsap.set(inners, { yPercent: 100 }); gsap.set(faces, { yPercent: -100, scale: 1.15 });
    const tl = gsap.timeline({ onComplete: () => { locked = false; gsap.set([...lines, ...inners, ...faces], { clearProps: "transform" }); } });
    vis.forEach((o, n) => {
      const at = (n / vis.length) * 0.25;
      tl.to(o.it.inner, { yPercent: 0, duration: 0.9, ease: "expo.out" }, at);
      tl.to(o.it.face, { yPercent: 0, scale: 1, duration: 0.9, ease: "expo.out" }, at);
      tl.to(o.it.line, { yPercent: 0, duration: 0.9, ease: "expo.out" }, at);
    });
    return tl;
  }

  // leaving for a magazine: every cover's picture wipes down and out, the nearest to the tapped one first, the tapped one last
  function leave(el) {
    locked = true;
    const rr = rect(), r0 = el.getBoundingClientRect(), cx = r0.left - rr.left + r0.width / 2, cy = r0.top - rr.top + r0.height / 2;
    const vis = onScreen().map((o) => ({ ...o, clicked: o.it.el === el, dist: Math.hypot(o.x + o.w / 2 - cx, o.y + o.h / 2 - cy) })).sort((a, b) => a.dist - b.dist);
    const max = vis[vis.length - 1]?.dist || 1;
    const tl = gsap.timeline();
    vis.forEach((o) => {
      const at = o.clicked ? 0.25 : (o.dist / max) * 0.15;
      tl.to(o.it.inner, { yPercent: 100, duration: 0.35, ease: ease80 }, at);
      tl.to(o.it.face, { yPercent: -100, scale: 1.15, duration: 0.35, ease: ease80 }, at);
      tl.to(o.it.line, { yPercent: -100, duration: 0.35, ease: ease80 }, at);
    });
    return tl;
  }

  build();
  root.style.cursor = "grab";
  raf = requestAnimationFrame(frame);
  const ro = new ResizeObserver(() => { if (root.clientWidth && (root.clientWidth !== W || root.clientHeight !== H)) build(); });
  ro.observe(root);

  return {
    intro, reveal, leave,
    set onTap(f) { hostTap = f; },
    set visible(v) { visible = v; },
    resize() { build(); },
    get ready() { return root.classList.contains("is-ready"); },
    unlock() { locked = false; },
    debug: () => ({ F, s, items, TW, TH, W, H, frozen, locked, zoom: zoom() }),
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); },
  };
}

export function setupHosts(panel) {
  const stage = panel.querySelector(".hosts-stage");
  const gridRoot = stage.querySelector(".hosts-grid");
  const bookWrap = stage.querySelector(".hosts-book-wrap");
  const bookCanvas = stage.querySelector(".hosts-book");
  const closeBtn = stage.querySelector(".hosts-close");
  let grid = null, mag = null, mode = "grid", busy = false, started = false;

  function init() {
    grid = createGrid(gridRoot);
    if (import.meta.env.DEV) window.__grid = grid; // handy for testing in the browser
    mag = createMagazine(bookCanvas, { inner: INNER_PAGES });
    mag.enabled = false;
    grid.onTap = openHost;
  }

  async function openHost(el) {
    if (busy || mode !== "grid") return;
    busy = true;
    await grid.leave(el);
    // the magazine is revealed with the same wipe the covers use: its window slides up while the picture inside slides down
    mag.reset(); mag.resize();
    gridRoot.style.display = "none";
    bookWrap.style.visibility = "visible";
    mode = "book";
    if (!reduced()) {
      gsap.set(bookWrap, { yPercent: 100 }); gsap.set(bookCanvas, { yPercent: -100, scale: 1.15 });
      await new Promise((res) => gsap.timeline({ onComplete: res }).to(bookWrap, { yPercent: 0, duration: 0.9, ease: "expo.out" }, 0).to(bookCanvas, { yPercent: 0, scale: 1, duration: 0.9, ease: "expo.out" }, 0));
      gsap.set([bookWrap, bookCanvas], { clearProps: "transform" });
    }
    stage.classList.add("is-open");
    mag.enabled = true;
    mag.go(1); // open it wide, ready to flip
    busy = false;
  }

  async function closeHost() {
    if (busy || mode !== "book") return;
    busy = true;
    mag.enabled = false;
    stage.classList.remove("is-open");
    mag.go(0, { ms: 450, stagger: 40 }); // flip the pages shut, quickly
    await new Promise((r) => setTimeout(r, reduced() ? 0 : 450 + mag.spreads * 40 + 100));
    bookWrap.style.visibility = "hidden";
    gridRoot.style.display = "";
    mode = "grid";
    await grid.reveal();
    busy = false;
  }

  closeBtn.addEventListener("click", closeHost);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) closeHost(); });

  return {
    show() {
      if (!grid) init();
      grid.resize(); mag.resize();
      grid.visible = mode === "grid";
      if (mode !== "grid") return;
      if (!started) { started = true; grid.intro(); } else grid.reveal();
    },
    hide() { if (grid) grid.visible = false; },
  };
}
