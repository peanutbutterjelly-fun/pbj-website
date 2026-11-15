// The host and planner screen: run an event's or a plan's group chat.
//   - send an update (it reaches everyone at once)
//   - read the last-minute doubts members sent (with their names), answer the group in one update, or set a doubt aside
//   - send one quick question with tap-to-answer options (optionally with a short note), watch the answers come in, close it
// Hosts and sponty planners use the same screen. For now it opens any chat in this browser (a demo view): once accounts exist it
// will only list the chats you run. The functions it uses live in chats.js.
import { EVENTS } from "./eventsData.js";
import { PEOPLE } from "./people.js";
import { chatList, chatById, postUpdate, askQuestion, closeQuestion, openQuestion, tally, plannerNotes, pendingDoubts, dismissDoubt, receiveDoubt, reach, waitingDoubts, onChats } from "./chats.js";

const ago = (t) => { const s = Math.max(0, (Date.now() - t) / 1000); return s < 60 ? "now" : s < 3600 ? Math.floor(s / 60) + "m" : s < 86400 ? Math.floor(s / 3600) + "h" : Math.floor(s / 86400) + "d"; };
const SAMPLE_DOUBTS = ["Is there parking nearby?", "I might be 10 minutes late, is that okay?", "Can I bring a friend who hasn't booked?", "Is it okay to come in sandals?"];

