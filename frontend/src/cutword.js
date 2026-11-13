import { gsap } from "gsap";
import data from "./glyphs.json";

// Paper-cut lettering, drawn as vector shapes (not page text):
//  - the outline of every letter is a little rough, like hand-cut paper
//  - every letter has a hard, flat shadow whose direction and length swing a little
//  - the letters "boil" like stop-motion: each wobbles a little, redrawn 12 times a second
// The letter outlines come from our headline font (see scripts/make-glyphs.py), so no font and no SVG filter is
// involved while it moves (fast, and the same in every browser). Sizes are in font units (1000 = one em).

const FPS = 12;
const NS = "http://www.w3.org/2000/svg";
const STEP = 24; // outlines are cut into pieces about this long (so the roughness has something to bend)
const AMP = 8; // how far the rough edge strays from the true outline
const TRACK = -8; // a hair tighter than the font's own spacing, like our headlines
// How strong the wobble is, for every paper-cut word and letter on the site (1 = the full wobble, 0 = still).
// One number, so the loading text, the hero title and the layer titles all shake the same amount.
const CALM = 0.3;
const calmFor = () => CALM;
const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

// ---- Letters ready to wobble: dense outline points, with a direction "out of the edge" for each ----
const prepGlyphs = (STEP) => {
const glyphs = {};
Object.entries(data.glyphs).forEach(([ch, g]) => {
  glyphs[ch] = {
    adv: g.adv,
    contours: g.c.map((flat) => {
      const xs = [];
      const ys = [];
      const n = flat.length / 2;
      for (let i = 0; i < n; i++) {
        const px = flat[2 * i];
        const py = flat[2 * i + 1];
        const qx = flat[2 * ((i + 1) % n)];
        const qy = flat[2 * ((i + 1) % n) + 1];
        const pieces = Math.max(
          1,
          Math.ceil(Math.hypot(qx - px, qy - py) / STEP),
        );
        for (let k = 0; k < pieces; k++) {
          xs.push(px + ((qx - px) * k) / pieces);
          ys.push(py + ((qy - py) * k) / pieces);
        }
      }
      const m = xs.length;
      const nx = new Float32Array(m);
      const ny = new Float32Array(m);
      for (let i = 0; i < m; i++) {
        const dx = xs[(i + 1) % m] - xs[(i + m - 1) % m];
        const dy = ys[(i + 1) % m] - ys[(i + m - 1) % m];
        const len = Math.hypot(dx, dy) || 1;
        nx[i] = -dy / len;
        ny[i] = dx / len;
      }
      return { xs, ys, nx, ny, m };
    }),
  };
});
return glyphs;
};
const glyphs = prepGlyphs(STEP);
// Small lettering does not need an outline cut into pieces as short as the headlines': a coarser one (made the first time it is asked for)
// has several times fewer points, so it is several times cheaper to redraw twelve times a second, and looks the same at that size
let coarseGlyphs = null;
const glyphFor = (ch, coarse) => (coarse ? (coarseGlyphs ??= prepGlyphs(110)) : glyphs)[ch];

