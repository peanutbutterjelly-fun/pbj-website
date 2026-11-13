import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createCutLetter } from "./cutword.js";
import glyphData from "./glyphs.json";

// About, under "Who's cooking?": the two founders as big panels (the story slides up over the photo), and the journey
// behind PBJ as a row of steps that change as you scroll (the page holds still while they do).
const words = (text, wordClass, fill, skip, shadow = "var(--brown)") => {
  // paper-cut lettering, one nowrap box per word; returns the boxes and every letter (for the rolls)
  const boxes = [], letters = [];
  text.toUpperCase().split(" ").forEach((word) => {
    const w = document.createElement("span");
    w.className = wordClass;
    w.setAttribute("aria-hidden", "true");
    [...word].forEach((ch) => {
      const l = createCutLetter(ch, { fill, shadow, skip });
      if (l) { w.append(l.el); letters.push(l.el); } else w.append(document.createTextNode(ch));
    });
    boxes.push(w);
  });
  return { boxes, letters };
};

// Running text in paper-cut lettering, white with a crust-brown shadow. Small letters need a much stronger cut than headlines to
// show at all (a few pixels tall, the usual edge wobble is a fraction of a pixel), so the edge is cut ×2.4 stronger, with small scissor nicks rather than slow waves, and the shadow ×2 longer.
// Without `live`, every letter is drawn once and left alone; with it, the letters shake like the headlines, but only while that is true.
const SMALL = { rough: 2.4, shadowK: 2, jag: 0.7, coarse: true };
const LIVE = { rough: 1.6, shadowK: 2, jag: 0.4, coarse: true }; // small lettering that shakes: a little stronger than the headlines, but with their slow, gentle wobble
const G = glyphData.glyphs;
// Characters with no outline of their own are built from the pieces we do have (an accent from the apostrophe, a colon from two
// full stops, a plus from two hyphens, a double quote from two apostrophes), so they are cut the same way as the letters
const PIECES = {
  "É": [["E", 0, 0, 0], ["'", 0.02, 0.2, 32]],
  ":": [[".", 0, 0, 0], [".", 0, 0.33, 0]],
  "+": [["-", 0, 0, 0, 2], ["-", 0, 0, 90, 2]],
  "—": [["-", 0, 0, 0, 3.2]], // an em dash: a cut hyphen stretched to about an em wide // (each hyphen is stretched to twice its length, so the plus is not a blob)
  '"': [["'", 0, 0, 0], ["'", "next", 0, 0]],
};
const piece = (ch, opts) => {
  const parts = PIECES[ch];
  if (!parts) return null;
  const adv = (c) => G[c].adv / 1000;
  const width = ch === "É" ? adv("E") : ch === "+" ? 0.58 : ch === "—" ? 1 : ch === '"' ? adv("'") * 2 + 0.03 : adv(".");
  const box = document.createElement("span");
  box.style.cssText = `position:relative;display:inline-block;vertical-align:baseline;width:${width}em;height:0.729em`;
  box.setAttribute("aria-hidden", "true");
  // a piece with several parts draws every part's shadow first and every face on top, so one part's shadow never lands on another's face
  const layers = parts.length > 1 ? [{ ...opts, fill: opts.shadow }, { ...opts, shadow: "transparent" }] : [opts];
  const seeds = parts.map((_, i) => 5000 + i * 7 + (ch.charCodeAt(0) % 97) * 13);
  layers.forEach((layer) => parts.forEach(([c, left, lift, rot, stretch = 1], n) => {
    const l = createCutLetter(c, parts.length > 1 ? { ...layer, seed: seeds[n] } : layer);
    if (!l) return;
    const x = left === "next" ? adv("'") + 0.03 : left + (ch === "+" || ch === "—" ? (width - adv("-")) / 2 : 0);
    let origin = "50% 50%";
    if (c === "-") { const ys = G["-"].c.flatMap((k) => k.filter((_, i) => i % 2)); origin = `50% ${(((Math.min(...ys) + Math.max(...ys)) / 2 + 729) / 729) * 100}%`; } // the hyphen's own middle, so a quarter turn makes a plus
    l.el.style.cssText += `;position:absolute;left:${x}em;bottom:${lift}em;transform:rotate(${rot}deg) scale(${stretch},1);transform-origin:${origin}`;
    box.append(l.el);
  }));
  return box;
};
const cutText = (el, fill = "#fff", shadow = "var(--crust)", live) => { // live: a function; the letters shake (like the headlines) while it returns true
  const text = el.textContent.replace(/\s+/g, " ").trim();
  el.setAttribute("aria-label", text);
  el.textContent = "";
  let frozen = false, count = 0;
  // on phones a long text shakes a third of its letters at a time, taking turns (a story is about 500 letters, too many to redraw
  // all at once there); on computers every letter shakes, as in the headlines
  const thin = text.length > 200 && matchMedia("(max-width: 767px)").matches;
  const frag = document.createDocumentFragment();
  text.toUpperCase().split(" ").forEach((word, i, all) => {
    const w = document.createElement("span");
    w.className = "cword";
    w.setAttribute("aria-hidden", "true");
    [...word].forEach((ch) => {
      let first = true, turn = count++ % 3; // (the first call is the letter's first drawing)
      const skip = live ? () => { if (first) { first = false; return false; } return !live() || (thin && ++turn % 3 !== 0); } : () => frozen;
      const opts = { fill, shadow, skip, ...(live ? LIVE : SMALL) };
      const l = createCutLetter(ch, opts);
      if (l) { w.append(l.el); return; }
      const built = piece(ch, opts);
      if (built) w.append(built); else w.append(document.createTextNode(ch)); // (anything else, like the middle dot, stays plain text)
    });
    frag.append(w);
    if (i < all.length - 1) frag.append(" ");
  });
  el.append(frag);
  frozen = true;
};

