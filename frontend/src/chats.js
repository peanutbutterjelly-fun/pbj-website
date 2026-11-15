// Group chats and host updates for the Spontys app (data and delivery rules only, no screens).
//
// THE RULES
//  - Every event you buy a ticket for gets ONE group chat. Only the host posts in it, as official updates ("update" messages): members cannot write.
//  - Quick questions: the host or the sponty planner can ask the group one (a few tap-to-answer options, and optionally a short note). It is never
//    required, only one is open at a time, and they close it. Everyone sees the counts after answering; names and notes stay with the asker.
//  - Last-minute doubts: any member can send the host/planner one short private question (160 characters, up to 3 per chat). Only the host or planner
//    sees it. If it helps everyone, they post an update ("answering questions from the group") that the whole chat sees.
//  - Updates land in the chat the moment the host posts them.
//      Logged-in member -> the chat in Messages, a card on For you, and a badge on the bell and the Messages icon.
//      Guest (no account) -> the email or phone number saved in the browser when they bought the ticket (the "outbox" below).
//  - Sponty plans: tapping "I'm in" on the For you thread is only a REQUEST. The planner accepts people; once accepted you are added to
//    that plan's group chat with the other people who are going, and the planner can post updates to it.
//
// WHAT IS REAL AND WHAT IS A STAND-IN
//  Everything is kept in this browser (localStorage) until accounts and a database exist, so it works across tabs of the same browser
//  (a host tab posting an update shows up in an open chat tab straight away). Sending real emails or texts, and the planner's accept
//  button, need the backend; the outbox lists exactly what would be sent. See DEMO_AUTO_ACCEPT below.
import { EVENTS } from "./eventsData.js";
import { PEOPLE, POSTS, personBy, hostOfEvent } from "./people.js";

export const DEMO_AUTO_ACCEPT = true; // stand-in for the planner pressing Accept: the request is accepted a few seconds later. Turn off when planners have a real Accept button.
const ACCEPT_AFTER_MS = 6000;

const CHATS = "pbj-chats", PLANS = "pbj-sponty-plans", READ = "pbj-chats-read", OUTBOX = "pbj-outbox", CONTACT = "pbj-buyer-contact";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const ping = () => window.dispatchEvent(new CustomEvent("pbj-chats")); // same tab; other tabs hear the "storage" event
const mid = () => "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

const store = () => read(CHATS, {});
const save = (s) => { write(CHATS, s); ping(); };

/** A few other people who are going, picked the same way every time for the same chat (made-up people for now). */
const going = (seed, n) => {
  let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const pool = PEOPLE.filter((p) => p.badge === "vibes" || p.badge === "sponty"), out = [];
  for (let i = 0; out.length < n && i < pool.length * 2; i++) { const p = pool[(h + i * 7) % pool.length]; if (p && !out.some((o) => o.handle === p.handle)) out.push({ handle: p.handle, name: p.name }); }
  return out;
};
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* ---------- Reading ---------- */
export const chatList = () => Object.values(store()).sort((a, b) => (b.messages.at(-1)?.at || 0) - (a.messages.at(-1)?.at || 0));
export const chatById = (id) => store()[id] || null;
export const chatIdForEvent = (title) => "e:" + slug(title);
export const chatIdForPlan = (postId) => "p:" + postId;
export const hasTicket = (title) => Boolean(store()[chatIdForEvent(title)]);

const seen = () => read(READ, {});
export const unreadIn = (c) => c.messages.filter((m) => m.from !== "me" && m.role !== "system" && m.at > (seen()[c.id] || 0)).length;
export const unreadCount = () => chatList().reduce((n, c) => n + unreadIn(c), 0);
export const seenAt = (id) => seen()[id] || 0;
export const markRead = (id) => { const s = seen(); s[id] = Date.now(); write(READ, s); ping(); };
/** Unread official updates from hosts, newest first (for the For you page). */
export const unreadUpdates = (n = 2) => chatList().flatMap((c) => c.messages.filter((m) => (m.role === "update" || m.role === "question") && m.at > (seen()[c.id] || 0)).map((m) => ({ chat: c, msg: m }))).sort((a, b) => b.msg.at - a.msg.at).slice(0, n);

