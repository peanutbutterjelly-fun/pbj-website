// Spontys: how events get onto a profile.
//   Attended: after an event, a person taps "I went", picks a mood and leaves a note. (Events they saved as Going ask "Did you go?" once the day has passed.)
//   Hosted:   a host writes the event up: details, how it went, and photos. Everyone can open it on an event page and browse it.
// Everything is kept in this browser (localStorage) until accounts and a database exist. Photos are shrunk before they are saved.
import { EVENTS } from "./eventsData.js";
import { PAST, PEOPLE, BADGES, personBy, isPast, hostOfEvent } from "./people.js";

const ATT = "pbj-sponty-attended", REC = "pbj-sponty-recaps";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const MOODS = [["love", "🤩", "Loved it"], ["like", "🙂", "Liked it"], ["meh", "😐", "It was okay"]];
const CATS = [["music", "Music"], ["workshop", "Workshop"], ["comedy", "Comedy"], ["food", "Food"], ["art", "Art"], ["film", "Film"], ["games", "Games"], ["outdoors", "Outdoors"], ["market", "Market"], ["other", "Other"]];
const MAX_PHOTOS = 6;

const STEPS = {
  attended: [["Find a plan", "Save an event with the heart, or tap Going."], ["Go and have fun", "Once the day has passed, we ask \"Did you go?\" right here."], ["Say how it was", "Tap I went, pick a mood and leave a note. It lands on your profile for others to see."]],
  hosted: [["Host it", "Run your event or plan. Big or small, it counts."], ["Write it up", "Tap Add an event you hosted: the details, how it went, and your photos."], ["Let people browse", "Your recap gets its own page on your profile. Anyone can open it, see the photos and who came."]],
};

/** Shrinks a picked photo so a few of them fit in the browser's storage. Resolves to a JPEG data URL, or null. */
const shrink = (file) => new Promise((done) => {
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    const s = Math.min(1, 800 / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); done(c.toDataURL("image/jpeg", 0.72));
  };
  img.onerror = () => { URL.revokeObjectURL(url); done(null); };
  img.src = url;
});

