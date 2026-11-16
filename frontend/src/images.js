// Photos people add (event covers, logos, pictures in descriptions, profile photos).
// Each one is shrunk in the browser first (fast on mobile data), then saved to Supabase Storage in the person's own folder
// (images/<account id>/<kind>/...), and the page keeps only its web link. See supabase/migrations/…_images_bucket.sql.
import { client } from "./auth.js";

const BUCKET = "images";

// Shrink a picked file to at most maxWidth pixels wide, as a JPEG
export function shrinkImage(file, maxWidth = 1200) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, maxWidth / img.width);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("unreadable"))), "image/jpeg", 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
    img.src = url;
  });
}

// Upload a shrunk image and return its public web link. kind is a short folder name: "events", "logos", "profile".
export async function uploadImage(session, blob, kind = "events") {
  const sb = await client();
  const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const path = `${session.user.id}/${kind}/${name}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// A blob as an inline picture, for copies of the site where sign-in isn't set up (nothing is uploaded then)
export const blobToDataUrl = (blob) => new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });
