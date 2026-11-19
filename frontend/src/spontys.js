// Spontys dashboard (first slice): profile, six list tiles, edit profile and settings, in the style of Corner's profile (see INSPIRATION.md).
// Nothing is sent anywhere yet: everything is kept in this browser (localStorage) until accounts and a database exist.
import { initScreens, ICONS } from "./spontysScreens.js";
import { BADGES, BADGE_ORDER } from "./people.js";
import { createCutLetter } from "./cutword.js";
const app = document.getElementById("app");
const PROFILE = "pbj-sponty-profile", PLACES = "pbj-sponty-places", PREFS = "pbj-sponty-prefs";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { toast("Couldn't save. Try a smaller photo."); } };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  all: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  want: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  fav: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  rec: '<path d="M7 11v9H3v-9zM7 11l4-8c2 0 3 1 3 3v3h5a2 2 0 0 1 2 2l-1.5 7a2 2 0 0 1-2 1.6H7"/>',
  okay: '<circle cx="12" cy="12" r="9"/><path d="M8 15h8M9 9.5h.01M15 9.5h.01"/>',
  no: '<path d="M17 13V4h4v9zM17 13l-4 8c-2 0-3-1-3-3v-3H5a2 2 0 0 1-2-2l1.5-7A2 2 0 0 1 6.5 4H17"/>',
  tick: '<path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z"/><path d="M13 5v3M13 11v2M13 16v3"/>',
  share: '<path d="M12 15V3M8 7l4-4 4 4M5 12v8h14v-8"/>',
  dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  pen: '<path d="M12 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7"/><path d="M18.4 2.6a2 2 0 0 1 3 3L12 15l-4 1 1-4z"/>',
};
// Tiles: Corner's six, renamed for events and hidden gems. "all" shows everything.
const TILES = [
  ["all", "All", "all"], ["want", "Want to go", "want"], ["going", "Going", "tick"],
  ["fav", "Favorites", "fav"], ["rec", "Recommend", "rec"], ["okay", "Okay", "okay"], ["no", "Not for me", "no"],
];
const AREAS = ["Bandra West", "Bandra East", "Khar", "Juhu", "Andheri", "Colaba", "Fort", "Lower Parel", "Worli", "Powai", "Versova", "Dadar", "Matunga", "Kala Ghoda", "Other"];


// Profile photo in the outline of a bread slice (the photo is clipped to the slice; no photo shows the initial on a bread-coloured slice)
const BREAD = "M50 0C28 0 10 6 4 16C-1 24-1 32 3 37C5.5 40 6.5 42 5.5 44C3.5 47 3.5 55 3.6 70L3.6 91C3.6 97 6 99.6 12 99.6L88 99.6C94 99.6 96.4 97 96.4 91L96.4 70C96.5 55 96.5 47 94.5 44C93.5 42 94.5 40 97 37C101 32 101 24 96 16C90 6 72 0 50 0Z";
const bread = (p, id = "") => `<div class="sp-avatar" ${id ? `id="${id}"` : ""} role="img" aria-label="Profile photo"><svg viewBox="-3 -3 106 106" preserveAspectRatio="none"><defs><clipPath id="breadclip"><path d="${BREAD}"/></clipPath></defs><path class="crumb" d="${BREAD}"/>${p.photo ? `<image href="${p.photo}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" clip-path="url(#breadclip)"/>` : `<text x="50" y="62">${esc((p.name || "?").slice(0, 1))}</text>`}<path class="edge" d="${BREAD}"/></svg></div>`;

const profile = () => ({ badge: "vibes", name: "", handle: "", cities: "Mumbai", bio: "", instagram: "", youtube: "", x: "", birthday: "", photo: "", ...read(PROFILE, {}) });
const places = () => read(PLACES, []);
const prefs = () => ({ pushes: true, reminders: true, friends: true, publicProfile: true, showGoing: true, ...read(PREFS, {}) });
const newId = () => "p" + Date.now().toString(36);

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, 2200);
}


