import { createCutLetter } from "./cutword.js";
import { EVENTS } from "./eventsData.js";

// The Events page: the paper-cut headline, and the lineup of vintage tickets (one per event in eventsData.js).
export function setupEvents(root) {
  setupHeadline(root);
  setupLineup(root);
}

// The Events headline wears the same paper-cut lettering as the layer titles on Home (see cutword.js and mascot.js):
// every letter is a little hand-cut vector shape with a hard brown shadow. Letters we have no outline for stay plain text.
function setupHeadline(root) {
  const title = root.querySelector(".events-intro .story-title");
  if (!title) return;
  const text = title.textContent.replace(/\s+/g, " ").trim();
  title.setAttribute("aria-label", text);
  title.textContent = "";
  text.split(" ").forEach((word, i, all) => {
    const w = document.createElement("span");
    w.className = "w";
    w.setAttribute("aria-hidden", "true");
    [...word].forEach((ch) => {
      const letter = createCutLetter(ch, { fill: "var(--pop)", shadow: "var(--brown)" });
      if (letter) w.append(letter.el);
      else w.append(document.createTextNode(ch));
    });
    title.append(w);
    if (i < all.length - 1) title.append(" ");
  });
}

// ---- The little pictures on the tickets (drawn in the ticket's own colours, over a dark panel) ----
// p = paper colour, a = accent colour, k = dark; lp / la = round-ended lines in paper / accent
const SKYLINE = `<path class="a" d="M0 128V108h12V96h9v12h8V90h6v18h10V100h12v8h8V84h8v24h12V98h9v10h11V92h7v16h12V104h10v4h13V94h8v14h9V86h6v22h10v20z"/>`;
const ART = {
  music: `<circle class="p" cx="100" cy="58" r="30"/><path class="la" d="M24 40q10-9 20 0t20 0M136 30q10-9 20 0t20 0"/><circle class="a" cx="42" cy="76" r="6"/><path class="la" d="M48 76V56l16-4"/>`,
  workshop: `<path class="p" d="M70 42h60q10 0 8 14l-6 34q-2 10-14 10H82q-12 0-14-10l-6-34q-2-14 8-14z"/><ellipse class="a" cx="100" cy="42" rx="30" ry="7"/><path class="la" d="M84 22q-6 8 0 14t0 12M116 22q-6 8 0 14t0 12"/>`,
  comedy: `<rect class="p" x="90" y="26" width="20" height="42" rx="10"/><path class="lp" d="M76 62q0 26 24 26t24-26M100 88v20M84 108h32"/><path class="la" d="M44 36l4 9 10 1-8 7 3 10-9-6-9 6 3-10-8-7 10-1zM152 30l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z"/>`,
  vinyl: `<circle class="p" cx="100" cy="62" r="44"/><circle class="a" cx="100" cy="62" r="15"/><circle class="k" cx="100" cy="62" r="3.5"/><circle cx="100" cy="62" r="30" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="2"/><circle cx="100" cy="62" r="38" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="2"/>`,
  film: `<rect class="p" x="38" y="22" width="124" height="76" rx="4"/><rect class="a" x="52" y="36" width="96" height="48" rx="2"/><g class="k"><rect x="44" y="26" width="8" height="6"/><rect x="62" y="26" width="8" height="6"/><rect x="80" y="26" width="8" height="6"/><rect x="98" y="26" width="8" height="6"/><rect x="116" y="26" width="8" height="6"/><rect x="134" y="26" width="8" height="6"/><rect x="44" y="88" width="8" height="6"/><rect x="62" y="88" width="8" height="6"/><rect x="80" y="88" width="8" height="6"/><rect x="98" y="88" width="8" height="6"/><rect x="116" y="88" width="8" height="6"/><rect x="134" y="88" width="8" height="6"/></g>`,
  food: `<path class="p" d="M66 52h64v26q0 22-32 22t-32-22z"/><path class="lp" d="M130 58q22 0 20 16t-22 8"/><ellipse class="a" cx="98" cy="52" rx="32" ry="6"/><path class="la" d="M82 24q-6 8 0 14t0 10M98 20q-6 8 0 14t0 14M114 24q-6 8 0 14t0 10"/>`,
  art: `<path class="p" d="M100 24c-38 0-62 22-62 44 0 18 16 28 34 22 10-3 14 6 10 16-2 8 8 12 22 12 34 0 60-22 60-50 0-26-26-44-64-44z"/><circle class="a" cx="72" cy="50" r="8"/><circle class="k" cx="104" cy="42" r="8"/><circle class="a" cx="136" cy="58" r="8"/><circle class="k" cx="64" cy="76" r="7"/>`,
  games: `<rect class="p" x="68" y="30" width="64" height="64" rx="12" transform="rotate(-12 100 62)"/><g class="k" transform="rotate(-12 100 62)"><circle cx="84" cy="46" r="5"/><circle cx="116" cy="46" r="5"/><circle cx="100" cy="62" r="5"/><circle cx="84" cy="78" r="5"/><circle cx="116" cy="78" r="5"/></g>`,
};
const art = (kind) => `<svg viewBox="0 0 200 128" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${ART[kind] || ART.music}${SKYLINE}</svg>`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const TILTS = [-1.6, 1.2, -0.8, 1.7, -1.3, 0.9, -1.8, 1.4]; // each ticket sits at its own small angle
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function ticket(ev, i) {
  const [y, m, d] = ev.date.split("-").map(Number);
  const day = new Date(y, m - 1, d);
  const where = `${ev.area}${ev.venue ? ` · ${ev.venue}` : ""}`;
  const href = ev.link || "#";
  return `
    <article class="tk tk-${esc(ev.paper || "sun")}" style="--tilt:${TILTS[i % TILTS.length]}deg">
      <div class="tk-main">
        <p class="tk-top"><span>★ Admit one ★</span><span>No. ${String(i + 1).padStart(4, "0")}</span></p>
        <div class="tk-art">${art(ev.kind)}<span class="tk-stamp">${esc(ev.category)}</span></div>
        <h3>${esc(ev.title)}</h3>
        <p class="tk-where">${esc(where)}</p>
        <p class="tk-blurb">${esc(ev.blurb)}</p>
      </div>
      <div class="tk-stub">
        <div class="tk-date"><b>${String(d).padStart(2, "0")}</b><span>${MONTHS[m - 1]}<br />${DAYS[day.getDay()]}</span></div>
        <div class="tk-meta"><span>${esc(ev.time)}</span><span class="tk-price">${esc(ev.price)}</span></div>
        <a class="tk-btn" href="${esc(href)}" target="_blank" rel="noopener"${ev.link ? "" : ' aria-disabled="true"'}>Go to event <span aria-hidden="true">→</span></a>
        <span class="tk-bars" aria-hidden="true"></span>
      </div>
    </article>`;
}

