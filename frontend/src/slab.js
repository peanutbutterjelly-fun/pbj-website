import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Turns a see-through photo (bread, peanut butter, jelly) into a real 3D slab with thickness and
// rounded edges, so it can spin and still look solid.
//
// How: the photo is a view from above and in front, so its outline is the top face PLUS the strip of
// side wall we can see at the bottom. We cut that strip off to get the top face's outline, extrude it
// (wall height = the strip), and later paint the photo back on from the original viewpoint
// ("projection mapping", done in the shader in mascot.js). At rest it looks exactly like the photo.

export const PHOTO_W = 3; // world units the whole photo is wide (a bread slice is about 2 of them)
export const PHOTO_H = PHOTO_W / 1.5; // the photo is 3:2

// Follow the edge of a mask (1 = inside) around the main blob. Returns the points in order.
function traceOutline(mask, w, h) {
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  // Start in the middle (or the nearest filled pixel on the middle row) and walk left to the edge
  let sx = w >> 1;
  const sy = h >> 1;
  if (!at(sx, sy)) {
    let found = false;
    for (let r = 1; r < w / 2 && !found; r++) {
      if (at(sx + r, sy)) { sx += r; found = true; }
      else if (at(sx - r, sy)) { sx -= r; found = true; }
    }
    if (!found) return [];
  }
  while (at(sx - 1, sy)) sx--;

  // The eight neighbours, clockwise, starting from the west
  const dirs = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]];
  const indexOf = (dx, dy) => dirs.findIndex(([a, b]) => a === dx && b === dy);
  const pts = [];
  let x = sx;
  let y = sy;
  let back = 0; // direction (from the current pixel) of the background pixel we came past
  for (let guard = 0; guard < 400000; guard++) {
    pts.push([x, y]);
    let moved = false;
    for (let k = 1; k <= 8; k++) {
      const d = (back + k) % 8;
      const nx = x + dirs[d][0];
      const ny = y + dirs[d][1];
      if (at(nx, ny)) {
        const prev = (d + 7) % 8; // the background pixel examined just before this one
        const bx = x + dirs[prev][0] - nx;
        const by = y + dirs[prev][1] - ny;
        back = indexOf(bx, by);
        x = nx;
        y = ny;
        moved = true;
        break;
      }
    }
    if (!moved || (x === sx && y === sy && pts.length > 2)) break;
  }
  return pts;
}

// Ramer-Douglas-Peucker: drop points that barely change the line
function simplify(points, epsilon) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let worst = 0;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const dist = Math.abs((by - ay) * points[i][0] - (bx - ax) * points[i][1] + bx * ay - by * ax) / len;
      if (dist > worst) { worst = dist; at = i; }
    }
    if (worst > epsilon && at > 0) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

// The side walls: the photo only shows the wall along the front-facing edge, so we cut that strip out
// of the photo (following the edge) and later wrap it around the whole slab. That way the crust, the
// peanut butter ridges and the jelly gloss continue all the way round instead of being a flat colour.
function buildWallBand(img, outline, scale, wall, sideColor) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const full = document.createElement("canvas");
  full.width = iw;
  full.height = ih;
  const fctx = full.getContext("2d", { willReadFrequently: true });
  fctx.drawImage(img, 0, 0);
  const px = fctx.getImageData(0, 0, iw, ih).data;

  let cx = 0;
  let cy = 0;
  outline.forEach(([x, y]) => {
    cx += x;
    cy += y;
  });
  cx /= outline.length;
  cy /= outline.length;

  // Walk the outline and collect points (in photo pixels) along edges that face the camera
  const samples = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    let nx = ty / len;
    let ny = -tx / len;
    if ((a[0] - cx) * nx + (a[1] - cy) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    if (ny < 0.45) continue; // not facing the front
    const steps = Math.max(1, Math.round((len / scale) / 2));
    for (let k = 0; k < steps; k++) {
      const f = k / steps;
      samples.push([((a[0] + tx * f + 0.5) / scale), ((a[1] + ty * f + 0.5) / scale)]);
    }
  }

  // Keep only the middle of the strip: the part of the edge that faces the camera most squarely, which is the
  // cleanest and most even. The ends (where the edge turns away) are darker and streaky. The band is then
  // repeated, mirrored, all the way round the slab, so every side matches the best part of the sandwich.
  const from = Math.floor(samples.length * 0.3);
  const to = Math.ceil(samples.length * 0.7);
  const used = samples.length > 20 ? samples.slice(from, to) : samples;

  const bandH = Math.max(4, Math.round(wall));
  const bandW = Math.max(16, used.length);
  const band = document.createElement("canvas");
  band.width = bandW;
  band.height = bandH;
  const bctx = band.getContext("2d");
  const out = bctx.createImageData(bandW, bandH);
  const fill = new THREE.Color(sideColor).convertLinearToSRGB();
  let length = 0;
  for (let j = 0; j < bandW; j++) {
    const [sx, sy] = used[Math.min(used.length - 1, j)] || [0, 0];
    if (j > 0 && used[j]) length += Math.hypot(sx - used[j - 1][0], sy - used[j - 1][1]);
    for (let k = 0; k < bandH; k++) {
      const ix = Math.min(iw - 1, Math.max(0, Math.round(sx)));
      const iy = Math.min(ih - 1, Math.max(0, Math.round(sy) + 2 + k));
      const o = (iy * iw + ix) * 4;
      const d = (k * bandW + j) * 4;
      // See-through pixels (ragged edges) become the side colour, so there are never holes
      const solid = px[o + 3] > 140;
      out.data[d] = solid ? px[o] : fill.r * 255;
      out.data[d + 1] = solid ? px[o + 1] : fill.g * 255;
      out.data[d + 2] = solid ? px[o + 2] : fill.b * 255;
      out.data[d + 3] = 255;
    }
  }
  bctx.putImageData(out, 0, 0);
  return { canvas: band, length: Math.max(0.5, length * (PHOTO_W / iw)) };
}

