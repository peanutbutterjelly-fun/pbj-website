import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createCutWord, cutVersion, CAP_EM } from "./cutword.js";

// Loading intro:
// 1. Jelly-purple screen with "OOZE THE / FUN" in our headline style
// 2. The whole screen twists and gets sucked into a gooey hole in the middle (like a jelly black hole)
// 3. The page swirls back out of that hole, with a wobbly, gooey edge, until it fills the screen

// Twirl shader: content spins faster near the centre and shrinks into a wobbling, spiralling disc
const swirlShader = {
  uniforms: {
    tex: { value: null },
    progress: { value: 0 },
    time: { value: 0 },
    aspect: { value: 1 },
    jelly: { value: new THREE.Vector3() },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tex;
    uniform float progress;
    uniform float time;
    uniform float aspect;
    uniform vec3 jelly;
    varying vec2 vUv;

    void main() {
      float p = progress;
      if (p < 0.0005) { gl_FragColor = vec4(texture2D(tex, vUv).rgb, 1.0); return; } // untouched: show the picture as is
      vec2 d = (vUv - 0.5) * vec2(aspect, 1.0);
      float r = length(d);
      float a = atan(d.y, d.x);

      // Sucked in: the picture shrinks towards the centre and twists harder near the middle
      float shrink = 1.0 / max(1.0 - p * 0.97, 0.03);
      float twist = p * 3.0 + p * p * 14.0 * exp(-r * 3.0);
      float sa = a + twist;
      vec2 sd = vec2(cos(sa), sin(sa)) * r * shrink;
      vec2 suv = sd / vec2(aspect, 1.0) + 0.5;

      vec3 col = jelly;
      if (suv.x > 0.0 && suv.x < 1.0 && suv.y > 0.0 && suv.y < 1.0) col = texture2D(tex, suv).rgb;

      // Gooey edge: the jelly disc shrinks, wobbles and spirals as it goes
      float edge = mix(1.25, 0.0, smoothstep(0.0, 1.0, p));
      edge *= 1.0 + 0.10 * p * sin(a * 3.0 + twist * 0.8 - time * 5.0)
                  + 0.05 * p * sin(a * 7.0 - time * 7.0);
      float alpha = 1.0 - smoothstep(edge - 0.015, edge, r);

      gl_FragColor = vec4(col * alpha, alpha);
    }
  `,
};

export function playIntro({ lenis, onDone = () => {} }) {
  const html = document.documentElement;
  if (!html.classList.contains("intro")) return onDone();

  const site = document.getElementById("site");
  const overlay = document.querySelector(".intro-overlay");
  const text = overlay.querySelector("p");
  // The loading text is paper-cut vector lettering (see cutword.js). The hidden <p> only tells us how big it should
  // be (its font size comes from the CSS, per screen size); the same lettering is painted into the swirl below.
  const fontPx = parseFloat(getComputedStyle(text).fontSize);
  const NS = "http://www.w3.org/2000/svg";
  const textSvg = document.createElementNS(NS, "svg");
  textSvg.setAttribute("aria-hidden", "true");
  textSvg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;overflow:visible";
  overlay.append(textSvg);
  const cutLines = text.innerHTML.split(/<br\s*\/?>/i).map((line) => createCutWord(line.replace(/<[^>]+>/g, "").trim().toUpperCase(), { fill: "var(--cream)", shadow: "var(--brown)" }));
  cutLines.forEach((w, i) => {
    textSvg.append(w.el);
    // two centred lines ("OOZE THE" / "FUN"), one font size apart like our headlines
    const cy = window.innerHeight / 2 + (i - (cutLines.length - 1) / 2) * fontPx;
    w.place(window.innerWidth / 2 - (w.widthEm * fontPx) / 2, cy - (CAP_EM * fontPx) / 2, fontPx);
  });
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  lenis.stop();
  window.scrollTo(0, 0);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = vw / 2;
  const cy = vh / 2;

  // ---- The page's gooey "hole" it swirls out of ----
  const hole = { r: 0, wobble: 1, spin: 0 };
  const maxR = Math.hypot(vw, vh) / 2 + 40;
  const top = site.getBoundingClientRect().top; // the page sits still while the intro plays: measure once, not every frame
  function drawHole(t = 0) {
      const pts = [];
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const wob =
        1 + hole.wobble * (0.09 * Math.sin(a * 3 + hole.spin * 2 - t * 5) + 0.05 * Math.sin(a * 7 + t * 7));
      const r = hole.r * wob;
      pts.push(`${(cx + Math.cos(a) * r).toFixed(1)} ${(cy - top + Math.sin(a) * r).toFixed(1)}`);
    }
    site.style.clipPath = `path("M${pts.join(" L")} Z")`;
  }
  drawHole();

  // Each piece of the page spins and grows around the centre of the screen
  const layers = [...site.children];
  const originFor = (el) => {
    const r = el.getBoundingClientRect();
    return `${cx - r.left}px ${cy - r.top}px`;
  };

  let cleanupSwirl = () => {};
  const finish = () => {
    cutLines.forEach((w) => w.dispose());
    cleanupSwirl();
    html.classList.remove("intro");
    gsap.set(site, { clearProps: "clipPath" });
    gsap.set(layers, { clearProps: "transform,transformOrigin,willChange" });
    try {
      sessionStorage.setItem("pbj-intro", "1");
    } catch (e) {}
    lenis.start();
    ScrollTrigger.refresh();
    onDone();
  };

  if (reduceMotion) {
    gsap.set(site, { clearProps: "clipPath" });
    gsap.timeline({ onComplete: finish }).to(overlay, { opacity: 0, duration: 0.4, delay: 1 });
    return;
  }

  layers.forEach((el) => {
    gsap.set(el, { rotate: -160, scale: 0.25, transformOrigin: originFor(el), force3D: true });
    el.style.willChange = "transform";
  });

  // ---- A twistable copy of the loading screen, drawn on top of it ----
  const dpr = Math.min(window.devicePixelRatio, 2);
  const canvas = document.createElement("canvas");
  canvas.className = "intro-swirl";
  canvas.style.visibility = "hidden";
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
  renderer.setPixelRatio(dpr);
  renderer.setSize(vw, vh, false);

  // The picture is exactly as big as the screen's pixels, with no mip-mapping, so the first frame of the swirl
  // matches the real lettering pixel for pixel (no blur when we swap from the real text to the swirl)
  const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
  const pic = document.createElement("canvas");
  pic.width = buf.x;
  pic.height = buf.y;
  const picTexture = new THREE.CanvasTexture(pic);
  picTexture.generateMipmaps = false;
  picTexture.minFilter = THREE.LinearFilter;
  picTexture.magFilter = THREE.LinearFilter;
  const picScale = buf.x / vw;

  const material = new THREE.ShaderMaterial({ ...swirlShader, transparent: true, premultipliedAlpha: true });
  material.uniforms = THREE.UniformsUtils.clone(swirlShader.uniforms);
  material.uniforms.tex.value = picTexture;
  material.uniforms.aspect.value = vw / vh;
  // Pass the jelly colour straight through (no colour conversion) so it matches the page exactly
  const [r, g, b] = getComputedStyle(overlay).backgroundColor.match(/\d+/g).map(Number);
  material.uniforms.jelly.value.set(r / 255, g / 255, b / 255);
  const swirl = material.uniforms.progress;
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  const camera = new THREE.Camera();

  // Paint the loading screen (purple + text, exactly where the real text sits) into the picture
  function paintPicture() {
    const ctx = pic.getContext("2d");
    ctx.setTransform(picScale, 0, 0, picScale, 0, 0);
    ctx.fillStyle = getComputedStyle(overlay).backgroundColor;
    ctx.fillRect(0, 0, vw, vh);
    cutLines.forEach((w) => w.paint(ctx));
    picTexture.needsUpdate = true;
  }

  let paintedVersion = -1;
  const tick = (time) => {
    material.uniforms.time.value = time;
    // the letters keep wobbling while the screen is sucked in: repaint the picture whenever they take a new wobble
    if (canvas.style.visibility !== "hidden" && cutVersion() !== paintedVersion) {
      paintedVersion = cutVersion();
      paintPicture();
    }
    if (canvas.style.visibility !== "hidden") renderer.render(scene, camera);
    drawHole(time);
  };
  gsap.ticker.add(tick);

  function swapToSwirl() {
    paintPicture();
    canvas.style.visibility = "visible";
    overlay.style.visibility = "hidden";
    renderer.render(scene, camera);
  }

  cleanupSwirl = () => {
    gsap.ticker.remove(tick);
    picTexture.dispose();
    material.dispose();
    renderer.dispose();
    canvas.remove();
  };

  const tl = gsap.timeline({ onComplete: finish });
  if (import.meta.env.DEV) window.introTl = tl; // handy for testing in the browser
  tl
    // 1. "Ooze the fun" on jelly purple
    .from(text, { opacity: 0, duration: 0.4 })
    // 2. Sucked into the gooey hole
    .call(swapToSwirl, null, 1.4)
    .to(swirl, { value: 1, duration: 1.3, ease: "power2.in" }, 1.4)
    // 3. The page swirls back out of the hole
    .to(hole, { r: maxR, duration: 1.5, ease: "power2.inOut" }, 2.5)
    .to(hole, { spin: 4, duration: 1.5, ease: "power1.out" }, 2.5)
    .to(hole, { wobble: 0, duration: 0.6, ease: "power1.in" }, 3.4)
    .to(layers, { rotate: 0, scale: 1, duration: 1.5, ease: "power3.out" }, 2.5);
}