/* ---------- Drop-down menus in the website's own style (same card, bounce-in and peanut highlight as the top bar's [ WHO ARE YOU ] menu) ---------- */
function enhanceSelects(root) {
  root.querySelectorAll("select").forEach((sel) => {
    const wrap = document.createElement("div");
    wrap.className = "dd " + (sel.classList.contains("sp-in") ? "dd-field" : "pill");
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "dd-btn"; btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", sel.getAttribute("aria-label") || "Choose");
    const menu = document.createElement("ul");
    menu.className = "dd-menu"; menu.setAttribute("role", "listbox"); menu.hidden = true;
    const paint = () => {
      btn.innerHTML = `<span>${esc(sel.selectedOptions[0]?.textContent || "")}</span>${svg('<path d="m6 9 6 6 6-6"/>')}`;
      menu.innerHTML = [...sel.options].map((o) => `<li><button type="button" role="option" data-v="${esc(o.value)}" class="${o.selected ? "on" : ""}" aria-selected="${o.selected}"><span>${esc(o.textContent)}</span>${o.selected ? "<b aria-hidden=\"true\">✓</b>" : ""}</button></li>`).join("");
    };
    const close = () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); wrap.classList.remove("open"); };
    const open = () => {
      document.dispatchEvent(new CustomEvent("sp-dd-close"));
      menu.hidden = false; btn.setAttribute("aria-expanded", "true"); wrap.classList.add("open");
      const r = menu.getBoundingClientRect(); // flip upwards when there is no room below
      wrap.classList.toggle("up", r.bottom > innerHeight - 8 && btn.getBoundingClientRect().top > r.height + 16);
      menu.querySelector(".on")?.scrollIntoView({ block: "nearest" });
    };
    btn.addEventListener("click", (e) => { e.stopPropagation(); menu.hidden ? open() : close(); });
    menu.addEventListener("click", (e) => {
      e.stopPropagation();
      const b = e.target.closest("button[data-v]"); if (!b) return;
      sel.value = b.dataset.v; paint(); close(); btn.focus();
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    wrap.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { close(); btn.focus(); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); if (menu.hidden) open();
        const items = [...menu.querySelectorAll("button")], i = items.indexOf(document.activeElement);
        items[Math.max(0, Math.min(items.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))].focus();
      }
    });
    document.addEventListener("click", close);
    document.addEventListener("sp-dd-close", close);
    sel.hidden = true; sel.before(wrap); wrap.append(btn, menu, sel); paint();
  });
}


/* Crop window: drag to move the picture, slider / scroll wheel / two-finger pinch to zoom, inside the same toast frame as the profile.
   Resolves to the cropped picture (a JPEG data URL), or null when cancelled. */
