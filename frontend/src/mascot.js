import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createCutLetter, cutFrame, cutRandom } from "./cutword.js";
import { buildSlab, PHOTO_W, PHOTO_H } from "./slab.js";

// The PB&J mascot: a real 3D sandwich wrapped in your four photos (bread, jelly, peanut butter, bread).
//
// Each photo becomes a solid slab (see slab.js). The photo is painted on from the viewpoint it was
// taken from, so at rest the sandwich looks exactly like the photos, and when it spins the slabs keep
// their thickness, rounded edges and lighting, so it stays 3D from every side.
//
// The scroll timeline, heights, tilts, camera follow, zoom and the 360-degree spin are the same
// numbers as the earlier code-built 3D mascot (see git history).

const ELEVATION = (50 * Math.PI) / 180; // how high above the sandwich we look from (matches the photos)

// Heights of each slab's top face (bread width = 2 units), up is positive
const APART = [-0.8, 0.3, 1.4, 2.5]; // evenly spaced
// Tilts while floating apart (x, y, z radians). Zero: every layer stays level with the others
const TILTS = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
];

// bread, jelly, peanut butter, bread: the photo, how tall its visible wall is (photo pixels), its
// fallback side colour, a size fix (the jelly photo is bigger than the others), and a tiny size
// difference so no two layers' walls sit exactly on top of each other (that makes them flicker)
const LAYERS = [
  { src: "/mascot/bread.webp", wall: 70, side: "#c98a43", size: 1, bevel: 0.035, shine: [0.07, 22, 1.2] },
  { src: "/mascot/jelly.webp", wall: 26, side: "#8c0f1c", size: 0.91, bevel: 0.012, shine: [0.4, 80, 3] },
  { src: "/mascot/peanut-butter.webp", wall: 34, side: "#b87f3a", size: 1.012, bevel: 0.016, soften: 5, shine: [0.18, 40, 2] },
  { src: "/mascot/bread.webp", wall: 70, side: "#c98a43", size: 1, bevel: 0.035, shine: [0.07, 22, 1.2] },
];
// The colour wash behind a layer when it comes out front: bold, from the brand colours, chosen so each
// layer pops (bread on brown, peanut butter on grape, jelly on honey)
const BREAD_WASH = "radial-gradient(ellipse at 50% 45%, #5e3a1e 0%, #432611 50%, #2a160a 100%)"; // dark brown, so the cream bread and golden crust stand out
const WASH = [
  BREAD_WASH,
  "radial-gradient(ellipse at 50% 45%, #f0b95e 0%, #e2a64f 45%, #c68b3e 100%)",
  "radial-gradient(ellipse at 50% 45%, #8a3d77 0%, #6b2d5c 45%, #3b1f2b 100%)",
  BREAD_WASH,
];
const GAP = 0.004; // tiny space between layers so touching surfaces never fight over the same pixels

// Paints the photo onto the slab by projecting it from the original viewpoint, trims the slab to the
// photo's outline, and adds light that matches the photo at rest but changes as the slab turns.
const vertexShader = /* glsl */ `
  uniform vec3 photoRight;
  uniform vec3 photoUp;
  uniform vec2 photoSize;
  uniform float uKey;   // 0..1: how much of the perspective fix is applied (only when a layer is out front)
  uniform vec3 uKeyBox; // the layer's middle x, front-most z and depth
  uniform float uKeyQ;  // how much wider the near edge is than the far edge in the photo
  uniform vec2 uShear;  // half the layer's width, and how far (in world units) the crown corners are levelled
  attribute float wallU;
  varying float vWallU;
  varying vec2 vUv;
  varying vec3 vPos;
  varying vec3 vNormalObj;
  varying vec3 vNormalWorld;
  varying vec3 vNormalView;
  varying vec3 vPhotoRightV;
  varying vec3 vPhotoUpV;
  varying vec3 vFaceN;
  void main() {
    vec2 screen = vec2(dot(position, photoRight), dot(position, photoUp));
    vUv = screen / photoSize + 0.5;
    vPos = position;
    vWallU = wallU;
    vNormalObj = normal;
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    vNormalView = normalize(normalMatrix * normal);
    vPhotoRightV = normalize(normalMatrix * photoRight);
    vPhotoUpV = normalize(normalMatrix * photoUp);
    vFaceN = normalize(normalMatrix * vec3(0.0, 1.0, 0.0)); // which way the layer's flat top is facing
    // The photo was taken in perspective, so the near edge of a slice looks wider than the far edge. When
    // the slice faces us, squeeze the near end and stretch the far end so its sides run straight.
    vec3 shown = position;
    float v = clamp((position.z - uKeyBox.y + uKeyBox.z) / uKeyBox.z, 0.0, 1.0); // 0 = far edge, 1 = near edge
    shown.x = uKeyBox.x + (position.x - uKeyBox.x) * mix(1.0, 1.0 / (1.0 + uKeyQ * (v - 0.5)), uKey);
    // The crown (the rounded top of a slice) was photographed a little lopsided: its right shoulder sits
    // higher than the left. Level it by moving the right side down and the left side up, only up in the crown.
    shown.z += uShear.y * clamp((position.x - uKeyBox.x) / uShear.x, -1.0, 1.0) * smoothstep(0.42, 0.18, v) * uKey;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(shown, 1.0);
  }
`;
const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform sampler2D wallMap;
  uniform float wallLength;
  uniform float wallHeight;
  uniform vec3 toCamera;
  uniform vec3 lightDir;
  uniform vec3 sideColor;
  uniform float uAlpha;
  uniform float uFade; // 0..1: how far a layer has dissolved into the page colour (solid, never see-through)
  uniform vec3 uBg;    // the page colour
  uniform float uDim; // 0..1: darkens a layer that is behind the highlighted one
  uniform float uGloss; // 0..1: how much of the 3D shine is switched on (only for a layer that has left the stack)
  uniform vec3 uShine;  // how glossy this food is: strength, sharpness, bumpiness
  uniform float uSideFromTop; // 1 for butter and jelly (their thick side looks like their surface); 0 for bread (its side is crust)
  uniform vec2 photoSize;
  varying vec3 vNormalView;
  varying vec3 vPhotoRightV;
  varying vec3 vPhotoUpV;
  varying vec3 vFaceN;
  varying float vWallU;
  varying vec2 vUv;
  varying vec3 vPos;
  varying vec3 vNormalObj;
  varying vec3 vNormalWorld;

  float light(vec3 n) { return 0.58 + 0.42 * max(dot(normalize(n), lightDir), 0.0); }

  void main() {
    vec3 n = normalize(vNormalObj);

    // The side walls: the strip cut from the photo, wrapped around the slab
    vec2 wallUv = vec2(vWallU / wallLength, 1.0 + vPos.y / wallHeight);
    vec3 wall = texture2D(wallMap, wallUv).rgb;

    // The photo itself, painted on from where it was taken (never cut out: a missing pixel is a wall pixel)
    vec4 t = texture2D(map, vUv);
    vec3 photo = mix(wall, t.rgb, smoothstep(0.35, 0.65, t.a));

    // Top faces and the walls we can see in the photo use the photo; the rest use the wrapped wall
    float facing = dot(n, toCamera);
    float usePhoto = max(smoothstep(0.55, 0.75, n.y), smoothstep(0.0, 0.3, facing));
    float notFront = 1.0 - smoothstep(0.3, 0.7, n.z); // the front wall is the one the photo shows, so it is left exactly as photographed
    usePhoto = max(usePhoto, uGloss * notFront * smoothstep(0.1, 0.45, n.y)); // out front, the rounded lip at the top and sides shows the photo's colour, not the dark side strip
    vec3 col = mix(wall, photo, usePhoto);

    // Same light as at rest (so the photo is untouched), brighter or darker as the slab turns
    // (a layer out front keeps its brightness however it tilts, so its lower edges never darken)
    col *= mix(clamp(light(vNormalWorld) / light(n), 0.5, 1.3), 1.0, uGloss);
    // The 3D look for a layer that is out of the stack. It only ever darkens, brightens or tints the food's
    // own colour (never washes it out with white), and the flat face keeps exactly its photo colour.
    //  - the rounded edge catches the light on one side and falls into shade on the other
    //  - a small, tight glossy highlight catches the surface texture
    // It is all worked out from the camera's point of view, so it is the same however the layer travels.
    if (uGloss > 0.001) {
      vec3 V = vec3(0.0, 0.0, 1.0);
      vec3 L = normalize(vec3(-0.45, 0.65, 0.62));
      vec3 ng = normalize(vNormalView); // the shape's own normal: flat on the face
      // Round the rim: look at how much of the food is around this spot. Near the outline there is food on
      // one side only, so tilt the surface outward there, as if the edge curved over like a real rounded lip.
      vec2 around = vec2(0.0);
      float seen = 0.0;
      for (int k = 0; k < 8; k++) {
        float ang = float(k) * 0.7853982;
        vec2 dir = vec2(cos(ang), sin(ang));
        float a = texture2D(map, vUv + dir * 0.075 / photoSize).a;
        around += dir * a;
        seen += a;
      }
      float rimAmt = 1.0 - smoothstep(0.5, 1.0, seen / 8.0); // 0 inside, 1 right on the outline
      vec2 out2 = -normalize(around + vec2(1e-4));
      vec3 outward = normalize(vPhotoRightV * out2.x + vPhotoUpV * out2.y);
      ng = normalize(ng + vec3(outward.xy, 0.0) * rimAmt * 1.5);
      // The photo's outermost pixel or two are half see-through and come out as a thin dark line. Only
      // those, and only a hair's width: paint them with the colour right beside them, from inside.
      float fringe = 1.0 - smoothstep(0.55, 0.95, t.a);
      vec3 inner = texture2D(map, vUv + normalize(around + vec2(1e-4)) * 0.03 / photoSize).rgb;
      col = mix(col, inner, fringe * uGloss);
      // The thick side of the layer (seen when it leans or rocks) takes the surface's own colour, a touch
      // deeper, instead of the dark strip cut from the photo: it reads as the same food, just thicker
      float sideAmt = (1.0 - smoothstep(0.05, 0.45, n.y)) * (1.0 - smoothstep(0.3, 0.7, n.z)); // never the front wall
      vec3 surface = texture2D(map, vUv + normalize(around + vec2(1e-4)) * 0.06 / photoSize).rgb;
      col = mix(col, surface * 0.9, sideAmt * uGloss * uSideFromTop);
      float flatLit = 0.45 + 0.7 * max(dot(normalize(vFaceN), L), 0.0); // the flat face is the reference, however it is turned
      float lit = 0.45 + 0.7 * max(dot(ng, L), 0.0);
      float edge = 1.0 - clamp(ng.z, 0.0, 1.0); // 0 on the flat face, up to 1 at the very edge
      col *= mix(1.0, clamp(lit / flatLit, 0.96, 1.3), uGloss); // edges facing the light glow a little; none go dark
      float lum = dot(photo, vec3(0.299, 0.587, 0.114));
      // the flat face always counts as facing us, so the shine never flares as the layer turns; only the edge and the texture's tiny bumps change it
      vec3 nv = normalize(ng - normalize(vFaceN) + vec3(0.0, 0.0, 1.0) + vec3(-vec2(dFdx(lum), dFdy(lum)) * uShine.z, 0.0));
      float spec = pow(max(dot(nv, normalize(L + V)), 0.0), uShine.y) * uShine.x;
      col += spec * mix(vec3(1.0), col, 0.55) * uGloss; // highlight tinted by the food's own colour
    }
    col *= 1.0 - uDim;
    col = mix(col, uBg, uFade);
    gl_FragColor = vec4(col, uAlpha);
    #include <colorspace_fragment>
  }
