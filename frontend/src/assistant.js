// PB&J's small search assistant. It looks in this order and stops as soon as it finds something:
//   1. PB&J events and listings (the lineup in eventsData.js)
//   2. Recommendations: the places the visitor saved or recommended in their own lists
// Only when both come back empty does it ask "try something else, or step outside PB&J?". Stepping outside needs a
// connection to an AI service (set VITE_ASSISTANT_URL, see .env.example); until then it says it is not connected and sends nothing.
import { EVENTS } from "./eventsData.js";

export const today = () => new Date().toISOString().slice(0, 10);
export const upcoming = () => EVENTS.filter((e) => e.date >= today()).sort((a, b) => a.date.localeCompare(b.date));
export const priceNum = (e) => (/free/i.test(e.price) ? 0 : +String(e.price).replace(/[^\d]/g, "") || 0);

const STOP = ["the", "more", "for", "and", "with", "near", "this", "that", "some", "things", "under", "not", "try", "nights", "night", "worth", "find", "show", "get", "any", "are", "what", "where", "whats", "happening", "around", "can", "you", "tell", "about"];
const SYN = { drinks: ["rooftop", "music", "bar", "jazz"], date: ["music", "film", "rooftop", "art", "food"], laugh: ["comedy"], comedy: ["comedy", "mic"], dance: ["dance", "music", "party"], dancing: ["dance", "music"], workshop: ["workshop", "clay", "pottery"], workshops: ["workshop"], cheap: [], free: [], music: ["music", "jazz", "vinyl"], food: ["food"], art: ["art"], games: ["games"], film: ["film", "shorts"], rooftop: ["rooftop"] };
export const words = (q) => q.toLowerCase().split(/[^a-z0-9₹]+/).filter((w) => w.length > 2 && !STOP.includes(w));

// 1. PB&J events and listings
export function searchEvents(q) {
  const ws = words(q);
  const under = (q.match(/under\s*₹?\s*([\d,]+)/i) || [])[1], cap = under ? +under.replace(/,/g, "") : null;
  const weekend = /weekend/i.test(q);
  return upcoming().map((e) => {
    const hay = [e.title, e.blurb, e.category, e.area, e.venue, e.kind].join(" ").toLowerCase(); let s = 0;
    ws.forEach((w) => { if (hay.includes(w)) s += 2; (SYN[w] || []).forEach((x) => { if (hay.includes(x)) s += 1; }); });
    if (/free|cheap/i.test(q) && priceNum(e) <= 500) s += 2;
    if (cap != null && priceNum(e) <= cap) s += 2;
    if (weekend) { const [y, m, d] = e.date.split("-").map(Number); if ([0, 5, 6].includes(new Date(y, m - 1, d).getDay())) s += 2; }
    return { e, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.e);
}

// 2. Recommendations: what the visitor saved in their own lists (not "Not for me")
export function searchPicks(q, places) {
  const ws = words(q); if (!ws.length) return [];
  return places.filter((p) => p.list !== "no" && ws.some((w) => (p.title + " " + p.area).toLowerCase().includes(w)));
}

// The steps the assistant shows, in the order it looks
export const STEPS = [
  { id: "events", label: "Checking PB&J events and listings" },
  { id: "picks", label: "Checking recommendations and your picks" },
];

export function lookUp(q, places) {
  const events = searchEvents(q);
  const picks = events.length ? [] : searchPicks(q, places); // stops at the first place that has something
  return { events, picks, found: events.length > 0 || picks.length > 0 };
}

// 3. Outside PB&J (only after the visitor says yes)
const URL_ = import.meta.env.VITE_ASSISTANT_URL;
export const assistantConnected = () => Boolean(URL_);
export async function stepOutside(query) {
  if (!assistantConnected()) return { ok: false, reason: "not-connected" };
  try {
    const res = await fetch(URL_, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, city: "Mumbai" }) });
    if (!res.ok) return { ok: false, reason: "failed" };
    const data = await res.json(); // expected: { answer: "text", items: [{ title, note, url }] }
    return { ok: true, answer: String(data.answer || ""), items: Array.isArray(data.items) ? data.items.slice(0, 6) : [] };
  } catch { return { ok: false, reason: "failed" }; }
}
