import { createCutLetter } from "./cutword.js";

// Host dashboard: "Your Events" list and the Create an Event steps.
// Steps 0 (Event Type) and 1 (Basic Info) are built. The rest of the steps show in the bar and open a "coming next" page.
// Nothing is sent anywhere yet: events are kept in this browser (localStorage) until accounts and a database exist.

const STEPS = [
  { name: "Event type", sub: "Select your event type" },
  { name: "Basic info", sub: "Title & description" },
  { name: "Event details", sub: "Category & location" },
  { name: "Schedule", sub: "Date, Time & Capacity" },
  { name: "Tickets", sub: "Create & Manage Tickets" },
  { name: "Partners & artists", sub: "Add performers and partners" },
  { name: "Organizer", sub: "Contact Information" },
  { name: "Review & create", sub: "Check and submit" },
];
const BUILT = 8; // every step exists now

// Commission and payout lines are placeholders until the owner decides PBJ's real terms
const TYPES = [
  { id: "guestlist", icon: "📋", name: "Free Impromptu Event", desc: "Entry only for the guests you approve and admit.", commission: "Free (excl. listing fee)", payout: "N/A" },
  { id: "exclusive", icon: "🔒", name: "Exclusive event", desc: "Tickets are available only on PBJ and no other platform.", commission: "To be set by PBJ", payout: "To be set by PBJ" },
  { id: "open", icon: "🌐", name: "Non-exclusive event", desc: "Tickets are available on multiple platforms.", commission: "To be set by PBJ", payout: "To be set by PBJ" },
];

const DEFAULT_TERMS = `<ul>
<li>Please keep your ticket or booking confirmation ready for check-in. Arrive on time so entry stays smooth.</li>
<li>Carry a valid government photo ID for identity and age checks.</li>
<li>Alcohol is served only to guests of legal drinking age, as per the venue's policy and the laws of Maharashtra.</li>
<li>Guests may be photographed or filmed at the event, and the organizer may use these recordings for promotion.</li>
<li>The organizer may refuse entry to, or remove, anyone who is disruptive, unsafe or breaks these terms.</li>
<li>Tickets are non-refundable and non-transferable unless the organizer says otherwise.</li>
<li>If the event is cancelled or changed, the organizer will tell guests how tickets will be handled.</li>
<li>Please do not bring dangerous objects such as weapons, fireworks or laser devices to the venue.</li>
</ul>`;

const STORE = "pbj-host-events";
const app = document.getElementById("app");
// Inside the website's List Your Event tab the page hides its own top bar
if (location.search.includes("inline")) document.documentElement.classList.add("inline");

const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch { return []; } };
const save = (list) => { try { localStorage.setItem(STORE, JSON.stringify(list)); } catch { toast("Couldn't save: too many or too large images. Remove a few."); } };
const newId = () => "e" + Date.now().toString(36);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const textLen = (html) => { const d = document.createElement("div"); d.innerHTML = html; return d.textContent.trim().length; };

let draft = null; // the event being created or edited

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, 2200);
}


// In-page replacement for confirm() and prompt() (browsers and the preview pane can block those pop-ups)
// ask({ title, message, input?: { placeholder }, ok }) -> resolves to true / the typed text, or null when cancelled
function ask({ title, message = "", input, ok = "OK" }) {
  return new Promise((resolve) => {
    const back = document.createElement("div");
    back.className = "modal-back";
    back.innerHTML = `<div class="modal small" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><div><h3>${esc(title)}</h3></div><button type="button" class="modal-x" data-no aria-label="Close">×</button></div>
      <div class="modal-body">${message ? `<p class="ask-msg">${esc(message)}</p>` : ""}${input ? `<input class="box" id="ask-in" type="text" placeholder="${esc(input.placeholder || "")}" />` : ""}</div>
      <div class="modal-foot"><button type="button" class="btn ghost" data-no>Cancel</button><button type="button" class="btn ask-ok" data-yes>${esc(ok)}</button></div></div>`;
    document.body.append(back);
    const field = back.querySelector("#ask-in");
    const done = (v) => { document.removeEventListener("keydown", onKey); back.remove(); resolve(v); };
    const yes = () => done(field ? field.value.trim() || null : true);
    const onKey = (e) => { if (e.key === "Escape") done(null); if (e.key === "Enter" && field) { e.preventDefault(); yes(); } };
    document.addEventListener("keydown", onKey);
    back.querySelectorAll("[data-no]").forEach((b) => b.addEventListener("click", () => done(null)));
    back.querySelector("[data-yes]").addEventListener("click", yes);
    (field || back.querySelector("[data-yes]")).focus();
  });
}

/* ---------- Paper-cut headings: the same hand-cut wobbling lettering as the website's headlines (see cutword.js) ---------- */
let cutLetters = [];
// Cuts every ".cut" heading inside `root` into paper-cut letters and returns the letters made (a window disposes of its own when it closes)
function cutHeadings(root = app) {
  const made = [];
  root.querySelectorAll(".cut:not([data-cut])").forEach((h) => {
    h.dataset.cut = "1";
    const text = h.textContent.replace(/\s+/g, " ").trim();
    h.setAttribute("aria-label", text);
    h.textContent = "";
    text.split(" ").forEach((word, i, all) => {
      const w = document.createElement("span");
      w.className = "w";
      w.setAttribute("aria-hidden", "true");
      [...word].forEach((ch) => {
        const letter = createCutLetter(ch, { fill: h.dataset.fill || "var(--pop)", shadow: h.dataset.shadow || "var(--brown)", calm: h.hasAttribute("data-level") ? 0 : undefined });
        if (letter) { (root === app ? cutLetters : made).push(letter); w.append(letter.el); } else w.append(document.createTextNode(ch));
      });
      h.append(w);
      if (i < all.length - 1) h.append(" ");
    });
  });
  return made;
}

/* ---------- My events ---------- */
// Status of an event: what guests would see once PBJ has public event pages
const STATUSES = {
  published: { label: "Published", dot: "#2e9e4f", pick: "Publish", desc: "Live on PBJ and open for bookings" },
  coming: { label: "Coming soon", dot: "#f0a830", pick: "Coming soon", desc: "Listed, but bookings aren't open yet" },
  soldout: { label: "Sold out", dot: "#d33a3a", pick: "Sold out", desc: "Bookings closed, still listed" },
  cancelled: { label: "Cancelled", dot: "#f08030", pick: "Cancelled", desc: "Called off, no bookings" },
  draft: { label: "Drafted", dot: "#8c8a80", pick: "Save as draft", desc: "Hidden until you publish" },
};
const statusOf = (e) => (STATUSES[e.status] ? e.status : "draft"); // old "review" events count as drafts
const isPast = (e) => { const end = e.dateTo || e.dateFrom; return !!end && end < iso(new Date()); };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayLine = (e) => {
  if (!e.dateFrom) return "Date not set";
  const [y, m, d] = e.dateFrom.split("-").map(Number);
  const first = `${WEEKDAYS[new Date(y, m - 1, d).getDay()]}, ${d} ${SHORT[m - 1]} ${y}`;
  const more = e.dateTo && e.dateTo !== e.dateFrom ? ` → ${dmy(e.dateTo)}` : "";
  return `${first}${more}${e.start && e.start.h && e.start.m ? ` · ${e.start.h}:${e.start.m}` : ""}`;
};
const eventLink = (e) => `peanutbutterjelly.vip/e/${e.id.replace(/^e/, "").slice(-7)}`;
const TABS = [["all", "All"], ["published", "Published"], ["cancelled", "Cancelled"], ["soldout", "Sold out"], ["draft", "Drafts"], ["past", "Past"]];
const inTab = (e, tab) => (tab === "all" ? true : tab === "past" ? isPast(e) : !isPast(e) && statusOf(e) === tab);
const iconSvg = {
  edit: '<path d="M12 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7"/><path d="M18.4 2.6a2 2 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  tag: '<path d="M20 12 12 20 4 12V4h8z"/><circle cx="8" cy="8" r="1.2"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  ticket: '<path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z"/><path d="M13 5v3M13 11v2M13 16v3"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  dots: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  flip: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
};
const ic = (name, size = "1.3em") => svg(iconSvg[name], size);

// A stand-in for the guest check-in QR code: three corner squares and scattered dots. It can't be scanned; the real code gets embedded later.
function qrPlaceholder(seed) {
  let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0), (h & 1023) / 1023);
  const N = 25, cells = [];
  const finder = (x0, y0) => { for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) if (x === 0 || y === 0 || x === 6 || y === 6 || (x > 1 && x < 5 && y > 1 && y < 5)) cells.push([x0 + x, y0 + y]); };
  finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const inF = (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9); if (!inF && rnd() > 0.52) cells.push([x, y]); }
  return `<svg class="qr" viewBox="0 0 ${N} ${N}" role="img" aria-label="QR code placeholder">${cells.map(([x, y]) => `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`).join("")}</svg>`;
}

function renderList() {
  document.title = "My events — PeanutButterJelly.vip";
  const events = load();
  let tab = "all", query = "", openMenu = null;
  const flipped = new Set(); // tickets currently turned over to show the QR side
  app.innerHTML = `
    <div class="dash-head">
      <div><h1 class="cut">My events</h1><p>Manage your events and see how they're doing.</p></div>
      <div class="head-tools"><label class="search">${ic("search", "1.3em")}<input id="ev-q" type="text" placeholder="Search events…" aria-label="Search events" autocomplete="off" /></label>
        <a class="btn create-btn" href="#/create/0">+ Create event</a></div>
    </div>
    <div class="ev-tabs" role="tablist"></div>
    <div class="event-list"></div>`;
  const tabsEl = app.querySelector(".ev-tabs"), listEl = app.querySelector(".event-list");
  const card = (e) => {
    const st = statusOf(e), S = STATUSES[st], past = isPast(e), done = !!e.submitted;
    const paid = (e.tickets || []).some((t) => t.paid);
    const img = (e.images || []).filter(Boolean)[0];
    const menu = openMenu === `st-${e.id}`, kebab = openMenu === `k-${e.id}`;
    const no = `PBJ-${String(e.id).replace(/\W/g, "").slice(-6).toUpperCase()}`;
    return `<article class="ev-card ticket ${past ? "past" : ""} ${flipped.has(e.id) ? "flipped" : ""}" data-id="${e.id}"><div class="tk">
      <div class="tk-face front"><div class="tk-bgw"><div class="tk-edge"></div><div class="tk-bg"></div></div>
      <div class="tk-stub img" ${img ? `style="background-image:url(${img})"` : ""}>${img ? "" : `<span>${esc((e.title || "?").trim().slice(0, 1).toUpperCase())}</span>`}${past ? '<i class="ev-past">Past</i>' : ""}<button type="button" class="flip" data-act="flip" aria-label="Turn the ticket over to see its QR code" title="Show QR code">${ic("flip", "1.2em")}</button></div>
      <div class="ev-main">
        <div class="ev-top"><div><h3>${esc(e.title || "Untitled event")}</h3><p class="ev-date">${ic("cal", "1.1em")}${dayLine(e)}</p></div>
          <div class="ev-ctl">
            ${past ? "" : `<div class="st-wrap"><button type="button" class="st-btn" data-act="status" aria-haspopup="menu" aria-expanded="${menu}"><i class="dot" style="background:${S.dot}"></i>${S.label}${ic("chev", "1em")}</button>
              <div class="st-menu" ${menu ? "" : "hidden"}><span class="st-h">Change status</span>
                ${["published", "coming", "soldout", "cancelled"].map((k) => `<button type="button" data-set="${k}"><i class="dot" style="background:${STATUSES[k].dot}"></i><span><b>${STATUSES[k].pick}</b><small>${STATUSES[k].desc}</small></span>${st === k ? ic("check", "1.1em") : ""}</button>`).join("")}
                <hr /><button type="button" data-set="draft" class="${st === "draft" ? "cur" : ""}"><i class="dot" style="background:${STATUSES.draft.dot}"></i><span><b>${STATUSES.draft.pick}</b><small>${STATUSES.draft.desc}</small></span>${st === "draft" ? ic("check", "1.1em") : ""}</button></div></div>`}
            <div class="st-wrap"><button type="button" class="kebab" data-act="kebab" aria-label="More options" aria-haspopup="menu" aria-expanded="${kebab}">${ic("dots", "1.3em")}</button>
              <div class="st-menu small" ${kebab ? "" : "hidden"}><button type="button" data-act="dup"><span><b>Duplicate</b></span></button><button type="button" data-act="del" class="dangerous"><span><b>Delete</b></span></button></div></div>
          </div></div>
        <div class="ev-tags"><span class="tag dark1">${esc(TYPE_SHORT[e.type] || "No type")}</span>${(e.tickets || []).length ? `<span class="tag ${paid ? "dark2" : "free"}">${paid ? "Paid" : "Free"}</span>` : ""}${!done ? `<span class="tag soft">Step ${Math.min(e.step ?? 0, STEPS.length - 1) + 1} of ${STEPS.length}</span>` : ""}${past ? '<span class="tag soft">Past</span>' : ""}</div>
        <div class="sold">${ic("ticket", "1.2em")}<b>0</b> sold</div>
        ${done ? `<div class="ev-link">${ic("link", "1.1em")}<span>${eventLink(e)}</span><button type="button" data-act="copy">${ic("copy", "1.1em")}Copy</button></div>` : ""}
        <div class="ev-actions">
          ${past ? "" : `<button type="button" class="act primary" data-act="edit">${ic("edit")}${done ? "Edit" : "Continue"}</button>`}
          <button type="button" class="act" data-act="view">${ic("eye")}View event</button>
          <button type="button" class="act outline" data-act="sales">${ic("chart")}View sales</button>
          ${past ? "" : `<button type="button" class="act" data-act="coupons">${ic("tag")}Coupons</button>`}
        </div></div></div>
      <div class="tk-face tk-back"><div class="tk-bgw"><div class="tk-edge"></div><div class="tk-bg dark"></div></div>
        <div class="tk-stub qrside">${qrPlaceholder(e.id)}<span class="qr-cap">Admit one</span><small>QR code coming soon</small></div>
        <div class="ev-main bk"><span class="bk-cap">PB&amp;J · Admit one</span><h3 class="bk-title">${esc(e.title || "Untitled event")}</h3>
          <p class="bk-text">Guests will show this code at the door to check in.</p><span class="bk-no">Ticket no. ${no}</span>
          ${done ? `<div class="ev-link light">${ic("link", "1.1em")}<span>${eventLink(e)}</span><button type="button" data-act="copy">${ic("copy", "1.1em")}Copy</button></div>` : ""}
          <div class="ev-actions"><button type="button" class="act flipback" data-act="flip">${ic("flip")}Flip back</button></div></div></div>
      </div></article>`;
  };
  const paint = () => {
    tabsEl.innerHTML = TABS.map(([k, n]) => `<button type="button" role="tab" class="ev-tab ${tab === k ? "on" : ""}" data-tab="${k}" aria-selected="${tab === k}">${n}<b>${events.filter((e) => inTab(e, k)).length}</b></button>`).join("");
    const q = query.trim().toLowerCase();
    const shown = events.filter((e) => inTab(e, tab) && (!q || (e.title || "").toLowerCase().includes(q)));
    if (!shown.length) {
      listEl.innerHTML = `<div class="empty"><h2 class="cut" data-fill="var(--brown)" data-shadow="var(--cream)">${events.length ? "Nothing here" : "No events yet"}</h2>
        <p>${events.length ? "No events match this tab or search." : "Got something worth finding? Create your first event and share it with Mumbai."}</p>
        ${events.length ? "" : '<a class="btn" href="#/create/0">+ Create event</a>'}</div>`;
    } else listEl.innerHTML = shown.map(card).join("");
    cutHeadings();
  };
  paint();
  cutHeadings();
  app.querySelector("#ev-q").addEventListener("input", (e) => { query = e.target.value; paint(); });
  tabsEl.addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) { tab = b.dataset.tab; paint(); } });
  const find = (el) => events.find((x) => x.id === el.closest(".ev-card")?.dataset.id);
  const outside = (e) => { if (!app.isConnected || !app.querySelector(".event-list")) { document.removeEventListener("click", outside); return; } if (openMenu && !e.target.closest(".st-wrap")) { openMenu = null; paint(); } };
  document.addEventListener("click", outside);
  listEl.addEventListener("click", async (ev) => {
    const set = ev.target.closest("[data-set]"), act = ev.target.closest("[data-act]");
    if (set) { const e = find(set); e.status = set.dataset.set; save(events); openMenu = null; paint(); toast(`Status: ${STATUSES[e.status].label}`); return; }
    if (!act) return;
    const e = find(act), what = act.dataset.act;
    if (what === "status") { openMenu = openMenu === `st-${e.id}` ? null : `st-${e.id}`; paint(); }
    else if (what === "kebab") { openMenu = openMenu === `k-${e.id}` ? null : `k-${e.id}`; paint(); }
    else if (what === "edit") { draft = e; location.hash = `#/create/${e.submitted ? 1 : Math.min(e.step ?? 0, STEPS.length - 1)}`; }
    else if (what === "view") { draft = e; location.hash = "#/create/7"; }
    else if (what === "flip") { const art = act.closest(".ev-card"); if (art.classList.toggle("flipped")) flipped.add(e.id); else flipped.delete(e.id); }
    else if (what === "coupons") location.hash = `#/event/${e.id}/coupons`;
    else if (what === "sales") location.hash = `#/event/${e.id}/sales`;
    else if (what === "soon") toast(`${act.dataset.what} comes later`);
    else if (what === "copy") { try { await navigator.clipboard.writeText(`https://${eventLink(e)}`); toast("Link copied"); } catch { toast(eventLink(e)); } }
    else if (what === "dup") { const c = JSON.parse(JSON.stringify(e)); c.id = newId(); c.title = `${e.title || "Untitled event"} (copy)`; c.status = "draft"; c.submitted = false; c.step = 1; events.unshift(c); save(events); openMenu = null; paint(); toast("Event duplicated as a draft"); }
    else if (what === "del") { openMenu = null; if (await ask({ title: "Delete this event?", message: "This can't be undone.", ok: "Delete" })) { save(events.filter((x) => x.id !== e.id)); renderList(); } else paint(); }
  });
}

// "Event created!" window: choose what status the new event starts with
function openStatusModal(onDone) {
  const OPTS = [["published", "Publish", "play", '<path d="M6 4l14 8-14 8z"/>'], ["draft", "Drafted", "doc", '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'], ["coming", "Coming soon", "clock", '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'], ["soldout", "Sold out", "ban", '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>']];
  let choice = "";
  const back = document.createElement("div");
  back.className = "modal-back";
  back.innerHTML = `<div class="modal small centered" role="dialog" aria-modal="true" aria-label="Event created">
    <button type="button" class="x-plain" data-close aria-label="Close">×</button>
    <div class="done-ico">${svg('<circle cx="12" cy="12" r="10"/><path d="m7 12.5 3.5 3.5L17 9"/>', "3em")}</div>
    <h2 class="done-h">Event created!</h2><p class="done-p">Choose a status for your event</p>
    <div class="opt-grid">${OPTS.map(([k, n, , d]) => `<button type="button" data-opt="${k}">${svg(d, "1.6em")}<span>${n}</span></button>`).join("")}</div>
    <button type="button" class="btn" id="submit-ev" disabled>Submit event</button></div>`;
  document.body.append(back);
  document.body.style.overflow = "hidden";
  const finish = (v) => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); back.remove(); onDone(v); };
  const onKey = (e) => { if (e.key === "Escape") finish(null); };
  document.addEventListener("keydown", onKey);
  back.querySelectorAll("[data-opt]").forEach((b) => b.addEventListener("click", () => { choice = b.dataset.opt; back.querySelectorAll("[data-opt]").forEach((x) => x.classList.toggle("on", x === b)); back.querySelector("#submit-ev").disabled = false; }));
  back.querySelector("[data-close]").addEventListener("click", () => finish(null));
  back.querySelector("#submit-ev").addEventListener("click", () => { if (choice) finish(choice); });
}

