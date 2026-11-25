import { createCutLetter } from "./cutword.js";
import { restoreDrafts, backupDrafts } from "./devBackup.js";
import { renderHostChat, renderCheckIn, syncEventChat } from "./hostChat.js";

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
  { id: "guestlist", icon: "📋", name: "Sponty Plan", desc: "Entry only for the guests you approve and admit.", commission: "Free (excl. listing fee)", payout: "N/A" },
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
const save = (list) => { try { const prev = load(); localStorage.setItem(STORE, JSON.stringify(list)); backupDrafts(list); list.forEach((e) => syncEventChat(prev.find((o) => o.id === e.id), e, dayLine)); } catch { toast("Couldn't save: too many or too large images. Remove a few."); } };
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
    back.className = "modal-back centered";
    back.innerHTML = `<div class="modal small" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><div><h3 class="cut">${esc(title)}</h3></div><button type="button" class="modal-x" data-no aria-label="Close">×</button></div>
      <div class="modal-body">${message ? `<p class="ask-msg">${esc(message)}</p>` : ""}${input ? `<input class="box" id="ask-in" type="text" placeholder="${esc(input.placeholder || "")}" />` : ""}</div>
      <div class="modal-foot"><button type="button" class="btn ghost" data-no>Cancel</button><button type="button" class="btn ask-ok" data-yes>${esc(ok)}</button></div></div>`;
    document.body.append(back);
    const field = back.querySelector("#ask-in");
    const headLetters = cutHeadings(back);
    const done = (v) => { headLetters.forEach((l) => l.dispose()); document.removeEventListener("keydown", onKey); back.remove(); resolve(v); };
    const yes = () => done(field ? field.value.trim() || null : true);
    const onKey = (e) => { if (e.key === "Escape") done(null); if (e.key === "Enter" && field) { e.preventDefault(); yes(); } };
    document.addEventListener("keydown", onKey);
    back.querySelectorAll("[data-no]").forEach((b) => b.addEventListener("click", () => done(null)));
    back.querySelector("[data-yes]").addEventListener("click", yes);
    (field || back.querySelector("[data-yes]")).focus();
  });
}

// Small "Information" popup with just a close button (opened by the (i) icons)
function info(text, title = "Information") {
  const back = document.createElement("div");
  back.className = "modal-back centered";
  back.innerHTML = `<div class="modal small" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><div><h3 class="cut">${esc(title)}</h3></div><button type="button" class="modal-x" aria-label="Close">×</button></div>
    <div class="modal-body"><p class="ask-msg">${esc(text)}</p></div></div>`;
  document.body.append(back);
  const headLetters = cutHeadings(back);
  const done = () => { headLetters.forEach((l) => l.dispose()); document.removeEventListener("keydown", onKey); back.remove(); };
  const onKey = (e) => { if (e.key === "Escape") done(); };
  document.addEventListener("keydown", onKey);
  back.addEventListener("click", (e) => { if (e.target === back || e.target.closest(".modal-x")) done(); });
  back.querySelector(".modal-x").focus();
}

// The little (i) buttons: tap one to read what that field is for. Text is written for PB&J hosts.
const LINK_HOST = "peanutbutterjelly.fun"; // where the custom event links live
const COMMISSION_PCT = 5, COMMISSION_GST_PCT = 18; // change here if the commission changes
const INFO_TEXT = {
  "faq": "Answer the questions guests often ask before they book, like parking, what to carry, refreshments or the cancellation and refund policy. They show on your event page.",
  "link": "Your event's very own short link. Easy to share, easy to remember.",
  "gq": "Collect important details from the guests who book your event. Only you can see the answers.",
  "tk-types": "Add as many ticket types as you need, like Early Bird, General or VIP. Each one gets its own price and number of spots.",
  "tk-name": "Give your ticket a name guests will recognise, like Early Bird or Couple Entry, so they know exactly what they're getting.",
  "tk-qty": "How many spots you're offering for this ticket type. Keep it in line with what your venue can hold. If your event has more than one time slot, this number is for each slot.",
  "tk-price": `The price one guest pays for this ticket, before GST.\n\nPB&J commission: ${COMMISSION_PCT}% of your price\nGST on commission: ${COMMISSION_GST_PCT}% of that\n\nExample: on a ₹1,000 ticket, the commission is ₹${1000 * COMMISSION_PCT / 100} plus ₹${Math.round(1000 * COMMISSION_PCT / 100 * COMMISSION_GST_PCT) / 100} GST.\n\nFree and RSVP tickets cost nothing. Payout timing is set by PB&J.`,
};
const infoBtn = (key) => `<button type="button" class="info-btn" data-info="${key}" aria-label="What is this?"><svg viewBox="0 0 24 24" width="1.2em" height="1.2em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg></button>`;
const onInfo = (root) => root.addEventListener("click", (e) => { const b = e.target.closest("[data-info]"); if (b && INFO_TEXT[b.dataset.info]) { e.preventDefault(); e.stopPropagation(); info(INFO_TEXT[b.dataset.info]); } });

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
const eventLink = (e) => `peanutbutterjelly.fun/e/${e.id.replace(/^e/, "").slice(-7)}`;
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
  chat: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>',
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
  document.title = "My events — PeanutButterJelly.fun";
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
      <div class="tk-stub img" ${img ? `style="background-image:url(${img});${e.focus?.[imgKey(img)] ? `background-position:${e.focus[imgKey(img)]}` : ""}"` : ""}>${img ? "" : `<span>${esc((e.title || "?").trim().slice(0, 1).toUpperCase())}</span>`}${past ? '<i class="ev-past">Past</i>' : ""}<button type="button" class="flip" data-act="flip" aria-label="Turn the ticket over to see its QR code" title="Show QR code">${ic("flip", "1.2em")}</button></div>
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
        <div class="ev-tags"><span class="tag dark1">${esc(typeClash(e) ? "Fix event type" : TYPE_SHORT[e.type] || "No type")}</span>${(e.tickets || []).length ? `<span class="tag ${paid ? "dark2" : "free"}">${paid ? "Paid" : "Free"}</span>` : ""}${!done ? `<span class="tag soft">Step ${Math.min(e.step ?? 0, STEPS.length - 1) + 1} of ${STEPS.length}</span>` : ""}${past ? '<span class="tag soft">Past</span>' : ""}</div>
        ${e.type === "guestlist" ? "" : `<div class="sold">${ic("ticket", "1.2em")}<b>0</b> sold</div>`}
        ${done ? `<div class="ev-link">${ic("link", "1.1em")}<span>${eventLink(e)}</span><button type="button" data-act="copy">${ic("copy", "1.1em")}Copy</button></div>` : ""}
        <div class="ev-actions">
          ${past ? "" : `<button type="button" class="act primary" data-act="edit">${ic("edit")}${done ? "Edit" : "Continue"}</button>`}
          <button type="button" class="act" data-act="view">${ic("eye")}View event</button>
          ${e.type === "guestlist" ? "" : `<button type="button" class="act outline" data-act="sales">${ic("chart")}View sales</button>`}
          ${done ? `<button type="button" class="act" data-act="chat">${ic("chat")}Run chat</button>` : ""}
          ${done && e.type === "guestlist" ? `<button type="button" class="act" data-act="requests">${ic("check")}Requests</button>` : ""}
          ${done && !past ? `<button type="button" class="act" data-act="checkin">${ic("ticket")}Check-in</button>` : ""}
          ${past || e.type === "guestlist" ? "" : `<button type="button" class="act" data-act="coupons">${ic("tag")}Coupons</button>`}
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
        <p>${events.length ? "No events match this tab or search." : "Got something worth finding? Create your first event and share it with Mumbai."}</p></div>`;
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
    else if (what === "view") { location.href = `/event.html?id=${encodeURIComponent(e.id)}`; }
    else if (what === "flip") { const art = act.closest(".ev-card"); if (art.classList.toggle("flipped")) flipped.add(e.id); else flipped.delete(e.id); }
    else if (what === "coupons") location.hash = `#/event/${e.id}/coupons`;
    else if (what === "sales") location.hash = `#/event/${e.id}/sales`;
    else if (what === "chat") location.hash = `#/event/${e.id}/chat`;
    else if (what === "requests") location.hash = `#/event/${e.id}/requests`;
    else if (what === "checkin") location.hash = `#/event/${e.id}/checkin`;
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
  document.title = "Create an event — PeanutButterJelly.fun";
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
  addSaveDraft(host);
  cutHeadings();
  window.scrollTo({ top: 0 });
}

// Every step gets a "Save draft" button so nothing typed is lost (steps 4 to 6 already have their own)
function addSaveDraft(host) {
  const nav = host.querySelector(".nav");
  if (!nav || nav.querySelector("#save, #done")) return;
  const b = document.createElement("button");
  b.type = "button"; b.className = "btn"; b.id = "save"; b.textContent = "Save draft";
  nav.classList.remove("single"); nav.classList.add("three");
  nav.append(b);
  b.addEventListener("click", () => {
    if (!draft.type) { toast("Pick an event type first, then save your draft"); return; }
    saveCurrent(); toast("Draft saved"); draft = null; location.hash = "#/";
  });
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
    <p class="err" id="err" style="display:none">Pick an event type to continue</p>
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
  ["formatBlock", "select:style"], ["fontName", "select:font"], ["fontSize", "select:size"], ["caseText", "select:case"], ["lineHeight", "select:lh"],
  ["paraSpace", ico('<path d="M4 4h16M4 20h16M12 8v8M9 11l3-3 3 3M9 13l3 3 3-3"/>'), "Add space after paragraphs"], "|",
  ["foreColor", "color:A", "Text colour", "#463721"], ["hiliteColor", "color:bg", "Highlight colour", "#ffe386"], "|",
  ["createLink", ico('<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'), "Add link"],
  ["unlink", ico('<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/><path d="M3 3l18 18"/>'), "Remove link"],
  ["image", ico('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m21 16-5-5-9 9"/>'), "Add image"],
  ["video", ico('<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3z" fill="currentColor"/>'), "Add YouTube video"],
  ["insertHorizontalRule", ico('<path d="M4 12h16"/>'), "Divider line"],
  ["removeFormat", ico('<path d="m7 21-4-4a2 2 0 0 1 0-3L14 3a2 2 0 0 1 3 0l4 4a2 2 0 0 1 0 3L11 21H7z"/><path d="M8 11l6 6"/>'), "Clear formatting"],
  ["source", ico('<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>'), "Show HTML"],
];

// A short key for a picture, so what the host chose to show on the card survives re-ordering
const imgKey = (src) => { let h = 5381; for (let i = 0; i < src.length; i += 7) h = ((h << 5) + h + src.charCodeAt(i)) | 0; return src.length + ":" + (h >>> 0).toString(36); };

