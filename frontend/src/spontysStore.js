// Small helpers shared by every Spontys screen: what is kept in this browser, and making text, photos and links safe to put on the page
// (photos and links may one day hold other people's data, so only plain picture links and web links get through).
import { EVENTS } from "./eventsData.js";

/** Every key Spontys keeps in this browser starts with this, so "Delete account" and signing out can clear them all. */
export const PREFIX = "pbj-sponty-";
export const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
/** Saves a value. Returns false when the browser refused (storage full or blocked), so the screen can say so. */
export const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
/** Removes every Spontys key from this browser. `keep` lists keys to leave alone. */
export const clearAll = (keep = []) => {
  try { Object.keys(localStorage).filter((k) => k.startsWith(PREFIX) && !keep.includes(k)).forEach((k) => localStorage.removeItem(k)); } catch {}
};

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let sbOrigin = "";
try { sbOrigin = import.meta.env.VITE_SUPABASE_URL ? new URL(import.meta.env.VITE_SUPABASE_URL).origin : ""; } catch {}
/** A photo link that is safe to show: a PNG, JPEG or WebP kept in the browser, or an https link (http only for our own storage
 *  server, for local testing). Anything else (scripts, quotes, odd characters) comes back as "", which shows no photo. */
export function safeImg(u) {
  const s = String(u ?? "").trim();
  if (!s) return "";
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(s)) return s;
  if (/["'()\s&;#<>\\`]/.test(s)) return "";
  try {
    const x = new URL(s);
    if (x.protocol === "https:" || (x.protocol === "http:" && sbOrigin && x.origin === sbOrigin)) return s;
  } catch {}
  return "";
}
/** A link that is safe to open: only http and https web links, anything else becomes "#". */
export function safeUrl(u) {
  try { const x = new URL(String(u ?? "")); return x.protocol === "http:" || x.protocol === "https:" ? x.href : "#"; } catch { return "#"; }
}

/** The id an event's page lives at: its own id, or "u" plus its place in the lineup. */
export const evId = (e) => e.id || "u" + EVENTS.findIndex((x) => x.title === e.title);