function cropper(img) {
  return new Promise((resolve) => {
    const back = document.createElement("div");
    back.className = "sp-lb sp-crop show";
    back.innerHTML = `<div class="sp-crop-card" role="dialog" aria-modal="true" aria-label="Adjust your photo">
      <h2>Adjust your photo</h2><p class="sp-sub">Drag to move it. Zoom to fit the toast.</p>
      <div class="sp-stage" id="cs"><img alt="" draggable="false" /><svg viewBox="-3 -3 106 106" preserveAspectRatio="none" aria-hidden="true"><path class="dim" fill-rule="evenodd" d="M-3 -3H103V103H-3Z ${BREAD}"/><path class="edge" d="${BREAD}"/></svg></div>
      <label class="sp-zoomrow">Zoom<input type="range" min="1" max="4" step="0.01" value="1" id="cz" aria-label="Zoom" /></label>
      <div class="sp-crop-btns"><button type="button" class="btn ghost small" data-no>Cancel</button><button type="button" class="btn small" data-yes>Use photo</button></div></div>`;
    document.body.append(back);
    const stage = back.querySelector("#cs"), pic = stage.querySelector("img"), zoomEl = back.querySelector("#cz");
    pic.src = img.src;
    const W = stage.clientWidth, H = stage.clientHeight;
    const base = Math.max(W / img.naturalWidth, H / img.naturalHeight); // smallest size that still covers the frame
    let zoom = 1, ox = 0, oy = 0;
    const clamp = () => {
      const sc = base * zoom, mx = Math.max(0, (img.naturalWidth * sc - W) / 2), my = Math.max(0, (img.naturalHeight * sc - H) / 2);
      ox = Math.max(-mx, Math.min(mx, ox)); oy = Math.max(-my, Math.min(my, oy));
    };
    const paint = () => {
      clamp();
      const sc = base * zoom;
      pic.style.width = img.naturalWidth * sc + "px"; pic.style.height = img.naturalHeight * sc + "px";
      pic.style.transform = `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px))`;
      zoomEl.value = zoom;
    };
    const setZoom = (z) => { zoom = Math.max(1, Math.min(4, z)); paint(); };
    zoomEl.addEventListener("input", () => setZoom(+zoomEl.value));
    stage.addEventListener("wheel", (e) => { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); }, { passive: false });
    // drag with one finger or the mouse; pinch with two
    const pts = new Map(); let pinch = 0;
    stage.addEventListener("pointerdown", (e) => { stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); pinch = 0; stage.classList.add("grab"); });
    stage.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch) setZoom(zoom * (d / pinch)); pinch = d;
      } else { ox += e.clientX - prev[0]; oy += e.clientY - prev[1]; paint(); }
    });
    const up = (e) => { pts.delete(e.pointerId); pinch = 0; if (!pts.size) stage.classList.remove("grab"); };
    stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
    const finish = (v) => { document.removeEventListener("keydown", onKey); back.remove(); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") finish(null); };
    document.addEventListener("keydown", onKey);
    back.querySelector("[data-no]").addEventListener("click", () => finish(null));
    back.addEventListener("click", (e) => { if (e.target === back) finish(null); });
    back.querySelector("[data-yes]").addEventListener("click", () => {
      const sc = base * zoom, sw = W / sc, sh = H / sc;
      const sx = img.naturalWidth / 2 - ox / sc - sw / 2, sy = img.naturalHeight / 2 - oy / sc - sh / 2;
      const outW = Math.min(900, Math.round(sw)), outH = Math.round(outW * H / W); // never bigger than the real picture
      const c = document.createElement("canvas"); c.width = outW; c.height = outH;
      c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
      finish(c.toDataURL("image/jpeg", 0.88));
    });
    paint();
    back.querySelector("[data-yes]").focus();
  });
}

/* Tap the photo to see it large and clear (tap anywhere or press Esc to close) */
function lightbox(src, name) {
  const back = document.createElement("div");
  back.className = "sp-lb";
  back.innerHTML = `<button type="button" class="sp-lb-x" aria-label="Close">×</button><img src="${src}" alt="${esc(name || "Profile photo")}" />`;
  const done = () => { document.removeEventListener("keydown", onKey); back.classList.remove("show"); setTimeout(() => back.remove(), 250); };
  const onKey = (e) => { if (e.key === "Escape") done(); };
  document.addEventListener("keydown", onKey);
  back.addEventListener("click", done);
  document.body.append(back);
  requestAnimationFrame(() => back.classList.add("show"));
}