/* ---------- Create an event ---------- */
function stepper(current) {
  const reached = Math.max(draft.reached ?? 0, current);
  return `<div class="card"><div class="stepper" aria-label="Steps">${STEPS.map((s, i) => {
    const open = i <= reached; // steps you have already got to can be revisited, back and forth
    return `<${open ? "button type=\"button\" data-go=\"" + i + "\"" : "div"} class="step ${i === current ? "on" : ""} ${i < current ? "done" : ""} ${i > reached ? "locked" : ""} ${i >= BUILT ? "later" : ""}" ${i === current ? 'aria-current="step"' : ""}>
      <i>${i < current ? "✓" : i}</i><b>${s.name}</b>${i === current && s.sub ? `<small>${s.sub}</small>` : ""}
    </${open ? "button" : "div"}>`;
  }).join("")}</div></div>`;
}

// Each step sets this so that clicking a step in the bar keeps what was typed so far
let saveCurrent = () => {};

function persist(step) {
  const list = load();
  draft.step = step;
  draft.reached = Math.max(draft.reached ?? 0, step);
  draft.status = draft.status || "draft";
  const i = list.findIndex((e) => e.id === draft.id);
  if (i >= 0) list[i] = draft; else list.unshift(draft);
  save(list);
}

function renderCreate(step) {
  if (!draft) draft = { id: newId(), status: "draft", type: "", tickets: [], title: "", description: "", terms: DEFAULT_TERMS, category: "", subs: [], city: "", venueStatus: "", images: [], youtube: "", step: 0 };
  document.title = "Create an event — PeanutButterJelly.vip";
  app.innerHTML = `
    <button class="back" type="button" data-back>‹ Back to your events</button>
    <div class="create-head"><h1 class="cut">Create an event</h1><p>Share your event with the PBJ community.</p></div>
    ${stepper(step)}
    <div class="card" id="step"></div>`;
  app.querySelector("[data-back]").addEventListener("click", () => { saveCurrent(); draft = null; location.hash = "#/"; });
  saveCurrent = () => { if (draft.type || draft.reached) persist(step); };
  app.querySelector(".stepper").addEventListener("click", (e) => {
    const b = e.target.closest("[data-go]");
    if (!b || +b.dataset.go === step) return;
    saveCurrent();
    location.hash = `#/create/${b.dataset.go}`;
  });
  const host = app.querySelector("#step");
  if (step === 0) stepType(host);
  else if (step === 1) stepBasic(host);
  else if (step === 2) stepDetails(host);
  else if (step === 3) stepSchedule(host);
  else if (step === 4) stepTickets(host);
  else if (step === 5) stepPartners(host);
  else if (step === 6) stepOrganizer(host);
  else if (step === 7) stepReview(host);
  else stepComing(host, step);
  cutHeadings();
  window.scrollTo({ top: 0 });
}

function stepType(host) {
  host.innerHTML = `
    <h2 class="section-title cut">Event type</h2>
    <p class="section-sub">Select the type of event you want to create</p>
    <div class="types" role="radiogroup" aria-label="Event type">
      ${TYPES.map((t) => `<button type="button" class="type ${draft.type === t.id ? "on" : ""}" role="radio" aria-checked="${draft.type === t.id}" data-type="${t.id}">
        <span class="ico" aria-hidden="true">${t.icon}</span><h3 class="cut">${t.name}</h3>
        <p class="desc">${t.desc}</p><hr />
        <dl><dt>Commission:</dt><dd>${t.commission}</dd><dt>Payout cycle:</dt><dd>${t.payout}</dd></dl>
      </button>`).join("")}
    </div>
    <p class="notice"><b>Important:</b> Commission is charged on the gross value of the ticket price you list. Please make sure all pricing is accurate to avoid penalties or limits on listing tickets on PBJ.</p>
    <p class="err" id="err" style="display:none">Pick an event type to continue.</p>
    <div class="nav single"><button class="btn dark" type="button" id="next">Next</button></div>`;
  host.querySelectorAll(".type").forEach((b) => b.addEventListener("click", () => {
    draft.type = b.dataset.type;
    host.querySelectorAll(".type").forEach((x) => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-checked", on); });
    host.querySelector("#err").style.display = "none";
  }));
  host.querySelector("#next").addEventListener("click", () => {
    if (!draft.type) { const e = host.querySelector("#err"); e.style.display = "block"; e.style.color = "var(--jam)"; return; }
    persist(1);
    location.hash = "#/create/1";
  });
}

/* A rich text editor built on the browser's own editing commands. Same tools as the SkillBox editor:
   undo/redo, bold/italic/underline/strike, sub/superscript, alignment, indent, lists, style, font, size,
   text and highlight colour, link, image, YouTube video, divider, clear formatting and an HTML view. */
const ico = (d) => `<svg viewBox="0 0 24 24" width="1.5em" height="1.5em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const lines = (...y) => ico(y.map(([x1, x2, yy]) => `<path d="M${x1} ${yy}H${x2}"/>`).join(""));
const STYLES = [["p", "Default"], ["h1", "Heading 1"], ["h2", "Heading 2"], ["h3", "Heading 3"], ["blockquote", "Quote"], ["pre", "Code"]];
const FONTS = ["Default", "Arial", "Georgia", "Times New Roman", "Courier New", "Verdana", "Chivo Mono", "Inter Tight"];
const TOOLS = [
  ["undo", ico('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'), "Undo"],
  ["redo", ico('<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>'), "Redo"], "|",
  ["bold", "<b>B</b>", "Bold"], ["italic", "<i>I</i>", "Italic"], ["underline", "<u>U</u>", "Underline"], ["strikeThrough", "<s>S</s>", "Strikethrough"],
  ["subscript", "X<sub>2</sub>", "Subscript"], ["superscript", "X<sup>2</sup>", "Superscript"], "|",
  ["justifyLeft", lines([4, 20, 6], [4, 14, 12], [4, 18, 18]), "Align left"],
  ["justifyCenter", lines([4, 20, 6], [7, 17, 12], [5, 19, 18]), "Align centre"],
  ["justifyRight", lines([4, 20, 6], [10, 20, 12], [6, 20, 18]), "Align right"],
  ["justifyFull", lines([4, 20, 6], [4, 20, 12], [4, 20, 18]), "Justify"], "|",
  ["indent", ico('<path d="M3 6h18M11 12h10M11 18h10M3 9l3 3-3 3"/>'), "Indent"],
  ["outdent", ico('<path d="M3 6h18M11 12h10M11 18h10M6 9l-3 3 3 3"/>'), "Outdent"], "|",
  ["insertUnorderedList", ico('<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>'), "Bullet list"],
  ["insertOrderedList", ico('<path d="M10 6h11M10 12h11M10 18h11M3.5 5l1.5-1v4M3 13.5h2.5L3 17h2.5"/>'), "Numbered list"], "|",
  ["formatBlock", "select:style"], ["fontName", "select:font"], ["fontSize", "select:size"], "|",
  ["foreColor", "color:A", "Text colour", "#463721"], ["hiliteColor", "color:bg", "Highlight colour", "#ffe386"], "|",
  ["createLink", ico('<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'), "Add link"],
  ["unlink", ico('<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/><path d="M3 3l18 18"/>'), "Remove link"],
  ["image", ico('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m21 16-5-5-9 9"/>'), "Add image"],
  ["video", ico('<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3z" fill="currentColor"/>'), "Add YouTube video"],
  ["insertHorizontalRule", ico('<path d="M4 12h16"/>'), "Divider line"],
  ["removeFormat", ico('<path d="m7 21-4-4a2 2 0 0 1 0-3L14 3a2 2 0 0 1 3 0l4 4a2 2 0 0 1 0 3L11 21H7z"/><path d="M8 11l6 6"/>'), "Clear formatting"],
  ["source", ico('<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>'), "Show HTML"],
];

// Pasted or typed HTML never keeps scripts or event handlers
function clean(html) {
  const d = document.createElement("div");
  d.innerHTML = html;
  d.querySelectorAll("script, style, object, embed").forEach((n) => n.remove());
  d.querySelectorAll("*").forEach((n) => [...n.attributes].forEach((a) => { if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) n.removeAttribute(a.name); }));
  return d.innerHTML;
}

function youtubeEmbed(url) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? `<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/${m[1]}" title="Video" frameborder="0" allowfullscreen style="max-width:100%"></iframe>` : "";
}

// Photos are shrunk before they go in, so a draft stays small
function readImage(file, done, maxWidth = 1200) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const k = Math.min(1, maxWidth / img.width);
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    done(c.toDataURL("image/jpeg", 0.82));
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast("Couldn't read that image"); };
  img.src = url;
}

