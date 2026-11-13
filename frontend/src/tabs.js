import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Observer } from "gsap/Observer";

gsap.registerPlugin(Observer);

const phoneQuery = window.matchMedia("(max-width: 767px)");

// Folder tabs. Computers: click opens. Phones: first tap peeks, second tap opens.
export function setupTabs({ onSwitch } = {}) {
  const tabs = [...document.querySelectorAll(".tab")];
  const panels = [...document.querySelectorAll(".panel")];
  let current = "home";

  tabs.forEach((tab, i) => tab.style.setProperty("--i", i));

  const clearPeek = () => tabs.forEach((t) => t.classList.remove("peek"));

  function open(name, { toEnd = false } = {}) {
    clearPeek();
    if (name === current) return;
    const from = panels.find((p) => p.dataset.panel === current);
    const to = panels.find((p) => p.dataset.panel === name);
    current = name;

    tabs.forEach((t) =>
      t.dataset.tab === name ? t.setAttribute("aria-current", "page") : t.removeAttribute("aria-current")
    );

    from.hidden = true;
    to.hidden = false;
    onSwitch?.(name);
    ScrollTrigger.refresh();
    if (toEnd) window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });

    // Folder shuffle: the new page slides in like a folder pulled to the front
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.fromTo(
        to,
        { xPercent: phoneQuery.matches ? 0 : 6, yPercent: phoneQuery.matches ? 4 : 0, rotate: 1.5, opacity: 0 },
        { xPercent: 0, yPercent: 0, rotate: 0, opacity: 1, duration: 0.6, ease: "back.out(1.6)", clearProps: "transform,opacity" }
      );
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.stopPropagation();
      const name = tab.dataset.tab;
      if (phoneQuery.matches && !tab.classList.contains("peek") && name !== current) {
        clearPeek();
        tab.classList.add("peek");
        return;
      }
      open(name);
    });
  });

  document.addEventListener("click", clearPeek);

  // Keep scrolling past the end of a folder and the next one opens; keep scrolling up past the top and the previous one opens.
  // "Meet Our Hosts" is a draggable grid that never scrolls the page, so there plain scrolling changes folder as everywhere
  // else, and moving the grid takes a deliberate gesture: computers and laptops hold Shift and scroll (the grid handles
  // that), phones use one finger to drag the grid and three fingers to change folder.
  const atTop = () => window.scrollY <= 2;
  const atBottom = () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
  const PUSH = 160; // how much extra scrolling it takes (so it never fires by accident)
  let push = 0; // positive = pushing down, negative = pushing up
  let edgeSince = 0; // when we reached the edge we are pushing against
  let lockedUntil = 0;

  Observer.create({
    target: window,
    type: "wheel,touch",
    tolerance: 4,
    onChangeY(self) {
      const now = performance.now();
      const ev = self.event;
      const isTouch = ev.type.startsWith("touch") || ev.type.startsWith("pointer");
      // wheel: positive = scrolling down; touch: a finger dragging up gives a negative change, so flip it
      const dir = Math.sign(isTouch ? -self.deltaY : self.deltaY);
      if (!dir) return;

      if (current === "hosts") {
        const deliberate = isTouch ? (ev.touches?.length ?? 1) >= 3 : !ev.shiftKey;
        if (!deliberate) { push = 0; return; }
      } else {
        const atEdge = dir > 0 ? atBottom() : atTop();
        if (!atEdge) { push = 0; edgeSince = 0; return; }
        if (!edgeSince) edgeSince = now;
        // ignore the tail of the scroll that carried us to the edge
        if (now - edgeSince < 500) return;
      }
      if (now < lockedUntil) return;

      if (Math.sign(push) !== dir) push = 0;
      push += isTouch ? -self.deltaY : self.deltaY;
      if (Math.abs(push) < PUSH) return;
      push = 0;
      edgeSince = 0;
      const next = tabs[tabs.findIndex((t) => t.dataset.tab === current) + dir];
      if (next) {
        lockedUntil = now + 1200;
        open(next.dataset.tab, { toEnd: dir < 0 });
      }
    },
  });

  tabs[0].setAttribute("aria-current", "page");
}
