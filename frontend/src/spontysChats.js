// Messages in the Spontys app: the list of group chats, one chat, the "Updates for you" card on For you, and the ticket sheet.
// The rules (who can post, who gets updates, how "I'm in" works) are written at the top of chats.js.
import { EVENTS } from "./eventsData.js";
import { personBy } from "./people.js";
import { seenAt, waitingDoubts, chatList, chatById, markRead, unreadCount, unreadUpdates, unreadIn, postUpdate, buyTicket, hasTicket, chatIdForEvent, onChats, DEMO_UPDATES, askQuestion, closeQuestion, answerQuestion, openQuestion, questionById, tally, DEMO_QUESTIONS, DEMO_EVENT_QUESTIONS, DEMO_DOUBT_UPDATE, DOUBT_MAX, DOUBT_LIMIT, myDoubts, doubtsLeft, pendingDoubts, sendDoubt, isClosed, closesAt, isMuted, toggleMute, reportChat, REPORT_REASONS, CHAT_LIFE_DAYS } from "./chats.js";

const ago = (t) => { const s = Math.max(0, (Date.now() - t) / 1000); return s < 60 ? "now" : s < 3600 ? Math.floor(s / 60) + "m" : s < 86400 ? Math.floor(s / 3600) + "h" : Math.floor(s / 86400) + "d"; };

