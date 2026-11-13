// "Commercial cut": a white frame, a gold butter knife glides in carrying a thick, glossy dollop of peanut butter,
// and spreads it across the whole frame. Everything is drawn from a time value (no real-time clock), so any frame
// can be rendered on demand and the whole thing can be recorded to a video file.

import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from "mp4-muxer";
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmTarget } from "webm-muxer";

export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const DURATION = 13;

const T = { white: 0.8, enter: 2.3, hold: 3.1, move: 4.0, spread: 10.6, exit: 11.6 };

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const easeInOut = (x) => smooth(x);
const lerp = (a, b, t) => a + (b - a) * t;

function load(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

const makeCanvas = () => {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  return c;
};

// Cut the white background out of the knife photo (flood in from the edges)
function cutOut(img) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, w, h);
  const px = data.data;
  const bg = new Uint8Array(w * h);
  const near = (i) => px[i * 4] > 244 && px[i * 4 + 1] > 244 && px[i * 4 + 2] > 244;
  const st = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (bg[i] || !near(i)) return;
    bg[i] = 1;
    st.push(i);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (st.length) {
    const i = st.pop();
    const x = i % w;
    const y = (i / w) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  for (let i = 0; i < w * h; i++) px[i * 4 + 3] = bg[i] ? 0 : 255;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (bg[i]) continue;
      const n = bg[i - 1] + bg[i + 1] + bg[i - w] + bg[i + w];
      if (n) px[i * 4 + 3] = 255 - n * 60;
    }
  g.putImageData(data, 0, 0);
  // the tip is the left-most solid point; the handle end is the solid point farthest from the tip
  let tip = { x: w, y: 0 };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (!bg[y * w + x] && x < tip.x) tip = { x, y };
  let far = { x: 0, y: 0, d: 0 };
  for (let y = 0; y < h; y += 2)
    for (let x = 0; x < w; x += 2)
      if (!bg[y * w + x]) {
        const d = Math.hypot(x - tip.x, y - tip.y);
        if (d > far.d) far = { x, y, d };
      }
  const axis = Math.atan2(far.y - tip.y, far.x - tip.x); // direction from tip to handle
  return { canvas: c, tip, length: far.d, axis };
}

