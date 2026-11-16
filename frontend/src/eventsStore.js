// Events in the database (see supabase/migrations/…_events.sql).
// Each event is split in two before saving:
//   public half  (events table): everything guests see. Organizers keep only their name here.
//   private half (event_private table): organizers' bank, PAN, GST, email and phone, and discount coupons. Only the host can read it.
// Guests' pages read listed events with a plain web request (no sign-in library), so they stay light.
import { client } from "./auth.js";
import { uploadImage } from "./images.js";

const SB_URL = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const STATUSES = ["draft", "published", "coming", "soldout", "cancelled"];
const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : null);
export const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export const eventsOnline = () => Boolean(SB_URL && KEY);

// One dashboard event -> the two rows saved in the database
export function splitEvent(e) {
  const { organizers = [], coupons, ...rest } = e;
  return {
    row: {
      id: e.id,
      status: STATUSES.includes(e.status) ? e.status : "draft",
      starts_on: day(e.dateFrom),
      ends_on: day(e.dateTo) || day(e.dateFrom),
      data: { ...rest, organizers: organizers.map((o) => ({ holder: o.holder || "" })) },
    },
    priv: { event_id: e.id, data: { organizers, ...(coupons ? { coupons } : {}) } },
  };
}

// Photo links come from other people now, so only plain https addresses are kept (nothing that could break out of the page's HTML)
// (our own storage address is allowed too, which is plain http on a local copy of Supabase)
export const safeImg = (u) => (typeof u === "string" && /^[^\s'"()<>\\&;#]+$/.test(u) && (u.startsWith("https://") || (SB_URL && u.startsWith(`${SB_URL}/storage/v1/object/public/`))) ? u : "");
const list = (v) => (Array.isArray(v) ? v : []);

// ...and back again
function joinEvent(row, priv) {
  const e = { ...(row.data && typeof row.data === "object" ? row.data : {}), id: row.id, status: row.status };
  delete e.mine; // only fetchEvent decides that, from who's signed in
  e.images = list(e.images).map(safeImg);
  for (const k of ["artists", "partners"]) e[k] = list(e[k]).map((p) => ({ ...p, logo: safeImg(p?.logo) }));
  if (priv) {
    e.organizers = priv.organizers || [];
    if (priv.coupons) e.coupons = priv.coupons;
  }
  return e;
}

// ---- for the host (signed in) ----

export async function loadMyEvents(session) {
  const sb = await client();
  const [ev, pv] = await Promise.all([
    sb.from("events").select("id, status, data, created_at").eq("host_id", session.user.id).order("created_at", { ascending: false }),
    sb.from("event_private").select("event_id, data").eq("host_id", session.user.id),
  ]);
  if (ev.error) throw ev.error;
  if (pv.error) throw pv.error;
  const privs = new Map(pv.data.map((p) => [p.event_id, p.data]));
  return ev.data.map((r) => joinEvent(r, privs.get(r.id)));
}

export async function saveEvents(list) {
  if (!list.length) return;
  const sb = await client();
  const parts = list.map(splitEvent);
  const a = await sb.from("events").upsert(parts.map((p) => p.row));
  if (a.error) throw a.error;
  const b = await sb.from("event_private").upsert(parts.map((p) => p.priv));
  if (b.error) throw b.error;
}

export async function deleteEvents(ids) {
  if (!ids.length) return;
  const sb = await client();
  const { error } = await sb.from("events").delete().in("id", ids); // the private half goes with it
  if (error) throw error;
}

// Events made before accounts existed hold their photos inline. Upload those and swap in the web links.
export async function liftInlineImages(session, value) {
  const up = async (dataUrl) => uploadImage(session, await (await fetch(dataUrl)).blob(), "events");
  if (typeof value === "string") {
    if (value.startsWith("data:image/")) return up(value);
    if (!value.includes("data:image/")) return value;
    let out = value;
    for (const m of new Set(value.match(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/g) || [])) out = out.split(m).join(await up(m));
    return out;
  }
  if (Array.isArray(value)) { const out = []; for (const v of value) out.push(await liftInlineImages(session, v)); return out; }
  if (value && typeof value === "object") { const out = {}; for (const [k, v] of Object.entries(value)) out[k] = await liftInlineImages(session, v); return out; }
  return value;
}

// ---- for guests (no sign-in needed) ----

async function rest(query) {
  const res = await fetch(`${SB_URL}/rest/v1/events?${query}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!res.ok) throw new Error(`events-${res.status}`);
  return (await res.json()).map((r) => joinEvent(r));
}

// Published events whose last day hasn't passed, soonest first
export async function fetchListedEvents() {
  if (!eventsOnline()) return [];
  return rest(`select=id,status,data&status=eq.published&ends_on=gte.${isoToday()}&order=starts_on.asc&limit=200`);
}

// One event by its id: anyone sees it once it's listed. The host also sees their own draft (when `session` is given).
export async function fetchEvent(id, session = null) {
  if (!eventsOnline() || !id) return null;
  if (session) {
    const sb = await client();
    const { data, error } = await sb.from("events").select("id, status, data, host_id").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? { ...joinEvent(data), mine: data.host_id === session.user.id } : null;
  }
  return (await rest(`select=id,status,data&id=eq.${encodeURIComponent(id)}&limit=1`))[0] || null;
}
