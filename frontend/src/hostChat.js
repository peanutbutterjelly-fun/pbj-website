// Run an event's or a plan's group chat from inside the host dashboard.
//   Events:  Updates, Question, Doubts, Guests (with door check-in).
//   Plans:   Requests, Updates, Question, Doubts, Going.
// Same rules as the member chat (see chats.js): only the host posts, members answer a quick question or send a private doubt.
// Email and text counts show who an update WILL reach. Nothing is sent by email or text yet.
import { PEOPLE } from "./people.js";
import { chatById, ensureHostChat, addSampleGuests, postUpdate, askQuestion, closeQuestion, openQuestion, tally, plannerNotes, pendingDoubts, dismissDoubt, receiveDoubt, reach, onChats, CHAT_LIFE_DAYS, attendees, checkIn, checkInByCode, postSystem, clearSuggestion, canEdit, pinUpdate, editUpdate, retractUpdate, EDIT_WINDOW_MIN, planRequests, planAuto, setPlanAuto, spotsLeft, receiveRequest, decideRequest, removeFromPlan, closesAt, isClosed } from "./chats.js";

const SAMPLE_DOUBTS = ["Is there parking nearby?", "I might be 10 minutes late, is that okay?", "Can I bring a friend who hasn't booked?"];
const ago = (t) => { const s = Math.max(0, (Date.now() - t) / 1000); return s < 60 ? "now" : s < 3600 ? Math.floor(s / 60) + "m ago" : s < 86400 ? Math.floor(s / 3600) + "h ago" : Math.floor(s / 86400) + "d ago"; };
const fmt = (d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const isPlan = (ev) => ev.type === "guestlist";
// Sponty plans live only in the app: everyone has a verified profile, and no email or phone is ever shared
const appPeople = (c, plan) => attendees(c).filter((a) => !plan || a.via === "In the app");
const initialsOf = (n) => { const w = String(n).split(/\s+/).filter((x) => /[a-z0-9]/i.test(x)); return (n.includes("@") || /^\+?\d/.test(n) ? "G" : w.slice(0, 2).map((x) => x[0]).join("")).toUpperCase(); };
// One person per card, the same everywhere: avatar, name, small details, and an action on the right
const personRow = (esc, a, label, extra = "") => `<li class="hc-req one"><span class="hc-av" aria-hidden="true">${esc(initialsOf(a.name))}</span><div class="hc-who"><b>${esc(a.name)}</b><span>${esc(a.via)}</span>${a.via !== "Guest login" && a.contact && a.contact !== a.name ? `<span>${esc(a.contact)}</span>` : ""}<small class="hc-codes">${a.checkedIn ? `<em class="hc-in hc-in-who">✓ Checked in</em>` : ""}<code>${esc(a.code)}</code></small></div><span class="hc-acts">${a.checkedIn ? `<em class="hc-in hc-in-act">✓ Checked in</em>` : ""}<button type="button" class="btn small ${a.checkedIn ? "ghost" : ""}" data-ci="${esc(a.key)}" data-on="${a.checkedIn ? 0 : 1}">${label}</button></span></li>`;
const capacityOf = (ev) => (ev.tickets || []).reduce((n, t) => n + (+t.qty || 0), 0);
const templates = (ev) => [
  ["Doors open early", `Doors open 15 minutes early. Come in as soon as you arrive.`],
  ["Running late", `We're starting a little later than planned. We'll post the new time here as soon as we know.`],
  ["Reminder", `Reminder: ${ev.title || "the event"} is coming up. Please arrive on time and keep your ticket handy.`],
  ["Exact spot", `Here's the exact spot: `],
  ["Thank you", `Thank you for coming! It was lovely having you. We'd love to hear how it went.`],
];

// Tapping anywhere outside an open update menu closes it
if (typeof document !== "undefined") document.addEventListener("click", (e) => { if (!e.target.closest(".hc-mw")) document.querySelectorAll(".hc-menu:not([hidden])").forEach((m) => { m.hidden = true; m.previousElementSibling?.setAttribute("aria-expanded", "false"); }); });
let tab = "updates", opts = ["", ""], live = null, editing = "", query = "", filter = "all", lastEvent = "", showAuto = false, logAll = false, qText = "", qNote = false, replyIds = new Set(), replySnip = new Map();
onChats(() => live?.());

/** When a host changes the time, place or cancels, the chat gets an automatic message and a ready-made update to send in one tap. */
export function syncEventChat(prev, next, dayLine) {
  if (!prev || !prev.submitted || !next.submitted) return;
  const title = next.title || "Your event", when = dayLine(next), place = next.venue || next.city || "";
  const msgs = [];
  if (next.status === "cancelled" && prev.status !== "cancelled") msgs.push([`The host cancelled this event.`, `We're sorry: "${title}" has been cancelled. We'll share what happens next right here.`]);
  else {
    if (dayLine(prev) !== when) msgs.push([`The date or time changed: ${when}.`, `Update: "${title}" is now on ${when}. See you there!`]);
    if ((prev.venue || prev.city || "") !== place && place) msgs.push([`The place changed: ${place}.`, `Update: the place for "${title}" has changed to ${place}. See you there!`]);
  }
  if (!msgs.length) return;
  const id = ensureHostChat(next.id, { title, area: next.city || "", when, endsOn: next.dateTo || next.dateFrom || "" });
  msgs.forEach(([t, s]) => postSystem(id, t, s));
}

export function renderHostChat(k, ev, startTab) {
  const { app, esc, toast, ic, dayLine, badge, ask } = k;
  const plan = isPlan(ev), cap = capacityOf(ev);
  const tabs = plan ? [["requests", "Requests"], ["updates", "Updates"], ["question", "Question"], ["doubts", "Doubts"], ["guests", "Going"]] : [["updates", "Updates"], ["question", "Question"], ["doubts", "Doubts"], ["guests", "Guests"]];
  if (lastEvent !== ev.id) { tab = plan ? "requests" : "updates"; query = ""; filter = "all"; editing = ""; qText = ""; qNote = false; opts = ["", ""]; lastEvent = ev.id; }
  if (startTab && tabs.some((t) => t[0] === startTab)) tab = startTab;
  if (!tabs.some((t) => t[0] === tab)) tab = tabs[0][0];
  const id = ensureHostChat(ev.id, { title: ev.title || "Untitled event", area: ev.city || "", when: dayLine(ev), endsOn: ev.dateTo || ev.dateFrom || "" });
  const end = closesAt(chatById(id)), closed = isClosed(chatById(id));
  document.title = "Chat — PeanutButterJelly.fun";
  app.innerHTML = `
    <div class="sub-head sales-head hc-bar">
      <button type="button" class="back-pill" data-back>‹ Back</button>
      <div class="sh-t"><h1 class="rv-name cut">${esc(ev.title || "Untitled event")}</h1><p>${plan ? "Sponty plan" : "Group chat"} · ${esc(ev.city || "—")} · ${dayLine(ev)}</p></div>
      <span class="pill ${badge[1]} big">${badge[0]}</span>
    </div>
    <div class="ev-tabs" role="tablist" id="hc-tabs"></div>
    <div id="hc-body" class="hc-body"></div>`;
  app.querySelector("[data-back]").addEventListener("click", () => { location.hash = "#/"; });
  const body = app.querySelector("#hc-body"), tabsEl = app.querySelector("#hc-tabs");
  const pendingReqs = () => planRequests(ev.id).filter((q) => q.status === "pending");

  const drawTabs = () => {
    const c = chatById(id), w = pendingDoubts(c).length, q = openQuestion(c), p = pendingReqs().length;
    tabsEl.innerHTML = tabs.map(([key, n]) => `<button type="button" role="tab" class="ev-tab ${key === tab ? "on" : ""}" aria-selected="${key === tab}" data-tab="${key}">${n}<b>${({ doubts: w, question: q ? 1 : 0, requests: p, guests: appPeople(c, plan).length, updates: c.messages.filter((m) => m.role === "update" && !m.retracted).length })[key] ?? 0}</b></button>`).join("");
    tabsEl.dataset.n = tabs.length;
  };
  const meter = (n, total, word, rest) => `<div class="hc-meter"><div class="hc-meter-top"><b>${n} of ${total} ${word}</b><span>${total - n} ${rest}</span></div><div class="hc-prog" role="img" aria-label="${n} of ${total} ${word}"><span style="width:${total ? Math.round((n / total) * 100) : 0}%"></span></div></div>`;
  const lock = closed ? ` disabled` : "";
  const banner = () => closed ? `<p class="hc-banner">This chat closed on ${fmt(end)} and is now read-only. Members can still read it.</p>` : end ? `<p class="hc-note">This chat closes on ${fmt(end)} (${CHAT_LIFE_DAYS} days after the event) and becomes read-only.</p>` : `<p class="hc-note">${plan ? "Plans have no fixed end date yet, so this chat stays open." : `Set the event date and this chat will close ${CHAT_LIFE_DAYS} days after the event.`}</p>`;
  // Three equal tiles: a big number, what it counts, and one small line under it
  const stats = (items) => `<div class="hc-stats">${items.map(([n, label, sub, tag]) => `<div><b>${n}</b><span>${label}</span><i${tag ? ` class="tag"` : ""}>${sub}</i></div>`).join("")}</div>`;
  const reachStrip = (c) => { const r = reach(c);
    if (plan) return `<div class="hc-stats one">${stats([[r.inApp, "In the app", "Instant"]]).replace(/^<div class="hc-stats">|<\/div>$/g, "")}</div><p class="hc-note hc-plan-note">Sponty plans work only in the app. Nobody's email or phone is shared.</p>`;
    return stats([[r.inApp, "In the app", "Instant"], [r.email, "By email", "Not sent yet", 1], [r.sms, "By text", "Not sent yet", 1]]); };
  const noOne = `<div class="empty hc-empty"><h2>${plan ? "Nobody has joined yet" : "Nobody has a ticket yet"}</h2><p>${plan ? "Accepted people join this chat." : "When people get tickets they join this chat."} Their doubts and answers show up here.</p><button type="button" class="btn small ghost" data-sample>Demo: add sample ${plan ? "people" : "guests"}</button></div>`;

  const results = (c, q, action = "") => { const t = tally(q), total = t.reduce((n, o) => n + o.n, 0) || 1, notes = plannerNotes(c, q.id);
    return `<div class="hc-opts">${t.map((o) => `<div class="hc-opt"><span class="hc-fill" style="width:${Math.round((o.n / total) * 100)}%"></span><span>${esc(o.label)}</span><b>${o.n}</b></div>`).join("")}</div>
      <div class="hc-row"><small class="hc-meta">${Object.keys(q.answers).length} of ${c.members.length} answered</small>${action}</div>${notes.length ? `<ul class="hc-notes">${notes.map((n) => `<li><b>${esc(n.name)}</b> · ${esc(n.option)}<span>${esc(n.note)}</span></li>`).join("")}</ul>` : ""}`; };

  /* ----- who is in: list with search, filters and check-in ----- */
  const guestRows = (c) => {
    const all = appPeople(c, plan), q = query.trim().toLowerCase();
    const list = all.filter((a) => (filter === "all" || (filter === "in" ? a.checkedIn : !a.checkedIn)) && (!q || [a.name, a.contact, a.code].join(" ").toLowerCase().includes(q)));
    return list.length ? `<ul class="hc-reqs">${list.map((a) => personRow(esc, a, a.checkedIn ? "Undo" : "Check in")).join("")}</ul>` : `<p class="hc-none">${all.length ? "No one matches." : "Nobody yet."}</p>`;
  };
  const progress = (c) => { const all = appPeople(c, plan), n = all.filter((a) => a.checkedIn).length; return meter(n, all.length, "checked in", "to go"); };

  const views = {
    updates(c) {
      const log = c.messages.slice().reverse(), sug = c.suggest, mine = log.filter((m) => m.role !== "system"), auto = log.filter((m) => m.role === "system");
      return `${banner()}
        ${sug ? `<section class="card hc-card hc-sug"><h2>Suggested update</h2><p class="hc-sub">Something changed. Want to tell members?</p><p class="hc-sug-text">${esc(sug)}</p><div class="hc-row hc-sug-act"><button type="button" class="btn small" data-sug-use${lock}>Use this text</button><button type="button" class="hc-link" data-sug-no>No thanks</button></div></section>` : ""}
        <div class="hc-two">
        <section class="card hc-card"><h2>Send an update</h2><p class="hc-sub">Everyone in the chat gets it the moment you send it.</p>
        <h3 class="hc-lab">Quick start</h3>
        <div class="hc-tpl" role="group" aria-label="Quick templates">${templates(ev).map(([n], i) => `<button type="button" class="hc-chip" data-tpl="${i}"${lock}>${esc(n)}</button>`).join("")}</div>
        <form id="hc-upd"><fieldset${lock}><h3 class="hc-lab">Your message</h3><textarea name="t" maxlength="600" placeholder="What does everyone need to know?" aria-label="Your update"></textarea>
        <h3 class="hc-lab">Who gets it</h3>${reachStrip(c)}
        <div class="hc-row"><small><span id="hc-un">0</span>/600</small><button type="submit" class="btn small">Send update</button></div></fieldset></form></section>
        <section class="card hc-card"><h2>Your updates</h2><p class="hc-sub">What you've sent. Pin, edit or withdraw any of it.</p>${mine.length ? `<ul class="hc-log">${(logAll ? mine : mine.slice(0, 4)).map((m) => logRow(c, m)).join("")}</ul>${mine.length > 4 ? `<button type="button" class="hc-link hc-toggle" data-logmore>${logAll ? "Show fewer" : `Show ${mine.length - 4} earlier`}</button>` : ""}` : `<p class="hc-none">Nothing sent yet. Your first update starts the conversation.</p>`}
        ${auto.length ? `<button type="button" class="hc-link hc-toggle" data-auto aria-expanded="${showAuto}">${showAuto ? "Hide" : "Show"} automatic activity (${auto.length})</button>${showAuto ? `<p class="hc-sub hc-sub-s">Posted by PB&J, not by you. These can't be edited.</p><ul class="hc-auto">${auto.map((m) => `<li><span>${esc(m.text)}</span><small>${ago(m.at)}</small></li>`).join("")}</ul>` : ""}` : ""}</section>
        </div>`;
    },
    question(c) {
      const oq = openQuestion(c), closedQs = (c.questions || []).filter((q) => q.status === "closed").reverse();
      return `${banner()}<section class="card hc-card"><h2>Quick question</h2><p class="hc-sub">Ask the group one question with tap-to-answer options.</p>
        ${oq ? `<p class="hc-q"><b>${esc(oq.text)}</b></p>${results(c, oq, `<button type="button" class="btn small ghost" id="hc-close"${lock}>Close the question</button>`)}`
          : `<form id="hc-q"><fieldset${lock}><input name="q" maxlength="140" placeholder="Your question" aria-label="Your question" value="${esc(qText)}" />
            <div class="hc-os">${opts.map((o, i) => `<div class="hc-o"><input name="o" data-i="${i}" maxlength="40" placeholder="Option ${i + 1}" aria-label="Option ${i + 1}" value="${esc(o)}" />${opts.length > 2 ? `<button type="button" class="hc-rm" data-rm="${i}" aria-label="Remove option ${i + 1}">×</button>` : ""}</div>`).join("")}</div>
            ${opts.length < 4 ? `<button type="button" class="hc-link" id="hc-addo">+ add an option</button>` : ""}
            <label class="hc-chk"><input type="checkbox" name="note" ${qNote ? "checked" : ""} /> Let people add a short note</label>
            <p class="hc-err" id="hc-qerr" role="alert" hidden></p>
            <div class="hc-row"><small>2 to 4 options. Only one question can be open at a time.</small><button type="submit" class="btn small">Send question</button></div></fieldset></form>`}</section>
        ${closedQs.length ? `<section class="card hc-card"><h2>Earlier questions</h2>${closedQs.map((q) => `<div class="hc-pq"><b>${esc(q.text)}</b>${results(c, q)}</div>`).join("")}</section>` : ""}`;
    },
    doubts(c) {
      replyIds.clear(); // a fresh reply box starts empty
      const pend = pendingDoubts(c), who = (h) => c.members.find((m) => m.handle === h)?.name || h;
      return `${banner()}<section class="card hc-card"><h2>Last-minute doubts</h2><p class="hc-sub">Private questions from people going. Only you see them.</p>
        ${pend.length ? `<p class="hc-note">Press Answer to reply to a doubt. Everyone gets the same update.</p>
          <ul class="hc-dl">${pend.map((d) => `<li data-doubt="${esc(d.id)}"><div class="hc-dq"><b>${esc(who(d.from))}</b> <i>${ago(d.at)}</i><em>${esc(d.text)}</em></div><span class="hc-acts"><button type="button" class="hc-link" data-dismiss="${esc(d.id)}"${lock}>Set aside</button><button type="button" class="btn small" data-reply="${esc(d.id)}" aria-pressed="false"${lock}>Answer</button></span></li>`).join("")}</ul>
          <form id="hc-ans"><fieldset${lock}><textarea name="a" maxlength="600" placeholder="Your update for everyone" aria-label="Your update for everyone"></textarea><p class="hc-err" id="hc-aerr" role="alert" hidden></p><div class="hc-row"><small><span id="hc-an">0</span>/600</small><button type="submit" class="btn small">Post update to everyone</button></div></fieldset></form>`
          : `<p class="hc-none">No doubts yet.</p>`}
        ${c.members.some((m) => m.handle !== "me") ? `<p class="hc-demo"><button type="button" class="hc-link" data-doubts>Demo: add sample doubts</button></p>` : ""}</section>`;
    },
    guests(c) {
      const all = appPeople(c, plan);
      return `<section class="card hc-card"><div class="hc-head"><div><h2>${plan ? "Who is going" : "Who is in this chat"}</h2><p class="hc-sub">${plan ? "Everyone you have accepted." : "Everyone with a ticket."} Search the list, or check people in at the door.</p></div>${all.length ? `<a class="btn small" href="#/event/${esc(ev.id)}/checkin">Open door check-in</a>` : ""}</div>
        ${all.length ? `${progress(c)}
          <div class="hc-tools"><input id="hc-search" type="search" placeholder="Search name, contact or code" aria-label="Search guests" value="${esc(query)}" />
            <div class="hc-filters" role="group" aria-label="Filter">${[["all", "All"], ["in", "Checked in"], ["out", "Not yet"]].map(([k2, n]) => `<button type="button" class="hc-chip ${filter === k2 ? "on" : ""}" data-filter="${k2}" aria-pressed="${filter === k2}">${n}</button>`).join("")}</div></div>
          <div id="hc-glist">${guestRows(c)}</div>` : noOne}</section>`;
    },
    requests(c) {
      const list = planRequests(ev.id), pend = list.filter((q) => q.status === "pending"), acc = list.filter((q) => q.status === "accepted"), dec = list.filter((q) => q.status === "declined").length, left = spotsLeft(ev.id, cap), auto = planAuto(ev.id);
      const initials = (n) => esc(initialsOf(n));
      const who = (q, sub, acts) => `<li class="hc-req"><span class="hc-av" aria-hidden="true">${initials(q.name)}</span><div class="hc-who"><b>${esc(q.name)}</b><span>${esc(q.handle)}</span>${sub ? `<small>${sub}</small>` : ""}</div>${acts}</li>`;
      return `<section class="card hc-card"><div class="hc-head"><div><h2>Requests to join</h2><p class="hc-sub">You decide who joins. Everyone here has passed the identity check (marked by hand for now).</p></div>
        <label class="hc-sw"><input type="checkbox" id="hc-auto" ${auto ? "checked" : ""} /><span class="hc-sw-ui" aria-hidden="true"></span><span><b>Auto-approve</b><small>${auto ? "On: people join as they ask, while spots last." : "Off: you approve each person."}</small></span></label></div>
        ${cap ? `<div class="hc-meter"><div class="hc-meter-top"><b>${acc.length} of ${cap} spots filled</b><span>${left} left</span></div><div class="hc-prog" role="img" aria-label="${acc.length} of ${cap} spots filled"><span style="width:${Math.min(100, Math.round((acc.length / cap) * 100))}%"></span></div></div>` : `<p class="hc-banner">Set the number of spots in the Tickets step first. Accept is off until then.</p>`}
        <div class="hc-cols">
          <div><h3 class="hc-lab">Waiting for your decision (${pend.length})</h3>
            ${pend.length ? `<ul class="hc-reqs">${pend.map((q) => who(q, `ID verified · asked ${ago(q.at)}`, `<span class="hc-acts"><button type="button" class="btn small ghost" data-dec="${esc(q.id)}">Decline</button><button type="button" class="btn small" data-acc="${esc(q.id)}" ${left ? "" : "disabled"}>Accept</button></span>`)).join("")}</ul>${left ? "" : `<p class="hc-note hc-full">The plan is full. Remove someone to make room.</p>`}` : `<p class="hc-none">No one is waiting. New requests show up here.</p>`}</div>
          <div><h3 class="hc-lab">Accepted (${acc.length})</h3>
            ${acc.length ? `<ul class="hc-reqs">${acc.map((q) => who(q, "", `<button type="button" class="hc-link" data-rem="${esc(q.id)}">Remove</button>`)).join("")}</ul>` : `<p class="hc-none">No one yet.</p>`}</div>
        </div>
        <p class="hc-demo">${dec ? `${dec} declined · ` : ""}<button type="button" class="hc-link" data-samplereq>Demo: add sample requests</button></p></section>`;
    },
  };
  const tidy = (t) => esc(t).replace(/\n{2,}/g, "\n").trim();
  function logRow(c, m) {
    if (editing === m.id) return `<li class="update"><form data-edit="${esc(m.id)}"><textarea name="e" maxlength="600" aria-label="Edit your update">${esc(m.text)}</textarea><div class="hc-row"><small>${plan ? "Members may have already read it." : "Email and text already sent can't be recalled."}</small><span class="hc-acts"><button type="button" class="hc-link" data-ecancel>Cancel</button><button type="submit" class="btn small">Save</button></span></div></form></li>`;
    if (m.retracted) return `<li class="hc-msg gone"><div class="hc-bub"><p>${tidy(m.text)}</p><small>Withdrawn · ${ago(m.at)}</small></div></li>`;
    const upd = m.role === "update";
    const menu = upd && !closed ? `<span class="hc-mw"><button type="button" class="hc-dots" data-menu aria-label="Options for this update" aria-haspopup="menu" aria-expanded="false">${ic("dots", "1.2em")}</button><div class="hc-menu" role="menu" hidden><button type="button" role="menuitem" data-pin="${esc(m.id)}">${c.pinned === m.id ? "Unpin" : "Pin to top"}</button>${canEdit(m) ? `<button type="button" role="menuitem" data-edit-start="${esc(m.id)}">Edit (${EDIT_WINDOW_MIN} min)</button>` : ""}<button type="button" role="menuitem" class="bad" data-retract="${esc(m.id)}">Withdraw</button></div></span>` : "";
    return `<li class="hc-msg ${m.role}"><div class="hc-bub"><p>${m.role === "question" ? `<span class="hc-mark">Question:</span> ` : ""}${tidy(m.text)}</p><small>${c.pinned === m.id ? `<span class="hc-kind pin">Pinned</span> ` : ""}${ago(m.at)}${m.edited ? " · edited" : ""}</small></div>${menu}</li>`;
  }

  const wire = (c) => {
    body.querySelector("[data-sample]")?.addEventListener("click", () => { addSampleGuests(id, plan); toast("Sample people added"); });
    body.querySelector("[data-doubts]")?.addEventListener("click", () => { const m = c.members.filter((x) => x.handle !== "me"); SAMPLE_DOUBTS.slice(0, Math.min(3, m.length)).forEach((t, i) => receiveDoubt(id, m[i].handle, t)); });
    // Updates
    const upd = body.querySelector("#hc-upd");
    if (upd) {
      const sync = () => { body.querySelector("#hc-un").textContent = upd.t.value.length; };
      upd.t.addEventListener("input", sync);
      body.querySelectorAll("[data-tpl]").forEach((b) => b.addEventListener("click", () => { upd.t.value = templates(ev)[+b.dataset.tpl][1]; sync(); upd.t.focus(); }));
      body.querySelector("[data-sug-use]")?.addEventListener("click", () => { const t = c.suggest; upd.t.value = t; sync(); body.querySelector(".hc-sug")?.remove(); clearSuggestion(id); upd.t.focus(); });
      upd.addEventListener("submit", (e) => { e.preventDefault(); if (!upd.t.value.trim()) { upd.t.focus(); return; } const t = upd.t.value; upd.t.value = ""; if (postUpdate(id, t)) toast("Update sent"); paint(true); });
    }
    body.querySelectorAll("[data-menu]").forEach((b) => b.addEventListener("click", () => {
      const m = b.nextElementSibling, open = m.hidden;
      body.querySelectorAll(".hc-menu").forEach((x) => { x.hidden = true; x.previousElementSibling?.setAttribute("aria-expanded", "false"); });
      m.hidden = !open; b.setAttribute("aria-expanded", String(open));
    }));
    body.querySelectorAll(".hc-menu").forEach((m) => m.addEventListener("click", () => { m.hidden = true; m.previousElementSibling?.setAttribute("aria-expanded", "false"); }));
    body.querySelector("[data-logmore]")?.addEventListener("click", () => { logAll = !logAll; paint(true); });
    body.querySelector("[data-auto]")?.addEventListener("click", () => { showAuto = !showAuto; paint(true); });
    body.querySelector("[data-sug-no]")?.addEventListener("click", () => clearSuggestion(id));
    body.querySelectorAll("[data-pin]").forEach((b) => b.addEventListener("click", () => { pinUpdate(id, b.dataset.pin); toast(chatById(id).pinned ? "Pinned to the top of the chat" : "Unpinned"); }));
    body.querySelectorAll("[data-edit-start]").forEach((b) => b.addEventListener("click", () => { editing = b.dataset.editStart; paint(true); }));
    body.querySelector("[data-ecancel]")?.addEventListener("click", () => { editing = ""; paint(true); });
    body.querySelector("[data-edit]")?.addEventListener("submit", (e) => { e.preventDefault(); const f = e.target; if (editUpdate(id, f.dataset.edit, f.e.value)) toast("Saved. Members see it as edited"); else toast("Too late to edit. Withdraw it and send a new one"); editing = ""; paint(true); });
    body.querySelectorAll("[data-retract]").forEach((b) => b.addEventListener("click", async () => { if (await ask({ title: "Withdraw this update?", message: plan ? "Members will see that you withdrew it." : "Members will see that you withdrew it. Email or text already sent can't be recalled.", ok: "Withdraw" })) { retractUpdate(id, b.dataset.retract); toast("Withdrawn"); } }));
    // Doubts
    const ans = body.querySelector("#hc-ans");
    if (ans) {
      const count = () => { body.querySelector("#hc-an").textContent = ans.a.value.length; };
      const clearErr = () => { body.querySelector("#hc-aerr").hidden = true; };
      ans.a.addEventListener("input", () => { count(); clearErr(); });
      // Answer adds that doubt, quoted, to the reply box; pressing it again takes it out
      body.querySelectorAll("[data-reply]").forEach((b) => b.addEventListener("click", () => {
        const did = b.dataset.reply, d = pendingDoubts(chatById(id)).find((x) => x.id === did); if (!d) return;
        if (replyIds.has(did)) {
          replyIds.delete(did); ans.a.value = ans.a.value.replace(replySnip.get(did) || "", "").replace(/\n{3,}/g, "\n\n").replace(/^\s+/, "");
          b.textContent = "Answer"; b.classList.remove("ghost"); b.setAttribute("aria-pressed", "false");
        } else {
          const snip = `Re: ${d.text}\n`; replyIds.add(did); replySnip.set(did, snip.trim());
          const cur = ans.a.value.replace(/\s+$/, ""); ans.a.value = (cur ? cur + "\n\n" : "") + snip;
          b.textContent = "✓ Added"; b.classList.add("ghost"); b.setAttribute("aria-pressed", "true");
        }
        clearErr(); count(); ans.a.focus(); ans.a.setSelectionRange(ans.a.value.length, ans.a.value.length);
      }));
      ans.addEventListener("submit", (e) => { e.preventDefault();
        if (!ans.a.value.trim()) { ans.a.focus(); return; }
        const ids = [...replyIds].filter((x) => pendingDoubts(chatById(id)).some((d) => d.id === x));
        if (!ids.length) { const er = body.querySelector("#hc-aerr"); er.textContent = "Press Answer on a doubt first. To send a general update, use the Updates tab"; er.hidden = false; return; }
        const t = ans.a.value; ans.a.value = ""; replyIds.clear(); postUpdate(id, t, { answersDoubts: ids }); toast("Posted. The people who asked can see it was answered"); paint(true); });
      body.querySelectorAll("[data-dismiss]").forEach((b) => b.addEventListener("click", () => { const did = b.dataset.dismiss; replyIds.delete(did); dismissDoubt(id, did); b.closest("li")?.remove(); toast("Set aside"); }));
    }
    // Question
    body.querySelector("#hc-close")?.addEventListener("click", () => { closeQuestion(id, openQuestion(c).id); toast("Question closed"); });
    const qf = body.querySelector("#hc-q");
    if (qf) {
      const sync = () => { opts = [...qf.querySelectorAll("[name=o]")].map((x) => x.value); qText = qf.q.value; qNote = qf.note.checked; };
      qf.addEventListener("input", () => { sync(); body.querySelector("#hc-qerr").hidden = true; });
      qf.note.addEventListener("change", () => { qNote = qf.note.checked; });
      body.querySelector("#hc-addo")?.addEventListener("click", () => { sync(); opts.push(""); paint(true); });
      qf.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => { sync(); opts.splice(+b.dataset.rm, 1); paint(true); }));
      qf.addEventListener("submit", (e) => { e.preventDefault(); sync(); const filled = opts.map((o) => o.trim()).filter(Boolean);
        const err = (m, el) => { const e = body.querySelector("#hc-qerr"); e.textContent = m; e.hidden = false; el?.focus(); };
        if (!qf.q.value.trim()) return err("Write your question first", qf.q);
        if (filled.length < 2) return err("Add at least two options", qf.querySelector("[name=o]"));
        if (askQuestion(id, { text: qf.q.value, options: filled, allowNote: qf.note.checked })) { opts = ["", ""]; qText = ""; qNote = false; toast("Question sent"); paint(true); } });
    }
    // Guests and check-in
    const list = body.querySelector("#hc-glist");
    if (list) {
      const redraw = () => { list.innerHTML = guestRows(chatById(id)); };
      body.querySelector("#hc-search").addEventListener("input", (e) => { query = e.target.value; redraw(); });
      body.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => { filter = b.dataset.filter; paint(true); }));
      list.addEventListener("click", (e) => { const b = e.target.closest("[data-ci]"); if (!b) return; const r = checkIn(id, b.dataset.ci, b.dataset.on === "1"); if (r) toast(b.dataset.on === "1" ? `${r.name} checked in` : "Check-in undone"); });
    }
    // Plan requests
    body.querySelector("#hc-auto")?.addEventListener("change", (e) => { setPlanAuto(ev.id, e.target.checked); toast(e.target.checked ? "Auto-approve on" : "Auto-approve off: you approve each person"); });
    body.querySelectorAll("[data-acc]").forEach((b) => b.addEventListener("click", () => { if (!decideRequest(ev.id, b.dataset.acc, true, cap)) toast("The plan is full"); else toast("Accepted. They're in the chat"); }));
    body.querySelectorAll("[data-dec]").forEach((b) => b.addEventListener("click", () => { decideRequest(ev.id, b.dataset.dec, false, cap); toast("Declined"); }));
    body.querySelectorAll("[data-rem]").forEach((b) => b.addEventListener("click", async () => { if (await ask({ title: "Remove this person?", message: "They leave the plan's chat and the spot opens up.", ok: "Remove" })) { removeFromPlan(ev.id, b.dataset.rem); toast("Removed"); } }));
    body.querySelector("[data-samplereq]")?.addEventListener("click", () => { const have = new Set(planRequests(ev.id).map((q) => q.handle)); PEOPLE.filter((p) => !have.has(p.handle)).slice(0, 4).forEach((p) => receiveRequest(ev.id, { handle: p.handle, name: p.name }, cap)); });
  };
  const paint = (force = false) => {
    drawTabs();
    // Don't wipe something half-typed when a new doubt or answer arrives
    if (!force && [...body.querySelectorAll("textarea, input:not([type=checkbox])")].some((el) => el.value)) return;
    const c = chatById(id); body.innerHTML = views[tab](c); wire(c);
  };
  tabsEl.addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) { tab = b.dataset.tab; editing = ""; paint(true); } });
  live = () => { if (!document.body.contains(body)) { live = null; return; } paint(); };
  paint(true);
}