function editor({ html, placeholder, tall }) {
  const wrap = document.createElement("div");
  wrap.className = "box rte";
  const tool = (t) => {
    if (t === "|") return '<span class="sep"></span>';
    const [cmd, face, title, init] = t;
    if (face.startsWith("select:")) return `<div class="tb-dd" data-dd="${face.slice(7)}"></div>`;
    if (face.startsWith("color:")) return `<label class="colour" title="${title}"><span class="${face === "color:A" ? "cA" : "cBg"}" aria-hidden="true">A</span><input type="color" value="${init}" data-cmd="${cmd}" aria-label="${title}" /></label>`;
    return `<button type="button" data-cmd="${cmd}" title="${title}" aria-label="${title}">${face}</button>`;
  };
  wrap.innerHTML = `<div class="rte-bar" role="toolbar">${TOOLS.map(tool).join("")}</div>
    <div class="rte-body ${tall ? "tall" : ""}" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="${placeholder}"></div>
    <textarea class="rte-src box ${tall ? "tall" : ""}" hidden spellcheck="false" aria-label="HTML"></textarea>
    <input type="file" accept="image/*" hidden />`;
  const body = wrap.querySelector(".rte-body"), src = wrap.querySelector(".rte-src"), file = wrap.querySelector("input[type=file]");
  body.innerHTML = html;
  const changed = () => body.dispatchEvent(new Event("input"));

  // Remember where the cursor or selection was, since the dropdowns and colour pickers take focus away
  let saved = null;
  document.addEventListener("selectionchange", () => {
    const sel = getSelection();
    if (sel.rangeCount && body.contains(sel.anchorNode)) saved = sel.getRangeAt(0).cloneRange();
  });
  const restore = () => {
    body.focus();
    if (saved) { const sel = getSelection(); sel.removeAllRanges(); sel.addRange(saved); }
  };
  const run = (cmd, val = null) => { restore(); document.execCommand("styleWithCSS", false, cmd === "hiliteColor" || cmd === "foreColor"); document.execCommand(cmd, false, val); changed(); };

  wrap.querySelector(".rte-bar").addEventListener("mousedown", (e) => { if (e.target.closest("button")) e.preventDefault(); }); // keep the text selected
  wrap.querySelectorAll("button[data-cmd]").forEach((b) => b.addEventListener("click", async () => {
    const cmd = b.dataset.cmd;
    if (cmd === "createLink") { const url = await ask({ title: "Add a link", input: { placeholder: "https://…" }, ok: "Add link" }); if (url) run(cmd, /^(https?:|mailto:)/.test(url) ? url : "https://" + url); }
    else if (cmd === "image") { restore(); file.click(); }
    else if (cmd === "video") {
      const url = await ask({ title: "Add a YouTube video", input: { placeholder: "Paste the YouTube link" }, ok: "Add video" });
      if (!url) return;
      const tag = youtubeEmbed(url);
      if (tag) run("insertHTML", tag); else toast("That doesn't look like a YouTube link");
    } else if (cmd === "source") {
      const on = src.hidden;
      if (on) { src.value = body.innerHTML; src.hidden = false; body.hidden = true; }
      else { body.innerHTML = clean(src.value); src.hidden = true; body.hidden = false; changed(); }
      b.classList.toggle("active", on);
      wrap.querySelectorAll(".rte-bar > :not([data-cmd=source])").forEach((x) => { x.style.opacity = on ? 0.35 : ""; x.style.pointerEvents = on ? "none" : ""; });
    } else run(cmd);
  }));
  // Style, font and size are dropdown lists (same look as the other dropdowns on this page)
  const dd = (name) => wrap.querySelector(`[data-dd="${name}"]`);
  dropdown(dd("style"), STYLES.map(([, n]) => n), "Default", (n) => run("formatBlock", STYLES.find(([, x]) => x === n)[0]));
  dropdown(dd("font"), FONTS, "Default", (f) => run("fontName", f === "Default" ? "Chivo Mono" : f));
  dropdown(dd("size"), ["1", "2", "3", "4", "5", "6", "7"], "3", (n) => run("fontSize", n));
  wrap.querySelectorAll("input[type=color]").forEach((c) => c.addEventListener("input", () => run(c.dataset.cmd, c.value)));
  file.addEventListener("change", () => {
    if (file.files[0]) readImage(file.files[0], (data) => run("insertImage", data));
    file.value = "";
  });
  src.addEventListener("input", () => { body.innerHTML = clean(src.value); changed(); });
  // Pasted text keeps simple formatting but never scripts
  body.addEventListener("paste", (e) => {
    e.preventDefault();
    const h = e.clipboardData.getData("text/html");
    if (h) document.execCommand("insertHTML", false, clean(h.replace(/<(meta|link)[^>]*>/gi, "")).replace(/ (style|class|id)="[^"]*"/g, ""));
    else document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
  });
  return { wrap, body };
}

function stepBasic(host) {
  host.innerHTML = `
    <h2 class="section-title cut">Basic info</h2>
    <div class="field" id="f-title">
      <label for="title">Event title <span class="req">*</span></label>
      <input id="title" class="box" type="text" maxlength="120" placeholder="e.g. Sunday Linocut Social at Kala Ghoda" />
      <p class="hint">Make it catchy and descriptive</p>
      <p class="err">Give your event a title.</p>
    </div>
    <div class="field" id="f-desc">
      <span class="lab">Description <span class="req">*</span> <span style="font-weight:400;opacity:.55;text-transform:none">Tell attendees what to expect</span></span>
      <div class="slot"></div>
      <p class="hint count"><span id="c-desc">0</span>/3500</p>
      <p class="err">Tell attendees a little about the event.</p>
    </div>
    <div class="field" id="f-terms">
      <span class="lab">Terms &amp; conditions <span class="opt">Optional</span></span>
      <div class="slot"></div>
      <p class="hint count"><span id="c-terms">0</span>/10000</p>
    </div>
    <div class="nav"><button class="btn dark prev" type="button" id="prev">Previous</button><button class="btn" type="button" id="next">Next</button></div>`;

  const title = host.querySelector("#title");
  title.value = draft.title;
  const desc = editor({ html: draft.description, placeholder: "Tell attendees what to expect", max: 3500 });
  const terms = editor({ html: draft.terms, placeholder: "Add your terms and conditions", max: 10000, tall: true });
  host.querySelector("#f-desc .slot").append(desc.wrap);
  host.querySelector("#f-terms .slot").append(terms.wrap);

  const counter = (ed, out, max) => {
    const upd = () => {
      const n = textLen(ed.body.innerHTML);
      out.textContent = n;
      out.style.color = n > max ? "var(--jam)" : "";
    };
    ed.body.addEventListener("input", upd);
    upd();
  };
  counter(desc, host.querySelector("#c-desc"), 3500);
  counter(terms, host.querySelector("#c-terms"), 10000);

  const collect = () => {
    draft.title = title.value.trim();
    draft.description = desc.body.innerHTML.trim();
    draft.terms = terms.body.innerHTML.trim();
  };
  saveCurrent = () => { collect(); persist(1); };
  host.querySelector("#prev").addEventListener("click", () => { collect(); persist(0); location.hash = "#/create/0"; });
  host.querySelector("#next").addEventListener("click", () => {
    collect();
    const badTitle = !draft.title;
    const dLen = textLen(draft.description), tLen = textLen(draft.terms);
    const badDesc = !dLen || dLen > 3500;
    host.querySelector("#f-title").classList.toggle("bad", badTitle);
    host.querySelector("#f-desc").classList.toggle("bad", badDesc);
    host.querySelector("#f-desc .err").textContent = dLen > 3500 ? "That's over 3500 characters. Please trim it." : "Tell attendees a little about the event.";
    if (tLen > 10000) { toast("Terms are over 10000 characters"); return; }
    if (badTitle || badDesc) { host.querySelector(".bad")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    persist(2);
    location.hash = "#/create/2";
  });
  title.addEventListener("input", () => host.querySelector("#f-title").classList.remove("bad"));
}

/* ---------- Step 2: Event details ---------- */
const CATEGORIES = {
  "Music": ["Live gig", "DJ night", "Open mic", "Classical & jazz", "Indie", "Hip-hop", "Devotional & folk", "Karaoke"],
  "Comedy": ["Stand-up", "Improv", "Open mic comedy", "Storytelling"],
  "Art & craft": ["Pottery", "Painting", "Printmaking", "Crochet & textiles", "Calligraphy", "Photography walk", "Sketching", "Jewellery making"],
  "Food & drink": ["Tasting", "Supper club", "Cooking class", "Coffee & chai", "Cocktails", "Street food walk", "Baking"],
  "Nightlife": ["Club night", "Rooftop party", "Themed party", "Silent disco", "Day party"],
  "Theatre & film": ["Play", "Screening", "Poetry & spoken word", "Dance", "Book reading"],
  "Wellness & sport": ["Yoga", "Run club", "Breathwork", "Sound bath", "Cycling", "Trek & outdoors", "Dance fitness"],
  "Games & hobbies": ["Board games", "Quiz night", "Gaming", "Chess", "Trivia", "Book club"],
  "Markets & pop-ups": ["Flea market", "Pop-up shop", "Thrift swap", "Art fair", "Zine fair"],
  "Community": ["Meetup", "Workshop", "Talk", "Networking", "Volunteering"],
};
const CITIES = ["Mumbai", "Navi Mumbai", "Thane", "Pune", "Delhi", "New Delhi", "Gurugram", "Noida", "Bengaluru", "Hyderabad", "Chennai", "Kolkata", "Ahmedabad", "Jaipur", "Goa", "Chandigarh", "Lucknow", "Indore", "Kochi", "Surat", "Nagpur", "Nashik", "Vadodara", "Bhopal", "Coimbatore", "Mysuru", "Udaipur", "Dehradun", "Rishikesh"];
const MAX_IMAGES = 10, MAX_MB = 20;

function stepDetails(host) {
  host.innerHTML = `
    <h2 class="section-title cut">Event details</h2>
    <div class="field" id="f-cat">
      <label for="cat">Category <span class="req">*</span></label>
      <div class="combo half">
        <button type="button" class="box datebtn" id="catbtn" aria-haspopup="listbox" aria-expanded="false"><span id="catlabel"></span>
          <svg viewBox="0 0 24 24" width="1.4em" height="1.4em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
        <div class="pop" id="catpop" hidden>
          <label class="pop-search"><svg viewBox="0 0 24 24" width="1.4em" height="1.4em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
            <input id="catq" type="text" autocomplete="off" placeholder="Search category…" aria-label="Search category" /></label>
          <ul id="catlist" role="listbox"></ul>
        </div>
      </div>
      <p class="err">Pick a category.</p>
    </div>
    <div class="field" id="f-subs">
      <span class="lab">Sub categories <span class="req">*</span> (up to 5)</span>
      <div class="subbox">
        <div class="chips" id="subs"></div>
        <div class="combo subadd">
          <button type="button" class="addbtn" id="subadd" aria-haspopup="listbox" aria-expanded="false"><span aria-hidden="true">+</span> Add</button>
          <div class="pop" id="subpop" hidden>
            <label class="pop-search"><svg viewBox="0 0 24 24" width="1.4em" height="1.4em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
              <input id="subq" type="text" autocomplete="off" placeholder="Search sub category…" aria-label="Search sub category" /></label>
            <ul id="sublist" role="listbox" aria-multiselectable="true"></ul>
          </div>
        </div>
      </div>
      <p class="hint count" id="subcount"></p>
      <p class="err">Pick at least one sub category.</p>
    </div>
    <div class="two">
      <div class="field" id="f-city">
        <label for="city">City <span class="req">*</span></label>
        <div class="combo">
          <input id="city" class="box" type="text" autocomplete="off" placeholder="Search city" role="combobox" aria-expanded="false" aria-controls="city-list" />
          <ul class="combo-list" id="city-list" role="listbox" hidden></ul>
        </div>
        <p class="hint">Type 3 or more letters to search</p>
        <p class="err">Choose a city from the list.</p>
      </div>
      <div class="field">
        <label for="venue">Venue</label>
        <div class="combo">
          <button type="button" class="box datebtn" id="venuebtn" aria-haspopup="listbox" aria-expanded="false"><span id="venuelabel"></span>
            <svg viewBox="0 0 24 24" width="1.4em" height="1.4em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
          <div class="pop" id="venuepop" hidden><ul id="venuelist" role="listbox"></ul></div>
        </div>
      </div>
      <div class="field" id="f-pick" hidden>
        <span class="lab">Select venue <span class="req">*</span></span>
        <div class="combo">
          <button type="button" class="box datebtn" id="pickbtn" aria-haspopup="listbox" aria-expanded="false"><span id="picklabel"></span>
            <svg viewBox="0 0 24 24" width="1.4em" height="1.4em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
          <button type="button" class="clear-x" id="pickclear" aria-label="Clear venue" title="Clear venue" hidden>×</button>
          <div class="pop" id="pickpop" hidden>
            <label class="pop-search"><svg viewBox="0 0 24 24" width="1.4em" height="1.4em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
              <input id="pickq" type="text" autocomplete="off" placeholder="Search venue…" aria-label="Search venue" /></label>
            <ul id="picklist" role="listbox"></ul>
          </div>
        </div>
        <p class="hint" id="pickaddr" hidden></p>
        <p class="err">Choose the venue.</p>
      </div>
    </div>
    <div class="field">
      <span class="lab">Event cover image</span>
      <p class="notice bad-note"><b>Important:</b> Cover images must not contain logos or branding of other ticketing platforms or competitors.</p>
    </div>
    <div class="field" id="f-media">
      <span class="lab">Images &amp; videos <span class="req">*</span></span>
      <label class="drop" id="drop" tabindex="0">
        <svg viewBox="0 0 24 24" width="3em" height="3em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m21 16-5-5-9 9"/></svg>
        <b>Drag &amp; drop or click to upload</b>
        <span>PNG, JPEG, WEBP · Max ${MAX_MB}MB · Up to ${MAX_IMAGES} images · 1080×1350px recommended</span>
        <input type="file" id="files" accept="image/png,image/jpeg,image/webp" multiple hidden />
      </label>
      <div class="thumbs" id="thumbs"></div>
      <p class="err">Add at least one image.</p>
    </div>
    <div class="field">
      <label for="yt">YouTube video <span class="opt">Optional</span></label>
      <input id="yt" class="box" type="url" placeholder="Enter YouTube video URL (e.g. https://www.youtube.com/watch?v=…)" />
      <p class="err" id="yt-err" style="display:none">That doesn't look like a YouTube link.</p>
    </div>
    <div class="nav"><button class="btn dark prev" type="button" id="prev">Previous</button><button class="btn" type="button" id="next">Next</button></div>`;

  const $ = (q) => host.querySelector(q);
  const subs = $("#subs"), city = $("#city"), list = $("#city-list");
  const subPop = $("#subpop"), subQ = $("#subq"), subList = $("#sublist"), subAdd = $("#subadd");
  const paintSubList = () => {
    const q = subQ.value.trim().toLowerCase();
    const hits = (CATEGORIES[draft.category] || []).filter((o) => o.toLowerCase().includes(q));
    subList.innerHTML = hits.length ? hits.map((o) => `<li role="option" tabindex="-1" data-sub="${esc(o)}" aria-selected="${draft.subs.includes(o)}" class="${draft.subs.includes(o) ? "sel" : ""}"><span>${esc(o)}</span>${draft.subs.includes(o) ? "<b>✓</b>" : ""}</li>`).join("") : '<li class="none">No match</li>';
  };
  const paintSubs = () => {
    subs.innerHTML = draft.subs.map((o) => `<span class="tag">${esc(o)}<button type="button" data-rm-sub="${esc(o)}" aria-label="Remove ${esc(o)}">×</button></span>`).join("");
    $("#subcount").innerHTML = `<b>${draft.subs.length}</b>/5 sub-categories selected${CATEGORIES[draft.category] ? "" : " · pick a category first"}`;
    subAdd.disabled = !CATEGORIES[draft.category] || draft.subs.length >= 5;
    if (!subPop.hidden) paintSubList();
  };
  const setSub = (on) => { subPop.hidden = !on; subAdd.setAttribute("aria-expanded", on); if (on) { subQ.value = ""; paintSubList(); subQ.focus(); } };
  paintSubs();

  // Category: a dropdown with a search box on top
  const catBtn = $("#catbtn"), catPop = $("#catpop"), catQ = $("#catq"), catList = $("#catlist");
  const catLabel = () => { $("#catlabel").textContent = draft.category || "Select a category"; $("#catlabel").classList.toggle("ph", !draft.category); };
  const paintCats = () => {
    const q = catQ.value.trim().toLowerCase();
    const hits = Object.keys(CATEGORIES).filter((c) => c.toLowerCase().includes(q));
    catList.innerHTML = hits.length ? hits.map((c) => `<li role="option" tabindex="-1" data-cat="${esc(c)}" aria-selected="${c === draft.category}" class="${c === draft.category ? "sel" : ""}">${esc(c)}</li>`).join("") : '<li class="none">No match</li>';
  };
  const setCat = (on) => { catPop.hidden = !on; catBtn.setAttribute("aria-expanded", on); if (on) { catQ.value = ""; paintCats(); catQ.focus(); } };
  catLabel();
  catBtn.addEventListener("click", () => setCat(catPop.hidden));
  catQ.addEventListener("input", paintCats);
  catQ.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { setCat(false); catBtn.focus(); }
    if (e.key === "Enter") { e.preventDefault(); catList.querySelector("[data-cat]")?.click(); }
  });
  catList.addEventListener("click", (e) => {
    const li = e.target.closest("[data-cat]");
    if (!li) return;
    if (draft.category !== li.dataset.cat) { draft.category = li.dataset.cat; draft.subs = []; paintSubs(); }
    catLabel(); setCat(false); $("#f-cat").classList.remove("bad");
  });
  const catOutside = (e) => { if (!host.isConnected) { document.removeEventListener("click", catOutside); return; } if (!catPop.hidden && !e.composedPath().includes(catPop.parentElement)) setCat(false); };
  document.addEventListener("click", catOutside);
  subAdd.addEventListener("click", () => setSub(subPop.hidden));
  subQ.addEventListener("input", paintSubList);
  subQ.addEventListener("keydown", (e) => { if (e.key === "Escape") { setSub(false); subAdd.focus(); } if (e.key === "Enter") { e.preventDefault(); subList.querySelector("[data-sub]")?.click(); } });
  subList.addEventListener("click", (e) => {
    const li = e.target.closest("[data-sub]");
    if (!li) return;
    const v = li.dataset.sub, i = draft.subs.indexOf(v);
    if (i >= 0) draft.subs.splice(i, 1);
    else if (draft.subs.length >= 5) { toast("You can pick up to 5 sub categories"); return; }
    else draft.subs.push(v);
    paintSubs();
    if (draft.subs.length >= 5) setSub(false);
    $("#f-subs").classList.remove("bad");
  });
  subs.addEventListener("click", (e) => {
    const b = e.target.closest("[data-rm-sub]");
    if (!b) return;
    draft.subs = draft.subs.filter((x) => x !== b.dataset.rmSub);
    paintSubs();
  });
  const subOutside = (e) => { if (!host.isConnected) { document.removeEventListener("click", subOutside); return; } if (!subPop.hidden && !e.composedPath().includes(subPop.parentElement)) setSub(false); };
  document.addEventListener("click", subOutside);

  // City: type 3+ letters, then pick from the list
  city.value = draft.city;
  const closeList = () => { list.hidden = true; city.setAttribute("aria-expanded", "false"); };
  city.addEventListener("input", () => {
    draft.city = ""; // only a picked city counts
    const q = city.value.trim().toLowerCase();
    if (q.length < 3) { closeList(); return; }
    const hits = CITIES.filter((c) => c.toLowerCase().includes(q));
    list.innerHTML = hits.length ? hits.map((c) => `<li role="option" data-city="${c}" tabindex="-1">${c}</li>`).join("") : '<li class="none">No match yet</li>';
    list.hidden = false; city.setAttribute("aria-expanded", "true");
  });
  const pick = (c) => { draft.city = c; city.value = c; closeList(); $("#f-city").classList.remove("bad"); };
  list.addEventListener("mousedown", (e) => { const li = e.target.closest("[data-city]"); if (li) { e.preventDefault(); pick(li.dataset.city); } });
  city.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { const first = list.querySelector("[data-city]"); if (first && !list.hidden) { e.preventDefault(); pick(first.dataset.city); } }
    if (e.key === "Escape") closeList();
  });
  city.addEventListener("blur", () => { closeList(); if (!draft.city) { const m = CITIES.find((c) => c.toLowerCase() === city.value.trim().toLowerCase()); if (m) pick(m); } });

  // Venue status: same dropdown look as Category (no search box needed for two choices)
  const venueBtn = $("#venuebtn"), venuePop = $("#venuepop"), venueList = $("#venuelist");
  const VENUES = ["Decided", "To be announced"];
  const venueLabel = () => { $("#venuelabel").textContent = draft.venueStatus || "Select venue status"; $("#venuelabel").classList.toggle("ph", !draft.venueStatus); };
  const paintVenues = () => { venueList.innerHTML = VENUES.map((v) => `<li role="option" tabindex="-1" data-venue="${v}" aria-selected="${v === draft.venueStatus}" class="${v === draft.venueStatus ? "sel" : ""}">${v}</li>`).join(""); };
  const setVenue = (on) => { venuePop.hidden = !on; venueBtn.setAttribute("aria-expanded", on); if (on) paintVenues(); };
  venueLabel();
  venueBtn.addEventListener("click", () => setVenue(venuePop.hidden));
  venueList.addEventListener("click", (e) => { const li = e.target.closest("[data-venue]"); if (!li) return; draft.venueStatus = draft.venueStatus === li.dataset.venue ? "" : li.dataset.venue; venueLabel(); setVenue(false); if (typeof syncPick === "function") syncPick(); });
  venueBtn.addEventListener("keydown", (e) => { if (e.key === "Escape") setVenue(false); });
  const venueOutside = (e) => { if (!host.isConnected) { document.removeEventListener("click", venueOutside); return; } if (!venuePop.hidden && !e.composedPath().includes(venuePop.parentElement)) setVenue(false); };
  document.addEventListener("click", venueOutside);

  // When the venue is decided, find it on the map. Searches OpenStreetMap places (free, no account); typing a name by hand also works.
  const pickBtn = $("#pickbtn"), pickPop = $("#pickpop"), pickQ = $("#pickq"), pickList = $("#picklist");
  let found = [], status = "", timer = 0, ctrl = null;
  const pickLabel = () => {
    $("#picklabel").textContent = draft.venue || "Search venue…"; $("#picklabel").classList.toggle("ph", !draft.venue); $("#pickclear").hidden = !draft.venue;
    const a = $("#pickaddr"); a.hidden = !(draft.venue && draft.venueAddress); a.textContent = draft.venueAddress || "";
  };
  const syncPick = () => { $("#f-pick").hidden = draft.venueStatus !== "Decided"; if (draft.venueStatus !== "Decided") { draft.venue = ""; draft.venueAddress = ""; draft.venueLat = draft.venueLon = null; } pickLabel(); };
  const paintPick = () => {
    const q = pickQ.value.trim();
    const current = draft.venue && !q ? `<li role="option" tabindex="-1" data-pick-clear class="clear-row"><span>Clear “${esc(draft.venue)}”</span><b>×</b></li>` : "";
    const places = found.map((f, i) => `<li role="option" tabindex="-1" data-place="${i}" class="place"><span class="pin">${svg('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>', "1.3em")}</span><span><b>${esc(f.name)}</b><small>${esc(f.address)}</small></span></li>`).join("");
    const typed = q.length >= 2 ? `<li role="option" tabindex="-1" data-pick="${esc(q)}" class="other"><span class="plus">+</span><span><b>Use “${esc(q)}”</b><small>Add venue not in list</small></span></li>` : "";
    const note = status ? `<li class="none">${esc(status)}</li>` : q.length < 3 ? '<li class="none">Type 3 or more letters to find a place</li>' : "";
    pickList.innerHTML = current + places + typed + note + (places ? '<li class="none credit">Places from OpenStreetMap</li>' : "");
  };
  // Look places up a moment after typing stops (the free service asks for no more than one search a second)
  const search = async (q) => {
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    status = "Searching…"; found = []; paintPick();
    try {
      const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=in&accept-language=en&viewbox=72.70,19.35,73.10,18.85&q=" + encodeURIComponent(q);
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      found = data.map((r) => {
        const parts = r.display_name.split(", ");
        const name = r.name || parts[0];
        return { name, address: parts.slice(r.name ? 1 : 1, 4).join(", ") || r.display_name, full: r.display_name, lat: +r.lat, lon: +r.lon };
      });
      status = found.length ? "" : "No places found. You can still use what you typed.";
    } catch (err) {
      if (err.name === "AbortError") return;
      found = []; status = "Couldn't reach the map search. You can still type the venue name.";
    }
    paintPick();
  };
  const setPick = (on) => { pickPop.hidden = !on; pickBtn.setAttribute("aria-expanded", on); if (on) { pickQ.value = ""; found = []; status = ""; paintPick(); pickQ.focus(); } };
  pickBtn.addEventListener("click", () => setPick(pickPop.hidden));
  pickQ.addEventListener("input", () => {
    clearTimeout(timer); if (ctrl) ctrl.abort();
    const q = pickQ.value.trim();
    found = []; status = "";
    paintPick();
    if (q.length >= 3) timer = setTimeout(() => search(q), 500);
  });
  pickQ.addEventListener("keydown", (e) => { if (e.key === "Escape") { setPick(false); pickBtn.focus(); } if (e.key === "Enter") { e.preventDefault(); (pickList.querySelector("[data-place]") || pickList.querySelector("[data-pick]"))?.click(); } });
  $("#pickclear").addEventListener("click", () => { draft.venue = ""; draft.venueAddress = ""; draft.venueLat = draft.venueLon = null; pickLabel(); setPick(false); });
  pickList.addEventListener("click", (e) => {
    if (e.target.closest("[data-pick-clear]")) { draft.venue = ""; draft.venueAddress = ""; draft.venueLat = draft.venueLon = null; pickLabel(); setPick(false); return; }
    const place = e.target.closest("[data-place]"), typed = e.target.closest("[data-pick]");
    if (place) { const f = found[+place.dataset.place]; draft.venue = f.name; draft.venueAddress = f.full; draft.venueLat = f.lat; draft.venueLon = f.lon; }
    else if (typed) { draft.venue = typed.dataset.pick; draft.venueAddress = ""; draft.venueLat = draft.venueLon = null; }
    else return;
    pickLabel(); setPick(false); $("#f-pick").classList.remove("bad");
  });
  const pickOutside = (e) => { if (!host.isConnected) { document.removeEventListener("click", pickOutside); return; } if (!pickPop.hidden && !e.composedPath().includes(pickPop.parentElement)) setPick(false); };
  document.addEventListener("click", pickOutside);
  syncPick();

  // Images: drag and drop or click; shrunk before saving so a draft stays small
  const drop = $("#drop"), files = $("#files"), thumbs = $("#thumbs");
  const paintThumbs = () => {
    thumbs.innerHTML = draft.images.map((src, i) => `<figure class="thumb"><img src="${src}" alt="Event image ${i + 1}" /><button type="button" data-rm="${i}" aria-label="Remove image ${i + 1}">×</button>${i === 0 ? "<figcaption>Cover</figcaption>" : ""}</figure>`).join("");
  };
  paintThumbs();
  const add = (fileList) => {
    [...fileList].forEach((f) => {
      if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) { toast(`${f.name} isn't a PNG, JPEG or WEBP`); return; }
      if (f.size > MAX_MB * 1024 * 1024) { toast(`${f.name} is over ${MAX_MB}MB`); return; }
      if (draft.images.length >= MAX_IMAGES) { toast(`Up to ${MAX_IMAGES} images`); return; }
      draft.images.push(null); // keeps the order while it loads
      const slot = draft.images.length - 1;
      readImage(f, (data) => { draft.images[slot] = data; paintThumbs(); $("#f-media").classList.remove("bad"); });
    });
  };
  files.addEventListener("change", () => { add(files.files); files.value = ""; });
  drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); files.click(); } });
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => add(e.dataTransfer.files));
  thumbs.addEventListener("click", (e) => { const b = e.target.closest("[data-rm]"); if (b) { draft.images.splice(+b.dataset.rm, 1); paintThumbs(); } });

  const yt = $("#yt");
  yt.value = draft.youtube;
  yt.addEventListener("input", () => { draft.youtube = yt.value.trim(); $("#yt-err").style.display = "none"; });

  saveCurrent = () => { draft.images = draft.images.filter(Boolean); persist(2); };
  $("#prev").addEventListener("click", () => { saveCurrent(); location.hash = "#/create/1"; });
  $("#next").addEventListener("click", () => {
    draft.images = draft.images.filter(Boolean);
    const checks = [["#f-cat", !!draft.category], ["#f-subs", draft.subs.length > 0], ["#f-city", !!draft.city], ["#f-media", draft.images.length > 0], ["#f-pick", draft.venueStatus !== "Decided" || !!draft.venue]];
    checks.forEach(([q, ok]) => $(q).classList.toggle("bad", !ok));
    const badYt = draft.youtube && !youtubeEmbed(draft.youtube);
    $("#yt-err").style.display = badYt ? "block" : "none";
    const first = host.querySelector(".bad") || (badYt && $("#yt"));
    if (first) { first.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    persist(3);
    location.hash = "#/create/3";
  });
}

