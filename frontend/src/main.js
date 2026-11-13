import "./style.css";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { setupTabs } from "./tabs.js";
import { createMascot } from "./mascot.js";
import { playIntro } from "./intro.js";
import { playHeroOpen } from "./heroOpen.js";
import { setupHosts } from "./hosts.js";
import { setupEvents, setupLoop } from "./events.js";
import { setupTopbar } from "./topbar.js";
import { createCutLetter } from "./cutword.js";
import { setupAboutWho } from "./aboutWho.js";
import { setupAboutStory } from "./aboutStory.js";
import glyphData from "./glyphs.json";

gsap.registerPlugin(ScrollTrigger);
window.addEventListener("scroll", () => ScrollTrigger.update(), { passive: true }); // belt and braces: any scroll, however it happens (scrollbar, keys), moves the scroll-driven effects
ScrollTrigger.config({ ignoreMobileResize: true }); // phone address bar sliding must not re-measure and jolt the page

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
setupLoop(document.querySelector('[data-panel="list"]'), lenis); // the looping sections at the top of List Your Event
const hosts = setupHosts(document.querySelector('[data-panel="hosts"]'));

setupTopbar();
setupTabs({
  onSwitch(name) {
    document.documentElement.dataset.page = name; // (the phone's top bar lets List Your Event's colours show through)
    if (name === "hosts") hosts.show();
    else hosts.hide();
    lenis.scrollTo(0, { immediate: true, force: true }); // (force: List Your Event may be holding Lenis still while a folder is being left)
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

// About: the PBJ letters are heavy (three 3D scenes built from photos), so a light picture of them shows at once and the
// 3D ones come in over it. On computers they load quietly a few seconds after the page opens (or at once if someone opens
// About first). On phones they wait until someone touches the letters, so the page stays quick and the text animates smoothly.
{
  const about = document.querySelector('[data-panel="about"]'), frame = about?.querySelector(".about-pbj"), still = about?.querySelector(".about-pbj-still"), box = about?.querySelector(".about-image");
  const load = () => { if (frame && !frame.src) frame.src = frame.dataset.src; };
  if (about && frame) {
    const lite = matchMedia("(pointer: coarse)").matches; // only touch screens wait for a tap; a narrow window on a computer loads the 3D letters like any other
    addEventListener("message", (e) => {
      if (e.data !== "pbj-ready") return;
      frame.classList.add("ready");
      still?.classList.add("gone");
    });
    if (lite) {
      box?.addEventListener("pointerdown", load, { once: true });
    } else {
      if (!about.hidden) load();
      new MutationObserver(() => { if (!about.hidden) load(); }).observe(about, { attributes: true, attributeFilter: ["hidden"] });
      const preload = () => (window.requestIdleCallback ? requestIdleCallback(load, { timeout: 4000 }) : load());
      if (document.readyState === "complete") setTimeout(preload, 3000);
      else addEventListener("load", () => setTimeout(preload, 3000), { once: true });
    }
  }
}

setupAboutWho(document.querySelector('[data-panel="about"]')); // the second frame of About: WHO'S COOKING?
setupAboutStory(document.querySelector('[data-panel="about"]')); // the founders and the journey, under it

// About: the words roll up line by line, each line rising out of its own clipped box
{
  const about = document.querySelector('[data-panel="about"]'), h2 = about?.querySelector(".about-hero h2");
  if (h2) {
    const original = h2.innerHTML;
    h2.setAttribute("aria-label", h2.textContent.replace(/\s+/g, " ").trim());
    let letters = [], slots = [], colorTween = null, lastW = 0;
    // the first three words wear the sandwich colours: PEANUT dark yellow, BUTTER light yellow, JELLY red
    const TINTS = ["var(--pop)", "var(--peanut)", "var(--strawberry)"];
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    // Same roll as "[Coming soon]" on Home: the brown letters roll up and out one by one while a coloured copy
    // rolls up and in from below, each word a beat after the one before. These are the resting positions.
    const setColours = (done) => {
      slots.forEach((s) => { gsap.set(s.from, { yPercent: done ? -150 : 0 }); gsap.set(s.to, { yPercent: done ? 0 : 150 }); });
      if (everyone) { const d = reduce.matches || everyDone; gsap.set(everyone.from, { yPercent: d ? -150 : 0 }); gsap.set(everyone.to, { yPercent: d ? 0 : 150 }); }
    };
    // EVERYONE turns red with the same roll, right after the ARTISTS board has finished and landed
    let everyone = null, everyDone = false, everyTl = null;
    const rollEveryone = () => {
      if (!everyone || everyDone || about.hidden) return;
      everyDone = true;
      everyTl?.kill();
      everyTl = gsap.timeline()
        .to(everyone.from, { yPercent: -150, duration: 0.45, ease: "power2.in", stagger: 0.05 }, 0)
        .to(everyone.to, { yPercent: 0, duration: 0.55, ease: "power3.out", stagger: 0.04 }, 0.3);
    };
    const rollColours = () => {
      colorTween?.kill();
      setColours(reduce.matches);
      if (reduce.matches) return;
      colorTween = gsap.timeline();
      slots.forEach((s, i) => {
        const at = 1.1 + i * 0.35;
        colorTween.to(s.from, { yPercent: -150, duration: 0.45, ease: "power2.in", stagger: 0.05 }, at)
          .to(s.to, { yPercent: 0, duration: 0.55, ease: "power3.out", stagger: 0.04 }, at + 0.3);
      });
    };
    // "ARTISTS," is a board whose letters roll one by one with the split-text roll (the same as the page's other
    // rolling words). The board is as wide as the longest word from the very start, so the heading never shifts, and
    // every word is drawn at the heading's own size, starting at the left of the board. When the board has landed
    // on ARTISTS, the real word takes over at once.
    const FLIP_WORDS = ["Painter", "Potter", "Photographer", "Cinematographer", "Installation Artist", "Sculptor", "Muralist", "Printmaker", "Illustrator", "Abstract Designer", "Performance Artist", "Textile Artist", "Writer", "Author", "Publisher", "Editor", "Chef", "Culinary Artist", "Musician", "Composer", "Actor", "Theatre Artist", "Choreographer", "Marketing Expert", "Community Organiser", "&", "YOU"];
    const FINAL = "Artists,";
    const SPACE = 0.3; // a space between two words, in heading-letter sizes
    // Letters are placed exactly where the heading's own text would put them (each letter's own width, a hair tighter),
    // so the words look like the rest of the heading. Everything here is in em (the heading's letter size).
    const stepOf = (ch) => (ch === " " ? SPACE : glyphData.glyphs[ch]?.adv ? glyphData.glyphs[ch].adv / 1000 - 0.045 : 0.5);
    const wordEm = (w) => [...w.toUpperCase()].reduce((x, ch) => x + stepOf(ch), 0);
    const BOARD = Math.max(wordEm(FINAL), ...FLIP_WORDS.map(wordEm)); // the board is as wide as the longest word
    const placeWord = (w) => { // each letter's left edge; the word starts at the left of the board, or ends at its right edge when the board closes its line (see `flip.right`)
      let x = flip?.right ? BOARD - wordEm(w) : 0;
      return [...w.toUpperCase()].map((ch) => { const at = x; x += stepOf(ch); return { ch, at }; }).filter((l) => l.ch !== " ");
    };
    const SLOW = [0.2, 0.3, 0.4, 0.55, 0.75]; // the last words before the landing get longer rests
    let flip = null, flipTl = null, flipWait = null, onBoard = [];
    // a letter in its own little layer on the board, so it can roll in or out on its own
    const makeLayer = (ch, at, fill = "var(--crust)") => {
      const el = document.createElement("span");
      el.className = "ltr";
      el.style.left = `${at}em`;
      const letter = createCutLetter(ch, { fill, shadow: "var(--brown)" });
      if (letter) el.append(letter.el); else el.append(document.createTextNode(ch));
      return { el, letter };
    };
    const dropLayer = (l) => { l?.letter?.dispose(); l?.el.remove(); };
    const clearFlip = () => {
      onBoard = [];
      if (!flip) return;
      [...flip.wrap.children].forEach((k) => { gsap.killTweensOf(k); k.remove(); });
      gsap.set(flip.wrap, { autoAlpha: 0 });
      gsap.set(flip.base, { autoAlpha: 1 });
    };
    // (the letters' own wobble loops are released with their layers; clearFlip also covers letters still mid-roll)
    const stopFlipLetters = () => { onBoard.forEach(dropLayer); onBoard = []; };
    const stopFlip = () => { flipWait?.kill(); flipTl?.kill(); flipWait = flipTl = null; onBoard.forEach(dropLayer); clearFlip(); };
    // The split-text roll, one word at a time and never two words at once: first every letter of the word on the board
    // rolls up and out (left to right), and only when the last one has left do the next word's letters roll in.
    const rollOut = (l, dur) => gsap.to(l.el, { yPercent: -120, duration: dur, ease: "power2.in", onComplete: () => dropLayer(l) });
    const rollIn = (ch, at, dur, fill) => {
      const l = makeLayer(ch, at, fill);
      flip.wrap.append(l.el);
      gsap.fromTo(l.el, { yPercent: 120 }, { yPercent: 0, duration: dur, ease: "power3.out" });
      onBoard.push(l);
    };
    const startFlip = () => {
      stopFlip();
      if (!flip || reduce.matches || about.hidden) return;
      gsap.set(flip.wrap, { autoAlpha: 1 });
      gsap.set(flip.base, { autoAlpha: 0 });
      placeWord(FINAL).forEach(({ ch, at }) => { const l = makeLayer(ch, at); flip.wrap.append(l.el); onBoard.push(l); }); // the board starts out showing ARTISTS,
      flipTl = gsap.timeline();
      const seq = FLIP_WORDS.concat([FINAL]), tail = SLOW.length;
      let nOut = onBoard.length, at = 0.4;
      seq.forEach((word, i) => {
        const last = i === seq.length - 1, dur = last ? 0.4 : 0.1, stag = last ? 0.05 : 0.008;
        const ins = placeWord(word);
        flipTl.call(() => { onBoard.splice(0).forEach((l, n) => gsap.delayedCall(n * stag, () => rollOut(l, dur))); }, null, at);
        at += (nOut - 1) * stag + dur; // the old word has completely gone
        const fill = last ? "var(--crust)" : i % 2 === 0 ? "var(--pop)" : "var(--peanut)"; // ARTISTS stays brown; the other words alternate dark and light yellow
        ins.forEach(({ ch, at: x }, n) => flipTl.call(() => rollIn(ch, x, dur, fill), null, at + n * stag));
        at += (ins.length - 1) * stag + dur; // the new word is fully in
        at += last ? 0 : i >= seq.length - 1 - tail ? SLOW[i - (seq.length - 1 - tail)] : 0.3; // every word rests as long as the words from Choreographer on (those slow down a little more towards the end)
        nOut = ins.length;
      });
      flipTl.call(() => { // the board has landed on ARTISTS, exactly where the real word is: swap at once, so there is no blink
        stopFlipLetters();
        gsap.set(flip.base, { autoAlpha: 1 });
        gsap.set(flip.wrap, { autoAlpha: 0 });
        clearFlip();
      }, null, at + 0.35);
      flipTl.call(rollEveryone, null, at + 0.8); // and only then does EVERYONE turn red
    };
    const split = (replay = true) => {
      letters.forEach((l) => l.dispose());
      letters = [];
      colorTween?.kill();
      everyTl?.kill();
      stopFlip();
      flip = null;
      slots = [];
      everyone = null;
      if (replay) everyDone = false;
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
              // paper-cut letters, like the layer titles on Home
              const make = (fill, text = t) => {
                const w = document.createElement("span"), els = [];
                w.className = "w";
                [...text].forEach((ch) => {
                  const letter = createCutLetter(ch, { fill, shadow: "var(--brown)" });
                  if (letter) { letters.push(letter); w.append(letter.el); els.push(letter.el); } else w.append(document.createTextNode(ch));
                });
                w.setAttribute("aria-hidden", "true");
                w.dataset.gap = gap ? "1" : "";
                return { w, els };
              };
              const art = !wrap && !flip && /^artists[^a-z]*$/i.test(t);
              if (art) {
                // ARTISTS, gets a board as wide as the longest word, ready from the start (the real word sits on top of it)
                const core = make("var(--crust)", t);
                core.w.classList.add("flip-base");
                const slot = document.createElement("span"), board = document.createElement("span");
                slot.className = "flip-slot";
                slot.dataset.gap = core.w.dataset.gap;
                board.className = "flip-cells";
                board.setAttribute("aria-hidden", "true");
                slot.style.width = `${BOARD}em`; // reserved from the start: as wide as the longest word
                slot.append(board, core.w);
                flip = { slot, base: core.w, wrap: board };
                gap = false;
                words.push(slot);
                return;
              }
              const base = make("var(--crust)");
              let item = base.w;
              const isEveryone = !wrap && !everyone && /^everyone[^a-z]*$/i.test(t);
              if ((slots.length < 3 && !wrap) || isEveryone) {
                // the first three words (and EVERYONE) get a coloured twin that waits below, to roll in over the brown one
                const twin = make(isEveryone ? "var(--strawberry)" : TINTS[slots.length]);
                twin.w.classList.add("w-to");
                if (isEveryone) everyone = { from: base.els, to: twin.els }; else slots.push({ from: base.els, to: twin.els });
                item = document.createElement("span");
                item.className = "roll-slot";
                item.dataset.gap = base.w.dataset.gap;
                item.append(base.w, twin.w);
              }
              gap = false;
              if (wrap) { const m = wrap.cloneNode(false); m.appendChild(item); m.dataset.gap = base.w.dataset.gap; words.push(m); } else words.push(item);
            });
          } else walk(n, n.nodeName === "MARK" ? n : wrap);
        });
      };
      walk(h2, null);
      h2.textContent = "";
      words.forEach((w) => { if (w.dataset.gap) h2.appendChild(document.createTextNode(" ")); h2.appendChild(w); });
      lastW = h2.clientWidth; // the width these lines were worked out for
      // Work out the lines from the words' widths, like a browser would wrap them (a word goes on the line if it fits, with at least a
      // space's room before it). This does not depend on where the page happens to have put the words at this moment.
      const fs = parseFloat(getComputedStyle(h2).fontSize);
      const gapW = fs * 0.3;
      const lines = [];
      words.forEach((w) => {
        if (w.nodeType !== 1) return;
        // (offsetWidth, not getBoundingClientRect: the page can still be mid-animation, and screen sizes would then be shrunk or shifted)
        const width = w.offsetWidth, gap = w.dataset.gap ? gapW : 0, last = lines[lines.length - 1];
        if (last && last.used + gap + width <= lastW + 0.5) { last.items.push(w); last.used += gap + width; } else lines.push({ items: [w], used: width });
      });
      // justified text: when the board is the last thing on its line (words before it), ARTISTS, ends at the right edge; otherwise it starts at the left
      if (flip) {
        const mine = lines.find((l) => l.items.includes(flip.slot));
        flip.right = !!mine && mine.items.length > 1 && mine.items[mine.items.length - 1] === flip.slot;
        flip.slot.classList.toggle("flip-right", flip.right);
      }
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
      setColours(reduce.matches || !replay);
    };
    const play = () => {
      if (about.hidden) { h2.classList.remove("rolled"); stopFlip(); return; }
      h2.classList.remove("rolled");
      stopFlip();
      everyTl?.kill(); everyDone = false; setColours(false);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        h2.classList.add("rolled"); rollColours();
        if (!reduce.matches) flipWait = gsap.delayedCall(3, startFlip); // after the heading and the colours have rolled in
      }));
    };
    let ready = false;
    // the lines are worked out for one width; if the heading's width changes for any reason (window resize, full screen, fonts, layout settling), work them out again
    const resplit = () => { if (ready && !about.hidden && Math.abs(h2.clientWidth - lastW) > 1) split(false); };
    new MutationObserver(() => { if (!ready && !about.hidden) { split(); ready = true; } else resplit(); play(); }).observe(about, { attributes: true, attributeFilter: ["hidden"] });
    // after a refresh the page can come back already on About: nothing toggles then, so start the roll right away
    if (!about.hidden) { split(); ready = true; play(); }
    let t;
    const later = () => { clearTimeout(t); t = setTimeout(resplit, 150); };
    addEventListener("resize", later);
    if (window.ResizeObserver) new ResizeObserver(later).observe(h2);
    document.fonts?.ready.then(later);
  }
}