export function initConsole(k) {
  const { app, esc, toast, bread, ic, KINDS, PAPER } = k;
  const role = (c) => (c.kind === "plan" ? "planner" : "host");
  const tile = (c) => { const e = c.kind === "event" ? EVENTS.find((x) => x.title === c.ref) : null;
    return e ? `<span class="fd-thumb" style="background:${PAPER[e.paper] || "var(--bread)"};color:${e.paper === "jam" || e.paper === "brown" ? "var(--cream)" : "var(--brown)"}">${KINDS[e.kind] || "✨"}</span>` : `<span class="fd-thumb" style="background:var(--bread);color:var(--brown)">${ic("people", "1.2em")}</span>`; };
  const asker = (c, h) => (h === "me" ? "You" : c.members.find((m) => m.handle === h)?.name || PEOPLE.find((p) => p.handle === h)?.name || h);

  /* ---------- Chats you run ---------- */
  function renderList() {
    document.title = "Host and planner screen — PeanutButterJelly.vip";
    const list = chatList();
    app.innerHTML = `<a class="back" href="#/messages">← Messages</a><div class="sp-bar"><h1 class="cut">Run a chat</h1></div>
      <p class="sp-sub mg-lead">The group chats for events you host and plans you run.</p>
      ${list.length ? `<div class="ch-list">${list.map((c) => { const w = pendingDoubts(c).length, q = openQuestion(c);
        return `<a class="ch-row ${w ? "unread" : ""}" href="#/manage/${esc(c.id)}">${tile(c)}<span class="ch-mid"><b>${esc(c.title)}</b><small class="ch-last">${w ? `${w} question${w === 1 ? "" : "s"} waiting` : "Nothing waiting"}${q ? " · a question is open" : ""}</small><small class="ch-kind">${c.kind === "plan" ? "Sponty plan" : "Event"} · ${c.members.length} going</small></span><span class="ch-end">${w ? `<i class="bl-dot">${w}</i>` : ""}</span></a>`; }).join("")}</div>`
      : `<section class="sp-card msg-empty"><h2>No chats to run yet</h2><p class="sp-sub">List an event or start a sponty plan first. Its group chat opens here once people join.</p>
        <div class="as-btns"><a class="btn small" href="/dashboard.html#/create/0">List an event</a><button type="button" class="btn small ghost" data-soon="Starting a sponty plan is coming soon">Start a sponty plan</button></div>
        <p class="sp-sub mg-try">Demo: any event you get a ticket for shows up here too.</p></section>`}`;
  }

  /* ---------- One chat ---------- */
  let opts = ["", ""]; // the question's option boxes, kept while you type
  function renderManage(id) {
    const c0 = chatById(id);
    if (!c0) { document.title = "Run a chat — PeanutButterJelly.vip"; app.innerHTML = `<a class="back" href="#/manage">← Chats you run</a><section class="sp-card msg-empty"><h2>We couldn't find that chat</h2><a class="btn" href="#/manage">Back</a></section>`; return; }
    document.title = `Run ${c0.title} — PeanutButterJelly.vip`;
    app.innerHTML = `<a class="back" href="#/manage">← Chats you run</a>
      <header class="ch-head">${tile(c0)}<div><h1 class="cut">${esc(c0.title)}</h1><p class="sp-sub">${c0.kind === "plan" ? "Sponty plan" : "Event"} · ${esc(c0.area)} · ${c0.members.length} going · you are the ${role(c0)}</p></div></header>
      <p class="mg-demo">Members can only read the chat and send you a private doubt. <b>Demo view:</b> opens any chat for now.</p>
      <div id="mg-body"></div>
      <a class="fd-link mg-see" href="#/chat/${esc(id)}">See this chat as a member</a>`;
    const body = app.querySelector("#mg-body");
    // Keep what is being typed when the screen redraws (a new answer or doubt arrives)
    const keep = () => { const o = {}; body.querySelectorAll("textarea, input").forEach((el) => { if (el.name) o[el.name + (el.dataset.i || "")] = el.value; }); o.focus = document.activeElement?.name ? document.activeElement.name + (document.activeElement.dataset.i || "") : ""; o.checks = [...body.querySelectorAll(".mg-d input:checked")].map((x) => x.value); o.noteOn = body.querySelector("[name=note]")?.checked; return o; };
    const paint = (saved = {}) => {
      const c = chatById(id); if (!c) return;
      const r = reach(c), pend = pendingDoubts(c), oq = openQuestion(c), closed = (c.questions || []).filter((q) => q.status === "closed").reverse();
      const who = role(c);
      const results = (q) => { const t = tally(q), total = t.reduce((n, o) => n + o.n, 0) || 1, notes = plannerNotes(c, q.id);
        return `<div class="ch-opts">${t.map((o) => `<div class="ch-opt res"><span class="ch-fill" style="width:${Math.round((o.n / total) * 100)}%"></span><span class="ch-ol">${esc(o.label)}</span><b>${o.n}</b></div>`).join("")}</div>
          <small class="mg-meta">${Object.keys(q.answers).length} of ${c.members.length} answered</small>${notes.length ? `<ul class="mg-notes">${notes.map((n) => `<li><b>${esc(n.name)}</b> · ${esc(n.option)}<span>${esc(n.note)}</span></li>`).join("")}</ul>` : ""}`; };
      const checks = saved.checks;
      body.innerHTML = `
        <section class="sp-card mg-sec"><h2>Send an update</h2><p>Everyone in the chat gets it at once. It reaches ${r.inApp} in the app${r.email || r.sms ? ` and ${Math.max(r.email, r.sms)} guest${Math.max(r.email, r.sms) === 1 ? "" : "s"} by ${r.email && r.sms ? "email and text" : r.email ? "email" : "text"}` : ""}.</p>
          <form id="mg-upd"><textarea name="t" maxlength="600" placeholder="What does everyone need to know?" aria-label="Your update">${esc(saved.t || "")}</textarea><div class="mg-row"><small><span id="mg-un">${(saved.t || "").length}</span>/600</small><button type="submit" class="btn small">Send update</button></div></form></section>

        <section class="sp-card mg-sec"><h2>Last-minute doubts <span class="fd-count">${pend.length}</span></h2>
          ${pend.length ? `<p>Only you see these. Tick the ones your update answers, write one update for everyone, and the people who asked see "answered in an update".</p>
            <ul class="mg-dl">${pend.map((d) => `<li class="mg-d"><label><input type="checkbox" value="${esc(d.id)}" ${checks ? (checks.includes(d.id) ? "checked" : "") : "checked"} /><span><b>${esc(asker(c, d.from))}</b> · ${ago(d.at)}<em>${esc(d.text)}</em></span></label><button type="button" class="fd-link" data-dismiss="${esc(d.id)}">set aside</button></li>`).join("")}</ul>
            <form id="mg-ans"><textarea name="a" maxlength="600" placeholder="Your update for everyone" aria-label="Your update answering the doubts">${esc(saved.a || "")}</textarea><div class="mg-row"><small><span id="mg-an">${(saved.a || "").length}</span>/600</small><button type="submit" class="btn small">Post update to everyone</button></div></form>`
          : `<p class="mg-none">Nothing waiting. Doubts from people going show up here.</p>`}
          <button type="button" class="ch-demo" id="mg-sample">Demo: add sample doubts</button></section>

        <section class="sp-card mg-sec"><h2>Quick question</h2>
          ${oq ? `<p class="mg-qt"><b>${esc(oq.text)}</b></p>${results(oq)}<button type="button" class="btn small ghost" id="mg-close">Close the question</button>`
            : `<p>Ask the group one optional question with tap-to-answer options. Only one can be open at a time.</p>
            <form id="mg-q"><input name="q" maxlength="140" placeholder="Your question" aria-label="Your question" value="${esc(saved.q || "")}" />
              <div class="mg-opts">${opts.map((o, i) => `<div class="mg-o"><input name="o" data-i="${i}" maxlength="40" placeholder="Option ${i + 1}" aria-label="Option ${i + 1}" value="${esc(saved["o" + i] ?? o)}" />${opts.length > 2 ? `<button type="button" class="mg-rm" data-rm="${i}" aria-label="Remove option ${i + 1}">×</button>` : ""}</div>`).join("")}</div>
              ${opts.length < 4 ? `<button type="button" class="fd-link" id="mg-addo">+ add an option</button>` : ""}
              <label class="mg-chk"><input type="checkbox" name="note" ${saved.noteOn ? "checked" : ""} /> Let people add a short note</label>
              <div class="mg-row"><small>2 to 4 options</small><button type="submit" class="btn small">Send question</button></div></form>`}
          ${closed.length ? `<details class="mg-past"><summary>Earlier questions (${closed.length})</summary>${closed.map((q) => `<div class="mg-pq"><b>${esc(q.text)}</b>${results(q)}</div>`).join("")}</details>` : ""}</section>`;
      const upd = body.querySelector("#mg-upd");
      upd.t.addEventListener("input", () => { body.querySelector("#mg-un").textContent = upd.t.value.length; });
      upd.addEventListener("submit", (e) => { e.preventDefault(); const t = upd.t.value; if (!t.trim()) { upd.t.focus(); return; } upd.t.value = ""; postUpdate(id, t); toast("Update sent to everyone"); });
      const ans = body.querySelector("#mg-ans");
      if (ans) {
        ans.a.addEventListener("input", () => { body.querySelector("#mg-an").textContent = ans.a.value.length; });
        ans.addEventListener("submit", (e) => { e.preventDefault(); const ids = [...body.querySelectorAll(".mg-d input:checked")].map((x) => x.value); if (!ans.a.value.trim()) { ans.a.focus(); return; } if (!ids.length) { toast("Tick the doubts this update answers"); return; } const t = ans.a.value; ans.a.value = ""; postUpdate(id, t, { answersDoubts: ids }); toast("Posted. The people who asked can see it was answered"); });
        body.querySelectorAll("[data-dismiss]").forEach((b) => b.addEventListener("click", () => { dismissDoubt(id, b.dataset.dismiss); toast("Set aside"); }));
      }
      body.querySelector("#mg-sample").addEventListener("click", () => { const names = c.members.filter((m) => m.handle !== "me"); SAMPLE_DOUBTS.slice(0, Math.min(3, names.length)).forEach((t, i) => receiveDoubt(id, names[i].handle, t)); });
      body.querySelector("#mg-close")?.addEventListener("click", () => { closeQuestion(id, oq.id); toast("Question closed"); });
      const qf = body.querySelector("#mg-q");
      if (qf) {
        const sync = () => { opts = [...qf.querySelectorAll("[name=o]")].map((x) => x.value); };
        qf.addEventListener("input", sync);
        body.querySelector("#mg-addo")?.addEventListener("click", () => { sync(); opts.push(""); paint(keep()); });
        qf.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => { sync(); opts.splice(+b.dataset.rm, 1); paint({ ...keep(), ...Object.fromEntries(opts.map((o, i) => ["o" + i, o])) }); }));
        qf.addEventListener("submit", (e) => { e.preventDefault(); sync(); const filled = opts.map((o) => o.trim()).filter(Boolean);
          if (!qf.q.value.trim()) { qf.q.focus(); toast("Write your question first"); return; }
          if (filled.length < 2) { toast("Add at least two options"); return; }
          if (askQuestion(id, { text: qf.q.value, options: filled, allowNote: qf.note.checked })) { opts = ["", ""]; toast("Question sent to everyone"); } });
      }
      if (saved.focus) { const [nm, i] = [saved.focus.replace(/\d+$/, ""), saved.focus.match(/\d+$/)?.[0]]; const el = body.querySelector(i != null && nm === "o" ? `[name=o][data-i="${i}"]` : `[name=${nm}]`); el?.focus(); }
    };
    paint();
    window.__manageId = id; window.__managePaint = () => paint(keep());
  }

  onChats(() => {
    if (location.hash.startsWith("#/manage/") && window.__managePaint) window.__managePaint();
    else if (location.hash === "#/manage") renderList();
  });

  return { renderList, renderManage, waitingDoubts };
}
