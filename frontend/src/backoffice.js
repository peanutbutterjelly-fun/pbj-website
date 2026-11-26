// The back office: PB&J staff run the platform here (backoffice.peanutbutterjelly.fun).
// One staff username and password, checked by the server on every request (backend/app/admin_auth.py). It's kept only
// for this browser tab (sessionStorage), so closing the tab signs you out.
// Everything shown comes from people (event titles, sign-ups, reports), so every value is escaped before it goes on the page.

const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const KEY = "pbj-backoffice";
const $ = (sel, root = document) => root.querySelector(sel);
const view = $("#view");

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const img = (u) => (typeof u === "string" && /^https:\/\/[^\s'"()<>\\]+$/.test(u) ? u : "");
const when = (v) => (v ? new Date(v).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");
const day = (v) => (v ? new Date(`${v}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "No date");
const TYPE_NAMES = { guestlist: "Sponty plan", exclusive: "Exclusive event", open: "Open event" };
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// ---- talking to the server ----

let login = null;
try { login = sessionStorage.getItem(KEY); } catch { /* private mode: sign in again on reload */ }

class Refused extends Error {}

async function api(path, { method = "GET", body, auth = login } = {}) {
  if (!API) throw new Error("The server address (VITE_API_URL) isn't set.");
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new Refused("Wrong username or password");
  if (!res.ok) {
    let detail = `Something went wrong (${res.status})`;
    try { const d = (await res.json()).detail; detail = typeof d === "string" ? d : d?.[0]?.msg || detail; } catch { /* no readable reason */ }
    throw new Error(detail);
  }
  return res.status === 204 ? null : res.json();
}

function toast(text, bad = false) {
  const t = $("#toast");
  t.textContent = text;
  t.className = `bo-toast${bad ? " bad" : ""}`;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 3200);
}

// Runs a staff action; on success shows `done` and redraws the screen
async function act(fn, done) {
  try {
    await fn();
    if (done) toast(done);
    route();
  } catch (err) {
    if (err instanceof Refused) return signedOut("Please sign in again.");
    toast(err.message, true);
  }
}

// A small box asking for a reason or a confirmation. Resolves to the typed text (or true), or null when cancelled.
function ask({ title, text = "", field = null, confirm = "OK", danger = false }) {
  return new Promise((resolve) => {
    const d = document.createElement("dialog");
    d.className = "bo-dialog";
    d.innerHTML = `<form method="dialog" class="bo-card"><h3>${esc(title)}</h3>${text ? `<p class="bo-muted">${esc(text)}</p>` : ""}
      ${field ? `<label>${esc(field)}<textarea name="v" rows="3" maxlength="300" required></textarea></label>` : ""}
      <div class="bo-buttons"><button class="bo-btn ghost" value="cancel" formnovalidate>Cancel</button><button class="bo-btn ${danger ? "jam" : "bread"}" value="ok">${esc(confirm)}</button></div></form>`;
    document.body.append(d);
    d.addEventListener("close", () => {
      const v = d.returnValue === "ok" ? (field ? d.querySelector("textarea").value.trim() || null : true) : null;
      d.remove();
      resolve(v);
    });
    d.showModal();
  });
}

// ---- signing in and out ----

function signedOut(message = "") {
  login = null;
  try { sessionStorage.removeItem(KEY); } catch { /* nothing kept */ }
  $("#app").hidden = true;
  $("#login").hidden = false;
  const msg = $("#login-msg");
  msg.textContent = message;
  msg.hidden = !message;
  $("#login-form [name=username]").focus();
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.currentTarget, button = f.querySelector("button"), msg = $("#login-msg");
  const auth = btoa(unescape(encodeURIComponent(`${f.username.value.trim()}:${f.password.value}`)));
  button.disabled = true;
  msg.hidden = true;
  try {
    await api("/admin/login", { method: "POST", auth });
    login = auth;
    try { sessionStorage.setItem(KEY, auth); } catch { /* signed in until reload */ }
    f.reset();
    start();
  } catch (err) {
    msg.textContent = err instanceof Refused ? "Wrong username or password." : err.message;
    msg.hidden = false;
  } finally {
    button.disabled = false;
  }
});

$("#sign-out").addEventListener("click", () => signedOut("Signed out."));

// ---- screens ----

const head = (title, sub = "", extra = "") => `<div class="bo-head"><div><h1>${esc(title)}</h1>${sub ? `<p class="bo-muted">${sub}</p>` : ""}</div>${extra}</div>`;
const chips = (name, options, current) => `<div class="bo-chips" role="group">${options.map(([v, label]) =>
  `<button type="button" class="bo-chip${v === current ? " on" : ""}" data-${name}="${esc(v)}" aria-pressed="${v === current}">${esc(label)}</button>`).join("")}</div>`;
const empty = (text) => `<div class="bo-empty">${esc(text)}</div>`;
const table = (cols, rows) => `<table class="bo-table"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
const td = (label, html, cls = "") => `<td data-label="${esc(label)}"${cls ? ` class="${cls}"` : ""}>${html}</td>`;

// The search box and filter chips keep their state in the address (#/events?show=hidden&q=clay), so the back button works
function params() { return new URLSearchParams(location.hash.split("?")[1] || ""); }
function go(page, changes) {
  const p = params();
  for (const [k, v] of Object.entries(changes)) (v ? p.set(k, v) : p.delete(k));
  const qs = p.toString();
  location.hash = `#/${page}${qs ? `?${qs}` : ""}`;
}
function wireTools(page) {
  view.querySelectorAll("[data-show]").forEach((b) => b.addEventListener("click", () => go(page, { show: b.dataset.show })));
  const search = view.querySelector("input[type=search]");
  if (search) {
    let t;
    search.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => go(page, { q: search.value.trim() }), 350); });
  }
}
const searchBox = (placeholder) => `<input type="search" placeholder="${esc(placeholder)}" value="${esc(params().get("q") || "")}" aria-label="Search" />`;
const query = (extra = {}) => { const p = params(); const out = new URLSearchParams(); for (const k of ["q", "show", "kind"]) if (p.get(k)) out.set(k, p.get(k)); for (const [k, v] of Object.entries(extra)) out.set(k, v); return out.toString(); };

const screens = {
  async overview() {
    const s = await api("/admin/overview");
    const stat = (n, label, href, cls = "") => `<a class="bo-stat ${cls}" href="${href}"><b>${esc(n)}</b>${esc(label)}</a>`;
    view.innerHTML = head("Hello, team", "What's happening on PB&amp;J right now.") +
      `<div class="bo-stats">
        ${stat(s.to_review, "Events to review", "#/events?show=to_review", s.to_review ? "hot" : "")}
        ${stat(s.open_reports, "Open reports", "#/reports", s.open_reports ? "jam" : "")}
        ${stat(s.leads_this_week, "New leads this week", "#/leads")}
        ${stat(s.live_events, "Live events", "#/events?show=live")}
        ${stat(s.people, "People signed up", "#/people")}
        ${stat(s.hosts, "Hosts", "#/people?show=hosts")}
        ${stat(s.verified, "Identity verified", "#/people?show=verified")}
        ${stat(s.tickets, "Tickets held", "#/events")}
      </div>
      <div class="bo-card"><h3>Good to know</h3><p class="bo-muted">Hiding an event takes it off the site at once (its host still sees it). Broadcasts are saved and go out once real notifications are switched on. ${esc(plural(s.hidden_events, "event"))} hidden, ${esc(plural(s.leads, "lead"))} in total.</p></div>`;
  },

  async events() {
    const show = params().get("show") || "all";
    const rows = await api(`/admin/events?${query()}`);
    view.innerHTML = head("Events", "Every event, drafts too. Review new ones, hide anything that shouldn't be on PB&amp;J.") +
      `<div class="bo-tools">${searchBox("Search title, host or email")}${chips("show", [["all", "All"], ["to_review", "To review"], ["live", "Live"], ["hidden", "Hidden"], ["draft", "Drafts"]], show)}</div>` +
      (rows.length ? table(["Event", "Host", "When", "Status", ""], rows.map((e) => {
        const cover = img(e.cover);
        const pills = [e.hidden_at ? `<span class="bo-pill hidden" title="${esc(e.hidden_reason)}">Hidden</span>` : "",
          `<span class="bo-pill ${e.status === "draft" ? "draft" : "live"}">${esc(e.status)}</span>`,
          e.reviewed_at ? "" : (e.status === "draft" ? "" : `<span class="bo-pill bread">New</span>`),
          e.open_reports ? `<span class="bo-pill open">${esc(plural(e.open_reports, "report"))}</span>` : ""].join("");
        return `<tr>
          ${td("Event", `<div class="bo-who">${cover ? `<img class="bo-thumb" src="${esc(cover)}" alt="" loading="lazy" />` : `<span class="bo-thumb"></span>`}<div><span class="bo-title">${esc(e.title || "Untitled")}</span><span class="bo-sub">${esc([TYPE_NAMES[e.type] || e.type, e.city, `${e.going} going`].filter(Boolean).join(" · "))}</span>${e.hidden_reason ? `<span class="bo-sub">Hidden: ${esc(e.hidden_reason)}</span>` : ""}</div></div>`)}
          ${td("Host", `<span class="bo-title">${esc(e.host_name || "—")}</span><span class="bo-sub">${esc(e.host_email || "")}</span>`)}
          ${td("When", `${esc(day(e.starts_on))}<span class="bo-sub">Made ${esc(when(e.created_at))}</span>`)}
          ${td("Status", pills)}
          ${td("", `${e.reviewed_at || e.status === "draft" ? "" : `<button class="bo-btn small bread" data-review="${esc(e.id)}">Looks good</button>`}
            ${e.hidden_at ? `<button class="bo-btn small" data-unhide="${esc(e.id)}">Show again</button>` : `<button class="bo-btn small" data-hide="${esc(e.id)}">Hide</button>`}
            <button class="bo-btn small ghost" data-chat="${esc(e.id)}">Chat</button>
            <button class="bo-btn small ghost" data-delete="${esc(e.id)}" data-title="${esc(e.title || "this event")}">Delete</button>`, "actions")}
        </tr>`;
      })) : empty("No events here."));
    wireTools("events");
    view.querySelectorAll("[data-review]").forEach((b) => b.addEventListener("click", () => act(() => api(`/admin/events/${b.dataset.review}/review`, { method: "POST" }), "Marked as reviewed")));
    view.querySelectorAll("[data-unhide]").forEach((b) => b.addEventListener("click", () => act(() => api(`/admin/events/${b.dataset.unhide}/unhide`, { method: "POST" }), "It's back on the site")));
    view.querySelectorAll("[data-hide]").forEach((b) => b.addEventListener("click", async () => {
      const reason = await ask({ title: "Hide this event?", text: "It leaves the Events page and its link straight away, and takes no new tickets. Its host still sees it.", field: "Why (only staff see this)", confirm: "Hide it", danger: true });
      if (reason) act(() => api(`/admin/events/${b.dataset.hide}/hide`, { method: "POST", body: { reason } }), "Hidden from the site");
    }));
    view.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", async () => {
      const ok = await ask({ title: `Delete “${b.dataset.title}” for good?`, text: "Its tickets, guest list and chat go too. This can't be undone. Hiding is usually enough.", confirm: "Delete for good", danger: true });
      if (ok) act(() => api(`/admin/events/${b.dataset.delete}?confirm=DELETE`, { method: "DELETE" }), "Deleted");
    }));
    view.querySelectorAll("[data-chat]").forEach((b) => b.addEventListener("click", () => { location.hash = `#/chat?event=${encodeURIComponent(b.dataset.chat)}`; }));
  },

  async chat() {
    const id = params().get("event") || "";
    const [ev, msgs] = await Promise.all([api(`/admin/events/${encodeURIComponent(id)}`), api(`/admin/events/${encodeURIComponent(id)}/messages`)]);
    view.innerHTML = head(`Chat: ${ev.title || "Untitled"}`, `${esc(ev.chat ? plural(ev.chat.members, "member") : "No chat yet: it opens when the first guest gets a ticket.")}`, `<a class="bo-btn" href="#/events">Back to events</a>`) +
      (msgs.length ? table(["Message", "From", "Sent", ""], msgs.map((m) => `<tr>
        ${td("Message", `<span class="bo-note">${esc(m.body)}</span>${m.kind === "system" ? `<span class="bo-sub">Automatic notice</span>` : ""}`)}
        ${td("From", `${esc(m.sender_name || "—")}${m.sender_handle ? `<span class="bo-sub">@${esc(m.sender_handle)}</span>` : ""}`)}
        ${td("Sent", esc(when(m.created_at)))}
        ${td("", `<button class="bo-btn small ghost" data-remove="${esc(m.id)}">Remove</button>`, "actions")}
      </tr>`)) : empty("No messages yet."));
    view.querySelectorAll("[data-remove]").forEach((b) => b.addEventListener("click", async () => {
      if (await ask({ title: "Remove this message?", text: "Everyone in the chat stops seeing it. This can't be undone.", confirm: "Remove", danger: true })) {
        act(() => api(`/admin/messages/${b.dataset.remove}`, { method: "DELETE" }), "Message removed");
      }
    }));
  },

  async people() {
    const show = params().get("show") || "all";
    const rows = await api(`/admin/people?${query()}`);
    view.innerHTML = head("People", "Approve hosts, give badges, and mark people identity-verified once you've checked their ID.") +
      `<div class="bo-tools">${searchBox("Search name, handle, email or phone")}${chips("show", [["all", "Everyone"], ["unverified_hosts", "Hosts to check"], ["hosts", "Hosts"], ["verified", "Verified"]], show)}</div>` +
      (rows.length ? table(["Person", "Contact", "Role", "Badge", "Activity", ""], rows.map((p) => {
        const photo = img(p.avatar_url);
        return `<tr>
          ${td("Person", `<div class="bo-who">${photo ? `<img class="bo-thumb" src="${esc(photo)}" alt="" loading="lazy" />` : `<span class="bo-thumb"></span>`}<div><span class="bo-title">${esc(p.full_name || "No name yet")}</span><span class="bo-sub">${p.handle ? `@${esc(p.handle)} · ` : ""}${esc(p.city || "")}</span>${p.verified_at ? `<span class="bo-pill live">Verified</span>` : ""}</div></div>`)}
          ${td("Contact", `${esc(p.email || "")}<span class="bo-sub">${esc(p.phone || "")}</span>${p.host_kind ? `<span class="bo-sub">Says: ${esc(p.host_kind)}</span>` : ""}`)}
          ${td("Role", `<select data-role="${esc(p.id)}" aria-label="Role">${["guest", "host", "admin"].map((r) => `<option value="${r}"${r === p.role ? " selected" : ""}>${r}</option>`).join("")}</select>`)}
          ${td("Badge", `<select data-badge="${esc(p.id)}" aria-label="Badge">${["vibes", "sponty", "newbie", "pro", "exclusive"].map((b) => `<option value="${b}"${b === p.badge ? " selected" : ""}>${b}</option>`).join("")}</select>`)}
          ${td("Activity", `${esc(plural(p.events, "event"))} made<span class="bo-sub">${esc(plural(p.tickets, "ticket"))} · joined ${esc(when(p.created_at))}</span>`)}
          ${td("", p.verified_at ? `<button class="bo-btn small ghost" data-verify="${esc(p.id)}" data-on="false">Unverify</button>` : `<button class="bo-btn small bread" data-verify="${esc(p.id)}" data-on="true">Mark verified</button>`, "actions")}
        </tr>`;
      })) : empty("Nobody matches."));
    wireTools("people");
    const change = (id, body, done) => act(() => api(`/admin/people/${id}`, { method: "PATCH", body }), done);
    view.querySelectorAll("[data-role]").forEach((s) => s.addEventListener("change", () => change(s.dataset.role, { role: s.value }, `Role is now ${s.value}`)));
    view.querySelectorAll("[data-badge]").forEach((s) => s.addEventListener("change", () => change(s.dataset.badge, { badge: s.value }, `Badge is now ${s.value}`)));
    view.querySelectorAll("[data-verify]").forEach((b) => b.addEventListener("click", () => change(b.dataset.verify, { verified: b.dataset.on === "true" }, b.dataset.on === "true" ? "Marked verified" : "No longer verified")));
  },

  async reports() {
    const show = params().get("show") || "open";
    const rows = await api(`/admin/reports?${query()}`);
    view.innerHTML = head("Reports", "What members flagged. Look at it, act on the event or person, then mark it done.") +
      `<div class="bo-tools">${chips("show", [["open", "Open"], ["resolved", "Resolved"], ["dismissed", "Dismissed"], ["all", "All"]], show)}</div>` +
      (rows.length ? table(["About", "Why", "From", "Sent", ""], rows.map((r) => `<tr>
        ${td("About", `<span class="bo-pill">${esc(r.target_kind)}</span><span class="bo-title">${esc(r.target_label || r.target_id)}</span>${r.target_kind === "event" ? `<a class="bo-sub" href="#/events?q=${encodeURIComponent(r.target_id)}">Open in Events</a>` : ""}`)}
        ${td("Why", `<span class="bo-title">${esc(r.reason)}</span>${r.note ? `<span class="bo-note bo-sub">${esc(r.note)}</span>` : ""}`)}
        ${td("From", `${esc(r.reporter_name || "Deleted account")}${r.reporter_handle ? `<span class="bo-sub">@${esc(r.reporter_handle)}</span>` : ""}`)}
        ${td("Sent", `${esc(when(r.created_at))}${r.status !== "open" ? `<span class="bo-sub">${esc(r.status)} ${esc(when(r.resolved_at))}</span>` : ""}`)}
        ${td("", r.status === "open" ? `<button class="bo-btn small bread" data-report="${esc(r.id)}" data-to="resolved">Dealt with</button><button class="bo-btn small ghost" data-report="${esc(r.id)}" data-to="dismissed">Dismiss</button>`
          : `<button class="bo-btn small ghost" data-report="${esc(r.id)}" data-to="open">Reopen</button>`, "actions")}
      </tr>`)) : empty(show === "open" ? "No open reports. Lovely." : "Nothing here."));
    wireTools("reports");
    view.querySelectorAll("[data-report]").forEach((b) => b.addEventListener("click", () =>
      act(() => api(`/admin/reports/${b.dataset.report}`, { method: "PATCH", body: { status: b.dataset.to } }), b.dataset.to === "open" ? "Reopened" : "Marked done")));
  },

  async leads() {
    const kind = params().get("kind") || "all";
    const rows = await api(`/admin/leads?${query()}`);
    view.innerHTML = head("Leads", "Everyone who signed up or filled a form on List Your Event.",
      rows.length ? `<button class="bo-btn" id="csv">Download CSV</button>` : "") +
      `<div class="bo-tools">${searchBox("Search name, email or message")}<div class="bo-chips">${[["all", "All"], ["signup", "Sign-ups"], ["form", "Forms"]].map(([v, l]) =>
        `<button type="button" class="bo-chip${v === kind ? " on" : ""}" data-kind="${v}" aria-pressed="${v === kind}">${l}</button>`).join("")}</div></div>` +
      (rows.length ? table(["Who", "Contact", "As", "Message", "Sent"], rows.map((l) => `<tr>
        ${td("Who", `<span class="bo-title">${esc(l.name)}</span><span class="bo-pill">${esc(l.kind)}</span>${l.user_id ? `<span class="bo-pill live">Has account</span>` : ""}`)}
        ${td("Contact", `${esc(l.email)}<span class="bo-sub">${esc(l.phone || "")}</span>${img(l.link) ? `<a class="bo-sub" href="${esc(img(l.link))}" target="_blank" rel="noopener noreferrer">${esc(l.link)}</a>` : (l.link ? `<span class="bo-sub">${esc(l.link)}</span>` : "")}`)}
        ${td("As", esc(l.role || "—"))}
        ${td("Message", `<span class="bo-note">${esc(l.message || (l.answers ? Object.entries(l.answers).map(([k, v]) => `${k}: ${v}`).join("\n") : "—"))}</span>`)}
        ${td("Sent", esc(when(l.created_at)))}
      </tr>`)) : empty("No leads yet."));
    wireTools("leads");
    view.querySelectorAll("[data-kind]").forEach((b) => b.addEventListener("click", () => go("leads", { kind: b.dataset.kind === "all" ? "" : b.dataset.kind })));
    $("#csv")?.addEventListener("click", () => {
      // a leading = + - @ would make a spreadsheet run it as a formula, so those cells get a ' in front
      const cell = (v) => { let s = String(v ?? ""); if (/^[=+\-@]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
      const cols = ["created_at", "kind", "role", "name", "email", "phone", "link", "message", "page"];
      const csv = [cols.join(","), ...rows.map((l) => cols.map((c) => cell(l[c])).join(","))].join("\n");
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: `pbj-leads-${new Date().toISOString().slice(0, 10)}.csv` });
      a.click();
      URL.revokeObjectURL(a.href);
    });
  },

  async picks() {
    const [picks, events] = await Promise.all([api("/admin/featured"), api("/admin/events?show=live&limit=200")]);
    const titles = new Map(events.map((e) => [e.id, e.title || e.id]));
    const card = (p) => `<tr>
      ${td("Pick", `<span class="bo-pill ${p.kind === "highlight" ? "bread" : ""}">${p.kind === "highlight" ? "What you missed" : "List for you"}</span><span class="bo-title">${esc(p.title)}</span><span class="bo-sub">${esc(p.subtitle || "")}</span>`)}
      ${td("Shows", p.kind === "list" && p.query ? `Search: “${esc(p.query)}”` : esc(p.event_ids.map((id) => titles.get(id) || id).join(", ") || "—"))}
      ${td("Order", `${esc(p.position)}${p.live ? "" : `<span class="bo-pill draft">Off</span>`}`)}
      ${td("", `<button class="bo-btn small ghost" data-toggle="${esc(p.id)}">${p.live ? "Turn off" : "Turn on"}</button><button class="bo-btn small ghost" data-drop="${esc(p.id)}">Remove</button>`, "actions")}
    </tr>`;
    view.innerHTML = head("Picks", "What Spontys shows in “What you missed” and “Lists for you”.") +
      `<div class="bo-split"><div>${picks.length ? table(["Pick", "Shows", "Order", ""], picks.map(card)) : empty("No picks yet. Add the first one.")}</div>
      <form class="bo-card bo-form" id="pick-form"><h3>Add a pick</h3>
        <label>Where it shows<select name="kind"><option value="highlight">What you missed (highlight)</option><option value="list">Lists for you</option></select></label>
        <label>Title<input name="title" required maxlength="80" placeholder="Clay night in Bandra" /></label>
        <label>Line under it (optional)<input name="subtitle" maxlength="160" /></label>
        <label>Events<select name="event_ids" multiple size="6">${events.map((e) => `<option value="${esc(e.id)}">${esc(e.title || e.id)} · ${esc(day(e.starts_on))}</option>`).join("")}</select><small class="bo-muted">Hold Ctrl or Cmd to pick several.</small></label>
        <label>Or, for a list, search words (optional)<input name="query" maxlength="120" placeholder="pottery bandra" /></label>
        <div class="row"><label>Order<input name="position" type="number" min="0" max="1000" value="0" /></label><label class="bo-check"><input name="live" type="checkbox" checked /> Show it now</label></div>
        <button class="bo-btn jam" type="submit">Add pick</button></form></div>`;
    $("#pick-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const body = { kind: f.kind.value, title: f.title.value.trim(), subtitle: f.subtitle.value.trim() || null, query: f.query.value.trim() || null,
        event_ids: [...f.event_ids.selectedOptions].map((o) => o.value), position: Number(f.position.value) || 0, live: f.live.checked };
      act(() => api("/admin/featured", { method: "POST", body }), "Pick added");
    });
    const byId = new Map(picks.map((p) => [p.id, p]));
    view.querySelectorAll("[data-toggle]").forEach((b) => b.addEventListener("click", () => {
      const { id, created_at, updated_at, ...p } = byId.get(b.dataset.toggle); // eslint-disable-line no-unused-vars
      act(() => api(`/admin/featured/${id}`, { method: "PUT", body: { ...p, live: !p.live } }), p.live ? "Turned off" : "Turned on");
    }));
    view.querySelectorAll("[data-drop]").forEach((b) => b.addEventListener("click", async () => {
      if (await ask({ title: "Remove this pick?", confirm: "Remove", danger: true })) act(() => api(`/admin/featured/${b.dataset.drop}`, { method: "DELETE" }), "Removed");
    }));
  },

  async broadcasts() {
    const rows = await api("/admin/broadcasts");
    view.innerHTML = head("Broadcasts", "An announcement to everyone on PB&amp;J. They're saved here and go out once real notifications are switched on.") +
      `<div class="bo-split"><div>${rows.length ? table(["Message", "To", "Written"], rows.map((b) => `<tr>
        ${td("Message", `<span class="bo-title">${esc(b.title)}</span><span class="bo-note bo-sub">${esc(b.body)}</span>`)}
        ${td("To", esc(b.audience))}
        ${td("Written", esc(when(b.created_at)))}
      </tr>`)) : empty("Nothing sent yet.")}</div>
      <form class="bo-card bo-form" id="cast-form"><h3>Write one</h3>
        <label>To<select name="audience"><option value="everyone">Everyone</option><option value="members">Members</option><option value="hosts">Hosts</option></select></label>
        <label>Title<input name="title" required maxlength="80" placeholder="Monsoon weekend picks" /></label>
        <label>Message<textarea name="body" rows="5" required maxlength="600"></textarea></label>
        <button class="bo-btn jam" type="submit">Save broadcast</button></form></div>`;
    $("#cast-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const body = { audience: f.audience.value, title: f.title.value.trim(), body: f.body.value.trim() };
      if (await ask({ title: `Save this for ${body.audience}?`, text: body.title, confirm: "Save" })) act(() => api("/admin/broadcasts", { method: "POST", body }), "Broadcast saved");
    });
  },
};

async function route() {
  const page = (location.hash.replace(/^#\/?/, "").split("?")[0] || "overview").toLowerCase();
  const screen = screens[page] ? page : "overview";
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === (screen === "chat" ? "events" : screen)));
  view.setAttribute("aria-busy", "true");
  try {
    await screens[screen]();
  } catch (err) {
    if (err instanceof Refused) return signedOut("Please sign in again.");
    view.innerHTML = head("Couldn't load this") + empty(err.message);
  } finally {
    view.removeAttribute("aria-busy");
  }
}

function start() {
  $("#login").hidden = true;
  $("#app").hidden = false;
  route();
}

window.addEventListener("hashchange", () => { if (login) route(); });
if (login) start(); else signedOut();