/* ---------- Step 3: Schedule ---------- */
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const prettyDate = (v) => { const [y, m, d] = v.split("-").map(Number); return `${SHORT[m - 1]} ${d}, ${y}`; };
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const timeCombo = (id, k, ph) => `<div class="combo">
    <button type="button" class="box datebtn" id="${id}-${k}" aria-haspopup="listbox" aria-expanded="false" aria-label="${k === "h" ? "Hour" : "Minutes"}"><span class="tl"></span>
      <svg viewBox="0 0 24 24" width="1.4em" height="1.4em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
    <div class="pop" hidden><ul role="listbox" data-ph="${ph}"></ul></div></div>`;
const timeSelects = (id) => `<div class="time-row">${timeCombo(id, "h", "HH")}${timeCombo(id, "m", "MM")}</div>`;

function stepSchedule(host) {
  if (draft.dates?.length) { draft.dateFrom = draft.dates[0]; draft.dateTo = draft.dates[draft.dates.length - 1]; } // older drafts
  delete draft.dates; draft.dateFrom ??= ""; draft.dateTo ??= ""; draft.start ??= { h: "", m: "" }; draft.end ??= { h: "", m: "" }; draft.showEnd ??= false;
  host.innerHTML = `
    <h2 class="section-title cut">Schedule</h2>
    <div class="field" id="f-dates">
      <span class="lab">Event dates <span class="req">*</span></span>
      <div class="combo">
        <button type="button" class="box datebtn" id="datebtn" aria-haspopup="dialog" aria-expanded="false"><span id="datelabel"></span>
          <svg viewBox="0 0 24 24" width="1.6em" height="1.6em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg></button>
        <div class="cal" id="cal" role="dialog" aria-label="Choose dates" hidden></div>
      </div>
      <p class="hint">Pick the first and last day. For one day, tap it twice.</p>
      <p class="err">Pick at least one date.</p>
    </div>
    <div class="field" id="f-start">
      <span class="lab">Start time <span class="req">*</span></span>
      ${timeSelects("st")}
      <p class="err">Choose the start time.</p>
    </div>
    <div class="field" id="f-end">
      <div class="lab-row"><span class="lab">End time</span>
        <label class="check"><input type="checkbox" id="showend" /> Show end time</label></div>
      <p class="hint" id="end-hint">Showing start time only. Tick the box to add an end time.</p>
      <div id="end-wrap" hidden>${timeSelects("en")}</div>
    </div>
    <div class="nav"><button class="btn dark prev" type="button" id="prev">Previous</button><button class="btn" type="button" id="next">Next</button></div>`;
  const $ = (q) => host.querySelector(q);

  // Calendar: pick a first and last day (the same day twice for a one-day event); days before today are greyed out
  const cal = $("#cal"), btn = $("#datebtn");
  const today = iso(new Date());
  const startView = () => { const d = draft.dateFrom ? new Date(draft.dateFrom + "T00:00") : new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); };
  let view = startView();
  const label = () => {
    const { dateFrom: f, dateTo: t } = draft;
    $("#datelabel").textContent = f ? (t && t !== f ? `${prettyDate(f)} – ${prettyDate(t)}` : prettyDate(f)) : "Select dates…";
    $("#datelabel").classList.toggle("ph", !f);
  };
  const paintCal = () => {
    const first = view.getDay(); // Sunday first
    const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const { dateFrom: f, dateTo: t } = draft, end = t || f;
    const thisMonth = new Date(); const atStart = view.getFullYear() === thisMonth.getFullYear() && view.getMonth() === thisMonth.getMonth();
    const y0 = thisMonth.getFullYear();
    let cells = "";
    for (let i = 0; i < first; i++) cells += "<span></span>";
    for (let d = 1; d <= days; d++) {
      const v = iso(new Date(view.getFullYear(), view.getMonth(), d));
      const edge = v === f || v === end, mid = f && end && v > f && v < end;
      cells += `<button type="button" class="day ${edge ? "on" : ""} ${mid ? "mid" : ""} ${v === today ? "today" : ""}" data-d="${v}" ${v < today ? "disabled" : ""} aria-pressed="${edge || mid}">${d}</button>`;
    }
    cal.innerHTML = `<div class="cal-head">
        <button type="button" data-m="-1" aria-label="Previous month" ${atStart ? "disabled" : ""}>‹</button>
        <select data-sel="month" aria-label="Month">${MONTHS.map((m, i) => `<option value="${i}" ${i === view.getMonth() ? "selected" : ""}>${m}</option>`).join("")}</select>
        <select data-sel="year" aria-label="Year">${Array.from({ length: 5 }, (_, i) => `<option ${y0 + i === view.getFullYear() ? "selected" : ""}>${y0 + i}</option>`).join("")}</select>
        <button type="button" data-m="1" aria-label="Next month">›</button></div>
      <div class="cal-grid">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((x) => `<i>${x}</i>`).join("")}${cells}</div>
      <div class="cal-range"><span>From: <b>${f ? prettyDate(f) : "—"}</b></span><span>To: <b>${end ? prettyDate(end) : "—"}</b></span></div>
      <div class="cal-foot"><button type="button" class="cal-clear" data-clear>Clear</button><button type="button" class="cal-apply" data-done>Apply</button></div>`;
  };
  const setOpen = (on) => { cal.hidden = !on; btn.setAttribute("aria-expanded", on); if (on) { view = startView(); paintCal(); } };
  label();
  btn.addEventListener("click", () => setOpen(cal.hidden));
  cal.addEventListener("change", (e) => {
    const sel = e.target.closest("[data-sel]");
    if (!sel) return;
    view = sel.dataset.sel === "month" ? new Date(view.getFullYear(), +sel.value, 1) : new Date(+sel.value, view.getMonth(), 1);
    paintCal();
  });
  cal.addEventListener("click", (e) => {
    const m = e.target.closest("[data-m]"), d = e.target.closest("[data-d]");
    if (m && !m.disabled) { view = new Date(view.getFullYear(), view.getMonth() + +m.dataset.m, 1); paintCal(); }
    else if (d) {
      const v = d.dataset.d;
      if (!draft.dateFrom || draft.dateTo) { draft.dateFrom = v; draft.dateTo = ""; } // start a new range
      else if (v < draft.dateFrom) draft.dateFrom = v;
      else draft.dateTo = v;
      label(); paintCal(); $("#f-dates").classList.remove("bad");
    } else if (e.target.closest("[data-clear]")) { draft.dateFrom = ""; draft.dateTo = ""; label(); paintCal(); }
    else if (e.target.closest("[data-done]")) { if (draft.dateFrom && !draft.dateTo) draft.dateTo = draft.dateFrom; label(); setOpen(false); }
  });
  const outside = (e) => { if (!host.isConnected) { document.removeEventListener("click", outside); return; } if (!cal.hidden && !e.composedPath().includes(cal.parentElement)) setOpen(false); };
  document.addEventListener("click", outside);

  // Times
  // HH and MM open as dropdown lists, same look as Category
  const bind = (id, t) => {
    [["h", HOURS], ["m", MINUTES]].forEach(([k, opts]) => {
      const btn = $(`#${id}-${k}`), pop = btn.nextElementSibling, ul = pop.querySelector("ul"), ph = ul.dataset.ph;
      const label = () => { const l = btn.querySelector(".tl"); l.textContent = t[k] || ph; l.classList.toggle("ph", !t[k]); };
      const paint = () => { ul.innerHTML = opts.map((o) => `<li role="option" tabindex="-1" data-v="${o}" aria-selected="${o === t[k]}" class="${o === t[k] ? "sel" : ""}">${o}</li>`).join(""); };
      const setOpen = (on) => { pop.hidden = !on; btn.setAttribute("aria-expanded", on); if (on) { paint(); ul.querySelector(".sel")?.scrollIntoView({ block: "nearest" }); } };
      label();
      btn.addEventListener("click", () => setOpen(pop.hidden));
      btn.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
      ul.addEventListener("click", (e) => { const li = e.target.closest("[data-v]"); if (!li) return; t[k] = li.dataset.v; label(); setOpen(false); $("#f-start").classList.remove("bad"); });
      const outside = (e) => { if (!host.isConnected) { document.removeEventListener("click", outside); return; } if (!pop.hidden && !e.composedPath().includes(pop.parentElement)) setOpen(false); };
      document.addEventListener("click", outside);
    });
  };
  bind("st", draft.start); bind("en", draft.end);
  const showEnd = () => { $("#end-wrap").hidden = !draft.showEnd; $("#end-hint").hidden = draft.showEnd; $("#showend").checked = draft.showEnd; };
  showEnd();
  $("#showend").addEventListener("change", (e) => { draft.showEnd = e.target.checked; showEnd(); });

  saveCurrent = () => persist(3);
  $("#prev").addEventListener("click", () => { saveCurrent(); location.hash = "#/create/2"; });
  $("#next").addEventListener("click", () => {
    if (draft.dateFrom && draft.dateFrom < today) { draft.dateFrom = ""; draft.dateTo = ""; }
    if (draft.dateFrom && !draft.dateTo) draft.dateTo = draft.dateFrom;
    label();
    const okTime = draft.start.h && draft.start.m;
    $("#f-dates").classList.toggle("bad", !draft.dateFrom);
    $("#f-start").classList.toggle("bad", !okTime);
    if (draft.showEnd && !(draft.end.h && draft.end.m)) { toast("Choose the end time, or untick Show end time"); return; }
    const bad = host.querySelector(".bad");
    if (bad) { bad.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    persist(4);
    location.hash = "#/create/4";
  });
}