/* ---------- Profile ---------- */
let tile = "all", pview = "saved";
function renderProfile() {
  document.title = "My Profile — PeanutButterJelly.vip";
  const p = profile(), list = places();
  const count = (k) => (k === "all" ? list.length : list.filter((x) => x.list === k).length);
  const shown = tile === "all" ? list : list.filter((x) => x.list === tile);
  const handle = (p.handle || p.name || "you").toLowerCase().replace(/[^a-z0-9_]/g, "");
  const complete = p.name && p.bio && p.photo;
  app.innerHTML = `
    <section class="sp-card sp-head">
      ${p.photo ? `<button type="button" class="sp-zoom" id="sp-zoom" aria-label="View photo larger">${bread(p)}</button>` : `<a class="sp-zoom" href="#/edit" aria-label="Add a photo">${bread(p)}</a>`}
      <div>
        <div class="sp-name"><h1 class="cut">${esc(p.name || "Your name")}</h1>
          <div class="sp-icons"><button class="sp-ico" id="sp-share" aria-label="Share profile">${svg(I.share)}</button><a class="sp-ico" href="#/edit" aria-label="Edit profile">${svg(I.pen)}</a><a class="sp-ico" href="#/settings" aria-label="Settings">${svg(I.dots)}</a></div></div>
        <div class="sp-idrow"><p class="sp-handle">@${esc(handle)}</p><span class="bd bd-${p.badge}">${esc((BADGES[p.badge] || BADGES.vibes).label)}</span></div>
        <div class="sp-counts"><div><b>${list.length}</b><span>events</span></div><div><b>${read("pbj-sponty-follow", []).length || 1}</b><span>following</span></div><div><b>0</b><span>followers</span></div></div>
        ${p.bio ? `<p class="sp-bio">${esc(p.bio)}</p>` : ""}<p class="sp-meta">${esc(p.cities)}</p>
        ${complete ? "" : `<div class="sp-nudge"><a class="btn" href="#/edit">Complete your profile</a></div>`}
      </div>
    </section>
    <div class="pe-seg" role="tablist">${[["saved", "Saved", list.length], ["attended", "Attended", screens.ev.counts().attended], ["hosted", "Hosted", screens.ev.counts().hosted]].map(([k, l, n]) => `<button type="button" role="tab" class="${pview === k ? "on" : ""}" data-pv="${k}" aria-selected="${pview === k}">${l} <b>${n}</b></button>`).join("")}</div>
    ${pview === "saved" ? "" : screens.ev.ownTab(pview)}
    <div class="sp-tiles" role="tablist" ${pview === "saved" ? "" : "hidden"}>${TILES.map(([k, label, ico]) => `<button type="button" class="sp-tile ${tile === k ? "on" : ""}" data-tile="${k}" role="tab" aria-selected="${tile === k}">${svg(I[ico])}<b>${count(k)}</b><span>${label}</span></button>`).join("")}</div>
    <div class="sp-soon" aria-label="Coming soon"><span class="chip">Import from Instagram Reels &amp; YouTube Shorts · soon</span><span class="chip">Import Google Maps list · soon</span><span class="chip">Friends · soon</span><span class="chip">Map · soon</span></div>
    <div class="sp-bar"><h2 class="cut">${tile === "all" ? "Your events &amp; gems" : esc(TILES.find((t) => t[0] === tile)[1])}</h2></div>
    <form class="sp-add" id="sp-add" novalidate><input class="sp-in" name="title" placeholder="Event or hidden gem" aria-label="Event or hidden gem" autocomplete="off" />
      <select class="sp-in" name="area" aria-label="Area">${AREAS.map((a) => `<option>${a}</option>`).join("")}</select><button class="btn small" type="submit">+ Add</button></form>
    <div class="sp-posts">${shown.length ? shown.map((x) => `<article class="sp-post" data-id="${x.id}"><div class="pic">${esc(x.title.slice(0, 1).toUpperCase())}</div>
      <div><h3>${esc(x.title)}</h3><p>${esc(x.area)}</p></div>
      <div class="side"><select aria-label="List">${TILES.filter((t) => t[0] !== "all").map(([k, l]) => `<option value="${k}" ${x.list === k ? "selected" : ""}>${l}</option>`).join("")}</select><button class="x" aria-label="Remove">×</button></div></article>`).join("")
      : `<div class="empty"><h2>Nothing here yet</h2><p>${tile === "all" ? "Add the events and hidden gems you want to try, then sort them into your lists." : "Nothing in this list yet. Move something here from another list."}</p></div>`}</div>`;
  enhanceSelects(app);
  if (pview !== "saved") app.querySelectorAll(".sp-soon, .sp-bar, .sp-add, .sp-posts").forEach((n) => { n.hidden = true; });
  if (pview !== "saved") screens.ev.bindOwn(app, renderProfile);
  app.querySelectorAll("[data-pv]").forEach((b) => b.addEventListener("click", () => { pview = b.dataset.pv; renderProfile(); }));
  app.querySelector("#sp-zoom")?.addEventListener("click", () => lightbox(p.photo, p.name));
  app.querySelectorAll("[data-tile]").forEach((b) => b.addEventListener("click", () => { tile = b.dataset.tile; renderProfile(); }));
  app.querySelector("#sp-add").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target), title = String(f.get("title")).trim();
    if (!title) { const fm = e.target; fm.classList.remove("bad"); void fm.offsetWidth; fm.classList.add("bad"); fm.title.focus(); return; }
    write(PLACES, [{ id: newId(), title, area: f.get("area"), list: tile === "all" ? "want" : tile }, ...places()]);
    renderProfile();
  });
  app.querySelectorAll(".sp-post").forEach((row) => {
    row.querySelector("select").addEventListener("change", (e) => { write(PLACES, places().map((x) => (x.id === row.dataset.id ? { ...x, list: e.target.value } : x))); renderProfile(); });
    row.querySelector(".x").addEventListener("click", () => { write(PLACES, places().filter((x) => x.id !== row.dataset.id)); renderProfile(); });
  });
  app.querySelector("#sp-share").addEventListener("click", async () => {
    const url = location.origin + location.pathname + "#/u/" + handle;
    try { if (navigator.share) await navigator.share({ title: "My PB&J profile", url }); else { await navigator.clipboard.writeText(url); toast("Link copied"); } } catch {}
  });
}