/* ---------- Plans: "I'm in" is a request ---------- */
export const planStates = () => read(PLANS, {}); // { postId: "requested" | "accepted" }
export const planState = (postId) => planStates()[postId] || "none";

/* ---------- Writing ---------- */
function add(chatId, msg) {
  const s = store(), c = s[chatId]; if (!c) return null;
  const m = { id: mid(), at: Date.now(), ...msg }; c.messages.push(m); save(s); return m;
}

/** Buy a ticket: opens the event's group chat (once) and welcomes you in it. `who` = { loggedIn, email, phone, name }. */
export function buyTicket(title, who = { loggedIn: true }) {
  const e = EVENTS.find((x) => x.title === title); if (!e) return null;
  const id = chatIdForEvent(title), host = personBy(hostOfEvent(e)) || { handle: "@pbj", name: "PB&J" }, s = store();
  if (!s[id]) {
    s[id] = { id, kind: "event", ref: title, title, area: e.area, when: e.date, host: { handle: host.handle, name: host.name }, members: [{ handle: "me", name: "You" }, ...going(title, 5)], audience: [], questions: [], doubts: [], messages: [] };
    save(s);
    add(id, { from: "system", role: "system", text: `You have a ticket for ${title}. Welcome to its group chat.` });
    add(id, { from: host.handle, role: "update", text: `Hi everyone, ${host.name} here. Thanks for coming to ${title}! I'll post every update here: timings, the exact spot, anything you should bring.` });
  }
  const s2 = store();
  // Who gets future updates: the member in the app, or a guest at the contact they gave while buying
  if (who.loggedIn) { if (!s2[id].audience.some((a) => a.type === "member")) s2[id].audience.push({ type: "member" }); }
  else if (who.email || who.phone) { s2[id].audience.push({ type: "guest", email: who.email || "", phone: who.phone || "" }); write(CONTACT, { email: who.email || "", phone: who.phone || "" }); }
  save(s2);
  return id;
}
/** The contact a guest gave in this browser when buying (the public ticket page reads it back so they aren't asked twice). */
export const guestContact = () => read(CONTACT, null);

/** Tap "I'm in" on a plan. Needs the planner to accept. Tapping again withdraws. */
export function requestPlan(postId) {
  const st = planStates();
  if (st[postId]) { delete st[postId]; write(PLANS, st); ping(); return "none"; }
  st[postId] = "requested"; write(PLANS, st); ping();
  if (DEMO_AUTO_ACCEPT) setTimeout(() => { if (planState(postId) === "requested") acceptPlan(postId); }, ACCEPT_AFTER_MS);
  return "requested";
}
/** The planner accepts you: you are in the plan's group chat with the others who are going. */
export function acceptPlan(postId) {
  const po = POSTS.find((x) => x.id === postId); if (!po?.plan) return null;
  const st = planStates(); st[postId] = "accepted"; write(PLANS, st);
  const id = chatIdForPlan(postId), s = store(), planner = personBy(po.by) || { handle: po.by, name: po.by };
  if (!s[id]) {
    s[id] = { id, kind: "plan", ref: postId, title: po.plan.title, area: po.plan.area, when: po.plan.when, host: { handle: planner.handle, name: planner.name }, members: [{ handle: "me", name: "You" }, ...going(postId, Math.max(2, Math.min(5, po.plan.spots - 1)))], audience: [{ type: "member" }], questions: [], doubts: [], messages: [] };
    save(s);
    add(id, { from: "system", role: "system", text: `${planner.name} accepted you. You're in ${po.plan.title}.` });
    add(id, { from: planner.handle, role: "update", text: `Welcome in! ${po.plan.title}, ${po.plan.when}, ${po.plan.area}. I'll post the meeting spot and any change right here.` });
  }
  ping(); return id;
}