const dayLabel = (t) => { const d = new Date(t), n = new Date(), y = new Date(n); y.setDate(n.getDate() - 1); const same = (a, b) => a.toDateString() === b.toDateString(); return same(d, n) ? "Today" : same(d, y) ? "Yesterday" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }); };
const full = (t) => new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function initChats(k) {
  const { app, esc, toast, bread, ic, KINDS, PAPER } = k;
  const ev = (c) => EVENTS.find((e) => e.title === c.ref);
  const tile = (c) => { const e = c.kind === "event" ? ev(c) : null;
    return e ? `<span class="fd-thumb" style="background:${PAPER[e.paper] || "var(--bread)"};color:${e.paper === "jam" || e.paper === "brown" ? "var(--cream)" : "var(--brown)"}">${KINDS[e.kind] || "✨"}</span>` : `<span class="fd-thumb" style="background:var(--bread);color:var(--brown)">${ic("people", "1.2em")}</span>`; };
  const who = (c, h) => (h === "me" ? "You" : c.members.find((m) => m.handle === h)?.name || personBy(h)?.name || h);
  const tag = (c) => (c.kind === "plan" ? "Planner update" : "Host update");
const asker = (c) => (c.kind === "plan" ? "planner" : "host");
const tagFor = (c, m) => (m.role === "question" ? `Question from the ${asker(c)}` : tag(c));

  /** The bell on For you: shows how many unread updates you have and opens Messages. */
  const bell = () => { const n = unreadCount(); return `<button type="button" class="sp-ico bell" data-bell aria-label="${n ? n + " unread updates" : "Messages and updates"}">${ic("bell", "1.3em")}${n ? `<i class="bl-dot">${n > 9 ? "9+" : n}</i>` : ""}</button>`; };

  /** "Updates for you" on For you: the newest official updates you haven't read yet, from hosts of events you have tickets for. */
  const updatesCard = () => { const list = unreadUpdates(2); if (!list.length) return "";
    return `<div class="fd-hrow"><h2 class="fd-h cut">Updates for you</h2><span class="fd-count">${unreadCount()}</span></div>
      <div class="fd-upds">${list.map(({ chat: c, msg: m }) => `<a class="fd-upd" href="#/chat/${esc(c.id)}"><span class="ch-tag">${tagFor(c, m)}</span><b>${esc(c.title)}</b><p>${esc(m.text)}</p><small>${esc(who(c, m.from))} · ${ago(m.at)} · open the group chat</small></a>`).join("")}</div>`; };

  /* ---------- Messages: your group chats ---------- */
  function renderMessages() {
    document.title = "Messages — PeanutButterJelly.fun";
    const name = (k.profile().name || "you").toLowerCase(), list = chatList();
    app.innerHTML = `<header class="fd-top msg"><span></span><h1 class="cut">${esc(name)}</h1><button type="button" class="sp-ico" data-people aria-label="Find people">${ic("userplus", "1.3em")}</button></header>
      <section class="ch-how"><b>Updates from your hosts</b><p>Buy a ticket and the event's group chat opens here. Only the host posts, and updates arrive the moment they are sent. Joined a sponty plan? You're added once the planner accepts you. Last-minute doubt? Send it privately and they'll answer everyone in an update.</p></section>
      <a class="mg-entry" href="/dashboard.html"><b>Run a chat</b><span>Host or sponty planner? Open the host dashboard to send updates and answer doubts</span>${waitingDoubts() ? `<i class="bl-dot">${waitingDoubts()}</i>` : ""}</a>
      <h2 class="fd-h cut">Group chats</h2>
      ${list.length ? `<div class="ch-list">${list.map((c) => { const m = c.messages.at(-1), n = unreadIn(c);
        return `<a class="ch-row ${n ? "unread" : ""}" href="#/chat/${esc(c.id)}">${tile(c)}<span class="ch-mid"><b>${esc(c.title)}</b><small class="ch-last">${m?.role === "update" ? `<span class="ch-tag">Update</span> ` : m?.role === "question" ? `<span class="ch-tag">Question</span> ` : ""}${esc(m ? (m.from === "me" ? "You: " : m.role === "member" ? who(c, m.from) + ": " : "") + m.text : "")}</small><small class="ch-kind">${c.kind === "plan" ? "Sponty plan" : "Event"} · ${c.members.length} going${isClosed(c) ? " · Closed" : ""}${isMuted(c.id) ? " · Muted" : ""}</small></span><span class="ch-end"><small>${m ? ago(m.at) : ""}</small>${n ? `<i class="bl-dot ${isMuted(c.id) ? "muted" : ""}">${n}</i>` : ""}</span></a>`; }).join("")}</div>`
      : `<section class="sp-card msg-empty">${ic("chat", "3.4em")}<h2>No group chats yet</h2><p class="sp-sub">Get a ticket for an event, or get accepted into a sponty plan, and its group chat shows up here.</p><div class="as-btns"><a class="btn small" href="#/">See what's on</a><button type="button" class="btn small ghost" data-people>Find people</button></div></section>`}`;
    app.querySelectorAll("[data-people]").forEach((b) => b.addEventListener("click", () => k.openPeople()));
  }

  /** One question card in the chat: tap an option to answer; counts show once you have answered or it has closed. */
  const qCard = (c, m) => {
    const q = questionById(c, m.qid); if (!q) return "";
    const mine = q.answers.me, closed = q.status === "closed" || isClosed(c), show = Boolean(mine) || closed, t = tally(q), total = t.reduce((n, o) => n + o.n, 0) || 1, name = esc(who(c, m.from));
    return `<article class="ch-q ${closed ? "closed" : ""}" data-q="${esc(q.id)}" role="group" aria-labelledby="qt-${esc(q.id)}"><span class="ch-av">${bread({ name: who(c, m.from) })}</span><div class="ch-bub">
      <header class="ch-h"><b>${name}</b><span class="ch-role">${asker(c).toUpperCase()}</span><time title="${esc(full(m.at))}" datetime="${new Date(m.at).toISOString()}">${ago(m.at)}</time></header>
      <p class="ch-qk">${closed ? "Question · closed" : "Question · optional"}</p><p class="ch-qt" id="qt-${esc(q.id)}">${esc(q.text)}</p>
      <div class="ch-opts">${t.map((o) => `<button type="button" class="ch-opt ${mine?.option === o.id ? "on" : ""}" data-opt="${esc(o.id)}" aria-pressed="${mine?.option === o.id}" ${closed ? "disabled" : ""}><span class="ch-fill" style="width:${show ? Math.round((o.n / total) * 100) : 0}%"></span><span class="ch-ol">${mine?.option === o.id ? "✓ " : ""}${esc(o.label)}</span>${show ? `<b aria-label="${o.n} chose this">${o.n}</b>` : ""}</button>`).join("")}</div>
      ${q.allowNote && mine && !closed ? `<form class="ch-qnote"><input name="n" value="${esc(mine.note || "")}" maxlength="140" placeholder="Add a note (optional)" aria-label="Add a short note" /><button type="submit" class="btn small ghost">Save</button></form>` : ""}
      <p class="ch-qf">${closed ? "Closed. Thanks for answering." : "Tap an option to answer. You can change it until it closes."}${show ? ` ${Object.keys(q.answers).length} answered.` : ""}${q.allowNote && !closed ? " A short note is welcome." : ""}</p></div></article>`; };

  /* ---------- One group chat ---------- */
  let demoN = 0, demoQ = 0;
  function renderChat(id) {
    const c = chatById(id);
    if (!c) { document.title = "Messages — PeanutButterJelly.fun"; app.innerHTML = `<a class="back" href="#/messages">← Messages</a><section class="sp-card msg-empty"><h2>We couldn't find that chat</h2><p class="sp-sub">It opens when you get a ticket or are accepted into a plan.</p><a class="btn" href="#/messages">Back to messages</a></section>`; return; }
    document.title = `${c.title} — PeanutButterJelly.fun`;
    const lastSeen = seenAt(id); // what you had read before opening, so the "New" line can show
    markRead(id);
    app.innerHTML = `<div class="ch-col"><a class="back" href="#/messages">← Messages</a>
      <header class="ch-head">${tile(c)}<div><h1 class="cut">${esc(c.title)}</h1><p class="sp-sub">${c.kind === "plan" ? "Sponty plan" : "Event"} · ${esc(c.area)} · ${asker(c) === "host" ? "Host" : "Planner"}: ${esc(c.host.name)}</p></div><button type="button" class="sp-ico ch-more" data-more aria-label="Chat options" aria-haspopup="dialog">${ic("dots", "1.3em")}</button></header>
      <p class="ch-off" id="ch-off" role="status" hidden>You're offline. You can read the chat, but you can't send until you're back online.</p>
      <div class="ch-people" aria-label="${c.members.length} people going">${c.members.slice(0, 5).map((m) => `<span class="ch-pav" title="${esc(m.name)}">${bread({ name: m.name })}</span>`).join("")}<span class="ch-going">${c.members.length} going</span></div>
      <p class="ch-ro">${ic("chat", "1.2em")}<span>${isClosed(c) ? `This chat closed on ${closesAt(c).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} (${CHAT_LIFE_DAYS} days after the event). You can still read it.` : `Only ${esc(c.host.name)} posts here. Updates arrive the moment they are sent.${closesAt(c) ? ` It closes on ${closesAt(c).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.` : ""}`}</span></p>
      <div class="ch-msgs" id="ch-msgs" role="log" aria-live="polite" aria-label="Group chat messages"></div>
      <div id="ch-compose"></div></div>`;
    const box = app.querySelector("#ch-msgs");
    const paint = () => {
      const cur = chatById(id); if (!cur) return;
      const nearBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 240;
      let html = "", day = "", prev = null, shownNew = false;
      if (!cur.messages.length) html = `<p class="ch-empty">No updates yet. ${esc(cur.host.name)} will post here, and you'll see it the moment they do.</p>`;
      const pin = cur.pinned && cur.messages.find((x) => x.id === cur.pinned && !x.retracted);
      if (pin) html = `<aside class="ch-pin" aria-label="Pinned update"><span class="ch-tag">Pinned</span><p>${esc(pin.text)}</p></aside>` + html;
      cur.messages.forEach((m) => {
        if (m.retracted) { html += `<p class="ch-sys">${esc(cur.host.name)} withdrew an update.</p>`; prev = null; return; }
        const d = dayLabel(m.at); if (d !== day) { html += `<p class="ch-day"><span>${d}</span></p>`; day = d; prev = null; }
        if (!shownNew && lastSeen && m.at > lastSeen && m.role !== "system" && m.from !== "me") { html += `<p class="ch-new" id="ch-new"><span>New</span></p>`; shownNew = true; }
        if (m.role === "system") { html += `<p class="ch-sys">${esc(m.text)}</p>`; prev = null; return; }
        if (m.role === "question") { html += qCard(cur, m); prev = null; return; }
        const cont = prev && prev.from === m.from && m.at - prev.at < 5 * 60 * 1000 && prev.role === "update" && !m.fromDoubts && !prev.fromDoubts, nm = who(cur, m.from);
        html += `<article class="ch-upd ${cont ? "cont" : ""}" aria-label="${asker(cur)} update from ${esc(nm)}, ${ago(m.at)}"><span class="ch-av">${cont ? "" : bread({ name: nm })}</span><div class="ch-bub">${cont ? "" : `<header class="ch-h"><b>${esc(nm)}</b><span class="ch-role">${asker(cur).toUpperCase()}</span><time title="${esc(full(m.at))}" datetime="${new Date(m.at).toISOString()}">${ago(m.at)}${m.edited ? " · edited" : ""}</time></header>`}${m.fromDoubts ? `<p class="ch-re">${ic("chat", "1em")} Answering questions from the group</p>` : ""}<p class="ch-body">${esc(m.text)}</p></div></article>`;
        prev = m;
      });
      box.innerHTML = html;
      const first = !box.dataset.n; box.dataset.n = cur.messages.length;
      if (first) setTimeout(() => (document.getElementById("ch-new") || box.lastElementChild)?.scrollIntoView({ block: document.getElementById("ch-new") ? "start" : "end" }), 80); // after the page has jumped to the top
      else if (nearBottom) box.lastElementChild?.scrollIntoView({ block: "end", behavior: "smooth" });
    };
    // Members cannot write in the chat. They can send the host or planner one short private doubt (and see its state); only the host or planner reads it.
    const compose = app.querySelector("#ch-compose");
    const paintCompose = () => {
      const cur = chatById(id); if (!cur) return;
      const inp = compose.querySelector("input"), typing = inp?.value || "", focus = document.activeElement === inp, left = doubtsLeft(cur), mine = myDoubts(cur), who2 = esc(cur.host.name);
      if (isClosed(cur)) { compose.innerHTML = `<p class="ch-lock">${ic("chat", "1.2em")}<span>This chat is closed, so questions and doubts are off. Thanks for coming.</span></p>`; return; }
      compose.innerHTML = `<section class="ch-doubt" aria-labelledby="ch-dh"><h2 id="ch-dh">Last-minute doubt?</h2><p>Ask ${who2} privately. Only they see it. If it helps everyone, they'll post an update here.</p>
          ${left ? `<form id="ch-df" autocomplete="off"><div class="ch-dbox"><input name="d" maxlength="${DOUBT_MAX}" placeholder="Type your question" aria-label="Your question for ${who2}" /><button type="submit" class="btn small" ${navigator.onLine ? "" : "disabled"}>Send</button></div><small class="ch-dcount"><span id="ch-dn">0</span>/${DOUBT_MAX} · ${left} of ${DOUBT_LIMIT} left</small></form>` : `<p class="ch-dcount">You've used all ${DOUBT_LIMIT} questions for this chat.</p>`}
          ${mine.length ? `<ul class="ch-dlist">${mine.map((d) => `<li><span>${esc(d.text)}</span><i class="${d.status}">${d.status === "answered" ? "Answered in an update" : "Sent · only " + who2 + " sees it"}</i></li>`).join("")}</ul>` : ""}</section>`;
      const f = compose.querySelector("#ch-df");
      if (f) {
        const n = compose.querySelector("#ch-dn"); f.d.value = typing; n.textContent = typing.length; if (focus) f.d.focus();
        f.d.addEventListener("input", () => { n.textContent = f.d.value.length; });
        f.addEventListener("submit", (e) => { e.preventDefault(); const t = f.d.value; f.d.value = ""; if (sendDoubt(id, t)) toast(`Sent to ${cur.host.name}. Only they can see it`); else if (t.trim()) toast("That couldn't be sent. Keep it under 160 characters"); });
      }
    };
    const offline = () => { const o = app.querySelector("#ch-off"); if (o) o.hidden = navigator.onLine; paintCompose(); };
    window.addEventListener("online", offline); window.addEventListener("offline", offline);
    app.querySelector("#ch-off").hidden = navigator.onLine;
    app.querySelector("[data-more]").addEventListener("click", () => openOptions(id));
    paint(); paintCompose();
    box.addEventListener("click", (e) => { const b = e.target.closest("[data-opt]"); if (!b) return; const card = b.closest("[data-q]"); const f = card.querySelector(".ch-qnote input"); if (answerQuestion(id, card.dataset.q, b.dataset.opt, f?.value || "")) toast(`Thanks, the ${asker(chatById(id))} sees your answer`); });
    box.addEventListener("submit", (e) => { const f = e.target.closest(".ch-qnote"); if (!f) return; e.preventDefault(); const card = f.closest("[data-q]"), cur = chatById(id), q = questionById(cur, card.dataset.q); if (q?.answers.me && answerQuestion(id, q.id, q.answers.me.option, f.n.value)) toast("Note saved"); });
    window.__chatPaint = () => { const cur = chatById(id); if (cur && unreadIn(cur) > 0) markRead(id); paint(); paintCompose(); }; // marks read only when something is unread: markRead itself announces a change, which would call this again forever // called when a message or a setting changes while this chat is open
    window.__chatId = id;
  }

  /* ---------- Chat options: mute, report ---------- */
  function sheet(html, onWire) {
    const back = document.createElement("div"); back.className = "wd-back";
    back.innerHTML = `<div class="wd-card" role="dialog" aria-modal="true">${html}</div>`;
    document.body.append(back);
    const close = () => { document.removeEventListener("keydown", onKey); back.classList.remove("show"); setTimeout(() => back.remove(), 200); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    back.addEventListener("click", (e) => { if (e.target === back || e.target.closest("[data-cancel]")) close(); });
    onWire(back, close); requestAnimationFrame(() => back.classList.add("show"));
  }
  function openOptions(id) {
    const c = chatById(id); if (!c) return;
    sheet(`<h2>Chat options</h2><p class="sp-sub">${esc(c.title)}</p>
      <div class="ch-opts-list"><button type="button" class="btn small ghost" data-mute>${isMuted(id) ? "Unmute this chat" : "Mute this chat"}</button><p class="gt-note">Muted chats stop showing badges and "Updates for you" cards. You can still open them.</p>
      <button type="button" class="btn small ghost" data-report>Report this chat</button></div>
      <div class="wd-btns"><button type="button" class="btn small" data-cancel>Done</button></div>`, (back, close) => {
      back.querySelector("[data-mute]").addEventListener("click", () => { toast(toggleMute(id) ? "Chat muted" : "Chat unmuted"); close(); });
      back.querySelector("[data-report]").addEventListener("click", () => { close(); setTimeout(() => openReport(id), 220); });
    });
  }
  function openReport(id) {
    const c = chatById(id); if (!c) return;
    sheet(`<form id="ch-rep"><h2>Report this chat</h2><p class="sp-sub">Tell PB&amp;J what's wrong. The ${asker(c)} won't be told who reported.</p>
      <fieldset class="ch-reasons"><legend class="sr">Reason</legend>${REPORT_REASONS.map((r, i) => `<label class="ch-reason"><input type="radio" name="r" value="${esc(r)}" ${i === 0 ? "checked" : ""} /> ${esc(r)}</label>`).join("")}</fieldset>
      <textarea name="n" maxlength="300" placeholder="Anything else we should know? (optional)" aria-label="More details"></textarea>
      <div class="wd-btns"><button type="button" class="btn small ghost" data-cancel>Cancel</button><button type="submit" class="btn small">Send report</button></div></form>`, (back, close) => {
      back.querySelector("#ch-rep").addEventListener("submit", (e) => { e.preventDefault(); const f = e.target; reportChat(id, f.r.value, f.n.value); close(); toast("Thanks. The PB&J team will look at it"); });
    });
  }

  /* ---------- Get a ticket (this is where the event's chat opens) ---------- */
  function openTicket(title, after) {
    const e = EVENTS.find((x) => x.title === title); if (!e) return;
    const free = /free/i.test(e.price);
    const back = document.createElement("div"); back.className = "wd-back";
    back.innerHTML = `<form class="wd-card" role="dialog" aria-modal="true" aria-label="Get your ticket"><h2>${free ? "Reserve your spot" : "Get your ticket"}</h2><p class="sp-sub">${esc(e.title)} · ${esc(e.price)}</p>
      <p class="gt-note">You're signed in, so the host's updates reach you in Messages, on For you and on the bell. If someone buys without an account, we send theirs to the email or number they give.</p>
      <p class="gt-note"><b>Demo:</b> no payment is taken.</p>
      <div class="wd-btns"><button type="button" class="btn small ghost" data-cancel>Cancel</button><button type="submit" class="btn small">${free ? "Reserve" : "Get ticket"}</button></div></form>`;
    document.body.append(back);
    const close = () => { document.removeEventListener("keydown", onKey); back.classList.remove("show"); setTimeout(() => back.remove(), 200); };
    const onKey = (ev2) => { if (ev2.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    back.addEventListener("click", (ev2) => { if (ev2.target === back || ev2.target.closest("[data-cancel]")) close(); });
    back.querySelector("form").addEventListener("submit", (ev2) => {
      ev2.preventDefault(); const id = buyTicket(title, { loggedIn: true }); close();
      toast("You're in. The group chat is in Messages"); after?.(id);
    });
    requestAnimationFrame(() => { back.classList.add("show"); back.querySelector("button[type=submit]").focus({ preventScroll: true }); });
  }

  /** Re-draws what needs it when a message arrives (here or in another tab of this browser). */
  onChats(() => {
    const h = location.hash;
    if (h.startsWith("#/chat/") && window.__chatId && window.__chatPaint) window.__chatPaint();
    else if (h.startsWith("#/messages")) renderMessages();
    document.querySelectorAll("[data-bell]").forEach((b) => { const n = unreadCount(); b.querySelector(".bl-dot")?.remove(); if (n) b.insertAdjacentHTML("beforeend", `<i class="bl-dot">${n > 9 ? "9+" : n}</i>`); });
    document.querySelectorAll(".sp-dock [data-r='messages']").forEach((a) => a.classList.toggle("has", unreadCount() > 0));
  });

  return { renderMessages, renderChat, bell, updatesCard, openTicket, hasTicket, chatIdForEvent, unreadCount };
}