/* ---------- Edit profile ---------- */
function renderEdit() {
  document.title = "Edit profile — PeanutButterJelly.vip";
  const p = profile();
  const field = (name, label, ph = "", type = "text") => `<label>${label}<input name="${name}" type="${type}" value="${esc(p[name])}" placeholder="${ph}" autocomplete="off" /></label>`;
  app.innerHTML = `<a class="back" href="#/profile">← Back to profile</a><div class="sp-bar"><h1 class="cut">Edit profile</h1></div>
    <form class="sp-card sp-form" id="sp-edit">
      <div class="sp-photo"><label>${bread(p, "sp-pre")}<span class="pen">${svg(I.pen)}</span><input type="file" accept="image/*" id="sp-file" /></label></div>
      ${field("name", "Name", "Your name")}${field("handle", "@", "handle")}${field("cities", "Areas", "Mumbai, Bandra…")}
      <label>Bio<textarea name="bio" maxlength="200" placeholder="A line about you">${esc(p.bio)}</textarea></label><p class="sp-count" id="sp-cnt">${p.bio.length}/200</p>
      <fieldset class="bd-pick"><legend>Your badge</legend><p class="sp-sub">Pick the one that fits you. It shows next to your name everywhere.</p>
        ${BADGE_ORDER.map((k) => `<label class="bd-opt ${p.badge === k ? "on" : ""}"><input type="radio" name="badge" value="${k}" ${p.badge === k ? "checked" : ""} /><span class="bd bd-${k}">${esc(BADGES[k].label)}</span><small>${esc(BADGES[k].blurb)}</small></label>`).join("")}</fieldset>
      ${field("instagram", "Instagram", "@")}${field("youtube", "YouTube", "@")}${field("x", "X", "@")}
      <div class="sp-save"><button class="btn dark" type="submit">Save</button></div></form>`;
  app.querySelectorAll(".bd-opt input").forEach((r) => r.addEventListener("change", () => app.querySelectorAll(".bd-opt").forEach((l) => l.classList.toggle("on", l.contains(r) && r.checked))));
  const bioEl = app.querySelector("textarea");
  bioEl.addEventListener("input", () => { app.querySelector("#sp-cnt").textContent = bioEl.value.length + "/200"; });
  let photo = p.photo;
  app.querySelector("#sp-file").addEventListener("change", (e) => {
    const file = e.target.files[0]; if (!file) return;
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = async () => {
      const out = await cropper(img); // the visitor moves and zooms the picture inside the toast frame
      URL.revokeObjectURL(url);
      e.target.value = ""; // so picking the same file again still works
      if (!out) return;
      photo = out;
      const pre = app.querySelector("#sp-pre"); pre.outerHTML = bread({ ...p, photo }, "sp-pre");
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast("That file couldn't be opened as a picture"); };
    img.src = url;
  });
  app.querySelector("#sp-edit").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    f.handle = String(f.handle).toLowerCase().replace(/[^a-z0-9_]/g, "");
    write(PROFILE, { ...profile(), ...f, photo });
    toast("Saved"); location.hash = "#/profile";
  });
}

