// One event's own page (/e/<name>-<id>; the older /event.html?id=<id> still works). Reads the event from the database (src/eventsStore.js): anyone can open a listed event,
// and the host can also preview their own drafts. Everything the host typed is escaped or cleaned before it goes on the page.
import { fetchEvent, fetchVenue, fetchListedEvents, safeImg as remoteImg, LISTED, eventPath, eventIdFromUrl, locationHidden } from "./eventsStore.js";
import { currentSession, authReady } from "./auth.js";
const app = document.getElementById("app");
import { guestPays, rupees, hasGst, gstParts } from "./gst.js";
import { restoreDrafts } from "./devBackup.js";
import { createCutLetter } from "./cutword.js";
// While building, set this to true to show the yellow "Preview" bar at the top of the page; false shows the page as the public will see it.
const SHOW_PREVIEW_NOTE = false;
// Photos: plain web links only. A local copy with no database keeps the host's own photos inline (data:), so those are allowed there.
const NO_DB = !authReady();
const safeImg = (u) => (NO_DB && typeof u === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(u) ? u : remoteImg(u));
const localListed = () => { try { return (JSON.parse(localStorage.getItem("pbj-host-events")) || []).filter((e) => LISTED.includes(e.status)); } catch { return []; } };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// The host's formatted text, cleaned: only a safe list of tags and styles survives. No scripts, no event handlers,
// links must be http(s), pictures must be uploaded images or https, and videos must be YouTube embeds.
const OK = new Set(["P", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "UL", "OL", "LI", "A", "H1", "H2", "H3", "H4", "BLOCKQUOTE", "SPAN", "DIV", "FONT", "SUB", "SUP", "HR", "IMG", "IFRAME"]);
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%/]+\)|[a-z]{3,20})$/i;
const SIZE = /^(\d+(\.\d+)?(px|em|rem|%|pt)|xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large)$/i;
const LENGTH = /^\d+(\.\d+)?(px|em|rem|%)$/;
const STYLE_OK = {
  "color": (v) => COLOR.test(v),
  "background-color": (v) => COLOR.test(v),
  "font-size": (v) => SIZE.test(v),
  "font-family": (v) => /^[\w\s,"'-]+$/.test(v),
  "font-weight": (v) => /^(normal|bold|[1-9]00)$/.test(v),
  "font-style": (v) => /^(normal|italic)$/.test(v),
  "text-decoration": (v) => /^(none|underline|line-through)( (underline|line-through))?$/.test(v),
  "text-align": (v) => /^(left|right|center|justify)$/.test(v),
  "margin-left": (v) => LENGTH.test(v),
  "padding-left": (v) => LENGTH.test(v),
  "text-indent": (v) => LENGTH.test(v),
  "line-height": (v) => /^\d+(\.\d+)?$/.test(v) && +v >= 0.8 && +v <= 4,
  "margin-bottom": (v) => LENGTH.test(v),
};
const safeStyle = (css) => css.split(";").map((d) => { const i = d.indexOf(":"); if (i < 0) return ""; const p = d.slice(0, i).trim().toLowerCase(), v = d.slice(i + 1).trim(); return STYLE_OK[p] && !/url\(|expression|javascript|[<>\\@]/i.test(v) && STYLE_OK[p](v) ? `${p}:${v}` : ""; }).filter(Boolean).join(";");
const YT = /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}$/;
const IMGSRC = /^(data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+|https:\/\/[^\s"'<>]+)$/i;
function clean(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ""}</div>`, "text/html");
  const walk = (node) => {
    [...node.children].forEach((el) => {
      if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OBJECT|EMBED|SVG|MATH)$/i.test(el.tagName)) { el.remove(); return; }
      if (!OK.has(el.tagName)) { el.replaceWith(...el.childNodes); return walk(node); }
      const was = Object.fromEntries([...el.attributes].map((a) => [a.name.toLowerCase(), a.value]));
      [...el.attributes].forEach((a) => el.removeAttribute(a.name));
      const st = was.style ? safeStyle(was.style) : "";
      if (st && el.tagName !== "IMG" && el.tagName !== "IFRAME") el.setAttribute("style", st);
      if (/^(left|right|center|justify)$/i.test(was.align || "")) el.setAttribute("style", `${el.getAttribute("style") || ""};text-align:${was.align.toLowerCase()}`.replace(/^;/, ""));
      if (el.tagName === "FONT") {
        if (COLOR.test(was.color || "")) el.setAttribute("color", was.color);
        if (/^[1-7]$/.test(was.size || "")) el.setAttribute("size", was.size);
        if (/^[\w\s,"'-]+$/.test(was.face || "")) el.setAttribute("face", was.face);
      }
      if (el.tagName === "IMG") {
        if (!IMGSRC.test(was.src || "")) { el.remove(); return; }
        el.setAttribute("src", was.src); el.setAttribute("alt", (was.alt || "").slice(0, 200)); el.setAttribute("loading", "lazy");
      }
      if (el.tagName === "IFRAME") {
        if (!YT.test(was.src || "")) { el.remove(); return; }
        el.setAttribute("src", was.src); el.setAttribute("title", "Video"); el.setAttribute("frameborder", "0"); el.setAttribute("allowfullscreen", "");
      }
      walk(el);
    });
  };
  walk(doc.body.firstElementChild);
  doc.body.querySelectorAll("a").forEach((a) => { a.setAttribute("href", "#"); a.removeAttribute("href"); });
  return doc.body.firstElementChild.innerHTML;
}
const keepLinks = (html, original) => {
  // put real links back (http/https only), in order
  const hrefs = [...new DOMParser().parseFromString(`<div>${original || ""}</div>`, "text/html").querySelectorAll("a")].map((a) => a.getAttribute("href") || "");
  let i = 0;
  const box = document.createElement("div");
  box.innerHTML = html;
  box.querySelectorAll("a").forEach((a) => { const h = hrefs[i++] || ""; if (/^https?:\/\//i.test(h)) { a.href = h; a.target = "_blank"; a.rel = "noopener noreferrer"; } });
  return box.innerHTML;
};
const rich = (html) => keepLinks(clean(html), html);

function youtube(url) {
  const m = String(url || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? `<div class="ep-video"><iframe src="https://www.youtube-nocookie.com/embed/${m[1]}" title="Event video" frameborder="0" allowfullscreen></iframe></div>` : "";
}
const dateText = (e) => {
  const f = (s) => { const [y, m, d] = s.split("-").map(Number); return { y, m, d, w: DAYS[new Date(y, m - 1, d).getDay()] }; };
  const a = f(e.dateFrom), one = `${a.w}, ${a.d} ${MONTHS[a.m - 1]} ${a.y}`;
  if (e.dateTo && e.dateTo !== e.dateFrom) { const b = f(e.dateTo); return `${one} → ${b.w}, ${b.d} ${MONTHS[b.m - 1]} ${b.y}`; }
  return one;
};
// "From ₹300" only when the tickets cost different amounts; one price (or all free) is just shown as it is
const entry = (tickets, price) => {
  if (!tickets.length) return "Tickets to be announced";
  const amounts = tickets.map(guestPays);
  const low = Math.min(...amounts);
  const lowTicket = tickets[amounts.indexOf(low)];
  return amounts.every((n) => n === low) ? price(lowTicket) : `From ${price(lowTicket)}`;
};
const clock = (t) => { const h = Number(t?.h); return Number.isFinite(h) && t?.h !== "" ? `${h % 12 || 12}:${String(t.m || "00").padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}` : ""; };

// The event in the address. Without the database (a local copy with no keys), the dashboard's own browser copy is used, as before.
async function load() {
  const id = eventIdFromUrl();
  if (!authReady()) {
    try { const e = (JSON.parse(localStorage.getItem("pbj-host-events")) || []).find((x) => x.id === id || (x.slug && x.slug === id)); return e ? { ...e, mine: true } : null; } catch { return null; }
  }
  const session = await currentSession().catch(() => null);
  const e = await fetchEvent(id, session);
  // A hidden location is kept private: the host and people with a ticket get the exact place from the server
  if (e && locationHidden(e) && session) {
    const place = await fetchVenue(e.id, session).catch(() => null);
    if (place) Object.assign(e, place, { venueShared: true });
  }
  return e;
}

function missing(text = "This event doesn't exist, or it isn't listed yet.") {
  app.innerHTML = `<section class="ep-miss"><h1>Event not found</h1><p>${esc(text)}</p><a class="btn" href="/">Back to site</a></section>`;
}

const svg = (path, size = "1.3em") => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const ICON = {
  heart: '<path d="M12 21s-7-4.6-9.3-9A5.3 5.3 0 0 1 12 6a5.3 5.3 0 0 1 9.3 6c-2.3 4.4-9.3 9-9.3 9z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
};

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, 2200);
}

// ---- Saved events (a heart): kept in this browser for now ----
const SAVED = "pbj-saved-events";
const savedList = () => { try { return JSON.parse(localStorage.getItem(SAVED)) || []; } catch { return []; } };
const setSaved = (id, on) => { try { const l = savedList().filter((x) => x !== id); if (on) l.push(id); localStorage.setItem(SAVED, JSON.stringify(l)); } catch { /* private mode: the heart just won't stick */ } };

// ---- Add to calendar: a Google Calendar link and a downloadable .ics file (Apple, Outlook and phones) ----
const pad = (n) => String(n).padStart(2, "0");
const fmtLocal = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const hasTime = (t) => t && t.h !== "" && t.h != null && Number.isFinite(Number(t.h));
const locHidden = (e) => locationHidden(e) && !e.venueShared; // exact venue stays private until a guest books (or it's the host)
function calendarInfo(e) {
  const [y, m, d] = e.dateFrom.split("-").map(Number);
  const [y2, m2, d2] = (e.dateTo || e.dateFrom).split("-").map(Number);
  const where = e.venueStatus === "Decided" && e.venue && !locHidden(e) ? [e.venue, e.venueAddress].filter(Boolean).join(", ") : e.city || "Mumbai";
  let start, end, allDay = false;
  if (hasTime(e.start)) {
    start = new Date(y, m - 1, d, Number(e.start.h), Number(e.start.m) || 0);
    end = hasTime(e.end) ? new Date(y2, m2 - 1, d2, Number(e.end.h), Number(e.end.m) || 0) : new Date(start.getTime() + 2 * 3600 * 1000);
    if (end <= start) end = new Date(start.getTime() + 2 * 3600 * 1000);
  } else {
    allDay = true;
    start = new Date(y, m - 1, d);
    end = new Date(y2, m2 - 1, d2 + 1);
  }
  const day = (x) => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}`;
  return { where, allDay, s: allDay ? day(start) : fmtLocal(start), e: allDay ? day(end) : fmtLocal(end) };
}
function googleCalendarUrl(e) {
  const c = calendarInfo(e);
  const q = new URLSearchParams({ action: "TEMPLATE", text: e.title || "Event", dates: `${c.s}/${c.e}`, location: c.where, details: `${location.href}`, ctz: "Asia/Kolkata" });
  return `https://calendar.google.com/calendar/render?${q}`;
}
function downloadIcs(e) {
  const c = calendarInfo(e);
  const esc2 = (t) => String(t).replace(/\\/g, "\\\\").replace(/[;,]/g, (x) => "\\" + x).replace(/\n/g, "\\n");
  const when = c.allDay ? [`DTSTART;VALUE=DATE:${c.s}`, `DTEND;VALUE=DATE:${c.e}`] : [`DTSTART;TZID=Asia/Kolkata:${c.s}`, `DTEND;TZID=Asia/Kolkata:${c.e}`];
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PeanutButterJelly.fun//Event//EN", "BEGIN:VEVENT", `UID:${e.id}@peanutbutterjelly.fun`, `DTSTAMP:${new Date().toISOString().replace(/[-:]|\.\d{3}/g, "")}`, ...when,
    `SUMMARY:${esc2(e.title || "Event")}`, `LOCATION:${esc2(c.where)}`, `DESCRIPTION:${esc2(location.href)}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = `${(e.title || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "event"}.ics`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---- Map: OpenStreetMap, only when the host picked the venue from the search (that saves where it is) ----
function mapSection(e) {
  if (e.venueStatus !== "Decided" || !e.venue || locHidden(e)) return "";
  const lat = Number(e.venueLat), lon = Number(e.venueLon);
  const has = e.venueLat != null && e.venueLon != null && Number.isFinite(lat) && Number.isFinite(lon);
  const dest = has ? `${lat},${lon}` : [e.venue, e.venueAddress].filter(Boolean).join(", ");
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
  const embed = has ? `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.006},${lat - 0.004},${lon + 0.006},${lat + 0.004}&layer=mapnik&marker=${lat},${lon}` : "";
  return `<section class="ep-sec ep-wide"><h2>Where</h2>
    ${embed ? `<div class="ep-map"><iframe src="${embed}" title="Map of ${esc(e.venue)}" loading="lazy" referrerpolicy="no-referrer"></iframe></div>` : ""}
    <div class="ep-where"><div>${svg(ICON.pin, "1.4em")}<span><b>${esc(e.venue)}</b>${e.venueAddress ? `<small>${esc(e.venueAddress)}</small>` : ""}</span></div>
    <a class="btn ghost" href="${directions}" target="_blank" rel="noopener noreferrer">Get directions</a></div></section>`;
}

// ---- More like this: other published events, same category first ----
function similar(e, all = []) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const rest = all.filter((x) => x.id !== e.id && LISTED.includes(x.status) && x.dateFrom && (x.images || []).some(Boolean) && new Date(...(x.dateTo || x.dateFrom).split("-").map((n, i) => (i === 1 ? n - 1 : n))) >= today);
  rest.sort((a, b) => (b.category === e.category) - (a.category === e.category) || a.dateFrom.localeCompare(b.dateFrom));
  if (!rest.length) return "";
  const card = (x) => {
    const [y, m, d] = x.dateFrom.split("-").map(Number);
    return `<a class="ep-card" href="${eventPath(x)}"><div class="ep-card-img" style="background-image:url('${esc(safeImg(x.images.filter(Boolean)[0]))}')"></div><b>${esc(x.title || "Untitled event")}</b><small>${d} ${MONTHS[m - 1]} ${y}${x.category ? ` · ${esc(x.category)}` : ""}</small></a>`;
  };
  return `<section class="ep-sec"><h2>More like this</h2><div class="ep-more">${rest.slice(0, 4).map(card).join("")}</div></section>`;
}

function show(e, others = []) {
  document.title = `${e.title || "Event"} — PeanutButterJelly.fun`;
  const imgs = (e.images || []).map(safeImg).filter(Boolean);
  const live = e.status === "published";
  // "Repeat this event": extra time slots the host added; guests pick one
  const extraSlots = e.repeat?.on ? (e.repeat.slots || []).filter((t) => t.from && t.st?.h) : [];
  const slotRow = (n, d, t) => `<li><button type="button" class="ep-pick" role="radio" aria-checked="${n === 1}" aria-label="Pick slot ${n}" data-n="${n}"></button><div class="ep-slot"><span class="ep-stub"><i>Slot</i><b>${n}</b></span><span class="ep-slotbody"><span>${d}</span>${t ? `<small>${esc(t)}</small>` : ""}</span></div></li>`;
  const slotList = extraSlots.length ? `<ul class="ep-slots" role="radiogroup" aria-label="Pick a time">${slotRow(1, dateText(e), [clock(e.start), e.showEnd && clock(e.end) ? clock(e.end) : ""].filter(Boolean).join(" – "))}${extraSlots.map((t, i) => slotRow(i + 2, dateText({ dateFrom: t.from, dateTo: t.to }), [clock(t.st), clock(t.en)].filter(Boolean).join(" – "))).join("")}</ul>` : "";
  const time = [clock(e.start), e.showEnd && clock(e.end) ? clock(e.end) : ""].filter(Boolean).join(" – ");
  const where = locHidden(e) ? `${esc(e.city || "Mumbai")}<small>Exact location shared after booking</small>` : e.venueStatus === "Decided" && e.venue ? `${esc(e.venue)}${e.venueAddress ? `<small>${esc(e.venueAddress)}</small>` : ""}` : `${esc(e.city || "Mumbai")}<small>Venue to be announced</small>`;
  const tickets = (e.tickets || []).filter((t) => t.enabled !== false);
  const price = (t) => (t.paid && Number(t.price) ? rupees(guestPays(t)) : "Free");
  // Links the host added for an artist or partner: only plain web links are shown, and they open in a new tab
  const LINK_NAMES = { instagram: "Instagram", x: "X", youtube: "YouTube", site: "Website" };
  const personLinks = (p) => {
    const items = Object.entries(p.links || {}).filter(([k, u]) => LINK_NAMES[k] && /^https?:\/\//i.test(String(u)));
    return items.length ? `<span class="ep-links">${items.map(([k, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${LINK_NAMES[k]}</a>`).join("")}</span>` : "";
  };
  const people = (list, h) => (list || []).length ? `<section class="ep-sec"><h2>${h}</h2><div class="ep-people">${list.map((p) => `<div class="ep-person">${safeImg(p.logo) ? `<img src="${esc(safeImg(p.logo))}" alt="" />` : `<span class="ep-init">${esc((p.name || "?")[0])}</span>`}<div><b>${esc(p.name)}</b><p>${esc(p.desc || "")}</p>${personLinks(p)}</div></div>`).join("")}</div></section>` : "";
  const orgs = (e.organizers || []).length ? `<section class="ep-sec"><h2>Hosted by</h2><div class="ep-people">${e.organizers.map((o) => `<div class="ep-person"><span class="ep-init">${esc((o.holder || "?")[0])}</span><div><b>${esc(o.holder)}</b></div></div>`).join("")}</div></section>` : "";

  // each ticket: is it on sale today, and how many can be picked
  const iso = (() => { const n = new Date(); return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`; })();
  const nowAt = (() => { const n = new Date(); return `${iso}T${pad(n.getHours())}:${pad(n.getMinutes())}`; })();
  const endText = (at) => { const [d, tm] = at.split("T"); return `${d.split("-").reverse().join("/")} ${tm}`; };
  // sales open when the event is published and close at saleEndAt, or when the event starts if none was set
  // (old tickets with fixed sale dates used to keep the later ones switched off: those dates are now ignored)
  // tickets can belong to certain time slots (t.slots is a list of slot numbers, counting from 0), or to all of them
  const slotCount = 1 + extraSlots.length;
  let selSlot = 0, onSlot = () => {};
  const availIn = (t, idx) => { const ok = Array.isArray(t.slots) ? t.slots.filter((i) => i < slotCount) : []; return !ok.length || ok.includes(idx); };
  const evStartAt = e.dateFrom && e.start && e.start.h && e.start.m ? `${e.dateFrom}T${pad(+e.start.h)}:${pad(+e.start.m)}` : "";
  // Sales open when the event is published. They close at the time the host chose: a custom date and time, or a set time before the
  // slot starts. For "when the event starts" and "N hours before" each slot counts from its own start, so the closing time follows the
  // time the guest picks. (Old fixed sale dates are ignored: they used to keep later tickets switched off.)
  const slotStartAt = (idx) => { if (idx === 0) return evStartAt; const sl = extraSlots[idx - 1]; return sl && sl.st && sl.st.h ? `${sl.from}T${pad(+sl.st.h)}:${pad(+sl.st.m)}` : ""; };
  const shiftAt = (at, hours) => { if (!at) return ""; const d = new Date(at); if (isNaN(d)) return ""; d.setHours(d.getHours() - hours); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const endAt = (t, idx) => { const m = t.saleEnd && t.saleEnd.mode; return m === "custom" ? t.saleEndAt || "" : shiftAt(slotStartAt(idx), m === "24h" ? 24 : m === "1h" ? 1 : 0); };
  // A ticket the host marked "Sold Out" or "Coming Soon" can't be picked; otherwise sales close at the closing minute itself (inclusive)
  const stateOf = (t) => { if (t.status === "Sold Out") return "soldout"; if (t.status === "Coming Soon") return "soon"; const end = endAt(t, selSlot); return end && end <= nowAt ? "closed" : "open"; };
  // Bulk discounts: a rule for one ticket counts how many of that ticket are in the order; a rule for "all tickets" counts every ticket in the order.
  // The best discount that applies to a line is used.
  const bulkRules = (e.bulk || []).filter((r) => r.active !== false && Array.isArray(r.tiers) && r.tiers.length);
  const rulesFor = (t) => bulkRules.filter((r) => r.appliesTo === t.id || r.appliesTo === "all");
  const CHEV = '<svg class="tk-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const INFO = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v5.5"/><path d="M12 7.6v.1"/></svg>';
  const infoBtn = (key, label) => `<button type="button" class="tk-i" data-pop="${key}" aria-label="${label}" aria-haspopup="dialog">${INFO}</button>`;
  const bulkRows = (t) => { const rs = rulesFor(t); return rs.length ? rs[0].tiers.map((x) => `<p class="tk-row"><span>${x.open ? `${x.from} or more tickets` : x.from === x.to ? `${x.from} tickets` : `${x.from} to ${x.to} tickets`}</span><b>${x.pct}% off</b></p>`).join("") : ""; };
  const gstRows = (t) => { const p = gstParts(t); return `<p class="tk-row"><span>Ticket price</span><b>${rupees(p.base)}</b></p><p class="tk-row"><span>GST${p.label ? ` (${esc(p.label)})` : ` (${p.pct}%)`}</span><b>${rupees(p.tax)}</b></p><p class="tk-row tot"><span>You pay</span><b>${rupees(p.total)}</b></p>`; };
  // One pop-up in the middle of the page, used by every (i)
  const popup = (title, note, rows) => {
    const back = document.createElement("div"); back.className = "tk-modal-back";
    back.innerHTML = `<div class="tk-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><button type="button" class="tk-x" aria-label="Close">×</button><h3 class="cut">${esc(title)}</h3>${note ? `<p class="tk-note">${esc(note)}</p>` : ""}<div class="tk-rows">${rows}</div></div>`;
    document.body.append(back);
    const letters = [], h = back.querySelector("h3"), text = h.textContent.trim(); // the same paper-cut lettering as the other headings
    h.setAttribute("aria-label", text); h.textContent = "";
    text.split(" ").forEach((word, i, all) => { const w = document.createElement("span"); w.className = "w"; w.setAttribute("aria-hidden", "true");
      [...word].forEach((ch) => { const l = createCutLetter(ch, { fill: "var(--pop)", shadow: "var(--brown)" }); if (l) { letters.push(l); w.append(l.el); } else w.append(document.createTextNode(ch)); });
      h.append(w); if (i < all.length - 1) h.append(" "); });
    const close = () => { letters.forEach((l) => l.dispose()); document.removeEventListener("keydown", onKey); back.remove(); };
    const onKey = (k) => { if (k.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    back.addEventListener("click", (k) => { if (k.target === back || k.target.closest(".tk-x")) close(); });
    back.querySelector(".tk-x").focus();
  };
  // a guest can take up to 10 of one ticket, or more when a bulk discount has higher bands, but never more than are on offer
  const maxOf = (t) => { const tiers = rulesFor(t).flatMap((r) => r.tiers), top = tiers.some((x) => x.open) ? Infinity : Math.max(10, ...tiers.map((x) => Number(x.to) || 0)); return Math.max(0, Math.min(top, Number(t.qty) || 10)); }; // an "and above" band lets a guest take everything on offer
  const note = (t) => {
    const st = stateOf(t);
    if (st === "soldout") return "Sold out";
    if (st === "soon") return "On sale soon";
    if (st === "closed") return "Sales closed";
    const end = endAt(t, selSlot); // "N left" is a tag now, only when the last few are going (see lowLeft)
    return end ? `Sales end ${endText(end)}` : "";
  };
  const lowLeft = (t) => stateOf(t) === "open" && Number(t.qty) > 0 && Number(t.qty) <= 5; // only the last few tickets get a "left" tag
  const TKI = { group: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3.2 2.7-5 6-5s6 1.8 6 5"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.8M18 14.3c1.9.6 3 2.2 3 4.7"/>', season: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>', ticket: '<path d="M3 9a2 2 0 0 1 0 6v2.5A1.5 1.5 0 0 0 4.5 19h15a1.5 1.5 0 0 0 1.5-1.5V15a2 2 0 0 1 0-6V6.5A1.5 1.5 0 0 0 19.5 5h-15A1.5 1.5 0 0 0 3 6.5z"/><path d="M14 5v2.5M14 11v2M14 16.5V19"/>' };
  const tkIcon = (t) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${TKI[t.type] || TKI.ticket}</svg>`;
  const group = (t) => (t.type === "group" && Number(t.groupSize) > 1 ? ` · for ${Number(t.groupSize)}` : "");

  app.innerHTML = `
    ${SHOW_PREVIEW_NOTE && e.mine ? `<div class="ep-note">${live ? "This is your event, as guests see it." : e.status === "draft" ? "Preview: this event isn't published yet. Guests won't see it until you publish it." : "This is your event, as guests see it (it isn't open for bookings)."}<a href="/dashboard.html">Back to dashboard</a></div>` : ""}
    <article class="ep-grid">
      <div class="ep-media">
        ${imgs.length ? `<div class="ep-hero"><img id="ep-main" src="${esc(imgs[0])}" alt="${esc(e.title)}" /></div>` : `<div class="ep-hero ep-none">No cover image</div>`}
        ${imgs.length > 1 ? `<div class="ep-thumbs">${imgs.map((s, i) => `<button type="button" class="${i ? "" : "on"}" data-i="${i}" aria-label="Show image ${i + 1}"><img src="${esc(s)}" alt="" /></button>`).join("")}</div>` : ""}
        ${youtube(e.youtube)}
      </div>
      <div class="ep-info">
        <div class="ep-top">
          <p class="ep-tags">${e.womenOnly ? '<i class="ep-wo">Women only</i>' : ""}${[e.category].filter(Boolean).map((t) => `<i>${esc(t)}</i>`).join("")}</p>
          <div class="ep-acts"><button type="button" class="ep-ic" id="ep-save" aria-pressed="false" aria-label="Save this event">${svg(ICON.heart, "1.5em")}</button><button type="button" class="ep-ic" id="ep-share" aria-label="Share this event">${svg(ICON.share, "1.5em")}</button></div>
        </div>
        <h1>${esc(e.title || "Untitled event")}</h1>
        <dl class="ep-facts">
          <div><dt>When</dt><dd>${slotList || `${e.dateFrom ? dateText(e) : "Date to be announced"}${time ? `<small>${esc(time)}</small>` : ""}`}${e.dateFrom ? `<span class="ep-cal"><button type="button" class="ep-link" id="ep-calbtn" aria-expanded="false">${svg(ICON.cal, "1.1em")}Add to calendar</button><span class="ep-calmenu" id="ep-calmenu" hidden><a href="${esc(googleCalendarUrl(e))}" target="_blank" rel="noopener noreferrer">Google Calendar</a><button type="button" id="ep-ics">Apple, Outlook and phone (.ics)</button></span></span>` : ""}</dd></div>
          <div><dt>Where</dt><dd>${where}</dd></div>
          <div><dt>Entry</dt><dd>${entry(tickets, price)}</dd></div>
        </dl>
        ${tickets.length ? `<section class="ep-sec"><h2>Tickets</h2><ul class="ep-tickets" id="ep-tickets">${tickets.map((t, i) => {
          return `<li class="tk" data-i="${i}">
            <div class="tc-name"><span class="tc-ic" aria-hidden="true">${tkIcon(t)}</span><b>${esc(t.name)}${esc(group(t))}</b>${(t.tag || t.label1) ? `<i class="ep-tag">${esc(t.tag || t.label1)}</i>` : ""}${lowLeft(t) ? `<i class="ep-low">Only ${Number(t.qty)} left</i>` : ""}</div>
            <div class="tc-price">${price(t)}</div>
            <div class="tc-sub">${t.includes ? `<small class="ep-inc">${esc(t.includes)}</small>` : ""}<small class="ep-sale"></small><small class="ep-bulk" hidden></small><small class="ep-noslot" hidden>Not offered for the time you picked</small></div>
            ${hasGst(t) ? `<div class="tc-gst">incl. GST${infoBtn("gst", "See the price breakdown")}</div>` : ""}
            ${rulesFor(t).length ? `<div class="tc-save">Buy more, save more${infoBtn("bulk", "See the bulk discounts")}</div>` : ""}
            <span class="ep-step tc-step"><button type="button" data-d="-1" aria-label="One fewer ${esc(t.name)}">−</button><output aria-live="polite">0</output><button type="button" data-d="1" aria-label="One more ${esc(t.name)}">+</button></span></li>`;
        }).join("")}</ul>
          <p class="ep-total" id="ep-total"><span>Total${tickets.some(hasGst) ? " (incl. GST)" : ""}</span><b>₹0</b></p>
          <p class="ep-savings" id="ep-savings" hidden></p>
          ${(e.questions || []).length ? `<div class="ep-qs" id="ep-qs"><h3>A few quick questions</h3>${e.questions.map((q, i) => {
            const nm = "q" + i, lab = `<span class="ep-q-l">${esc(q.text)}${q.required ? ' <i aria-label="required">*</i>' : ""}</span>`;
            const choices = q.type === "yesno" ? ["Yes", "No"] : (q.options || []);
            const body = q.type === "short" ? `<input class="ep-q-in" type="text" maxlength="300" data-q="${i}" aria-label="${esc(q.text)}" />` : `<div class="ep-q-opts">${choices.map((c) => `<label><input type="${q.type === "many" ? "checkbox" : "radio"}" name="${nm}" value="${esc(c)}" data-q="${i}" /><span>${esc(c)}</span></label>`).join("")}</div>`;
            return `<div class="ep-q" data-qi="${i}">${lab}${body}<p class="ep-q-err" hidden>Please answer this one</p></div>`;
          }).join("")}</div>` : ""}
          <button class="btn" type="button" id="ep-buy">Pick a ticket</button>
          <p class="ep-msg" id="ep-msg" role="status" hidden></p></section>` : ""}
      </div>
    </article>
    ${(e.description || "").replace(/<[^>]*>/g, "").trim() ? `<section class="ep-sec ep-wide"><h2>About this event</h2><div class="ep-rich">${rich(e.description)}</div></section>` : ""}
    ${(e.faqs || []).length ? `<section class="ep-sec ep-wide"><h2>FAQs</h2><div class="ep-faqs">${e.faqs.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div></section>` : ""}
    ${mapSection(e)}
    ${people(e.artists, "Artists")}${people(e.partners, "Partners")}${orgs}
    ${(e.terms || "").replace(/<[^>]*>/g, "").trim() ? `<section class="ep-sec ep-wide"><h2>Terms &amp; conditions</h2><div class="ep-rich ep-terms">${rich(e.terms)}</div></section>` : ""}
    <div id="ep-similar">${similar(e, others)}</div>`;

  // gallery
  const main = app.querySelector("#ep-main");
  app.querySelector(".ep-thumbs")?.addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-i]");
    if (!b) return;
    main.src = imgs[+b.dataset.i];
    app.querySelectorAll(".ep-thumbs button").forEach((x) => x.classList.toggle("on", x === b));
  });

  // save (heart) and share
  const save = app.querySelector("#ep-save");
  const paintSave = (on) => { save.setAttribute("aria-pressed", on); save.classList.toggle("on", on); save.setAttribute("aria-label", on ? "Remove from saved events" : "Save this event"); };
  paintSave(savedList().includes(e.id));
  save.addEventListener("click", () => { const on = save.getAttribute("aria-pressed") !== "true"; setSaved(e.id, on); paintSave(on); toast(on ? "Saved" : "Removed from saved"); });
  app.querySelector("#ep-share").addEventListener("click", async () => {
    const data = { title: e.title || "Event", text: `${e.title || "Event"} on PeanutButterJelly.fun`, url: location.href };
    if (navigator.share) { try { await navigator.share(data); } catch { /* closed the share sheet */ } return; }
    try { await navigator.clipboard.writeText(location.href); toast("Link copied"); } catch { toast("Copy the link from the address bar"); }
  });

  // pick a time: choose one slot (the first is chosen to start with)
  document.querySelectorAll(".ep-slots li").forEach((li) => li.addEventListener("click", (ev) => { if (!ev.target.closest(".ep-pick")) li.querySelector(".ep-pick").click(); })); // the whole row picks the slot
  document.querySelectorAll(".ep-pick").forEach((b) => b.addEventListener("click", () => { document.querySelectorAll(".ep-pick").forEach((x) => x.setAttribute("aria-checked", x === b)); selSlot = +b.dataset.n - 1; onSlot(); }));
  // add to calendar
  const calBtn = app.querySelector("#ep-calbtn"), calMenu = app.querySelector("#ep-calmenu");
  if (calBtn) {
    const setCal = (on) => { calMenu.hidden = !on; calBtn.setAttribute("aria-expanded", on); };
    calBtn.addEventListener("click", (ev) => { ev.stopPropagation(); setCal(calMenu.hidden); });
    app.querySelector("#ep-ics").addEventListener("click", () => { downloadIcs(e); setCal(false); });
    calMenu.querySelector("a").addEventListener("click", () => setCal(false));
    document.addEventListener("click", (ev) => { if (!ev.target.closest(".ep-cal")) setCal(false); });
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") setCal(false); });
  }

  // ticket picker
  const list = app.querySelector("#ep-tickets");
  list?.addEventListener("click", (ev) => { const b = ev.target.closest("[data-pop]"); if (!b) return; const t = tickets[+b.closest("li").dataset.i]; if (!t) return;
    if (b.dataset.pop === "bulk") popup("Buy more, save more", "The more tickets you take in one order, the bigger the discount.", bulkRows(t)); else popup("Price breakdown", "", gstRows(t)); });
  if (list) {
    const picks = tickets.map(() => 0);
    const total = app.querySelector("#ep-total b"), buy = app.querySelector("#ep-buy"), msg = app.querySelector("#ep-msg");
    const count = () => picks.reduce((a, n) => a + n, 0);
    const pctFor = (i) => { // the bulk discount (in %) on one line of the order
      if (!picks[i]) return 0;
      let best = 0;
      rulesFor(tickets[i]).forEach((r) => { const n = r.appliesTo === "all" ? count() : picks[i]; const tier = r.tiers.find((x) => n >= x.from && (x.open || n <= x.to)); if (tier) best = Math.max(best, Number(tier.pct) || 0); });
      return best;
    };
    const lineFull = (i) => picks[i] * guestPays(tickets[i]);
    const lineNet = (i) => lineFull(i) * (1 - pctFor(i) / 100);
    const sum = () => picks.reduce((a, n, i) => a + lineNet(i), 0);
    const saved = () => picks.reduce((a, n, i) => a + lineFull(i) - lineNet(i), 0);
    const paint = () => {
      list.querySelectorAll("li").forEach((li) => {
        const i = +li.dataset.i, t = tickets[i], gone = !availIn(t, selSlot), closed = stateOf(t) !== "open" || maxOf(t) === 0;
        if (gone || closed) picks[i] = 0;
        li.classList.toggle("noslot", gone); li.classList.toggle("off", closed && !gone);
        li.querySelector(".ep-noslot").hidden = !gone;
        const sale = li.querySelector(".ep-sale"); sale.textContent = note(t); sale.hidden = gone || !note(t);
        const o = li.querySelector("output"); if (o) o.textContent = picks[i];
      });
      list.querySelectorAll("li").forEach((li) => { const i = +li.dataset.i, p = pctFor(i), b = li.querySelector(".ep-bulk"); b.hidden = !p; b.textContent = p ? `${p}% bulk discount applied` : ""; });
      const sv = app.querySelector("#ep-savings"); sv.hidden = saved() <= 0; sv.textContent = saved() > 0 ? `You save ${rupees(saved())} with bulk discounts` : "";
      total.textContent = rupees(sum());
      buy.textContent = !count() ? "Pick a ticket" : sum() === 0 ? "RSVP · Free" : `Get tickets · ${rupees(sum())}`;
      msg.hidden = true;
    };
    list.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-d]");
      if (!b) return;
      const i = +b.closest("li").dataset.i;
      picks[i] = Math.max(0, Math.min(maxOf(tickets[i]), picks[i] + Number(b.dataset.d)));
      paint();
    });
    // required guest questions must be answered before booking
    const unanswered = () => {
      let first = null;
      app.querySelectorAll(".ep-q").forEach((box) => {
        const q = e.questions[+box.dataset.qi], ins = [...box.querySelectorAll("[data-q]")];
        const done = q.type === "short" ? !!ins[0].value.trim() : ins.some((x) => x.checked);
        const bad = !!q.required && !done;
        box.classList.toggle("bad", bad); box.querySelector(".ep-q-err").hidden = !bad;
        if (bad && !first) first = box;
      });
      return first;
    };
    app.querySelector("#ep-qs")?.addEventListener("input", (ev) => { const b = ev.target.closest(".ep-q"); if (b) { b.classList.remove("bad"); b.querySelector(".ep-q-err").hidden = true; } });
    buy.addEventListener("click", () => {
      msg.hidden = false;
      const miss = count() ? unanswered() : null;
      if (miss) { msg.textContent = "Please answer the questions marked with a star"; miss.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
      msg.textContent = count()
        ? `Booking isn't switched on yet, so nothing has been booked. You picked ${picks.map((n, i) => (n ? `${n} × ${tickets[i].name}` : "")).filter(Boolean).join(", ")}.`
        : "Pick at least one ticket first";
    });
    onSlot = paint;
    paint();
  }
}

// The event shows as soon as it arrives; "More like this" fills in afterwards, whenever the other events come in
app.innerHTML = `<section class="ep-miss"><p>Loading…</p></section>`;
const othersP = NO_DB ? Promise.resolve(localListed()) : fetchListedEvents().catch(() => []);
(NO_DB ? restoreDrafts() : Promise.resolve()).then(load) // a local copy with no database gets its dev drafts back first
  .then((ev) => {
    if (!ev) return missing();
    // show the event's own tidy address (its current name), whichever link was used to get here
    if (location.pathname !== eventPath(ev)) history.replaceState(null, "", eventPath(ev) + location.hash);
    show(ev);
    othersP.then((others) => { const box = app.querySelector("#ep-similar"); if (box) box.innerHTML = similar(ev, others); });
  })
  .catch(() => missing("Couldn't load this event. Check your connection and try again."));