// A steady "random" number for (a, b): the same input always gives the same wobble
const rnd = (a, b) => {
  let h = (Math.imul(a + 1, 374761393) + Math.imul(b + 7, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
// Smooth wobble along an edge: random values at every 7th point, blended between
const smooth = (u, f, seed) => {
  const i = Math.floor(u);
  const t = u - i;
  const s = t * t * (3 - 2 * t);
  return (
    (rnd(f * 31 + seed, i) * (1 - s) + rnd(f * 31 + seed, i + 1) * s) * 2 - 1
  );
};

function roughPath(letter, f, seed, amp = AMP, jag = 0.25) { // jag: how much of the edge is small nicks (1) rather than slow waves (0)
  let d = "";
  letter.contours.forEach((c, ci) => {
    for (let i = 0; i < c.m; i++) {
      const lo = smooth(i / 7 + ci * 3.7, f, seed);
      const hi = rnd(f * 97 + seed + ci, i) * 2 - 1;
      const a = (lo * (1 - jag) + hi * jag) * amp;
      const x = Math.round(c.xs[i] + c.nx[i] * a);
      const y = Math.round(c.ys[i] + c.ny[i] * a);
      d += i === 0 ? `M${x} ${y}L` : `${x} ${y} `;
    }
    d += "Z";
  });
  return d;
}

// The hard shadow swings only a little, down and to either side, and stays close to the letters (font units)
const shadowAt = (f) => {
  const a = Math.PI / 2 + 0.35 * Math.sin(f * 0.21);
  const len = 40 + 10 * Math.sin(f * 0.37 + 1);
  return [Math.cos(a) * len, Math.sin(a) * len];
};

// ---- The shared 12-frames-a-second clock ----
const words = new Set();
let lastFrame = -1;
let version = 0; // goes up every time the letters take a new wobble (a picture of them knows when to repaint)
function tick() {
  const f = Math.floor(gsap.ticker.time * FPS);
  if (f === lastFrame) return;
  lastFrame = f;
  version++;
  words.forEach((w) => w.step(f));
}
export const cutVersion = () => version;
// The number of the current 12-a-second step: anything else that wobbles (like the gap around the layers) uses this
// and the same noise function, so it moves in the same rhythm as the lettering
export const cutFrame = () => (reduceMotion ? 0 : Math.floor(gsap.ticker.time * FPS));
export const cutRandom = rnd;

// ---- One word ----
// createCutWord("PEANUT", { fill: "var(--pop)", shadow: "var(--brown)" }) -> { el, widthEm, place(x, y, px), paint(ctx), dispose() }
// el is an SVG <g> to put inside an <svg>. place() sets where its capitals' top-left corner sits and how big it is.
export const CAP_EM = data.cap / 1000;
// calm: leave it out to use the site-wide wobble strength (CALM above); or give a fixed number, 1 = the full wobble
export function createCutWord(text, { fill, shadow, calm }) {
  const g = document.createElementNS(NS, "g");
  const letters = [];
  let pen = 0;
  [...text].forEach((ch, i) => {
    if (ch === " ") {
      pen += data.space + TRACK;
      return;
    }
    const glyph = glyphs[ch];
    const el = document.createElementNS(NS, "g");
    const back = document.createElementNS(NS, "path");
    const face = document.createElementNS(NS, "path");
    back.style.fill = shadow;
    face.style.fill = fill;
    el.append(back, face);
    g.append(el);
    letters.push({
      glyph,
      el,
      back,
      face,
      x: pen,
      seed: i * 17 + 3,
      d: "",
      rot: 0,
      dx: 0,
      dy: 0,
    });
    const next = text[i + 1];
    pen += glyph.adv + TRACK + ((next && data.kern[ch + next]) || 0);
  });
  const width = pen - TRACK;
  const state = { sx: 0, sy: 0, x: 0, y: 0, px: 100 };

  const self = {
    el: g,
    widthEm: width / 1000,
    step(f) {
      [state.sx, state.sy] = shadowAt(f);
      const c = calm ?? calmFor();
      letters.forEach((l, i) => {
        l.rot = (rnd(f, i) - 0.5) * 5 * c; // degrees
        l.dx = (rnd(f, i + 101) - 0.5) * 30 * c;
        l.dy = (rnd(f, i + 202) - 0.5) * 30 * c;
        l.d = roughPath(l.glyph, f, l.seed, AMP * (0.6 + 0.4 * c));
        l.back.setAttribute("d", l.d);
        l.face.setAttribute("d", l.d);
        l.back.setAttribute(
          "transform",
          `translate(${state.sx.toFixed(1)} ${state.sy.toFixed(1)})`,
        );
        l.el.setAttribute(
          "transform",
          `translate(${(l.x + l.dx).toFixed(1)} ${l.dy.toFixed(1)}) rotate(${l.rot.toFixed(2)} ${l.glyph.adv / 2} ${-data.cap / 2})`,
        );
      });
    },
    // x, y: the top-left corner of the capitals, in pixels; px: the font size in pixels
    place(x, y, px) {
      state.x = x;
      state.y = y;
      state.px = px;
      g.setAttribute(
        "transform",
        `translate(${x.toFixed(2)} ${(y + CAP_EM * px).toFixed(2)}) scale(${(px / 1000).toFixed(5)})`,
      );
    },
    // Draws the word as it is now into a 2D canvas (the loading swirl needs a picture of it)
    paint(ctx) {
      const k = state.px / 1000;
      const face = getComputedStyle(letters[0].face).fill;
      const back = getComputedStyle(letters[0].back).fill;
      letters.forEach((l) => {
        ctx.save();
        ctx.translate(
          state.x + (l.x + l.dx) * k,
          state.y + CAP_EM * state.px + l.dy * k,
        );
        ctx.translate((l.glyph.adv / 2) * k, (-data.cap / 2) * k); // turn about the letter's middle, like the page version
        ctx.rotate((l.rot * Math.PI) / 180);
        ctx.translate((-l.glyph.adv / 2) * k, (data.cap / 2) * k);
        ctx.scale(k, k);
        const p = new Path2D(l.d);
        ctx.fillStyle = back;
        ctx.save();
        ctx.translate(state.sx, state.sy);
        ctx.fill(p);
        ctx.restore();
        ctx.fillStyle = face;
        ctx.fill(p);
        ctx.restore();
      });
    },
    dispose() {
      words.delete(self);
      if (!words.size) gsap.ticker.remove(tick);
    },
  };
  words.add(self);
  self.step(Math.max(0, lastFrame));
  if (!reduceMotion && words.size === 1) gsap.ticker.add(tick);
  return self;
}

// ---- One single letter, as its own little inline SVG (for headlines that are typed in letter by letter) ----
// createCutLetter("B", { fill: "var(--pop)", shadow: "var(--brown)" }) -> { el, dispose() }, or null if we have no outline for it.
// el is an <svg> exactly one letter wide (its width is the letter's advance, so text around it flows as usual) and
// one capital tall, sitting on the text's baseline; the wobble and shadow spill over its edges.
let letterSeed = 0;
// one watcher for every letter: letters that are off screen (or in a hidden tab) stop redrawing, so scrolling a busy page stays light
const seeing = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((list) => { list.forEach((e) => { e.target._off = !e.isIntersecting; }); }, { rootMargin: "120px" });
export function createCutLetter(ch, { fill, shadow, calm, skip, rough = 1, shadowK = 1, jag = 0.25, coarse = false, seed: fixedSeed }) { // seed: reuse another letter's wobble (so a shadow layer and a face layer match); skip: () => true while the letter is out of sight (it then stops redrawing); rough / shadowK / jag: a stronger, nickier edge and a longer shadow for small lettering (1, 1, 0.25 = as for headlines)
  const c = calm ?? calmFor(); // calm: 0 keeps the letters level (no jitter), for headings that must line up with their neighbours
  const glyph = glyphFor(ch.toUpperCase(), coarse);
  if (!glyph) return null;
  const seed = fixedSeed ?? (letterSeed += 7);
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("viewBox", `0 ${-data.cap} ${glyph.adv} ${data.cap}`);
  svg.style.cssText = `display:inline-block;overflow:visible;vertical-align:baseline;width:${glyph.adv / 1000}em;height:${data.cap / 1000}em`;
  const el = document.createElementNS(NS, "g");
  const back = document.createElementNS(NS, "path");
  const face = document.createElementNS(NS, "path");
  back.style.fill = shadow;
  face.style.fill = fill;
  el.append(back, face);
  svg.append(el);
  const self = {
    el: svg,
    step(f) {
      if ((!skip && svg._off) || skip?.()) return; // (letters that say for themselves when they are out of sight do not rely on the page-wide watcher)
      const [sx, sy] = shadowAt(f);
      const d = roughPath(glyph, f, seed, AMP * (0.6 + 0.4 * c) * rough, jag);
      back.setAttribute("d", d);
      face.setAttribute("d", d);
      back.setAttribute("transform", `translate(${(sx * shadowK).toFixed(1)} ${(sy * shadowK).toFixed(1)})`);
      const rot = (rnd(f, seed) - 0.5) * 5 * c;
      const dx = (rnd(f, seed + 101) - 0.5) * 30 * c;
      const dy = (rnd(f, seed + 202) - 0.5) * 30 * c;
      el.setAttribute("transform", `translate(${dx.toFixed(1)} ${dy.toFixed(1)}) rotate(${rot.toFixed(2)} ${glyph.adv / 2} ${-data.cap / 2})`);
    },
    dispose() {
      seeing?.unobserve(svg);
      words.delete(self);
      if (!words.size) gsap.ticker.remove(tick);
    },
  };
  words.add(self);
  self.step(Math.max(0, lastFrame));
  seeing?.observe(svg);
  if (!reduceMotion && words.size === 1) gsap.ticker.add(tick);
  return self;
}