/** Door check-in: type or scan the code on a guest's ticket. Works for events and plans. */
export function renderCheckIn(k, ev) {
  const { app, esc, toast, dayLine, badge } = k;
  const id = ensureHostChat(ev.id, { title: ev.title || "Untitled event", area: ev.city || "", when: dayLine(ev), endsOn: ev.dateTo || ev.dateFrom || "" });
  document.title = "Check-in — PeanutButterJelly.fun";
  app.innerHTML = `
    <div class="sub-head sales-head hc-bar">
      <button type="button" class="back-pill" data-back>‹ Back</button>
      <div class="sh-t"><h1 class="rv-name cut">Door check-in</h1><p>${esc(ev.title || "Untitled event")} · ${dayLine(ev)}</p></div>
      <span class="pill ${badge[1]} big">${badge[0]}</span>
    </div>
    <div class="hc-body">
      <section class="card hc-card"><h2>Check a guest in</h2><p>Scan the QR on their ticket, or type the code printed under it.</p>
        <button type="button" class="btn small ghost ci-scan" data-scan>Scan QR with camera</button>
        <div class="ci-cam" hidden><video playsinline muted></video><p class="hc-note">Hold the ticket's QR in front of the camera.</p><button type="button" class="btn small ghost" data-scan-stop>Stop scanning</button></div>
        <form id="ci-form" autocomplete="off"><div class="hc-o"><input name="c" class="ci-code" placeholder="PBJ-XXXXXX" aria-label="Ticket code" autocapitalize="characters" /><button type="submit" class="btn small">Check in</button></div></form>
        <div id="ci-result" class="ci-result" role="status" aria-live="polite"></div>
</section>
      <section class="card hc-card"><h2>Guests</h2><div id="ci-prog"></div>
        <div class="hc-tools"><input id="ci-search" type="search" placeholder="Search name, contact or code" aria-label="Search guests" /></div><div id="ci-list"></div></section>
    </div>`;
  app.querySelector("[data-back]").addEventListener("click", () => { location.hash = "#/event/" + ev.id + "/chat"; });
  const res = app.querySelector("#ci-result"), listEl = app.querySelector("#ci-list"), form = app.querySelector("#ci-form"), search = app.querySelector("#ci-search");
  const draw = () => {
    const c = chatById(id), all = appPeople(c, isPlan(ev)), n = all.filter((a) => a.checkedIn).length, q = search.value.trim().toLowerCase();
    app.querySelector("#ci-prog").innerHTML = `<div class="hc-meter"><div class="hc-meter-top"><b>${n} of ${all.length} checked in</b><span>${all.length - n} still to come</span></div><div class="hc-prog" role="img" aria-label="${n} of ${all.length} checked in"><span style="width:${all.length ? Math.round((n / all.length) * 100) : 0}%"></span></div></div>`;
    const rows = all.filter((a) => !q || [a.name, a.contact, a.code].join(" ").toLowerCase().includes(q)).sort((a, b) => (a.checkedIn ? 1 : 0) - (b.checkedIn ? 1 : 0) || a.name.localeCompare(b.name));
    listEl.innerHTML = rows.length ? `<ul class="hc-reqs">${rows.map((a) => personRow(esc, a, a.checkedIn ? "Undo" : "Check in")).join("")}</ul>` : `<p class="hc-none">${all.length ? "No one matches." : "No guests yet. Guests appear here once they have tickets."}</p>`;
  };
  const say = (cls, text) => { res.className = "ci-result " + cls; res.textContent = text; };
  form.addEventListener("submit", (e) => { e.preventDefault(); const v = form.c.value.trim(); if (!v) { form.c.focus(); return; }
    const r = checkInByCode(id, v); form.c.value = ""; form.c.focus();
    if (r.status === "ok") say("ok", `✓ ${r.person.name} is in`); else if (r.status === "again") say("warn", `${r.person.name} is already checked in (${ago(r.person.checkedIn)})`); else say("bad", "That code isn't on this guest list. Check it and try again"); });
  listEl.addEventListener("click", (e) => { const b = e.target.closest("[data-ci]"); if (!b) return; const r = checkIn(id, b.dataset.ci, b.dataset.on === "1"); if (r) say(b.dataset.on === "1" ? "ok" : "warn", b.dataset.on === "1" ? `✓ ${r.name} is in` : `${r.name}'s check-in was undone`); });
  search.addEventListener("input", draw);
  // Camera scanner: the browser's own detector where there is one, otherwise the small jsQR helper
  const cam = app.querySelector(".ci-cam"), vid = cam.querySelector("video"), scanBtn = app.querySelector("[data-scan]");
  let stream = null, timer = 0, lastSeen = "", lastAt = 0;
  const stop = () => { clearInterval(timer); timer = 0; stream?.getTracks().forEach((t) => t.stop()); stream = null; cam.hidden = true; scanBtn.hidden = false; };
  const handle = (raw) => { const code = String(raw).trim(), now = Date.now(); if (code === lastSeen && now - lastAt < 3000) return; lastSeen = code; lastAt = now;
    const r = checkInByCode(id, code);
    if (r.status === "ok") say("ok", `✓ ${r.person.name} is in`); else if (r.status === "again") say("warn", `${r.person.name} is already checked in (${ago(r.person.checkedIn)})`); else say("bad", "That QR isn't on this guest list"); };
  scanBtn.addEventListener("click", async () => {
    if (!navigator.mediaDevices?.getUserMedia) { say("bad", "This browser can't use the camera. Type the code instead"); return; }
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }); }
    catch { say("bad", "Camera access was blocked. Allow it in the browser, or type the code"); return; }
    vid.srcObject = stream; await vid.play().catch(() => {}); cam.hidden = false; scanBtn.hidden = true;
    const det = "BarcodeDetector" in window ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
    const jsQR = det ? null : (await import("jsqr")).default, cv = document.createElement("canvas"), cx = cv.getContext("2d", { willReadFrequently: true });
    timer = setInterval(async () => { if (!document.body.contains(vid)) { stop(); return; } if (vid.readyState < 2) return;
      try { if (det) { const f = await det.detect(vid); if (f[0]) handle(f[0].rawValue); }
        else { cv.width = vid.videoWidth; cv.height = vid.videoHeight; cx.drawImage(vid, 0, 0); const q = jsQR(cx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height); if (q) handle(q.data); } } catch {} }, 300); });
  cam.querySelector("[data-scan-stop]").addEventListener("click", stop);
  live = () => { if (!document.body.contains(listEl)) { live = null; return; } draw(); };
  draw(); form.c.focus();
}