// Crop and adjust an image: drag to move, slide to zoom, pick the frame shape. Apply saves the cropped picture.
function openCropModal(src, onDone) {
  const SHAPES = [["4:5", 4 / 5, "Portrait"], ["1:1", 1, "Square"], ["16:9", 16 / 9, "Wide"]];
  let ratio = SHAPES[0][1], zoom = 1, ox = 0, oy = 0, fw = 0, fh = 0, nw = 0, nh = 0, s0 = 1;
  const back = document.createElement("div");
  back.className = "modal-back";
  back.innerHTML = `<div class="modal small crop-modal" role="dialog" aria-modal="true" aria-label="Crop image">
    <div class="modal-head"><div><h3 class="cut">Crop image</h3></div><button type="button" class="modal-x" data-no aria-label="Close">×</button></div>
    <div class="modal-body">
      <p class="crop-step" id="crop-step">Step 1 of 2 · Crop</p>
      <div id="crop-one">
        <div class="status-chips crop-shapes" role="radiogroup" aria-label="Frame shape">${SHAPES.map(([k, , n], i) => `<button type="button" role="radio" data-shape="${i}" aria-checked="${i === 0}" class="${i === 0 ? "on" : ""}">${n} <small>${k}</small></button>`).join("")}</div>
        <div class="crop-frame" id="crop-frame"><img alt="" id="crop-img" draggable="false" /></div>
        <p class="hint crop-hint">Drag the picture to move it.</p>
        <label class="crop-zoom"><span>Zoom</span><input type="range" id="crop-zoom" min="1" max="3" step="0.01" value="1" aria-label="Zoom" /></label>
      </div>
      <div id="crop-two" hidden>
        <p class="crop-ask">How it shows on your dashboard card</p>
        <div class="crop-frame crop-focus" id="focus-frame"><img alt="" id="focus-img" draggable="false" /></div>
        <p class="hint crop-hint">Your card shows a wide strip. Drag to choose which part of the picture it keeps.</p>
      </div>
    </div>
    <div class="modal-foot" id="crop-foot-one"><button type="button" class="btn ghost" id="crop-reset">Reset</button><button type="button" class="btn ghost" data-no>Cancel</button><button type="button" class="btn" id="crop-next">Next</button></div>
    <div class="modal-foot" id="crop-foot-two" hidden><button type="button" class="btn ghost" id="crop-back">Back</button><button type="button" class="btn" id="crop-ok">Apply</button></div></div>`;
  document.body.append(back);
  document.body.style.overflow = "hidden";
  const headLetters = cutHeadings(back);
  const $ = (q) => back.querySelector(q);
  const frame = $("#crop-frame"), im = $("#crop-img");
  const scale = () => s0 * zoom;
  const clamp = () => { const sc = scale(); ox = Math.min(0, Math.max(fw - nw * sc, ox)); oy = Math.min(0, Math.max(fh - nh * sc, oy)); };
  const paint = () => { clamp(); const sc = scale(); im.style.width = nw * sc + "px"; im.style.height = nh * sc + "px"; im.style.left = ox + "px"; im.style.top = oy + "px"; };
  const layout = (keepCentre) => {
    // keep whatever is in the middle of the frame in the middle when the shape or zoom changes
    let cx = nw / 2, cy = nh / 2;
    if (keepCentre && fw) { const sc = scale(); cx = (fw / 2 - ox) / sc; cy = (fh / 2 - oy) / sc; }
    const body = $(".modal-body"), cs = getComputedStyle(body);
    fw = Math.floor(Math.min(340, body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight))); fh = fw / ratio;
    frame.style.width = fw + "px"; frame.style.height = fh + "px";
    s0 = Math.max(fw / nw, fh / nh);
    const sc = scale(); ox = fw / 2 - cx * sc; oy = fh / 2 - cy * sc;
    paint();
  };
  const close = () => { headLetters.forEach((l) => l.dispose()); back.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  back.querySelectorAll("[data-no]").forEach((b) => b.addEventListener("click", close));
  im.onload = () => { nw = im.naturalWidth; nh = im.naturalHeight; layout(false); };
  im.src = src;

  let drag = null;
  frame.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, ox, oy }; frame.setPointerCapture(e.pointerId); frame.classList.add("grab"); });
  frame.addEventListener("pointermove", (e) => { if (!drag) return; ox = drag.ox + e.clientX - drag.x; oy = drag.oy + e.clientY - drag.y; paint(); });
  const end = () => { drag = null; frame.classList.remove("grab"); };
  frame.addEventListener("pointerup", end); frame.addEventListener("pointercancel", end);
  $("#crop-zoom").addEventListener("input", (e) => { const centre = [(fw / 2 - ox) / scale(), (fh / 2 - oy) / scale()]; zoom = +e.target.value; const sc = scale(); ox = fw / 2 - centre[0] * sc; oy = fh / 2 - centre[1] * sc; paint(); });
  back.querySelectorAll("[data-shape]").forEach((b) => b.addEventListener("click", () => {
    ratio = SHAPES[+b.dataset.shape][1];
    back.querySelectorAll("[data-shape]").forEach((x) => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-checked", on); });
    layout(true);
  }));
  $("#crop-reset").addEventListener("click", () => {
    zoom = 1; $("#crop-zoom").value = 1; ratio = SHAPES[0][1];
    back.querySelectorAll("[data-shape]").forEach((x) => { const on = x.dataset.shape === "0"; x.classList.toggle("on", on); x.setAttribute("aria-checked", on); });
    layout(false);
  });
  // Bake the crop into a picture (never bigger than the original)
  const bake = () => {
    const sc = scale(), W = Math.max(200, Math.min(1200, Math.round(fw / sc))), H = Math.round(W / ratio); // never bigger than the picture itself
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    g.drawImage(im, -ox / sc, -oy / sc, fw / sc, fh / sc, 0, 0, W, H);
    try { return c.toDataURL("image/jpeg", 0.85); } catch { return ""; }
  };

  // Step 2: choose which part of the cropped picture the dashboard card keeps (the card is a wide strip)
  const CARD_RATIO = 2;
  const ff = $("#focus-frame"), fi = $("#focus-img");
  let baked = "", gw = 0, gh = 0, iw = 0, ih = 0, gs = 1, gx = 0, gy = 0, fdrag = null;
  const fclamp = () => { gx = Math.min(0, Math.max(gw - iw * gs, gx)); gy = Math.min(0, Math.max(gh - ih * gs, gy)); };
  const fpaint = () => { fclamp(); fi.style.width = iw * gs + "px"; fi.style.height = ih * gs + "px"; fi.style.left = gx + "px"; fi.style.top = gy + "px"; };
  const pct = (off, boxSize, imgSize) => (boxSize - imgSize === 0 ? 50 : Math.round((off / (boxSize - imgSize)) * 100));
  const showStep = (n) => {
    $("#crop-one").hidden = n !== 1; $("#crop-two").hidden = n !== 2;
    $("#crop-foot-one").hidden = n !== 1; $("#crop-foot-two").hidden = n !== 2;
    $("#crop-step").textContent = n === 1 ? "Step 1 of 2 · Crop" : "Step 2 of 2 · Dashboard card";
  };
  $("#crop-next").addEventListener("click", () => {
    baked = bake();
    if (!baked) { toast("Couldn't crop this image"); return; }
    showStep(2);
    fi.onload = () => {
      iw = fi.naturalWidth; ih = fi.naturalHeight;
      gw = fw; gh = Math.round(gw / CARD_RATIO);
      ff.style.width = gw + "px"; ff.style.height = gh + "px";
      gs = Math.max(gw / iw, gh / ih);
      gx = (gw - iw * gs) / 2; gy = (gh - ih * gs) / 2; // starts centred
      fpaint();
    };
    fi.src = baked;
  });
  ff.addEventListener("pointerdown", (e) => { fdrag = { x: e.clientX, y: e.clientY, gx, gy }; ff.setPointerCapture(e.pointerId); ff.classList.add("grab"); });
  ff.addEventListener("pointermove", (e) => { if (!fdrag) return; gx = fdrag.gx + e.clientX - fdrag.x; gy = fdrag.gy + e.clientY - fdrag.y; fpaint(); });
  const fend = () => { fdrag = null; ff.classList.remove("grab"); };
  ff.addEventListener("pointerup", fend); ff.addEventListener("pointercancel", fend);
  $("#crop-back").addEventListener("click", () => showStep(1));
  $("#crop-ok").addEventListener("click", () => {
    const focus = `${pct(gx, gw, iw * gs)}% ${pct(gy, gh, ih * gs)}%`;
    close(); onDone(baked, focus);
  });
  $("#crop-next").focus();
}

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
  // On a phone only the everyday tools show; "More" opens the rest (every other tool has the class "more")
  const CORE = new Set(["undo", "redo", "bold", "italic", "underline", "insertUnorderedList", "insertOrderedList", "createLink"]);
  const tool = (t) => {
    if (t === "|") return '<span class="sep more"></span>';
    const [cmd, face, title, init] = t;
    const more = CORE.has(cmd) ? "" : " more";
    if (face.startsWith("select:")) return `<div class="tb-dd${more}" data-dd="${face.slice(7)}"></div>`;
    if (face.startsWith("color:")) return `<label class="colour${more}" title="${title}"><span class="${face === "color:A" ? "cA" : "cBg"}" aria-hidden="true">A</span><input type="color" value="${init}" data-cmd="${cmd}" aria-label="${title}" /></label>`;
    return `<button type="button" class="${more.trim()}" data-cmd="${cmd}" title="${title}" aria-label="${title}">${face}</button>`;
  };
  wrap.innerHTML = `<div class="rte-bar" role="toolbar">${TOOLS.map(tool).join("")}<button type="button" class="rte-more" aria-expanded="false">More tools</button></div>
    <div class="rte-body ${tall ? "tall" : ""}" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="${placeholder}"></div>
    <textarea class="rte-src box ${tall ? "tall" : ""}" hidden spellcheck="false" aria-label="HTML"></textarea>
    <input type="file" accept="image/*" hidden />`;
  const body = wrap.querySelector(".rte-body"), src = wrap.querySelector(".rte-src"), file = wrap.querySelector("input[type=file]");
  body.innerHTML = html;
  const changed = () => body.dispatchEvent(new Event("input"));

  // Undo and redo: the browser's own undo breaks when text is changed by code (case, spacing, paste, source view),
  // so the editor keeps its own list of snapshots. Ctrl/Cmd+Z, Shift+Z or Y, and the toolbar buttons all use it.
  const caretOffsets = () => {
    const sel = getSelection();
    if (!sel.rangeCount || !body.contains(sel.anchorNode)) return null;
    const r = sel.getRangeAt(0), pre = document.createRange();
    pre.selectNodeContents(body); pre.setEnd(r.startContainer, r.startOffset);
    const st = pre.toString().length;
    return { st, en: st + r.toString().length };
  };
  const setOffsets = (o) => {
    if (!o) return;
    const find = (off) => { const w = document.createTreeWalker(body, NodeFilter.SHOW_TEXT); let n, acc = 0, lastN = null; while ((n = w.nextNode())) { lastN = n; if (acc + n.data.length >= off) return [n, off - acc]; acc += n.data.length; } return lastN ? [lastN, lastN.data.length] : [body, 0]; };
    const [sn, so] = find(o.st), [en, eo] = find(o.en), r = document.createRange();
    r.setStart(sn, so); r.setEnd(en, eo);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  };
  const hist = [{ html: body.innerHTML, c: null }];
  let hi = 0, timer = 0, restoring = false;
  const record = () => {
    clearTimeout(timer); timer = 0;
    const h = body.innerHTML;
    if (h === hist[hi].html) return;
    hist.splice(hi + 1); hist.push({ html: h, c: caretOffsets() });
    if (hist.length > 200) hist.shift();
    hi = hist.length - 1;
  };
  body.addEventListener("input", () => { if (restoring) return; clearTimeout(timer); timer = setTimeout(record, 350); }); // typing is saved in short bursts
  const flush = () => { if (timer) record(); };
  const go = (d) => {
    flush();
    const j = hi + d;
    if (j < 0 || j >= hist.length) return;
    hi = j; restoring = true; body.innerHTML = hist[hi].html; restoring = false;
    body.focus(); setOffsets(hist[hi].c || { st: Infinity, en: Infinity }); changed(); // no remembered cursor: put it at the end
    const now = getSelection(); // the old remembered selection points into replaced text, so remember the new one
    saved = now.rangeCount && body.contains(now.anchorNode) ? now.getRangeAt(0).cloneRange() : null;
  };
  body.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "z") { e.preventDefault(); go(e.shiftKey ? 1 : -1); }
    else if (k === "y") { e.preventDefault(); go(1); }
  });

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
  const run = (cmd, val = null) => { flush(); restore(); document.execCommand("styleWithCSS", false, cmd === "hiliteColor" || cmd === "foreColor"); document.execCommand(cmd, false, val); changed(); };

  wrap.querySelector(".rte-bar").addEventListener("mousedown", (e) => { if (e.target.closest("button")) e.preventDefault(); }); // keep the text selected
  wrap.querySelector(".rte-more").addEventListener("click", (e) => { const bar = wrap.querySelector(".rte-bar"), on = bar.classList.toggle("open"); e.currentTarget.setAttribute("aria-expanded", on); e.currentTarget.textContent = on ? "Fewer tools" : "More tools"; });
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
    } else if (cmd === "paraSpace") paraSpace();
    else if (cmd === "undo") go(-1);
    else if (cmd === "redo") go(1);
    else run(cmd);
  }));
  // Change the case of the selected text: UPPERCASE, lowercase, Title Case or Sentence case
  const CASES = {
    "UPPERCASE": (t) => t.toUpperCase(),
    "lowercase": (t) => t.toLowerCase(),
    "Title Case": (t) => t.toLowerCase().replace(/(^|[^\p{L}\p{N}'’])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()),
    "Sentence case": (t) => t.toLowerCase().replace(/(^\s*|[.!?]\s+|\n\s*)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()), // every new line starts a sentence
  };
  const changeCase = (fn) => {
    flush(); restore();
    const sel = getSelection();
    if (!sel.rangeCount || !body.contains(sel.anchorNode)) { toast("Select some text first"); return; }
    if (sel.isCollapsed) { // just a cursor: change the whole line it is in
      const at = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
      const line = at && at.closest("li, p, div, h1, h2, h3, h4, blockquote");
      if (!line || line === body || !body.contains(line)) { toast("Select some text first"); return; }
      const r = document.createRange(); r.selectNodeContents(line); sel.removeAllRanges(); sel.addRange(r);
    }
    const range = sel.getRangeAt(0), nodes = [];
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!range.intersectsNode(n)) continue;
      const from = n === range.startContainer ? range.startOffset : 0, to = n === range.endContainer ? range.endOffset : n.data.length;
      if (to > from) nodes.push({ n, from, to });
    }
    const keep = { sc: range.startContainer, so: range.startOffset, ec: range.endContainer, eo: range.endOffset };
    // Join the pieces with a line break wherever a new line (bullet, paragraph) starts, so each line is treated as its own
    const blockOf = (n) => n.parentElement && n.parentElement.closest("li, p, div, h1, h2, h3, h4, blockquote");
    const cut = nodes.map((x, k) => k > 0 && blockOf(x.n) !== blockOf(nodes[k - 1].n));
    const whole = nodes.map((x, k) => (cut[k] ? "\n" : "") + x.n.data.slice(x.from, x.to)).join(""), out = fn(whole);
    let i = 0;
    const even = out.length === whole.length; // case changes keep the length, so the result can be handed back piece by piece
    nodes.forEach((x, k) => { if (cut[k]) i += 1; const len = x.to - x.from, piece = even ? out.slice(i, i + len) : fn(x.n.data.slice(x.from, x.to)); i += len; x.n.data = x.n.data.slice(0, x.from) + piece + x.n.data.slice(x.to); });
    // Rewriting text makes the browser pull the end of the selection back to the start of each changed piece, which would drop
    // the last lines from the selection. Put the selection back exactly as it was, so another change still covers all of it.
    const back = document.createRange();
    back.setStart(keep.sc, Math.min(keep.so, keep.sc.nodeType === 3 ? keep.sc.data.length : keep.sc.childNodes.length));
    back.setEnd(keep.ec, Math.min(keep.eo, keep.ec.nodeType === 3 ? keep.ec.data.length : keep.ec.childNodes.length));
    sel.removeAllRanges(); sel.addRange(back); saved = back.cloneRange();
    changed();
  };
  // Line spacing and space after paragraphs work on every block (paragraph, list item, heading) the selection touches
  const blocksInSelection = () => {
    flush(); restore();
    const sel = getSelection();
    if (!sel.rangeCount || !body.contains(sel.anchorNode)) return [];
    const pick = () => [...body.querySelectorAll("p, div, li, h1, h2, h3, h4, blockquote")].filter((b) => !b.querySelector("p, div, li, h1, h2, h3, h4, blockquote, ul, ol") && sel.getRangeAt(0).intersectsNode(b));
    let blocks = pick();
    if (!blocks.length) { document.execCommand("formatBlock", false, "p"); blocks = pick(); }
    return blocks;
  };
  const lineSpacing = (v) => { const bs = blocksInSelection(); if (!bs.length) { toast("Click in your text first"); return; } bs.forEach((b) => { b.style.lineHeight = v === "1.5" ? "" : v; }); changed(); };
  const paraSpace = () => { const bs = blocksInSelection(); if (!bs.length) { toast("Click in your text first"); return; } const on = bs.some((b) => b.style.marginBottom !== "1em"); bs.forEach((b) => { b.style.marginBottom = on ? "1em" : ""; }); changed(); };

  // Style, font and size are dropdown lists (same look as the other dropdowns on this page)
  const dd = (name) => wrap.querySelector(`[data-dd="${name}"]`);
  dropdown(dd("style"), STYLES.map(([, n]) => n), "Default", (n) => run("formatBlock", STYLES.find(([, x]) => x === n)[0]));
  dropdown(dd("font"), FONTS, "Default", (f) => run("fontName", f === "Default" ? "Chivo Mono" : f));
  dropdown(dd("size"), ["1", "2", "3", "4", "5", "6", "7"], "3", (n) => run("fontSize", n));
  const resetLabel = (root, text) => { const l = root.querySelector(".tl"); l.textContent = text; l.classList.remove("ph"); };
  dropdown(dd("case"), Object.keys(CASES), "Aa Case", (n) => { changeCase(CASES[n]); resetLabel(dd("case"), "Aa Case"); });
  dropdown(dd("lh"), ["Tight (1)", "Snug (1.15)", "Normal (1.5)", "Relaxed (1.8)", "Double (2)", "Airy (2.5)"], "Line spacing", (n) => { lineSpacing(n.match(/\(([\d.]+)\)/)[1]); resetLabel(dd("lh"), "Line spacing"); });
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
      <p class="err">Give your event a title</p>
    </div>
    <div class="field" id="f-desc">
      <span class="lab">Description <span class="req">*</span> <span style="font-weight:400;opacity:.55">Tell attendees what to expect</span></span>
      <div class="slot"></div>
      <p class="hint count"><span id="c-desc">0</span>/3500</p>
      <p class="err">Tell attendees a little about the event</p>
    </div>
    <div class="field" id="f-terms">
      <span class="lab">Terms &amp; conditions <span class="opt">Optional</span></span>
      <div class="slot"></div>
      <p class="hint count"><span id="c-terms">0</span>/10000</p>
    </div>
    <div class="field" id="f-faq">
      <span class="lab">FAQs ${infoBtn("faq")} <span class="opt">Optional</span></span>
      <button type="button" class="disc-toggle gq-toggle" id="faq-toggle"><span id="faq-label">Add FAQs</span><b id="faq-sign" aria-hidden="true">+</b></button>
    </div>
    <div class="field" id="f-gq">
      <span class="lab">Guest questions ${infoBtn("gq")} <span class="opt">Optional</span></span>
      <button type="button" class="disc-toggle gq-toggle" id="gq-toggle"><span id="gq-label">Add guest questions</span><b id="gq-sign" aria-hidden="true">+</b></button>
    </div>
    <div class="nav"><button class="btn dark prev" type="button" id="prev">Previous</button><button class="btn" type="button" id="next">Next</button></div>`;

  const title = host.querySelector("#title");
  title.value = draft.title;
  const desc = editor({ html: draft.description, placeholder: "Spill the tea!\n\nThe vibe: what's this event all about?\nThe plan: what actually happens?\nThe takeaway: why should people show up?\n\nBe descriptive and punchy!", max: 3500 });
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

  const paintGq = () => {
    const n = (draft.questions || []).length;
    host.querySelector("#gq-label").textContent = n ? `${n} guest question${n === 1 ? "" : "s"}` : "Add guest questions";
    const sg = host.querySelector("#gq-sign"); sg.textContent = n ? "Edit" : "+"; sg.classList.toggle("word", !!n);
  };
  const paintFaq = () => {
    const n = (draft.faqs || []).length;
    host.querySelector("#faq-label").textContent = n ? `${n} FAQ${n === 1 ? "" : "s"}` : "Add FAQs";
    const sg = host.querySelector("#faq-sign"); sg.textContent = n ? "Edit" : "+"; sg.classList.toggle("word", !!n);
  };
  paintFaq();
  onInfo(host.querySelector("#f-faq"));
  host.querySelector("#faq-toggle").addEventListener("click", () => openFaqModal(draft.faqs || [], (list) => { draft.faqs = list; paintFaq(); persist(1); }));
  paintGq();
  onInfo(host.querySelector("#f-gq"));
  host.querySelector("#gq-toggle").addEventListener("click", () => openQuestionsModal(draft.questions || [], (list) => { draft.questions = list; paintGq(); persist(1); }));

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
    host.querySelector("#f-desc .err").textContent = dLen > 3500 ? "That's over 3500 characters. Please trim it" : "Tell attendees a little about the event";
    if (tLen > 10000) { toast("Terms are over 10000 characters"); return; }
    if (badTitle || badDesc) { host.querySelector(".bad")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    persist(2);
    location.hash = "#/create/2";
  });
  title.addEventListener("input", () => host.querySelector("#f-title").classList.remove("bad"));
}

/* ---------- Step 2: Event details ---------- */
const CATEGORIES = {
  // Each category has plenty of sub categories: the words people actually search for
  "Music": ["Live gig", "DJ night", "Open mic", "Classical & jazz", "Indie", "Hip-hop", "Devotional & folk", "Karaoke", "Acoustic session", "Ghazal & qawwali", "Rock & metal", "Electronic", "Bollywood night", "Jam session", "Vinyl listening"],
  "Comedy": ["Stand-up", "Improv", "Open mic comedy", "Storytelling", "Roast night", "Sketch comedy", "Hindi stand-up", "Crowd work", "Comedy & dinner", "Newbie night", "Bilingual comedy", "Late-night laughs"],
  "Art & Culture": ["Gallery walk", "Exhibition opening", "Heritage walk", "Museum night", "Art talk", "Street art tour", "Photography show", "Sculpture", "Folk art", "Cultural evening", "Indie film art", "Zine launch", "Artist studio visit"],
  "Art & craft": ["Pottery", "Painting", "Printmaking", "Crochet & textiles", "Calligraphy", "Photography walk", "Sketching", "Jewellery making", "Linocut", "Candle making", "Embroidery", "Macrame", "Resin art", "Block printing", "Journaling"],
  "Creative Meetup": ["Sketch meetup", "Writers circle", "Designers meetup", "Makers night", "Illustrators hangout", "Creative co-working", "Show and tell", "Portfolio review", "Collab jam", "Open studio", "Craft and chat", "Zine making"],
  "Open Mic": ["Singers", "Poets", "Comedians", "Storytellers", "Musicians jam", "Spoken word", "Beginners welcome", "Acoustic open mic", "Hindi open mic", "Rap cypher", "Instrument swap", "Sign up on the night"],
  "Poetry": ["Spoken word", "Slam poetry", "Hindi kavita", "Urdu shayari", "Poetry reading", "Open verse", "Book launch", "Haiku", "Ghazal evening", "Words & wine", "Marathi kavita", "Poetry workshop"],
  "Food & drink": ["Tasting", "Supper club", "Cooking class", "Coffee & chai", "Cocktails", "Street food walk", "Baking", "Wine tasting", "Beer tasting", "Whisky night", "Brunch", "Potluck", "Dessert crawl", "Vegan eats", "Regional thali"],
  "Supper Club": ["Home dinner", "Chef-led dinner", "Pop-up kitchen", "Multi-course meal", "Communal table", "Themed dinner", "Regional cuisine", "Rooftop dinner", "Vegetarian dinner", "Dinner with strangers", "Farm-to-table", "BYOB dinner"],
  "Chef's Table": ["Tasting menu", "Meet the chef", "Live kitchen", "Wine pairing", "Seasonal menu", "Fine dining", "Omakase", "Chef collab", "Kitchen counter", "Degustation", "Limited seats", "Dessert course"],
  "Coffee": ["Cupping", "Latte art", "Brew workshop", "Specialty coffee", "Coffee & books", "Filter coffee", "Cold brew", "Barista basics", "Coffee crawl", "Chai vs coffee", "Roastery visit", "Coffee & conversation"],
  "Movie": ["Indie screening", "Classic film", "Short films", "Documentary", "Outdoor cinema", "Silent film", "Director Q&A", "Film club", "Bollywood retro", "Horror night", "Anime night", "Rooftop movie"],
  "Theatre": ["Play", "Monologue", "Musical", "Street play", "Improv theatre", "Drama workshop", "Staged reading", "Puppet show", "Mime", "Backstage tour", "Hindi natak", "Marathi theatre"],
  "Dance": ["Salsa", "Bachata", "Hip-hop dance", "Bollywood dance", "Contemporary", "Kathak", "Garba", "Swing", "Dance social", "Beginner class", "Freestyle jam", "Zumba", "Tango", "Ecstatic dance"],
  "Nightlife": ["Club night", "Rooftop party", "Themed party", "Silent disco", "Day party", "Techno", "House music", "Pub crawl", "Live DJ", "Ladies night", "Neon night", "After-party", "Karaoke night"],
  "Party": ["House party", "Rooftop party", "Pool party", "Beach party", "Birthday bash", "Theme party", "Costume party", "Festive party", "New Year's Eve", "Holi party", "Garden party", "Glow party", "College party"],
  "Pet Meetup": ["Dog meetup", "Puppy playdate", "Cat cafe", "Adoption drive", "Pet photoshoot", "Dog training", "Pet-friendly brunch", "Walk with dogs", "Rescue stories", "Pet parents", "Doggy yoga", "Breed meetup"],
  "Networking": ["Founders mixer", "Startup meetup", "Career circle", "Freelancers meetup", "Women in business", "Creators connect", "Industry mixer", "Coffee roulette", "Speed networking", "Mentor hour", "Investor meet", "Alumni meet"],
  "Social Mixer": ["Meet new people", "New in town", "Ice-breaker games", "Speed friending", "Solo-friendly", "Wine & mingle", "Rooftop mixer", "Expat meetup", "Weekend hangout", "Friends of friends", "Intro-friendly", "Mixer & music"],
  "Dating / Singles Mixer": ["Speed dating", "Singles night", "Blind date", "Date night", "Matchmaking", "Dating game night", "Queer mixer", "30+ singles", "Coffee date", "Love & wine", "Compatibility games", "Meet your match"],
  "Community Meetup": ["Neighbourhood meetup", "Local group", "Book swap", "Clean-up drive", "Volunteer meetup", "Community dinner", "Interest group", "Skill share", "Town hall", "Cultural meet", "Student meetup", "Weekend gathering"],
  "Outdoor": ["Beach clean-up", "Sunrise walk", "Picnic", "Sunset watch", "Bird watching", "Trek", "Nature walk", "Kayaking", "Stargazing", "Cycling ride", "Fort visit", "Monsoon walk", "Mangrove walk"],
  "Camping": ["Overnight camp", "Lakeside camping", "Bonfire night", "Tent stay", "Glamping", "Beginner camping", "Stargazing camp", "Weekend getaway", "Campfire stories", "Trek & camp", "Family camping", "Monsoon camping"],
  "Fitness": ["HIIT", "Bootcamp", "Strength training", "Cardio", "Calisthenics", "Pilates", "CrossFit", "Boxing", "Functional training", "Zumba", "Mobility", "Outdoor workout", "Beginner fitness"],
  "Run Club": ["Morning run", "5K", "10K", "Half marathon prep", "Beginner runners", "Sea-link run", "Trail run", "Pace groups", "Run & brunch", "Night run", "Charity run", "Sunday long run"],
  "Sports": ["Football", "Cricket", "Box cricket", "Badminton", "Tennis", "Basketball", "Volleyball", "Pickleball", "Table tennis", "Swimming", "Frisbee", "Skating", "Padel", "Turf game"],
  "Board Games": ["Strategy games", "Party games", "Card games", "Catan", "Beginner friendly", "Cooperative games", "Tabletop RPG", "Dungeons & Dragons", "Chess night", "Ludo & carrom", "Game cafe", "Tournament", "Mystery games"],
  "Gaming": ["Console night", "PC LAN", "Mobile esports", "FIFA tournament", "Valorant", "Retro arcade", "Co-op games", "Game jam", "Cosplay gaming", "Speedrun", "Fighting games", "VR gaming", "Casual play"],
  "Quiz & Trivia": ["Pub quiz", "Movie quiz", "Music quiz", "General knowledge", "Bollywood trivia", "Team quiz", "Sports quiz", "Harry Potter quiz", "History quiz", "Picture round", "Quizzing league", "Beginner quiz"],
  "Books & Reading": ["Book club", "Silent reading", "Author talk", "Book swap", "Poetry & prose", "Library night", "Comics & manga", "Reading marathon", "Writers workshop", "Book launch", "Fiction circle", "Non-fiction club"],
  "Workshop": ["Hands-on class", "Beginner workshop", "Weekend workshop", "Skill session", "DIY workshop", "Creative workshop", "Kids workshop", "Corporate workshop", "Photography workshop", "Writing workshop", "Cooking workshop", "Craft workshop", "Learn something new"],
  "Wellness": ["Yoga", "Breathwork", "Sound bath", "Meditation", "Reiki", "Ice bath", "Sauna", "Journaling circle", "Mindfulness", "Ayurveda", "Self-care Sunday", "Stretch & restore", "Digital detox", "Mental health circle"],
  "Spirituality": ["Kirtan", "Satsang", "Meditation retreat", "Gita study", "Sufi evening", "Full moon circle", "Tarot", "Astrology", "Chanting", "Silent retreat", "Temple walk", "Interfaith dialogue"],
  "Pop-up": ["Pop-up shop", "Pop-up dinner", "Pop-up cafe", "Brand launch", "Designer pop-up", "Limited-time store", "Pop-up bar", "Capsule collection", "Home-brand showcase", "Collab pop-up", "Sample sale", "Studio sale"],
  "Market": ["Flea market", "Thrift swap", "Art fair", "Zine fair", "Farmers market", "Night market", "Handmade market", "Vintage market", "Craft bazaar", "Plant market", "Christmas market", "Book market", "Food bazaar"],
  "Fashion & Thrift": ["Clothes swap", "Thrift pop-up", "Fashion show", "Upcycling", "Styling session", "Vintage fashion", "Sustainable fashion", "Designer sale", "Sneaker meet", "Textile talk", "Saree swap", "Jewellery showcase"],
  "Masterclass": ["Chef masterclass", "Photography masterclass", "Music masterclass", "Acting masterclass", "Writing masterclass", "Business masterclass", "Design masterclass", "Cocktail masterclass", "Art masterclass", "Film masterclass", "Expert-led", "Limited seats"],
  "Talk / Panel": ["Fireside chat", "Panel discussion", "TED-style talk", "Q&A session", "Founder story", "Author conversation", "Expert talk", "Debate", "Open forum", "Industry talk", "Lecture", "Podcast live", "Storytelling talk"],
  "Bar Lectures": ["Science at the bar", "History over drinks", "Philosophy pub talk", "Economics & beer", "Space talk", "Psychology night", "Mythology & mocktails", "Art history", "Tech talk at the bar", "Wine & knowledge", "Law & liquor", "Cocktails & curiosity"],
  "Tech & Startups": ["Hackathon", "Demo day", "AI meetup", "Founders circle", "Product talk", "Coding night", "Design & tech", "Pitch night", "Web3 meetup", "Open source", "No-code", "Startup mixer"],
  "Treks & Travel": ["Day trek", "Sunrise trek", "Monsoon trek", "Weekend getaway", "Backpackers meetup", "Travel stories", "Road trip", "Fort trek", "Waterfall trek", "Solo travellers", "Heritage trail", "Photo walk"],
  "Festival": ["Music festival", "Food festival", "Film festival", "Literature festival", "Cultural fest", "Art festival", "Street festival", "Diwali", "Ganesh Chaturthi", "Holi", "Navratri", "Comedy fest"],
  "Kids & Family": ["Kids workshop", "Storytime", "Family day", "Teen meetup", "Craft for kids", "Parent circle", "Puppet show", "Science for kids", "Kids' cooking", "Playdate", "Family picnic", "Holiday camp"],
  "Volunteering": ["Beach clean-up", "Tree planting", "Food drive", "Animal shelter", "Teach & mentor", "Blood donation", "Charity run", "Fundraiser", "Community kitchen", "Donation drive", "Cleanliness drive", "Skill volunteering"],
  "Language Exchange": ["Hindi practice", "English conversation", "French meetup", "Spanish meetup", "Japanese meetup", "German meetup", "Marathi practice", "Tamil practice", "Polyglot night", "Conversation cafe", "Beginner friendly", "Tandem partners"],
  // Festive, seasonal and out-of-the-box plans
  "Potluck": ["Bring a dish", "Themed potluck", "Vegetarian potluck", "Rooftop potluck", "Regional potluck", "Dessert potluck", "Dinner with strangers", "Recipe swap", "Brunch potluck", "Festival potluck", "Office potluck", "Park picnic potluck", "Games & potluck"],
  "Diwali Parties": ["Diwali card party", "Teen patti night", "Rangoli workshop", "Diya painting", "Diwali brunch", "Ethnic wear party", "Diwali mela", "Sweets & mithai tasting", "Lantern night", "Firecracker-free Diwali", "Diwali potluck", "Rooftop Diwali", "Friends & family Diwali", "Diwali pop-up"],
  "Halloween": ["Costume party", "Horror movie night", "Haunted walk", "Pumpkin carving", "Spooky supper", "Zombie run", "Ghost stories", "Scary escape room", "Witches' night", "Halloween rave", "Trick-or-treat for kids", "Face painting", "Monster mash", "Haunted house"],
  "Christmas & Winter": ["Christmas market", "Carol night", "Secret Santa", "Cookie baking", "Plum cake workshop", "Tree decorating", "Winter picnic", "Christmas brunch", "Midnight mass walk", "Ugly sweater party", "Hot chocolate night", "Gift swap", "Christmas pop-up"],
  "New Year's Eve": ["Countdown party", "Rooftop NYE", "Beach NYE", "Beach bonfire", "House party NYE", "Dinner & midnight", "Live DJ NYE", "Silent disco NYE", "Sunrise on 1 January", "Resolution workshop", "Fireworks view", "NYE brunch", "Couples NYE"],
  "Holi": ["Holi colours party", "Organic colours", "Rain dance", "Thandai & gujiya", "Holi music", "Holi mela", "Dhol & DJ", "Holi brunch", "Holi for kids", "Holi pool party", "Holi in the park", "Phoolon ki Holi"],
  "Navratri & Garba": ["Garba night", "Dandiya raas", "Navratri pass", "Traditional wear contest", "Garba classes", "Navratri fast food", "Folk music", "Dandiya for families", "Rooftop garba", "Couples garba", "Navratri pop-up", "Chaniya choli market"],
  "Ganesh Chaturthi": ["Eco-friendly Ganesh", "Clay idol making", "Visarjan walk", "Aarti evenings", "Modak making", "Pandal hopping", "Cultural programme", "Dhol-tasha", "Rangoli contest", "Community Ganpati", "Ganesh decoration workshop", "Mumbai pandal tour"],
  "Eid & Iftar": ["Iftar dinner", "Community iftar", "Eid mela", "Eid brunch", "Mehendi night", "Chaand raat", "Biryani festival", "Qawwali night", "Ramzan food walk", "Eid gifting market", "Sheer khurma tasting", "Charity iftar"],
  "Valentine's & Galentine's": ["Couples dinner", "Galentine's brunch", "Singles' night out", "Love letter workshop", "Pottery date", "Date night", "Paint & sip", "Couples dance class", "Anti-Valentine's party", "Flower arranging", "Sunset date", "Speed friending"],
  "Pride & Queer": ["Pride party", "Drag night", "Queer open mic", "Pride march", "Queer film screening", "Ballroom", "Safe space meetup", "Queer art show", "Rainbow brunch", "Allies meetup", "Support circle", "Drag brunch"],
  "Rave & Underground": ["Warehouse rave", "Techno night", "Secret location", "Afterhours", "Psytrance", "Bass music", "B2B DJ set", "Silent rave", "Sunrise set", "Underground house", "Lights & lasers", "Daytime rave", "Vinyl only"],
  "Monsoon Plans": ["Monsoon trek", "Chai & pakoda", "Rain walk", "Monsoon music", "Waterfall visit", "Rain photography", "Monsoon picnic", "Poetry in the rain", "Rainy day board games", "Monsoon drive", "Rooftop in the rain", "Mumbai rains walk"],
  "Sunset & Rooftop": ["Sunset session", "Rooftop picnic", "Golden hour", "Sundowner", "Rooftop music", "Terrace dinner", "Skyline views", "Sunset yoga", "Rooftop cinema", "Beach sunset", "Marine Drive walk", "Rooftop mixer"],
  "Murder Mystery": ["Whodunit dinner", "Detective night", "Clue-style game", "Live-action mystery", "Murder at the party", "Noir night", "Team sleuthing", "Roleplay evening", "Costume mystery", "Cold case", "Mystery brunch", "Spy night"],
  "Escape Rooms & Puzzles": ["Escape room", "Puzzle night", "Treasure hunt", "Scavenger hunt", "Riddle walk", "Jigsaw meetup", "Lock-in challenge", "City quest", "Mystery box", "Brain teasers", "Team challenge", "Cipher game"],
  "Cosplay & Anime": ["Anime screening", "Cosplay meetup", "Manga swap", "Comic con", "K-pop night", "Fan art", "J-pop night", "Anime quiz", "Cosplay contest", "Collectibles fair", "Fandom meetup", "Studio Ghibli night"],
  "Street Art & Graffiti": ["Graffiti walk", "Mural painting", "Spray-paint workshop", "Street art tour", "Live painting", "Stencil art", "Wall jam", "Artist meet", "Poster art", "Urban sketching", "Colaba art walk", "Bandra street art"],
  "Tattoo & Body Art": ["Flash day", "Henna art", "Tattoo convention", "Temporary tattoos", "Piercing day", "Mehendi workshop", "Body painting", "Tattoo artist meet", "Stick & poke", "Design your own", "Glitter bar", "Face painting"],
  "Vinyl & Record Fair": ["Vinyl swap", "Record listening", "Crate digging", "DJ vinyl set", "Retro music night", "Cassette culture", "Hi-fi listening", "Turntable workshop", "Album listening party", "Collectors meet", "Old Bollywood vinyl", "Jazz records"],
  "Photography": ["Photo walk", "Portrait shoot", "Street photography", "Film camera meet", "Night photography", "Mobile photography", "Photo exhibition", "Photo editing", "Golden hour shoot", "Polaroid party", "Darkroom", "Wedding photography talk"],
  "Wine & Beer": ["Wine tasting", "Beer tasting", "Craft beer", "Natural wine", "Cider night", "Brewery tour", "Vineyard visit", "Cheese & wine", "Cocktail class", "Mocktail workshop", "Whisky & cigars", "Sake & Soju", "Gin night"],
  "Sustainability": ["Upcycling workshop", "Clothes swap", "Zero-waste living", "Composting", "Urban gardening", "Plant swap", "Beach clean-up", "Bring-your-own-bottle", "Repair cafe", "Eco market", "Thrift haul", "Climate talk"],
  "Plant & Garden": ["Terrarium workshop", "Plant swap", "Succulent party", "Urban gardening", "Bonsai", "Flower arranging", "Seed library", "Plant market", "Garden brunch", "Herb gardening", "Kokedama", "Botanical walk"],
  "Mehfil & Culture Nights": ["Mushaira", "Dastangoi", "Qawwali night", "Ghazal evening", "Classical concert", "Sufi night", "Kathak recital", "Folk night", "Kavi sammelan", "Baithak", "Tabla jugalbandi", "Thumri evening"]
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
      <p class="err">Pick a category</p>
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
      <p class="err">Pick at least one sub category</p>
    </div>
    <div class="two">
      <div class="field" id="f-city">
        <label for="city">City <span class="req">*</span></label>
        <div class="combo">
          <input id="city" class="box" type="text" autocomplete="off" placeholder="Search city" role="combobox" aria-expanded="false" aria-controls="city-list" />
          <ul class="combo-list" id="city-list" role="listbox" hidden></ul>
        </div>
        <p class="hint">Type 3 or more letters to search</p>
        <p class="err">Choose a city from the list</p>
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
        <p class="err">Choose the venue</p>
      </div>
      <div class="field tg-field">
        <span class="lab" aria-hidden="true">&nbsp;</span>
        <div class="tg-row" id="tg-row">
          <button type="button" class="tg-pill" id="tg-women" aria-pressed="false"><span>Women only</span><b aria-hidden="true">+</b></button>
          <button type="button" class="tg-pill" id="tg-hide" aria-pressed="false"><span>Hide location until booking</span><b aria-hidden="true">+</b></button>
        </div>
      </div>
    </div>
    <p class="notice info tg-note" id="tg-note" hidden>For women-only events, guests can see the exact location only after booking.</p>
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
      <p class="err">Add at least one image</p>
    </div>
    <div class="field">
      <label for="yt">YouTube video <span class="opt">Optional</span></label>
      <input id="yt" class="box" type="url" placeholder="Enter YouTube video URL (e.g. https://www.youtube.com/watch?v=…)" />
      <p class="err" id="yt-err" style="display:none">That doesn't look like a YouTube link</p>
    </div>
    <div class="field" id="f-link">
      <span class="lab">Custom event link <span class="opt">Optional</span> ${infoBtn("link")}</span>
      <div class="box link-box"><span class="link-pre">${LINK_HOST}/e/</span><input id="slug" type="text" maxlength="40" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="yourevent" aria-label="Custom event link" /></div>
      <p class="err" id="slug-err">Use at least 3 letters or numbers</p>
    </div>
    <div class="nav"><button class="btn dark prev" type="button" id="prev">Previous</button><button class="btn" type="button" id="next">Next</button></div>`;

  const $ = (q) => host.querySelector(q);
  const subs = $("#subs"), city = $("#city"), list = $("#city-list");
  const subPop = $("#subpop"), subQ = $("#subq"), subList = $("#sublist"), subAdd = $("#subadd");
  // Typed something that isn't in a list? Offer to add it as its own entry (attr = the data attribute the list's click handler reads)
  const addRow = (typed, all, attr) => {
    const t = typed.trim().replace(/\s+/g, " ").slice(0, 40);
    return t && !all.some((o) => o.toLowerCase() === t.toLowerCase()) ? `<li role="option" tabindex="-1" class="addnew" ${attr}="${esc(t)}"><span>+ Add “${esc(t)}”</span></li>` : "";
  };
  const paintSubList = () => {
    const q = subQ.value.trim().toLowerCase();
    const hits = (CATEGORIES[draft.category] || []).filter((o) => o.toLowerCase().includes(q));
    const add = addRow(subQ.value, [...(CATEGORIES[draft.category] || []), ...draft.subs], "data-sub");
    subList.innerHTML = (hits.length || add) ? hits.map((o) => `<li role="option" tabindex="-1" data-sub="${esc(o)}" aria-selected="${draft.subs.includes(o)}" class="${draft.subs.includes(o) ? "sel" : ""}"><span>${esc(o)}</span>${draft.subs.includes(o) ? "<b>✓</b>" : ""}</li>`).join("") + add : '<li class="none">No match</li>';
  };
  const paintSubs = () => {
    subs.innerHTML = draft.subs.map((o) => `<span class="tag">${esc(o)}<button type="button" data-rm-sub="${esc(o)}" aria-label="Remove ${esc(o)}">×</button></span>`).join("");
    $("#subcount").innerHTML = `<b>${draft.subs.length}</b>/5 sub-categories selected${draft.category ? "" : " · pick a category first"}`;
    subAdd.disabled = !draft.category || draft.subs.length >= 5;
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
    const add = addRow(catQ.value, Object.keys(CATEGORIES), "data-cat");
    catList.innerHTML = (hits.length || add) ? hits.map((c) => `<li role="option" tabindex="-1" data-cat="${esc(c)}" aria-selected="${c === draft.category}" class="${c === draft.category ? "sel" : ""}">${esc(c)}</li>`).join("") + add : '<li class="none">No match</li>';
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
    const typed = city.value.trim().replace(/\s+/g, " ").slice(0, 40);
    const add = CITIES.some((c) => c.toLowerCase() === typed.toLowerCase()) ? "" : `<li role="option" class="addnew" data-city="${esc(typed)}" tabindex="-1"><span>+ Add “${esc(typed)}”</span></li>`;
    list.innerHTML = hits.map((c) => `<li role="option" data-city="${c}" tabindex="-1">${c}</li>`).join("") + add;
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
    thumbs.innerHTML = draft.images.map((src, i) => `<figure class="thumb"><img src="${src}" alt="Event image ${i + 1}" /><button type="button" data-rm="${i}" aria-label="Remove image ${i + 1}">${ico('<path d="M6 6l12 12M18 6L6 18"/>')}</button>${src ? `<button type="button" class="crop" data-crop="${i}" aria-label="Crop image ${i + 1}" title="Crop and adjust">${ico('<path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2"/>')}</button>` : ""}${i === 0 ? "<figcaption>Cover</figcaption>" : src ? `<button type="button" class="mk" data-cover="${i}">Make cover</button>` : ""}</figure>`).join("");
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
  thumbs.addEventListener("click", (e) => {
    const c = e.target.closest("[data-cover]");
    if (c) { const [img] = draft.images.splice(+c.dataset.cover, 1); draft.images.unshift(img); paintThumbs(); return; }
    const k = e.target.closest("[data-crop]");
    if (k) { const i = +k.dataset.crop; openCropModal(draft.images[i], (data, focus) => { draft.images[i] = data; (draft.focus ??= {})[imgKey(data)] = focus; paintThumbs(); }); return; }
    const b = e.target.closest("[data-rm]"); if (b) { draft.images.splice(+b.dataset.rm, 1); paintThumbs(); }
  });

  // Women only / hide location pills
  const paintTg = () => {
    const w = !!draft.womenOnly, h = w || !!draft.hideLocation;
    [["#tg-women", w], ["#tg-hide", h]].forEach(([q, on]) => { const b = $(q); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); b.querySelector("b").textContent = on ? "−" : "+"; });
    $("#tg-hide").disabled = w; // women-only events always hide the location until booking
    $("#tg-note").hidden = !w;
  };
  paintTg();
  $("#tg-women").addEventListener("click", () => { draft.womenOnly = !draft.womenOnly; paintTg(); });
  $("#tg-hide").addEventListener("click", () => { draft.hideLocation = !draft.hideLocation; paintTg(); });
  // Custom event link
  const slug = $("#slug");
  slug.value = draft.slug || "";
  onInfo($("#f-link"));
  const slugProblem = (v) => !v ? "" : v.length < 3 ? "Use at least 3 letters or numbers" : load().some((x) => x.id !== draft.id && x.slug === v) ? "That link is already taken. Try another" : "";
  slug.addEventListener("input", () => {
    const v = slug.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-").slice(0, 40);
    if (v !== slug.value) slug.value = v;
    draft.slug = v.replace(/^-|-$/g, "");
    $("#f-link").classList.remove("bad");
  });
  slug.addEventListener("blur", () => { slug.value = draft.slug || ""; });
  const yt = $("#yt");
  yt.value = draft.youtube;
  yt.addEventListener("input", () => { draft.youtube = yt.value.trim(); $("#yt-err").style.display = "none"; });

  saveCurrent = () => { draft.images = draft.images.filter(Boolean); persist(2); };
  $("#prev").addEventListener("click", () => { saveCurrent(); location.hash = "#/create/1"; });
  $("#next").addEventListener("click", () => {
    draft.images = draft.images.filter(Boolean);
    const checks = [["#f-cat", !!draft.category], ["#f-subs", draft.subs.length > 0], ["#f-city", !!draft.city], ["#f-media", draft.images.length > 0], ["#f-pick", draft.venueStatus !== "Decided" || !!draft.venue]];
    checks.forEach(([q, ok]) => $(q).classList.toggle("bad", !ok));
    const slugMsg = slugProblem(draft.slug || "");
    $("#f-link").classList.toggle("bad", !!slugMsg); $("#slug-err").textContent = slugMsg || "Use at least 3 letters or numbers";
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
      <p class="err">Pick at least one date</p>
    </div>
    <div class="field" id="f-start">
      <span class="lab">Start time <span class="req">*</span></span>
      ${timeSelects("st")}
      <p class="err">Choose the start time</p>
    </div>
    <div class="field" id="f-end">
      <div class="lab-row"><span class="lab">End time</span>
        <label class="check"><input type="checkbox" id="showend" /> Show end time</label></div>
      <p class="hint" id="end-hint">Showing start time only. Tick the box to add an end time.</p>
      <div id="end-wrap" hidden>${timeSelects("en")}</div>
    </div>
    <div class="switch-row repeat-row">
      <div><b>Repeat this event <button type="button" class="info-btn" id="rep-info" aria-label="About repeating an event"><svg viewBox="0 0 24 24" width="1.2em" height="1.2em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg></button></b></div>
      <button type="button" class="switch" id="rep-on" role="switch" aria-label="Repeat this event"><i></i></button>
    </div>
    <div class="field" id="rep-wrap" hidden></div>
    <div class="nav"><button class="btn dark prev" type="button" id="prev">Previous</button><button class="btn" type="button" id="next">Next</button></div>`;
  const $ = (q) => host.querySelector(q);

  // Repeat this event: off by default; when on, guests can pick between the event time (Slot 1) and up to 3 more slots
  draft.repeat = { on: false, slots: [], ...(draft.repeat?.slots ? draft.repeat : {}) };
  const MAX_EXTRA = 3;
  const blank = () => ({ from: "", to: "", st: { h: "", m: "" }, en: { h: "", m: "" } });
  draft.repeat.slots = draft.repeat.slots.map((t) => ({ ...blank(), ...t, st: t.st || { h: "", m: "" }, en: t.en || { h: "", m: "" } }));
  const trash = '<svg viewBox="0 0 24 24" width="1.2em" height="1.2em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
  const timeBlock = (i, key, lab) => `<div class="slot-time"><span class="lab">${lab}</span><div class="time-row"><div data-t="${i}-${key}-h"></div><div data-t="${i}-${key}-m"></div></div></div>`;
  // Slot 1 mirrors the event's own dates and times, so it follows them as they change
  const refreshSum = () => {
    const el = $(".slot-sum"); if (!el) return;
    const d = draft.dateFrom ? (draft.dateTo && draft.dateTo !== draft.dateFrom ? `${prettyDate(draft.dateFrom)} → ${prettyDate(draft.dateTo)}` : prettyDate(draft.dateFrom)) : "No date picked yet";
    const t = draft.start.h && draft.start.m ? `${hm(draft.start)}${draft.showEnd && draft.end.h && draft.end.m ? ` – ${hm(draft.end)}` : ""}` : "No time picked yet";
    el.innerHTML = `<span>${d}</span><span>${t}</span>`;
  };
  const paintRepeat = () => {
    const r = draft.repeat;
    $("#rep-on").classList.toggle("on", r.on); $("#rep-on").setAttribute("aria-checked", r.on);
    $("#rep-wrap").hidden = !r.on;
    if (!r.on) return;
    const first = `<div class="time-slot slot-first"><div class="slot-head"><b>Slot 1</b><span class="slot-tag">The event above</span></div>
      <div class="slot-sum"></div></div>`;
    const extra = r.slots.map((t, i) => `<div class="time-slot" data-i="${i}"><div class="slot-head"><b>Slot ${i + 2}</b>
        <button type="button" class="btn small ghost slot-del" data-del="${i}" aria-label="Remove slot ${i + 2}">${trash}</button></div>
      <div class="field"><span class="lab">Dates</span><div data-rp="${i}"></div></div>
      <div class="slot-times">${timeBlock(i, "st", "Start time")}${timeBlock(i, "en", "End time")}</div></div>`).join("");
    $("#rep-wrap").innerHTML = first + extra +
      `<div class="add-row slot-add-row"><button type="button" class="btn small" id="slot-add" ${r.slots.length >= MAX_EXTRA ? "disabled" : ""}>+ Add slot</button></div>
       <p class="hint">Add up to ${MAX_EXTRA} more times (the event time above is the first). Guests pick one of the times to book.</p>`;
    refreshSum();
    r.slots.forEach((t, i) => {
      rangePicker($(`[data-rp="${i}"]`), t, () => {}, { min: draft.dateFrom || "" });
      [["st", "h", HOURS, "HH"], ["st", "m", MINUTES, "MM"], ["en", "h", HOURS, "HH"], ["en", "m", MINUTES, "MM"]].forEach(([key, k, opts, ph]) =>
        dropdown($(`[data-t="${i}-${key}-${k}"]`), opts, t[key][k], (v) => { t[key][k] = v; }, ph));
    });
  };
  paintRepeat();
  $("#rep-info").addEventListener("click", () => info("Create multiple sessions under a single experience. Attendees can choose the slot they'd like to book."));
  $("#rep-on").addEventListener("click", () => {
    const r = draft.repeat; r.on = !r.on;
    if (r.on && !r.slots.length) r.slots.push(blank());
    paintRepeat();
  });
  $("#rep-wrap").addEventListener("click", (e) => {
    const r = draft.repeat;
    if (e.target.closest("#slot-add") && r.slots.length < MAX_EXTRA) { r.slots.push(blank()); paintRepeat(); }
    const del = e.target.closest("[data-del]");
    if (del) { r.slots.splice(+del.dataset.del, 1); paintRepeat(); }
  });

  // Calendar: pick a first and last day (the same day twice for a one-day event); days before today are greyed out
  const cal = $("#cal"), btn = $("#datebtn");
  const today = iso(new Date());
  const startView = () => { const d = draft.dateFrom ? new Date(draft.dateFrom + "T00:00") : new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); };
  let view = startView();
  const label = () => {
    const { dateFrom: f, dateTo: t } = draft;
    $("#datelabel").textContent = f ? (t && t !== f ? `${prettyDate(f)} – ${prettyDate(t)}` : prettyDate(f)) : "Select dates…";
    $("#datelabel").classList.toggle("ph", !f);
    refreshSum();
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
      ul.addEventListener("click", (e) => { const li = e.target.closest("[data-v]"); if (!li) return; t[k] = li.dataset.v; label(); setOpen(false); refreshSum(); $("#f-start").classList.remove("bad"); });
      const outside = (e) => { if (!host.isConnected) { document.removeEventListener("click", outside); return; } if (!pop.hidden && !e.composedPath().includes(pop.parentElement)) setOpen(false); };
      document.addEventListener("click", outside);
    });
  };
  bind("st", draft.start); bind("en", draft.end);
  const showEnd = () => { $("#end-wrap").hidden = !draft.showEnd; $("#end-hint").hidden = draft.showEnd; $("#showend").checked = draft.showEnd; };
  showEnd();
  $("#showend").addEventListener("change", (e) => { draft.showEnd = e.target.checked; showEnd(); refreshSum(); });

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
    draft.repeat.slots = draft.repeat.slots.filter((t) => t.from && t.st.h && t.st.m);
    if (!draft.repeat.slots.length) draft.repeat.on = false;
    persist(4);
    location.hash = "#/create/4";
  });
}

/* ---------- Step 4: Tickets ---------- */
const tIco = (d) => `<svg viewBox="0 0 24 24" width="2.6em" height="2.6em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const TICKET_TYPES = [
  { id: "guest", name: "Guest Ticket", desc: "Perfect for Sponty plans or special guests attending your event.", icon: tIco('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>') },
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
function rangePicker(root, state, onChange, { min = "", max = "", single = false } = {}) {
  root.classList.add("combo");
  root.innerHTML = `<button type="button" class="box datebtn" aria-haspopup="dialog" aria-expanded="false"><span class="tl"></span>
      <svg viewBox="0 0 24 24" width="1.6em" height="1.6em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg></button>
    <div class="cal" role="dialog" aria-label="Choose sale dates" hidden></div>`;
  const btn = root.querySelector("button"), cal = root.querySelector(".cal"), today = iso(new Date());
  const lo = min && min > today ? min : today; // days before this, or after `max`, can't be picked
  const startView = () => { const d = state.from ? new Date(state.from + "T00:00") : new Date(lo + "T00:00"); return new Date(d.getFullYear(), d.getMonth(), 1); };
  let view = startView();
  const label = () => { const l = root.querySelector(".tl"); l.textContent = state.from ? (single ? prettyDate(state.from) : `${prettyDate(state.from)} → ${prettyDate(state.to || state.from)}`) : (single ? "Select date…" : "Select dates…"); l.classList.toggle("ph", !state.from); };
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
      if (single) { state.from = v; state.to = v; label(); setOpen(false); onChange(); return; } // one tap picks the day
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
  const t = existing ? { saleFrom: "", saleTo: "", tag: "", includes: "", enabled: true, status: "Live", ...existing, saleSt: { h: "", m: "", ...existing.saleSt }, saleEn: { h: "", m: "", ...existing.saleEn } } : { id: newId(), type: type.id, name: type.name, paid: type.id !== "guest", qty: "", order: type.id === "group" || type.id === "season" ? "group" : "single", groupSize: "", price: "", gst: "No GST", saleEnd: { mode: "start", date: "", h: "", m: "" }, tag: "", includes: "", enabled: true, status: "Live" };
  if (/^\d+(\.\d+)?%$/.test(t.gst)) t.gst += " IGST"; // tickets saved before the GST list was updated
  // Sales open when the event is published and close at a time the host chooses (see the Sale period settings)
  const evFrom = draft.dateFrom || "", evTo = draft.dateTo || draft.dateFrom || "";
  t.tag = t.tag || t.label1 || ""; t.includes = t.includes || t.label2 || ""; delete t.label1; delete t.label2; // the old two labels became a Tag and a What's included line
  t.saleEnd = { mode: "start", date: "", h: "", m: "", ...(t.saleEnd || {}) }; // older tickets had fixed sale dates: they now follow the new setting

  const back = document.createElement("div");
  back.className = "modal-back";
  back.innerHTML = `<div class="modal coupon-modal" role="dialog" aria-modal="true" aria-label="${esc(type.name)}">
    <div class="modal-head plain"><div><h3 class="cut">${esc(type.name)}</h3><p>Fill in the required fields below</p></div><button type="button" class="modal-x" data-x aria-label="Close">×</button></div>
    <div class="modal-body">
      <div class="seg" role="tablist"><button type="button" data-paid="1">Paid</button><button type="button" data-paid="0">✓ RSVP / Free</button></div>
      <div class="two tight">
        <div class="field"><label for="tk-name">Name <span class="req">*</span> ${infoBtn("tk-name")}</label><input id="tk-name" class="box" type="text" maxlength="60" /></div>
        <div class="field"><label for="tk-qty">Quantity <span class="req">*</span> <span class="opt-note" id="qty-per" hidden>per slot</span> ${infoBtn("tk-qty")}</label><input id="tk-qty" class="box" type="number" min="1" step="1" inputmode="numeric" placeholder="0" /></div>
      </div>
      <div class="field" id="slots-wrap" hidden><div class="slots-head"><span class="lab">Available for <span class="req">*</span></span><span class="slots-sum" id="slots-hint"></span></div>
        <div class="slot-chips" id="tk-slots" role="group" aria-label="Time slots"></div></div>
      <div class="two tight">
        <div class="field"><label for="tk-tag">Tag <span class="opt-note">optional</span></label><input id="tk-tag" class="box" type="text" maxlength="20" placeholder="e.g. Early Bird" /></div>
        <div class="field"><label for="tk-inc">What's included <span class="opt-note">optional</span></label><input id="tk-inc" class="box" type="text" maxlength="60" placeholder="e.g. Dinner + a drink" /></div>
      </div>
      <div id="pricing">
        <p class="mini-title">Pricing</p>
        <span class="lab">Order type</span>
        <div class="order"><button type="button" data-order="single"><svg viewBox="0 0 24 24" width="1.6em" height="1.6em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>Single</button><button type="button" data-order="group"><svg viewBox="0 0 24 24" width="1.6em" height="1.6em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a7 7 0 0 1 4 6"/></svg>Group</button></div>
        <div class="field" id="gs-wrap" hidden><label for="tk-gs">People per group <span class="req">*</span></label><input id="tk-gs" class="box" type="number" min="2" step="1" inputmode="numeric" placeholder="e.g. 4" /><button type="button" class="bk-add gs-add" id="gs-add">Add another group size +</button></div>
        <div class="two tight">
          <div class="field"><label for="tk-price">Price <span class="req">*</span> ${infoBtn("tk-price")}</label><div class="money"><span>₹</span><input id="tk-price" class="box" type="number" min="0" step="any" inputmode="decimal" placeholder="0" /></div></div>
          <div class="field"><span class="lab">GST</span><div id="tk-gst"></div></div>
        </div>
        <div class="pays"><span>Customer pays</span><b id="pays"></b></div>
        <button type="button" class="disc-toggle" id="disc-toggle" aria-expanded="false"><span>Add ticket discount</span><b id="disc-sign" aria-hidden="true">+</b></button>
        <div id="disc" class="disc-box" hidden>
          <div class="field" id="df-code"><label for="dc-code">Discount code <span class="req">*</span></label><input id="dc-code" class="box caps" type="text" maxlength="20" autocomplete="off" placeholder="E.g. EARLY20" /><p class="err" id="dc-code-err">Use 3 to 20 letters or numbers</p></div>
          <div class="field"><span class="lab">Discount value <span class="req">*</span></span>
            <div class="disc"><div class="seg" role="tablist"><button type="button" data-dtype="pct">% PCT</button><button type="button" data-dtype="inr">₹ INR</button></div><input id="dc-val" class="box" type="number" min="1" step="any" inputmode="decimal" placeholder="e.g. 20" /></div></div>
          <div class="field"><label for="dc-max">Max users <span class="req">*</span></label><input id="dc-max" class="box" type="number" min="1" step="1" inputmode="numeric" placeholder="e.g. 50 (how many people can use it)" /></div>
          <p class="hint" id="dc-hint">Works on this ticket for all your event dates. Change dates and more later in Coupons.</p>
        </div>
        <button type="button" class="disc-toggle bulk-toggle" id="bulk-toggle"><span id="bulk-label">Add bulk discount</span><b id="bulk-sign" aria-hidden="true">+</b></button>
        <div class="bulk-sum" id="bulk-sum" hidden><span id="bulk-tiers"></span><button type="button" class="link-btn" id="bulk-rm">Remove</button></div>
      </div>
      <button type="button" class="opt-toggle" id="opt-toggle" aria-expanded="false"><span class="ot-l"><svg viewBox="0 0 24 24" width="1.3em" height="1.3em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>Optional settings</span><svg viewBox="0 0 24 24" width="1.4em" height="1.4em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
      <div id="opt" hidden>
        <p class="mini-title">Sale period</p>
        <p class="sale-open">Sales open as soon as you publish this event.</p>
        <div class="field"><span class="lab">Sales end</span><div id="sale-mode"></div>
          <div id="sale-custom" class="sale-row" hidden><div id="sale-date"></div><div id="se-h"></div><div id="se-m"></div></div>
          <p class="hint" id="sale-hint"></p></div>
        <p class="mini-title">Visibility &amp; status</p>
        <div class="switch-row"><div><b>Enable ticket</b><span>Available for purchase when enabled</span></div><button type="button" class="switch" id="tk-on" role="switch" aria-checked="true" aria-label="Enable ticket"><i></i></button></div>
        <div class="field"><span class="lab">Ticket status</span>
          <div class="status-chips"><button type="button" data-status="Live"><i class="dot live"></i>Live</button><button type="button" data-status="Coming Soon"><i class="dot soon"></i>Coming Soon</button><button type="button" data-status="Sold Out"><i class="dot out"></i>Sold Out</button></div></div>
      </div>
    </div>
    <div class="modal-foot tk-foot"><p class="tk-need" id="tk-need" role="status" hidden></p><button type="button" class="btn ghost" data-x>Cancel</button><button type="button" class="btn" id="tk-save">✓ Save ticket</button></div>
  </div>`;
  document.body.append(back);
  document.body.style.overflow = "hidden";
  const headLetters = cutHeadings(back);
  onInfo(back);
  const $ = (q) => back.querySelector(q);
  // Guest tickets are RSVP / free only: no Paid option
  if (type.id === "guest") { t.paid = false; $(".seg").classList.add("single"); $(".seg").innerHTML = '<span>✓ RSVP / Free</span>'; }
  $("#tk-name").value = t.name; $("#tk-qty").value = t.qty; $("#tk-price").value = t.price; $("#tk-gs").value = t.groupSize; $("#tk-tag").value = t.tag; $("#tk-inc").value = t.includes;
  dropdown($("#tk-gst"), GST_OPTIONS, t.gst, (v) => { t.gst = v; refresh(); });

  // Optional discount for this ticket: it is saved as a normal coupon (Coupons page) that applies to this ticket only
  const mine = (draft.coupons || []).find((x) => x.appliesTo === t.id);
  const dsc = { on: !!mine, code: mine ? mine.code : "", type: mine ? mine.type : "pct", value: mine ? mine.value : "", max: mine ? mine.max : "" };
  const dcTaken = () => (draft.coupons || []).some((x) => x !== mine && x.code.toLowerCase() === dsc.code.trim().toLowerCase());
  const dcValueOk = () => (dsc.type === "pct" ? +dsc.value >= 1 && +dsc.value <= 100 : +dsc.value > 0);
  const dcOk = () => !dsc.on || (/^[A-Z0-9_-]{3,20}$/.test(dsc.code.trim()) && !dcTaken() && dcValueOk() && +dsc.max >= 1 && !!evFrom);
  // Optional bulk discount for this ticket (kept here until the ticket is saved, then stored with the event)
  const myBulk = (draft.bulk || []).find((x) => x.appliesTo === t.id);
  let bulk = myBulk ? { ...myBulk, tiers: myBulk.tiers.map((x) => ({ ...x })) } : null;
  const paintBulk = () => {
    $("#bulk-label").textContent = bulk ? "Bulk discount" : "Add bulk discount";
    $("#bulk-sign").textContent = bulk ? "Edit" : "+"; $("#bulk-sign").classList.toggle("word", !!bulk);
    $("#bulk-sum").hidden = !bulk;
    if (bulk) $("#bulk-tiers").innerHTML = tierChips(bulk.tiers);
  };
  $("#bulk-toggle").addEventListener("click", () => openBulkModal(draft, bulk, { lockTo: t.id, lockName: () => t.name }, (r) => { bulk = { ...r, appliesTo: t.id }; paintBulk(); }));
  $("#bulk-rm").addEventListener("click", () => { bulk = null; paintBulk(); });
  paintBulk();
  // What is still missing, in plain words (the same checks as valid())
  const needs = () => {
    const l = [];
    if (!t.name.trim()) l.push("a name");
    if (!(+t.qty >= 1)) l.push("a quantity");
    if (!t.paid) return l;
    if (t.order === "group" && !(+t.groupSize >= 2)) l.push("the people per group");
    if (!(+t.price > 0)) l.push("a price");
    if (!dcOk()) l.push("the ticket discount details");
    if (t.saleEnd.mode === "custom" && !saleEndAt()) l.push("the date and time sales end");
    return l;
  };
  const valid = () => {
    if (!t.name.trim() || !(+t.qty >= 1)) return false;
    if (!t.paid) return true;
    if (!(+t.price > 0)) return false;
    if (!dcOk()) return false;
    if (t.saleEnd.mode === "custom" && !saleEndAt()) return false;
    return t.order !== "group" || +t.groupSize >= 2;
  };
  const refresh = () => {
    back.querySelectorAll("[data-paid]").forEach((b) => b.classList.toggle("on", (b.dataset.paid === "1") === t.paid));
    back.querySelectorAll("[data-order]").forEach((b) => b.classList.toggle("on", b.dataset.order === t.order));
    $("#pricing").hidden = !t.paid;
    $("#gs-wrap").hidden = t.order !== "group";
    $("#pays").innerHTML = rupees(+t.price * (1 + gstRate(t.gst)) || 0) + (t.order === "group" && t.paid ? ` <small>${+t.groupSize >= 2 ? `for ${t.groupSize} people` : "per group"}</small>` : "");
    $("#disc").hidden = !dsc.on; $("#disc-toggle").setAttribute("aria-expanded", dsc.on); $("#disc-sign").textContent = dsc.on ? "−" : "+";
    back.querySelectorAll("[data-dtype]").forEach((b) => b.classList.toggle("on", b.dataset.dtype === dsc.type));
    $("#dc-val").placeholder = dsc.type === "pct" ? "e.g. 20" : "e.g. 100";
    const dup = dsc.on && dcTaken(); $("#df-code").classList.toggle("bad", dup); $("#dc-code-err").textContent = dup ? "This code is already used for this event" : "Use 3 to 20 letters or numbers";
    $("#dc-hint").textContent = evFrom ? "Works on this ticket for all your event dates. Change dates and more later in Coupons." : "Pick your event dates in the Schedule step first, so the discount knows when it's valid.";
    $("#tk-save").disabled = !valid();
    $("#gs-add").disabled = !valid();
    const nd = needs(); // say what is stopping Save, instead of just greying it out
    $("#tk-need").hidden = !nd.length;
    $("#tk-need").textContent = nd.length ? `To save, add ${nd.length > 1 ? nd.slice(0, -1).join(", ") + " and " + nd[nd.length - 1] : nd[0]}` : "";
    paintSlots();
  };
  // Time slots: when the event has more than one, choose which slots this ticket is sold for (quantity counts per slot)
  const slotsInfo = eventSlots(draft), nSlots = slotsInfo.length;
  t.slots = t.slots ?? "all";
  const paintSlots = () => {
    $("#slots-wrap").hidden = nSlots < 2; $("#qty-per").hidden = nSlots < 2;
    if (nSlots < 2) return;
    const sel = ticketSlotIdx(t, nSlots), allOn = sel.length === nSlots;
    $("#tk-slots").innerHTML = `<button type="button" class="slot-chip ${allOn ? "on" : ""}" data-slot="all" aria-pressed="${allOn}">All slots</button>` + slotsInfo.map((sl, i) => `<button type="button" class="slot-chip ${!allOn && sel.includes(i) ? "on" : ""}" data-slot="${i}" aria-pressed="${!allOn && sel.includes(i)}">${esc(slotName(sl, i))}</button>`).join("");
    $("#slots-hint").textContent = +t.qty > 0 ? `${t.qty} per slot × ${sel.length} = ${+t.qty * sel.length} tickets` : "Quantity is per slot";
  };
  $("#tk-slots").addEventListener("click", (e) => {
    const b = e.target.closest("[data-slot]"); if (!b) return;
    if (b.dataset.slot === "all") t.slots = "all";
    else {
      const i = +b.dataset.slot; let cur = Array.isArray(t.slots) ? t.slots.filter((j) => j < nSlots) : [];
      cur = t.slots === "all" || !cur.length ? [i] : cur.includes(i) ? cur.filter((j) => j !== i) : [...cur, i].sort((p, q) => p - q);
      if (!cur.length) return; // at least one slot
      t.slots = cur.length === nSlots ? "all" : cur;
    }
    paintSlots();
  });
  const bindInput = (q, key) => $(q).addEventListener("input", (e) => { t[key] = e.target.value; refresh(); });
  bindInput("#tk-name", "name"); bindInput("#tk-qty", "qty"); bindInput("#tk-price", "price"); bindInput("#tk-gs", "groupSize"); bindInput("#tk-tag", "tag"); bindInput("#tk-inc", "includes");
  $("#dc-code").value = dsc.code; $("#dc-val").value = dsc.value; $("#dc-max").value = dsc.max;
  $("#disc-toggle").addEventListener("click", () => { dsc.on = !dsc.on; refresh(); if (dsc.on) $("#dc-code").focus(); });
  $("#dc-code").addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""); dsc.code = e.target.value; refresh(); });
  $("#dc-val").addEventListener("input", (e) => { dsc.value = e.target.value; refresh(); });
  $("#dc-max").addEventListener("input", (e) => { dsc.max = e.target.value; refresh(); });
  back.querySelectorAll("[data-dtype]").forEach((b) => b.addEventListener("click", () => { dsc.type = b.dataset.dtype; refresh(); }));
  // A group ticket still called "Group Ticket" (or "Group of N") is named after its size, so several sizes stay easy to tell apart
  $("#tk-gs").addEventListener("input", (e) => {
    if (/^group( ticket| of \d+)?$/i.test(t.name.trim()) && +e.target.value >= 2) { t.name = `Group of ${+e.target.value}`; $("#tk-name").value = t.name; refresh(); }
  });
  // When the host first goes to type a price and no bank account is added yet, remind them. Asked once per ticket window,
  // and again for the next ticket, until an organizer with bank details exists.
  let askedBank = false;
  $("#tk-price").addEventListener("focus", () => {
    if (askedBank || !t.paid || (draft.organizers || []).some((o) => o.account)) return;
    askedBank = true; $("#tk-price").blur();
    bankReminder(() => close(), () => { const p = $("#tk-price"); p.focus(); p.select(); }); // "Add bank details" leaves this window; closing puts the cursor back in Price
  });
  // Tapping into Price with the starting 0 in it selects it, so typing replaces it
  $("#tk-price").addEventListener("focus", (e) => { if (["", "0"].includes(e.target.value)) e.target.select(); });
  // Sales end: when the event starts, a set time before it, or a custom date and time
  const SALE_MODES = [["start", "When the event starts"], ["1h", "1 hour before the event"], ["24h", "24 hours before the event"], ["custom", "A custom date and time"]];
  const eventStartAt = () => (draft.dateFrom && draft.start && draft.start.h && draft.start.m ? new Date(`${draft.dateFrom}T${draft.start.h}:${draft.start.m}`) : null);
  const fmtAt = (d) => `${d.getDate()} ${SHORT[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const saleEndAt = () => { // when sales close, or null if it can't be worked out yet
    const m = t.saleEnd.mode;
    if (m === "custom") return t.saleEnd.date && t.saleEnd.h && t.saleEnd.m ? new Date(`${t.saleEnd.date}T${t.saleEnd.h}:${t.saleEnd.m}`) : null;
    const st = eventStartAt(); if (!st) return null;
    return new Date(st.getTime() - (m === "24h" ? 24 : m === "1h" ? 1 : 0) * 3600e3);
  };
  const paintSale = () => {
    $("#sale-custom").hidden = t.saleEnd.mode !== "custom";
    $("#sale-hint").classList.toggle("need", t.saleEnd.mode === "custom" && !saleEndAt());
    const at = saleEndAt();
    $("#sale-hint").textContent = t.saleEnd.mode === "custom" ? (at ? `Sales close on ${fmtAt(at)}.` : "Pick the date and time sales should close.") : at ? `Sales close on ${fmtAt(at)}${nSlots > 1 ? " for Slot 1, and the same time before each other slot" : ""}.` : "Set your event date and time in the Schedule step to see exactly when sales close.";
  };
  const saleDay = { get from() { return t.saleEnd.date; }, set from(v) { t.saleEnd.date = v; }, get to() { return t.saleEnd.date; }, set to(v) { t.saleEnd.date = v; } };
  const todayIso = iso(new Date());
  rangePicker($("#sale-date"), saleDay, () => { paintSale(); refresh(); }, { min: todayIso, max: slotsInfo[slotsInfo.length - 1].to || evTo || "", single: true }); // up to the last slot's day
  dropdown($("#sale-mode"), SALE_MODES.map(([, n]) => n), SALE_MODES.find(([k]) => k === t.saleEnd.mode)[1], (n) => { t.saleEnd.mode = SALE_MODES.find(([, x]) => x === n)[0]; paintSale(); refresh(); });
  dropdown($("#se-h"), HOURS, t.saleEnd.h, (v) => { t.saleEnd.h = v; paintSale(); refresh(); }, "HH"); dropdown($("#se-m"), MINUTES, t.saleEnd.m, (v) => { t.saleEnd.m = v; paintSale(); refresh(); }, "MM");
  paintSale();
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
  const commit = () => {
    t.name = t.name.trim();
    const endAt = saleEndAt(); t.saleEndAt = endAt ? `${endAt.getFullYear()}-${String(endAt.getMonth() + 1).padStart(2, "0")}-${String(endAt.getDate()).padStart(2, "0")}T${String(endAt.getHours()).padStart(2, "0")}:${String(endAt.getMinutes()).padStart(2, "0")}` : ""; // read by the public event page
    draft.coupons ??= [];
    if (t.paid && dsc.on) {
      const base = { code: dsc.code.trim(), type: dsc.type, value: dsc.value, max: dsc.max, appliesTo: t.id };
      if (mine) Object.assign(mine, base);
      else draft.coupons.unshift({ id: newId(), ...base, from: evFrom, to: evTo || evFrom, st: { h: "00", m: "00" }, en: { h: "23", m: "55" }, active: true, used: 0 });
    } else if (mine) { draft.coupons = draft.coupons.filter((x) => x !== mine); toast("Ticket discount removed"); }
    draft.bulk ??= [];
    draft.bulk = draft.bulk.filter((x) => x.appliesTo !== t.id);
    if (t.paid && bulk) draft.bulk.push({ ...bulk, appliesTo: t.id });
    onSave(t); close();
  };
  $("#tk-save").addEventListener("click", () => { if (valid()) commit(); });
  // "Add another group size": save this group ticket, then open a fresh Group ticket window for the next size
  $("#gs-add").addEventListener("click", () => {
    if (!valid()) return;
    const saved = t.name.trim();
    commit(); toast(`${saved} saved. Add the next group size.`);
    openTicketModal(type, null, onSave);
  });
  refresh();
  $("#tk-name").focus();
}

function stepTickets(host) {
  draft.tickets ??= []; delete draft.ticketTypes;
  host.innerHTML = `
    <h2 class="section-title cut">Tickets</h2>
    <p class="section-sub">Select ticket type ${infoBtn("tk-types")}</p>
    <div id="typenote"></div>
    <div class="tickets" role="group" aria-label="Ticket types">
      ${TICKET_TYPES.map((t) => `<button type="button" class="tkt" data-t="${t.id}">
        <span class="tkt-badge" data-count="${t.id}" hidden></span>
        <span class="tkt-ico">${t.icon}</span><h3 class="cut">${t.name}</h3><p>${t.desc}</p></button>`).join("")}
    </div>
    <div class="made" id="made"></div>
    <p class="err bk-err" id="tk-next-err" role="alert" hidden>Add at least one ticket to continue</p>
    <div class="nav three"><button class="btn dark prev" type="button" id="prev">Previous</button><button class="btn" type="button" id="next">Next</button><button class="btn" type="button" id="save">Save draft</button></div>`;
  cutHeadings();
  onInfo(host);
  const next = host.querySelector("#next"), made = host.querySelector("#made");
  const note = host.querySelector("#typenote");
  const paint = () => {
    // a Sponty plan only has free tickets: the paid kinds are locked, and a clash is explained with a one-tap fix
    const free = draft.type === "guestlist";
    note.innerHTML = free ? `<div class="notice type-notice"><b>${typeClash(draft) ? "This event is set to Sponty but it has a paid ticket." : "Sponty plans only have free tickets."}</b><span>To sell paid tickets, switch the event type:</span><div class="type-notice-btns"><button type="button" class="btn small" data-settype="exclusive">Exclusive event</button><button type="button" class="btn small" data-settype="open">Non-exclusive event</button></div></div>` : "";
    TICKET_TYPES.forEach((tt) => {
      const el = host.querySelector(`[data-t="${tt.id}"]`);
      el.classList.toggle("locked", free && tt.id !== "guest");
      el.setAttribute("aria-disabled", free && tt.id !== "guest");
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
        <div class="made-info"><span class="pill ${cls}">${st}</span><b>${esc(x.name)}</b><span class="made-meta">${price} · Qty: ${ticketQtyText(x, eventSlots(draft).length)}${ticketSlotText(x, eventSlots(draft).length) ? ` · ${ticketSlotText(x, eventSlots(draft).length)}` : ""}${(x.tag || x.label1) ? ` · ${esc(x.tag || x.label1)}` : ""}</span></div>
        <div class="made-ctl"><div class="m-status"></div><div class="m-enabled"></div>
          <button type="button" class="icon-btn" data-edit-t="${x.id}" aria-label="Edit ${esc(x.name)}" title="Edit"><svg viewBox="0 0 24 24" width="1.5em" height="1.5em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7"/><path d="M18.4 2.6a2 2 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button>
          <button type="button" class="icon-btn danger" data-del-t="${x.id}" aria-label="Remove ${esc(x.name)}" title="Remove"><svg viewBox="0 0 24 24" width="1.5em" height="1.5em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg></button></div></div>`;
    }).join("") : "";
    const sl = eventSlots(draft); // more than one time slot: show how many tickets each one has
    if (sl.length > 1 && draft.tickets.length) made.insertAdjacentHTML("beforeend", `<div class="slot-tot"><p class="slot-tot-h">Tickets per slot</p>${slotTotals(draft.tickets, sl.length).map((n, i) => `<div class="slot-line"><div>${esc(slotName(sl[i], i))}</div><strong>${n} tickets</strong></div>`).join("")}</div>`);
    made.querySelectorAll(".made-row").forEach((row) => {
      const x = draft.tickets.find((q) => q.id === row.dataset.id);
      dropdown(row.querySelector(".m-status"), ["Live", "Coming Soon", "Sold Out"], x.status || "Live", (v) => { x.status = v; persist(4); paint(); });
      dropdown(row.querySelector(".m-enabled"), ["Enabled", "Disabled"], x.enabled === false ? "Disabled" : "Enabled", (v) => { x.enabled = v === "Enabled"; persist(4); paint(); });
    });
    if (draft.tickets.length) host.querySelector("#tk-next-err").hidden = true;
  };
  paint();
  const add = (type, existing) => openTicketModal(type, existing, (t) => {
    const i = draft.tickets.findIndex((x) => x.id === t.id);
    if (i >= 0) draft.tickets[i] = t; else draft.tickets.push(t);
    persist(4); paint();
  });
  note.addEventListener("click", (e) => {
    const b = e.target.closest("[data-settype]");
    if (!b) return;
    draft.type = b.dataset.settype; persist(4); paint(); toast("Event type changed");
  });
  host.querySelector(".tickets").addEventListener("click", (e) => {
    const b = e.target.closest("[data-t]");
    if (!b) return;
    if (b.classList.contains("locked")) { toast("Sponty plans only have free tickets. Switch the event type to sell paid ones."); return; }
    add(TICKET_TYPES.find((t) => t.id === b.dataset.t));
  });
  made.addEventListener("click", async (e) => {
    const ed = e.target.closest("[data-edit-t]"), del = e.target.closest("[data-del-t]");
    if (ed) { const x = draft.tickets.find((q) => q.id === ed.dataset.editT); add(TICKET_TYPES.find((t) => t.id === x.type), x); }
    if (del && (await ask({ title: "Remove this ticket?", message: (draft.coupons || []).some((c) => c.appliesTo === del.dataset.delT) || (draft.bulk || []).some((b) => b.appliesTo === del.dataset.delT) ? "Its discounts will be removed too." : "", ok: "Remove" }))) {
      const gone = del.dataset.delT;
      draft.tickets = draft.tickets.filter((q) => q.id !== gone);
      draft.coupons = (draft.coupons || []).filter((c) => c.appliesTo !== gone); draft.bulk = (draft.bulk || []).filter((b) => b.appliesTo !== gone);
      persist(4); paint();
    }
  });
  saveCurrent = () => persist(4);
  host.querySelector("#prev").addEventListener("click", () => { saveCurrent(); location.hash = "#/create/3"; });
  host.querySelector("#save").addEventListener("click", () => { saveCurrent(); toast("Draft saved"); draft = null; location.hash = "#/"; });
  next.addEventListener("click", () => { if (!draft.tickets.length) { const e = host.querySelector("#tk-next-err"); e.hidden = false; e.scrollIntoView({ behavior: "smooth", block: "center" }); return; } persist(5); location.hash = "#/create/5"; });
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
// Social and portfolio links for artists and partners. People can type @name or a full link; only real web links are kept.
const PERSON_LINKS = [["instagram", "Instagram", "@username or link"], ["x", "X", "@username or link"], ["youtube", "YouTube", "Channel link or @handle"], ["site", "Website or portfolio", "https://…"]];
const LINK_HOSTS = { instagram: /(^|\.)instagram\.com$/i, x: /(^|\.)(x|twitter)\.com$/i, youtube: /(^|\.)(youtube\.com|youtu\.be)$/i };
// Returns the cleaned web link, "" when empty, or null when it isn't valid
function cleanLink(kind, raw) {
  const v = String(raw || "").trim();
  if (!v) return "";
  let url = v;
  if (!/^https?:\/\//i.test(v)) {
    const handle = v.replace(/^@/, "");
    const isAddress = v.includes("/") || /(^|\.)(instagram\.com|x\.com|twitter\.com|youtube\.com|youtu\.be)$/i.test(handle); // looks like a web address, not a handle
    if (kind !== "site" && !isAddress) { // a handle such as @kavya
      url = kind === "instagram" ? (/^[\w.]{1,30}$/.test(handle) ? `https://instagram.com/${handle}` : "")
        : kind === "x" ? (/^\w{1,15}$/.test(handle) ? `https://x.com/${handle}` : "")
        : (/^[\w.-]{2,}$/.test(handle) ? `https://youtube.com/@${handle}` : "");
    } else url = /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(handle) ? `https://${handle}` : "";
  }
  try { const u = new URL(url); if (!/^https?:$/.test(u.protocol) || (LINK_HOSTS[kind] && !LINK_HOSTS[kind].test(u.hostname))) return null; return u.href; } catch { return null; }
}