export async function createScene() {
  const [pbImg, knifeImg] = await Promise.all([load("/commercial/pb-glossy.jpg"), load("/commercial/knife-gold.jpg")]);
  const knife = cutOut(knifeImg);

  const gap = 40;
  const rect = { x: gap, y: gap, w: W - 2 * gap, h: H - 2 * gap, r: 30 };

  // ---- The peanut butter surface, scaled up to fill the frame, with a touch of fine texture ----
  const tex = makeCanvas();
  {
    const g = tex.getContext("2d");
    const s = Math.max(rect.w / pbImg.naturalWidth, rect.h / pbImg.naturalHeight);
    const iw = pbImg.naturalWidth * s;
    const ih = pbImg.naturalHeight * s;
    g.imageSmoothingQuality = "high";
    g.filter = "contrast(1.05) saturate(1.06)";
    g.drawImage(pbImg, rect.x + (rect.w - iw) / 2, rect.y + (rect.h - ih) / 2 - ih * 0.04, iw, ih);
    g.filter = "none";
    // fine peanut-butter specks and grain, to keep the enlarged photo crisp
    const noise = g.getImageData(0, 0, W, H);
    const d = noise.data;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < d.length; i += 4) {
      const n = (rnd() - 0.5) * 16;
      d[i] += n;
      d[i + 1] += n * 0.9;
      d[i + 2] += n * 0.7;
    }
    g.putImageData(noise, 0, 0);
  }
  const texPattern = tex.getContext("2d").createPattern(tex, "no-repeat");

  // ---- Where the surface is shiny: a map of its brightest highlights, so light can play across it ----
  const gloss = makeCanvas();
  {
    const g = gloss.getContext("2d");
    const src = tex.getContext("2d").getImageData(0, 0, W, H);
    const out = g.createImageData(W, H);
    for (let i = 0; i < src.data.length; i += 4) {
      const lum = 0.299 * src.data[i] + 0.587 * src.data[i + 1] + 0.114 * src.data[i + 2];
      const a = clamp01((lum - 205) / 50);
      out.data[i] = 255;
      out.data[i + 1] = 244;
      out.data[i + 2] = 222;
      out.data[i + 3] = a * 255;
    }
    g.putImageData(out, 0, 0);
  }

  const maskC = makeCanvas();
  const rimC = makeCanvas();
  const glintC = makeCanvas();
  const mctx = maskC.getContext("2d");
  const rctx = rimC.getContext("2d");
  const gctx = glintC.getContext("2d");
  const kTmp = document.createElement("canvas");
  kTmp.width = knife.canvas.width;
  kTmp.height = knife.canvas.height;
  const kctx = kTmp.getContext("2d");

  // ---- The knife's journey ----
  const klen = 1420; // knife length on screen
  const ks = klen / knife.length;
  const band = 280; // width of one swipe (the dollop spreads wider than the blade)
  const swipes = Math.ceil((rect.h - band) / (band * 0.7)) + 1;
  const span = rect.h - band;
  const ys = Array.from({ length: swipes }, (_, k) => rect.y + band / 2 + (span * k) / (swipes - 1));
  const xL = rect.x - 40;
  const xR = rect.x + rect.w + 40;

  // spread path (sampled): [x, y]
  const sp = [];
  const straight = (x0, x1, y) => {
    const n = Math.round(Math.abs(x1 - x0) / 5);
    for (let i = 0; i <= n; i++) sp.push([x0 + ((x1 - x0) * i) / n, y]);
  };
  const turn = (x, y0, y1, side) => {
    const n = 40;
    const rr = (y1 - y0) / 2;
    for (let i = 1; i < n; i++) {
      const a = (Math.PI * i) / n;
      sp.push([x + side * Math.sin(a) * rr * 0.9, y0 + (1 - Math.cos(a)) * rr]);
    }
  };
  ys.forEach((y, k) => {
    const right = k % 2 === 0;
    if (right) straight(xL, xR, y);
    else straight(xR, xL, y);
    if (k < ys.length - 1) turn(right ? xR : xL, y, ys[k + 1], right ? 1 : -1);
  });
  // after the last swipe the knife carries on out of the frame
  const lastRight = (swipes - 1) % 2 === 0;
  const exitDir = lastRight ? 1 : -1;
  const lastP = sp[sp.length - 1];
  const exitPts = [];
  for (let i = 1; i <= 90; i++) exitPts.push([lastP[0] + exitDir * i * 14, lastP[1] - i * 0.6]);

  // entrance: a curve from below-left to a hero spot in the middle of the frame, then back to the start of the first swipe
  const hero = [1400, 600];
  const startP = [xL, ys[0]];
  const P0 = [-700, H + 520];
  const C1 = [-150, H + 160];
  const C2 = [hero[0] - 760, hero[1] + 0];
  const bez = (t) => {
    const u = 1 - t;
    return [
      u * u * u * P0[0] + 3 * u * u * t * C1[0] + 3 * u * t * t * C2[0] + t * t * t * hero[0],
      u * u * u * P0[1] + 3 * u * u * t * C1[1] + 3 * u * t * t * C2[1] + t * t * t * hero[1],
    ];
  };

  // position + heading of the knife tip at time t
  function knifeState(t) {
    if (t < T.enter) {
      const u = easeInOut(clamp01((t - T.white) / (T.enter - T.white)));
      const p = bez(u);
      const q = bez(Math.min(1, u + 0.01));
      return { x: p[0], y: p[1], heading: Math.atan2(q[1] - p[1] + 1e-6, q[0] - p[0] + 1e-6), u: 0, idx: 0, on: t > T.white };
    }
    if (t < T.hold) {
      // the hero shot: the knife and its dollop hover, with a very slight float
      const k = (t - T.enter) / (T.hold - T.enter);
      return { x: hero[0] + Math.sin(k * 3) * 6, y: hero[1] + Math.sin(k * 4) * 8, heading: Math.sin(k * 2.2) * 0.02, u: 0, idx: 0, on: true };
    }
    if (t < T.move) {
      // glide back to where the first swipe starts
      const u = easeInOut((t - T.hold) / (T.move - T.hold));
      return { x: lerp(hero[0], startP[0], u), y: lerp(hero[1], startP[1], u), heading: 0, u: 0, idx: 0, on: true };
    }
    if (t < T.spread) {
      const raw = clamp01((t - T.move) / (T.spread - T.move));
      const u = lerp(raw, smooth(raw), 0.25); // a touch slower at the start and the finish
      const f = u * (sp.length - 1);
      const i = Math.floor(f);
      const a = sp[i];
      const b = sp[Math.min(sp.length - 1, i + 1)];
      const c = sp[Math.min(sp.length - 1, i + 8)];
      const fr = f - i;
      const x = lerp(a[0], b[0], fr);
      const y = lerp(a[1], b[1], fr);
      const hd = Math.atan2(c[1] - a[1] + 1e-6, c[0] - a[0] + 1e-6);
      return { x, y, heading: hd, u, idx: f, on: true };
    }
    const raw = clamp01((t - T.spread) / (T.exit - T.spread));
    const f = smooth(raw) * (exitPts.length - 1);
    const i = Math.floor(f);
    const a = exitPts[i];
    return { x: a[0], y: a[1], heading: exitDir > 0 ? 0 : Math.PI, u: 1, idx: sp.length - 1, on: raw < 1 };
  }

  const blobPath = (c, cx, cy, rx, ry, rot, seed, t, amp) => {
    c.beginPath();
    const n = 64;
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 1 + amp * (Math.sin(a * 3 + seed + t * 1.7) * 0.5 + Math.sin(a * 5 - seed * 1.3 + t * 2.3) * 0.3 + Math.sin(a * 2 + seed * 0.7) * 0.4);
      const px = Math.cos(a) * rx * r;
      const py = Math.sin(a) * ry * r;
      const x = cx + px * cr - py * sr;
      const y = cy + px * sr + py * cr;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.closePath();
  };

  // ---- One frame ----
  function render(ctx, t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    const ks_ = knifeState(t);
    if (!ks_.on && t < T.white + 0.01) return;

    // camera: a slow push in
    const cs = 1 + 0.05 * easeInOut(t / DURATION);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cs, cs);
    ctx.translate(-W / 2 - 6 * easeInOut(t / DURATION), -H / 2);

    // 1. What the knife has covered so far
    const head = t < T.move ? 0 : Math.min(sp.length - 1, Math.floor((ks_.idx ?? 0)));
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, W, H);
    if (t >= T.move) {
      mctx.fillStyle = "#000";
      mctx.beginPath();
      for (let i = 0; i <= head; i += 2) {
        const [x, y] = sp[i];
        const wob = Math.sin(i * 0.045) * 0.045 + Math.sin(i * 0.013 + 1.3) * 0.06;
        const r = (band / 2) * (1 + wob);
        const yy = y + Math.sin(i * 0.02 + 0.6) * band * 0.04;
        mctx.moveTo(x + r, yy);
        mctx.arc(x, yy, r, 0, Math.PI * 2);
      }
      mctx.fill();
      mctx.globalCompositeOperation = "destination-in";
      mctx.beginPath();
      const { x, y, w, h, r } = rect;
      mctx.roundRect(x, y, w, h, r);
      mctx.fill();
      mctx.globalCompositeOperation = "source-in";
      mctx.drawImage(tex, 0, 0);
      mctx.globalCompositeOperation = "source-over";

      // soft shadow under the spread (it has thickness), then the spread
      ctx.save();
      ctx.shadowColor = "rgba(80, 40, 8, 0.3)";
      ctx.shadowBlur = 36;
      ctx.shadowOffsetY = 14;
      ctx.drawImage(maskC, 0, 0);
      ctx.restore();
      ctx.drawImage(maskC, 0, 0);

      // a raised, glossy edge: light catches the top-left edges, shade falls on the bottom-right ones
      rctx.globalCompositeOperation = "source-over";
      rctx.clearRect(0, 0, W, H);
      rctx.drawImage(maskC, 0, 0);
      rctx.globalCompositeOperation = "destination-out";
      rctx.drawImage(maskC, 7, 11);
      rctx.globalCompositeOperation = "source-in";
      rctx.fillStyle = "rgba(255, 244, 218, 0.8)";
      rctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.filter = "blur(2.5px)";
      ctx.drawImage(rimC, 0, 0);
      ctx.restore();
      rctx.globalCompositeOperation = "source-over";
      rctx.clearRect(0, 0, W, H);
      rctx.drawImage(maskC, 0, 0);
      rctx.globalCompositeOperation = "destination-out";
      rctx.drawImage(maskC, -9, -13);
      rctx.globalCompositeOperation = "source-in";
      rctx.fillStyle = "rgba(70, 28, 0, 0.5)";
      rctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.filter = "blur(3px)";
      ctx.drawImage(rimC, 0, 0);
      ctx.restore();

      // light playing across the shiny parts: a steady wet shine plus a band of light that sweeps across
      gctx.globalCompositeOperation = "source-over";
      gctx.clearRect(0, 0, W, H);
      gctx.drawImage(gloss, 0, 0);
      gctx.globalCompositeOperation = "destination-in";
      gctx.drawImage(maskC, 0, 0);
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.drawImage(glintC, 0, 0);
      ctx.restore();
      const sweepT = (t - T.move) / 3.4;
      const pos = lerp(-0.3, 1.3, sweepT - Math.floor(sweepT)) * W;
      if (t > T.move + 1) {
        gctx.globalCompositeOperation = "destination-in";
        const gr = gctx.createLinearGradient(pos - 420, 0, pos + 420, 0);
        gr.addColorStop(0, "rgba(0,0,0,0)");
        gr.addColorStop(0.5, "rgba(0,0,0,1)");
        gr.addColorStop(1, "rgba(0,0,0,0)");
        gctx.fillStyle = gr;
        gctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 0.6;
        ctx.drawImage(glintC, 0, 0);
        ctx.restore();
      }

      // a gentle vignette on the peanut butter once it fills the frame
      const cover = clamp01((ks_.u ?? 0) * 1.3);
      gctx.globalCompositeOperation = "source-over";
      gctx.clearRect(0, 0, W, H);
      const vg = gctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
      vg.addColorStop(0, "rgba(60,25,0,0)");
      vg.addColorStop(1, `rgba(60,25,0,${0.22 * cover})`);
      gctx.fillStyle = vg;
      gctx.fillRect(0, 0, W, H);
      gctx.globalCompositeOperation = "destination-in";
      gctx.drawImage(maskC, 0, 0);
      ctx.drawImage(glintC, 0, 0);
    }

    // 2. Knife, dollop and strands
    if (ks_.on) {
      const hd = ks_.heading;
      const dir = [Math.cos(hd), Math.sin(hd)];
      const nrm = [-dir[1], dir[0]];
      const tipX = ks_.x;
      const tipY = ks_.y;
      const used = t < T.move ? 0 : clamp01(ks_.u * 1.0);
      const scale = t < T.exit ? 1 - 0.8 * used : 0.2;
      const rx = 165 * scale + 22;
      const ry = 112 * scale + 16;
      // the dollop sits on the blade a little behind the tip, so the tip pokes out in front of it
      const dx = tipX - dir[0] * (rx * 0.55);
      const dy = tipY - dir[1] * (rx * 0.55);

      // knife shadow on the page, then the knife itself with a moving glint
      const rot = hd + Math.PI - knife.axis;
      kctx.globalCompositeOperation = "source-over";
      kctx.clearRect(0, 0, kTmp.width, kTmp.height);
      kctx.drawImage(knife.canvas, 0, 0);
      kctx.globalCompositeOperation = "source-atop";
      const along = ((t * 0.35) % 1.6) - 0.3;
      const gx = lerp(knife.tip.x, knife.tip.x + Math.cos(knife.axis) * knife.length, along);
      const gy = lerp(knife.tip.y, knife.tip.y + Math.sin(knife.axis) * knife.length, along);
      const kg = kctx.createRadialGradient(gx, gy, 2, gx, gy, 120);
      kg.addColorStop(0, "rgba(255, 250, 225, 0.65)");
      kg.addColorStop(1, "rgba(255, 250, 225, 0)");
      kctx.fillStyle = kg;
      kctx.fillRect(0, 0, kTmp.width, kTmp.height);
      kctx.globalCompositeOperation = "source-over";

      ctx.save();
      ctx.translate(tipX, tipY);
      ctx.rotate(rot);
      ctx.scale(ks, ks);
      ctx.translate(-knife.tip.x, -knife.tip.y);
      ctx.shadowColor = "rgba(70, 35, 5, 0.38)";
      ctx.shadowBlur = 40;
      ctx.shadowOffsetX = 46;
      ctx.shadowOffsetY = 64;
      ctx.drawImage(kTmp, 0, 0);
      ctx.restore();

      // the dollop: a tall, glossy mound of peanut butter, a little taller at the front, lit from the top left
      const seed = 1.7;
      const patt = texPattern;
      ctx.save();
      // contact shadow on the blade and the page
      ctx.shadowColor = "rgba(60, 25, 0, 0.45)";
      ctx.shadowBlur = 34;
      ctx.shadowOffsetX = 22;
      ctx.shadowOffsetY = 34;
      blobPath(ctx, dx, dy, rx * 1.02, ry * 1.02, hd, seed, t, 0.06);
      ctx.fillStyle = "#b5732a";
      ctx.fill();
      ctx.restore();
      // the body of the dollop
      {
        ctx.save();
        blobPath(ctx, dx, dy, rx, ry, hd, seed, t, 0.055);
        patt.setTransform(new DOMMatrix().translate(dx - 360, dy - 260));
        ctx.fillStyle = patt;
        ctx.fill();
        const body = ctx.createRadialGradient(dx - rx * 0.3, dy - ry * 0.4, ry * 0.1, dx, dy, rx * 1.1);
        body.addColorStop(0, "rgba(255, 226, 168, 0.28)");
        body.addColorStop(0.55, "rgba(150, 80, 14, 0)");
        body.addColorStop(1, "rgba(80, 34, 2, 0.5)");
        ctx.fillStyle = body;
        ctx.fill();
        // a dark, soft edge where the dollop meets the surface it sits on
        ctx.clip();
        ctx.lineWidth = 26;
        ctx.strokeStyle = "rgba(70, 28, 0, 0.35)";
        ctx.filter = "blur(8px)";
        blobPath(ctx, dx, dy, rx, ry, hd, seed, t, 0.055);
        ctx.stroke();
        ctx.restore();
      }
      // the peak of the dollop: a smaller, softer lump on top, leaning forward
      {
        ctx.save();
        const px = dx + dir[0] * rx * 0.12 - 6;
        const py = dy + dir[1] * rx * 0.12 - ry * 0.24;
        ctx.filter = "blur(2.5px)";
        ctx.shadowColor = "rgba(60, 25, 0, 0.4)";
        ctx.shadowBlur = 22;
        ctx.shadowOffsetX = 10;
        ctx.shadowOffsetY = 18;
        blobPath(ctx, px, py, rx * 0.62, ry * 0.62, hd, seed + 1.4, t, 0.07);
        patt.setTransform(new DOMMatrix().translate(px - 420, py - 300));
        ctx.fillStyle = patt;
        ctx.fill();
        ctx.shadowColor = "transparent";
        const top = ctx.createLinearGradient(px - rx * 0.5, py - ry * 0.5, px + rx * 0.5, py + ry * 0.5);
        top.addColorStop(0, "rgba(255, 236, 190, 0.32)");
        top.addColorStop(0.6, "rgba(150, 80, 14, 0)");
        top.addColorStop(1, "rgba(80, 34, 2, 0.32)");
        ctx.fillStyle = top;
        ctx.fill();
        ctx.restore();
      }
      patt.setTransform(new DOMMatrix());
      // wet highlights: a soft glow plus a couple of thin bright streaks
      const tx = dx + dir[0] * rx * 0.12 - 6;
      const ty = dy + dir[1] * rx * 0.12 - ry * 0.24;
      ctx.save();
      blobPath(ctx, tx, ty, rx * 0.72, ry * 0.72, hd, seed + 2, t, 0.05);
      ctx.clip();
      const hl = ctx.createRadialGradient(tx - rx * 0.28, ty - ry * 0.3, 3, tx - rx * 0.15, ty - ry * 0.15, rx * 0.55);
      hl.addColorStop(0, "rgba(255, 250, 235, 0.9)");
      hl.addColorStop(0.15, "rgba(255, 236, 196, 0.45)");
      hl.addColorStop(1, "rgba(255, 220, 160, 0)");
      ctx.fillStyle = hl;
      ctx.fillRect(tx - rx, ty - ry, rx * 2, ry * 2);
      ctx.restore();
      ctx.save();
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(255, 252, 242, 0.85)";
      ctx.lineWidth = 5 * scale + 1.5;
      ctx.beginPath();
      ctx.ellipse(tx - rx * 0.04, ty - ry * 0.04, rx * 0.46, ry * 0.46, 0, Math.PI * 1.1, Math.PI * 1.42);
      ctx.stroke();
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(tx + rx * 0.06, ty + ry * 0.05, rx * 0.3, ry * 0.3, 0, Math.PI * 1.18, Math.PI * 1.45);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  return { render, duration: DURATION };
}

