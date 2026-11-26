// Hosts' published events from the database, shown in the Spontys app next to the hand-picked lineup (issue #29).
// Spontys reads one list of events everywhere (For you, Ask FUN, the event screen, profiles), the `EVENTS` array in eventsData.js.
// So when the Spontys page opens, the published events are fetched once, turned into the same shape as a lineup event, and added
// to that list. Every screen then shows them without knowing where they came from.
// They carry `real: true` and a `link` to their own public page (/e/<name>-<id>), where tickets are bought.
import { EVENTS } from "./eventsData.js";
import { fetchListedEvents, safeImg, eventPath, eventsOnline } from "./eventsStore.js";
import { guestPays, rupees } from "./gst.js";

// The lineup's little picture (and its colour) from the dashboard's category, by keyword
const KIND_BY_WORD = [
  [/music|gig|jazz|band|concert|dj|singing/i, "music"], [/comedy|stand.?up|open mic/i, "comedy"], [/film|cinema|movie|screening/i, "film"],
  [/food|dinner|brunch|supper|tasting|cook/i, "food"], [/art|paint|sketch|craft|print|pottery|clay/i, "art"], [/game|quiz|board/i, "games"],
  [/vinyl|record/i, "vinyl"], [/walk|trek|run|cycle|outdoor|hike/i, "outdoors"], [/market|flea|pop.?up|bazaar/i, "market"],
];
const PAPERS = ["sun", "jam", "cream", "peanut", "brown"];
const kindOf = (e) => (KIND_BY_WORD.find(([re]) => re.test(`${e.category || ""} ${(e.subs || []).join(" ")} ${e.title || ""}`)) || [null, "workshop"])[1];
const clock = (t) => { const h = Number(t?.h), m = String(t?.m ?? "00").padStart(2, "0"); return t?.h !== "" && Number.isFinite(h) ? `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}` : ""; };
// The host's description as plain text. DOMParser builds an inert document (nothing in it loads or runs), unlike a page element.
const plain = (html) => (new DOMParser().parseFromString(String(html || ""), "text/html").body.textContent || "").replace(/\s+/g, " ").trim();
const short = (s, n = 160) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);

/** One dashboard event in the shape of a lineup event. */
export function asLineupEvent(e) {
  const prices = (e.tickets || []).filter((t) => t.enabled !== false && t.status !== "Sold Out").map((t) => (t.paid ? guestPays(t) : 0));
  const low = prices.length ? Math.min(...prices) : 0;
  const hidePlace = e.womenOnly || e.hideLocation; // the host chose to share the exact place only with guests
  const photo = safeImg((e.images || []).filter(Boolean)[0]);
  let h = 0; for (const c of String(e.id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return {
    id: "db-" + e.id, real: true, eventId: e.id,
    title: e.title || "Untitled event",
    kind: kindOf(e), category: e.category || "Event",
    date: e.dateFrom, time: clock(e.start),
    area: e.venueStatus === "Decided" && e.venue && !hidePlace ? e.venue : e.city || "Mumbai",
    venue: hidePlace ? "" : e.venue || "",
    price: low ? rupees(Math.round(low)) : "Free",
    blurb: short(plain(e.description)),
    link: eventPath(e),
    paper: PAPERS[h % PAPERS.length],
    photos: photo ? [photo] : [],
    hostName: (e.organizers || []).map((o) => o.holder).filter(Boolean)[0] || "",
  };
}

let loaded;
/** Adds hosts' published events to the lineup once per page. Never fails: without a connection, Spontys shows the lineup alone. */
export function loadRealEvents({ timeoutMs = 4000 } = {}) {
  if (!eventsOnline()) return Promise.resolve(0);
  return (loaded ??= Promise.race([
    fetchListedEvents().catch(() => []),
    new Promise((resolve) => setTimeout(() => resolve([]), timeoutMs)),
  ]).then((list) => {
    const have = new Set(EVENTS.map((e) => e.title));
    const add = list.filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.dateFrom || "")).map(asLineupEvent).filter((e) => !have.has(e.title));
    EVENTS.push(...add);
    return add.length;
  }));
}