// ---- The fun fact: a single long line of heading that travels sideways as you scroll (the page holds still while it does),
// and every letter tumbles into place as it comes in from the right, with a random drop and tilt (GSAP's "containerAnimation"
// idea: each letter has its own little scroll trigger inside the sideways movement) ----
function setupFunFact(about) {
  const sec = about.querySelector(".about-fact");
  const stage = sec?.querySelector(".fstage"), line = sec?.querySelector(".ftext");
  if (!sec || !stage || !line) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const text = line.textContent.replace(/\s+/g, " ").trim();
  line.setAttribute("aria-label", text);
  line.textContent = "";
  const COLOURS = ["var(--pop)", "var(--strawberry)", "var(--crust)", "var(--peanut)"]; // a different colour for each word: this is the fun one
  let ready = false;
  const phone = matchMedia("(max-width: 767px)"); // on a phone the letters are drawn once and do not shake (shaking 65 letters while scrolling is what made it stutter)
  const onScreen = []; // which letters are on screen right now (worked out in render, below)
  const letters = [];
  text.toUpperCase().split(" ").forEach((word, i) => {
    const w = document.createElement("span");
    w.className = "fword";
    w.setAttribute("aria-hidden", "true");
    const index = letters.length; // (the first letter of this word)
    const opts = { fill: COLOURS[i % COLOURS.length], shadow: "var(--brown)", skip: () => ready && (reduce || !onScreen[index]) }; // (every letter is drawn once when made; after that it shakes only while the line is on screen)
    [...word].forEach((ch) => {
      const l = createCutLetter(ch, opts);
      const el = l ? l.el : piece(ch, { ...opts, coarse: false });
      if (el) { w.append(el); letters.push(el); } else w.append(document.createTextNode(ch));
    });
    line.append(w);
  });
  ready = true;
  if (reduce) { sec.classList.add("fstatic"); return; }
  // the line's stage sticks at 42% of the screen's height (see .fstage); the pin lasts until the section's bottom reaches the stage's bottom
  const stickTop = () => parseFloat(getComputedStyle(stage).top) || 0;
  // the line moves a few pixels sideways for every pixel scrolled (see `speed`), so the whole sentence passes quickly
    const speed = () => (phone.matches ? 1.3 : 2.6); // on a phone the line is slower, so it can be read (a flick of the thumb scrolls a lot)
  // it stops with the end of the sentence resting a little past the middle of the screen, so the last words stay readable
  const trip = () => line.scrollWidth - stage.offsetWidth * 0.55;
  const size = () => { sec.style.setProperty("--fh", `${stage.offsetHeight}px`); sec.style.height = `${Math.round(stage.offsetHeight + trip() / speed())}px`; };
  ScrollTrigger.addEventListener("refreshInit", size);
  size();
  // The letters' tumble is worked out by one small calculation per scroll step (not one scroll trigger and one tween per letter, which
  // was far too much for a phone): each letter's place on screen says how far along its tumble it is, from "just coming in at the right
  // edge" (dropped and tilted at random) to "30% of the way across" (settled, with a little bounce).
  const native = phone.matches && typeof CSS !== "undefined" && CSS.supports("animation-timeline: view()");
  const ease = gsap.parseEase("back.out(1.2)");
  const toss = letters.map(() => ({ y: gsap.utils.random(-70, 70), r: gsap.utils.random(-12, 12) }));
  const base = [], seen = letters.map(() => -1);
  const measure = () => { // where each letter sits along the line when the line is not moved (the letters are svg, which have no offsetLeft, so they are measured on screen with their tilt cleared)
    letters.forEach((el) => { el.style.transform = ""; });
    if (native) line.classList.remove("fnative"); // (switches the browser's animations off for a moment, so the line and letters sit at rest)
    const x = native ? 0 : gsap.getProperty(line, "x"), s0 = stage.getBoundingClientRect().left;
    letters.forEach((el, i) => { base[i] = el.getBoundingClientRect().left - s0 - x; });
    if (native) line.classList.add("fnative");
    seen.fill(-1);
  };
  const render = () => {
    const x = xNow(), w = stage.offsetWidth;
    for (let i = 0; i < letters.length; i++) {
      const left = base[i] + x;
      onScreen[i] = left > -w * 0.2 && left < w * 1.05; // only the letters on screen shake
      if (native) continue; // (on a native phone the browser animates the tumble itself, see placeLetters)
      const p = Math.min(1, Math.max(0, (w - left) / (w * 0.28)));
      if (p === seen[i] && p === 1) continue;
      seen[i] = p;
      if (p >= 1) { letters[i].style.transform = ""; continue; }
      const v = ease(p);
      letters[i].style.transform = `translate3d(0, ${(toss[i].y * (1 - v)).toFixed(1)}%, 0) rotate(${(toss[i].r * (1 - v)).toFixed(2)}deg)`;
    }
  };
  // On phones that can do it, the line is slid by the browser's own scroll-linked animation (it runs off the main thread, so it stays
  // glued to the thumb); the letters' tumble is then worked out from the scroll position. Elsewhere, a scrubbed tween slides it.
  let startY = 0;
  const xNow = () => {
    if (!native) return gsap.getProperty(line, "x");
    const len = Math.max(1, sec.offsetHeight - stage.offsetHeight);
    return -trip() * Math.min(1, Math.max(0, (window.scrollY - startY) / len));
  };
  const place = () => {
    if (!native) return;
    startY = sec.getBoundingClientRect().top + window.scrollY - stickTop();
    const vh = window.innerHeight;
    sec.style.viewTimeline = "--fact block";
    line.style.setProperty("--fx", `${-trip()}px`);
    line.style.animationTimeline = "--fact";
    line.style.animationRange = `cover ${Math.max(0, vh - stickTop())}px cover calc(100% - ${stickTop() + stage.offsetHeight}px)`;
    line.classList.add("fnative");
  };
  // each letter gets its own scroll-linked animation, timed to the stretch of scrolling in which it crosses from the right edge to
  // about 60% across, so the tumble is exactly in step with the line (nothing is worked out per scroll step)
  const placeLetters = () => {
    const w = stage.offsetWidth, len = Math.max(1, sec.offsetHeight - stage.offsetHeight), start = Math.max(0, window.innerHeight - stickTop()), T = trip();
    letters.forEach((el, i) => {
      const p1 = Math.max(0, (base[i] - w) / T), p2 = Math.min(1, (base[i] - w * 0.6) / T);
      el.style.setProperty("--ty", `${toss[i].y.toFixed(0)}%`);
      el.style.setProperty("--tr", `${toss[i].r.toFixed(1)}deg`);
      el.style.animationTimeline = "--fact";
      el.style.animationRange = `cover ${(start + p1 * len).toFixed(0)}px cover ${(start + Math.max(p2, p1 + 0.002) * len).toFixed(0)}px`;
    });
  };
  ScrollTrigger.addEventListener("refresh", () => { place(); measure(); if (native) placeLetters(); render(); });
  if (native) {
    ScrollTrigger.create({ trigger: sec, start: () => `top ${stickTop()}px`, end: () => `bottom ${stickTop() + stage.offsetHeight}px`, invalidateOnRefresh: true, onUpdate: render });
  } else {
    gsap.to(line, {
      x: () => -trip(), ease: "none", onUpdate: render,
      scrollTrigger: { trigger: sec, start: () => `top ${stickTop()}px`, end: () => `bottom ${stickTop() + stage.offsetHeight}px`, scrub: phone.matches ? true : 0.4, invalidateOnRefresh: true },
    });
  }
  place();
  measure();
  if (native) placeLetters();
  render();
}