`;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function createMascot(root) {
  const canvas = root.querySelector("canvas");
  const hero = root.closest(".hero");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0); // always see-through, so the page colour shows behind the sandwich
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const viewDir = new THREE.Vector3(0, Math.sin(ELEVATION), Math.cos(ELEVATION));

  const turntable = new THREE.Group(); // spins the whole sandwich
  scene.add(turntable);

  // ---- The animated values (the timeline moves these; draw() puts them on screen) ----
  const piece = LAYERS.map((_, i) => ({ y: APART[i], x: TILTS[i][0], turn: TILTS[i][1], z: TILTS[i][2] }));
  const cam = { target: 0.9, zoom: 1 };
  // The hero opening: the sandwich starts assembled and tiny (zoom ~0), grows out of the middle, then its layers
  // float apart (apart 0 -> 1). Both are 1 for the rest of the visit.
  const opening = { zoom: 1, apart: 1 };
  const heroTitle = hero.querySelector(".hero-title"); // the big title behind the sandwich: fades while a layer is up front
  const spin = { angle: 0 };
  const hop = LAYERS.map(() => ({ v: 0 }));
  // Each layer follows its scroll position on a springy "string", so landing and lifting off are a
  // little bouncy in both directions. A floor stops any layer sinking into the one below it.
  const springs = LAYERS.map(() => ({ y: 0, v: 0, ready: false }));
  const MAX_STRAY = 0.22; // the furthest a bounce can go from the scroll position, in sandwich units
  let OMEGA = 13; // how stiff the spring is (higher = snappier)
  let DAMPING = 2 * 0.45 * OMEGA; // 0.45 = slightly bouncy (1 would be no bounce at all)
  const tune = (omega, zeta) => {
    OMEGA = omega;
    DAMPING = 2 * zeta * omega;
  };
  const backdrop = root.parentElement.querySelector(".focus-backdrop");
  const corner = new THREE.Vector3();
  const pageColor = new THREE.Color();
  // Tap a layer and it floats out to the front of the screen. focus.i is which layer (-1 = none) and
  // focus.amount goes 0 -> 1 as it travels out
  const focus = { i: -1, amount: 0, dim: 0 };
  // Layers that have words to tell. A tapped one first comes to the middle exactly like any other; then, a
  // split second later, it slides to the right while the others fade away and the words type in on the left.
  // shift goes 0 -> 1 as it slides, and RIGHT_AT is where its middle ends up (a fraction of the hero's width)
  // Each layer's words live in a .story block in the page (data-layer = the layer's number, 0 = bottom bread)
  const stories = new Map([...hero.querySelectorAll(".story")].map((el) => [Number(el.dataset.layer), el]));
  const story = { shift: 0 }; // the same slide-to-the-right, for a tapped layer
  const STORY_ORDER = [3, 2, 1, 0]; // the order the layers come up as you scroll: top bread, peanut butter, jelly, bottom bread
  const dyOf = [0, 0, 0, 0]; // per layer: how far its middle sits off the middle of the hero (measured once it has arrived)
  const dyKnown = [false, false, false, false];
  let lastSideFit = 1;

  const RIGHT_AT = 0.73;
  const RIGHT_FILL = 0.42; // it never takes more than this share of the width once it has moved over
  // On phones the layer settles into a box that the words leave free for it (see .story-slot in style.css):
  // a big layer on the right, with the words wrapping above, beside and below it
  const slotAt = LAYERS.map(() => ({ cx: 0, cy: 0, w: 1, h: 1 })); // per layer, phones only: the box the layer settles into (pixels, from the hero's top left)
  // phones: how far each layer sits above (negative) or below the middle of its box, as a share of the box's height.
  // The top bread and the peanut butter have more words below them, so they ride a little higher (jelly and the
  // bottom bread sit just right in the middle)
  const SLOT_NUDGE = { 3: -0.04, 2: -0.11, 1: 0, 0: 0 }; // the top bread and the peanut butter ride a little higher; the others sit just right
  // phones, live text wrap: the words re-flow around the layer all the way as it moves (see reflowAround below)
  const WRAP_ROOM = { 3: true }; // layers whose wrap box reaches one margin past their left edge (see reflowAround)
  const slotHome = LAYERS.map(() => null); // per layer: the box + shape it settles into: { aspect, shape, top }
  const liveWrap = [false, false, false, false];
  let wrapFrozen = false; // while the words are leaving, the wrap stays as it is (no re-wrapping of words that are fading out)
  const dxOf = [0, 0, 0, 0]; // per layer, phones only: how far its middle sits off the middle of the hero, sideways
  const fitOf = [1, 1, 1, 1]; // per layer, phones only: how much it shrinks to fit its box
  let isPhone = false;

  const FOCUS_DEPTH = 8; // how far a tapped layer is pulled toward the viewer while it swings round
  const squareYaw = []; // per layer: the turn that makes its edges run level with the screen
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const v3 = new THREE.Vector3();
  const Y_AXIS = new THREE.Vector3(0, 1, 0);
  let lastTime = 0;
  const meshes = [];
  const halos = []; // the gap copies, one per layer (they wobble in step with the lettering)
  const HALO = 1.045; // how much bigger the gap copy is (a little over 4%, about 9px around a bread slice on a laptop)
  const haloMaterial = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Vector3(1, 1, 1) } },
    vertexShader: "void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform vec3 uColor; void main() { gl_FragColor = vec4(uColor, 1.0); }",
    depthTest: false,
    depthWrite: false,
  });
  // The gap takes a new little wobble 12 times a second, in the same rhythm as the paper-cut lettering: its size
  // breathes a touch and it slides a hair, so the cut-out edge seems hand-trimmed along with the words.
  // Phones: the folder tabs cover the top of the screen, so the sandwich is slid down until it sits in the middle of the
  // space left below them (measured from where its layers actually are, and eased in so it never jumps)
  let phoneShift = 0; // pixels the picture is slid down
  let measureTick = 0;
  let settling = false;
  let apartDoneAt = null; // when the layers finished floating apart (null until then)
  let seenHi = 0;
  let seenLo = 0;
  let extHi = 0;
  let extLo = 0; // the top and bottom of the layers on screen, as measured last (-1..1, up is positive)
  const tabBar = document.querySelector(".tabs");
  let haloFrame = -1;
  const wobbleHalos = () => {
    const f = cutFrame();
    if (f === haloFrame) return;
    haloFrame = f;
    halos.forEach((halo, i) => {
      const k = HALO + (cutRandom(f, 300 + i) - 0.5) * 0.012;
      const [cx, cy, cz] = halo.userData.centre;
      const dx = (cutRandom(f, 400 + i) - 0.5) * 0.014;
      const dz = (cutRandom(f, 500 + i) - 0.5) * 0.014;
      halo.scale.setScalar(k);
      halo.position.set(cx * (1 - k) + dx, cy * (1 - k), cz * (1 - k) + dz);
    });
  };
  let haloKey = "";
  const pageProbe = document.createElement("div"); // only here to read the page colour (the --page variable) as plain rgb
  pageProbe.style.cssText = "display:none;background:var(--page)";
  document.body.append(pageProbe);
  // keep the gap the colour of the page, in light and dark
  const updateHaloColour = () => {
    const key = `${document.documentElement.dataset.theme}|${size.w}`; // theme or breakpoint changed (cheap check, so no style lookup every frame)
    if (key === haloKey) return;
    haloKey = key;
    const [r, g, b] = getComputedStyle(pageProbe).backgroundColor.match(/\d+/g).map(Number);
    haloMaterial.uniforms.uColor.value.set(r / 255, g / 255, b / 255);
  };
  let rest = [0, 0, 0, 0]; // where each slab sits when the sandwich is built
  let stackCenter = 0.1;
  let ppu = 140; // pixels per world unit
  let size = { w: 1, h: 1 }; // the canvas size we last drew at
  let spread = 1;

  // ---- The words: each letter is its own little span so they can type themselves in ----
  let rolls = { from: [], to: [] }; // set per layer just before its words are split
  const splitLetters = (el) => {
    const out = [];
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 1 && child.classList.contains("roll")) {
          // A word that later rolls into another (e.g. "drops" -> "[Coming soon]"). The slot is as wide as the
          // new text from the start, so nothing re-wraps when it rolls. The old letters are typed like the rest;
          // the new letters wait out of sight below the slot.
          const to = child.dataset.to;
          const slot = document.createElement("span");
          slot.className = "roll-slot";
          slot.style.setProperty("--n", to.length);
          const from = document.createElement("span");
          from.className = "roll-from";
          [...child.textContent].forEach((c) => {
            const ch = document.createElement("span");
            ch.className = "ch";
            ch.textContent = c;
            from.append(ch);
            out.push(ch);
            rolls.from.push(ch);
          });
          const next = document.createElement("span");
          next.className = "roll-to";
          [...to].forEach((c, k) => {
            const ch = document.createElement("span");
            ch.className = "rch";
            ch.style.left = `${k}ch`;
            ch.textContent = c;
            next.append(ch);
            rolls.to.push(ch);
          });
          slot.append(from, next);
          child.replaceWith(slot);
          return;
        }
        if (child.nodeType === 1) return walk(child);
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.append(" ");
          const word = document.createElement("span");
          word.className = "w";
          [...part].forEach((c) => {
            const ch = document.createElement("span");
            ch.className = "ch";
            ch.textContent = c;
            word.append(ch);
            out.push(ch);
          });
          frag.append(word);
        });
        child.replaceWith(frag);
      });
    };
    walk(el);
    // Context paragraphs: never leave a single word alone on the last line (tie the last two words together)
    if (el.tagName === "P") {
      const texts = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let gap = null;
      while (texts.nextNode()) if (/^\s+$/.test(texts.currentNode.textContent)) gap = texts.currentNode;
      if (gap) gap.textContent = "\u00a0";
    }
    return out;
  };
  const storyRolls = new Map(); // per layer: the letters that roll out, and the letters that roll in
  const storyLines = new Map(
    [...stories].map(([i, el]) => {
      rolls = { from: [], to: [] };
      storyRolls.set(i, rolls);
      return [i, [...el.children].map((child) => splitLetters(child))];
    })
  );
  // Each layer's title is paper-cut lettering (see cutword.js): every typed-in letter holds a little vector letter, so the
  // typing, the line breaks and the wrapping all work exactly as before. The letters wear the layer's own colour.
  const TITLE_FACE = { 3: "var(--crust)", 0: "var(--crust)", 2: "var(--pop)", 1: "var(--strawberry)" };
  stories.forEach((el, i) => {
    const title = el.querySelector(".story-title");
    if (!title) return;
    title.setAttribute("aria-label", title.textContent.replace(/\u00a0/g, " ").trim());
    title.querySelectorAll(".ch").forEach((span) => {
      const letter = createCutLetter(span.textContent, { fill: TITLE_FACE[i] || "var(--pop)", shadow: "var(--brown)" });
      if (!letter) return;
      span.textContent = "";
      span.append(letter.el);
    });
  });

  // ---- Scroll timeline ----
  // The build: the pieces drop in one by one, then the whole sandwich spins. It plays as you scroll,
  // once all four layers have had their turn (see "One scroll, one step" below)
  const tl = gsap.timeline({ paused: true });
  const startAt = [0, 0.2, 1.2, 2.2];
  piece.forEach((p, i) => {
    tl.fromTo(
      p,
      { y: () => APART[i] * spread },
      { y: () => rest[i], duration: 1, ease: "power3.inOut" }, // smooth both ways (a bounce would jolt when scrolling back up)
      startAt[i]
    ).fromTo(
      p,
      { x: TILTS[i][0], turn: TILTS[i][1], z: TILTS[i][2] },
      { x: 0, turn: 0, z: 0, duration: i === 0 ? 1 : 0.9, ease: "power2.inOut" },
      startAt[i]
    );
  });
  tl.fromTo(spin, { angle: 0 }, { angle: Math.PI * 2, duration: 1.2, ease: "power3.inOut" }, 3.2)
    .fromTo(cam, { target: () => 0.9 * spread }, { target: () => stackCenter, duration: 3.2, ease: "none" }, 0)
    .fromTo(cam, { zoom: 1 }, { zoom: 1 / 0.82, duration: 1.2, ease: "power2.inOut" }, 3.2);

  if (import.meta.env.DEV) window.mascotDebug = { gsap, focus, story, spin, cam, piece, tl, turntable, renderer, scene, camera, draw: (t, snap) => draw(t, snap), tune }; // handy for testing in the browser

  function resize() {
    const { clientWidth: cw, clientHeight: ch } = root;
    if (!cw || !ch) return;
    // Resizing clears the canvas, so only do it when the size really changed (a no-op resize mid-scroll
    // would flash the sandwich blank for a frame)
    if (cw === size.w && ch === size.h) return;
    renderer.setSize(cw, ch, false);
    size = { w: cw, h: ch };
    const W = Math.min(cw * 0.95, ch * 0.8); // width of the whole photo on screen
    ppu = W / PHOTO_W;
    // Keep the whole floating-apart stack inside the hero, even on short screens
    spread = Math.min(1, Math.max(0.35, (0.97 * ch / W - 0.54) / 0.73));
    isPhone = window.matchMedia("(max-width: 767px)").matches;
    stories.forEach((el) => {
      el.style.top = "";
      el.style.transform = "";
    });
    dyKnown.fill(false);
    camera.left = -cw / 2 / ppu;
    camera.right = cw / 2 / ppu;
    camera.top = ch / 2 / ppu;
    camera.bottom = -ch / 2 / ppu;
    tl.invalidate();
    tl.progress(tl.progress());
    draw(lastTime); // redraw at the same moment, so a resize never makes the sandwich jump
  }

  // The layer's silhouette on the screen right now, as a text-wrap shape. The words' box is made as wide as the
  // space from the layer's left edge to the right edge of the text area, and as tall as from where the words
  // start to the layer's bottom edge, so the lines wrap to the left of wherever the layer is.
  function reflowAround(i, given) {
    // (normally the layer's outline is read off the screen right now; `given` is an outline worked out in advance)
    let xs = [];
    let ys = [];
    if (given) {
      xs = given.xs;
      ys = given.ys;
    } else {
      const mesh = meshes[i];
      camera.updateMatrixWorld(true);
      mesh.updateMatrixWorld(true);
      const pos = mesh.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pos.count / 2500));
      for (let k = 0; k < pos.count; k += step) {
        corner.fromBufferAttribute(pos, k).applyMatrix4(mesh.matrixWorld).project(camera);
        xs.push(((corner.x + 1) / 2) * size.w);
        ys.push(((1 - corner.y) / 2) * size.h);
      }
    }
    let top = Infinity;
    let bottom = -Infinity;
    let left = Infinity;
    for (let k = 0; k < xs.length; k++) {
      top = Math.min(top, ys[k]);
      bottom = Math.max(bottom, ys[k]);
      left = Math.min(left, xs[k]);
    }
    const el = stories.get(i);
    const slot = el.querySelector(".story-slot");
    const origin = root.getBoundingClientRect();
    const area = el.getBoundingClientRect();
    const areaRight = area.right - origin.left;
    const boxTop = slotHome[i].top; // the words' flow starts here; nothing above it can be wrapped
    // The browser clips the wrap's margin at the edge of this box, so where the layer bulges out furthest to the left
    // its margin would shrink to nothing. For layers listed in WRAP_ROOM the box starts one margin further left, so
    // the margin holds all the way round.
    const room = WRAP_ROOM[i] ? parseFloat(getComputedStyle(slot).shapeMargin) || 0 : 0;
    const boxLeft = Math.max(area.left - origin.left, left - room);
    const boxW = Math.max(8, areaRight - boxLeft);
    const BELOW = 16; // extra clearance under the layer's bottom edge, on top of the wrap's even margin, so words never sit right under it
    const boxH = bottom + BELOW - boxTop;
    if (boxH < 6) {
      slot.style.height = "0px";
      slot.style.shapeOutside = "none";
      return;
    }
    // trace the silhouette in bands from the top (or from where the words start) down to the layer's bottom
    const BANDS = 24;
    const yTop = Math.max(top, boxTop);
    const band = (bottom - yTop) / BANDS;
    const lo = new Array(BANDS + 1).fill(Infinity);
    const hi = new Array(BANDS + 1).fill(-Infinity);
    for (let k = 0; k < xs.length; k++) {
      if (ys[k] < yTop - band) continue;
      const r = (ys[k] - yTop) / band;
      for (const row of [Math.floor(r), Math.ceil(r)]) {
        if (row < 0 || row > BANDS) continue;
        lo[row] = Math.min(lo[row], xs[k]);
        hi[row] = Math.max(hi[row], xs[k]);
      }
    }
    const pctX = (v) => `${Math.min(100, Math.max(0, ((v - boxLeft) / boxW) * 100)).toFixed(1)}%`;
    const pctY = (v) => `${Math.min(100, Math.max(0, ((v - boxTop) / boxH) * 100)).toFixed(1)}%`;
    const leftEdge = [];
    const rightEdge = [];
    for (let r = 0; r <= BANDS; r++) {
      if (lo[r] === Infinity) continue;
      const y = pctY(yTop + r * band);
      leftEdge.push(`${pctX(lo[r])} ${y}`);
      rightEdge.unshift(`${pctX(hi[r])} ${y}`);
    }
    if (leftEdge.length > 2) {
      // hold the same width a little way further down, to leave the extra clearance under the layer
      const lastLeft = leftEdge[leftEdge.length - 1].split(" ")[0];
      const lastRight = rightEdge[0].split(" ")[0];
      leftEdge.push(`${lastLeft} ${pctY(bottom + BELOW)}`);
      rightEdge.unshift(`${lastRight} ${pctY(bottom + BELOW)}`);
    }
    slot.style.aspectRatio = "auto";
    slot.style.margin = "0";
    slot.style.width = `${boxW}px`;
    slot.style.height = `${boxH}px`;
    slot.style.shapeOutside = leftEdge.length > 2 ? `polygon(${[...leftEdge, ...rightEdge].join(",")})` : "none";
  }
  // Back to the settled box and shape (once the layer has arrived, or has gone back)
  function settleWrap(i) {
    const slot = stories.get(i).querySelector(".story-slot");
    slot.style.margin = "";
    slot.style.width = "";
    slot.style.height = "";
    slot.style.aspectRatio = slotHome[i].aspect;
    slot.style.shapeOutside = slotHome[i].shape;
  }

  // snap = jump straight to the scroll position with no spring (used for testing and first draw)
  function draw(time, snap = false) {
    if (!meshes.length) return;
    const dt = Math.min(0.05, Math.max(0, time - lastTime));
    lastTime = time;
    const bounce = hop[0].v * 0.12; // the click hop moves the whole sandwich together
    let belowY = -Infinity;
    meshes.forEach((mesh, i) => {
      const p = piece[i];
      const sp = springs[i];
      if (snap || !sp.ready) {
        sp.y = p.y;
        sp.v = 0;
        sp.ready = true;
      } else if (dt > 0) {
        // Move the spring toward where the scroll says this layer should be (in small, steady steps)
        const steps = Math.ceil(dt * 120);
        const h = dt / steps;
        for (let k = 0; k < steps; k++) {
          sp.v += (-OMEGA * OMEGA * (sp.y - p.y) - DAMPING * sp.v) * h;
          sp.y += sp.v * h;
        }
        // A bounce never strays far from where the scroll puts the layer (keeps it inside the frame)
        const stray = Math.max(-MAX_STRAY, Math.min(MAX_STRAY, sp.y - p.y));
        if (stray !== sp.y - p.y) {
          sp.y = p.y + stray;
          sp.v *= 0.5;
        }
      }
      // A layer only floats while it is still in the air; once landed it moves with the stack
      const apartY = APART[i] * spread;
      const floating = Math.min(1, Math.max(0, (p.y - rest[i]) / (apartY - rest[i] || 1)));
      // A tilted slab dips one corner down, so lift it just enough to stay clear of the layer below
      const clearance = i === 0 ? 0 : 1.3 * (Math.abs(Math.sin(p.x)) + Math.abs(Math.sin(p.z)));
      let y = sp.y + clearance + Math.sin(time * 1.4 + i * 1.3) * 0.08 * floating + bounce;
      // The floor: never lower than resting on the layer below. Hitting it makes a small bounce.
      if (i > 0) {
        const floor = belowY + (rest[i] - rest[i - 1]);
        if (y < floor) {
          sp.y += floor - y;
          y = floor;
          if (sp.v < 0) sp.v *= -0.35;
        }
      }
      belowY = y;
      mesh.position.set(0, rest[i] + (y - rest[i]) * opening.apart, 0);
      // the slabs level out while tucked together (tilted slabs poke through each other and flicker), and tilt as they float apart
      mesh.rotation.set(p.x * opening.apart, p.turn, (p.z + Math.sin(time * 1.1 + i) * 0.06 * floating) * opening.apart);
    });
    turntable.rotation.y = spin.angle;
    // The camera follows the stack down and zooms in, and the whole thing bobs a little
    const target = new THREE.Vector3(0, stackCenter + (cam.target - stackCenter) * opening.apart - Math.sin(time * 1.2) * 0.05, 0);
    camera.position.copy(target).addScaledVector(viewDir, 30);
    camera.lookAt(target);
    camera.zoom = cam.zoom * opening.zoom;
    const slide = isPhone ? phoneShift * (1 - Math.min(1, focus.amount * 2)) : 0; // a tapped layer comes to the true middle, so the slide eases out
    if (slide > 0.05) camera.setViewOffset(size.w, size.h, 0, -slide, size.w, size.h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    // Keep the whole sandwich inside the frame: if any layer would poke out of the top or bottom, slide
    // the camera just enough to bring it back (smooth, because the layers themselves move smoothly)
    const LIMIT = 0.96;
    const frameShift = () => {
      camera.updateMatrixWorld(true);
      let hi = -Infinity;
      let lo = Infinity;
      meshes.forEach((mesh) => {
        mesh.updateMatrixWorld(true);
        const b = mesh.geometry.boundingBox;
        for (let k = 0; k < 8; k++) {
          corner.set(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z).applyMatrix4(mesh.matrixWorld).project(camera);
          hi = Math.max(hi, corner.y);
          lo = Math.min(lo, corner.y);
        }
      });
      extHi = hi;
      extLo = lo;
      // Too high pushes the view up, too low pushes it down. Always a smooth blend, never a sudden switch
      return Math.max(0, hi - LIMIT) + Math.min(0, lo + LIMIT);
    };
    for (let pass = 0; pass < 2; pass++) {
      const over = frameShift() * opening.apart; // in screen units: positive = too high. Quiet while the layers are still tucked together, so the opening never makes the view lurch
      if (!over) break;
      target.y += over * (camera.top / camera.zoom) / Math.cos(ELEVATION);
      camera.position.copy(target).addScaledVector(viewDir, 30);
      camera.lookAt(target);
    }
    if (isPhone && tabBar && focus.amount < 0.001) {
      // where the layers really are on screen: every point of their outlines, looked at every 8th frame (the layers move
      // smoothly, so the last answer stays good in between)
      if (opening.apart >= 1 && ++measureTick % 8 === 1) {
        let hi = -Infinity;
        let lo = Infinity;
        camera.updateMatrixWorld(true);
        meshes.forEach((mesh) => {
          mesh.updateMatrixWorld(true);
          const pos = mesh.geometry.attributes.position;
          for (let k = 0; k < pos.count; k++) {
            corner.fromBufferAttribute(pos, k).applyMatrix4(mesh.matrixWorld).project(camera);
            if (corner.y > hi) hi = corner.y;
            if (corner.y < lo) lo = corner.y;
          }
        });
        seenHi = hi;
        seenLo = lo;
      }
      const hi = seenHi;
      const lo = seenLo;
      const nowY = ((1 - (hi + lo) / 2) / 2) * size.h; // where the middle of the layers is on screen right now
      const wantY = (tabBar.offsetHeight + size.h) / 2 + size.h * 0.02; // the middle of the space below the tabs, a touch lower (the top bread's tilted edge makes the stack look higher than it measures)
      if (opening.apart >= 1) {
        // right after the opening the slide eases in gently (it was worked out off screen, so any leftover correction is tiny and should not be seen)
        if (apartDoneAt === null) apartDoneAt = time;
        const rate = settling ? 0.06 : 0.06 * Math.min(1, Math.max(0.05, (time - apartDoneAt) / 3));
        phoneShift = Math.max(0, Math.min(size.h * 0.2, phoneShift + (wantY - nowY) * rate));
      }
    }
    // The tapped layer: slide it to the middle of the screen, pull it in front of the others and make it
    // a little bigger (never wider than the screen). Everything else stays exactly where it was.
    meshes.forEach((mesh, i) => mesh.scale.setScalar(LAYERS[i].size));
    // The tapped layer flows out to the front in one continuous, curving motion:
    //  - it swings out to the side just far enough to clear the stack (a half-circle lobe), then curves
    //    back in to the middle of the screen,
    //  - at the far side of the swing it is moved nearer to us than everything else (nothing on screen
    //    changes when that happens, because it is already clear of the stack), so it passes in front,
    //  - as it comes round it turns to face us square-on.
    // Coming back is the same motion in reverse. On the way it only grows as it arrives (except on a very narrow screen,
    // where the whole view eases out a touch so the swing fits).
    let dimAmount = 0;
    let glossAmount = 0;
    // Which layer is up front (brought by a scroll step or a tap)
    const fi = focus.i;
    const fa = focus.amount;
    if (heroTitle) heroTitle.style.opacity = String(1 - Math.min(1, fa * 1.5));
    const fs = story.shift;
    const storyOn = stories.has(fi);
    let mesh_;
    if (fi >= 0 && fa > 0.0005 && meshes[fi]) {
      const mesh = meshes[fi];
      const size_ = LAYERS[fi].size;
      const u = fa;
      const ease = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
      const lobe = Math.sin(Math.PI * u); // 0 at both ends, 1 at the far side of the swing
      const sm = ease(u); // 0 -> 1 across the whole trip
      const turn = ease((u - 0.35) / 0.65);
      const box = mesh.geometry.boundingBox;
      const L = (box.max.x - box.min.x) * size_;
      let stackW = 0;
      meshes.forEach((m, j) => (stackW = Math.max(stackW, (m.geometry.boundingBox.max.x - m.geometry.boundingBox.min.x) * LAYERS[j].size)));
      const clearX = 0.52 * (stackW + L); // far enough out to be clear of the stack
      // Only on a narrow screen: ease the view out a little so the swing fits (desktop stays at 1)
      const halfW0 = ((size.w / 2) / (ppu * cam.zoom)) * 0.9;
      const zMin = Math.min(1, Math.max(0.4, halfW0 / (clearX + L / 2)));
      camera.zoom = cam.zoom * (1 - (1 - zMin) * lobe);
      camera.updateProjectionMatrix();
      // Where the layer's middle is on screen to begin with
      mesh.scale.setScalar(size_);
      camera.updateMatrixWorld(true);
      mesh.updateMatrixWorld(true);
      box.getCenter(v1);
      mesh.localToWorld(v1);
      v2.copy(v1).applyMatrix4(camera.matrixWorldInverse);
      const x0 = v2.x;
      const y0 = v2.y;
      // Turn it to face us (tip up, and straighten its edges)
      mesh.rotation.y += squareYaw[fi] * turn;
      // Not quite dead flat: it leans back about 10 degrees and rocks very gently, so you can see it has
      // thickness and rounded edges, and the light moves across it
      mesh.rotation.x += (Math.PI / 2 - ELEVATION - 0.17 + Math.sin(time * 1.3) * 0.03) * turn;
      mesh.rotation.y += Math.sin(time * 0.9) * 0.05 * turn;
      mesh.rotation.z *= 1 - turn;
      // Arriving at the front it grows to take a proper share of the screen (it is the star now), a touch
      // past its final size on the way for a soft "breath", and never bigger than the screen allows
      const widthPx = L * ppu * cam.zoom;
      const heightPx = (box.max.z - box.min.z) * size_ * ppu * cam.zoom;
      const grow = Math.min(1.7, (size.w * 0.86) / widthPx, (size.h * 0.8) / heightPx);
      const arrive = ease((u - 0.4) / 0.6);
      // Once it has slid to the right it may need to be a little smaller, to leave room for the words
      const sh = storyOn ? fs : 0;
      const sideFit = isPhone ? fitOf[fi] : Math.min(1, (size.w * RIGHT_FILL) / (widthPx * grow));
      lastSideFit = sideFit;
      mesh.scale.setScalar(size_ * (1 + (grow - 1) * arrive) * (1 + (sideFit - 1) * sh));
      glossAmount = ease(u / 0.2); // the 3D shine switches on as it leaves the stack and stays on
      dimAmount = 0.55 * arrive; // the stack behind it settles back in brightness
      mesh.updateMatrixWorld(true);
      box.getCenter(v1);
      mesh.localToWorld(v1);
      v2.copy(v1).applyMatrix4(camera.matrixWorldInverse); // the middle now (after turning and growing)
      // The path on screen: out to the side and round into the middle
      const swing = clearX * lobe;
      // where it settles: on computers, over to the right; on phones, into the box left for it in the text
      const toWorld = 1 / (ppu * camera.zoom);
      const settleX = isPhone ? (slotAt[fi].cx - size.w / 2 - dxOf[fi]) * toWorld : (RIGHT_AT - 0.5) * size.w * toWorld;
      const settleUp = isPhone ? (size.h / 2 - slotAt[fi].cy) * toWorld : 0;
      const wantX = x0 * (1 - sm) + swing + sh * settleX;
      const wantY = y0 * (1 - sm) + (y0 < 0 ? 0.1 : -0.1) * clearX * lobe + sh * (dyOf[fi] + settleUp);
      // Nearer to us once it is out at the side and clear of the stack (invisible when it happens)
      const toward = FOCUS_DEPTH * (u >= 0.5 ? 1 : ease((swing / clearX - 0.85) / 0.15)); // and it stays in front from then on
      const right = v3.setFromMatrixColumn(camera.matrixWorld, 0);
      const up = v1.setFromMatrixColumn(camera.matrixWorld, 1);
      const move = new THREE.Vector3()
        .addScaledVector(right, wantX - v2.x)
        .addScaledVector(up, wantY - v2.y)
        .addScaledVector(viewDir, toward);
      mesh.position.add(move.applyAxisAngle(Y_AXIS, -spin.angle)); // in the spinning turntable's own directions
    }
    // Once the layer is at centre stage, measure where it sits up and down on the screen, so that when it
    // slides over it can settle exactly on the vertical middle of the hero. The words' box is centred on the
    // same line (see .story in style.css), so bread and words share one middle.
    if (storyOn && !dyKnown[fi] && fa >= 0.999) {
      mesh_ = meshes[fi];
      camera.updateMatrixWorld(true);
      mesh_.updateMatrixWorld(true);
      const pos = mesh_.geometry.attributes.position; // its real outline, not its bounding box
      const step = Math.max(1, Math.floor(pos.count / 4000));
      let top = Infinity;
      let bottom = -Infinity;
      let left = Infinity;
      let right = -Infinity;
      const samplesX = [];
      const samplesY = [];
      for (let k = 0; k < pos.count; k += step) {
        corner.fromBufferAttribute(pos, k).applyMatrix4(mesh_.matrixWorld).project(camera);
        const py = ((1 - corner.y) / 2) * size.h;
        const px = ((corner.x + 1) / 2) * size.w;
        samplesX.push(px);
        samplesY.push(py);
        top = Math.min(top, py);
        bottom = Math.max(bottom, py);
        left = Math.min(left, px);
        right = Math.max(right, px);
      }
      dyOf[fi] = ((top + bottom) / 2 - size.h / 2) / (ppu * camera.zoom); // up is positive, so a layer that is too high gets a negative nudge
      if (isPhone) {
        // Trace the layer's silhouette, so the words can follow its curves. For a set of bands from top to
        // bottom, find how far left and right the layer reaches, and hand that outline to the browser as a
        // text-wrap shape (with an even gap all round). The box the layer settles into takes the outline's shape.
        const slot = stories.get(fi).querySelector(".story-slot");
        const BANDS = 30;
        const w0 = right - left;
        const h0 = bottom - top;
        const band = h0 / BANDS;
        const lo = new Array(BANDS + 1).fill(Infinity);
        const hi = new Array(BANDS + 1).fill(-Infinity);
        for (let k = 0; k < samplesX.length; k++) {
          const row = Math.round((samplesY[k] - top) / band);
          lo[row] = Math.min(lo[row], samplesX[k]);
          hi[row] = Math.max(hi[row], samplesX[k]);
          // a point near the edge of a band also counts for the band next to it, so no band is left empty
          const near = Math.floor((samplesY[k] - top) / band);
          for (const r of [near, near + 1]) {
            if (r >= 0 && r <= BANDS && Math.abs(samplesY[k] - (top + r * band)) < band) {
              lo[r] = Math.min(lo[r], samplesX[k]);
              hi[r] = Math.max(hi[r], samplesX[k]);
            }
          }
        }
        const pct = (v, from, span) => `${Math.min(100, Math.max(0, ((v - from) / span) * 100)).toFixed(1)}%`;
        const leftEdge = [];
        const rightEdge = [];
        for (let r = 0; r <= BANDS; r++) {
          if (lo[r] === Infinity) continue;
          const y = pct(top + r * band, top, h0);
          leftEdge.push(`${pct(lo[r], left, w0)} ${y}`);
          rightEdge.unshift(`${pct(hi[r], left, w0)} ${y}`);
        }
        slot.style.aspectRatio = `${w0} / ${h0}`;
        slot.style.shapeOutside = `polygon(${[...leftEdge, ...rightEdge].join(",")})`;
        // Pin the words in place. They are centred in the frame by their settled height; if they stayed centred
        // by CSS, the whole block (headline included) would jump up and down whenever the lines re-wrap round the
        // moving layer. Pinned, only the lines beside the layer move.
        const storyBox = stories.get(fi);
        storyBox.style.top = "0px";
        storyBox.style.transform = "none";
        storyBox.style.top = `${Math.round((size.h - storyBox.offsetHeight) / 2)}px`;
        const box = slot.getBoundingClientRect(); // (reading this lets the browser lay the text out round the new shape)
        const origin = root.getBoundingClientRect();
        slotAt[fi] = { cx: box.left + box.width / 2 - origin.left, cy: box.top + box.height * (0.5 + (SLOT_NUDGE[fi] || 0)) - origin.top, w: box.width, h: box.height };
        dxOf[fi] = (left + right) / 2 - size.w / 2;
        fitOf[fi] = Math.min(1, box.width / w0, box.height / h0);
        // remember the settled box (and where the words' flow starts), for the live wrap to go back to
        slotHome[fi] = { aspect: slot.style.aspectRatio, shape: slot.style.shapeOutside, top: box.top - origin.top - parseFloat(getComputedStyle(slot).marginTop) };
        // The words are centred by their height once the layer has LANDED (the words wrap a little differently
        // round the landed layer than round the empty box they are first laid out for). Work out that landed
        // wrap in advance: the layer's outline, shrunk and moved to where it will settle.
        const cx0 = (left + right) / 2;
        const cy0 = (top + bottom) / 2;
        reflowAround(fi, {
          xs: samplesX.map((x) => slotAt[fi].cx + (x - cx0) * fitOf[fi]),
          ys: samplesY.map((y) => slotAt[fi].cy + (y - cy0) * fitOf[fi]),
        });
        const landedTop = Math.round((size.h - storyBox.offsetHeight) / 2);
        const nudge = landedTop - parseFloat(storyBox.style.top);
        storyBox.style.top = `${landedTop}px`;
        slotHome[fi].top += nudge; // everything in the words' box moved with it
        slotAt[fi].cy += nudge;
        settleWrap(fi); // back to the empty box until the layer comes
      }
      dyKnown[fi] = true;
    }
    // Phones: while the layer is on the move, the words re-flow round it, moment by moment
    if (isPhone && storyOn && dyKnown[fi] && slotHome[fi]) {
      if (fs > 0.001 && fs < 0.999 && !wrapFrozen) {
        reflowAround(fi);
        liveWrap[fi] = "moving";
      } else if (fs >= 0.999 && liveWrap[fi] !== "landed" && !wrapFrozen) {
        reflowAround(fi); // one last exact reading where it has landed; after that the words simply stay put
        liveWrap[fi] = "landed";
      } else if (fs <= 0.001 && liveWrap[fi]) {
        settleWrap(fi); // gone again: back to the settled box and shape, ready for next time
        liveWrap[fi] = false;
      }
    }
    // For a layer with words, the others dissolve into the page colour so it stands alone with its words.
    // They stay solid the whole time (never see-through, so they never show through each other) and are
    // gone within the first moments of the layer sliding over.
    const dissolve = storyOn ? Math.min(1, fs / 0.28) : 0;
    const dissolveEased = dissolve * dissolve * (3 - 2 * dissolve);
    if (dissolve > 0) pageColor.set(getComputedStyle(document.body).backgroundColor);
    meshes.forEach((mesh, i) => {
      const u = mesh.material.uniforms;
      u.uDim.value = i === fi ? 0 : dimAmount;
      u.uGloss.value = i === fi ? glossAmount : 0;
      const gone = i !== fi && dissolveEased > 0 ? dissolveEased : 0;
      u.uFade.value = gone;
      if (gone > 0) u.uBg.value.set(pageColor.r, pageColor.g, pageColor.b);
      mesh.visible = gone < 0.995;
    });
    updateHaloColour();
    wobbleHalos();
    renderer.render(scene, camera);
  }

  // ---- Build the slabs once the photos have loaded ----
  const slabs = new Map();
  Promise.all(LAYERS.map((l) => loadImage(l.src))).then((images) => {
    LAYERS.forEach((layer, i) => {
      if (!slabs.has(layer.src)) {
        const { geometry, thickness, wallBand } = buildSlab(images[i], {
          thickness: layer.wall,
          elevation: ELEVATION,
          bevel: layer.bevel,
          sideColor: layer.side,
          soften: layer.soften || 0,
        });
        const wallTexture = new THREE.CanvasTexture(wallBand.canvas);
        wallTexture.colorSpace = THREE.SRGBColorSpace;
        wallTexture.wrapS = THREE.MirroredRepeatWrapping;
        wallTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const texture = new THREE.Texture(images[i]);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        texture.needsUpdate = true;
        const side = new THREE.Color(layer.side);
        const material = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms: {
            map: { value: texture },
            wallMap: { value: wallTexture },
            wallLength: { value: wallBand.length },
            wallHeight: { value: thickness },
            photoRight: { value: new THREE.Vector3(1, 0, 0) },
            photoUp: { value: new THREE.Vector3(0, Math.cos(ELEVATION), -Math.sin(ELEVATION)) },
            photoSize: { value: new THREE.Vector2(PHOTO_W, PHOTO_H) },
            toCamera: { value: viewDir.clone() },
            lightDir: { value: new THREE.Vector3(-0.4, 0.8, 0.5).normalize() },
            sideColor: { value: new THREE.Vector3(side.r, side.g, side.b) },
          },
        });
        slabs.set(layer.src, { geometry, material, thickness });
      }
    });

    // Stack them: each slab sits on the one below (heights are the top faces)
    rest = [0, 0, 0, 0];
    LAYERS.forEach((layer, i) => {
      const { geometry, material, thickness } = slabs.get(layer.src);
      geometry.computeBoundingBox();
      if (squareYaw[i] === undefined) {
        // Find the turn (up to 45 degrees either way) that makes the layer's outline the snuggest rectangle
        const pos = geometry.attributes.position;
        let best = 0;
        let bestArea = Infinity;
        for (let deg = -45; deg <= 45; deg += 0.5) {
          const c = Math.cos((deg * Math.PI) / 180);
          const sn = Math.sin((deg * Math.PI) / 180);
          let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
          for (let v = 0; v < pos.count; v += 3) {
            const x = pos.getX(v) * c + pos.getZ(v) * sn;
            const z = -pos.getX(v) * sn + pos.getZ(v) * c;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (z < z0) z0 = z;
            if (z > z1) z1 = z;
          }
          if ((x1 - x0) * (z1 - z0) < bestArea) {
            bestArea = (x1 - x0) * (z1 - z0);
            best = deg;
          }
        }
        squareYaw[i] = (best * Math.PI) / 180;
      }
      // Each layer gets its own copy of the material (sharing the textures), so one can fade on its own
      const own = material.clone();
      Object.keys(material.uniforms).forEach((k) => (own.uniforms[k] = material.uniforms[k]));
      own.uniforms.uAlpha = { value: 1 };
      own.uniforms.uFade = { value: 0 };
      own.uniforms.uBg = { value: new THREE.Vector3(1, 1, 1) };
      own.uniforms.uDim = { value: 0 };
      own.uniforms.uGloss = { value: 0 };
      own.uniforms.uSideFromTop = { value: layer.src.includes("bread") ? 0 : 1 };
      own.uniforms.uShine = { value: new THREE.Vector3(...(layer.shine || [0.2, 30, 1])) };
      const kb = geometry.boundingBox;
      own.uniforms.uKey = { value: 0 };
      own.uniforms.uKeyQ = { value: layer.key || 0 };
      own.uniforms.uShear = { value: new THREE.Vector2((kb.max.x - kb.min.x) / 2, (layer.shear || 0) * (kb.max.z - kb.min.z)) };
      own.uniforms.uKeyBox = { value: new THREE.Vector3((kb.min.x + kb.max.x) / 2, kb.max.z, kb.max.z - kb.min.z) };
      const mesh = new THREE.Mesh(geometry, own);
      // The gap the words leave around a layer: a flat page-coloured copy, a touch bigger, drawn first (so it is
      // always behind every layer) and it rides along with the layer. Over the words it reads as clear space.
      const halo = new THREE.Mesh(geometry, haloMaterial);
      halo.renderOrder = -10;
      halo.scale.setScalar(HALO);
      halo.position.set(((kb.min.x + kb.max.x) / 2) * (1 - HALO), ((kb.min.y + kb.max.y) / 2) * (1 - HALO), ((kb.min.z + kb.max.z) / 2) * (1 - HALO));
      halo.userData.centre = [(kb.min.x + kb.max.x) / 2, (kb.min.y + kb.max.y) / 2, (kb.min.z + kb.max.z) / 2];
      halos.push(halo);
      mesh.add(halo);
      mesh.scale.setScalar(layer.size);
      meshes.push(mesh);
      turntable.add(mesh);
      rest[i] = i === 0 ? 0 : rest[i - 1] + thickness * layer.size + GAP;
    });
    // The camera ends up looking at the middle of the finished stack
    stackCenter = (rest[3] - slabs.get(LAYERS[0].src).thickness) / 2;
    tl.invalidate();
    tl.progress(tl.progress());
    draw(0);
  });

  new ResizeObserver(resize).observe(root);
  resize();

  if (reduceMotion) {
    tl.progress(1);
    return { resize, setActive() {} };
  }

    ScrollTrigger.create({
    trigger: hero,
    // On phones the folder tabs sit at the top, so pin the hero just below them
    start: () => `top ${window.matchMedia("(max-width: 767px)").matches ? document.querySelector(".tabs").offsetHeight : 0}`,
    end: "+=180%",
    pin: true,
    scrub: 0.3, // light smoothing only: the page already smooths scrolling, and more would make it trail behind
    invalidateOnRefresh: true,
    animation: tl,
  });

  let visible = true;
  new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(root);
  gsap.ticker.add((time) => visible && draw(time));

  // ---- Tap a layer: it floats out to the front. Tap anywhere (or scroll) to put it back. ----
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const layerAt = (clientX, clientY) => {
    const rect = root.getBoundingClientRect();
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    return hit ? meshes.indexOf(hit.object) : -1;
  };

  let lines = [];
  let roll = { from: [], to: [] };
  let typing = null;
  let slide = null;
  const SLIDE_AT = 1.65; // seconds after the tap: the layer has just reached the middle, a beat later it moves over
  const typeWords = (i) => {
    typing?.kill();
    slide?.kill();
    wrapFrozen = false;
    lines = storyLines.get(i);
    roll = storyRolls.get(i);
    lines.flat().forEach((ch) => (ch.style.opacity = 0));
    gsap.set(roll.from, { yPercent: 0 });
    gsap.set(roll.to, { yPercent: 130, opacity: 1 });
    const [title, left, right] = lines;
    slide = gsap.to(story, { shift: 1, duration: 1.1, delay: SLIDE_AT, ease: "power2.inOut" });
    // as it moves over the words start typing from the left: the headline, then the two paragraphs, one after the other
    typing = gsap.timeline({ delay: SLIDE_AT + 0.25 })
      .to(title, { opacity: 1, duration: 0.01, stagger: 0.06 })
      // (on phones the first paragraph waits until the layer has slid past it, so the layer never crosses words that are being typed)
      .to(left, { opacity: 1, duration: 0.01, stagger: 0.022 }, isPhone ? 0.85 : ">0.15")
      .to(right, { opacity: 1, duration: 0.01, stagger: 0.016 }, ">0.2");
    // when everything is typed, the word rolls over once: the old letters roll up and out, the new ones roll up and in
    if (roll.to.length) {
      typing
        .to(roll.from, { yPercent: -130, duration: 0.45, ease: "power2.in", stagger: 0.05 }, ">0.7")
        .to(roll.to, { yPercent: 0, duration: 0.55, ease: "power3.out", stagger: 0.04 }, "<0.3");
    }
  };
  // Going back: first the words fade away where they are (the wrap is held still, so nothing jumps), and only
  // then does the layer start back, so it never sweeps through words that are still showing
  const LEAVE_AFTER = 0.3; // seconds the words take to go before the layer starts back
  const eraseWords = () => {
    wrapFrozen = true;
    slide?.kill();
    slide = gsap.to(story, { shift: 0, duration: 0.7, delay: LEAVE_AFTER, ease: "power2.inOut" });
    if (!typing) return;
    typing.kill();
    typing = gsap.to([...lines.flat(), ...roll.to], { opacity: 0, duration: LEAVE_AFTER, ease: "power1.out", overwrite: true });
  };

  let scrollAtFocus = 0;
  // The layer travels out along its path (slide, half-circle, turn) as `amount` goes 0 -> 1, and home again
  // along the same path as it goes 1 -> 0.
  let focusTl = null;
  const release = () => {
    if (focus.i < 0) return;
    eraseWords();
    focusTl?.kill();
    focusTl = gsap.timeline({ onComplete: () => (focus.i = -1) }).to(focus, { amount: 0, duration: 1.2, delay: LEAVE_AFTER, ease: "sine.inOut" });
  };
  const bringToFront = (i) => {
    scrollAtFocus = window.scrollY;
    const go = () => {
      focus.i = i;
      if (backdrop) backdrop.style.background = WASH[i];
      focusTl?.kill();
      focusTl = gsap.timeline().to(focus, { amount: 1, duration: 1.4, ease: "sine.inOut" });
      if (stories.has(i)) typeWords(i);
    };
    if (focus.i >= 0 && focus.i !== i) {
      eraseWords();
      focusTl?.kill();
      focusTl = gsap.timeline({ onComplete: go }).to(focus, { amount: 0, duration: 1, ease: "power1.inOut" });
    } else go();
  };
  // Scrolling puts the layer back, so the sandwich can carry on building itself
  window.addEventListener("scroll", () => {
    if (focus.i >= 0 && Math.abs(window.scrollY - scrollAtFocus) > 12) release();
  }, { passive: true });

  // A tap is a quick press that barely moves. A scroll or drag is not a tap.
  let down = null;
  root.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY, t: performance.now() }));
  root.addEventListener("pointerup", (e) => {
    if (!down) return;
    const tap = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10 && performance.now() - down.t < 600;
    down = null;
    if (!tap) return;
    const i = layerAt(e.clientX, e.clientY);
    if (i < 0 || i === focus.i) release();
    else bringToFront(i);
  });
  root.addEventListener("pointercancel", () => (down = null));
  // Show a pointing hand over the layers (mouse only)
  root.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") root.style.cursor = layerAt(e.clientX, e.clientY) >= 0 ? "pointer" : "default";
  });

  // ---- One scroll, one step ----
  // While the sandwich is still floating apart, the page does not scroll. Each scroll (wheel, swipe, or
  // arrow/space key) does ONE thing, which then plays by itself:
  //   scroll: the next layer travels up to the middle, slides to the side and its words roll in
  //   scroll: that layer travels back to its place
  // ...for the top bread, peanut butter, jelly and bottom bread in turn. After the last layer is back, the next
  // scroll lets the page scroll normally, which builds the sandwich and spins it (as it used to). Scrolling
  // back up to the top steps through it all in reverse.
  let stepsOn = true; // switched off while another tab is showing (or while the hero opening plays)
  let done = 0; // how many layers have had their turn (while none is up)
  let lockedUntil = 0;
  const hold = (seconds) => (lockedUntil = performance.now() + seconds * 1000);
  const atTop = () => window.scrollY <= 2;
  const stepsActive = () => stepsOn && !document.documentElement.classList.contains("intro") && !hero.closest(".panel")?.hidden && atTop();
  // all four have had their turn (true as soon as the last one is sent back, even while it is still on its way)
  const allDone = () => done >= STORY_ORDER.length;

  // dir: 1 = forward, -1 = back
  const act = (dir) => {
    if (performance.now() < lockedUntil) return;
    if (focus.i >= 0) {
      // a layer is up (from a step or a tap): send it back; it counts as done only if we are going forward
      const idx = STORY_ORDER.indexOf(focus.i);
      release();
      if (idx >= 0) done = dir > 0 ? idx + 1 : idx;
      hold(1.5 + LEAVE_AFTER);
    } else if (dir > 0 && done < STORY_ORDER.length) {
      bringToFront(STORY_ORDER[done]);
      hold(3);
    } else if (dir < 0 && done > 0) {
      done -= 1;
      bringToFront(STORY_ORDER[done]);
      hold(3);
    }
  };

  // Tell a new scroll from the tail end of the last one: a trackpad keeps sending small wheel events for a
  // second or so after your fingers lift, and those must not count as another scroll
  let lastWheelAt = 0;
  let lastWheelSize = 0;
  const isFreshWheel = (e) => {
    const now = performance.now();
    const size = Math.abs(e.deltaY);
    const fresh = now - lastWheelAt > 160 || (size > 40 && size > lastWheelSize * 1.8);
    lastWheelAt = now;
    lastWheelSize = size;
    return fresh;
  };
  // (capture phase, so the smooth-scroll library never sees a scroll that is being used as a step)
  const swallow = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  window.addEventListener(
    "wheel",
    (e) => {
      if (!stepsOn || document.documentElement.classList.contains("intro")) return;
      const fresh = isFreshWheel(e);
      if (!stepsActive() || e.ctrlKey || !e.deltaY) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      if (dir > 0 && allDone()) {
        // all four have had their turn: the page scrolls and builds the sandwich. Only the tail end of the
        // very scroll that sent the last layer back is held off; any new scroll goes straight through
        if (!fresh && performance.now() < lockedUntil) return swallow(e);
        return;
      }
      swallow(e);
      if (fresh) act(dir);
    },
    { passive: false, capture: true }
  );

  // Phones and tablets: a swipe is a step too
  let touchY = null;
  window.addEventListener("touchstart", (e) => (touchY = e.touches[0].clientY), { passive: true, capture: true });
  window.addEventListener(
    "touchmove",
    (e) => {
      if (touchY === null || !stepsActive()) return;
      const dir = touchY - e.touches[0].clientY > 0 ? 1 : -1;
      if (dir > 0 && allDone()) return; // let the page scroll
      if (e.cancelable) e.preventDefault();
    },
    { passive: false, capture: true }
  );
  window.addEventListener(
    "touchend",
    (e) => {
      if (touchY === null) return;
      const dy = touchY - e.changedTouches[0].clientY;
      touchY = null;
      if (!stepsActive() || Math.abs(dy) < 40) return;
      const dir = dy > 0 ? 1 : -1;
      if (dir > 0 && allDone()) return;
      act(dir);
    },
    { passive: true, capture: true }
  );

  // Keys: arrows, page keys and space
  window.addEventListener(
    "keydown",
    (e) => {
      if (!stepsActive() || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName)) return;
      const forward = e.key === "ArrowDown" || e.key === "PageDown" || (e.key === " " && !e.shiftKey);
      const back = e.key === "ArrowUp" || e.key === "PageUp" || (e.key === " " && e.shiftKey);
      if (!forward && !back) return;
      if (forward && allDone()) return; // let the page scroll
      e.preventDefault();
      act(forward ? 1 : -1);
    },
    { capture: true }
  );

  return {
    resize,
    // the page tells us when another tab is showing, so the home page's scroll steps stand down
    setActive(on) {
      stepsOn = on;
    },
    // The hero opening (see heroOpen.js): hide the sandwich now, play the rest later
    opening,
    // Before the opening plays: work out, off screen, where the sandwich settles once its layers are apart, so the
    // picture does not slide around while it grows
    settle() {
      const saved = { ...opening };
      const t0 = lastTime;
      const render = renderer.render;
      renderer.render = () => {};
      settling = true;
      opening.zoom = 1;
      opening.apart = 1;
      measureTick = 0;
      for (let i = 0; i < 90; i++) {
        measureTick = i % 8 === 0 ? 0 : measureTick;
        draw(t0 + (i + 1) / 60, i === 0);
      }
      renderer.render = render;
      settling = false;
      Object.assign(opening, saved);
      lastTime = t0;
      apartDoneAt = null;
      springs.forEach((sp) => (sp.ready = false));
    },
    hold(on) {
      stepsOn = !on;
    },

  };
}