// Round off the pixel stair-steps: cut every corner a quarter of the way in (twice)
function smoothClosed(points, rounds) {
  let pts = points;
  for (let r = 0; r < rounds; r++) {
    const next = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    pts = next;
  }
  return pts;
}

// thickness: how tall the visible side wall is in the photo, in photo pixels (of 1024)
export function buildSlab(img, { thickness, elevation, bevel = 0.03, sideColor = "#c98a43", soften = 0 }) {
  const scale = 0.4;
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const alpha = ctx.getImageData(0, 0, w, h).data;

  const wall = Math.max(1, Math.round(thickness * (h / img.naturalHeight)));
  const top = new Uint8Array(w * h);
  for (let y = 0; y < h - wall; y++) {
    for (let x = 0; x < w; x++) {
      // Part of the top face: opaque here, and still opaque one wall-height further down
      if (alpha[(y * w + x) * 4 + 3] > 128 && alpha[((y + wall) * w + x) * 4 + 3] > 128) top[y * w + x] = 1;
    }
  }

  // Optional: round off sharp corners and spikes by blurring the mask a little and cutting it again at
  // half strength (a corner loses its tip; a smooth edge stays where it is)
  if (soften > 0) {
    let cur = Float32Array.from(top);
    const tmp = new Float32Array(w * h);
    for (let pass = 0; pass < 2; pass++) {
      // horizontal then vertical box blur
      for (let y = 0; y < h; y++) {
        let sum = 0;
        for (let x = -soften; x <= soften; x++) sum += cur[y * w + Math.min(w - 1, Math.max(0, x))];
        for (let x = 0; x < w; x++) {
          tmp[y * w + x] = sum / (2 * soften + 1);
          sum += cur[y * w + Math.min(w - 1, x + soften + 1)] - cur[y * w + Math.max(0, x - soften)];
        }
      }
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let y = -soften; y <= soften; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
        for (let y = 0; y < h; y++) {
          cur[y * w + x] = sum / (2 * soften + 1);
          sum += tmp[Math.min(h - 1, y + soften + 1) * w + x] - tmp[Math.max(0, y - soften) * w + x];
        }
      }
    }
    for (let i = 0; i < top.length; i++) top[i] = cur[i] > 0.5 ? 1 : 0;
  }

  const outline = smoothClosed(simplify(traceOutline(top, w, h), 1.1), 2);
  const sinE = Math.sin(elevation);
  const cosE = Math.cos(elevation);
  const shape = new THREE.Shape();
  outline.forEach(([mx, my], i) => {
    const X = ((mx + 0.5) / w - 0.5) * PHOTO_W;
    // The photo squashes depth by sin(elevation), so stretch it back to get the real top face
    const Y = (-((my + 0.5) / h - 0.5) * PHOTO_H) / sinE;
    if (i === 0) shape.moveTo(X, Y);
    else shape.lineTo(X, Y);
  });

  // The wall's real height: what we see of it in the photo, divided by cos(elevation)
  const realHeight = ((wall / h) * PHOTO_H) / cosE;
  const depth = Math.max(0.001, realHeight - 2 * bevel);
  let geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    curveSegments: 1,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 6,
  });
  // Smooth the shading across neighbouring faces so the edges look soft and rounded, not faceted
  geometry.deleteAttribute("uv");
  geometry.deleteAttribute("normal");
  geometry = mergeVertices(geometry, 1e-4);
  geometry.computeVertexNormals();
  // Lay it flat (the photo's "up" becomes "far away") and put the top face at height 0
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -(depth + bevel), 0);

  // Give every vertex its distance along the edge (back and forth, so there is no jump where the loop
  // closes). The wall texture is laid out by this, so it flows smoothly even round a ragged edge.
  const ring = outline.map(([mx, my]) => [((mx + 0.5) / w - 0.5) * PHOTO_W, (((my + 0.5) / h - 0.5) * PHOTO_H) / sinE]);
  const along = new Float32Array(ring.length);
  let perimeter = 0;
  for (let i = 0; i < ring.length; i++) {
    along[i] = perimeter;
    const next = ring[(i + 1) % ring.length];
    perimeter += Math.hypot(next[0] - ring[i][0], next[1] - ring[i][1]);
  }
  const pos = geometry.attributes.position;
  const wallU = new Float32Array(pos.count);
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v);
    const z = pos.getZ(v);
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < ring.length; i++) {
      const dx = ring[i][0] - x;
      const dz = ring[i][1] - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    wallU[v] = Math.min(along[best], perimeter - along[best]);
  }
  geometry.setAttribute("wallU", new THREE.BufferAttribute(wallU, 1));

  const wallBand = buildWallBand(img, outline, scale, thickness, sideColor);
  return { geometry, thickness: depth + 2 * bevel, wallBand };
}