/** The host (or planner) posts an official update. It is in the chat instantly, and delivered by the rules at the top of this file. */
export function postUpdate(chatId, text, opts = {}) {
  const c = chatById(chatId), t = String(text).trim().slice(0, 600); if (!c || !t) return null;
  if (opts.answersDoubts) { const s = store(), ids = Array.isArray(opts.answersDoubts) ? opts.answersDoubts : null; (s[chatId].doubts || []).forEach((d) => { if (d.status === "sent" && (!ids || ids.includes(d.id))) d.status = "answered"; }); save(s); } // the doubts it answers are marked (all waiting ones, or just the ids given)
  const m = add(chatId, { from: c.host.handle, role: "update", text: t, ...(opts.answersDoubts ? { fromDoubts: true } : {}) });
  // Guests are not in the app: their updates go to the email or number they gave when they bought the ticket (a backend job sends these)
  const out = read(OUTBOX, []);
  c.audience.filter((a) => a.type === "guest").forEach((g) => {
    if (g.email) out.push({ id: mid(), at: Date.now(), channel: "email", to: g.email, chat: chatId, text: t, status: "queued" });
    if (g.phone) out.push({ id: mid(), at: Date.now(), channel: "sms", to: g.phone, chat: chatId, text: t, status: "queued" });
  });
  write(OUTBOX, out.slice(-200));
  return m;
}
export const outbox = () => read(OUTBOX, []);


/* ---------- Quick questions (hosts and sponty planners) ---------- */
export const DEMO_SEED_ANSWERS = true; // stand-in: a few of the others going answer right away so the counts have something to show
export const openQuestion = (c) => (c?.questions || []).find((q) => q.status === "open") || null;
export const questionById = (c, qid) => (c?.questions || []).find((q) => q.id === qid) || null;
/** The host or planner asks the group a question: 2 to 4 options, and optionally a short note. Refused while another question is open. */
export function askQuestion(chatId, { text, options, allowNote = false }) {
  const s = store(), c = s[chatId], t = String(text || "").trim().slice(0, 140), opts = (options || []).map((o) => String(o).trim().slice(0, 40)).filter(Boolean).slice(0, 4);
  if (!c || !t || opts.length < 2 || openQuestion(c)) return null;
  const q = { id: "q" + mid(), text: t, options: opts.map((label, i) => ({ id: "o" + i, label })), allowNote: Boolean(allowNote), status: "open", at: Date.now(), answers: {} };
  if (DEMO_SEED_ANSWERS) c.members.filter((m) => m.handle !== "me").slice(0, 3).forEach((m, i) => { q.answers[m.handle] = { option: q.options[i % q.options.length].id, note: "", at: Date.now() }; });
  (c.questions ||= []).push(q); save(s);
  return add(chatId, { from: c.host.handle, role: "question", qid: q.id, text: t });
}
/** The planner closes the question. The final counts stay visible. */
export function closeQuestion(chatId, qid) {
  const s = store(), q = questionById(s[chatId], qid); if (!q || q.status !== "open") return false;
  q.status = "closed"; save(s); return true;
}
/** A member answers (and can change their answer until it closes). Optional short note when the planner allowed one. */
export function answerQuestion(chatId, qid, optionId, note = "") {
  const s = store(), c = s[chatId], q = questionById(c, qid);
  if (!q || q.status !== "open" || !q.options.some((o) => o.id === optionId)) return false;
  q.answers.me = { option: optionId, note: q.allowNote ? String(note).trim().slice(0, 140) : "", at: Date.now() }; save(s); return true;
}
/** How many chose each option (everyone can see this once they have answered, or it has closed). */
export const tally = (q) => q.options.map((o) => ({ ...o, n: Object.values(q.answers).filter((a) => a.option === o.id).length }));
/** The notes people left, with their names: for the planner only (the planner's screen reads this; members never see it). */
export const plannerNotes = (c, qid) => { const q = questionById(c, qid); return q ? Object.entries(q.answers).filter(([, a]) => a.note).map(([h, a]) => ({ handle: h, name: c.members.find((m) => m.handle === h)?.name || h, option: q.options.find((o) => o.id === a.option)?.label, note: a.note })) : []; };
export const DEMO_EVENT_QUESTIONS = [
  { text: "Veg or non-veg snacks?", options: ["Veg", "Non-veg", "Either is fine"], allowNote: true },
  { text: "Coming straight from work?", options: ["Yes, a bit late", "No, on time"], allowNote: false },
];
export const DEMO_QUESTIONS = [
  { text: "Where should we meet?", options: ["Gateway of India", "Colaba Causeway", "Wherever, I'll find you"], allowNote: true },
  { text: "Bringing a bike or renting one?", options: ["Bringing my own", "Renting there"], allowNote: false },
  { text: "What pace feels right?", options: ["Easy and chatty", "Medium", "Sporty"], allowNote: true },
];


