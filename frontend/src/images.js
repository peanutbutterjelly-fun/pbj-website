// Photos people add (event covers, logos, pictures in descriptions, profile photos).
// Each one is shrunk in the browser first (fast on mobile data), then saved to Supabase Storage in the person's own folder
// (images/<account id>/<kind>/...), and the page keeps only its web link. See supabase/migrations/…_images_bucket.sql.
import { client } from "./auth.js";

const BUCKET = "images";
const SB_URL = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const PUBLIC = `${SB_URL}/storage/v1/object/public/${BUCKET}/`;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 20; // before shrinking; after shrinking every photo is far under the bucket's 5 MB

// A problem with a photo, with a short code the page turns into a plain message (see imageMessage)
class ImageProblem extends Error { constructor(code) { super(code); this.code = code; } }

// What to tell people when a photo can't be added
export function imageMessage(err) {
  const code = err instanceof ImageProblem ? err.code : uploadProblem(err);
  return {
    type: "That file isn't a photo we can use. Try a JPG or PNG.",
    big: `That photo is too big (max ${MAX_MB} MB). Try a smaller one.`,
    "signed-out": "You've been signed out. Sign in again to add photos.",
    offline: "Couldn't upload that photo. Check your connection and try again.",
    storage: "Couldn't upload that photo. Try again in a moment.",
  }[code];
}

function uploadProblem(err) {
  if (!navigator.onLine) return "offline";
  const status = Number(err?.status ?? err?.statusCode);
  const text = String(err?.message || "") + " " + String(err?.error || "");
  if (status === 413 || /too large|exceeded the maximum/i.test(text)) return "big";
  if (status === 401 || /jwt|unauthori[sz]ed|not logged in/i.test(text)) return "signed-out";
  if (/mime|invalid.*type/i.test(text)) return "type";
  if (err?.name === "TypeError" || /failed to fetch|network|load failed/i.test(text) || err?.originalError?.name === "TypeError") return "offline";
  return "storage";
}

// Shrink a picked file to at most maxWidth pixels wide. Photos become JPEGs (small); a PNG or WebP with see-through parts
// (most logos) stays a PNG so its background stays see-through.
export function shrinkImage(file, maxWidth = 1200) {
  if (!TYPES.includes(file.type)) return Promise.reject(new ImageProblem("type"));
  if (file.size > MAX_MB * 1024 * 1024) return Promise.reject(new ImageProblem("big"));
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, maxWidth / img.width);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let clear = false;
      if (file.type !== "image/jpeg") {
        const px = g.getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < px.length; i += 4) if (px[i] < 255) { clear = true; break; }
      }
      c.toBlob((blob) => (blob ? resolve(blob) : reject(new ImageProblem("type"))), clear ? "image/png" : "image/jpeg", 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new ImageProblem("type")); };
    img.src = url;
  });
}

// Upload a shrunk image and return its public web link. kind is a short folder name: "events", "logos", "profile".
export async function uploadImage(session, blob, kind = "events") {
  if (!session) throw new ImageProblem("signed-out");
  const sb = await client();
  const type = TYPES.includes(blob.type) ? blob.type : "image/jpeg";
  const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${type.split("/")[1].replace("jpeg", "jpg")}`;
  const path = `${session.user.id}/${kind}/${name}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: type, cacheControl: "31536000" });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// A blob as an inline picture, for copies of the site where sign-in isn't set up (nothing is uploaded then)
export const blobToDataUrl = (blob) => new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });

// Every uploaded photo link found inside some saved data (an event, a profile)
const LINK = /https?:\/\/[^"'\s)<>\\]+/g;
export function photoLinks(value) {
  const out = new Set();
  const walk = (v) => {
    if (typeof v === "string") (v.match(LINK) || []).forEach((u) => { if (u.startsWith(PUBLIC)) out.add(u); });
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(value);
  return out;
}

// Delete photos this person uploaded and no longer uses, so removed photos stop being reachable by their links.
// Only files in their own folder are ever touched (the storage rules enforce that too). Best effort: a failure just leaves the file.
export async function removeImages(session, urls) {
  if (!session) return;
  const own = `${session.user.id}/`;
  const paths = [...new Set(urls)].filter((u) => typeof u === "string" && u.startsWith(PUBLIC))
    .map((u) => decodeURIComponent(u.slice(PUBLIC.length).split("?")[0])).filter((p) => p.startsWith(own) && !p.includes(".."));
  if (!paths.length) return;
  try { const sb = await client(); await sb.storage.from(BUCKET).remove(paths); } catch { /* left behind; harmless */ }
}
