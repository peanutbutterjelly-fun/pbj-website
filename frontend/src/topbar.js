// The top bar: "Who are you" and "Choose your city" open little cards; "Menu" makes the folder tabs bounce one after another, like piano keys.
const CITIES = ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Jaipur", "Chandigarh", "Indore", "Trivandrum", "Pune", "Kolkata", "Ahmedabad", "Surat", "Kochi", "Dehradun"];

export function setupTopbar() {
  const bar = document.querySelector(".topbar");
  const tabs = document.querySelector(".tabs");
  const menuBtn = document.getElementById("tb-menu");
  const items = [...bar.querySelectorAll(".tb-item[data-menu]")];

  // Cities: only Mumbai is open for now, the rest say "Coming soon"
  document.getElementById("tb-cities").innerHTML = CITIES.map((c, i) =>
    i === 0
      ? `<li><button type="button" class="on" data-value="${c}"><span>${c}</span><b aria-hidden="true">✓</b></button></li>`
      : `<li><button type="button" disabled><span>${c}</span><small>Coming soon</small></button></li>`
  ).join("");

  // The bar's words blend with whatever is behind them (see .topbar in the stylesheet), so the cards live in a layer of their own
  const layer = document.createElement("div");
  layer.className = "tb-layer";
  const pops = new Map();
  items.forEach((it) => {
    const pop = it.querySelector(".tb-pop");
    pop.dataset.menu = it.dataset.menu;
    pops.set(it, pop);
    layer.append(pop);
  });
  bar.after(layer);

  const closeCards = (except) => items.forEach((it) => {
    if (it === except) return;
    pops.get(it).hidden = true;
    it.querySelector(".tb-btn").setAttribute("aria-expanded", "false");
    it.classList.remove("open");
  });
  // Menu: each folder tab bounces in place in turn (the delay per tab is set in the stylesheet)
  const playKeys = () => {
    tabs.classList.remove("play");
    void tabs.offsetWidth; // restart the run if it is clicked again
    tabs.classList.add("play");
  };
  tabs.addEventListener("animationend", (e) => {
    if (e.target.classList.contains("tab") && e.target === tabs.lastElementChild) tabs.classList.remove("play");
  });

  items.forEach((it) => {
    const btn = it.querySelector(".tb-btn");
    const pop = pops.get(it);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = pop.hidden;
      closeCards(it);
      pop.hidden = !open;
      if (open && !matchMedia("(max-width: 767px)").matches) {
        // sit centred under the button, but never past the edges of the window
        const r = btn.getBoundingClientRect();
        const half = pop.offsetWidth / 2;
        pop.style.left = Math.max(half + 12, Math.min(innerWidth - half - 12, r.left + r.width / 2)) + "px";
      }
      btn.setAttribute("aria-expanded", String(open));
      it.classList.toggle("open", open);
    });
    // choosing an option highlights it (the choice is remembered, nothing else changes yet)
    const key = "pbj-" + it.dataset.menu;
    try { const saved = localStorage.getItem(key); if (saved) pop.querySelectorAll("button[data-value]").forEach((b) => b.classList.toggle("on", b.dataset.value === saved)); } catch (e) {}
    pop.addEventListener("click", (e) => {
      e.stopPropagation();
      const b = e.target.closest("button[data-value]");
      if (!b || b.disabled) return;
      pop.querySelectorAll("button[data-value]").forEach((x) => x.classList.toggle("on", x === b));
      try { localStorage.setItem(key, b.dataset.value); } catch (err) {}
      closeCards();
    });
  });

  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeCards();
    playKeys();
  });
  // clicking elsewhere or pressing Escape closes any open card
  document.addEventListener("click", () => closeCards());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCards(); });

  // The bar's letters follow what is behind them, letter by letter: light on dark backgrounds, dark on light ones. Plain colours
  // (no blending), so the type stays as thin and clean as the folder tabs.
  bar.querySelectorAll(".tb-btn > span").forEach((word) => {
    const text = word.textContent;
    word.textContent = "";
    [...text].forEach((ch) => {
      const c = document.createElement("span");
      c.className = "c";
      c.textContent = ch;
      word.append(c);
    });
  });
  const marks = [...bar.querySelectorAll(".tb-btn i, .tb-btn .c")];
  const parse = (s) => {
    const n = s.match(/[\d.]+/g)?.map(Number);
    if (!n || n.length < 3) return null;
    const [r, g, b] = s.startsWith("color(") ? n.slice(0, 3).map((v) => v * 255) : n.slice(0, 3);
    return { lum: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255, a: n.length > 3 ? n[3] : 1 };
  };
  const behind = (x, y) => {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el.closest(".topbar") || el.closest(".tabs") || el.closest(".tb-layer")) continue;
      const c = parse(getComputedStyle(el).backgroundColor);
      if (c && c.a > 0.6) return c.lum;
    }
    return 1; // nothing coloured: the page itself
  };
  let queued = false;
  const update = () => {
    queued = false;
    // on phones the bar has a solid back, so its words stay dark (except on List Your Event, where the bar is see-through and its words follow the colour behind them)
    if (matchMedia("(max-width: 767px)").matches && document.documentElement.dataset.page !== "list") { marks.forEach((m) => m.classList.remove("on-dark")); return; }
    marks.forEach((m) => {
      const r = m.getBoundingClientRect();
      m.classList.toggle("on-dark", behind(r.left + r.width / 2, r.top + r.height / 2) < 0.5);
    });
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  document.addEventListener("scroll", queue, { capture: true, passive: true });
  window.addEventListener("resize", queue);
  setInterval(queue, 300); // also catches things that move by themselves (the banner, page changes)
  queue();
}
