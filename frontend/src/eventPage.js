// PREVIEW ONLY: how a published event will look to the public. It reads the event from this browser (saved by the host dashboard),
// so only you can see it for now. Once events live on the internet, this page reads them from there instead.
const app = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// The host's formatted text, cleaned: only simple formatting survives, and links must be http(s)
const OK = new Set(["P", "BR", "B", "STRONG", "I", "EM", "U", "S", "UL", "OL", "LI", "A", "H1", "H2", "H3", "H4", "BLOCKQUOTE", "SPAN", "DIV"]);
function clean(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ""}</div>`, "text/html");
  const walk = (node) => {
    [...node.children].forEach((el) => {
      if (!OK.has(el.tagName)) { el.replaceWith(...el.childNodes); return walk(node); }
      [...el.attributes].forEach((a) => el.removeAttribute(a.name));
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
  const amounts = tickets.map((t) => (t.paid ? Number(t.price) || 0 : 0));
  const low = Math.min(...amounts);
  const lowTicket = tickets[amounts.indexOf(low)];
  return amounts.every((n) => n === low) ? price(lowTicket) : `From ${price(lowTicket)}`;
};
const clock = (t) => { const h = Number(t?.h); return Number.isFinite(h) && t?.h !== "" ? `${h % 12 || 12}:${String(t.m || "00").padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}` : ""; };

function load() {
  const id = new URLSearchParams(location.search).get("id");
  try { return (JSON.parse(localStorage.getItem("pbj-host-events")) || []).find((e) => e.id === id); } catch { return null; }
}

function missing() {
  app.innerHTML = `<section class="ep-miss"><h1>Event not found</h1><p>This event isn't saved in this browser, or it was removed.</p><a class="btn" href="/">Back to site</a></section>`;
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
function calendarInfo(e) {
  const [y, m, d] = e.dateFrom.split("-").map(Number);
  const [y2, m2, d2] = (e.dateTo || e.dateFrom).split("-").map(Number);
  const where = e.venueStatus === "Decided" && e.venue ? [e.venue, e.venueAddress].filter(Boolean).join(", ") : e.city || "Mumbai";
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
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PeanutButterJelly.vip//Event//EN", "BEGIN:VEVENT", `UID:${e.id}@peanutbutterjelly.vip`, `DTSTAMP:${new Date().toISOString().replace(/[-:]|\.\d{3}/g, "")}`, ...when,
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
  if (e.venueStatus !== "Decided" || !e.venue) return "";
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

// ---- More like this: other published events in this browser, same category first ----
function similar(e) {
  let all = [];
  try { all = JSON.parse(localStorage.getItem("pbj-host-events")) || []; } catch { /* nothing saved */ }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const rest = all.filter((x) => x.id !== e.id && x.status === "published" && x.dateFrom && (x.images || []).some(Boolean) && new Date(...(x.dateTo || x.dateFrom).split("-").map((n, i) => (i === 1 ? n - 1 : n))) >= today);
  rest.sort((a, b) => (b.category === e.category) - (a.category === e.category) || a.dateFrom.localeCompare(b.dateFrom));
  if (!rest.length) return "";
  const card = (x) => {
    const [y, m, d] = x.dateFrom.split("-").map(Number);
    return `<a class="ep-card" href="/event.html?id=${encodeURIComponent(x.id)}"><div class="ep-card-img" style="background-image:url('${x.images.filter(Boolean)[0].replace(/'/g, "%27")}')"></div><b>${esc(x.title || "Untitled event")}</b><small>${d} ${MONTHS[m - 1]} ${y}${x.category ? ` · ${esc(x.category)}` : ""}</small></a>`;
  };
  return `<section class="ep-sec"><h2>More like this</h2><div class="ep-more">${rest.slice(0, 4).map(card).join("")}</div></section>`;
}

function show(e) {
  document.title = `${e.title || "Event"} — PeanutButterJelly.vip`;
  const imgs = (e.images || []).filter(Boolean);
  const live = e.status === "published";
  const time = [clock(e.start), e.showEnd && clock(e.end) ? clock(e.end) : ""].filter(Boolean).join(" – ");
  const where = e.venueStatus === "Decided" && e.venue ? `${esc(e.venue)}${e.venueAddress ? `<small>${esc(e.venueAddress)}</small>` : ""}` : `${esc(e.city || "Mumbai")}<small>Venue to be announced</small>`;
  const tickets = (e.tickets || []).filter((t) => t.enabled !== false);
  const price = (t) => (t.paid && Number(t.price) ? `₹${Number(t.price).toLocaleString("en-IN")}` : "Free");
  const people = (list, h) => (list || []).length ? `<section class="ep-sec"><h2>${h}</h2><div class="ep-people">${list.map((p) => `<div class="ep-person">${p.logo ? `<img src="${p.logo}" alt="" />` : `<span class="ep-init">${esc((p.name || "?")[0])}</span>`}<div><b>${esc(p.name)}</b><p>${esc(p.desc || "")}</p></div></div>`).join("")}</div></section>` : "";
  const orgs = (e.organizers || []).length ? `<section class="ep-sec"><h2>Hosted by</h2><div class="ep-people">${e.organizers.map((o) => `<div class="ep-person"><span class="ep-init">${esc((o.holder || "?")[0])}</span><div><b>${esc(o.holder)}</b></div></div>`).join("")}</div></section>` : "";

  // each ticket: is it on sale today, and how many can be picked
  const iso = (() => { const n = new Date(); return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`; })();
  const stateOf = (t) => (t.saleTo && t.saleTo < iso ? "closed" : t.saleFrom && t.saleFrom > iso ? "soon" : "open");
  const maxOf = (t) => Math.max(0, Math.min(10, Number(t.qty) || 10));
  const note = (t) => {
    const st = stateOf(t);
    if (st === "closed") return "Sales closed";
    if (st === "soon") return `Sales open ${t.saleFrom.split("-").reverse().join("/")}`;
    const left = Number(t.qty);
    return [left > 0 && left <= 20 ? `${left} left` : "", t.saleTo ? `Sale ends ${t.saleTo.split("-").reverse().join("/")}` : ""].filter(Boolean).join(" · ");
  };
  const group = (t) => (t.type === "group" && Number(t.groupSize) > 1 ? ` · for ${Number(t.groupSize)}` : "");

  app.innerHTML = `
    <div class="ep-note">${live ? "Preview: this is how your event looks to the public. Only you can see it for now." : "Preview: this event isn't published yet. Guests won't see it until you publish it."}<a href="/dashboard.html">Back to dashboard</a></div>
    <article class="ep-grid">
      <div class="ep-media">
        ${imgs.length ? `<div class="ep-hero"><img id="ep-main" src="${imgs[0]}" alt="${esc(e.title)}" /></div>` : `<div class="ep-hero ep-none">No cover image</div>`}
        ${imgs.length > 1 ? `<div class="ep-thumbs">${imgs.map((s, i) => `<button type="button" class="${i ? "" : "on"}" data-i="${i}" aria-label="Show image ${i + 1}"><img src="${s}" alt="" /></button>`).join("")}</div>` : ""}
        ${youtube(e.youtube)}
      </div>
      <div class="ep-info">
        <div class="ep-top">
          <p class="ep-tags">${[e.category, ...(e.subs || [])].filter(Boolean).map((t) => `<i>${esc(t)}</i>`).join("")}</p>
          <div class="ep-acts"><button type="button" class="ep-ic" id="ep-save" aria-pressed="false" aria-label="Save this event">${svg(ICON.heart, "1.5em")}</button><button type="button" class="ep-ic" id="ep-share" aria-label="Share this event">${svg(ICON.share, "1.5em")}</button></div>
        </div>
        <h1>${esc(e.title || "Untitled event")}</h1>
        <dl class="ep-facts">
          <div><dt>When</dt><dd>${e.dateFrom ? dateText(e) : "Date to be announced"}${time ? `<small>${esc(time)}</small>` : ""}${e.dateFrom ? `<span class="ep-cal"><button type="button" class="ep-link" id="ep-calbtn" aria-expanded="false">${svg(ICON.cal, "1.1em")}Add to calendar</button><span class="ep-calmenu" id="ep-calmenu" hidden><a href="${esc(googleCalendarUrl(e))}" target="_blank" rel="noopener noreferrer">Google Calendar</a><button type="button" id="ep-ics">Apple, Outlook and phone (.ics)</button></span></span>` : ""}</dd></div>
          <div><dt>Where</dt><dd>${where}</dd></div>
          <div><dt>Entry</dt><dd>${entry(tickets, price)}</dd></div>
        </dl>
        ${tickets.length ? `<section class="ep-sec"><h2>Tickets</h2><ul class="ep-tickets" id="ep-tickets">${tickets.map((t, i) => {
          const st = stateOf(t), max = maxOf(t), off = st !== "open" || max === 0;
          return `<li class="${off ? "off" : ""}" data-i="${i}"><div><b>${esc(t.name)}${esc(group(t))}</b>${note(t) ? `<small>${esc(note(t))}</small>` : ""}</div>
            <span class="ep-price">${price(t)}</span>
            ${off ? "" : `<span class="ep-step"><button type="button" data-d="-1" aria-label="One fewer ${esc(t.name)}">−</button><output aria-live="polite">0</output><button type="button" data-d="1" aria-label="One more ${esc(t.name)}">+</button></span>`}</li>`;
        }).join("")}</ul>
          <p class="ep-total" id="ep-total"><span>Total</span><b>₹0</b></p>
          <button class="btn" type="button" id="ep-buy">Pick a ticket</button>
          <p class="ep-msg" id="ep-msg" role="status" hidden></p></section>` : ""}
      </div>
    </article>
    ${(e.description || "").replace(/<[^>]*>/g, "").trim() ? `<section class="ep-sec ep-wide"><h2>About this event</h2><div class="ep-rich">${rich(e.description)}</div></section>` : ""}
    ${mapSection(e)}
    ${people(e.artists, "Artists")}${people(e.partners, "Partners")}${orgs}
    ${(e.terms || "").replace(/<[^>]*>/g, "").trim() ? `<section class="ep-sec ep-wide"><h2>Terms &amp; conditions</h2><div class="ep-rich ep-terms">${rich(e.terms)}</div></section>` : ""}
    ${similar(e)}`;

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
    const data = { title: e.title || "Event", text: `${e.title || "Event"} on PeanutButterJelly.vip`, url: location.href };
    if (navigator.share) { try { await navigator.share(data); } catch { /* closed the share sheet */ } return; }
    try { await navigator.clipboard.writeText(location.href); toast("Link copied"); } catch { toast("Copy the link from the address bar"); }
  });

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
  if (list) {
    const picks = tickets.map(() => 0);
    const total = app.querySelector("#ep-total b"), buy = app.querySelector("#ep-buy"), msg = app.querySelector("#ep-msg");
    const sum = () => picks.reduce((a, n, i) => a + n * (tickets[i].paid ? Number(tickets[i].price) || 0 : 0), 0);
    const count = () => picks.reduce((a, n) => a + n, 0);
    const paint = () => {
      list.querySelectorAll("li").forEach((li) => { const o = li.querySelector("output"); if (o) o.textContent = picks[+li.dataset.i]; });
      total.textContent = `₹${sum().toLocaleString("en-IN")}`;
      buy.textContent = !count() ? "Pick a ticket" : sum() === 0 ? "RSVP · Free" : `Get tickets · ₹${sum().toLocaleString("en-IN")}`;
      msg.hidden = true;
    };
    list.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-d]");
      if (!b) return;
      const i = +b.closest("li").dataset.i;
      picks[i] = Math.max(0, Math.min(maxOf(tickets[i]), picks[i] + Number(b.dataset.d)));
      paint();
    });
    buy.addEventListener("click", () => {
      msg.hidden = false;
      msg.textContent = count()
        ? `Booking isn't switched on yet, so nothing has been booked. You picked ${picks.map((n, i) => (n ? `${n} × ${tickets[i].name}` : "")).filter(Boolean).join(", ")}.`
        : "Pick at least one ticket first.";
    });
    paint();
  }
}

const ev = load();
ev ? show(ev) : missing();