/* ---------- Settings ---------- */
function renderSettings() {
  document.title = "Settings — PeanutButterJelly.vip";
  const p = profile(), pr = prefs();
  const sw = (k, label, sub) => `<div class="sp-row"><div><b>${label}</b><p class="sp-sub">${sub}</p></div><button type="button" class="sp-switch" role="switch" aria-checked="${pr[k]}" aria-label="${label}" data-pref="${k}"></button></div>`;
  app.innerHTML = `<div class="sp-bar"><h1 class="cut">Settings</h1></div><div class="sp-list">
    <a class="sp-link" href="#/edit">Edit profile</a>
    <div class="sp-row"><div><small>Birthday</small><input id="sp-bday" class="sp-in" type="date" value="${esc(p.birthday)}" aria-label="Birthday" /></div></div>
    <h2 class="sp-group cut">Notifications</h2>
    ${sw("pushes", "Event alerts", "New events near you in Mumbai")}${sw("reminders", "Reminders", "A nudge before events you're going to")}${sw("friends", "Friends activity", "When people you follow save or go to something")}
    <h2 class="sp-group cut">Privacy</h2>
    ${sw("publicProfile", "Public profile", "Anyone with your link can see it")}${sw("showGoing", "Show events I'm going to", "Visible on your profile")}
    <h2 class="sp-group cut">Help</h2>
    <a class="sp-link" href="mailto:hello@peanutbutterjelly.vip?subject=PB%26J%20feedback">Send feedback</a>
    <a class="sp-link" href="mailto:hello@peanutbutterjelly.vip?subject=Contact%20PB%26J">Contact us</a>
    <button class="sp-link" id="sp-legal" type="button">Legal</button>
    <button class="sp-link" id="sp-out" type="button">Sign out</button>
    <button class="sp-link danger" id="sp-del" type="button">Delete account</button></div>`;
  app.querySelector("#sp-bday").addEventListener("change", (e) => { write(PROFILE, { ...profile(), birthday: e.target.value }); toast("Saved"); });
  app.querySelectorAll("[data-pref]").forEach((b) => b.addEventListener("click", () => {
    const on = b.getAttribute("aria-checked") !== "true"; b.setAttribute("aria-checked", String(on));
    write(PREFS, { ...prefs(), [b.dataset.pref]: on });
  }));
  app.querySelector("#sp-legal").addEventListener("click", () => toast("Legal pages are coming soon"));
  app.querySelector("#sp-out").addEventListener("click", () => toast("Sign in comes with accounts, soon"));
  const del = app.querySelector("#sp-del");
  del.addEventListener("click", () => {
    if (del.dataset.sure) { [PROFILE, PLACES, PREFS].forEach((k) => { try { localStorage.removeItem(k); } catch {} }); toast("Everything cleared"); location.hash = "#/profile"; route(); }
    else { del.dataset.sure = "1"; del.textContent = "Tap again to delete everything"; setTimeout(() => { delete del.dataset.sure; del.textContent = "Delete account"; }, 4000); }
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
      w.className = "w"; w.setAttribute("aria-hidden", "true");
      [...word].forEach((ch) => {
        const letter = createCutLetter(ch, { fill: h.dataset.fill || "var(--pop)", shadow: h.dataset.shadow || "var(--brown)" });
        if (letter) { (root === app ? cutLetters : made).push(letter); w.append(letter.el); } else w.append(document.createTextNode(ch));
      });
      h.append(w);
      if (i < all.length - 1) h.append(" ");
    });
  });
  return made;
}
// Whenever a screen replaces the page's content, the old letters are let go and the new headings are cut
new MutationObserver(() => { cutLetters.forEach((l) => l.dispose()); cutLetters = []; cutHeadings(app); }).observe(app, { childList: true });