/* ---------- Step 4: Tickets ---------- */
const tIco = (d) => `<svg viewBox="0 0 24 24" width="2.6em" height="2.6em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const TICKET_TYPES = [
  { id: "guest", name: "Guest Ticket", desc: "Perfect for casual guests attending your event or impromptu events. Free tickets / RSVP only.", icon: tIco('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>') },
  { id: "single", name: "Single Ticket", desc: "Standard ticket for one individual attendee with full event access.", icon: tIco('<path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z"/><path d="M13 5v3M13 11v2M13 16v3"/>') },
  { id: "group", name: "Group Ticket", desc: "Discounted package for groups. Purchase multiple tickets at once for better pricing.", icon: tIco('<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a7 7 0 0 1 4 6"/>') },
  { id: "season", name: "Season Pass", desc: "Reserved seating for a group. Comes with reserved table and premium experience.", icon: tIco('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>') },
];

const GST_OPTIONS = ["No GST", "18% IGST", "9% CGST + 9% SGST", "5% IGST", "2.5% CGST + 2.5% SGST", "28% IGST", "12% IGST"];
const rupees = (n) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
// "9% CGST + 9% SGST" counts as 18% in total
const gstRate = (g) => ((g || "").match(/\d+(\.\d+)?(?=%)/g) || []).reduce((a, n) => a + parseFloat(n), 0) / 100;
const ticketPrice = (t) => (t.paid ? `${rupees(+t.price * (1 + gstRate(t.gst)))}${t.order === "group" ? (+t.groupSize >= 2 ? ` for ${t.groupSize} people` : " per group") : ""}` : "Free / RSVP");

// A small dropdown list (same look as Category) that fills a button inside `root`
function dropdown(root, options, value, onChange, ph = "") {
  root.classList.add("combo");
  root.innerHTML = `<button type="button" class="box datebtn" aria-haspopup="listbox" aria-expanded="false"><span class="tl"></span>
      <svg viewBox="0 0 24 24" width="1.4em" height="1.4em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
    <div class="pop" hidden><ul role="listbox"></ul></div>`;
  const btn = root.querySelector("button"), pop = root.querySelector(".pop"), ul = root.querySelector("ul");
  const label = () => { const l = root.querySelector(".tl"); l.textContent = value || ph; l.classList.toggle("ph", !value); };
  const setOpen = (on) => { pop.hidden = !on; btn.setAttribute("aria-expanded", on); if (on) ul.innerHTML = options.map((o) => `<li role="option" tabindex="-1" data-v="${o}" class="${o === value ? "sel" : ""}" aria-selected="${o === value}">${o}</li>`).join(""); };
  label();
  btn.addEventListener("click", () => setOpen(pop.hidden));
  ul.addEventListener("click", (e) => { const li = e.target.closest("[data-v]"); if (!li) return; value = li.dataset.v; label(); setOpen(false); onChange(value); });
  const outside = (e) => { if (!root.isConnected) { document.removeEventListener("click", outside); return; } if (!pop.hidden && !e.composedPath().includes(root)) setOpen(false); };
  document.addEventListener("click", outside);
}

// A date-range calendar for the ticket window (same look as the Schedule step's): state = { from, to }
function rangePicker(root, state, onChange, { min = "", max = "" } = {}) {
  root.classList.add("combo");
  root.innerHTML = `<button type="button" class="box datebtn" aria-haspopup="dialog" aria-expanded="false"><span class="tl"></span>
      <svg viewBox="0 0 24 24" width="1.6em" height="1.6em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg></button>
    <div class="cal" role="dialog" aria-label="Choose sale dates" hidden></div>`;
  const btn = root.querySelector("button"), cal = root.querySelector(".cal"), today = iso(new Date());
  const lo = min && min > today ? min : today; // days before this, or after `max`, can't be picked
  const startView = () => { const d = state.from ? new Date(state.from + "T00:00") : new Date(lo + "T00:00"); return new Date(d.getFullYear(), d.getMonth(), 1); };
  let view = startView();
  const label = () => { const l = root.querySelector(".tl"); l.textContent = state.from ? `${prettyDate(state.from)} → ${prettyDate(state.to || state.from)}` : "Select dates…"; l.classList.toggle("ph", !state.from); };
  const paint = () => {
    const first = view.getDay(), days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const f = state.from, end = state.to || f;
    const ym = (v) => +v.slice(0, 4) * 12 + (+v.slice(5, 7) - 1), cur = view.getFullYear() * 12 + view.getMonth();
    const atStart = cur <= ym(lo), atEnd = !!max && cur >= ym(max);
    const y0 = +lo.slice(0, 4), yN = max ? +max.slice(0, 4) : y0 + 4;
    let cells = "";
    for (let i = 0; i < first; i++) cells += "<span></span>";
    for (let d = 1; d <= days; d++) {
      const v = iso(new Date(view.getFullYear(), view.getMonth(), d)), edge = v === f || v === end, mid = f && end && v > f && v < end;
      cells += `<button type="button" class="day ${edge ? "on" : ""} ${mid ? "mid" : ""} ${v === today ? "today" : ""}" data-d="${v}" ${v < lo || (max && v > max) ? "disabled" : ""}>${d}</button>`;
    }
    cal.innerHTML = `<div class="cal-head"><button type="button" data-m="-1" aria-label="Previous month" ${atStart ? "disabled" : ""}>‹</button>
        <select data-sel="month" aria-label="Month">${MONTHS.map((m, i) => `<option value="${i}" ${i === view.getMonth() ? "selected" : ""}>${m}</option>`).join("")}</select>
        <select data-sel="year" aria-label="Year">${Array.from({ length: yN - y0 + 1 }, (_, i) => `<option ${y0 + i === view.getFullYear() ? "selected" : ""}>${y0 + i}</option>`).join("")}</select>
        <button type="button" data-m="1" aria-label="Next month" ${atEnd ? "disabled" : ""}>›</button></div>
      <div class="cal-grid">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((x) => `<i>${x}</i>`).join("")}${cells}</div>
      <div class="cal-range"><span>From: <b>${f ? prettyDate(f) : "—"}</b></span><span>To: <b>${end ? prettyDate(end) : "—"}</b></span></div>
      <div class="cal-foot"><button type="button" class="cal-clear" data-clear>Clear</button><button type="button" class="cal-apply" data-done>Apply</button></div>`;
  };
  const setOpen = (on) => { cal.hidden = !on; btn.setAttribute("aria-expanded", on); if (on) { view = startView(); paint(); } };
  label();
  btn.addEventListener("click", () => setOpen(cal.hidden));
  cal.addEventListener("change", (e) => { const sel = e.target.closest("[data-sel]"); if (!sel) return; view = sel.dataset.sel === "month" ? new Date(view.getFullYear(), +sel.value, 1) : new Date(+sel.value, view.getMonth(), 1); paint(); });
  cal.addEventListener("click", (e) => {
    const m = e.target.closest("[data-m]"), d = e.target.closest("[data-d]");
    if (m && !m.disabled) { view = new Date(view.getFullYear(), view.getMonth() + +m.dataset.m, 1); paint(); }
    else if (d) {
      const v = d.dataset.d;
      if (!state.from || state.to) { state.from = v; state.to = ""; } else if (v < state.from) state.from = v; else state.to = v;
      label(); paint(); onChange();
    } else if (e.target.closest("[data-clear]")) { state.from = ""; state.to = ""; label(); paint(); onChange(); }
    else if (e.target.closest("[data-done]")) { if (state.from && !state.to) state.to = state.from; label(); setOpen(false); onChange(); }
  });
  const outside = (e) => { if (!root.isConnected) { document.removeEventListener("click", outside); return; } if (!cal.hidden && !e.composedPath().includes(root)) setOpen(false); };
  document.addEventListener("click", outside);
}

// The "fill in the required fields" window for one ticket
function openTicketModal(type, existing, onSave) {
  const t = existing ? { saleFrom: "", saleTo: "", label1: "", label2: "", enabled: true, status: "Live", ...existing, saleSt: { h: "", m: "", ...existing.saleSt }, saleEn: { h: "", m: "", ...existing.saleEn } } : { id: newId(), type: type.id, name: type.name, paid: type.id !== "guest", qty: "", order: type.id === "group" || type.id === "season" ? "group" : "single", groupSize: "", price: "", gst: "No GST", saleFrom: draft.dateFrom || "", saleTo: draft.dateTo || draft.dateFrom || "", saleSt: { ...(draft.start || { h: "", m: "" }) }, saleEn: draft.showEnd ? { ...draft.end } : { h: "", m: "" }, label1: "", label2: "", enabled: true, status: "Live" };
  if (/^\d+(\.\d+)?%$/.test(t.gst)) t.gst += " IGST"; // tickets saved before the GST list was updated
  // Sales run within the event dates picked in the Schedule step
  const evFrom = draft.dateFrom || "", evTo = draft.dateTo || draft.dateFrom || "";
  if (evFrom && (!t.saleFrom || t.saleFrom < evFrom || (t.saleTo || t.saleFrom) > evTo)) { t.saleFrom = evFrom; t.saleTo = evTo; }
  const back = document.createElement("div");
  back.className = "modal-back";
  back.innerHTML = `<div class="modal coupon-modal" role="dialog" aria-modal="true" aria-label="${esc(type.name)}">
    <div class="modal-head plain"><div><h3 class="cut">${esc(type.name)}</h3><p>Fill in the required fields below</p></div><button type="button" class="modal-x" data-x aria-label="Close">×</button></div>
    <div class="modal-body">
      <div class="seg" role="tablist"><button type="button" data-paid="1">Paid</button><button type="button" data-paid="0">✓ RSVP / Free</button></div>
      <div class="two tight">
        <div class="field"><label for="tk-name">Name <span class="req">*</span></label><input id="tk-name" class="box" type="text" maxlength="60" /></div>
        <div class="field"><label for="tk-qty">Quantity <span class="req">*</span></label><input id="tk-qty" class="box" type="number" min="1" step="1" inputmode="numeric" placeholder="0" /></div>
      </div>
      <div id="pricing">
        <p class="mini-title">Pricing</p>
        <span class="lab">Order type</span>
        <div class="order"><button type="button" data-order="single"><svg viewBox="0 0 24 24" width="1.6em" height="1.6em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>Single</button><button type="button" data-order="group"><svg viewBox="0 0 24 24" width="1.6em" height="1.6em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a7 7 0 0 1 4 6"/></svg>Group</button></div>
        <div class="field" id="gs-wrap" hidden><label for="tk-gs">People per group <span class="req">*</span></label><input id="tk-gs" class="box" type="number" min="2" step="1" inputmode="numeric" placeholder="e.g. 4" /></div>
        <div class="two tight">
          <div class="field"><label for="tk-price">Price <span class="req">*</span></label><div class="money"><span>₹</span><input id="tk-price" class="box" type="number" min="0" step="any" inputmode="decimal" placeholder="0" /></div></div>
          <div class="field"><span class="lab">GST</span><div id="tk-gst"></div></div>
        </div>
        <div class="pays"><span>Customer pays</span><b id="pays"></b></div>
      </div>
      <button type="button" class="opt-toggle" id="opt-toggle" aria-expanded="false"><span class="ot-l"><svg viewBox="0 0 24 24" width="1.3em" height="1.3em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>Optional settings</span><svg viewBox="0 0 24 24" width="1.4em" height="1.4em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
      <div id="opt" hidden>
        <p class="mini-title">Sale period</p>
        <div class="field"><span class="lab">Sale dates</span><div id="sale-dates"></div></div>
        <div class="two tight">
          <div class="field"><span class="lab">Start time</span><div class="time-row"><div id="ss-h"></div><div id="ss-m"></div></div></div>
          <div class="field"><span class="lab">End time</span><div class="time-row"><div id="se-h"></div><div id="se-m"></div></div></div>
        </div>
        <p class="mini-title">Display labels</p>
        <div class="two tight">
          <div class="field"><label for="tk-l1">Primary label</label><input id="tk-l1" class="box" type="text" maxlength="30" placeholder="e.g. Early Bird" /><p class="hint">Shown during purchase &amp; on email</p></div>
          <div class="field"><label for="tk-l2">Secondary label</label><input id="tk-l2" class="box" type="text" maxlength="30" placeholder="e.g. Includes Dinner" /><p class="hint">Shown on ticket slab</p></div>
        </div>
        <p class="mini-title">Visibility &amp; status</p>
        <div class="switch-row"><div><b>Enable ticket</b><span>Available for purchase when enabled</span></div><button type="button" class="switch" id="tk-on" role="switch" aria-checked="true" aria-label="Enable ticket"><i></i></button></div>
        <div class="field"><span class="lab">Ticket status</span>
          <div class="status-chips"><button type="button" data-status="Live"><i class="dot live"></i>Live</button><button type="button" data-status="Coming Soon"><i class="dot soon"></i>Coming Soon</button><button type="button" data-status="Sold Out"><i class="dot out"></i>Sold Out</button></div></div>
      </div>
    </div>
    <div class="modal-foot"><button type="button" class="btn ghost" data-x>Cancel</button><button type="button" class="btn" id="tk-save">✓ Save ticket</button></div>
  </div>`;
  document.body.append(back);
  document.body.style.overflow = "hidden";
  const headLetters = cutHeadings(back);
  const $ = (q) => back.querySelector(q);
  // Guest tickets are RSVP / free only: no Paid option
  if (type.id === "guest") { t.paid = false; $(".seg").classList.add("single"); $(".seg").innerHTML = '<span>✓ RSVP / Free</span>'; }
  $("#tk-name").value = t.name; $("#tk-qty").value = t.qty; $("#tk-price").value = t.price; $("#tk-gs").value = t.groupSize; $("#tk-l1").value = t.label1; $("#tk-l2").value = t.label2;
  dropdown($("#tk-gst"), GST_OPTIONS, t.gst, (v) => { t.gst = v; refresh(); });

  const valid = () => {
    if (!t.name.trim() || !(+t.qty >= 1)) return false;
    if (!t.paid) return true;
    if (!(+t.price > 0)) return false;
    return t.order !== "group" || +t.groupSize >= 2;
  };
  const refresh = () => {
    back.querySelectorAll("[data-paid]").forEach((b) => b.classList.toggle("on", (b.dataset.paid === "1") === t.paid));
    back.querySelectorAll("[data-order]").forEach((b) => b.classList.toggle("on", b.dataset.order === t.order));
    $("#pricing").hidden = !t.paid;
    $("#gs-wrap").hidden = t.order !== "group";
    $("#pays").textContent = rupees(+t.price * (1 + gstRate(t.gst)) || 0) + (t.order === "group" && t.paid ? (+t.groupSize >= 2 ? ` for ${t.groupSize} people` : " per group") : "");
    $("#tk-save").disabled = !valid();
  };
  const bindInput = (q, key) => $(q).addEventListener("input", (e) => { t[key] = e.target.value; refresh(); });
  bindInput("#tk-name", "name"); bindInput("#tk-qty", "qty"); bindInput("#tk-price", "price"); bindInput("#tk-gs", "groupSize"); bindInput("#tk-l1", "label1"); bindInput("#tk-l2", "label2");
  const saleState = { get from() { return t.saleFrom; }, set from(v) { t.saleFrom = v; }, get to() { return t.saleTo; }, set to(v) { t.saleTo = v; } };
  rangePicker($("#sale-dates"), saleState, () => {}, { min: evFrom, max: evTo });
  dropdown($("#ss-h"), HOURS, t.saleSt.h, (v) => { t.saleSt.h = v; }, "HH"); dropdown($("#ss-m"), MINUTES, t.saleSt.m, (v) => { t.saleSt.m = v; }, "MM");
  dropdown($("#se-h"), HOURS, t.saleEn.h, (v) => { t.saleEn.h = v; }, "HH"); dropdown($("#se-m"), MINUTES, t.saleEn.m, (v) => { t.saleEn.m = v; }, "MM");
  const sw = $("#tk-on");
  const paintOpt = () => {
    sw.setAttribute("aria-checked", t.enabled); sw.classList.toggle("on", t.enabled);
    back.querySelectorAll("[data-status]").forEach((b) => b.classList.toggle("on", b.dataset.status === t.status));
  };
  sw.addEventListener("click", () => { t.enabled = !t.enabled; paintOpt(); });
  back.querySelectorAll("[data-status]").forEach((b) => b.addEventListener("click", () => { t.status = b.dataset.status; paintOpt(); }));
  paintOpt();
  back.querySelectorAll("[data-paid]").forEach((b) => b.addEventListener("click", () => { t.paid = b.dataset.paid === "1"; refresh(); }));
  back.querySelectorAll("[data-order]").forEach((b) => b.addEventListener("click", () => { t.order = b.dataset.order; refresh(); }));
  $("#opt-toggle").addEventListener("click", () => { const open = $("#opt").hidden; $("#opt").hidden = !open; $("#opt-toggle").setAttribute("aria-expanded", open); });
  const close = () => { headLetters.forEach((l) => l.dispose()); back.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  back.querySelectorAll("[data-x]").forEach((b) => b.addEventListener("click", close));
  $("#tk-save").addEventListener("click", () => { if (!valid()) return; t.name = t.name.trim(); onSave(t); close(); });
  refresh();
  $("#tk-name").focus();
}

function stepTickets(host) {
  draft.tickets ??= []; delete draft.ticketTypes;
  host.innerHTML = `
    <h2 class="section-title cut">Tickets</h2>
    <p class="section-sub">Select ticket type</p>
    <div class="tickets" role="group" aria-label="Ticket types">
      ${TICKET_TYPES.map((t) => `<button type="button" class="tkt" data-t="${t.id}">
        <span class="tkt-badge" data-count="${t.id}" hidden></span>
        <span class="tkt-ico">${t.icon}</span><h3 class="cut">${t.name}</h3><p>${t.desc}</p></button>`).join("")}
    </div>
    <div class="made" id="made"></div>
    <div class="nav three"><button class="btn dark prev" type="button" id="prev">Previous</button><button class="btn" type="button" id="next">Next</button><button class="btn" type="button" id="save">Save draft</button></div>`;
  cutHeadings();
  const next = host.querySelector("#next"), made = host.querySelector("#made");
  const paint = () => {
    TICKET_TYPES.forEach((tt) => {
      const n = draft.tickets.filter((x) => x.type === tt.id).length;
      const badge = host.querySelector(`[data-count="${tt.id}"]`);
      badge.hidden = !n; badge.textContent = n;
      host.querySelector(`[data-t="${tt.id}"]`).classList.toggle("on", n > 0);
    });
    made.innerHTML = draft.tickets.length ? `<h3>Your tickets</h3>` + draft.tickets.map((x) => {
      const st = x.enabled === false ? "Disabled" : x.status || "Live";
      const cls = { Live: "live", "Coming Soon": "soon", "Sold Out": "out", Disabled: "off" }[st];
      const price = x.paid ? `${rupees(+x.price)}${x.order === "group" ? (+x.groupSize >= 2 ? ` for ${x.groupSize} people` : " per group") : ""}` : "Free";
      return `<div class="made-row" data-id="${x.id}">
        <div class="made-info"><span class="pill ${cls}">${st}</span><b>${esc(x.name)}</b><span class="made-meta">${price} · Qty: ${x.qty}${x.label1 ? ` · ${esc(x.label1)}` : ""}</span></div>
        <div class="made-ctl"><div class="m-status"></div><div class="m-enabled"></div>
          <button type="button" class="icon-btn" data-edit-t="${x.id}" aria-label="Edit ${esc(x.name)}" title="Edit"><svg viewBox="0 0 24 24" width="1.5em" height="1.5em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7"/><path d="M18.4 2.6a2 2 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button>
          <button type="button" class="icon-btn danger" data-del-t="${x.id}" aria-label="Remove ${esc(x.name)}" title="Remove"><svg viewBox="0 0 24 24" width="1.5em" height="1.5em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg></button></div></div>`;
    }).join("") : "";
    made.querySelectorAll(".made-row").forEach((row) => {
      const x = draft.tickets.find((q) => q.id === row.dataset.id);
      dropdown(row.querySelector(".m-status"), ["Live", "Coming Soon", "Sold Out"], x.status || "Live", (v) => { x.status = v; persist(4); paint(); });
      dropdown(row.querySelector(".m-enabled"), ["Enabled", "Disabled"], x.enabled === false ? "Disabled" : "Enabled", (v) => { x.enabled = v === "Enabled"; persist(4); paint(); });
    });
    next.disabled = !draft.tickets.length;
  };
  paint();
  const add = (type, existing) => openTicketModal(type, existing, (t) => {
    const i = draft.tickets.findIndex((x) => x.id === t.id);
    if (i >= 0) draft.tickets[i] = t; else draft.tickets.push(t);
    persist(4); paint();
  });
  host.querySelector(".tickets").addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (b) add(TICKET_TYPES.find((t) => t.id === b.dataset.t)); });
  made.addEventListener("click", async (e) => {
    const ed = e.target.closest("[data-edit-t]"), del = e.target.closest("[data-del-t]");
    if (ed) { const x = draft.tickets.find((q) => q.id === ed.dataset.editT); add(TICKET_TYPES.find((t) => t.id === x.type), x); }
    if (del && (await ask({ title: "Remove this ticket?", ok: "Remove" }))) { draft.tickets = draft.tickets.filter((q) => q.id !== del.dataset.delT); persist(4); paint(); }
  });
  saveCurrent = () => persist(4);
  host.querySelector("#prev").addEventListener("click", () => { saveCurrent(); location.hash = "#/create/3"; });
  host.querySelector("#save").addEventListener("click", () => { saveCurrent(); toast("Draft saved"); draft = null; location.hash = "#/"; });
  next.addEventListener("click", () => { if (!draft.tickets.length) return; persist(5); location.hash = "#/create/5"; });
}

/* ---------- Step 5: Partners & artists ---------- */
const pIco = {
  group: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a7 7 0 0 1 4 6"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
};
const svg = (d, size = "1.4em") => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
// People already on PBJ would be searched here. There are none yet (hosts and partners arrive with accounts), so for now anyone can be added by name.
const PLATFORM = { artists: [], partners: [] };

