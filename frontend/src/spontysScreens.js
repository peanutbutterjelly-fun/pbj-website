// Spontys dashboard screens: For You feed, Search, Messages and the "+" menu (modelled on Corner's app, see INSPIRATION.md).
// The events come from src/eventsData.js (the same sample lineup as the Events tab). Hosts, lists and "what you missed" are built from them.
// Nothing is sent anywhere yet: saves, likes and follows are kept in this browser (localStorage).
import { EVENTS } from "./eventsData.js";
import { upcoming, priceNum, lookUp, searchPicks, words, stepOutside, STEPS } from "./assistant.js";
import { PEOPLE, BADGES, BADGE_ORDER, POSTS, PAST, personBy, hostedOf, attendedOf, byRef, isPast } from "./people.js";
import { initEvents } from "./spontysEvents.js";

const LIKES = "pbj-sponty-likes", FOLLOW = "pbj-sponty-follow", JOINED = "pbj-sponty-in";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export const ICONS = {
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 14.3c3 0 4.8 2 4.8 4.7"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  send: '<path d="M21 3 3 10.5l7 3 3 7z"/><path d="M21 3 10 13.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  heart: '<path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.4-7 10-7 10z"/>',
  comment: '<path d="M4 5h16v11H9l-5 4z"/>',
  list: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h.01M8 12h.01M8 15h.01M11 9h6M11 12h6M11 15h6"/>',
  collab: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
  tray: '<path d="M12 3v11M8 10l4 4 4-4M4 15v5h16v-5"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  chat: '<path d="M4 5h11v8H9l-3 3v-3H4z"/><path d="M9 17h6l3 3v-3h2v-8h-4"/>',
  userplus: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M18 8v6M15 11h6"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  thumb: '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.3a2 2 0 0 0 2-1.7l1.4-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  circlePlus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const when = (e) => { const [y, m, d] = e.date.split("-").map(Number); return `${DAYS[new Date(y, m - 1, d).getDay()]} ${d} ${MONTHS[m - 1]}`; };
const handleOf = (e) => "@" + e.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").slice(0, 2).join("");
const PAPER = { sun: "var(--bread)", jam: "var(--strawberry)", cream: "var(--card)", peanut: "var(--pop)", brown: "var(--brown)" };


// Pan-India city list (only Mumbai is live for now; the rest say "coming soon")
const CITIES = [["Ahmedabad","Gujarat","🪁"],["Amritsar","Punjab","🛕"],["Bengaluru","Karnataka","🌳"],["Bhopal","Madhya Pradesh","🏞️"],["Bhubaneswar","Odisha","🛕"],["Chandigarh","Chandigarh","🌹"],["Chennai","Tamil Nadu","🎭"],["Coimbatore","Tamil Nadu","🧶"],["Dehradun","Uttarakhand","⛰️"],["Delhi","Delhi","🏛️"],["Goa","Goa","🏖️"],["Guwahati","Assam","🍵"],["Gurugram","Haryana","🏢"],["Hyderabad","Telangana","🍲"],["Indore","Madhya Pradesh","🍛"],["Jaipur","Rajasthan","🏰"],["Jodhpur","Rajasthan","🔵"],["Kochi","Kerala","⛵"],["Kolkata","West Bengal","🍬"],["Kozhikode","Kerala","🌴"],["Lucknow","Uttar Pradesh","🕌"],["Ludhiana","Punjab","🧵"],["Madurai","Tamil Nadu","🪔"],["Mangaluru","Karnataka","🦀"],["Mumbai","Maharashtra","🎬"],["Mysuru","Karnataka","👑"],["Nagpur","Maharashtra","🍊"],["Nashik","Maharashtra","🍇"],["Noida","Uttar Pradesh","🌆"],["Patna","Bihar","📖"],["Puducherry","Puducherry","🥐"],["Pune","Maharashtra","📚"],["Raipur","Chhattisgarh","🌾"],["Rishikesh","Uttarakhand","🧘"],["Surat","Gujarat","💎"],["Trivandrum","Kerala","🥥"],["Udaipur","Rajasthan","🛶"],["Vadodara","Gujarat","🎶"],["Varanasi","Uttar Pradesh","🪔"],["Visakhapatnam","Andhra Pradesh","🌊"]];


// Love / Like / Curious: how a visitor feels about an event. Each pick also files the event in the matching list on their profile.
const REACT = "pbj-sponty-react";
const RX = {
  love: { icon: "heart", label: "Love", list: "fav", done: "Loved it. Added to Favorites" },
  like: { icon: "thumb", label: "Like", list: "rec", done: "Liked. Added to Recommend" },
  curious: { icon: "eye", label: "Curious", list: "want", done: "Curious. Added to Want to go" },
};
const reactions = () => read(REACT, {});

export function initScreens(k) {
  const { app, esc, svg, toast, bread, places, writePlaces, newId, enhanceSelects } = k;
  const ic = (n, s = "1.2em") => `<span class="ic" style="width:${s};height:${s}">${svg(ICONS[n] || "")}</span>`;
  const saved = (e) => places().some((x) => x.src === e.title);
  const follows = () => read(FOLLOW, []);

  const invite = async () => {
    const url = location.origin + "/";
    try { if (navigator.share) await navigator.share({ title: "PB&J", text: "Hidden gems around Mumbai", url }); else { await navigator.clipboard.writeText(url); toast("Link copied. Send it to your friends"); } } catch {}
  };

  // The one reaction button every event card has: shows your pick, opens the Love / Like / Curious tray
  const rxBtn = (e, cls = "") => { const r = reactions()[e.title]; return `<button type="button" class="fd-rx ${cls} ${r ? "on " + r : ""}" data-rx-open="${esc(e.title)}" aria-haspopup="menu" aria-label="${r ? "Your pick: " + RX[r].label : "Love, like or be curious about this"}">${ic(r ? RX[r].icon : "heart", "1.5em")}</button>`; };
  // One event card: little coloured tile, name, kind, area · price, and a save button (saves to "Want to go")
  const evCard = (e) => `<div class="fd-ev" data-t="${esc(e.title)}"><span class="fd-thumb" style="background:${PAPER[e.paper] || "var(--bread)"};color:${e.paper === "jam" || e.paper === "brown" ? "var(--cream)" : "var(--brown)"}">${esc(e.title.slice(0, 1))}</span>
    <span class="fd-ev-t"><b>${esc(e.title)}</b><em>${esc(e.category)}</em><small>${esc(e.area)} · ${esc(e.price)} · ${when(e)}</small></span>
    ${rxBtn(e)}</div>`;
  /* ---------- People: badges, follow buttons, the thread ---------- */
  const KINDS = { music: "🎷", workshop: "🏺", comedy: "🎤", vinyl: "💿", film: "🎬", food: "🍜", art: "🎨", games: "🎲", outdoors: "🚲", market: "🛍️" };
  const bdg = (b) => `<span class="bd bd-${b}">${esc(BADGES[b]?.label || "")}</span>`;
  const isF = (h) => follows().includes(h);
  const fBtn = (h, cls = "") => `<button type="button" class="th-follow ${cls} ${isF(h) ? "on" : ""}" data-f="${esc(h)}" aria-pressed="${isF(h)}">${isF(h) ? "Following" : "Follow"}</button>`;
  const joined = () => read(JOINED, []);
  const eid = (e) => e.id || "u" + EVENTS.findIndex((x) => x.title === e.title);
  const pastRow = (e) => `<a class="fd-ev pe-ev" href="#/e/${esc(eid(e))}"><span class="fd-thumb" style="background:${PAPER[e.paper] || "var(--bread)"};color:${e.paper === "jam" || e.paper === "brown" ? "var(--cream)" : "var(--brown)"}">${KINDS[e.kind] || "✨"}</span>
    <span class="fd-ev-t"><b>${esc(e.title)}</b><em>${esc(e.category)} · past</em><small>${esc(e.area)} · ${esc(e.price)} · ${when(e)}${e.going ? ` · ${e.going} went` : ""}</small></span><span class="pe-tag">Past</span></a>`;
  /** One row for any event: the live ones can be saved with the heart, the past ones show how many went. */
  const evRow = (e) => (isPast(e) ? pastRow(e) : `<div class="fd-ev pe-ev"><span class="fd-thumb" style="background:${PAPER[e.paper] || "var(--bread)"};color:${e.paper === "jam" || e.paper === "brown" ? "var(--cream)" : "var(--brown)"}">${KINDS[e.kind] || "✨"}</span>
    <span class="fd-ev-t"><b>${esc(e.title)}</b><em>${esc(e.category)} · coming up</em><small>${esc(e.area)} · ${esc(e.price)} · ${when(e)} · ${esc(e.time)}</small></span>${rxBtn(e)}</div>`);
  const planCard = (po) => { const on = joined().includes(po.id), left = Math.max(0, po.plan.spots - (on ? 1 : 0));
    return `<div class="th-plan"><span class="th-plan-t"><b>${esc(po.plan.title)}</b><small>${esc(po.plan.when)} · ${esc(po.plan.area)}</small><small>Free · <span data-left="${po.id}">${left}</span> spot${left === 1 ? "" : "s"} left</small></span>
      <button type="button" class="btn small ${on ? "ghost" : ""}" data-in="${po.id}" aria-pressed="${on}">${on ? "You're in ✓" : "I'm in"}</button></div>`; };
  const person = (po) => personBy(po.by);
  /** One post in the thread: who, their badge, what they said, and the event or plan it points at. */
  const threadPost = (po) => {
    const pe = person(po); if (!pe) return "";
    const ev = po.ev ? upcoming().find((e) => e.title === po.ev) || byRef(po.ev) : null, past = po.past ? byRef(po.past) : null;
    return `<article class="fd-post th-post"><a class="fd-av th-av" href="#/u/${esc(pe.handle.slice(1))}" aria-label="${esc(pe.name)}'s profile">${bread({ name: pe.name })}</a><div class="fd-body">
      <header class="th-head"><span class="th-who"><a class="th-name" href="#/u/${esc(pe.handle.slice(1))}">${esc(pe.name)}</a><small>${esc(pe.handle)} · ${esc(po.ago)}</small></span>${fBtn(pe.handle)}</header>${bdg(pe.badge)}
      <p class="fd-text">${esc(po.text)}</p>${ev ? evCard(ev) : ""}${past ? pastRow(past) : ""}${po.plan ? planCard(po) : ""}
      <div class="fd-acts"><button type="button" data-soon="Comments are coming soon" aria-label="Comment">${ic("comment", "1.5em")}</button></div></div></article>`;
  };
  const thread = (list) => list.map(threadPost).join("");
  /** People you don't follow yet, a mix of every badge so hosts, planners and regulars all get a look in. */
  const suggest = (n) => { const left = BADGE_ORDER.map((b) => PEOPLE.filter((pe) => pe.badge === b && !isF(pe.handle))), out = []; for (let i = 0; out.length < n && left.some((l) => l[i]); i++) left.forEach((l) => { if (l[i] && out.length < n) out.push(l[i]); }); return out; };
  const peopleStrip = (list) => `<div class="th-strip">${list.map((pe) => { const n = hostedOf(pe).length; return `<div class="th-card"><a class="th-cav" href="#/u/${esc(pe.handle.slice(1))}">${bread({ name: pe.name })}</a><a class="th-cname" href="#/u/${esc(pe.handle.slice(1))}">${esc(pe.name)}</a>${bdg(pe.badge)}<small>${pe.followers.toLocaleString("en-IN")} followers${n ? ` · ${n} hosted` : ""}</small>${fBtn(pe.handle)}</div>`; }).join("")}</div>`;

  // The Love / Like / Curious tray
  let tray = null;
  const closeTray = () => { tray?.remove(); tray = null; };
  const syncRx = (title) => {
    const r = reactions()[title];
    document.querySelectorAll(`[data-rx-open="${CSS.escape(title)}"]`).forEach((b) => {
      b.className = b.className.replace(/\b(on|love|like|curious)\b/g, "").replace(/\s+/g, " ").trim() + (r ? " on " + r : "");
      b.innerHTML = ic(r ? RX[r].icon : "heart", "1.5em");
      b.setAttribute("aria-label", r ? "Your pick: " + RX[r].label : "Love, like or be curious about this");
    });
  };
  const setReaction = (title, r) => {
    const e = EVENTS.find((x) => x.title === title); if (!e) return;
    const m = reactions(), cur = m[title]; let list = places().filter((x) => x.src !== title);
    if (cur === r) { delete m[title]; toast("Removed your pick"); }
    else { m[title] = r; list = [{ id: newId(), title, area: e.area, list: RX[r].list, src: title }, ...list]; toast(RX[r].done); }
    write(REACT, m); writePlaces(list); syncRx(title);
  };
  const openTray = (btn) => {
    closeTray();
    const title = btn.dataset.rxOpen, cur = reactions()[title];
    tray = document.createElement("div"); tray.className = "rx-tray"; tray.dataset.for = title; tray.setAttribute("role", "menu");
    tray.innerHTML = Object.entries(RX).map(([id, x]) => `<button type="button" role="menuitem" data-rx="${id}" class="${cur === id ? "on" : ""}">${ic(x.icon, "1.4em")}<span>${x.label}</span></button>`).join("");
    document.body.append(tray);
    const r = btn.getBoundingClientRect(), h = tray.offsetHeight, room = innerHeight - 110; // keep clear of the bottom bar
    tray.style.right = Math.max(8, innerWidth - r.right) + "px";
    if (r.bottom + h + 12 > room && r.top > h + 12) tray.style.bottom = innerHeight - r.top + 8 + "px"; else tray.style.top = r.bottom + 8 + "px";
    tray.addEventListener("click", (ev) => { const c = ev.target.closest("[data-rx]"); if (!c) return; setReaction(title, c.dataset.rx); closeTray(); });
    tray.querySelector("button").focus({ preventScroll: true });
  };
  document.addEventListener("click", (ev) => { if (tray && !ev.target.closest(".rx-tray") && !ev.target.closest("[data-rx-open]")) closeTray(); });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeTray(); });
  window.addEventListener("scroll", closeTray, { passive: true });

  // Clicks shared by every screen: reactions, "soon" toasts, invite
  const wire = (root) => {
    root.addEventListener("click", (ev) => {
      const rx = ev.target.closest("[data-rx-open]");
      if (rx) { ev.stopPropagation(); tray && tray.dataset.for === rx.dataset.rxOpen ? closeTray() : openTray(rx); return; }
      const fb = ev.target.closest("[data-f]");
      if (fb) { const h = fb.dataset.f, set = new Set(follows()); set.has(h) ? set.delete(h) : set.add(h); write(FOLLOW, [...set]); const on = set.has(h);
        document.querySelectorAll(`[data-f="${CSS.escape(h)}"]`).forEach((b) => { b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); b.textContent = on ? "Following" : "Follow"; });
        document.querySelectorAll(`[data-fc="${CSS.escape(h)}"]`).forEach((n) => { n.textContent = (personBy(h)?.followers || 0) + (on ? 1 : 0); });
        toast(on ? `Following ${personBy(h)?.name || h}` : "Unfollowed"); return; }
      const jb = ev.target.closest("[data-in]");
      if (jb) { const id = jb.dataset.in, po = POSTS.find((x) => x.id === id), set = new Set(joined()); set.has(id) ? set.delete(id) : set.add(id); write(JOINED, [...set]); const on = set.has(id);
        document.querySelectorAll(`[data-in="${id}"]`).forEach((b) => { b.classList.toggle("ghost", on); b.setAttribute("aria-pressed", on); b.textContent = on ? "You're in ✓" : "I'm in"; });
        document.querySelectorAll(`[data-left="${id}"]`).forEach((n) => { n.textContent = Math.max(0, po.plan.spots - (on ? 1 : 0)); });
        toast(on ? `You're in! ${po.plan.title}, ${po.plan.when}` : "Removed you from the plan"); return; }
      const so = ev.target.closest("[data-soon]"); if (so) { toast(so.dataset.soon); return; }
      if (ev.target.closest("[data-invite]")) invite();
    });
  };



  /* ---------- Find people (the person+ button on Messages) ---------- */
  function openPeople() {
    const people = PEOPLE.map((pe) => ({ name: pe.name, handle: pe.handle, badge: pe.badge }));
    const back = document.createElement("div"); back.className = "pp-back";
    back.innerHTML = `<div class="pp-card" role="dialog" aria-modal="true" aria-label="Find people"><button type="button" class="pp-x" aria-label="Close">${ic("close", "1.6em")}</button>
      <div class="pp-list" aria-live="polite"><p class="pp-tag">Find your friends, and their friends, and everyone else!</p></div>
      <label class="pp-bar"><input type="search" placeholder="Search" aria-label="Search people by name" autocomplete="off" /></label></div>`;
    document.body.append(back);
    const list = back.querySelector(".pp-list"), input = back.querySelector("input");
    const paint = (q) => {
      const t = q.trim().toLowerCase().replace(/^@/, "");
      const fol = follows(), hits = people.filter((p) => p.name.toLowerCase().includes(t) || p.handle.toLowerCase().includes(t));
      list.innerHTML = hits.length ? hits.map((p) => { const on = fol.includes(p.handle); return `<div class="pp-row"><a class="pp-av" href="#/u/${esc(p.handle.slice(1))}" data-close>${bread({ name: p.name })}</a><a class="pp-who" href="#/u/${esc(p.handle.slice(1))}" data-close><b>${esc(p.name)}</b><small>${esc(p.handle)} · ${esc(BADGES[p.badge].label)}</small></a><button type="button" class="pp-follow ${on ? "on" : ""}" data-h="${esc(p.handle)}" aria-pressed="${on}">${on ? "Following" : "Follow"}</button></div>`; }).join("") : `<p class="pp-tag">No one found. Try a different name.</p>`;
    };
    paint("");
    input.addEventListener("input", () => paint(input.value));
    list.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) { close(); return; }
      const b = e.target.closest("[data-h]"); if (!b) return;
      const set = new Set(follows()); set.has(b.dataset.h) ? set.delete(b.dataset.h) : set.add(b.dataset.h); write(FOLLOW, [...set]);
      const on = set.has(b.dataset.h); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); b.textContent = on ? "Following" : "Follow";
    });
    const close = () => { document.removeEventListener("keydown", onKey); back.classList.remove("show"); setTimeout(() => back.remove(), 200); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    back.querySelector(".pp-x").addEventListener("click", close);
    requestAnimationFrame(() => { back.classList.add("show"); input.focus({ preventScroll: true }); });
  }

  /* ---------- City picker (the "MUM" button) ---------- */
  function openCities() {
    const back = document.createElement("div"); back.className = "ct-back";
    back.innerHTML = `<div class="ct-card" role="dialog" aria-modal="true" aria-label="Search cities"><header><h2 class="cut">Search cities</h2><button type="button" class="ct-x" aria-label="Close">${ic("close", "1.4em")}</button></header>
      <label class="ct-search">${ic("search", "1.3em")}<input type="search" placeholder="Find a city" aria-label="Find a city" autocomplete="off" /></label>
      <div class="ct-scroll"><h3>📍 Your cities</h3><div class="ct-mine"><button type="button" class="ct-chip" data-city="Mumbai">🎬 Mumbai</button></div>
      <h3 class="ct-all">🌏 All cities in India</h3><ul class="ct-list"></ul></div></div>`;
    document.body.append(back);
    const made = k.cut(back);
    const input = back.querySelector("input"), list = back.querySelector(".ct-list");
    let rowLetters = [];
    const paint = (q = "") => {
      rowLetters.forEach((l) => l.dispose()); rowLetters = [];
      const t = q.trim().toLowerCase(), hits = CITIES.filter(([c, st]) => !t || c.toLowerCase().includes(t) || st.toLowerCase().includes(t));
      list.innerHTML = hits.length ? hits.map(([c, st, e]) => `<li><button type="button" data-city="${esc(c)}" class="${c === "Mumbai" ? "live" : ""}"><span class="e">${e}</span><b class="cut" data-fill="var(--pop)">${esc(c)}</b><small>${esc(st)}</small>${c === "Mumbai" ? '<i class="ct-live">✓ live</i>' : '<i class="ct-soon">soon</i>'}</button></li>`).join("") : `<li class="ct-none">No city found. Try another name.</li>`;
      rowLetters = k.cut(list); // each city name is cut like the headlines
    };
    paint();
    input.addEventListener("input", () => paint(input.value));
    const close = () => { document.removeEventListener("keydown", onKey); back.classList.remove("show"); setTimeout(() => { made.forEach((l) => l.dispose()); rowLetters.forEach((l) => l.dispose()); back.remove(); }, 200); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    back.addEventListener("click", (e) => {
      if (e.target === back || e.target.closest(".ct-x")) return close();
      const b = e.target.closest("[data-city]"); if (!b) return;
      if (b.dataset.city === "Mumbai") close(); else toast(`${b.dataset.city} is coming soon. We'll tell you when we get there`);
    });
    requestAnimationFrame(() => { back.classList.add("show"); input.focus({ preventScroll: true }); });
  }

  /* ---------- For you ---------- */
  const CHIPS = [["new", "var(--bread)"], ["trending", "var(--pop)"], ["exclusive", "var(--crust)"], ["sponty", "var(--strawberry)"]];
  let chip = null, tab = "foryou"; const missedGone = new Set();
  const filt = (list) => chip === "new" ? [...list].reverse() : chip === "trending" ? list.filter((_, i) => i % 2 === 0) : list;
  const LISTS = [
    { name: "this weekend plans", q: "this weekend", g: "linear-gradient(150deg,#c2184f,#f0a830)" },
    { name: "laughs & open mics", q: "comedy", g: "linear-gradient(150deg,#6b2d5c,#c2184f)" },
    { name: "lowkey under ₹500", q: "under ₹500", g: "linear-gradient(150deg,#f0a830,#ffe386)", dark: true },
  ];

  function renderFeed() {
    document.title = "For you — PeanutButterJelly.vip";
    const ups = upcoming(), list = filt(ups), hl = chip ? [] : ups.slice(0, 3).filter((e) => !missedGone.has(e.title)), rest = list.filter((e) => !hl.includes(e));
    const fol = follows();
    const head = `<header class="fd-top"><button type="button" class="fd-city" data-cities aria-haspopup="dialog">Mum${ic("chev", "1em")}</button>
      <div class="fd-tabs" role="tablist"><button type="button" role="tab" class="${tab === "foryou" ? "on" : ""}" data-tab="foryou" aria-selected="${tab === "foryou"}">for you</button><button type="button" role="tab" class="${tab === "friends" ? "on" : ""}" data-tab="friends" aria-selected="${tab === "friends"}">friends</button></div>
      <button type="button" class="sp-ico" data-soon="No notifications yet" aria-label="Notifications">${ic("bell", "1.3em")}</button></header>`;
    const posts = POSTS.filter((po) => !chip || (chip === "trending" ? po.kind === "announce" || po.kind === "plan" : chip === "exclusive" ? person(po)?.badge === "exclusive" : chip === "sponty" ? person(po)?.badge === "sponty" : true));
    if (tab === "friends") {
      // PB&J is every new joiner's first friend, until they follow people of their own
      const mine = posts.filter((po) => fol.includes(po.by));
      app.innerHTML = head + `<div class="fd-cols"><div class="fd-main"><section class="fd-pbjnote"><div class="fd-av">${bread({ name: "PB" })}</div><p>${fol.length ? "Posts from the people you follow." : "PB&amp;J is your first friend. Follow hosts and planners and their posts show up here."}</p><button type="button" class="btn small" data-invite>Invite friends</button></section>
        <div class="fd-feed b">${thread(mine) || `<p class="sp-sub fd-empty">${fol.length ? "Nothing new from the people you follow yet." : "Nothing here yet. Follow a few people and their posts will land here."}</p>`}</div></div>
        <aside class="fd-side"><div class="fd-row fd-r-p"><h2 class="fd-h cut">People to follow</h2></div>${peopleStrip(suggest(6))}</aside></div>`;
    } else app.innerHTML = head + `
      <div class="fd-chips">${CHIPS.map(([n, c]) => `<button type="button" class="fd-chip ${chip === n ? "on" : ""}" data-chip="${n}" aria-pressed="${chip === n}"><i style="background:${c}"></i>${n}</button>`).join("")}</div>
      <div class="fd-cols"><div class="fd-main">
      <h2 class="fd-h cut fd-new">${chip ? esc(chip) + " for you" : "New for you"}</h2>
      <div class="fd-feed a">${thread(posts.slice(0, 3)) || `<p class="sp-sub">Nothing matches that yet. Try another tag.</p>`}</div>
      <div class="fd-feed b">${thread(posts.slice(3))}</div>
      </div><aside class="fd-side">
      <section class="sp-card fd-invite"><div class="fd-bread">${bread({ name: "PB" })}</div><h2>Have friends with good taste?</h2><button type="button" class="btn" data-invite>${ic("send", "1.2em")} Invite them</button></section>
      ${hl.length ? `<div class="fd-hrow"><h2 class="fd-h cut">What you missed</h2>${hl.length > 1 ? `<span class="fd-count">${hl.length}</span>` : ""}</div><div class="fd-stack" data-n="${Math.min(hl.length, 3)}">
        ${hl.slice(1, 3).map((_, i) => `<div class="fd-missed back" style="--i:${i + 1}" aria-hidden="true"></div>`).join("")}
        <section class="fd-missed top"><button type="button" class="fd-x" data-gone="${esc(hl[0].title)}" aria-label="Dismiss">${ic("close", "1.1em")}</button>
        <div class="fd-mhead"><div class="fd-av">${bread({ name: "PB" })}</div><p class="fd-line"><b>pbj</b> <span class="fd-pick">PB&amp;J highlight</span> <span>${when(hl[0])}</span></p></div>
        <div class="fd-poster" style="--bg:${hl[0].paper === "cream" ? "var(--grape)" : PAPER[hl[0].paper] || "var(--bread)"}"><span class="fd-big" aria-hidden="true">${esc(hl[0].title.slice(0, 1))}</span>
          ${rxBtn(hl[0], "poster")}
          <div class="fd-cap"><b>${esc(hl[0].title)}</b><em>${esc(hl[0].category)}</em><small>${esc(hl[0].area)} · ${esc(hl[0].price)}</small></div></div>
        <div class="fd-macts"><button type="button" data-soon="Comments are coming soon" aria-label="Comment">${ic("comment", "1.5em")}</button>
          <div class="fd-pill">${hl.length > 1 ? `<button type="button" data-gone="${esc(hl[0].title)}" aria-label="Next highlight">${ic("arrow", "1.5em")}</button>` : ""}</div></div>
        </section></div>` : ""}
      <div class="fd-row"><h2 class="fd-h cut">Lists for you</h2><button type="button" class="fd-link" data-soon="All lists are coming soon">view all</button></div>
      <div class="fd-lists">${LISTS.map((l) => { const n = lookUp(l.q, []).events.length; return `<a class="fd-list ${l.dark ? "dark" : ""}" href="#/search?q=${encodeURIComponent(l.q)}" style="background:${l.g}"><b>${esc(l.name)}</b><small>by @pbj</small><small>${n} event${n === 1 ? "" : "s"}</small></a>`; }).join("")}</div>
      <div class="fd-row fd-r-p"><h2 class="fd-h cut">People to follow</h2><button type="button" class="fd-link" data-soon="Search people from the messages tab">find people</button></div>
      ${peopleStrip(suggest(6))}
      </aside></div>
      <p class="sp-sub fd-note">Sample people and events for now. The real ones arrive with PB&J's hosts.</p>`;
    app.querySelector("[data-cities]")?.addEventListener("click", openCities);
    app.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; renderFeed(); }));
    app.querySelectorAll("[data-chip]").forEach((b) => b.addEventListener("click", () => { chip = chip === b.dataset.chip ? null : b.dataset.chip; renderFeed(); }));
    const top = app.querySelector(".fd-missed.top");
    if (top) {
      const dismiss = (dir = 1) => { top.style.transition = "transform .28s ease, opacity .28s"; top.style.transform = `translateX(${dir * 130}%) rotate(${dir * 8}deg)`; top.style.opacity = "0"; setTimeout(() => { missedGone.add(top.querySelector("[data-gone]").dataset.gone); renderFeed(); }, 260); };
      top.querySelectorAll("[data-gone]").forEach((g) => g.addEventListener("click", () => dismiss(1)));
      let x0 = null;
      top.addEventListener("pointerdown", (e) => { if (e.target.closest("button")) return; x0 = e.clientX; top.setPointerCapture(e.pointerId); });
      top.addEventListener("pointermove", (e) => { if (x0 == null) return; const dx = e.clientX - x0; top.style.transition = "none"; top.style.transform = `translateX(${dx}px) rotate(${dx / 30}deg)`; });
      const end = (e) => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 70) dismiss(dx > 0 ? 1 : -1); else { top.style.transition = "transform .3s cubic-bezier(.34,1.56,.64,1)"; top.style.transform = ""; } };
      top.addEventListener("pointerup", end); top.addEventListener("pointercancel", end);
    }
  }

  /* ---------- Search: Ask FUN (suggestion cards, then a map with numbered pins, a chat sheet that shows its steps, result cards, find more) ---------- */
  const IDEAS = [["🍷", "post-work drinks"], ["🍻", "plan a night out near me"], ["🆓", "something free to do"], ["💸", "date night under ₹1,000"], ["🌇", "rooftop with a view"], ["💃", "dancing, not clubbing"], ["🎧", "live music this weekend"], ["😂", "comedy nights"], ["🏺", "workshops to try"]];
  const ROWS = [[0, 1, 2, 3], [4, 5, 6, 7, 8]];
  const KIND = { music: "🎷", workshop: "🏺", comedy: "🎤", vinyl: "💿", film: "🎬", food: "🍜", art: "🎨", games: "🎲" };
  const LISTNAME = { want: "Want to go", going: "Going", fav: "Favorite", rec: "Recommended", okay: "Okay" };
  const sleep = (ms) => new Promise((r) => setTimeout(r, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms));
  // India, drawn by hand (longitude, latitude), with Mumbai drawn in more detail for when the map zooms in
  const AREAS = { "Bandra West": [19.06, 72.83], "Kala Ghoda": [18.928, 72.832], "Andheri West": [19.136, 72.828], "Lower Parel": [19.0, 72.83], Versova: [19.131, 72.811], Fort: [18.934, 72.838], Colaba: [18.915, 72.825], Powai: [19.118, 72.905] };
  const COAST = [[19.7, 72.7], [19.3, 72.78], [19.17, 72.8], [19.13, 72.803], [19.09, 72.812], [19.04, 72.815], [19.0, 72.81], [18.96, 72.805], [18.925, 72.805], [18.903, 72.815], [18.92, 72.842], [18.96, 72.852], [19.01, 72.868], [19.05, 72.9], [19.1, 72.935], [19.16, 72.96], [19.3, 73.0], [19.7, 73.4]];
  const INDIA = [[74.3, 37], [76.8, 35.9], [78.9, 35.5], [80.2, 35.3], [79.2, 33], [78.8, 31.2], [80, 30.2], [81, 30.1], [80.1, 28.8], [81.8, 27.9], [84, 27.3], [86, 26.6], [88.1, 26.4], [88, 27.9], [88.8, 27.3], [89.8, 26.7], [92, 26.9], [92.1, 27.8], [94, 27], [95.5, 28.2], [97.3, 28.2], [96, 27.3], [95.2, 26], [94.5, 24], [93.4, 22.8], [92.6, 21.9], [92.3, 24.3], [91.5, 24.1], [91.2, 25.2], [90, 25.2], [89.8, 26], [89, 26.3], [88.4, 25.9], [88.3, 25], [88.9, 24.2], [88.7, 23], [89, 21.7], [87, 21.4], [86.5, 20.3], [85, 19.3], [84, 18.3], [82.3, 16.7], [80.3, 15.5], [80.2, 13.4], [79.8, 11.5], [79.9, 10.3], [78.9, 9.2], [77.5, 8.1], [76.5, 8.9], [75.8, 11], [74.8, 12.9], [74, 15], [73.4, 16.5], [72.9, 18.9], [72.8, 19.1], [72.7, 20.5], [72.9, 21.2], [72.5, 22.3], [72, 21], [70.5, 20.8], [69, 22.3], [68.2, 23.5], [68.8, 23.9], [70, 24.1], [70.5, 25.5], [70.2, 26.2], [70.1, 27.6], [71.6, 28], [72.9, 29], [74.4, 30.1], [74.6, 31.1], [74.5, 32], [75, 32.8]];
  const MAP_CITIES = [["Delhi", 77.2, 28.6], ["Mumbai", 72.88, 19.07], ["Kolkata", 88.36, 22.57], ["Chennai", 80.27, 13.08], ["Bengaluru", 77.59, 12.97], ["Hyderabad", 78.48, 17.39], ["Ahmedabad", 72.57, 23.03], ["Pune", 73.86, 18.52], ["Jaipur", 75.79, 26.91], ["Lucknow", 80.95, 26.85], ["Goa", 73.83, 15.5], ["Kochi", 76.27, 9.93]];
  const MX = (lon) => (lon - 67) * 10, MY = (lat) => (38 - lat) * 10;
  const NS = "http://www.w3.org/2000/svg", sv = (tag, at = {}, parent) => { const n = document.createElementNS(NS, tag); for (const k in at) n.setAttribute(k, at[k]); parent?.append(n); return n; };

  function renderSearch(q0 = "") {
    document.title = "Ask FUN — PeanutButterJelly.vip";
    app.innerHTML = `<div class="fs" id="fs">
      <section class="fs-hero"><h1 class="cut">Ask FUN</h1><p class="sp-sub">the more you save, the more personal it gets</p>
        <div class="fs-rows">${ROWS.map((r) => `<div class="fs-row">${r.map((n) => `<button type="button" class="fd-idea" data-idea="${esc(IDEAS[n][1])}"><span class="e">${IDEAS[n][0]}</span>${esc(IDEAS[n][1])}</button>`).join("")}</div>`).join("")}</div></section>
      <div class="fs-map" id="fs-map"><svg id="fs-svg" role="img" aria-label="Map of Mumbai with your results pinned"></svg><button type="button" class="fs-x" id="fs-x" aria-label="New search">${ic("close", "1.2em")}</button></div>
      <section class="fs-sheet" id="fs-sheet"><i class="fs-grab"></i><div id="fd-res" class="as-thread" aria-live="polite"></div></section>
      <div class="fs-dock"><div class="fs-chips" id="fs-chips"></div>
        <form class="fd-ask" id="fd-ask"><input name="q" placeholder="Ask FUN anything" aria-label="Ask FUN anything" autocomplete="off" /><button type="submit" class="fd-go" aria-label="Ask FUN">${ic("arrow", "1.3em")}</button></form></div></div>`;
    const fs = app.querySelector("#fs"), form = app.querySelector("#fd-ask"), res = app.querySelector("#fd-res"), chipsBox = app.querySelector("#fs-chips"), mapEl = app.querySelector("#fs-map"), svg = app.querySelector("#fs-svg");

    // ----- the map: all of India, zooming in to wherever the pins are -----
    const pts = (list) => list.map(([lo, la]) => `${MX(lo).toFixed(2)} ${MY(la).toFixed(2)}`);
    sv("rect", { x: -2000, y: -2000, width: 6000, height: 6000, fill: "var(--sea)" }, svg);
    const wide = sv("g", { class: "fs-wide" }, svg), near = sv("g", { class: "fs-near" }, svg);
    sv("path", { class: "land", d: `M${pts(INDIA).join("L")}Z` }, wide);
    MAP_CITIES.forEach(([n, lo, la]) => { sv("circle", { cx: MX(lo), cy: MY(la), r: 0.9, fill: "var(--ink)", opacity: 0.55 }, wide); const t = sv("text", { x: MX(lo) + 2, y: MY(la) + 1, class: "fs-lbl" }, wide); t.textContent = n; });
    sv("path", { class: "land", d: `M${pts(COAST.map(([la, lo]) => [lo, la])).join("L")}Z` }, near);
    sv("path", { class: "road", d: `M${MX(72.832)} ${MY(19.3)}C${MX(72.84)} ${MY(19.1)} ${MX(72.828)} ${MY(19.0)} ${MX(72.835)} ${MY(18.9)}` }, near);
    [[72.91, 19.2, 0.28, 0.14], [72.9, 19.07, 0.14, 0.08]].forEach(([lo, la, rx, ry]) => sv("ellipse", { cx: MX(lo), cy: MY(la), rx, ry, fill: "#dbe7bf", opacity: 0.9 }, near));
    Object.entries(AREAS).forEach(([n, [la, lo]]) => { const t = sv("text", { x: MX(lo) + 0.09, y: MY(la) + 0.03, class: "fs-lbl" }, near); t.textContent = n; });
    const pinLayer = sv("g", {}, svg);
    let view = [MX(82.8), MY(21.5), 320, 340], pins = [], raf = 0;
    const size = () => ({ w: mapEl.clientWidth || 600, h: mapEl.clientHeight || 300 });
    const fitView = (list) => {
      const { w, h } = size(), a = w / h; let bw, bh, cx, cy;
      if (!list.length) { bw = MX(97.5) - MX(68); bh = MY(37.2) - MY(6); cx = MX(82.8); cy = MY(21.6); }
      else {
        const xs = list.map((p) => p[0]), ys = list.map((p) => p[1]); bw = (Math.max(...xs) - Math.min(...xs)) * 1.5 + 1.2; bh = (Math.max(...ys) - Math.min(...ys)) * 1.5 + 1.8;
        cx = (Math.max(...xs) + Math.min(...xs)) / 2; cy = (Math.max(...ys) + Math.min(...ys)) / 2;
      }
      const vw = Math.max(bw, bh * a, list.length ? 2 : 0); return [cx, cy, vw, vw / a];
    };
    const paint = (v) => {
      view = v; const { w } = size();
      svg.setAttribute("viewBox", `${v[0] - v[2] / 2} ${v[1] - v[3] / 2} ${v[2]} ${v[3]}`);
      const k = (46 / 26) * (v[2] / w);
      pins.forEach((p) => p.g.setAttribute("transform", `translate(${p.x} ${p.y}) scale(${k})`));
      svg.style.setProperty("--lbl", `${v[2] / 48}px`);
      wide.setAttribute("opacity", clamp01((v[2] - 14) / 40)); // the country fades out as you zoom into the city
      svg.classList.toggle("zoomed", v[2] < 14);
    };
    const clamp01 = (x) => Math.max(0, Math.min(1, x));
    const flyTo = (to) => {
      cancelAnimationFrame(raf); const from = view.slice(), t0 = performance.now(), dur = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1100;
      const step = (t) => {
        const p = dur ? Math.min(1, (t - t0) / dur) : 1, e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // zoom evenly (in log), start and end gently
        const vw = Math.exp(Math.log(from[2]) + (Math.log(to[2]) - Math.log(from[2])) * e), r = to[3] / to[2];
        paint([from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e, vw, vw * r]); if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const clearPins = () => { pins.forEach((p) => p.g.remove()); pins = []; };
    const addPins = (list, from = 1) => list.forEach((e, i) => {
      const [la, lo] = AREAS[e.area] || [19.07, 72.84], dup = pins.filter((p) => p.e.area === e.area).length;
      const x = MX(lo) + dup * 0.17 - 0.08, y = MY(la) + dup * 0.12, g = sv("g", {}, pinLayer), n = from + i;
      g.innerHTML = `<g class="fs-pin" data-n="${n}" style="animation-delay:${i * 50}ms"><path d="M0 2C-9 -8 -13 -12 -13 -19a13 13 0 0 1 26 0C13 -12 9 -8 0 2z" fill="var(--bread)" stroke="var(--ink)" stroke-width="1" stroke-linejoin="round"/><text x="0" y="-13" text-anchor="middle" font-size="14">${KIND[e.kind] || "✨"}</text><circle cx="11" cy="-30" r="7.5" fill="var(--ink)"/><text x="11" y="-27" text-anchor="middle" font-size="9" font-weight="700" fill="var(--cream)">${n}</text></g>`;
      pins.push({ e, g, x, y, n });
    });
    const hiPin = (n) => pins.forEach((p) => { p.g.firstElementChild.classList.toggle("hi", p.n === n); if (p.n === n) pinLayer.append(p.g); }); // the chosen pin comes to the front
    svg.addEventListener("click", (ev) => {
      const g = ev.target.closest(".fs-pin"); if (!g) return; const c = res.querySelector(`.fs-ev[data-n="${g.dataset.n}"]`);
      if (c) { c.scrollIntoView({ block: "center", behavior: "smooth" }); c.classList.add("flash"); setTimeout(() => c.classList.remove("flash"), 900); hiPin(+g.dataset.n); }
    });
    res.addEventListener("pointerover", (ev) => { const c = ev.target.closest(".fs-ev[data-n]"); if (c) hiPin(+c.dataset.n); });
    res.addEventListener("pointerleave", () => hiPin(0));
    let sel = 0; // tapping a card zooms the map to its pin; tapping it again zooms back out
    res.addEventListener("click", (ev) => {
      const c = ev.target.closest(".fs-ev[data-n]"); if (!c || ev.target.closest("[data-rx-open]")) return;
      const n = +c.dataset.n, pin = pins.find((p) => p.n === n); if (!pin) return;
      sel = sel === n ? 0 : n; res.querySelectorAll(".fs-ev.on").forEach((x) => x.classList.remove("on")); if (sel) c.classList.add("on");
      flyTo(sel ? fitView([[pin.x, pin.y]]) : fitView(pins.map((p) => [p.x, p.y])));
    });
    app.querySelector("#fs-x").addEventListener("click", () => renderSearch());

    // ----- the thread -----
    let run = 0, shown = [], first = true; // a newer question cancels the older one
    const live = () => { if (!fs.classList.contains("live")) { fs.classList.add("live"); paint(fitView([])); } window.scrollTo({ top: 0 }); };
    const bot = () => { const d = document.createElement("div"); d.className = "as-bot"; res.append(d); return d; };
    const evBig = (e, n) => `<article class="fs-ev" data-n="${n}" data-t="${esc(e.title)}"><div class="fs-art" style="background:${PAPER[e.paper] || "var(--bread)"}"><span>${KIND[e.kind] || "✨"}</span><b>${n}</b></div>
      <div class="fs-info"><h3>${esc(e.title)}</h3><em>${esc(e.category)}</em><small><span>${esc(e.area)}</span> · <span>${esc(e.price)}</span> · <span>${when(e)}</span> · <span>${esc(e.time)}</span></small></div>${rxBtn(e)}</article><p class="fs-blurb">${esc(e.blurb)}</p>`;
    const setChips = (events, q) => {
      const out = []; if (events[0]) out.push(`more ${events[0].category.toLowerCase()}`);
      out.push(/free/i.test(q) ? "date night under ₹1,000" : "something free to do"); out.push(/weekend/i.test(q) ? "this month" : "this weekend");
      chipsBox.innerHTML = out.slice(0, 2).map((t) => `<button type="button" class="fs-chip" data-idea="${esc(t)}">${esc(t)}</button>`).join("");
    };
    const stepsList = async (box, rows, id) => {
      const bar = document.createElement("div"); bar.className = "fs-prog"; bar.innerHTML = "<i></i>"; box.append(bar);
      const ul = document.createElement("ul"); ul.className = "as-steps"; box.append(ul); await sleep(120); bar.firstChild.style.width = "6%";
      for (let i = 0; i < rows.length; i++) {
        if (id !== run) return false;
        const [e, label, sub] = rows[i], li = document.createElement("li"); li.innerHTML = `<span class="e">${e}</span><span>${esc(label)}<small></small></span>`; ul.append(li);
        li.scrollIntoView({ block: "nearest", behavior: "smooth" }); await sleep(450);
        li.querySelector("small").textContent = "↳ " + sub; li.classList.add("done"); bar.firstChild.style.width = `${((i + 1) / rows.length) * 100}%`; await sleep(250);
      }
      if (id === run) { await sleep(150); bar.classList.add("end"); }
      return id === run;
    };
    const stepOut = async (q) => {
      const id = ++run, box = bot();
      if (!(await stepsList(box, [["🌐", "stepping outside PB&J to look for you", "asking my outside friend"]], id))) return;
      const r = await stepOutside(q); if (id !== run) return;
      const ans = document.createElement("div"); ans.className = "as-answer"; box.append(ans);
      if (!r.ok) { ans.innerHTML = `<p>${r.reason === "not-connected" ? "I can't step outside PB&amp;J just yet, because my outside connection isn't switched on. Everything on PB&amp;J is still here for you." : "I couldn't reach outside PB&amp;J just now. Please try again in a bit."}</p>`; return; }
      ans.innerHTML = `<p class="as-tag">From outside PB&amp;J. Not checked by us, so double-check before you go.</p><p>${esc(r.answer)}</p>${r.items.length ? `<div class="fd-results">${r.items.map((it) => `<a class="fd-ev as-out" href="${esc(it.url || "#")}" target="_blank" rel="noopener"><span class="fd-thumb">${esc(String(it.title || "?").slice(0, 1))}</span><span class="fd-ev-t"><b>${esc(it.title || "")}</b><small>${esc(it.note || "")}</small></span></a>`).join("")}</div>` : ""}`;
    };
    const go = async (q) => {
      q = q.trim(); if (!q) return;
      const id = ++run; live(); first = false;
      const me = document.createElement("div"); me.className = "as-me"; me.textContent = q; res.append(me); me.scrollIntoView({ block: "nearest", behavior: "smooth" });
      clearPins(); shown = []; const box = bot();
      const { events, picks } = lookUp(q, places()), mine = searchPicks(q, places()), ws = words(q), areas = [...new Set(events.map((e) => e.area))];
      const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
      const rows = [["🔎", `scanning ${plural(upcoming().length, "upcoming event")} on PB&J`, `${events.length} look like a match`], ["📍", areas.length ? `checking ${areas.slice(0, 3).join(", ")}` : "checking the neighbourhoods", `${plural(areas.length, "neighbourhood")} in play`], ["👀", `looking for ${ws.slice(0, 4).join(", ") || "anything fun"}`, `found ${plural(events.length, "event")}`], ["💛", "matching it with your saves", mine.length ? `${plural(mine.length, "pick")} of yours fit` : "nothing saved for this yet"]];
      if (!(await stepsList(box, rows, id))) return;
      const ans = document.createElement("div"); ans.className = "as-answer fs-card"; box.append(ans);
      if (events.length) {
        const main = events.length > 4 ? events.slice(0, 3) : events, rest = events.slice(main.length); shown = events.slice();
        ans.innerHTML = `<h2 class="fs-h">${esc(q)}</h2>${main.map((e, i) => evBig(e, i + 1)).join("")}
          <div class="fs-help"><span>Was this helpful?</span><button type="button" class="fs-th" data-th="up" aria-label="Yes">${ic("thumb", "1.4em")}</button><button type="button" class="fs-th dn" data-th="down" aria-label="No">${ic("thumb", "1.4em")}</button></div>
          ${rest.length ? `<details class="fs-more"><summary>${plural(rest.length, "more event")} we considered</summary><div class="fd-results">${rest.map((e, i) => evBig(e, main.length + i + 1)).join("")}</div></details>` : ""}
          <button type="button" class="btn fs-find" data-find>find more</button>`;
        addPins(events); flyTo(fitView(pins.map((p) => [p.x, p.y]))); setChips(events, q);
        ans.querySelectorAll("[data-th]").forEach((b) => b.addEventListener("click", () => { ans.querySelectorAll("[data-th]").forEach((x) => x.classList.toggle("on", x === b)); toast(b.dataset.th === "up" ? "Thanks! FUN will remember that" : "Noted. Try asking it another way"); }));
        const find = ans.querySelector("[data-find]");
        if (!upcoming().some((x) => !shown.includes(x))) find.textContent = "look beyond PB&J"; // nothing left here, so the button goes further out
        find.addEventListener("click", () => {
          const more = upcoming().filter((x) => !shown.includes(x));
          if (!more.length) { find.disabled = true; stepOut(q); return; }
          const from = shown.length + 1; shown = shown.concat(more); find.insertAdjacentHTML("beforebegin", `<h2 class="fs-h">more fun around Mumbai</h2>${more.map((x, i) => evBig(x, from + i)).join("")}`);
          addPins(more, from); flyTo(fitView(pins.map((p) => [p.x, p.y]))); find.textContent = "look beyond PB&J";
        });
      } else if (picks.length) {
        ans.innerHTML = `<p>Nothing new on PB&amp;J for that, but you have ${plural(picks.length, "pick")} that match.</p><div class="fd-results">${picks.map((p) => `<div class="fd-ev"><span class="fd-thumb">${esc(p.title.slice(0, 1))}</span><span class="fd-ev-t"><b>${esc(p.title)}</b><em>${esc(LISTNAME[p.list] || "Saved")}</em><small>${esc(p.area)}</small></span><span></span></div>`).join("")}</div>`; setChips([], q);
      } else {
        ans.innerHTML = `<p>I couldn't find anything for “${esc(q)}” on PB&amp;J yet. Would you like to try something else, or should I step out of the zone to fetch what you need?</p><div class="as-btns"><button type="button" class="btn small ghost" data-else>Try something else</button><button type="button" class="btn small" data-out>Step out of the zone</button></div>`;
        ans.querySelector("[data-else]").addEventListener("click", (e) => { e.currentTarget.parentElement.remove(); form.q.value = ""; form.q.focus(); });
        ans.querySelector("[data-out]").addEventListener("click", (e) => { e.currentTarget.parentElement.remove(); stepOut(q); });
        setChips([], q);
      }
      ans.scrollIntoView({ block: "start", behavior: "smooth" });
    };
    form.addEventListener("submit", (e) => { e.preventDefault(); const q = form.q.value; form.q.value = ""; go(q); });
    fs.addEventListener("click", (e) => { const b = e.target.closest("[data-idea]"); if (b) { form.q.value = ""; go(b.dataset.idea); } });
    addEventListener("resize", () => { if (fs.isConnected && fs.classList.contains("live")) paint(fitView(pins.map((p) => [p.x, p.y]))); });
    if (q0) go(q0);
  }

  /* ---------- Someone's profile (opens from any name or photo in the thread) ---------- */
  const ptab = {};
  function renderPerson(slug) {
    const h = "@" + slug, pe = personBy(h);
    if (!pe) { document.title = "Not found — PeanutButterJelly.vip"; app.innerHTML = `<a class="back" href="#/">← Back</a><section class="sp-card msg-empty"><h2>We couldn't find that person</h2><p class="sp-sub">They may have changed their handle.</p><a class="btn" href="#/">Back to the thread</a></section>`; return; }
    document.title = `${pe.name} — PeanutButterJelly.vip`;
    const hosted = hostedOf(pe), att = attendedOf(pe), up = hosted.filter((e) => !isPast(e)), past = hosted.filter(isPast);
    const posts = POSTS.filter((po) => po.by === h), view = ptab[h] || (posts.length ? "posts" : hosted.length ? "hosted" : "attended"), on = isF(h), plans = posts.filter((po) => po.plan);
    const sect = (t, rows) => rows.length ? `<h3 class="pe-h">${t}</h3><div class="fd-results">${rows.map(evRow).join("")}</div>` : "";
    app.innerHTML = `<a class="back" href="#/">← Back to the thread</a><div class="pe-cols"><div class="pe-left">
      <section class="sp-card sp-head pe-head"><div class="pe-av">${bread({ name: pe.name })}</div><div class="pe-info">
        <div class="sp-name"><h1 class="cut">${esc(pe.name)}</h1></div>
        <div class="sp-idrow"><p class="sp-handle">${esc(pe.handle)}</p>${bdg(pe.badge)}</div>
        <div class="sp-counts pe-counts"><div><b>${hosted.length}</b><span>hosted</span></div><div><b>${att.length}</b><span>attended</span></div><div><b data-fc="${esc(h)}">${pe.followers + (on ? 1 : 0)}</b><span>followers</span></div><div><b>${pe.following}</b><span>following</span></div></div>
        <p class="sp-bio">${esc(pe.bio)}</p><p class="sp-meta">${esc(pe.area)}, Mumbai · joined ${esc(pe.joined)}</p>
        <div class="pe-btns">${fBtn(h, "big")}<button type="button" class="btn small ghost" data-soon="Messages are coming soon">Message</button></div></div></section></div><div class="pe-right">
      <div class="pe-seg" role="tablist"><button type="button" role="tab" class="${view === "posts" ? "on" : ""}" data-pt="posts" aria-selected="${view === "posts"}">Posts <b>${posts.length}</b></button><button type="button" role="tab" class="${view === "hosted" ? "on" : ""}" data-pt="hosted" aria-selected="${view === "hosted"}">Hosted <b>${hosted.length}</b></button><button type="button" role="tab" class="${view === "attended" ? "on" : ""}" data-pt="attended" aria-selected="${view === "attended"}">Attended <b>${att.length}</b></button></div>
      <div class="pe-list">${view === "posts"
        ? (posts.length ? `<div class="pe-posts">${thread(posts)}</div>` : `<div class="empty"><h2>No posts yet</h2><p>${esc(pe.name)} hasn't posted anything yet.</p></div>`)
        : view === "hosted"
        ? (hosted.length ? sect("Coming up", up) + sect("Past events", past) : `<div class="empty"><h2>No events hosted yet</h2><p>${esc(pe.name)} hasn't hosted anything yet. Check out what they went to.</p></div>`) + (plans.length ? `<h3 class="pe-h">Open plans</h3>${plans.map((po) => planCard(po)).join("")}` : "")
        : (att.length ? `<div class="fd-results">${att.map(evRow).join("")}</div>` : `<div class="empty"><h2>Nothing attended yet</h2><p>Events ${esc(pe.name)} goes to will show up here.</p></div>`)}</div></div></div>`;
    app.querySelectorAll("[data-pt]").forEach((b) => b.addEventListener("click", () => { ptab[h] = b.dataset.pt; renderPerson(slug); }));
  }

  /* ---------- Messages ---------- */
  function renderMessages() {
    document.title = "Messages — PeanutButterJelly.vip";
    const name = (k.profile().name || "you").toLowerCase();
    app.innerHTML = `<header class="fd-top msg"><span></span><h1 class="cut">${esc(name)}</h1><button type="button" class="sp-ico" data-people aria-label="Find people">${ic("userplus", "1.3em")}</button></header>
      <button type="button" class="msg-banner" data-soon="Group chats are coming soon"><span class="msg-bub">we're planning a fun dinner, where should we go?</span><b>text PB&amp;J in group chats &amp; make plans together</b></button>
      <h2 class="fd-h cut">Messages</h2>
      <section class="sp-card msg-empty">${ic("chat", "3.4em")}<h2>No conversations yet</h2><p class="sp-sub">Start a chat with your friends</p><button type="button" class="btn" data-people>Start a conversation</button></section>`;
    app.querySelectorAll("[data-people]").forEach((b) => b.addEventListener("click", openPeople));
  }

  /* ---------- "+" menu ---------- */
  function openPlus(done) {
    const rows = [["circlePlus", "create a post", "post"], ["list", "create a list", "Lists are coming soon"], ["collab", "collaborative list", "Collaborative lists are coming soon"], ["tray", "import from Instagram & YouTube", "Imports are coming soon"], ["pin", "import from Google Maps", "Imports are coming soon"], ["doc", "import docs, notes & texts", "Imports are coming soon"]];
    const back = document.createElement("div"); back.className = "pl-back";
    back.innerHTML = `<div class="pl-sheet" role="menu">${rows.map(([i, t, a], n) => `<button type="button" role="menuitem" data-a="${esc(a)}" style="--n:${n}">${ic(i, "1.6em")}<span>${esc(t)}</span></button>`).join("")}</div>`;
    const close = () => { document.removeEventListener("keydown", onKey); back.classList.remove("show"); setTimeout(() => back.remove(), 220); done?.(); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    back.addEventListener("click", (e) => {
      const b = e.target.closest("[data-a]");
      if (b) { close(); if (b.dataset.a === "post") { location.hash = "#/profile"; setTimeout(() => { const i = document.querySelector("#sp-add input"); i?.scrollIntoView({ block: "center" }); i?.focus(); }, 80); } else toast(b.dataset.a); }
      else close();
    });
    document.body.append(back); requestAnimationFrame(() => back.classList.add("show"));
    return close;
  }

  wire(app);
  const ev = initEvents({ ...k, ic, when, PAPER, KINDS, bdg, fBtn, places, writePlaces });
  return { renderFeed, renderSearch, renderPerson, renderMessages, openPlus, ic, ev };
}