function openPersonModal(kind, prefill, onAdd) {
  const isArtist = kind === "artist";
  const P = { name: prefill || "", desc: "", logo: "", links: { instagram: "", x: "", youtube: "", site: "" } };
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
      <div class="field links-block"><span class="lab">Links <span class="opt-note">optional</span></span>
        <div class="link-grid">${PERSON_LINKS.map(([k, n, ph]) => `<div class="field link-field" id="lf-${k}"><label for="pm-${k}">${n}</label><input id="pm-${k}" class="box" type="text" inputmode="${k === "site" || k === "youtube" ? "url" : "text"}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${ph}" /><p class="err">That doesn't look like a ${n} link</p></div>`).join("")}</div></div>
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
  PERSON_LINKS.forEach(([k]) => $(`#pm-${k}`).addEventListener("input", (e) => { P.links[k] = e.target.value; $(`#lf-${k}`).classList.remove("bad"); }));
  const drop = $("#logo-drop"), file = $("#logo-file");
  const paintLogo = () => { drop.classList.toggle("has", !!P.logo); drop.style.backgroundImage = P.logo ? `url(${P.logo})` : ""; };
  file.addEventListener("change", () => { const f = file.files[0]; if (f) readImage(f, (d) => { P.logo = d; paintLogo(); }, 256); file.value = ""; });
  drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } });
  const close = () => { back.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  back.querySelectorAll("[data-x]").forEach((b) => b.addEventListener("click", close));
  $("#pm-add").addEventListener("click", () => {
    if ($("#pm-add").disabled) return;
    const links = {}; let bad = null;
    PERSON_LINKS.forEach(([k]) => { const v = cleanLink(k, P.links[k]); $(`#lf-${k}`).classList.toggle("bad", v === null); if (v === null) bad = bad || $(`#lf-${k}`); else if (v) links[k] = v; });
    if (bad) { bad.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
    onAdd({ name: P.name.trim().replace(/\s+/g, " "), desc: P.desc.trim(), logo: P.logo, links }); close();
  });
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
      ? `<div class="pa-people">${arr.map((n, i) => `<div class="pa-person"><span class="avatar" ${n.logo ? `style="background-image:url(${n.logo})"` : ""}>${n.logo ? "" : esc(n.name.trim().slice(0, 1).toUpperCase())}</span><div class="pa-who"><b>${esc(n.name)}</b>${n.desc ? `<span>${esc(n.desc)}</span>` : ""}${n.links && Object.keys(n.links).length ? `<span class="pa-links">${PERSON_LINKS.filter(([k]) => n.links[k]).map(([, nm]) => nm).join(" · ")}</span>` : ""}</div><button type="button" data-rm="${i}" aria-label="Remove ${esc(n.name)}">×</button></div>`).join("")}</div>`
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

/* ---------- Bank account reminder (shown on the Tickets step) ---------- */
const ACCOUNT_TYPES = [["savings", "Savings account", "(preferred)"], ["current", "Current account", ""]];
// Appears after a paid ticket is saved while no organizer / bank account has been added yet. Choosing an account type and
// tapping "Add bank details" opens the Organizer step with that type already selected; closing it means "later".
function bankReminder(beforeGo, afterLater) {
  let pick = draft.accountType || "savings";
  const back = document.createElement("div");
  back.className = "modal-back centered";
  back.innerHTML = `<div class="modal small bank-modal" role="dialog" aria-modal="true" aria-label="Bank account not added">
    <div class="modal-head"><div><h3 class="cut">Bank account not added</h3></div><button type="button" class="modal-x" data-later aria-label="Close and do this later">×</button></div>
    <div class="modal-body">
      <p class="ask-msg">To get paid for your paid tickets, add your bank account details. Choose an account type below.</p>
      <div class="bank-types" role="radiogroup" aria-label="Account type">${ACCOUNT_TYPES.map(([k, n, note]) => `<button type="button" role="radio" class="bank-type" data-atype="${k}" aria-checked="false"><i aria-hidden="true"></i><span>${n}${note ? ` <small>${note}</small>` : ""}</span></button>`).join("")}</div>
      <p class="hint">You can also do this later. It's needed before you can create your event.</p>
      <button type="button" class="btn bank-go" id="bank-go">Add bank details</button>
    </div></div>`;
  document.body.append(back);
  const headLetters = cutHeadings(back);
  const paint = () => back.querySelectorAll("[data-atype]").forEach((b) => b.setAttribute("aria-checked", b.dataset.atype === pick));
  paint();
  const close = () => { headLetters.forEach((l) => l.dispose()); document.removeEventListener("keydown", onKey); back.remove(); };
  const later = () => { close(); if (afterLater) afterLater(); }; // closing means "later": carry on where they were
  const onKey = (e) => { if (e.key === "Escape") later(); };
  document.addEventListener("keydown", onKey);
  back.addEventListener("click", (e) => {
    const t = e.target.closest("[data-atype]");
    if (t) { pick = t.dataset.atype; paint(); return; }
    if (e.target === back || e.target.closest("[data-later]")) later();
  });
  back.querySelector("#bank-go").addEventListener("click", () => { draft.accountType = pick; draft.wantsBank = true; persist(4); if (beforeGo) beforeGo(); close(); location.hash = "#/create/6"; });
  back.querySelector("#bank-go").focus();
}

/* ---------- Step 6: Organizer ---------- */
// Format checks for Indian details (shape only: nothing is verified with a bank or the tax office)
const ORG_FIELDS = [
  { k: "email", label: "Email id", req: true, ph: "Enter email", type: "email", ok: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), msg: "Enter a valid email address" },
  { k: "gst", pay: true, label: "GST no.", ph: "Enter GST no.", upper: true, ok: (v) => !v || /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v), msg: "A GST number has 15 characters, like 27ABCDE1234F1Z5" },
  { k: "holder", label: "Account holder name", req: true, ph: "Account holder name", ok: (v) => v.length >= 2, msg: "Enter the name on the bank account" },
  { k: "account", pay: true, label: "Account number", req: true, ph: "Account number", digits: true, ok: (v) => /^\d{9,18}$/.test(v), msg: "An account number has 9 to 18 digits" },
  { k: "ifsc", pay: true, label: "IFSC code", req: true, ph: "Enter IFSC code", upper: true, ok: (v) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v), msg: "An IFSC code looks like HDFC0001234" },
  { k: "pan", pay: true, label: "PAN no.", req: true, ph: "Enter PAN no.", upper: true, ok: (v) => /^[A-Z]{5}\d{4}[A-Z]$/.test(v), msg: "A PAN looks like ABCDE1234F" },
  { k: "phone", label: "Phone no.", req: true, ph: "Enter phone no.", type: "tel", digits: true, ok: (v) => /^[6-9]\d{9}$/.test(v), msg: "Enter a 10-digit mobile number" },
];