// The "Add new artist / partner" window, for people who aren't in the search
function openPersonModal(kind, prefill, onAdd) {
  const isArtist = kind === "artist";
  const P = { name: prefill || "", desc: "", logo: "" };
  const back = document.createElement("div");
  back.className = "modal-back";
  back.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="Add new ${kind}">
    <div class="modal-head"><div class="mh-row"><span class="pa-ico small">${svg(isArtist ? pIco.music : pIco.group, "1.5em")}</span><div><h3>Add new ${kind}</h3><p>Not found in search? Add them manually</p></div></div><button type="button" class="modal-x" data-x aria-label="Close">×</button></div>
    <div class="modal-body">
      <div class="person-top">
        <div class="logo-pick"><label class="logo-drop" tabindex="0" id="logo-drop">${svg('<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>', "1.8em")}<span>Upload ${isArtist ? "photo" : "logo"}</span><input type="file" id="logo-file" accept="image/png,image/jpeg,image/webp" hidden /></label><span class="opt-note">Optional</span></div>
        <div class="field grow"><label for="pm-name">${isArtist ? "Artist" : "Partner"} name <span class="req">*</span></label><input id="pm-name" class="box" type="text" maxlength="80" placeholder="${isArtist ? "e.g. DJ Kavya" : "e.g. Acme Corp"}" /></div>
      </div>
      <div class="field"><div class="lab-row full"><label for="pm-desc">Description <span class="req">*</span></label><span class="count-note" id="pm-count">0 chars</span></div>
        <textarea id="pm-desc" class="box" rows="4" maxlength="500" placeholder="Describe the ${kind}: what they do, their role in this event…"></textarea>
        <p class="hint">Both name and description are required to add ${isArtist ? "an artist" : "a partner"}.</p></div>
    </div>
    <div class="modal-foot split"><button type="button" class="btn" id="pm-add">Add ${kind}</button><button type="button" class="btn ghost" data-x>Cancel</button></div>
  </div>`;
  document.body.append(back);
  document.body.style.overflow = "hidden";
  const $ = (q) => back.querySelector(q);
  $("#pm-name").value = P.name;
  const refresh = () => { $("#pm-add").disabled = !(P.name.trim().length >= 2 && P.desc.trim().length >= 3); $("#pm-count").textContent = `${P.desc.length} chars`; };
  $("#pm-name").addEventListener("input", (e) => { P.name = e.target.value; refresh(); });
  $("#pm-desc").addEventListener("input", (e) => { P.desc = e.target.value; refresh(); });
  const drop = $("#logo-drop"), file = $("#logo-file");
  const paintLogo = () => { drop.classList.toggle("has", !!P.logo); drop.style.backgroundImage = P.logo ? `url(${P.logo})` : ""; };
  file.addEventListener("change", () => { const f = file.files[0]; if (f) readImage(f, (d) => { P.logo = d; paintLogo(); }, 256); file.value = ""; });
  drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } });
  const close = () => { back.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  back.querySelectorAll("[data-x]").forEach((b) => b.addEventListener("click", close));
  $("#pm-add").addEventListener("click", () => { if ($("#pm-add").disabled) return; onAdd({ name: P.name.trim().replace(/\s+/g, " "), desc: P.desc.trim(), logo: P.logo }); close(); });
  refresh();
  $("#pm-name").focus();
}

function stepPartners(host) {
  // older drafts kept plain names; now each entry has a name, description and optional picture
  const norm = (arr) => (arr || []).map((n) => (typeof n === "string" ? { name: n, desc: "", logo: "" } : n));
  draft.artists = norm(draft.artists); draft.partners = norm(draft.partners);
  let tab = "artists";
  host.innerHTML = `
    <div class="pa-head"><span class="pa-ico">${svg(pIco.group, "1.8em")}</span><div><h2 class="section-title cut">Partners &amp; artists</h2><p>Add performers, artists, sponsors, or other partners involved in your event</p></div></div>
    <div class="pa-card">
      <div class="pa-tabs" role="tablist">
        <button type="button" role="tab" data-tab="artists">${svg(pIco.music)}Artists</button>
        <button type="button" role="tab" data-tab="partners">${svg(pIco.group)}Partners</button>
      </div>
      <div class="pa-body">
        <span class="lab" id="pa-lab"></span>
        <div class="combo"><label class="pa-search">${svg(pIco.search)}<input id="pa-q" type="text" autocomplete="off" role="combobox" aria-expanded="false" /></label>
          <div class="pop" id="pa-pop" hidden><ul id="pa-list" role="listbox"></ul></div></div>
        <p class="hint" id="pa-hint"></p>
        <div id="pa-added"></div>
      </div>
    </div>
    <div class="nav three"><button class="btn dark prev" type="button" id="prev">Previous</button><button class="btn" type="button" id="next">Next</button><button class="btn" type="button" id="save">Save draft</button></div>`;
  const $ = (q) => host.querySelector(q);
  const q = $("#pa-q"), pop = $("#pa-pop"), list = $("#pa-list"), added = $("#pa-added");
  const word = () => (tab === "artists" ? "artist" : "partner");
  const items = () => draft[tab];
  const paintAdded = () => {
    const arr = items();
    added.innerHTML = arr.length
      ? `<div class="pa-people">${arr.map((n, i) => `<div class="pa-person"><span class="avatar" ${n.logo ? `style="background-image:url(${n.logo})"` : ""}>${n.logo ? "" : esc(n.name.trim().slice(0, 1).toUpperCase())}</span><div class="pa-who"><b>${esc(n.name)}</b>${n.desc ? `<span>${esc(n.desc)}</span>` : ""}</div><button type="button" data-rm="${i}" aria-label="Remove ${esc(n.name)}">×</button></div>`).join("")}</div>`
      : `<div class="pa-empty"><span class="pa-ico">${svg(tab === "artists" ? pIco.music : pIco.group, "1.8em")}</span><b>No ${tab} added yet</b><span>Search above to find and add ${tab} to your event</span></div>`;
  };
  const closeList = () => { pop.hidden = true; q.setAttribute("aria-expanded", "false"); };
  const paintTab = () => {
    host.querySelectorAll("[data-tab]").forEach((b) => { const on = b.dataset.tab === tab; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
    $("#pa-lab").textContent = `Search ${word()}`;
    q.placeholder = `Type ${word()} name (min. 3 characters)…`;
    $("#pa-hint").textContent = `Enter 3+ characters to search ${tab} on platform`;
    q.value = ""; closeList(); paintAdded();
  };
  const add = (person) => {
    if (items().some((n) => n.name.toLowerCase() === person.name.toLowerCase())) { toast(`${person.name} is already added`); return; }
    items().push(person); q.value = ""; closeList(); paintAdded();
  };
  const other = () => openPersonModal(word(), q.value.trim(), add);
  q.addEventListener("input", () => {
    const v = q.value.trim();
    if (v.length < 3) { closeList(); return; }
    const hits = PLATFORM[tab].filter((n) => n.toLowerCase().includes(v.toLowerCase()));
    list.innerHTML = hits.map((n) => `<li role="option" tabindex="-1" data-name="${esc(n)}"><b>${esc(n)}</b></li>`).join("")
      + `<li role="option" tabindex="-1" data-other class="other"><span class="plus">+</span><span><b>Other</b><small>Add ${word()} not in list</small></span></li>`;
    pop.hidden = false; q.setAttribute("aria-expanded", "true");
  });
  const pick = (li) => { if (!li) return; if (li.hasAttribute("data-other")) other(); else add({ name: li.dataset.name, desc: "", logo: "" }); };
  q.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); if (!pop.hidden) pick(list.querySelector("li")); } if (e.key === "Escape") closeList(); });
  list.addEventListener("mousedown", (e) => { const li = e.target.closest("li"); if (li) { e.preventDefault(); pick(li); } });
  q.addEventListener("blur", closeList);
  added.addEventListener("click", (e) => { const b = e.target.closest("[data-rm]"); if (b) { items().splice(+b.dataset.rm, 1); paintAdded(); } });
  host.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; paintTab(); }));
  paintTab();
  saveCurrent = () => persist(5);
  $("#prev").addEventListener("click", () => { saveCurrent(); location.hash = "#/create/4"; });
  $("#save").addEventListener("click", () => { saveCurrent(); toast("Draft saved"); draft = null; location.hash = "#/"; });
  $("#next").addEventListener("click", () => { persist(6); location.hash = "#/create/6"; });
}

/* ---------- Step 6: Organizer ---------- */
// Format checks for Indian details (shape only: nothing is verified with a bank or the tax office)
const ORG_FIELDS = [
  { k: "email", label: "Email id", req: true, ph: "Enter email", type: "email", ok: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), msg: "Enter a valid email address." },
  { k: "gst", label: "GST no.", ph: "Enter GST no.", upper: true, ok: (v) => !v || /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v), msg: "A GST number has 15 characters, like 27ABCDE1234F1Z5." },
  { k: "holder", label: "Account holder name", req: true, ph: "Account holder name", ok: (v) => v.length >= 2, msg: "Enter the name on the bank account." },
  { k: "account", label: "Account number", req: true, ph: "Account number", digits: true, ok: (v) => /^\d{9,18}$/.test(v), msg: "An account number has 9 to 18 digits." },
  { k: "ifsc", label: "IFSC code", req: true, ph: "Enter IFSC code", upper: true, ok: (v) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v), msg: "An IFSC code looks like HDFC0001234." },
  { k: "pan", label: "PAN no.", req: true, ph: "Enter PAN no.", upper: true, ok: (v) => /^[A-Z]{5}\d{4}[A-Z]$/.test(v), msg: "A PAN looks like ABCDE1234F." },
  { k: "phone", label: "Phone no.", req: true, ph: "Enter phone no.", type: "tel", digits: true, ok: (v) => /^[6-9]\d{9}$/.test(v), msg: "Enter a 10-digit mobile number." },
];

function stepOrganizer(host) {
  draft.organizers ??= [];
  const form = { msmeOn: false, msme: "" };
  const cell = (f) => `<div class="field" id="of-${f.k}"><label for="o-${f.k}">${f.label}${f.req ? " <span class=\"req\">*</span>" : ""}</label>
      <input id="o-${f.k}" class="box ${f.upper ? "caps" : ""}" type="${f.type || "text"}" inputmode="${f.digits ? "numeric" : f.type === "email" ? "email" : "text"}" autocomplete="off" placeholder="${f.ph}" maxlength="${f.k === "gst" ? 15 : f.k === "ifsc" ? 11 : f.k === "pan" ? 10 : f.k === "phone" ? 10 : f.k === "account" ? 18 : 80}" />
      <p class="err">${f.msg}</p></div>`;
  host.innerHTML = `
    <h2 class="section-title cut">Organizer</h2>
    <div class="two">
      ${ORG_FIELDS.map(cell).join("")}
      <div class="field msme"><label class="check"><input type="checkbox" id="o-msme-on" /> Do you have an MSME no.?</label>
        <div id="of-msme" hidden><label for="o-msme" class="lab">MSME (Udyam) no. <span class="req">*</span></label><input id="o-msme" class="box caps" type="text" autocomplete="off" placeholder="UDYAM-MH-00-0000000" maxlength="19" /><p class="err">An Udyam number looks like UDYAM-MH-00-0000000.</p></div></div>
    </div>
    <div class="add-row"><button type="button" class="btn small" id="o-add">Add organizer</button></div>
    <div id="o-list"></div>
    <p class="notice info"><b>Secure information:</b> for now, these details are kept only in this browser and are not sent anywhere.</p>
    <div class="nav three"><button class="btn dark prev" type="button" id="prev">Previous</button><button class="btn" type="button" id="next">Next</button><button class="btn" type="button" id="save">Save draft</button></div>`;
  const $ = (q) => host.querySelector(q);
  const list = $("#o-list"), next = $("#next");
  const val = (f) => { let v = $(`#o-${f.k}`).value.trim(); if (f.upper) v = v.toUpperCase(); if (f.digits) v = v.replace(/\D/g, ""); return v; };
  ORG_FIELDS.forEach((f) => { const el = $(`#o-${f.k}`); el.addEventListener("input", () => { if (f.upper) el.value = el.value.toUpperCase(); if (f.digits) el.value = el.value.replace(/\D/g, ""); $(`#of-${f.k}`).classList.remove("bad"); }); });
  $("#o-msme").addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase(); $("#of-msme").classList.remove("bad"); });
  $("#o-msme-on").addEventListener("change", (e) => { form.msmeOn = e.target.checked; $("#of-msme").hidden = !form.msmeOn; });
  const paint = () => {
    list.innerHTML = draft.organizers.length ? `<h3 class="made-h">Organizers</h3>` + draft.organizers.map((o, i) => `<div class="made-row"><div class="made-info"><b>${esc(o.holder)}</b><span class="made-meta">${esc(o.email)} · ${esc(o.phone)} · A/c ••••${esc(o.account.slice(-4))}${o.msme ? " · MSME" : ""}</span></div><div class="made-ctl"><button type="button" class="icon-btn danger" data-rm-o="${i}" aria-label="Remove ${esc(o.holder)}" title="Remove"><svg viewBox="0 0 24 24" width="1.5em" height="1.5em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg></button></div></div>`).join("") : "";
  };
  paint();
  $("#o-add").addEventListener("click", () => {
    const data = {}; let firstBad = null;
    ORG_FIELDS.forEach((f) => { const v = val(f); data[f.k] = v; const ok = (f.req ? v.length > 0 : true) && f.ok(v); $(`#of-${f.k}`).classList.toggle("bad", !ok); if (!ok && !firstBad) firstBad = $(`#of-${f.k}`); });
    const msme = form.msmeOn ? $("#o-msme").value.trim().toUpperCase() : "";
    const msmeOk = !form.msmeOn || /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(msme);
    $("#of-msme").classList.toggle("bad", !msmeOk);
    if (!msmeOk && !firstBad) firstBad = $("#of-msme");
    if (firstBad) { firstBad.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    draft.organizers.push({ ...data, msme });
    ORG_FIELDS.forEach((f) => { $(`#o-${f.k}`).value = ""; });
    $("#o-msme").value = ""; $("#o-msme-on").checked = false; form.msmeOn = false; $("#of-msme").hidden = true;
    persist(6); paint(); toast("Organizer added");
  });
  list.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-rm-o]");
    if (b && (await ask({ title: "Remove this organizer?", ok: "Remove" }))) { draft.organizers.splice(+b.dataset.rmO, 1); persist(6); paint(); }
  });
  saveCurrent = () => persist(6);
  $("#prev").addEventListener("click", () => { saveCurrent(); location.hash = "#/create/5"; });
  $("#save").addEventListener("click", () => { saveCurrent(); toast("Draft saved"); draft = null; location.hash = "#/"; });
  next.addEventListener("click", () => { persist(7); location.hash = "#/create/7"; }); // organizer details can be added later; Review asks for them before Create event
}

/* ---------- Step 7: Review & create ---------- */
const dmy = (v) => { if (!v) return "—"; const [y, m, d] = v.split("-").map(Number); return `${d} ${SHORT[m - 1]} ${y}`; };
const hm = (t) => (t && t.h && t.m ? `${t.h}:${t.m}` : "—");
const TYPE_SHORT = { guestlist: "Free impromptu", exclusive: "Exclusive", open: "Non-exclusive" };

function stepReview(host) {
  const d = draft;
  const arts = (d.artists || []).map((a) => ({ ...(typeof a === "string" ? { name: a } : a), role: "Artist" }));
  const pars = (d.partners || []).map((a) => ({ ...(typeof a === "string" ? { name: a } : a), role: "Partner" }));
  const people = [...arts, ...pars];
  const tickets = d.tickets || [], orgs = d.organizers || [], images = (d.images || []).filter(Boolean);
  // Anything still missing, with the step that fixes it
  const missing = [
    [!d.type, "Event type", 0], [!d.title, "Title", 1], [!d.description || !textLen(d.description), "Description", 1],
    [!d.category, "Category", 2], [!(d.subs || []).length, "Sub categories", 2], [!d.city, "City", 2], [!images.length, "A cover image", 2],
    [!d.dateFrom, "Event dates", 3], [!(d.start && d.start.h && d.start.m), "Start time", 3],
    [!tickets.length, "At least one ticket", 4], [!orgs.length, "An organizer", 6],
  ].filter((m) => m[0]);
  const edit = (step, label = "Edit") => `<button type="button" class="rv-edit" data-go-step="${step}">${label}</button>`;
  const field = (label, value, cls = "") => `<div class="rv-f ${cls}"><span>${label}</span><b>${value}</b></div>`;
  const section = (title, step, body, count = "") => `<section class="rv-sec"><header><h3><span class="cut">${title}</span>${count ? ` <small>${count}</small>` : ""}</h3>${edit(step)}</header><div class="rv-body">${body}</div></section>`;
  const priceOf = (t) => (t.paid ? rupees(+t.price) : "Free");
  host.innerHTML = `
    <h2 class="section-title cut">Review your event</h2>
    <p class="section-sub">Check all details before submitting. Click any section to edit.</p>
    <div class="rv-hero">
      <div class="rv-img" ${images[0] ? `style="background-image:url(${images[0]})"` : ""}>${images[0] ? "" : "<span>No cover image</span>"}<button type="button" class="rv-edit on-img" data-go-step="2">Edit</button></div>
      <div class="rv-hero-txt"><span class="pill live type">${esc(TYPE_SHORT[d.type] || "No type")}</span><b class="rv-title">${esc(d.title || "Untitled event")}</b>
        <span class="rv-line">${svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>')}${dmy(d.dateFrom)} · ${hm(d.start)}</span>
        <span class="rv-line">${svg('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>')}${esc(d.city || "—")}</span></div>
    </div>
    <div class="rv-stats">
      <div class="stat"><b>${tickets.length}</b><span>Ticket types</span></div>
      <div class="stat"><b>${people.length}</b><span>Artists / partners</span></div>
      <div class="stat"><b>${images.length}</b><span>Cover images</span></div>
      <div class="stat"><b>${(d.subs || []).length}</b><span>Sub-categories</span></div>
    </div>
    ${section("Basic information", 1, `${field("Title", esc(d.title || "—"), "strong")}${field("Event type", esc((TYPES.find((t) => t.id === d.type) || {}).name || "—"))}
      <div class="rv-f"><span>Description</span><div class="rv-rich">${d.description ? clean(d.description) : "<b>—</b>"}</div></div>
      <div class="rv-f"><span>Terms &amp; conditions</span><div class="rv-rich">${d.terms && textLen(d.terms) ? clean(d.terms) : "<b>—</b>"}</div></div>`)}
    ${section("Location & category", 2, `<div class="rv-grid">${field("City", esc(d.city || "—"))}${field("Venue", esc(d.venueStatus === "Decided" && d.venue ? d.venue : d.venueStatus || "—") + (d.venueAddress ? `<span class="rv-addr">${esc(d.venueAddress)}</span>` : "") + (d.venueLat ? ` <a class="rv-map" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${d.venueLat}&mlon=${d.venueLon}#map=17/${d.venueLat}/${d.venueLon}">Open map</a>` : ""), d.venueStatus === "To be announced" ? "warn" : "")}</div>
      <div class="rv-f"><span>Category</span><div class="rv-tags">${d.category ? `<i class="on">${esc(d.category)}</i>` : "<b>—</b>"}${(d.subs || []).map((x) => `<i>${esc(x)}</i>`).join("")}</div></div>`)}
    ${section("Schedule", 3, `<div class="rv-grid four">${field("Start date", dmy(d.dateFrom))}${field("End date", dmy(d.dateTo || d.dateFrom))}${field("Start time", hm(d.start))}${field("End time", d.showEnd ? hm(d.end) : "—")}</div>`)}
    ${section("Tickets", 4, tickets.length ? tickets.map((t) => `<div class="rv-row"><div><b>${esc(t.name)}</b><span>${t.qty} qty${t.label1 ? ` · ${esc(t.label1)}` : ""}</span></div><b class="rv-price">${priceOf(t)}</b></div>`).join("") : "<b>—</b>", `(${tickets.length} type${tickets.length === 1 ? "" : "s"})`)}
    ${section("Artists & partners", 5, people.length ? `<div class="rv-people">${people.map((p) => `<div class="pa-person"><span class="avatar" ${p.logo ? `style="background-image:url(${p.logo})"` : ""}>${p.logo ? "" : esc(p.name.trim().slice(0, 1).toUpperCase())}</span><div class="pa-who"><b>${esc(p.name)}</b><span>${p.role}</span></div></div>`).join("")}</div>` : "<b>—</b>", `(${people.length})`)}
    ${section("Organizer & banking", 6, orgs.length ? orgs.map((o) => `<div class="rv-grid">${field("Organizer name", esc(o.holder))}${field("Email", `<span class="keep">${esc(o.email)}</span>`)}${field("Phone", esc(o.phone))}${field("Account number", "••••" + esc(o.account.slice(-4)))}${field("IFSC", esc(o.ifsc))}${o.gst ? field("GST no.", esc(o.gst)) : ""}</div>`).join("<hr />") : field("Organizer name", "—"))}
    ${missing.length
      ? `<p class="notice warn"><b>Almost there.</b> Still needed: ${missing.map((m) => `<button type="button" class="linkish" data-go-step="${m[2]}">${m[1]}</button>`).join(", ")}.</p>`
      : `<p class="notice ready"><b>Ready to submit.</b> After you create the event, you'll choose its status.</p>`}
    <div class="nav"><button class="btn dark prev" type="button" id="prev">Previous</button><button class="btn" type="button" id="create" ${missing.length ? "disabled" : ""}>Create event</button></div>`;
  host.addEventListener("click", (e) => { const b = e.target.closest("[data-go-step]"); if (b) { saveCurrent(); location.hash = `#/create/${b.dataset.goStep}`; } });
  saveCurrent = () => persist(7);
  host.querySelector("#prev").addEventListener("click", () => { saveCurrent(); location.hash = "#/create/6"; });
  host.querySelector("#create").addEventListener("click", () => {
    if (missing.length) return;
    draft.submitted = true; draft.submittedAt = Date.now();
    if (!STATUSES[draft.status]) draft.status = "draft";
    persist(7);
    const made = draft;
    openStatusModal((choice) => {
      if (choice) { made.status = choice; draft = made; persist(7); }
      toast(choice ? `Event created: ${STATUSES[choice].label}` : "Event created as a draft");
      draft = null; location.hash = "#/";
    });
  });
}

function stepComing(host, step) {
  const s = STEPS[step];
  host.innerHTML = `<div class="coming"><h2 class="cut">${s.name}</h2>
    <p>This step is coming next. Your event so far is saved as a draft in this browser.</p>
    <div class="nav"><button class="btn dark prev" type="button" id="prev">Previous</button><a class="btn" href="#/" id="done">Save and exit</a></div></div>`;
  host.querySelector("#prev").addEventListener("click", () => { location.hash = `#/create/${step - 1}`; });
  host.querySelector("#done").addEventListener("click", () => { toast("Draft saved"); draft = null; });
}

/* ---------- Coupons (per event) ---------- */
const couponState = (c) => { const end = c.to || c.from; if (end && end < iso(new Date())) return "Expired"; return c.active ? "Active" : "Paused"; };
const discountText = (c) => (c.type === "pct" ? `${c.value}% off` : `${rupees(+c.value)} off`);
const clock = (t) => (t && t.h && t.m ? `${t.h}:${t.m}` : "—");

function renderCoupons(id) {
  const events = load(), ev = events.find((e) => e.id === id);
  if (!ev) { location.hash = "#/"; return; }
  ev.coupons ??= [];
  document.title = "Coupons — PeanutButterJelly.vip";
  let query = "";
  app.innerHTML = `
    <div class="sub-head">
      <button type="button" class="back-pill" data-back>‹ Back</button>
      <div class="sh-t"><h1 class="cut">Coupons</h1><p>Manage discount coupons for ${esc(ev.title || "this event")}</p></div>
      <div class="head-tools"><label class="search">${ic("search", "1.3em")}<input id="cp-q" type="text" placeholder="Search coupons…" aria-label="Search coupons" autocomplete="off" /></label>
        <button type="button" class="btn create-btn" id="cp-add">+ Add coupon</button></div>
    </div>
    <div id="cp-list" class="cp-list"></div>`;
  const listEl = app.querySelector("#cp-list");
  const persistEv = () => save(events);
  const paint = () => {
    const q = query.trim().toLowerCase();
    const shown = ev.coupons.filter((c) => !q || c.code.toLowerCase().includes(q));
    if (!shown.length) {
      listEl.innerHTML = `<div class="empty"><h2 class="cut" data-fill="var(--brown)" data-shadow="var(--cream)">${ev.coupons.length ? "No match" : "No coupons yet"}</h2>
        <p>${ev.coupons.length ? "No coupon matches that search." : "Add a discount code your guests can use at checkout."}</p></div>`;
      cutHeadings(); return;
    }
    listEl.innerHTML = shown.map((c) => {
      const st = couponState(c);
      return `<article class="cp-card" data-id="${c.id}"><div class="cp-main"><b class="cp-code">${esc(c.code)}</b><span class="pill ${st === "Active" ? "live" : st === "Paused" ? "off" : "out"}">${st}</span></div>
        <div class="cp-meta"><span><small>Discount</small><b>${discountText(c)}</b></span><span><small>Used</small><b>${c.used || 0} / ${c.max}</b></span><span><small>Valid</small><b>${dmy(c.from)}${c.to && c.to !== c.from ? ` → ${dmy(c.to)}` : ""}<em>${clock(c.st)} – ${clock(c.en)}</em></b></span></div>
        <div class="made-ctl"><button type="button" class="switch ${c.active ? "on" : ""}" role="switch" aria-checked="${c.active}" data-toggle aria-label="Coupon active"><i></i></button>
          <button type="button" class="icon-btn" data-edit aria-label="Edit ${esc(c.code)}" title="Edit">${ic("edit", "1.5em")}</button>
          <button type="button" class="icon-btn danger" data-del aria-label="Delete ${esc(c.code)}" title="Delete"><svg viewBox="0 0 24 24" width="1.5em" height="1.5em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg></button></div></article>`;
    }).join("");
  };
  paint(); cutHeadings();
  app.querySelector("[data-back]").addEventListener("click", () => { location.hash = "#/"; });
  app.querySelector("#cp-q").addEventListener("input", (e) => { query = e.target.value; paint(); });
  const add = (existing) => openCouponModal(ev, existing, (c) => {
    const i = ev.coupons.findIndex((x) => x.id === c.id);
    if (i >= 0) ev.coupons[i] = c; else ev.coupons.unshift(c);
    persistEv(); paint(); toast(i >= 0 ? "Coupon updated" : "Coupon created");
  });
  app.querySelector("#cp-add").addEventListener("click", () => add());
  listEl.addEventListener("click", async (e) => {
    if (e.target.closest("[data-add]")) { add(); return; }
    const card = e.target.closest(".cp-card"); if (!card) return;
    const c = ev.coupons.find((x) => x.id === card.dataset.id);
    if (e.target.closest("[data-toggle]")) { c.active = !c.active; persistEv(); paint(); }
    else if (e.target.closest("[data-edit]")) add(c);
    else if (e.target.closest("[data-del]") && (await ask({ title: `Delete ${c.code}?`, message: "Guests will no longer be able to use it.", ok: "Delete" }))) { ev.coupons = ev.coupons.filter((x) => x.id !== c.id); persistEv(); paint(); }
  });
}