export function setupAboutStory(about) {
  if (!about) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- The founders ----
  about.querySelectorAll(".fname").forEach((h) => {
    const text = h.textContent.replace(/\s+/g, " ").trim();
    h.setAttribute("aria-label", text);
    h.textContent = "";
    h.append(...words(text, "fword", "#fff", undefined, "var(--crust)").boxes);
  });
  about.querySelectorAll(".frole, .fbtn span").forEach((el) => cutText(el, "#fff", "var(--crust)", () => !about.hidden)); // the role lines and the open buttons (white, on the photo) shake while About is on show
  about.querySelectorAll(".fpanel").forEach((panel) => {
    const open = panel.querySelector(".fbtn"), close = panel.querySelector(".fclose"), story = panel.querySelector(".fbio p");
    let built = false;
    // both stories are light-yellow lettering with the titles' brown shadow (like List Your Event): on crust brown for the first
    // founder, on jam red for the second
    const look = ["var(--peanut)", "var(--brown)"];
    cutText(close.querySelector("span"), ...look, () => panel.classList.contains("open"));
    const set = (on) => {
      if (on && !built) { built = true; cutText(story, ...look, () => panel.classList.contains("open")); } // the story's letters are made the first time it is opened
      panel.classList.toggle("open", on);
      open.setAttribute("aria-expanded", String(on));
      (on ? close : open).focus({ preventScroll: true });
    };
    open.addEventListener("click", () => set(true));
    close.addEventListener("click", () => set(false));
    panel.addEventListener("keydown", (e) => { if (e.key === "Escape" && panel.classList.contains("open")) set(false); });
  });
  const grid = about.querySelector(".about-founders");
  if (grid && !reduce) {
    gsap.fromTo(grid.querySelectorAll(".fpanel"), { y: 80, autoAlpha: 0 }, {
      y: 0, autoAlpha: 1, ease: "none", stagger: 0.25,
      scrollTrigger: { trigger: grid, start: "top 95%", end: "top 45%", scrub: 0.5 },
    });
  }

  setupFunFact(about);

  // ---- The journey ----
  const journey = about.querySelector(".about-journey");
  if (!journey) return;
  const stage = journey.querySelector(".jstage");
  const dots = [...journey.querySelectorAll(".jdots i")];
  const steps = [...journey.querySelectorAll(".jstep")].map((el, i) => {
    const st = { el, i, on: false, letters: [], text: el.querySelector(".jtext"), num: el.querySelector(".jnum") };
    const t = el.querySelector(".jtitle");
    const title = t.textContent.replace(/\s+/g, " ").trim();
    t.setAttribute("aria-label", title);
    t.textContent = "";
    const w = words(title, "jword", "var(--crust)", () => !st.on); // a hidden step's letters stop redrawing
    t.append(...w.boxes);
    st.letters = w.letters;
    return st;
  });
  const N = steps.length;
  journey.style.setProperty("--steps", N);
  if (reduce) { journey.classList.add("jstatic"); return; }

  const FAR = 260; // how far a letter rolls (in its own heights): far enough to be fully out of its clipped box, shadow and all
  const parts = (s) => [s.num, ...s.letters];
  let cur = -1, entered = false;
  const hideAll = () => {
    cur = -1;
    steps.forEach((s) => {
      gsap.killTweensOf([...parts(s), s.text]);
      gsap.set(parts(s), { yPercent: FAR });
      gsap.set(s.text, { autoAlpha: 0 });
      s.on = false;
    });
    dots.forEach((d) => d.classList.remove("on"));
  };
  const setStep = (i) => {
    if (i === cur) return;
    const dir = i > cur ? 1 : -1, prev = steps[cur], next = steps[i];
    cur = i;
    if (prev) { // the old step rolls out (up when going on, down when going back)...
      gsap.to(parts(prev), { yPercent: -FAR * dir, duration: 0.35, ease: "power2.in", stagger: 0.02, overwrite: true, onComplete: () => { if (cur !== prev.i) prev.on = false; } });
      gsap.to(prev.text, { autoAlpha: 0, y: -16 * dir, duration: 0.3, overwrite: true });
    }
    next.on = true; // ...and the new one rolls in
    gsap.fromTo(parts(next), { yPercent: FAR * dir }, { yPercent: 0, duration: 0.55, ease: "power3.out", stagger: 0.03, delay: 0.2, overwrite: true });
    gsap.fromTo(next.text, { autoAlpha: 0, y: 18 * dir }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out", delay: 0.4, overwrite: true });
    dots.forEach((d, k) => d.classList.toggle("on", k === i));
  };
  hideAll();
  const stickTop = () => parseFloat(getComputedStyle(stage).top) || 0;
  const band = (p) => Math.min(N - 1, Math.floor(p * N));
  // progress runs from the moment the stage sticks until it lets go; each step gets an equal share of it
  const progress = ScrollTrigger.create({
    trigger: journey, start: () => `top ${stickTop()}px`, end: "bottom bottom",
    onUpdate: (self) => { if (entered) setStep(band(self.progress)); },
  });
  ScrollTrigger.create({
    trigger: journey, start: "top 85%",
    onEnter: () => { entered = true; setStep(band(progress.progress)); },
    onLeaveBack: () => { entered = false; hideAll(); },
  });
}