function stepOrganizer(host) {
  draft.organizers ??= [];
  const form = { msmeOn: false, msme: "" };
  let atype = draft.accountType || ""; // already picked in the Tickets reminder? it is chosen here too
  const hasPaid = (draft.tickets || []).some((t) => t.paid), viaReminder = !!draft.wantsBank && !hasPaid; delete draft.wantsBank; // the reminder only opens the bank fields for this one visit
  const paid = hasPaid || viaReminder; // bank details are only needed to get paid for paid tickets
  const fields = ORG_FIELDS.filter((f) => paid || !f.pay);
  const cell = (f) => `<div class="field" id="of-${f.k}"${!paid && f.pay ? " hidden" : ""}><label for="o-${f.k}">${f.k === "holder" && !paid ? "Organizer name" : f.label}${f.req ? " <span class=\"req\">*</span>" : ""}</label>
      <input id="o-${f.k}" class="box ${f.upper ? "caps" : ""}" type="${f.type || "text"}" inputmode="${f.digits ? "numeric" : f.type === "email" ? "email" : "text"}" autocomplete="off" placeholder="${f.k === "holder" && !paid ? "Organizer name" : f.ph}" maxlength="${f.k === "gst" ? 15 : f.k === "ifsc" ? 11 : f.k === "pan" ? 10 : f.k === "phone" ? 10 : f.k === "account" ? 18 : 80}" />
      <p class="err">${f.msg}</p></div>`;
  host.innerHTML = `
    <h2 class="section-title cut">Organizer</h2>
    <div class="two">
      <div class="field full" id="of-atype"${paid ? "" : " hidden"}><span class="lab">Account type <span class="req">*</span></span>
        <div class="acct-row" id="o-atype" role="radiogroup" aria-label="Account type">${ACCOUNT_TYPES.map(([k, n, note]) => `<button type="button" role="radio" class="box acct" data-atype="${k}" aria-checked="false"><i aria-hidden="true"></i><span>${n}${note ? ` <small>${note}</small>` : ""}</span></button>`).join("")}</div>
        <p class="err">Choose an account type</p></div>
      ${ORG_FIELDS.map(cell).join("")}
      <div class="field msme"${paid ? "" : " hidden"}><label class="check"><input type="checkbox" id="o-msme-on" /> Do you have an MSME no.?</label>
        <div id="of-msme" hidden><label for="o-msme" class="lab">MSME (Udyam) no. <span class="req">*</span></label><input id="o-msme" class="box caps" type="text" autocomplete="off" placeholder="UDYAM-MH-00-0000000" maxlength="19" /><p class="err">An Udyam number looks like UDYAM-MH-00-0000000</p></div></div>
    </div>
    ${paid ? (viaReminder ? `<p class="hc-note">Not selling paid tickets after all? <button type="button" class="hc-link" id="o-free">Hide bank details</button></p>` : "") : `<p class="hc-note">Bank details are asked only if you add a paid ticket.</p>`}
    <div class="add-row"><button type="button" class="btn small" id="o-add">Add organizer</button></div>
    <div id="o-list"></div>
    <p class="notice info"><b>Secure information:</b> for now, these details are kept only in this browser and are not sent anywhere.</p>
    <div class="nav three"><button class="btn dark prev" type="button" id="prev">Previous</button><button class="btn" type="button" id="next">Next</button><button class="btn" type="button" id="save">Save draft</button></div>`;
  const $ = (q) => host.querySelector(q);
  const list = $("#o-list"), next = $("#next");
  $("#o-free")?.addEventListener("click", () => stepOrganizer(host));
  const paintType = () => $("#o-atype").querySelectorAll("[data-atype]").forEach((b) => { const on = b.dataset.atype === atype; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
  paintType();
  $("#o-atype").addEventListener("click", (e) => { const b = e.target.closest("[data-atype]"); if (!b) return; atype = b.dataset.atype; draft.accountType = atype; paintType(); $("#of-atype").classList.remove("bad"); });
  const val = (f) => { let v = $(`#o-${f.k}`).value.trim(); if (f.upper) v = v.toUpperCase(); if (f.digits) v = v.replace(/\D/g, ""); return v; };
  ORG_FIELDS.forEach((f) => { const el = $(`#o-${f.k}`); el.addEventListener("input", () => { if (f.upper) el.value = el.value.toUpperCase(); if (f.digits) el.value = el.value.replace(/\D/g, ""); $(`#of-${f.k}`).classList.remove("bad"); }); });
  $("#o-msme").addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase(); $("#of-msme").classList.remove("bad"); });
  $("#o-msme-on").addEventListener("change", (e) => { form.msmeOn = e.target.checked; $("#of-msme").hidden = !form.msmeOn; });
  const paint = () => {
    list.innerHTML = draft.organizers.length ? `<h3 class="made-h">Organizers</h3>` + draft.organizers.map((o, i) => `<div class="made-row"><div class="made-info"><b>${esc(o.holder)}</b><span class="made-meta">${esc(o.email)} · ${esc(o.phone)} · ${o.accountType === "current" ? "Current" : o.accountType === "savings" ? "Savings" : ""} ${o.account ? " A/c ••••" + esc(o.account.slice(-4)) : ""}${o.msme ? " · MSME" : ""}</span></div><div class="made-ctl"><button type="button" class="icon-btn danger" data-rm-o="${i}" aria-label="Remove ${esc(o.holder)}" title="Remove"><svg viewBox="0 0 24 24" width="1.5em" height="1.5em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg></button></div></div>`).join("") : "";
  };
  paint();
  $("#o-add").addEventListener("click", () => {
    const data = {}; let firstBad = null;
    fields.forEach((f) => { const v = val(f); data[f.k] = v; const ok = (f.req ? v.length > 0 : true) && f.ok(v); $(`#of-${f.k}`).classList.toggle("bad", !ok); if (!ok && !firstBad) firstBad = $(`#of-${f.k}`); });
    ORG_FIELDS.forEach((f) => { if (!fields.includes(f)) data[f.k] = ""; });
    const msme = paid && form.msmeOn ? $("#o-msme").value.trim().toUpperCase() : "";
    const msmeOk = !(paid && form.msmeOn) || /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(msme);
    $("#of-msme").classList.toggle("bad", !msmeOk);
    if (!msmeOk && !firstBad) firstBad = $("#of-msme");
    $("#of-atype").classList.toggle("bad", paid && !atype);
    if (paid && !atype) firstBad = $("#of-atype"); // the account type is at the top, so it comes first
    if (firstBad) { firstBad.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    draft.organizers.push({ ...data, msme, accountType: atype });
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

/* ---------- Time slots and tickets ---------- */
// The event's time slots: its own date and time is Slot 1, then any extra slots from "Repeat this event"
function eventSlots(d) {
  const first = { from: d.dateFrom || "", to: d.dateTo || d.dateFrom || "", st: d.start || { h: "", m: "" }, en: d.showEnd ? (d.end || { h: "", m: "" }) : { h: "", m: "" } };
  const extra = d.repeat?.on ? (d.repeat.slots || []).filter((t) => t.from && t.st && t.st.h && t.st.m).map((t) => ({ from: t.from, to: t.to || t.from, st: t.st, en: t.en || { h: "", m: "" } })) : [];
  return [first, ...extra];
}
// Which slots a ticket is offered in: a list of slot numbers (counting from 0), or every slot
const ticketSlotIdx = (t, n) => { const ok = Array.isArray(t.slots) ? t.slots.filter((i) => i < n) : []; return ok.length ? ok : Array.from({ length: n }, (_, i) => i); };
const ticketSlotText = (t, n) => (n < 2 ? "" : ticketSlotIdx(t, n).length < n ? `Slot ${ticketSlotIdx(t, n).map((i) => i + 1).join(", ")}` : "All slots");
// The quantity is per slot: a ticket in 2 slots with quantity 30 is 60 tickets in all
const ticketQtyText = (t, n) => { const k = ticketSlotIdx(t, n).length; return n > 1 && k > 1 ? `${t.qty} per slot (${+t.qty * k} in all)` : `${t.qty}`; };
// How many tickets each slot has, adding up every ticket offered in it
const slotTotals = (tickets, n) => Array.from({ length: n }, (_, i) => tickets.filter((t) => ticketSlotIdx(t, n).includes(i)).reduce((a, t) => a + (+t.qty || 0), 0));
const slotName = (s, i) => `Slot ${i + 1} · ${s.from ? dmyShort(s.from) : "no date"}`;
const dmyShort = (v) => { const [y, m, d] = v.split("-").map(Number); return `${d} ${SHORT[m - 1]}`; };

/* ---------- Step 7: Review & create ---------- */
const dmy = (v) => { if (!v) return "—"; const [y, m, d] = v.split("-").map(Number); return `${d} ${SHORT[m - 1]} ${y}`; };
const hm = (t) => (t && t.h && t.m ? `${t.h}:${t.m}` : "—");
const TYPE_SHORT = { guestlist: "Sponty", exclusive: "Exclusive", open: "Non-exclusive" };
// a Sponty plan can only have free tickets: paid tickets on one is a mix-up that has to be fixed (see the Tickets step)
const typeClash = (e) => e.type === "guestlist" && (e.tickets || []).some((t) => t.paid);

function stepReview(host) {
  const d = draft;
  const arts = (d.artists || []).map((a) => ({ ...(typeof a === "string" ? { name: a } : a), role: "Artist" }));
  const pars = (d.partners || []).map((a) => ({ ...(typeof a === "string" ? { name: a } : a), role: "Partner" }));
  const people = [...arts, ...pars];
  const tickets = d.tickets || [], orgs = d.organizers || [], images = (d.images || []).filter(Boolean);
  // Anything still missing, with the step that fixes it
  const missing = [
    [!d.type, "Event type", 0], [typeClash(d), "Event type (a Sponty plan can only have free tickets)", 4], [!d.title, "Title", 1], [!d.description || !textLen(d.description), "Description", 1],
    [!d.category, "Category", 2], [!(d.subs || []).length, "Sub categories", 2], [!d.city, "City", 2], [!images.length, "A cover image", 2],
    [!d.dateFrom, "Event dates", 3], [!(d.start && d.start.h && d.start.m), "Start time", 3],
    [!tickets.length, "At least one ticket", 4],
    [(d.type !== "guestlist" || tickets.some((t) => t.paid)) && !orgs.length, tickets.some((t) => t.paid) ? "Organizer & bank details (needed to get paid for paid tickets)" : "Organizer details", 6],
    [tickets.some((t) => t.paid) && orgs.length > 0 && !orgs.some((o) => o.account), "Bank details (needed to get paid for paid tickets)", 6],
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
      <div class="rv-f"><span>Terms &amp; conditions</span><div class="rv-rich">${d.terms && textLen(d.terms) ? clean(d.terms) : "<b>—</b>"}</div></div>
      <div class="rv-f"><span>FAQs</span>${(d.faqs || []).length ? `<ol class="rv-q">${d.faqs.map((f) => `<li>${esc(f.q)}</li>`).join("")}</ol>` : "<b>—</b>"}</div>
      <div class="rv-f"><span>Guest questions</span>${(d.questions || []).length ? `<ol class="rv-q">${d.questions.map((q) => `<li>${esc(q.text)}${q.required ? " *" : ""} <em>${esc((Q_TYPES.find((t) => t[0] === q.type) || [, ""])[1])}</em></li>`).join("")}</ol>` : "<b>—</b>"}</div>`)}
    ${section("Location & category", 2, `<div class="rv-grid">${field("City", esc(d.city || "—"))}${field("Venue", esc(d.venueStatus === "Decided" && d.venue ? d.venue : d.venueStatus || "—") + (d.venueAddress ? `<span class="rv-addr">${esc(d.venueAddress)}</span>` : "") + (d.venueLat ? ` <a class="rv-map" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${d.venueLat}&mlon=${d.venueLon}#map=17/${d.venueLat}/${d.venueLon}">Open map</a>` : ""), d.venueStatus === "To be announced" ? "warn" : "")}</div>
      <div class="rv-f"><span>Options</span><div class="rv-tags">${d.womenOnly ? '<i class="on">Women only</i>' : ""}${d.womenOnly || d.hideLocation ? "<i>Location hidden until booking</i>" : ""}${d.womenOnly || d.hideLocation ? "" : "<b>—</b>"}</div></div>
      <div class="rv-f"><span>Custom link</span><b>${d.slug ? `${LINK_HOST}/e/${esc(d.slug)}` : "—"}</b></div>
      <div class="rv-f"><span>Category</span><div class="rv-tags">${d.category ? `<i class="on">${esc(d.category)}</i>` : "<b>—</b>"}${(d.subs || []).map((x) => `<i>${esc(x)}</i>`).join("")}</div></div>`)}
    ${section("Schedule", 3, eventSlots(d).map((sl, i, all) => `<div class="rv-slot">${all.length > 1 ? `<p class="rv-slot-h">Slot ${i + 1}</p>` : ""}<div class="rv-grid four">${field("Start date", dmy(sl.from))}${field("End date", dmy(sl.to))}${field("Start time", hm(sl.st))}${field("End time", hm(sl.en))}</div></div>`).join(""), eventSlots(d).length > 1 ? `(${eventSlots(d).length} slots)` : "")}
    ${section("Tickets", 4, tickets.length ? tickets.map((t) => `<div class="rv-row"><div><b>${esc(t.name)}</b><span>Qty: ${ticketQtyText(t, eventSlots(d).length)}${ticketSlotText(t, eventSlots(d).length) ? ` · ${ticketSlotText(t, eventSlots(d).length)}` : ""}${(t.tag || t.label1) ? ` · ${esc(t.tag || t.label1)}` : ""}${t.includes ? ` · ${esc(t.includes)}` : ""}</span></div><b class="rv-price">${priceOf(t)}</b></div>`).join("") + (eventSlots(d).length > 1 && tickets.length ? `<div class="slot-tot"><p class="slot-tot-h">Tickets per slot</p>${slotTotals(tickets, eventSlots(d).length).map((n, i) => `<div class="slot-line"><div>${esc(slotName(eventSlots(d)[i], i))}</div><strong>${n} tickets</strong></div>`).join("")}</div>` : "") : "<b>—</b>", `(${tickets.length} type${tickets.length === 1 ? "" : "s"})`)}
    ${section("Artists & partners", 5, people.length ? `<div class="rv-people">${people.map((p) => `<div class="pa-person"><span class="avatar" ${p.logo ? `style="background-image:url(${p.logo})"` : ""}>${p.logo ? "" : esc(p.name.trim().slice(0, 1).toUpperCase())}</span><div class="pa-who"><b>${esc(p.name)}</b><span>${p.role}</span></div></div>`).join("")}</div>` : "<b>—</b>", `(${people.length})`)}
    ${section("Organizer & banking", 6, orgs.length ? orgs.map((o) => `<div class="rv-grid">${field("Organizer name", esc(o.holder))}${field("Email", `<span class="keep">${esc(o.email)}</span>`)}${field("Phone", esc(o.phone))}${o.account ? field("Account type", o.accountType === "current" ? "Current" : o.accountType === "savings" ? "Savings" : "—") + field("Account number", "••••" + esc(o.account.slice(-4))) + field("IFSC", esc(o.ifsc)) : ""}${o.gst ? field("GST no.", esc(o.gst)) : ""}</div>`).join("<hr />") : field("Organizer name", "—"))}
    ${missing.length
      ? `<div class="notice warn miss"><b>Almost there</b><span>Still needed:</span><ul class="miss-list">${missing.map((m) => `<li><button type="button" class="linkish" data-go-step="${m[2]}">${m[1]}</button></li>`).join("")}</ul></div>`
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
/* ---------- Bulk discount: a bigger discount the more tickets one person buys ---------- */
// Each tap of "Add +" brings in the next of these as a suggestion, so a host who is unsure can just keep them

/* ---------- FAQs: the popup where hosts answer common questions guests ask before booking ---------- */
const FAQ_MAX = 10;
function openFaqModal(existing, onSave) {
  const blank = () => ({ id: newId(), q: "", a: "" });
  const list = existing.map((f) => ({ ...f }));
  if (!list.length) list.push(blank());
  const back = document.createElement("div");
  back.className = "modal-back";
  back.innerHTML = `<div class="modal coupon-modal" role="dialog" aria-modal="true" aria-label="FAQs">
    <div class="modal-head plain"><div class="gq-title"><h3 class="cut">FAQs</h3>${infoBtn("faq")}</div><button type="button" class="modal-x" data-x aria-label="Close">×</button></div>
    <div class="modal-body"><div id="f-list"></div>
      <button type="button" class="bk-add" id="f-add">Add another question +</button>
      <p class="err bk-err" id="f-err" hidden></p></div>
    <div class="modal-foot"><button type="button" class="btn ghost" data-x>Cancel</button><button type="button" class="btn" id="f-save">Save FAQs</button></div></div>`;
  document.body.append(back);
  document.body.style.overflow = "hidden";
  onInfo(back);
  const headLetters = cutHeadings(back);
  const $ = (q) => back.querySelector(q);
  const paint = () => {
    $("#f-list").innerHTML = list.map((f, i) => `<div class="q-card" data-i="${i}">
      <div class="q-top"><span class="q-num">FAQ ${i + 1}</span><button type="button" class="icon-btn danger q-rm" data-rm aria-label="Delete this FAQ">×</button></div>
      <span class="faq-l">What should the attendee know?</span><input class="box" data-k="q" type="text" maxlength="140" placeholder="Type your question here" value="${esc(f.q)}" aria-label="Question" />
      <textarea class="box faq-a" data-k="a" rows="4" maxlength="600" placeholder="Type your answer here" aria-label="Answer">${esc(f.a)}</textarea></div>`).join("");
    $("#f-add").disabled = list.length >= FAQ_MAX;
  };
  const bad = (f) => f.q.trim() && !f.a.trim();
  const refresh = () => {
    const first = list.findIndex(bad);
    $("#f-err").hidden = first < 0; $("#f-err").textContent = first < 0 ? "" : `FAQ ${first + 1}: add an answer`;
    $("#f-save").disabled = first >= 0;
  };
  paint(); refresh();
  const L = $("#f-list");
  L.addEventListener("input", (e) => { const card = e.target.closest(".q-card"); if (!card || !e.target.dataset.k) return; list[+card.dataset.i][e.target.dataset.k] = e.target.value; refresh(); });
  L.addEventListener("click", (e) => { const card = e.target.closest(".q-card"); if (!card || !e.target.closest("[data-rm]")) return; list.splice(+card.dataset.i, 1); if (!list.length) list.push(blank()); paint(); refresh(); });
  $("#f-add").addEventListener("click", () => { list.push(blank()); paint(); refresh(); const t = back.querySelectorAll(".q-card [data-k=q]"); t[t.length - 1]?.focus(); });
  const close = () => { headLetters.forEach((l) => l.dispose()); back.remove(); if (!document.querySelector(".modal-back")) document.body.style.overflow = ""; };
  back.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } });
  back.querySelectorAll("[data-x]").forEach((b) => b.addEventListener("click", close));
  $("#f-save").addEventListener("click", () => { onSave(list.filter((f) => f.q.trim()).map((f) => ({ id: f.id, q: f.q.trim(), a: f.a.trim() }))); close(); });
  L.querySelector("[data-k=q]")?.focus();
}

/* ---------- Guest questions: the popup where hosts write the questions guests answer when they book ---------- */
const Q_TYPES = [["short", "Short answer"], ["one", "Pick one"], ["many", "Pick several"], ["yesno", "Yes or no"]];
const Q_MAX = 8, Q_OPT_MAX = 8;
function openQuestionsModal(existing, onSave) {
  const list = existing.map((q) => ({ ...q, options: [...(q.options || [])] }));
  if (!list.length) list.push({ id: newId(), type: "short", text: "", required: false, options: [] });
  const back = document.createElement("div");
  back.className = "modal-back";
  back.innerHTML = `<div class="modal coupon-modal" role="dialog" aria-modal="true" aria-label="Guest questions">
    <div class="modal-head plain"><div class="gq-title"><h3 class="cut">Guest questions</h3>${infoBtn("gq")}</div><button type="button" class="modal-x" data-x aria-label="Close">×</button></div>
    <div class="modal-body"><div id="q-list"></div>
      <button type="button" class="bk-add" id="q-add">Add another question +</button>
      <p class="err bk-err" id="q-err" hidden></p></div>
    <div class="modal-foot"><button type="button" class="btn ghost" data-x>Cancel</button><button type="button" class="btn" id="q-save">Save questions</button></div></div>`;
  document.body.append(back);
  document.body.style.overflow = "hidden";
  onInfo(back);
  const headLetters = cutHeadings(back);
  const $ = (q) => back.querySelector(q);
  const isChoice = (q) => q.type === "one" || q.type === "many";
  const opts = (q) => q.options.map((o) => o.trim()).filter(Boolean);
  const bad = (q) => q.text.trim() && isChoice(q) && opts(q).length < 2;
  const paint = () => {
    $("#q-list").innerHTML = list.map((q, i) => `<div class="q-card" data-i="${i}">
      <div class="q-top"><span class="q-num">Question ${i + 1}</span><button type="button" class="icon-btn danger q-rm" data-rm aria-label="Delete this question">×</button></div>
      <input class="box" data-k="text" type="text" maxlength="140" placeholder="${["e.g. Any food allergies?", "e.g. What dish are you bringing?", "e.g. Who are you coming with?"][i % 3]}" value="${esc(q.text)}" aria-label="Question" />
      <div class="q-type" data-type></div>
      ${isChoice(q) ? `<div class="q-opts">${q.options.map((o, j) => `<div class="q-opt"><input class="box" data-o="${j}" type="text" maxlength="60" placeholder="Choice ${j + 1}" value="${esc(o)}" aria-label="Choice ${j + 1}" /><button type="button" class="icon-btn danger" data-orm="${j}" aria-label="Remove this choice">×</button></div>`).join("")}
        <button type="button" class="link-btn" data-oadd ${q.options.length >= Q_OPT_MAX ? "hidden" : ""}>Add choice +</button></div>` : ""}
      <div class="switch-row q-req"><div><b>Guests must answer</b></div><button type="button" class="switch ${q.required ? "on" : ""}" data-req role="switch" aria-checked="${!!q.required}" aria-label="Guests must answer"><i></i></button></div></div>`).join("");
    back.querySelectorAll(".q-card").forEach((card) => { const q = list[+card.dataset.i]; dropdown(card.querySelector("[data-type]"), Q_TYPES.map((t) => t[1]), Q_TYPES.find((t) => t[0] === q.type)[1], (name) => { q.type = Q_TYPES.find((t) => t[1] === name)[0]; if (isChoice(q) && q.options.length < 2) q.options = ["", ""]; paint(); refresh(); }); });
    $("#q-add").disabled = list.length >= Q_MAX;
  };
  const refresh = () => {
    const first = list.findIndex(bad);
    $("#q-err").hidden = first < 0; $("#q-err").textContent = first < 0 ? "" : `Question ${first + 1}: add at least 2 choices`;
    $("#q-save").disabled = first >= 0;
  };
  paint(); refresh();
  const L = $("#q-list");
  L.addEventListener("input", (e) => {
    const card = e.target.closest(".q-card"); if (!card) return; const q = list[+card.dataset.i];
    if (e.target.dataset.k === "text") q.text = e.target.value; else if (e.target.dataset.o != null) q.options[+e.target.dataset.o] = e.target.value;
    refresh();
  });
  L.addEventListener("click", (e) => {
    const card = e.target.closest(".q-card"); if (!card) return; const i = +card.dataset.i, q = list[i];
    if (e.target.closest("[data-rm]")) { list.splice(i, 1); if (!list.length) list.push({ id: newId(), type: "short", text: "", required: false, options: [] }); }
    else if (e.target.closest("[data-req]")) q.required = !q.required;
    else if (e.target.closest("[data-oadd]")) q.options.push("");
    else if (e.target.closest("[data-orm]")) q.options.splice(+e.target.closest("[data-orm]").dataset.orm, 1);
    else return;
    paint(); refresh();
    if (e.target.closest("[data-oadd]")) { const ins = back.querySelectorAll(`.q-card[data-i="${i}"] [data-o]`); ins[ins.length - 1]?.focus(); }
  });
  $("#q-add").addEventListener("click", () => { list.push({ id: newId(), type: "short", text: "", required: false, options: [] }); paint(); refresh(); const t = back.querySelectorAll(".q-card [data-k=text]"); t[t.length - 1]?.focus(); });
  const close = () => { headLetters.forEach((l) => l.dispose()); back.remove(); if (!document.querySelector(".modal-back")) document.body.style.overflow = ""; };
  back.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } });
  back.querySelectorAll("[data-x]").forEach((b) => b.addEventListener("click", close));
  $("#q-save").addEventListener("click", () => {
    const out = list.filter((q) => q.text.trim()).map((q) => ({ id: q.id, type: q.type, text: q.text.trim(), required: !!q.required, options: isChoice(q) ? opts(q) : [] }));
    onSave(out); close();
  });
  L.querySelector("[data-k=text]")?.focus();
}

const EXAMPLE_TIERS = [{ from: "4", to: "8", pct: "5" }, { from: "9", to: "12", pct: "8" }, { from: "13", to: "20", pct: "15" }];
const tierChips = (tiers) => tiers.map((x) => `<i>${x.open ? `${x.from} and above` : `${x.from}–${x.to} tickets`}: ${x.pct}% off</i>`).join("");

// opts.lockTo / opts.lockName: opened from a ticket window, so it applies to that ticket only
function openBulkModal(ev, existing, opts, onSave) {
  const r = existing ? { ...existing, tiers: existing.tiers.map((x) => ({ ...x })) } : { id: newId(), appliesTo: opts.lockTo || "", tiers: [], active: true };
  const taken = new Set((ev.bulk || []).filter((x) => x.id !== r.id).map((x) => x.appliesTo)); // one bulk discount per ticket
  const choices = opts.lockTo ? [] : [["all", "All tickets"], ...(ev.tickets || []).filter((x) => x.paid).map((x) => [x.id, x.name])].filter(([id]) => !taken.has(id) || id === r.appliesTo);
  if (!opts.lockTo && !r.appliesTo && choices.length) r.appliesTo = choices[0][0];
  const back = document.createElement("div");
  back.className = "modal-back";
  back.innerHTML = `<div class="modal coupon-modal" role="dialog" aria-modal="true" aria-label="Bulk discount">
    <div class="modal-head plain"><div><h3 class="cut">Bulk discount</h3><p>A bigger discount the more tickets someone buys</p></div><button type="button" class="modal-x" data-x aria-label="Close">×</button></div>
    <div class="modal-body">
      <div class="field"><span class="lab">Applies to</span>${opts.lockTo ? `<div class="box bk-lock">${esc(opts.lockName() || "This ticket")}</div>` : choices.length ? `<div id="bk-applies"></div>` : `<p class="notice info">Every paid ticket already has a bulk discount. Edit one of those instead.</p>`}</div>
      <p class="mini-title">Set range</p>
      <p class="hint bk-count" id="bk-count"></p>
      <div class="bk-head"><span>Tickets bought</span><span>Percentage off</span></div>
      <div id="bk-rows"></div>
      <button type="button" class="link-btn bk-open" id="bk-open" hidden></button>
      <button type="button" class="bk-add" id="bk-add">Add +</button>
      <p class="hint bk-hint">${existing ? "" : "Tap Add + for an example tier, then keep it or change the numbers to suit your event."}</p>
      <p class="hint bk-gaps" id="bk-gap"></p>
      <p class="err bk-err" id="bk-err" hidden></p>
    </div>
    <div class="modal-foot"><button type="button" class="btn ghost" data-x>Cancel</button><button type="button" class="btn" id="bk-save">Save bulk discount</button></div></div>`;
  document.body.append(back);
  document.body.style.overflow = "hidden";
  const headLetters = cutHeadings(back);
  const $ = (q) => back.querySelector(q);
  if ($("#bk-applies")) { const cur = choices.find(([id]) => id === r.appliesTo) || choices[0]; dropdown($("#bk-applies"), choices.map(([, n]) => n), cur[1], (n) => { r.appliesTo = choices.find(([, x]) => x === n)[0]; refresh(); }); }
  const n = (v) => (v === "" || v == null ? NaN : +v);
  const hi = (x) => (x.open ? Infinity : n(x.to)); // the last range can be "and above"
  const rowOk = (x) => Number.isInteger(n(x.from)) && n(x.from) >= 2 && (x.open || (Number.isInteger(n(x.to)) && n(x.to) >= n(x.from))) && Number.isInteger(n(x.pct)) && n(x.pct) >= 1 && n(x.pct) <= 90;
  const overlaps = () => { const a = r.tiers.filter(rowOk).map((x) => [n(x.from), hi(x)]).sort((p, q) => p[0] - q[0]); return a.some((x, i) => i && x[0] <= a[i - 1][1]); };
  const valid = () => !!r.appliesTo && r.tiers.length >= 1 && r.tiers.every(rowOk) && !overlaps();
  const paintRows = () => {
    $("#bk-rows").innerHTML = r.tiers.map((x, i) => {
      const open = !!x.open && i === r.tiers.length - 1;
      return `<div class="bk-row ${open ? "is-open" : ""}" data-i="${i}">
      <input class="box" data-k="from" type="number" min="2" step="1" inputmode="numeric" placeholder="4" value="${esc(x.from ?? "")}" aria-label="From (tickets)" />
      ${open ? '<span class="bk-above">and above</span>' : `<span class="bk-to">to</span><input class="box" data-k="to" type="number" min="2" step="1" inputmode="numeric" placeholder="8" value="${esc(x.to ?? "")}" aria-label="To (tickets)" />`}
      <span class="bk-gap"></span>
      <label class="bk-pct"><input class="box" data-k="pct" type="number" min="1" max="90" step="1" inputmode="numeric" placeholder="5" value="${esc(x.pct ?? "")}" aria-label="Percentage off" /><b>%</b></label>
      <button type="button" class="icon-btn danger bk-rm" data-rm="${i}" aria-label="Remove this range">×</button></div>`;
    }).join("");
    const last = r.tiers[r.tiers.length - 1];
    $("#bk-open").hidden = !last;
    if (last) $("#bk-open").textContent = last.open ? "Set an end for the last range" : "Make the last range “and above”";
    $("#bk-add").disabled = r.tiers.length >= 6 || !!(last && last.open);
  };
  // One plain sentence about the first real mistake, naming the range (empty boxes just keep Save switched off)
  const problem = () => {
    for (let i = 0; i < r.tiers.length; i++) {
      const x = r.tiers[i], say = (t) => (r.tiers.length > 1 ? `Range ${i + 1}: ${t}` : t[0].toUpperCase() + t.slice(1));
      if (x.from !== "" && !(n(x.from) >= 2)) return say("start at 2 tickets or more");
      if (!x.open && x.from !== "" && x.to !== "" && n(x.to) < n(x.from)) return say("the end can't be lower than the start");
      if (x.pct !== "" && !(n(x.pct) >= 1 && n(x.pct) <= 90)) return say("percentage off must be between 1 and 90");
    }
    return overlaps() ? "Two ranges cover the same tickets. Change one so they don't overlap" : "";
  };
  const refresh = () => {
    const bad = problem();
    $("#bk-err").hidden = !bad; $("#bk-err").textContent = bad;
    const tip = back.querySelector(".bk-hint"); if (tip) tip.hidden = r.tiers.length > 0; // the "tap Add" tip is only for an empty window
    $("#bk-count").textContent = r.appliesTo === "all" ? "Counts all the tickets in one order together." : "Counts how many of this ticket are in one order. A group ticket counts once per group.";
    const ok = r.tiers.filter(rowOk).map((x) => [n(x.from), hi(x)]).sort((p, q) => p[0] - q[0]), gaps = [];
    ok.forEach((x, i) => { if (i && x[0] > ok[i - 1][1] + 1) gaps.push(x[0] - 1 > ok[i - 1][1] + 1 ? `${ok[i - 1][1] + 1} to ${x[0] - 1}` : `${x[0] - 1}`); });
    $("#bk-gap").textContent = gaps.length ? `Orders of ${gaps.join(" and ")} tickets get no discount.` : "";
    $("#bk-save").disabled = !valid();
  };
  paintRows(); refresh();
  $("#bk-rows").addEventListener("input", (e) => { const k = e.target.dataset.k; if (!k) return; r.tiers[+e.target.closest("[data-i]").dataset.i][k] = e.target.value; refresh(); });
  $("#bk-rows").addEventListener("click", (e) => { const b = e.target.closest("[data-rm]"); if (!b) return; r.tiers.splice(+b.dataset.rm, 1); paintRows(); refresh(); });
  $("#bk-open").addEventListener("click", () => { const last = r.tiers[r.tiers.length - 1]; if (!last) return; last.open = !last.open; paintRows(); refresh(); });
  $("#bk-add").addEventListener("click", () => {
    const last = r.tiers[r.tiers.length - 1], eg = EXAMPLE_TIERS[r.tiers.length];
    const after = last && Number.isInteger(n(last.to)) ? n(last.to) + 1 : null; // the first ticket count the next range can start at
    // use the example row when it fits after the last range; otherwise start a blank row right after it
    r.tiers.push(eg && (after === null || n(eg.from) >= after) ? { ...eg } : { from: after === null ? "" : String(after), to: "", pct: "" });
    paintRows(); refresh();
    const rows = back.querySelectorAll(".bk-row"); rows[rows.length - 1]?.scrollIntoView({ block: "nearest" });
  });
  const close = () => { headLetters.forEach((l) => l.dispose()); back.remove(); if (!document.querySelector(".modal-back")) document.body.style.overflow = ""; };
  back.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } }); // closes only this window, not the one under it
  back.querySelectorAll("[data-x]").forEach((b) => b.addEventListener("click", close));
  $("#bk-save").addEventListener("click", () => {
    if (!valid()) return;
    r.tiers = r.tiers.map((x) => ({ from: n(x.from), to: x.open ? null : n(x.to), open: !!x.open, pct: n(x.pct) })).sort((p, q) => p.from - q.from);
    onSave(r); close();
  });
  (back.querySelector(".bk-row input") || $("#bk-save")).focus();
}

const couponState = (c) => { const end = c.to || c.from; if (end && end < iso(new Date())) return "Expired"; return c.active ? "Active" : "Paused"; };
// "All tickets", or the name of the ticket a coupon is tied to
const appliesName = (c, tickets = []) => { if (!c.appliesTo || c.appliesTo === "all") return "All tickets"; const t = (tickets || []).find((x) => x.id === c.appliesTo); return t ? t.name : "A removed ticket"; };
const discountText = (c) => (c.type === "pct" ? `${c.value}% off` : `${rupees(+c.value)} off`);
const clock = (t) => (t && t.h && t.m ? `${t.h}:${t.m}` : "—");

function renderCoupons(id) {
  const events = load(), ev = events.find((e) => e.id === id);
  if (!ev) { location.hash = "#/"; return; }
  ev.coupons ??= [];
  document.title = "Coupons — PeanutButterJelly.fun";
  let query = "";
  app.innerHTML = `
    <div class="sub-head">
      <button type="button" class="back-pill" data-back>‹ Back</button>
      <div class="sh-t"><h1 class="cut">Coupons</h1><p>Manage discount coupons for ${esc(ev.title || "this event")}</p></div>
      <div class="head-tools"><label class="search">${ic("search", "1.3em")}<input id="cp-q" type="text" placeholder="Search coupons…" aria-label="Search coupons" autocomplete="off" /></label>
        <button type="button" class="btn create-btn" id="bk-new">+ Bulk discount</button>
        <button type="button" class="btn create-btn" id="cp-add">+ Add coupon</button></div>
    </div>
    <div id="cp-list" class="cp-list"></div>
    <div id="bk-list" class="cp-list bk-list"></div>`;
  const listEl = app.querySelector("#cp-list");
  const persistEv = () => save(events);
  const paint = () => {
    const q = query.trim().toLowerCase();
    const shown = ev.coupons.filter((c) => !q || c.code.toLowerCase().includes(q));
    if (!shown.length && !ev.coupons.length && (ev.bulk || []).length) { listEl.innerHTML = `<p class="hint cp-none">No coupon codes yet. Add a discount code your guests can use at checkout.</p>`; return; } // only bulk discounts so far: keep it compact
    if (!shown.length) {
      listEl.innerHTML = `<div class="empty"><h2 class="cut" data-fill="var(--brown)" data-shadow="var(--cream)">${ev.coupons.length ? "No match" : "No coupons yet"}</h2>
        <p>${ev.coupons.length ? "No coupon matches that search." : "Add a discount code your guests can use at checkout."}</p></div>`;
      cutHeadings(); return;
    }
    listEl.innerHTML = shown.map((c) => {
      const st = couponState(c);
      return `<article class="cp-card" data-id="${c.id}"><div class="cp-main"><b class="cp-code">${esc(c.code)}</b><span class="pill ${st === "Active" ? "live" : st === "Paused" ? "off" : "out"}">${st}</span></div>
        <div class="cp-meta"><span><small>Discount</small><b>${discountText(c)}</b></span><span><small>Applies to</small><b>${esc(appliesName(c, ev.tickets))}</b></span><span><small>Used</small><b>${c.used || 0} / ${c.max}</b></span><span><small>Valid</small><b>${dmy(c.from)}${c.to && c.to !== c.from ? ` → ${dmy(c.to)}` : ""}<em>${clock(c.st)} – ${clock(c.en)}</em></b></span></div>
        <div class="made-ctl"><button type="button" class="switch ${c.active ? "on" : ""}" role="switch" aria-checked="${c.active}" data-toggle aria-label="Coupon active"><i></i></button>
          <button type="button" class="icon-btn" data-edit aria-label="Edit ${esc(c.code)}" title="Edit">${ic("edit", "1.5em")}</button>
          <button type="button" class="icon-btn danger" data-del aria-label="Delete ${esc(c.code)}" title="Delete"><svg viewBox="0 0 24 24" width="1.5em" height="1.5em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg></button></div></article>`;
    }).join("");
  };
  // Bulk discounts: tiers by how many tickets one person buys
  ev.bulk ??= [];
  const bulkEl = app.querySelector("#bk-list");
  const paintBulk = () => {
    bulkEl.innerHTML = ev.bulk.length ? `<h3 class="made-h">Bulk discounts</h3>` + ev.bulk.map((r) => `<article class="cp-card" data-bid="${r.id}"><div class="cp-main"><b class="cp-code">Bulk discount</b><span class="pill ${r.active ? "live" : "off"}">${r.active ? "Active" : "Paused"}</span></div>
        <div class="cp-meta"><span><small>Applies to</small><b>${esc(appliesName(r, ev.tickets))}</b></span><span class="bk-tiers"><small>Discount tiers</small><b>${tierChips(r.tiers)}</b></span></div>
        <div class="made-ctl"><button type="button" class="switch ${r.active ? "on" : ""}" role="switch" aria-checked="${r.active}" data-toggle aria-label="Bulk discount active"><i></i></button>
          <button type="button" class="icon-btn" data-edit aria-label="Edit bulk discount" title="Edit">${ic("edit", "1.5em")}</button>
          <button type="button" class="icon-btn danger" data-del aria-label="Delete bulk discount" title="Delete"><svg viewBox="0 0 24 24" width="1.5em" height="1.5em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg></button></div></article>`).join("") : "";
  };
  paintBulk();
  const addBulk = (existing) => openBulkModal(ev, existing, {}, (r) => {
    const i = ev.bulk.findIndex((x) => x.id === r.id);
    if (i >= 0) ev.bulk[i] = r; else ev.bulk.push(r);
    persistEv(); paintBulk(); toast(i >= 0 ? "Bulk discount updated" : "Bulk discount added");
  });
  app.querySelector("#bk-new").addEventListener("click", () => addBulk());
  bulkEl.addEventListener("click", async (e) => {
    const card = e.target.closest("[data-bid]"); if (!card) return;
    const r = ev.bulk.find((x) => x.id === card.dataset.bid);
    if (e.target.closest("[data-toggle]")) { r.active = !r.active; persistEv(); paintBulk(); }
    else if (e.target.closest("[data-edit]")) addBulk(r);
    else if (e.target.closest("[data-del]") && (await ask({ title: "Delete this bulk discount?", message: "Guests will no longer get it.", ok: "Delete" }))) { ev.bulk = ev.bulk.filter((x) => x.id !== r.id); persistEv(); paintBulk(); }
  });
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
  const c = existing ? { appliesTo: "all", ...existing, st: { ...existing.st }, en: { ...existing.en } } : { id: newId(), appliesTo: "all", code: "", max: "", type: "pct", value: "", from: "", to: "", st: { h: "", m: "" }, en: { h: "", m: "" }, active: true, used: 0 };
  const back = document.createElement("div");
  back.className = "modal-back";
  back.innerHTML = `<div class="modal coupon-modal" role="dialog" aria-modal="true" aria-label="${existing ? "Edit" : "New"} coupon">
    <div class="modal-head plain"><div><h3 class="cut">${existing ? "Edit coupon" : "New coupon"}</h3><p>Fill in the details to create a coupon</p></div><button type="button" class="modal-x" data-x aria-label="Close">×</button></div>
    <div class="modal-body">
      <p class="mini-title">Coupon details</p>
      <div class="field" id="cf-code"><label for="cp-code">Coupon code <span class="req">*</span></label><input id="cp-code" class="box caps" type="text" maxlength="20" autocomplete="off" placeholder="E.g. DIWALI20" /><p class="err" id="cp-code-err">Use 3 to 20 letters or numbers</p></div>
      <div class="field"><label for="cp-max">Max uses <span class="req">*</span></label><input id="cp-max" class="box" type="number" min="1" step="1" inputmode="numeric" placeholder="e.g. 100 (how many times it can be used)" /></div>
      <div class="field"><span class="lab">Applies to</span><div id="cp-applies"></div></div>
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
  // Which ticket the coupon works on: all tickets, or one of this event's tickets
  const tix = (ev.tickets || []).map((x) => ({ id: x.id, name: x.name }));
  const labelOf = (x, i) => (tix.filter((y) => y.name === x.name).length > 1 ? `${x.name} (${i + 1})` : x.name);
  const choices = [["all", "All tickets"], ...tix.map((x, i) => [x.id, labelOf(x, i)])];
  const current = choices.find(([id]) => id === c.appliesTo) || choices[0];
  dropdown($("#cp-applies"), choices.map(([, n]) => n), current[1], (n) => { c.appliesTo = choices.find(([, x]) => x === n)[0]; });
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
    const dup = taken(); $("#cf-code").classList.toggle("bad", dup); $("#cp-code-err").textContent = dup ? "This code already exists for this event" : "Use 3 to 20 letters or numbers";
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
const spark = (color, delay = 0, down = false) => {
  const pts = down ? "M2 7 L16 12 L30 8 L44 18 L58 13 L76 22" : "M2 22 L16 17 L30 21 L44 11 L58 16 L76 7"; // up for sales, down for refunds
  const y = down ? 22 : 7;
  return `<svg class="spark" viewBox="0 0 80 28" aria-hidden="true" style="--c:${color}; --d:${delay}s"><path class="sp-area" d="${pts} L76 28 L2 28 Z" fill="${color}"/><path class="sp-line" pathLength="100" d="${pts}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle class="sp-dot" cx="76" cy="${y}" r="2.6" fill="${color}"/><circle class="sp-ring" cx="76" cy="${y}" r="2.6" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`;
};

function renderSales(id) {
  const events = load(), ev = events.find((e) => e.id === id);
  if (!ev) { location.hash = "#/"; return; }
  document.title = "Sales — PeanutButterJelly.fun";
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
  const tile = (label, value, cap, color, delay = 0, extra = "", down = false) => `<div class="an-tile"><div class="an-top"><span>${label}</span>${spark(color, delay, down)}</div><b class="an-num">${value}</b><small>${cap}</small>${extra}</div>`;
  const empty = (title, text) => `<div class="empty"><h2 class="cut" data-fill="var(--brown)" data-shadow="var(--cream)">${title}</h2><p>${text}</p></div>`;
  const draw = () => {
    app.querySelectorAll("[data-tab]").forEach((b) => { const on = b.dataset.tab === tab; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
    const tickets = ev.tickets || [];
    if (tab === "overview") body.innerHTML = `
      <div class="an-grid four">${tile("Total revenue", "₹0", "Total sales", "#463721", 0)}${tile("Total tickets", "0", "Tickets sold", "#f0a830", 0.15)}${tile("Total pax", "0", "People attending", "#6b2d5c", 0.3)}${tile("Refunds", "0", "Refund orders", "#c2184f", 0.45, "", true)}</div>
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

/* ---------- Run the event's group chat ---------- */
function renderChat(id, startTab = "", door = false) {
  const ev = load().find((e) => e.id === id);
  if (!ev) { location.hash = "#/"; return; }
  const st = statusOf(ev), past = isPast(ev);
  const badge = past ? ["Event ended", "off"] : st === "published" ? ["Event live", "live"] : [STATUSES[st].label, st === "soldout" || st === "cancelled" ? "out" : st === "coming" ? "soon" : "off"];
  const k = { app, esc, toast, ic, dayLine, badge, ask };
  if (door) renderCheckIn(k, ev); else renderHostChat(k, ev, startTab);
  cutHeadings();
}

/* ---------- Routing ---------- */
function route() {
  cutLetters.forEach((l) => l.dispose());
  cutLetters = [];
  const m = location.hash.match(/^#\/create\/(\d)$/);
  const ev = location.hash.match(/^#\/event\/([^/]+)\/(coupons|sales|chat|requests|checkin)$/);
  document.querySelector('[data-nav="list"]').classList.toggle("on", !m);
  if (ev) {
    draft = null;
    // Sponty plans are free, so they have no sales or coupons page: send people to the plan's requests instead
    if ((ev[2] === "sales" || ev[2] === "coupons") && load().find((x) => x.id === ev[1])?.type === "guestlist") { location.hash = `#/event/${ev[1]}/requests`; return; }
    if (ev[2] === "coupons") renderCoupons(ev[1]); else if (ev[2] === "chat" || ev[2] === "requests") renderChat(ev[1], ev[2] === "requests" ? "requests" : "");
    else if (ev[2] === "checkin") renderChat(ev[1], "", true); else renderSales(ev[1]);
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
restoreDrafts().then(route); // a reset preview browser gets its drafts back from the dev copy before the first screen