function openCouponModal(ev, existing, onSave) {
  const c = existing ? { ...existing, st: { ...existing.st }, en: { ...existing.en } } : { id: newId(), code: "", max: "", type: "pct", value: "", from: "", to: "", st: { h: "", m: "" }, en: { h: "", m: "" }, active: true, used: 0 };
  const back = document.createElement("div");
  back.className = "modal-back";
  back.innerHTML = `<div class="modal coupon-modal" role="dialog" aria-modal="true" aria-label="${existing ? "Edit" : "New"} coupon">
    <div class="modal-head plain"><div><h3 class="cut">${existing ? "Edit coupon" : "New coupon"}</h3><p>Fill in the details to create a coupon</p></div><button type="button" class="modal-x" data-x aria-label="Close">×</button></div>
    <div class="modal-body">
      <p class="mini-title">Coupon details</p>
      <div class="field" id="cf-code"><label for="cp-code">Coupon code <span class="req">*</span></label><input id="cp-code" class="box caps" type="text" maxlength="20" autocomplete="off" placeholder="E.g. DIWALI20" /><p class="err" id="cp-code-err">Use 3 to 20 letters or numbers.</p></div>
      <div class="field"><label for="cp-max">Max uses <span class="req">*</span></label><input id="cp-max" class="box" type="number" min="1" step="1" inputmode="numeric" placeholder="e.g. 100 (how many times it can be used)" /></div>
      <p class="mini-title">Discount</p>
      <div class="field"><span class="lab">Discount value <span class="req">*</span></span>
        <div class="disc"><div class="seg" role="tablist"><button type="button" data-type="pct">% PCT</button><button type="button" data-type="inr">₹ INR</button></div><input id="cp-val" class="box" type="number" min="1" step="any" inputmode="decimal" placeholder="e.g. 20" /></div></div>
      <p class="mini-title">Validity period</p>
      <div class="field"><span class="lab">Date range <span class="req">*</span></span><div id="cp-dates"></div></div>
      <div class="two tight">
        <div class="field"><span class="lab">Start time <span class="req">*</span></span><div class="time-row"><div id="cs-h"></div><div id="cs-m"></div></div></div>
        <div class="field"><span class="lab">End time <span class="req">*</span></span><div class="time-row"><div id="ce-h"></div><div id="ce-m"></div></div></div>
      </div>
      <p class="mini-title">Status</p>
      <div class="switch-row"><div><b id="cp-st-t"></b></div><button type="button" class="switch" id="cp-on" role="switch" aria-label="Coupon active"><i></i></button></div>
    </div>
    <div class="modal-foot"><button type="button" class="btn ghost" data-x>Cancel</button><button type="button" class="btn" id="cp-save">${existing ? "Save coupon" : "Create coupon"}</button></div></div>`;
  document.body.append(back);
  document.body.style.overflow = "hidden";
  const headLetters = cutHeadings(back);
  const $ = (q) => back.querySelector(q);
  $("#cp-code").value = c.code; $("#cp-max").value = c.max; $("#cp-val").value = c.value;
  const evEnd = ev.dateTo || ev.dateFrom || "";
  const dates = { get from() { return c.from; }, set from(v) { c.from = v; }, get to() { return c.to; }, set to(v) { c.to = v; } };
  rangePicker($("#cp-dates"), dates, () => refresh(), { max: evEnd });
  dropdown($("#cs-h"), HOURS, c.st.h, (v) => { c.st.h = v; refresh(); }, "HH"); dropdown($("#cs-m"), MINUTES, c.st.m, (v) => { c.st.m = v; refresh(); }, "MM");
  dropdown($("#ce-h"), HOURS, c.en.h, (v) => { c.en.h = v; refresh(); }, "HH"); dropdown($("#ce-m"), MINUTES, c.en.m, (v) => { c.en.m = v; refresh(); }, "MM");
  const taken = () => (ev.coupons || []).some((x) => x.id !== c.id && x.code.toLowerCase() === c.code.trim().toLowerCase());
  const valueOk = () => (c.type === "pct" ? +c.value >= 1 && +c.value <= 100 : +c.value > 0);
  const timesOk = () => { if (!(c.st.h && c.st.m && c.en.h && c.en.m)) return false; const single = !c.to || c.to === c.from; return !single || `${c.en.h}${c.en.m}` > `${c.st.h}${c.st.m}`; };
  const valid = () => /^[A-Z0-9_-]{3,20}$/.test(c.code.trim()) && !taken() && +c.max >= 1 && valueOk() && !!c.from && timesOk();
  const refresh = () => {
    back.querySelectorAll("[data-type]").forEach((b) => b.classList.toggle("on", b.dataset.type === c.type));
    $("#cp-val").placeholder = c.type === "pct" ? "e.g. 20" : "e.g. 100";
    $("#cp-on").classList.toggle("on", c.active); $("#cp-on").setAttribute("aria-checked", c.active);
    $("#cp-st-t").textContent = c.active ? "Active: coupon can be used" : "Paused: coupon can't be used";
    const dup = taken(); $("#cf-code").classList.toggle("bad", dup); $("#cp-code-err").textContent = dup ? "This code already exists for this event." : "Use 3 to 20 letters or numbers.";
    $("#cp-save").disabled = !valid();
  };
  $("#cp-code").addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""); c.code = e.target.value; refresh(); });
  $("#cp-max").addEventListener("input", (e) => { c.max = e.target.value; refresh(); });
  $("#cp-val").addEventListener("input", (e) => { c.value = e.target.value; refresh(); });
  back.querySelectorAll("[data-type]").forEach((b) => b.addEventListener("click", () => { c.type = b.dataset.type; refresh(); }));
  $("#cp-on").addEventListener("click", () => { c.active = !c.active; refresh(); });
  const close = () => { headLetters.forEach((l) => l.dispose()); back.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  back.querySelectorAll("[data-x]").forEach((b) => b.addEventListener("click", close));
  $("#cp-save").addEventListener("click", () => { if (!valid()) return; if (!c.to) c.to = c.from; c.code = c.code.trim(); onSave(c); close(); });
  refresh();
  $("#cp-code").focus();
}

/* ---------- Sales and analytics (per event) ---------- */
// PBJ doesn't sell tickets yet, so every number here is zero. The page is ready for when sales exist.
const SALES_TABS = [["overview", "Overview"], ["analytics", "Analytics"], ["tickets", "Ticket wise"]];
// A small graph that draws itself in, then keeps a gentle motion going (stops for people who turn motion off). Shape only for now: it becomes real once there are sales.
const spark = (color, delay = 0) => `<svg class="spark" viewBox="0 0 80 28" aria-hidden="true" style="--c:${color}; --d:${delay}s"><path class="sp-area" d="M2 22 L16 17 L30 21 L44 11 L58 16 L76 7 L76 28 L2 28 Z" fill="${color}"/><path class="sp-line" pathLength="100" d="M2 22 L16 17 L30 21 L44 11 L58 16 L76 7" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle class="sp-dot" cx="76" cy="7" r="2.6" fill="${color}"/><circle class="sp-ring" cx="76" cy="7" r="2.6" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`;