function setupLineup(root) {
  const track = root.querySelector(".lineup-track");
  if (!track) return;

  // Only events that haven't happened yet, soonest first (a ticket vanishes by itself once its day has passed)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = EVENTS.filter((ev) => {
    const [y, m, d] = ev.date.split("-").map(Number);
    return new Date(y, m - 1, d) >= today;
  }).sort((a, b) => a.date.localeCompare(b.date));

  if (!upcoming.length) {
    track.innerHTML = `<p class="lineup-empty">The next lineup is being mined. Check back soon.</p>`;
    root.querySelector(".lineup-bar")?.setAttribute("hidden", "");
    return;
  }
  track.innerHTML = upcoming.map(ticket).join("");

  // A "Go to event" with no link yet does nothing
  track.addEventListener("click", (e) => {
    const link = e.target.closest(".tk-btn");
    if (link && link.getAttribute("aria-disabled") === "true") e.preventDefault();
  });

  // Arrows: one ticket at a time
  const step = () => (track.querySelector(".tk")?.getBoundingClientRect().width || 300) + 24;
  root.querySelector(".lineup-prev")?.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
  root.querySelector(".lineup-next")?.addEventListener("click", () => track.scrollBy({ left: step(), behavior: "smooth" }));

  // Drag to scroll with a mouse (fingers already scroll it on phones)
  let down = null;
  let moved = false;
  track.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    down = { x: e.clientX, left: track.scrollLeft };
    moved = false;
  });
  window.addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - down.x;
    if (!moved && Math.abs(dx) > 5) {
      moved = true;
      track.classList.add("dragging");
    }
    if (moved) track.scrollLeft = down.left - dx;
  });
  window.addEventListener("pointerup", () => {
    if (!down) return;
    down = null;
    track.classList.remove("dragging");
  });
  // a drag must not count as a click on a ticket's button
  track.addEventListener("click", (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
}