// ---- Recording the scene to a video file ----
export async function recordVideo(scene, onProgress) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const total = Math.round(scene.duration * FPS);

  let codec = "avc";
  let cfg = { codec: "avc1.640028", width: W, height: H, bitrate: 14_000_000, framerate: FPS };
  let support = await VideoEncoder.isConfigSupported(cfg).catch(() => ({ supported: false }));
  if (!support.supported) {
    codec = "vp9";
    cfg = { codec: "vp09.00.40.08", width: W, height: H, bitrate: 14_000_000, framerate: FPS };
    support = await VideoEncoder.isConfigSupported(cfg);
  }
  const target = codec === "avc" ? new Mp4Target() : new WebmTarget();
  const muxer =
    codec === "avc"
      ? new Mp4Muxer({ target, video: { codec: "avc", width: W, height: H }, fastStart: "in-memory" })
      : new WebmMuxer({ target, video: { codec: "V_VP9", width: W, height: H, frameRate: FPS } });
  const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => console.error(e) });
  encoder.configure(cfg);

  for (let i = 0; i < total; i++) {
    scene.render(ctx, i / FPS);
    const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
    encoder.encode(frame, { keyFrame: i % 60 === 0 });
    frame.close();
    if (i % 10 === 0) {
      await encoder.flush();
      onProgress?.(i / total);
    }
  }
  await encoder.flush();
  muxer.finalize();
  return { buffer: target.buffer, ext: codec === "avc" ? "mp4" : "webm" };
}