function renderSales(id) {
  const events = load(), ev = events.find((e) => e.id === id);
  if (!ev) { location.hash = "#/"; return; }
  document.title = "Sales — PeanutButterJelly.vip";
  let tab = "overview";
  const st = statusOf(ev), past = isPast(ev);
  const badge = past ? ["Event ended", "off"] : st === "published" ? ["Event live", "live"] : [STATUSES[st].label, st === "soldout" || st === "cancelled" ? "out" : st === "coming" ? "soon" : "off"];
  app.innerHTML = `
    <div class="sub-head sales-head">
      <button type="button" class="back-pill" data-back>‹ Back</button>
      <div class="sh-t"><h1 class="rv-name">${esc(ev.title || "Untitled event")}</h1><p>${esc(ev.city || "—")} · ${dayLine(ev)}</p></div>
      <span class="pill ${badge[1]} big">${badge[0]}</span>
    </div>
    <div class="ev-tabs" role="tablist">${SALES_TABS.map(([k, n]) => `<button type="button" role="tab" class="ev-tab" data-tab="${k}">${n}</button>`).join("")}</div>
    <div id="sales-body"></div>`;
  const body = app.querySelector("#sales-body");
  const tile = (label, value, cap, color, delay = 0, extra = "") => `<div class="an-tile"><div class="an-top"><span>${label}</span>${spark(color, delay)}</div><b class="an-num">${value}</b><small>${cap}</small>${extra}</div>`;
  const empty = (title, text) => `<div class="empty"><h2 class="cut" data-fill="var(--brown)" data-shadow="var(--cream)">${title}</h2><p>${text}</p></div>`;
  const draw = () => {
    app.querySelectorAll("[data-tab]").forEach((b) => { const on = b.dataset.tab === tab; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
    const tickets = ev.tickets || [];
    if (tab === "overview") body.innerHTML = `
      <div class="an-grid four">${tile("Total revenue", "₹0", "Total sales", "#463721", 0)}${tile("Total tickets", "0", "Tickets sold", "#f0a830", 0.15)}${tile("Total pax", "0", "People attending", "#6b2d5c", 0.3)}${tile("Refunds", "0", "Refund orders", "#c2184f", 0.45)}</div>
      <div class="an-grid two">
        <div class="an-panel"><span class="an-label">Today's sales snapshot</span><div class="snap"><div><small>Tickets</small><b>0</b></div><div><small>Pax</small><b class="c2">0</b></div><div><small>Refunds</small><b class="c3">0</b></div></div><div class="snap-foot"><span>Today's revenue</span><b>₹0</b></div></div>
        <div class="an-panel"><span class="an-label">Check-in status</span><div class="ring-row"><div class="ring"><b>0%</b></div><div class="ring-txt"><small>Checked in</small><b>0 / 0</b><small>Remaining</small><b>0</b></div></div></div>
      </div>
      <div class="an-panel wide"><div class="tx-head"><div><b class="tx-t cut" data-level>All transactions</b> <span class="muted">0 records</span></div><div class="head-tools"><label class="search">${ic("search", "1.3em")}<input type="text" placeholder="Search ticket, holder, type…" aria-label="Search transactions" disabled /></label><button type="button" class="btn create-btn" id="csv">↓ Download CSV</button></div></div>
        <div class="tx-scroll"><table class="tx"><thead><tr><th>Order no.</th><th>Ticket type</th><th>Ticket holder</th><th>Amount</th><th>Date</th><th>Pax / Tkts</th><th>Coupon</th><th>Disc.</th></tr></thead><tbody><tr><td colspan="8" class="tx-empty">No transactions found</td></tr></tbody></table></div></div>`;
    else if (tab === "tickets") body.innerHTML = tickets.length
      ? `<div class="an-panel wide"><div class="tx-scroll"><table class="tx"><thead><tr><th>Ticket</th><th>Price</th><th>Quantity</th><th>Sold</th><th>Remaining</th><th>Revenue</th></tr></thead><tbody>${tickets.map((t) => `<tr><td><b>${esc(t.name)}</b></td><td>${t.paid ? rupees(+t.price) : "Free"}</td><td>${t.qty}</td><td>0</td><td>${t.qty}</td><td>₹0</td></tr>`).join("")}</tbody></table></div></div>`
      : empty("No tickets yet", "Add tickets to this event to see them here.");
    else if (tab === "analytics") drawAnalytics(body, ev);
    else body.innerHTML = empty("Coming later", "This part of the dashboard isn't built yet.");
    cutHeadings();
    const csv = body.querySelector("#csv");
    if (csv) csv.addEventListener("click", () => {
      const blob = new Blob(["Order no.,Ticket type,Ticket holder,Amount,Date,Pax / Tkts,Coupon,Disc.\n"], { type: "text/csv" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${(ev.title || "event").replace(/\W+/g, "-").toLowerCase()}-transactions.csv`; a.click(); URL.revokeObjectURL(a.href);
    });
  };
  draw();
  app.querySelector("[data-back]").addEventListener("click", () => { location.hash = "#/"; });
  app.querySelector(".ev-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) { tab = b.dataset.tab; draw(); } });
}

/* ---------- Analytics tab ---------- */
const nice = (max) => { if (max <= 0) return [0, 1, 2, 3, 4]; const step = Math.pow(10, Math.floor(Math.log10(max / 4))) * ([1, 2, 5, 10].find((m) => (Math.pow(10, Math.floor(Math.log10(max / 4))) * m) * 4 >= max) || 10); return [0, 1, 2, 3, 4].map((i) => i * step); };
const weekOf = (d) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 86400000 + 1) / 7); };

const SOURCES = [["Google", "#463721"], ["Direct", "#f0a830"], ["Instagram", "#c2184f"], ["WhatsApp", "#6b2d5c"], ["Other", "#8c8a80"]];

function drawAnalytics(body, ev) {
  const st = { measure: "purchase", gran: "date", q: "", sort: "views", dir: -1 };
  const now = new Date(), dd = String(now.getDate()).padStart(2, "0"), mm = String(now.getMonth() + 1).padStart(2, "0");
  const coupons = ev.coupons || [];
  body.innerHTML = `
    <section class="an-hero"><span class="pill live"><i class="dot" style="background:#2e9e4f"></i>Event analytics</span><h2 class="an-title cut">${esc(ev.title || "Untitled event")}</h2><p>How your event is doing: sales, visits and where your guests come from.</p></section>
    <div class="an-grid four">
      <div class="an-tile dark"><span class="an-label">Revenue</span><b class="an-num">₹0</b><small>Total revenue</small></div>
      <div class="an-tile"><span class="an-label">Tickets sold</span><b class="an-num">0</b><small>Number of tickets sold</small></div>
      <div class="an-tile"><span class="an-label">Page sessions</span><b class="an-num">0</b><small>Visits to your event page</small></div>
      <div class="an-tile"><span class="an-label">Page views</span><b class="an-num">0</b><small>Pages seen in total</small></div>
    </div>
    <section class="an-panel wide">
      <div class="trend-head"><div><span class="an-label tight">Performance trend</span><h3 class="tx-t cut" data-level>Booking performance</h3></div>
        <div class="toggles"><div class="seg2" data-group="measure"><button type="button" data-v="purchase">By purchase</button><button type="button" data-v="ticket">By ticket</button></div>
        <div class="seg2" data-group="gran"><button type="button" data-v="date">By date</button><button type="button" data-v="week">By week</button><button type="button" data-v="month">By month</button></div></div></div>
      <div class="chart-box"><div id="chart"></div><div class="legend"><button type="button" class="lg on" data-series="a" aria-pressed="true"><svg class="lg-ico" viewBox="0 0 36 12" style="color:var(--brown)" aria-hidden="true"><line x1="1" x2="35" y1="6" y2="6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="18" cy="6" r="3.3" fill="currentColor"/></svg><b id="lg1"></b></button><button type="button" class="lg on" data-series="b" aria-pressed="true"><svg class="lg-ico" viewBox="0 0 36 12" style="color:var(--strawberry)" aria-hidden="true"><line x1="1" x2="35" y1="6" y2="6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><rect x="12" y="3" width="12" height="6" rx="2" fill="currentColor"/></svg><b>Page views</b></button></div></div>
    </section>
    <div class="an-grid two">
      <section class="an-panel"><span class="an-label tight">Traffic</span><h3 class="tx-t cut" data-level>Page view source</h3>
        <label class="search full">${ic("search", "1.3em")}<input id="src-q" type="text" placeholder="Search source" aria-label="Search source" autocomplete="off" /></label>
        <div class="tx-scroll"><table class="tx narrow"><thead><tr><th><button type="button" class="sortbtn" data-ssort="name">Source ⇅</button></th><th><button type="button" class="sortbtn" data-ssort="users">Users ⇅</button></th><th><button type="button" class="sortbtn" data-ssort="views">Page views ⇅</button></th></tr></thead><tbody id="src-rows"></tbody></table></div>
        <div class="pager"><button type="button" disabled aria-label="Previous page">‹</button><b>1</b><button type="button" disabled aria-label="Next page">›</button></div></section>
      <section class="an-panel ref-card"><span class="an-label tight">Distribution</span><h3 class="tx-t cut" data-level>Referrer split</h3>
        <div class="donut-row"><svg class="donut" viewBox="0 0 120 120" aria-label="No referrals yet"><circle cx="60" cy="60" r="44" fill="none" stroke="var(--line)" stroke-width="16"/><circle class="donut-spin" cx="60" cy="60" r="44" fill="none" stroke="var(--bread)" stroke-width="16" stroke-dasharray="40 236.4" stroke-linecap="round"/><text x="60" y="58" text-anchor="middle" class="d-n">0</text><text x="60" y="73" text-anchor="middle" class="d-s">referrals</text></svg>
          <ul class="d-leg">${SOURCES.map(([n, c]) => `<li><i style="background:${c}"></i>${n}<b>0%</b></li>`).join("")}</ul></div></section>
    </div>
    <div class="an-grid two">
      <section class="an-panel"><span class="an-label tight">Devices</span><h3 class="tx-t cut" data-level>Traffic source by device</h3>
        <div class="donut-row"><svg class="donut dev-ring" viewBox="0 0 120 120" aria-label="No traffic yet"><circle cx="60" cy="60" r="44" fill="none" stroke="var(--line)" stroke-width="16"/><circle class="donut-spin" cx="60" cy="60" r="44" fill="none" stroke="var(--bread)" stroke-width="16" stroke-dasharray="40 236.4" stroke-linecap="round"/><text x="60" y="58" text-anchor="middle" class="d-n">0</text><text x="60" y="73" text-anchor="middle" class="d-s">visits</text></svg>
          <ul class="d-leg dev-leg">${["Desktop", "Phone", "Tablet", "Other"].map((n, i) => `<li><i style="background:${["#463721", "#f0a830", "#6b2d5c", "#c2184f"][i]}"></i>${n}<b>0%</b></li>`).join("")}</ul></div></section>
      <section class="an-panel"><span class="an-label tight">Usage</span><h3 class="tx-t cut" data-level>Device users</h3>
        <label class="search full">${ic("search", "1.3em")}<input id="dev-q" type="text" placeholder="Search device" aria-label="Search device" autocomplete="off" /></label>
        <div class="tx-scroll"><table class="tx narrow"><thead><tr><th><button type="button" class="sortbtn" data-sort="source">Source ⇅</button></th><th><button type="button" class="sortbtn" data-sort="views">Page views ⇅</button></th></tr></thead><tbody id="dev-rows"></tbody></table></div>
        <div class="pager"><button type="button" disabled aria-label="Previous page">‹</button><b>1</b><button type="button" disabled aria-label="Next page">›</button></div></section>
    </div>
    <section class="an-panel wide"><span class="an-label tight">Audience geography</span><h3 class="tx-t cut" data-level>Audience map</h3>
      <div class="geo">
        <div class="geo-list"><label class="search full">${ic("search", "1.3em")}<input id="city-q" type="text" placeholder="Search city" aria-label="Search city" autocomplete="off" /></label>
          <div class="tx-scroll"><table class="tx narrow"><thead><tr><th>City</th><th>Overall audience</th></tr></thead><tbody id="city-rows"><tr><td colspan="2" class="tx-empty">No audience data yet</td></tr></tbody></table></div>
          <div class="pager"><button type="button" disabled aria-label="Previous page">‹</button><b>1</b><button type="button" disabled aria-label="Next page">›</button></div></div>
        <div class="geo-map" id="geo-map"><p class="muted map-load">Loading map…</p></div>
      </div></section>`;

  // Performance chart: two series on two scales, built once and then updated, so everything glides when you change a view.
  // With no sales yet each series is a single point at zero for today. Click a legend item to hide or show that series.
  const chart = body.querySelector("#chart");
  st.hide = { a: false, b: false };
  let drawChart = () => {};
  let refreshChart = () => {}; // set by mountChart; the legend and toggles below are wired once, so a rebuild never doubles their clicks
  body.querySelectorAll(".lg").forEach((g) => g.addEventListener("click", () => { st.hide[g.dataset.series] = !st.hide[g.dataset.series]; refreshChart(); }));
  let mountedW = 0;
  const mountChart = () => {
    if (!chart.getBoundingClientRect().width) { requestAnimationFrame(mountChart); return; } // not laid out yet
    const tickText = (v) => (v === 0 ? "0" : v.toFixed(1));
    const scales = () => ({ L: { min: -1, max: 1 }, R: { min: 0, max: 2 } }); // zero data: booking axis -1..1, page-view axis 0..2
    const W = Math.max(280, Math.round(chart.getBoundingClientRect().width)), H = W < 500 ? 280 : 340, pl = 48, pr = 48, pt = 24, pb = 56, iw = W - pl - pr, ih = H - pt - pb;
    const px = pl + iw / 2, yAt = (frac) => pt + ih - frac * ih;
    chart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="Booking performance chart, no data yet">
      <g id="grid">${[0, 1, 2, 3, 4].map((i) => `<line x1="${pl}" x2="${W - pr}" y1="${yAt(i / 4)}" y2="${yAt(i / 4)}" class="g"/><text x="${pl - 12}" y="${yAt(i / 4) + 4}" text-anchor="end" class="t tl" data-i="${i}"/><text x="${W - pr + 12}" y="${yAt(i / 4) + 4}" class="t r tr" data-i="${i}"/>`).join("")}</g>
      <line x1="${px}" x2="${px}" y1="${pt}" y2="${pt + ih}" class="g v"/>
      <line x1="${pl}" x2="${pl}" y1="${pt}" y2="${pt + ih}" class="ax"/><line x1="${W - pr}" x2="${W - pr}" y1="${pt}" y2="${pt + ih}" class="ax r"/>
      <text x="${px}" y="${H - 22}" text-anchor="middle" class="t x" id="xl"/>
      <g class="pt a"><circle r="4.5"/></g><g class="pt b"><rect x="-6" y="-3" width="12" height="6" rx="2"/></g>
      <g class="xh" visibility="hidden" pointer-events="none">
        <line class="hx" x1="${pl}" x2="${W - pr}" y1="0" y2="0"/><line class="hv" x1="0" x2="0" y1="${pt}" y2="${pt + ih}"/>
        <g class="bl"><rect rx="4" height="24"/><text text-anchor="middle"/></g><g class="br"><rect rx="4" height="24"/><text text-anchor="middle"/></g><g class="bb"><rect rx="4" height="26"/><text text-anchor="middle"/></g>
        <g class="tip t1"><rect rx="6" height="30"/><text/></g><g class="tip t2"><rect rx="6" height="30"/><text/></g>
      </g></svg>
      <p class="chart-note">No bookings yet. Lines will draw here once tickets sell.</p>`;
    const svgEl = chart.querySelector("svg"), xh = svgEl.querySelector(".xh");
    const label = () => (st.gran === "date" ? `${dd}-${mm}-${now.getFullYear()}` : st.gran === "week" ? `Week ${weekOf(now)}, ${now.getFullYear()}` : `${SHORT[now.getMonth()]} ${now.getFullYear()}`);
    const seriesName = () => (st.measure === "purchase" ? "Online booking amount" : "Tickets sold");
    const valueText = () => (st.measure === "purchase" ? "₹0" : "0");
    const place = (el, x, y) => { el.style.transform = `translate(${x}px, ${y}px)`; };
    // Move everything to match the current view. `replay` pops the points again so each change is visible.
    const update = (replay = false) => {
      const { L, R } = scales();
      svgEl.querySelectorAll(".tl").forEach((t) => { t.textContent = tickText(L.min + ((L.max - L.min) * t.dataset.i) / 4); });
      svgEl.querySelectorAll(".tr").forEach((t) => { t.textContent = tickText(R.min + ((R.max - R.min) * t.dataset.i) / 4); });
      svgEl.querySelector("#xl").textContent = label();
      body.querySelector("#lg1").textContent = seriesName();
      const a = svgEl.querySelector(".pt.a"), b = svgEl.querySelector(".pt.b");
      place(a, px, yAt((0 - L.min) / (L.max - L.min))); place(b, px, yAt((0 - R.min) / (R.max - R.min)));
      a.classList.toggle("off", st.hide.a); b.classList.toggle("off", st.hide.b);
      body.querySelectorAll(".lg").forEach((g) => { const off = st.hide[g.dataset.series]; g.classList.toggle("on", !off); g.setAttribute("aria-pressed", !off); });
      if (replay) { svgEl.classList.remove("replay"); void svgEl.getBoundingClientRect(); svgEl.classList.add("replay"); }
    };
    // Guide lines, axis badges, date badge and a tooltip per visible series follow the pointer
    const fmt = (n) => { const r = Math.round(n * 10) / 10; return r === 0 ? "0" : Number.isInteger(r) ? String(r) : r.toFixed(1); };
    const badge = (g, text, cx, cy, h) => { const t = g.querySelector("text"), r = g.querySelector("rect"), w = text.length * 7.8 + 18; t.textContent = text; r.setAttribute("width", w); r.setAttribute("x", cx - w / 2); r.setAttribute("y", cy); t.setAttribute("x", cx); t.setAttribute("y", cy + h * 0.68); };
    const narrow = W < 520; // on a phone the tooltips are short and sit centred above the points so they never cover the axis badges
    const tip = (g, text, right, cy) => { const t = g.querySelector("text"), r = g.querySelector("rect"), w = text.length * 8.2 + 22; const left = narrow ? Math.min(Math.max(px - w / 2, pl + 4), W - pr - 4 - w) : Math.max(pl + 6, right - w); t.textContent = text; r.setAttribute("width", w); r.setAttribute("x", left); r.setAttribute("y", cy); t.setAttribute("x", left + 11); t.setAttribute("y", cy + 20); };
    svgEl.addEventListener("pointermove", (e) => {
      const bx = svgEl.getBoundingClientRect(), k = W / bx.width, cx = (e.clientX - bx.left) * k, cy = (e.clientY - bx.top) * k;
      if (cx < pl || cx > W - pr || cy < pt || cy > pt + ih) { xh.setAttribute("visibility", "hidden"); svgEl.querySelector("#xl").style.visibility = ""; return; }
      xh.setAttribute("visibility", "visible");
      const { L, R } = scales(), f = (pt + ih - cy) / ih;
      xh.querySelector(".hx").setAttribute("y1", cy); xh.querySelector(".hx").setAttribute("y2", cy);
      xh.querySelector(".hv").setAttribute("x1", cx); xh.querySelector(".hv").setAttribute("x2", cx);
      badge(xh.querySelector(".bl"), fmt(L.min + (L.max - L.min) * f), pl - 24, cy - 12, 24);
      badge(xh.querySelector(".br"), fmt(R.min + (R.max - R.min) * f), W - pr + 24, cy - 12, 24);
      badge(xh.querySelector(".bb"), label(), px, pt + ih + 6, 26);
      const near = Math.abs(cx - px) < 90;
      const ya = yAt((0 - L.min) / (L.max - L.min)), yb = yAt((0 - R.min) / (R.max - R.min));
      const t1 = xh.querySelector(".t1"), t2 = xh.querySelector(".t2");
      t1.setAttribute("visibility", near && !st.hide.a ? "visible" : "hidden"); t2.setAttribute("visibility", near && !st.hide.b ? "visible" : "hidden");
      // keep both tooltips inside the plot (clear of the date badge) and apart from each other
      const maxY = pt + ih - 36, minY = pt + 2;
      const lift = narrow ? 40 : 15;
      let y1 = Math.max(minY, Math.min(maxY, ya - lift)), y2 = Math.max(minY, Math.min(maxY, yb - lift));
      const both = !st.hide.a && !st.hide.b;
      if (both && Math.abs(y1 - y2) < 36) { if (y1 <= y2) { y2 = Math.min(maxY, y1 + 36); y1 = y2 - 36; } else { y1 = Math.min(maxY, y2 + 36); y2 = y1 - 36; } }
      tip(t1, `${narrow ? (st.measure === "purchase" ? "Amount" : "Tickets") : seriesName()}: ${valueText()}`, px - 14, y1); tip(t2, narrow ? "Views: 0" : "Page views: 0", px - 14, y2);
      svgEl.querySelector("#xl").style.visibility = "hidden"; // the date badge replaces the date label while hovering
      svgEl.querySelectorAll(".pt").forEach((c) => c.classList.toggle("hot", near));
    });
    svgEl.addEventListener("pointerleave", () => { xh.setAttribute("visibility", "hidden"); svgEl.querySelector("#xl").style.visibility = ""; svgEl.querySelectorAll(".pt").forEach((c) => c.classList.remove("hot")); });
    drawChart = () => update(true);
    refreshChart = () => update();
      update(true);
    mountedW = Math.round(chart.getBoundingClientRect().width);
  };

  const paintSeg = () => body.querySelectorAll(".seg2 button").forEach((b) => b.classList.toggle("on", st[b.parentElement.dataset.group] === b.dataset.v));
  body.querySelectorAll(".seg2 button").forEach((b) => b.addEventListener("click", () => { st[b.parentElement.dataset.group] = b.dataset.v; paintSeg(); drawChart(); }));
  paintSeg(); mountChart();
  // rebuild when the width changes (phone turned, window resized) so the text keeps its size
  if (window.ResizeObserver) { const ro = new ResizeObserver(() => { if (!chart.isConnected) { ro.disconnect(); return; } const w = Math.round(chart.getBoundingClientRect().width); if (w && Math.abs(w - mountedW) > 20) mountChart(); }); ro.observe(chart); }

  // Device users: search and sort
  const DEVICES = [["Desktop", 0], ["Phone", 0], ["Tablet", 0], ["Other", 0]];
  const rows = body.querySelector("#dev-rows");
  const paintRows = () => {
    const q = st.q.trim().toLowerCase();
    const list = DEVICES.filter(([n]) => n.toLowerCase().includes(q)).sort((a, b) => (st.sort === "source" ? a[0].localeCompare(b[0]) : a[1] - b[1]) * st.dir);
    rows.innerHTML = list.length ? list.map(([n, v]) => `<tr><td>${n}</td><td>${v}</td></tr>`).join("") : '<tr><td colspan="2" class="tx-empty">No device matches</td></tr>';
  };
  paintRows();
  body.querySelector("#dev-q").addEventListener("input", (e) => { st.q = e.target.value; paintRows(); });
  body.querySelectorAll("[data-sort]").forEach((b) => b.addEventListener("click", () => { st.dir = st.sort === b.dataset.sort ? -st.dir : 1; st.sort = b.dataset.sort; paintRows(); }));

  // Page view source: search and sort (all zero until there are visits)
  const srcSt = { q: "", sort: "", dir: 1 }; // no sort at first: Google, Direct, Instagram, WhatsApp, then Other
  const srcRows = body.querySelector("#src-rows");
  const paintSources = () => {
    const q = srcSt.q.trim().toLowerCase();
    const list = SOURCES.filter(([n]) => n.toLowerCase().includes(q)).sort((a, b) => (a[0] === "Other") - (b[0] === "Other") || (srcSt.sort === "name" ? a[0].localeCompare(b[0]) * srcSt.dir : 0)); // "Other" always stays last
    srcRows.innerHTML = list.length ? list.map(([n, c]) => `<tr><td><i class="sdot" style="background:${c}"></i>${n}</td><td>0</td><td>0</td></tr>`).join("") : '<tr><td colspan="3" class="tx-empty">No source matches</td></tr>';
  };
  paintSources();
  body.querySelector("#src-q").addEventListener("input", (e) => { srcSt.q = e.target.value; paintSources(); });
  body.querySelectorAll("[data-ssort]").forEach((b) => b.addEventListener("click", () => { srcSt.dir = srcSt.sort === b.dataset.ssort ? -srcSt.dir : 1; srcSt.sort = b.dataset.ssort; paintSources(); }));

  drawMap(body.querySelector("#geo-map"));
}

// India map for the audience section. The map shapes load only when this tab is opened. Every state is empty until there are visitors.
async function drawMap(host) {
  let map;
  try { map = (await import("@svg-maps/india")).default; } catch { host.innerHTML = '<p class="muted map-load">Couldn\'t load the map.</p>'; return; }
  if (!host.isConnected) return;
  const visitors = {}; // state id -> visitors (none yet)
  const top = Math.max(1, ...Object.values(visitors));
  const fill = (id) => { const v = visitors[id] || 0; if (!v) return ""; const t = v / top; return `color-mix(in srgb, var(--strawberry) ${Math.round(35 + t * 65)}%, var(--bread))`; };
  host.innerHTML = `<svg class="geo-svg" viewBox="${map.viewBox}" role="img" aria-label="Map of India showing where your audience is. No visitors yet."><g class="geo-g">${map.locations.map((l) => `<path d="${l.path}" data-id="${l.id}" data-name="${esc(l.name)}" style="${fill(l.id) ? `fill:${fill(l.id)}` : ""}"/>`).join("")}</g></svg>
    <div class="zoom"><button type="button" data-z="1" aria-label="Zoom in">+</button><button type="button" data-z="0" aria-label="Reset zoom">⌂</button><button type="button" data-z="-1" aria-label="Zoom out">−</button></div>
    <div class="geo-foot"><div class="geo-legend"><i></i><span><b>Little</b><b>A lot</b></span></div>
      <p class="geo-credit">Map: <a href="https://github.com/VictorCazanave/svg-maps" target="_blank" rel="noopener">SVG Maps</a> (CC BY 4.0)</p></div>
    <div class="geo-tip" hidden></div>`;
  const g = host.querySelector(".geo-g"), tip = host.querySelector(".geo-tip"), svgEl = host.querySelector(".geo-svg");
  const vb = map.viewBox.split(" ").map(Number);
  const view = { k: 1, x: 0, y: 0 };
  const apply = () => { g.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.k})`; };
  g.style.transformOrigin = `${vb[2] / 2}px ${vb[3] / 2}px`;
  const clampPan = () => { const lim = (vb[2] * (view.k - 1)) / 2; const limY = (vb[3] * (view.k - 1)) / 2; view.x = Math.max(-lim, Math.min(lim, view.x)); view.y = Math.max(-limY, Math.min(limY, view.y)); };
  host.querySelectorAll("[data-z]").forEach((b) => b.addEventListener("click", () => {
    const d = +b.dataset.z; view.k = d === 0 ? 1 : Math.max(1, Math.min(4, view.k + d * 0.75));
    if (view.k === 1) { view.x = 0; view.y = 0; } clampPan(); apply();
  }));
  host.querySelectorAll("path").forEach((p) => {
    p.addEventListener("pointermove", (e) => { const hb = host.getBoundingClientRect(); tip.hidden = false; tip.textContent = `${p.dataset.name}: ${visitors[p.dataset.id] || 0} visitors`; tip.style.left = `${Math.max(4, Math.min(e.clientX - hb.left + 14, hb.width - tip.offsetWidth - 4))}px`; tip.style.top = `${e.clientY - hb.top + 14}px`; });
    p.addEventListener("pointerleave", () => { tip.hidden = true; });
  });
  // drag to move around once zoomed in
  let drag = null;
  svgEl.addEventListener("pointerdown", (e) => { if (view.k > 1) { drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; svgEl.setPointerCapture(e.pointerId); svgEl.classList.add("grab"); } });
  svgEl.addEventListener("pointermove", (e) => { if (!drag) return; const k = vb[2] / svgEl.getBoundingClientRect().width; view.x = drag.vx + (e.clientX - drag.x) * k; view.y = drag.vy + (e.clientY - drag.y) * k; clampPan(); apply(); });
  const end = () => { drag = null; svgEl.classList.remove("grab"); };
  svgEl.addEventListener("pointerup", end); svgEl.addEventListener("pointercancel", end);
}

/* ---------- Routing ---------- */
function route() {
  cutLetters.forEach((l) => l.dispose());
  cutLetters = [];
  const m = location.hash.match(/^#\/create\/(\d)$/);
  const ev = location.hash.match(/^#\/event\/([^/]+)\/(coupons|sales)$/);
  document.querySelector('[data-nav="list"]').classList.toggle("on", !m);
  if (ev) {
    draft = null;
    if (ev[2] === "coupons") renderCoupons(ev[1]); else renderSales(ev[1]);
    window.scrollTo({ top: 0 });
  } else if (m) {
    const step = Math.min(+m[1], STEPS.length - 1);
    // Opening a step by link without a started event sends people to step 0
    if (!draft && step > 0) { location.hash = "#/create/0"; return; }
    renderCreate(step);
  } else {
    draft = null;
    renderList();
  }
}
window.addEventListener("hashchange", route);
route();
