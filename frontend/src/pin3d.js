// Real 3D map pins for the Ask FUN map: one small WebGL canvas drawn over the map shows every pin as a glossy, bevelled red
// teardrop with a round hole (a number disc sits inside it). Each pin floats, spins slowly around its own axis and has a soft shadow.
// Loaded only when the first pins are needed, so the rest of the app stays light.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const PIN_PX = 62; // how tall a pin is on screen, in CSS pixels

// The teardrop outline: a round head with a point below it, and a round hole through the head
function pinGeometry() {
  const r = 1, d = 2.15, hole = 0.8;
  const ty = -(r * r) / d, tx = r * Math.sqrt(1 - (r * r) / (d * d)), a = Math.atan2(ty, tx);
  const shape = new THREE.Shape();
  shape.moveTo(0, -d);
  shape.lineTo(tx, ty);
  shape.absarc(0, 0, r, a, Math.PI - a, false);
  shape.lineTo(0, -d);
  const h = new THREE.Path();
  h.absarc(0, 0, hole, 0, Math.PI * 2, true);
  shape.holes.push(h);
  const depth = 0.55;
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.34, bevelSize: 0.24, bevelSegments: 10, curveSegments: 64 });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}

const numberTexture = (n) => {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d");
  x.fillStyle = "#F8F8F0"; x.beginPath(); x.arc(64, 64, 62, 0, Math.PI * 2); x.fill();
  x.fillStyle = "#463721"; x.font = '700 76px "Chivo Mono", ui-monospace, monospace'; x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(String(n), 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
};

/**
 * host: the map element. getView(): { x0, y0, vw, vh } the map's visible box in map units (what the svg viewBox shows).
 * onPick(n) / onHover(n): called when a pin is tapped / hovered (n = 0 when none).
 */
export function makePinLayer(host, getView, { onPick = () => {}, onHover = () => {} } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.createElement("canvas");
  canvas.className = "fs-3d";
  canvas.setAttribute("aria-hidden", "true");
  host.append(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  scene.environmentRotation.y = 1.1; // keep the room's bright panel off the pin's front face so it stays red
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(-3, 5, 6); scene.add(key);

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 4000);
  cam.position.z = 1000;

  const geo = pinGeometry();
  const box = geo.boundingBox, H = box.max.y - box.min.y, S = PIN_PX / H;
  const body = new THREE.MeshPhysicalMaterial({ color: 0xb5102c, roughness: 0.4, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.28, envMapIntensity: 0.4 });
  const shadowGeo = new THREE.CircleGeometry(1, 28);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x463721, transparent: true, opacity: 0.26, depthWrite: false });
  const discGeo = new THREE.CircleGeometry(0.6, 40);
  const textures = new Map();
  const texFor = (n) => { if (!textures.has(n)) textures.set(n, numberTexture(n)); return textures.get(n); };

  let items = [], size = { w: 0, h: 0 }, raf = 0, hiN = 0, born = performance.now();

  const make = (n, x, y, i) => {
    const group = new THREE.Group(), tilt = new THREE.Group(), spin = new THREE.Group();
    const mesh = new THREE.Mesh(geo, body);
    mesh.position.y = -box.min.y; // the point of the pin sits at the group's origin
    const front = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ map: texFor(n), transparent: true }));
    front.position.set(0, -box.min.y, 0.02);
    const back = front.clone(); back.rotation.y = Math.PI; back.position.z = -0.02;
    spin.add(mesh, front, back);
    spin.position.y = 0;
    tilt.add(spin); tilt.rotation.x = -0.22;
    group.add(tilt);
    group.scale.setScalar(S);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    scene.add(shadow, group);
    return { n, x, y, i, group, spin, shadow, born: performance.now() + i * 60 };
  };

  const clear = () => { items.forEach((it) => { scene.remove(it.group, it.shadow); }); items = []; };

  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h || (w === size.w && h === size.h)) return;
    size = { w, h };
    renderer.setSize(w, h, false);
    cam.left = -w / 2; cam.right = w / 2; cam.top = h / 2; cam.bottom = -h / 2; cam.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(host);

  const frame = (now) => {
    if (!canvas.isConnected) { dispose(); return; }
    resize();
    const v = getView(), t = now / 1000;
    // Where each pin belongs on screen, then nudge neighbours apart so no two pins ever overlap (worked out fresh every frame, so it never jitters)
    const P = items.map((it) => ({ x: ((it.x - v.x0) / v.vw) * size.w, y: ((it.y - v.y0) / v.vh) * size.h }));
    const BW = PIN_PX * 0.95, BH = PIN_PX * 1.12;
    for (let pass = 0; pass < 14; pass++) {
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
        let dx = P[j].x - P[i].x, dy = P[j].y - P[i].y;
        if (Math.abs(dx) >= BW || Math.abs(dy) >= BH) continue;
        if (!dx && !dy) { dx = (j - i) * 0.01; }
        const ox = BW - Math.abs(dx), oy = BH - Math.abs(dy);
        if (ox <= oy) { const m = (ox / 2 + 0.5) * Math.sign(dx || 1); P[i].x -= m; P[j].x += m; }
        else { const m = (oy / 2 + 0.5) * Math.sign(dy || 1); P[i].y -= m; P[j].y += m; }
      }
    }
    items.forEach((it, idx) => {
      const sx = P[idx].x, sy = P[idx].y;
      const k = Math.min(1, Math.max(0, (now - it.born) / 380)), pop = 1 - Math.pow(1 - k, 3);   // drops in
      const lift = reduced ? 7 : 9 + Math.sin(t * 1.4) * 2.6;                         // hovers
      const hi = it.n === hiN ? 1.18 : 1;
      it.group.scale.setScalar(S * pop * hi);
      it.group.position.set(sx - size.w / 2, size.h / 2 - sy + lift * pop, 0);
      it.spin.rotation.y = reduced ? -0.5 : t * 0.55;                                 // turns on its own axis
      it.shadow.position.set(sx - size.w / 2, size.h / 2 - sy, -50);
      it.shadow.scale.set(PIN_PX * 0.2 * pop * (1 - (lift - 6) * 0.025), PIN_PX * 0.065 * pop, 1);
      it.shadow.rotation.set(0, 0, 0);
    });
    renderer.render(scene, cam);
    raf = items.length || !reduced ? requestAnimationFrame(frame) : 0;
  };
  const start = () => { if (!raf) raf = requestAnimationFrame(frame); };

  // tapping / hovering a pin: look for the pin under the pointer
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  const hit = (ev) => {
    const r = canvas.getBoundingClientRect();
    ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, cam);
    const objs = items.map((it) => it.spin.children[0]);
    const h = ray.intersectObjects(objs, false)[0];
    return h ? items.find((it) => it.spin.children[0] === h.object)?.n || 0 : 0;
  };
  let lastHover = 0;
  const move = (ev) => {
    if (ev.target.closest?.(".fs-x")) return;
    const n = hit(ev); host.style.cursor = n ? "pointer" : "";
    if (n !== lastHover) { lastHover = n; onHover(n); }
  };
  const click = (ev) => { if (ev.target.closest?.(".fs-x")) return; const n = hit(ev); if (n) onPick(n); };
  host.addEventListener("pointermove", move);
  host.addEventListener("pointerleave", () => { if (lastHover) { lastHover = 0; onHover(0); } host.style.cursor = ""; });
  host.addEventListener("click", click);

  function dispose() {
    cancelAnimationFrame(raf); raf = 0; ro.disconnect(); clear();
    textures.forEach((t) => t.dispose()); geo.dispose(); body.dispose(); shadowGeo.dispose(); shadowMat.dispose(); discGeo.dispose();
    pmrem.dispose(); renderer.dispose();
  }

  return {
    set(list) { clear(); items = list.map((p, i) => make(p.n, p.x, p.y, i)); start(); },
    clear,
    hi(n) { hiN = n; },
    dispose,
  };
}