/* ---------- Last-minute doubts: a member asks the host or planner privately ---------- */
export const DOUBT_MAX = 160, DOUBT_LIMIT = 3;
export const myDoubts = (c) => (c?.doubts || []).filter((d) => d.from === "me");
export const doubtsLeft = (c) => Math.max(0, DOUBT_LIMIT - myDoubts(c).length);
/** Doubts the host or planner has not answered yet (their screen reads this; members never see anyone else's). */
export const pendingDoubts = (c) => (c?.doubts || []).filter((d) => d.status === "sent");
/** A member sends one short doubt. Only the host or planner sees it. Refused when empty, too long, or the 3 are used up. */
export function sendDoubt(chatId, text) {
  const s = store(), c = s[chatId], t = String(text || "").trim();
  if (!c || !t || t.length > DOUBT_MAX || doubtsLeft(c) === 0) return null;
  const d = { id: "d" + mid(), from: "me", text: t, at: Date.now(), status: "sent" };
  (c.doubts ||= []).push(d); save(s); return d;
}


/** The host or planner sets a doubt aside without answering it (it stops counting as waiting; the member still sees "Sent"). */
export function dismissDoubt(chatId, doubtId) { const s = store(), d = (s[chatId]?.doubts || []).find((x) => x.id === doubtId); if (!d || d.status !== "sent") return false; d.status = "dismissed"; save(s); return true; }
/** A doubt arriving from another member (the real backend calls this; here the demo screen uses it to add sample ones). */
export function receiveDoubt(chatId, fromHandle, text) {
  const s = store(), c = s[chatId], t = String(text || "").trim().slice(0, DOUBT_MAX); if (!c || !t) return null;
  const d = { id: "d" + mid(), from: fromHandle, text: t, at: Date.now(), status: "sent" }; (c.doubts ||= []).push(d); save(s); return d;
}
/** How many doubts are waiting across all chats (for a badge on the host and planner screen). */
export const waitingDoubts = () => chatList().reduce((n, c) => n + pendingDoubts(c).length, 0);
/** Who an update reaches: members in the app, and guests by email or text (the outbox). */
export const reach = (c) => ({ inApp: c.members.length, email: c.audience.filter((a) => a.type === "guest" && a.email).length, sms: c.audience.filter((a) => a.type === "guest" && a.phone).length });

/** Ready-made updates for the demo button. */
export const DEMO_DOUBT_UPDATE = "A few of you asked about getting there and parking. The nearest car park is behind the studio, and the lane entrance is the easiest to find. See you soon!";
export const DEMO_UPDATES = [
  "Doors open 15 minutes early. Come in through the side gate.",
  "Small change: we're starting at 7:45 PM instead of 7:30. See you soon!",
  "Reminder: bring a water bottle and a light jacket.",
  "Last few spots in the photo booth are going. Say hi if you see me.",
];

/** Listen for any change to chats, in this tab or another one. */
export function onChats(fn) {
  const f = () => fn();
  window.addEventListener("pbj-chats", f);
  window.addEventListener("storage", (e) => { if (!e.key || [CHATS, PLANS, READ].includes(e.key)) fn(); });
}
