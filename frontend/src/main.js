import "./style.css";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { setupTabs } from "./tabs.js";
import { createMascot } from "./mascot.js";
import { playIntro } from "./intro.js";
import { playHeroOpen } from "./heroOpen.js";
import { setupHosts } from "./hosts.js";
import { setupEvents } from "./events.js";
import { createCutLetter } from "./cutword.js";

gsap.registerPlugin(ScrollTrigger);

// Smooth scrolling on computers. On phones Lenis leaves normal touch scrolling alone (its default).
const lenis = new Lenis();
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
if (import.meta.env.DEV) window.lenis = lenis; // handy for testing in the browser

const mascot = createMascot(document.querySelector(".mascot"));
// The sandwich starts out tiny and assembled; the hero opening (after the loading screen) grows it and floats the layers apart
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!reduceMotion) Object.assign(mascot.opening, { zoom: 0.001, apart: 0 });
const heroOpen = playHeroOpen({ hero: document.querySelector(".hero"), mascot, lenis });
// Heavy background work (the About letters) waits until the loading screen and the sandwich opening are both finished, so they never stutter
let introDone;
const afterIntro = new Promise((res) => (introDone = res));
playIntro({ lenis, onDone: () => heroOpen.start(introDone) });

setupEvents(document.querySelector('[data-panel="events"]')); // the paper-cut headline (the old ticket lineup is parked in events.js, unused for now)
const hosts = setupHosts(document.querySelector('[data-panel="hosts"]'));

setupTabs({
  onSwitch(name) {
    if (name === "hosts") hosts.show();
    else hosts.hide();
    lenis.scrollTo(0, { immediate: true });
    mascot.setActive(name === "home");
    if (name === "home") mascot.resize();
  },
});

// "Join the list" jumps smoothly to the signup
document.querySelectorAll('a[href^="#"]').forEach((link) =>
  link.addEventListener("click", (e) => {
    e.preventDefault();
    lenis.scrollTo(link.getAttribute("href"), { offset: -40 });
  })
);

// Signups aren't connected yet (that's a later step)
document.querySelector(".signup-form").addEventListener("submit", (e) => {
  e.preventDefault();
  document.querySelector(".form-note").hidden = false;
});

// About: the PBJ letters are heavy, so they load quietly in the background a few seconds after the page opens
// (or at once if someone opens About first). They stay invisible until all three are ready, then fade in together.
{
  const about = document.querySelector('[data-panel="about"]'), frame = about?.querySelector(".about-pbj"), note = about?.querySelector(".about-pbj-note");
  const load = () => { if (frame && !frame.src) frame.src = frame.dataset.src; };
  if (about) {
    addEventListener("message", (e) => {
      if (e.data !== "pbj-ready") return;
      if (note) note.hidden = true;
      frame.classList.add("ready");
    });
    if (!about.hidden) load();
    new MutationObserver(() => { if (!about.hidden) load(); }).observe(about, { attributes: true, attributeFilter: ["hidden"] });
    const preload = () => (window.requestIdleCallback ? requestIdleCallback(load, { timeout: 4000 }) : load());
    afterIntro.then(() => setTimeout(preload, 1500));
  }
}

// About: the words roll up line by line, each line rising out of its own clipped box
{
  const about = document.querySelector('[data-panel="about"]'), h2 = about?.querySelector(".about-hero h2");
  if (h2) {
    const original = h2.innerHTML;
    h2.setAttribute("aria-label", h2.textContent.replace(/\s+/g, " ").trim());
    let letters = [];
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const split = () => {
      letters.forEach((l) => l.dispose());
      letters = [];
      h2.innerHTML = original;
      // one span per word (the highlighted phrase is cloned per word so it can break across lines)
      const words = [];
      let gap = false;
      const walk = (node, wrap) => {
        [...node.childNodes].forEach((n) => {
          if (n.nodeType === 3) {
            n.textContent.split(/(\s+)/).forEach((t) => {
              if (!t) return;
              if (/^\s+$/.test(t)) { gap = true; return; }
              const w = document.createElement("span");
              w.className = "w";
              // paper-cut letters, like the layer titles on Home (the highlighted phrase wears strawberry)
              [...t].forEach((ch) => {
                const letter = createCutLetter(ch, { fill: wrap ? "var(--strawberry)" : "var(--crust)", shadow: "var(--brown)" });
                if (letter) { letters.push(letter); w.append(letter.el); } else w.append(document.createTextNode(ch));
              });
              w.setAttribute("aria-hidden", "true");
              w.dataset.gap = gap ? "1" : ""; gap = false;
              if (wrap) { const m = wrap.cloneNode(false); m.appendChild(w); m.dataset.gap = w.dataset.gap; words.push(m); } else words.push(w);
            });
          } else walk(n, n.nodeName === "MARK" ? n : wrap);
        });
      };
      walk(h2, null);
      h2.textContent = "";
      words.forEach((w) => { if (w.dataset.gap) h2.appendChild(document.createTextNode(" ")); h2.appendChild(w); });
      // group the words by the line they landed on
      const lines = [];
      words.forEach((w) => {
        if (w.nodeType !== 1) return;
        const top = w.offsetTop;
        const last = lines[lines.length - 1];
        if (last && Math.abs(last.top - top) < 4) last.items.push(w); else lines.push({ top, items: [w] });
      });
      h2.textContent = "";
      lines.forEach((l, i) => {
        const box = document.createElement("span"), inner = document.createElement("span");
        box.className = "roll-line"; inner.className = "roll-in";
        inner.style.setProperty("--i", i);
        // a word with no space before it (like a comma) sticks to the word before it, so justifying never pulls them apart
        let unit = null;
        l.items.forEach((w) => {
          if (unit && !w.dataset.gap) { unit.appendChild(w); return; }
          unit = document.createElement("span");
          unit.className = "unit";
          unit.appendChild(w);
          inner.appendChild(unit);
        });
        box.appendChild(inner); h2.appendChild(box);
      });
      h2.classList.toggle("rolled", !about.hidden && !reduce.matches);
      if (reduce.matches) h2.classList.add("rolled");
    };
    const play = () => {
      if (about.hidden) { h2.classList.remove("rolled"); return; }
      h2.classList.remove("rolled");
      requestAnimationFrame(() => requestAnimationFrame(() => h2.classList.add("rolled")));
    };
    let ready = false;
    new MutationObserver(() => { if (!ready && !about.hidden) { split(); ready = true; } play(); }).observe(about, { attributes: true, attributeFilter: ["hidden"] });
    let t;
    addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => { if (ready && !about.hidden) split(); }, 200); });
  }
}
