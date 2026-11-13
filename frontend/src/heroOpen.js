import { gsap } from "gsap";
import { createCutWord, CAP_EM } from "./cutword.js";

// The hero opening, after the loading screen:
// 1. "PEANUT BUTTER JELLY" sits in one line (dark yellow, light yellow, red)
// 2. The words split into three lines, one under the other, and stretch across the hero with room on every edge
// 3. The assembled sandwich grows out of the middle, in front of the words, then its layers float apart
// After that the page works exactly as before (one scroll, one step).
//
// The words are paper-cut vector lettering (see cutword.js), drawn in an SVG behind the sandwich.

const STEP = 0.84; // how far apart stacked words sit, in word-heights (a capital letter is shorter than its line)
const NS = "http://www.w3.org/2000/svg";
const WORDS = [
  ["PEANUT", "var(--pop)"], // darker yellow
  ["BUTTER", "var(--honey)"], // light yellow
  ["JELLY", "var(--strawberry)"],
];

// Call it straight away (it lays the title out in one line, ready for the loading screen to reveal);
// call the returned start() when the loading screen is done.
export function playHeroOpen({ hero, mascot, lenis }) {
  const title = hero.querySelector(".hero-title");
  if (!title) return { start(done) { done?.(); } };
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const { opening } = mascot;

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;display:block;overflow:visible";
  title.append(svg);
  const words = WORDS.map(([text, fill]) => {
    const w = createCutWord(text, { fill, shadow: "var(--brown)" });
    svg.append(w.el);
    return w;
  });

  let layoutA = [];
  let layoutB = [];
  let t = 0; // 0 = one line, 1 = three lines

  const measure = () => {
    const W = hero.clientWidth; // not getBoundingClientRect: the loading screen scales the page while it swirls out
    const H = hero.clientHeight;
    const mx = W * 0.06;
    const my = H * 0.07;
    const availW = W - 2 * mx;
    const availH = H - 2 * my;
    const widths = words.map((w) => w.widthEm); // in font sizes

    // 1. one line, centred. Each entry: x, y = top of the capitals, s = font size in pixels
    const gap = 0.28;
    const totalEm =
      widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
    const sA = Math.min((availW * 0.8) / totalEm, 160);
    let x = (W - totalEm * sA) / 2;
    layoutA = widths.map((w) => {
      const l = { x, y: H / 2 - (CAP_EM * sA) / 2, s: sA };
      x += (w + gap) * sA;
      return l;
    });

    // 3 lines, all the same size and evenly spaced, centred. The widest word spans the full width, unless three
    // lines would then be too tall for the hero, in which case the size is limited by the height
    const blockEm = (words.length - 1) * STEP + CAP_EM;
    const sB = Math.min(availW / Math.max(...widths), availH / blockEm);
    const top = my + (availH - blockEm * sB) / 2;
    layoutB = widths.map((w, i) => ({
      x: (W - w * sB) / 2,
      y: top + i * STEP * sB,
      s: sB,
    }));

    // Phones: there is plenty of room above and below the sandwich, so the words spread out into it. PEANUT sits just
    // under the folder tabs and JELLY near the bottom edge; BUTTER goes exactly halfway between them, so the gap above
    // it is the same as the gap below it.
    if (window.matchMedia("(max-width: 767px)").matches) {
      const tabs = document.querySelector(".tabs");
      const topY = (tabs ? tabs.offsetHeight : 0) + H * 0.012;
      const bottomY = H - H * 0.035;
      const cap = CAP_EM * sB;
      const tops = [topY, (topY + bottomY - cap) / 2, bottomY - cap];
      layoutB = layoutB.map((l, i) => ({ ...l, y: tops[i] }));
    }
  };

  const apply = () => {
    words.forEach((w, i) => {
      const a = layoutA[i];
      const b = layoutB[i];
      w.place(
        a.x + (b.x - a.x) * t,
        a.y + (b.y - a.y) * t,
        a.s + (b.s - a.s) * t,
      );
    });
  };

  const relayout = () => {
    measure();
    apply();
  };

  measure();
  apply();
  new ResizeObserver(relayout).observe(hero); // re-measure whenever the hero itself changes size

  const start = (onDone = () => {}) => {
    if (reduceMotion) {
      t = 1;
      apply();
      onDone();
      return;
    }
    mascot.settle();
    mascot.hold(true);
    lenis.stop();
    const tl = gsap
      .timeline({
        delay: 0.5,
        onComplete() {
          mascot.hold(false);
          lenis.start();
          onDone();
        },
      })
      .to(
        {},
        {
          duration: 1.2,
          ease: "power3.inOut",
          onUpdate() {
            t = this.progress();
            apply();
          },
        },
      )
      .to(opening, { zoom: 1, duration: 1.1, ease: "back.out(1.3)" }, "+=0.15")
      .to(opening, { apart: 1, duration: 1.3, ease: "power2.inOut" }, "<0.65");
    if (import.meta.env.DEV) window.heroOpenTl = tl; // handy for testing in the browser
  };
  return { start };
}