export function initEvents(k) {
  const { app, esc, toast, bread, ic, when, PAPER, KINDS, bdg, fBtn, places, writePlaces, profile, enhanceSelects } = k;
  const attended = () => read(ATT, []), recaps = () => read(REC, []);
  const evId = (e) => e.id || "u" + EVENTS.findIndex((x) => x.title === e.title);
  const emoji = (e) => KINDS[e.kind] || "✨";
  const ink = (e) => (e.paper === "jam" || e.paper === "brown" ? "var(--cream)" : "var(--brown)");

  /** Any event by its id: a recap you wrote (r…), an event from the lineup (u…) or one that already happened (p…). */
  function find(id) {
    if (id.startsWith("r")) { const r = recaps().find((x) => x.id === id); return r && { ...r, paper: "sun", mine: true, host: "me" }; }
    if (id.startsWith("u")) { const e = EVENTS[+id.slice(1)]; return e && { ...e, id, host: hostOfEvent(e) }; }
    return PAST.find((e) => e.id === id);
  }
  const thumb = (e) => (e.photos?.length ? `<span class="fd-thumb ph" style="background-image:url(${e.photos[0]})"></span>` : `<span class="fd-thumb" style="background:${PAPER[e.paper] || "var(--bread)"};color:${ink(e)}">${emoji(e)}</span>`);
  const row = (e, tag = "", sub = "") => `<a class="fd-ev pe-ev" href="#/e/${esc(evId(e))}">${thumb(e)}<span class="fd-ev-t"><b>${esc(e.title)}</b><em>${esc(e.category || "Event")}</em><small>${esc(e.area || "")}${e.price ? " · " + esc(e.price) : ""} · ${when(e)}${sub}</small></span>${tag ? `<span class="pe-tag">${tag}</span>` : "<span></span>"}</a>`;
  const how = (kind, open) => `<details class="hw" ${open ? "open" : ""}><summary>How things get here</summary><ol>${STEPS[kind].map(([t, d]) => `<li><b>${t}</b><span>${d}</span></li>`).join("")}</ol></details>`;

  /* ---------- "I went": mood and a note ---------- */
  function openWent(id, after) {
    const e = find(id); if (!e) return;
    const cur = attended().find((a) => a.ref === id);
    const back = document.createElement("div"); back.className = "wd-back";
    back.innerHTML = `<form class="wd-card" role="dialog" aria-modal="true" aria-label="How was it?"><h2>How was it?</h2><p class="sp-sub">${esc(e.title)}</p>
      <div class="wd-moods">${MOODS.map(([m, em, l]) => `<label class="wd-mood ${(cur?.mood || "love") === m ? "on" : ""}"><input type="radio" name="mood" value="${m}" ${(cur?.mood || "love") === m ? "checked" : ""} /><span>${em}</span><small>${l}</small></label>`).join("")}</div>
      <label class="wd-note">A note for others (optional)<textarea name="note" maxlength="200" placeholder="What made it good?">${esc(cur?.note || "")}</textarea></label>
      <div class="wd-btns">${cur ? '<button type="button" class="btn small ghost" data-remove>Remove</button>' : '<button type="button" class="btn small ghost" data-cancel>Cancel</button>'}<button type="submit" class="btn small">${cur ? "Save" : "Add to attended"}</button></div></form>`;
    document.body.append(back);
    const close = () => { document.removeEventListener("keydown", onKey); back.classList.remove("show"); setTimeout(() => back.remove(), 200); };
    const onKey = (ev) => { if (ev.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    back.addEventListener("click", (ev) => { if (ev.target === back || ev.target.closest("[data-cancel]")) close(); });
    back.querySelectorAll(".wd-mood input").forEach((r) => r.addEventListener("change", () => back.querySelectorAll(".wd-mood").forEach((l) => l.classList.toggle("on", l.contains(r) && r.checked))));
    back.querySelector("[data-remove]")?.addEventListener("click", () => { save(ATT, attended().filter((a) => a.ref !== id)); toast("Removed from attended"); close(); after?.(); });
    back.querySelector("form").addEventListener("submit", (ev) => {
      ev.preventDefault(); const f = new FormData(ev.target);
      save(ATT, [{ ref: id, mood: f.get("mood"), note: String(f.get("note") || "").trim(), at: Date.now() }, ...attended().filter((a) => a.ref !== id)]);
      toast(cur ? "Saved" : "Added to your attended events"); close(); after?.();
    });
    requestAnimationFrame(() => { back.classList.add("show"); back.querySelector("textarea").focus({ preventScroll: true }); });
  }

  const viewPhoto = (src) => {
    const back = document.createElement("div"); back.className = "sp-lb";
    back.innerHTML = `<button type="button" class="sp-lb-x" aria-label="Close">×</button><img src="${src}" alt="Event photo" />`;
    const done = () => { document.removeEventListener("keydown", onKey); back.classList.remove("show"); setTimeout(() => back.remove(), 250); };
    const onKey = (ev) => { if (ev.key === "Escape") done(); };
    document.addEventListener("keydown", onKey); back.addEventListener("click", done);
    document.body.append(back); requestAnimationFrame(() => back.classList.add("show"));
  };

  /* ---------- Event page: details, the host's recap, who went ---------- */
  function renderEvent(id) {
    const e = find(id);
    if (!e) { document.title = "Not found — PeanutButterJelly.vip"; app.innerHTML = `<a class="back" href="#/">← Back</a><section class="sp-card msg-empty"><h2>We couldn't find that event</h2><p class="sp-sub">It may have been removed.</p><a class="btn" href="#/">Back to the thread</a></section>`; return; }
    document.title = `${e.title} — PeanutButterJelly.vip`;
    const past = isPast(e) || e.mine, mine = attended().find((a) => a.ref === id), host = e.mine ? null : personBy(e.host);
    const me = profile(), who = PEOPLE.filter((p) => p.attended.includes(id) || p.attended.includes(e.title));
    const recap = e.mine ? e : e.recap ? { summary: e.recap, best: e.best, photos: [] } : null;
    const went = (e.going || e.came || who.length) + (mine ? 1 : 0);
    const back = history.length > 1 ? "← Back" : "← Back to the thread";
    app.innerHTML = `<a class="back" href="#/" data-back>${back}</a>
      <section class="ep-hero" style="${e.photos?.length ? `background-image:url(${e.photos[0]})` : `background:${PAPER[e.paper] || "var(--bread)"};color:${ink(e)}`}"><span class="ep-emoji">${e.photos?.length ? "" : emoji(e)}</span><span class="ep-st">${past ? "Past event" : "Coming up"}</span></section>
      <header class="ep-head"><h1 class="cut">${esc(e.title)}</h1><p class="ep-meta">${when(e)}${e.time ? " · " + esc(e.time) : ""} · ${esc(e.area || "Mumbai")} · ${esc(e.price || "Free")}</p>
        <div class="ep-host">${e.mine ? `<a class="ep-hav" href="#/profile">${bread(me)}</a><span><b>${esc(me.name || "You")}</b><small>Hosted by you</small></span>` : host ? `<a class="ep-hav" href="#/u/${esc(host.handle.slice(1))}">${bread({ name: host.name })}</a><span><a class="th-name" href="#/u/${esc(host.handle.slice(1))}">${esc(host.name)}</a><small>${esc(host.handle)}</small>${bdg(host.badge)}</span>${fBtn(host.handle)}` : ""}</div></header>
      <div class="ep-acts">${past && e.mine ? "" : past ? `<button type="button" class="btn ${mine ? "ghost" : ""}" data-went="${esc(id)}">${mine ? "✓ You went" : "I went"}</button>` : `<button type="button" class="fd-rx big" data-rx-open="${esc(e.title)}" aria-haspopup="menu" aria-label="Love, like or be curious about this">${ic("heart", "1.5em")}</button>`}${e.mine ? '<a class="btn ghost" href="#/profile">Your profile</a><button type="button" class="btn ghost danger" data-del>Delete recap</button>' : ""}</div>
      ${mine ? `<section class="sp-card ep-mine"><b>${MOODS.find((m) => m[0] === mine.mood)?.[1] || ""} ${MOODS.find((m) => m[0] === mine.mood)?.[2] || ""}</b>${mine.note ? `<p>${esc(mine.note)}</p>` : ""}<button type="button" class="fd-link" data-went="${esc(id)}">edit your note</button></section>` : ""}
      ${e.blurb || e.details ? `<h2 class="ep-h">About</h2><p class="ep-text">${esc(e.details || e.blurb)}</p>` : ""}
      ${past ? `<h2 class="ep-h">How it went</h2>${recap ? `<p class="ep-text">${esc(recap.summary)}</p>${recap.best ? `<p class="ep-best">⭐ Best moment: ${esc(recap.best)}</p>` : ""}${recap.photos?.length ? `<div class="ep-gal">${recap.photos.map((p, i) => `<button type="button" data-ph="${i}" aria-label="Open photo"><img src="${p}" alt="" loading="lazy" /></button>`).join("")}</div>` : e.mine ? "" : `<p class="sp-sub">No photos from the host yet.</p>`}` : `<p class="sp-sub">The host hasn't written this one up yet.</p>`}` : ""}
      <h2 class="ep-h">${past ? "Who went" : "Who's interested"}</h2>
      <p class="ep-text">${went ? `${went} ${past ? "went" : "interested"}` : "Nobody yet. Be the first!"}</p>
      ${who.length ? `<div class="ep-who">${who.map((p) => `<a href="#/u/${esc(p.handle.slice(1))}" title="${esc(p.name)}">${bread({ name: p.name })}</a>`).join("")}</div>` : ""}`;
    app.querySelectorAll("[data-went]").forEach((b) => b.addEventListener("click", () => openWent(id, () => renderEvent(id))));
    app.querySelector("[data-back]")?.addEventListener("click", (ev) => { if (history.length > 1) { ev.preventDefault(); history.back(); } });
    app.querySelectorAll("[data-ph]").forEach((b) => b.addEventListener("click", () => viewPhoto(recap.photos[+b.dataset.ph])));
    const del = app.querySelector("[data-del]");
    del?.addEventListener("click", () => {
      if (del.dataset.sure) { save(REC, recaps().filter((r) => r.id !== id)); toast("Recap deleted"); location.hash = "#/profile"; }
      else { del.dataset.sure = "1"; del.textContent = "Tap again to delete"; setTimeout(() => { delete del.dataset.sure; del.textContent = "Delete recap"; }, 4000); }
    });
  }

  /* ---------- Hosted: write up an event ---------- */
  function renderRecapForm() {
    document.title = "Add an event you hosted — PeanutButterJelly.vip";
    let photos = [];
    app.innerHTML = `<a class="back" href="#/profile">← Back to profile</a><div class="sp-bar"><h1 class="cut">Add your event</h1></div>
      <p class="sp-sub rf-intro">Tell people what you hosted and how it went. It gets its own page on your profile.</p>
      <form class="sp-card sp-form" id="rf" novalidate>
        <label>Name<input name="title" placeholder="What was it called?" autocomplete="off" /></label>
        <label>Date<input name="date" type="date" max="${new Date().toISOString().slice(0, 10)}" /></label>
        <label>Where<input name="area" placeholder="Neighbourhood, e.g. Bandra West" autocomplete="off" /></label>
        <label>Price<input name="price" placeholder="Free, or ₹500" autocomplete="off" /></label>
        <label>Kind<select class="sp-in" name="category" aria-label="Kind of event">${CATS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
        <label>How many came<input name="came" type="number" min="0" placeholder="A rough number is fine" /></label>
        <label>About the event<textarea name="details" maxlength="400" placeholder="What was it, who was it for?"></textarea></label>
        <label>How it went<textarea name="summary" maxlength="800" placeholder="The vibe, what worked, what you'd change"></textarea></label>
        <label>Best moment<input name="best" maxlength="120" placeholder="One line" autocomplete="off" /></label>
        <div class="rf-photos"><b>Photos</b><p class="sp-sub">Up to ${MAX_PHOTOS}. They are shrunk to fit.</p><div class="rf-grid" id="rf-grid"></div>
          <label class="btn small ghost rf-add">+ Add photos<input type="file" accept="image/*" multiple id="rf-file" hidden /></label></div>
        <p class="rf-err" id="rf-err" role="alert" hidden></p>
        <div class="sp-save"><button class="btn dark" type="submit">Publish to my profile</button></div></form>`;
    enhanceSelects(app);
    const grid = app.querySelector("#rf-grid"), err = app.querySelector("#rf-err");
    const paint = () => { grid.innerHTML = photos.map((p, i) => `<div class="rf-ph"><img src="${p}" alt="" /><button type="button" data-rm="${i}" aria-label="Remove photo">×</button></div>`).join(""); app.querySelector(".rf-add").hidden = photos.length >= MAX_PHOTOS; };
    grid.addEventListener("click", (ev) => { const b = ev.target.closest("[data-rm]"); if (b) { photos.splice(+b.dataset.rm, 1); paint(); } });
    app.querySelector("#rf-file").addEventListener("change", async (ev) => {
      const files = [...ev.target.files].slice(0, MAX_PHOTOS - photos.length); ev.target.value = "";
      for (const f of files) { const d = await shrink(f); if (d) photos.push(d); else toast("One of those couldn't be opened as a picture"); }
      paint();
    });
    paint();
    app.querySelector("#rf").addEventListener("submit", (ev) => {
      ev.preventDefault(); const f = Object.fromEntries(new FormData(ev.target)), bad = (m) => { err.textContent = m; err.hidden = false; };
      if (!String(f.title).trim()) return bad("Give your event a name.");
      if (!f.date) return bad("Pick the date it happened.");
      if (!String(f.summary).trim()) return bad("Say a little about how it went.");
      const r = { id: "r" + Date.now().toString(36), title: String(f.title).trim(), date: f.date, area: String(f.area).trim() || "Mumbai", price: String(f.price).trim() || "Free", category: CATS.find((c) => c[0] === f.category)?.[1] || "Event", kind: f.category, came: +f.came || 0, details: String(f.details).trim(), summary: String(f.summary).trim(), best: String(f.best).trim(), photos, created: Date.now() };
      if (!save(REC, [r, ...recaps()])) return bad("That's too many photos for this browser to keep. Remove a few and try again.");
      toast("Published to your profile"); location.hash = "#/e/" + r.id;
    });
  }

  /* ---------- The Attended and Hosted tabs on your own profile ---------- */
  function ownTab(kind) {
    if (kind === "attended") {
      const done = attended(), have = new Set(done.map((a) => a.ref));
      const ask = places().filter((x) => x.list === "going" && x.src).map((x) => EVENTS.find((e) => e.title === x.src)).filter((e) => e && isPast(e) && !have.has(evId(e)));
      const rows = done.map((a) => ({ a, e: find(a.ref) })).filter((x) => x.e);
      return `<div class="pe-list">${how("attended", !rows.length)}
        ${ask.map((e) => `<div class="sp-card hw-ask"><b>Did you go to ${esc(e.title)}?</b><span>${when(e)} · ${esc(e.area)}</span><div class="wd-btns"><button type="button" class="btn small ghost" data-nogo="${esc(e.title)}">No</button><button type="button" class="btn small" data-went="${esc(evId(e))}">Yes, I went</button></div></div>`).join("")}
        ${rows.length ? `<div class="fd-results">${rows.map(({ a, e }) => row(e, MOODS.find((m) => m[0] === a.mood)?.[1] || "", a.note ? ` · “${esc(a.note.slice(0, 40))}${a.note.length > 40 ? "…" : ""}”` : "")).join("")}</div>` : ask.length ? "" : `<p class="sp-sub hw-none">Nothing here yet. Open any past event and tap I went.</p>`}</div>`;
    }
    const rows = recaps();
    return `<div class="pe-list">${how("hosted", !rows.length)}<a class="btn hw-add" href="#/recap">+ Add an event you hosted</a>
      ${rows.length ? `<div class="fd-results">${rows.map((r) => row({ ...r, paper: "sun" }, "Yours", r.came ? ` · ${r.came} came` : "")).join("")}</div>` : `<p class="sp-sub hw-none">Nothing hosted yet. Your write-ups will show up here.</p>`}</div>`;
  }
  function bindOwn(root, again) {
    root.querySelectorAll("[data-went]").forEach((b) => b.addEventListener("click", () => openWent(b.dataset.went, again)));
    root.querySelectorAll("[data-nogo]").forEach((b) => b.addEventListener("click", () => { writePlaces(places().filter((x) => !(x.list === "going" && x.src === b.dataset.nogo))); toast("Okay, removed from Going"); again(); }));
  }
  /** Counts for the tabs on your own profile. */
  const counts = () => ({ attended: attended().length, hosted: recaps().length });

  return { renderEvent, renderRecapForm, ownTab, bindOwn, counts, evId };
}