const screens = initScreens({ cut: cutHeadings, app, esc, svg, toast, bread, places, writePlaces: (v) => write(PLACES, v), newId, enhanceSelects, profile });

/* ---------- Bottom bar (For you, Map, Messages, Search, Profile) and the round "+" button ---------- */
const dock = document.createElement("nav");
dock.className = "sp-dock"; dock.setAttribute("aria-label", "Main");
const di = (n) => svg(ICONS[n]);
const refreshDock = () => {
  const p = profile();
  dock.innerHTML = `<div class="sp-pill"><a href="#/" data-r="feed" aria-label="For you">${di("people")}</a><a href="#/messages" data-r="messages" aria-label="Messages">${di("send")}</a><a href="#/search" data-r="search" aria-label="Search">${di("search")}</a><a href="#/profile" data-r="profile" class="me" aria-label="My profile">${bread(p)}</a></div><button type="button" class="sp-plus" id="sp-plus" aria-label="Create" aria-haspopup="menu">${di("plus")}</button>`;
  let closeMenu = null;
  dock.querySelector("#sp-plus").addEventListener("click", (e) => {
    const b = e.currentTarget;
    if (closeMenu) { closeMenu(); closeMenu = null; return; }
    b.classList.add("open"); closeMenu = screens.openPlus(() => { b.classList.remove("open"); closeMenu = null; });
  });
  markDock();
};
const markDock = () => {
  const h = location.hash, cur = h.startsWith("#/messages") ? "messages" : h.startsWith("#/search") ? "search" : h.startsWith("#/profile") || h.startsWith("#/edit") || h.startsWith("#/settings") ? "profile" : "feed";
  dock.querySelectorAll("[data-r]").forEach((a) => { a.classList.toggle("on", a.dataset.r === cur); a.toggleAttribute("aria-current", a.dataset.r === cur); });
};
document.body.append(dock);

function route() {
  const h = location.hash;
  const col = !(h.startsWith("#/profile") || h.startsWith("#/edit") || h.startsWith("#/settings"));
  app.classList.toggle("narrow", h.startsWith("#/edit") || h.startsWith("#/settings"));
  app.classList.toggle("col", col);
  app.classList.toggle("wide", h.startsWith("#/search"));
  app.classList.toggle("pwide", h.startsWith("#/u/"));
  app.classList.toggle("feedwide", !/^#\/(profile|edit|settings|messages|search|u\/|e\/|recap)/.test(h));
  if (h.startsWith("#/edit")) renderEdit();
  else if (h.startsWith("#/settings")) renderSettings();
  else if (h.startsWith("#/profile")) renderProfile();
  else if (h.startsWith("#/messages")) screens.renderMessages();
  else if (h.startsWith("#/e/")) screens.ev.renderEvent(decodeURIComponent(h.slice(4).split("?")[0]));
  else if (h.startsWith("#/recap")) screens.ev.renderRecapForm();
  else if (h.startsWith("#/u/")) screens.renderPerson(decodeURIComponent(h.slice(4).split("?")[0]));
  else if (h.startsWith("#/search")) screens.renderSearch(decodeURIComponent((h.split("?q=")[1] || "")));
  else screens.renderFeed();
  refreshDock();
  window.scrollTo({ top: 0 });
}
const setHdr = () => document.documentElement.style.setProperty("--hdr", (document.querySelector(".dash-top")?.offsetHeight || 80) + "px");
window.addEventListener("resize", setHdr);
window.addEventListener("hashchange", route);
setHdr();
route();
