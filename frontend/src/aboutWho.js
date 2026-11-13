import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createCutLetter } from "./cutword.js";

// About, second frame: "WHO'S COOKING?" (the founders and the journey behind PBJ).
// The heading is paper-cut lettering like the rest of the page; as the frame scrolls into view its letters roll up
// one after another (the same split-text roll as elsewhere), then the lines under it fade up.
export function setupAboutWho(about) {
  const who = about?.querySelector(".about-who");
  const title = who?.querySelector(".who-title");
  if (!who || !title) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const text = title.textContent.replace(/\s+/g, " ").trim();
  title.setAttribute("aria-label", text);
  title.textContent = "";
  const letters = [];
  text.toUpperCase().split(" ").forEach((word, i, all) => {
    const w = document.createElement("span");
    w.className = "who-word";
    w.setAttribute("aria-hidden", "true");
    [...word].forEach((ch) => {
      const l = createCutLetter(ch, { fill: ch === "?" ? "var(--strawberry)" : i === 0 ? "var(--pop)" : "var(--peanut)", shadow: "var(--brown)" }); // WHO'S dark yellow, COOKING light yellow, ? red
      if (l) { w.append(l.el); letters.push(l.el); } else w.append(document.createTextNode(ch));
    });
    title.append(w);
    if (i < all.length - 1) title.append(" ");
  });
  const rest = [...who.querySelectorAll(".who-sub")];
  if (reduce) return;
  // The roll follows the scroll (scrubbed, a little smoothed), so it plays forwards as you scroll down and backwards, just as
  // smoothly, as you scroll up. It finishes when the frame's bottom has come up to the middle of the window.
  const tl = gsap.timeline({ scrollTrigger: { trigger: who, start: "top 90%", end: "bottom 55%", scrub: 0.6 } });
  tl.fromTo(letters, { yPercent: 120 }, { yPercent: 0, ease: "none", duration: 0.55, stagger: 0.04 })
    .fromTo(rest, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, ease: "none", duration: 0.3, stagger: 0.12 }, ">-0.15");
  // the frame's position only counts once About is on show
  // (measured again a few times as the folder finishes sliding in and the page settles, so the roll's start and end are right)
  new MutationObserver(() => { if (!about.hidden) [60, 700, 1600].forEach((ms) => setTimeout(() => { if (!about.hidden) ScrollTrigger.refresh(); }, ms)); }).observe(about, { attributes: true, attributeFilter: ["hidden"] });
}
