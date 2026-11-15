// Sign-in for the Spontys app: the same Supabase login the website's top bar uses (an email link), plus helpers for the server
// (/api/...) and the profile-photo storage. The Supabase library only loads when it is needed (someone is already signed in,
// is coming back from the email link, or opens the sign-in card), so the page stays light for everyone else.
const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY; // the publishable key: safe in the browser
const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export const authConfigured = () => Boolean(SB_URL && SB_KEY);

let clientPromise;
const client = () =>
  (clientPromise ??= import("@supabase/supabase-js")
    .then(({ createClient }) => createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } }))
    .catch((err) => { clientPromise = undefined; throw err; })); // a failed load (bad connection) can be tried again

const storageKey = () => `sb-${new URL(SB_URL).hostname.split(".")[0]}-auth-token`;
export const hasSavedSession = () => { try { return authConfigured() && !!localStorage.getItem(storageKey()); } catch { return false; } };
export const cameFromLink = () => /access_token=|error_description=/.test(location.hash);
export const linkError = () => (cameFromLink() ? new URLSearchParams(location.hash.slice(1)).get("error_description") : null);

let session = null;
const listeners = new Set();
export const getSession = () => session;
export const onSession = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const announce = () => listeners.forEach((fn) => fn(session));

let started;
/** Loads the login library and starts listening. Safe to call many times. */
export function startAuth() {
  if (!authConfigured()) return Promise.reject(new Error("not-configured"));
  return (started ??= client()
    .then(async (sb) => {
      sb.auth.onAuthStateChange((_event, s) => { session = s; announce(); });
      const { data } = await sb.auth.getSession();
      session = data.session;
      announce();
      return sb;
    })
    .catch((err) => { started = undefined; throw err; }));
}

/** Sends the sign-in link. Resolves to { error } like Supabase does. */
export async function signInWithEmail(email) {
  const sb = await startAuth();
  return sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
}
export async function signOut() { const sb = await startAuth(); await sb.auth.signOut(); }

/** Calls our server as the signed-in person. */
export function api(path, init = {}) {
  if (!API || !session) return Promise.reject(new Error("not-signed-in"));
  return fetch(`${API}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init.headers || {}), Authorization: `Bearer ${session.access_token}` } });
}

/** Saves a profile photo in the person's own folder and returns its public address (a new ?v= each time so every device sees the change). */
export async function uploadAvatar(blob) {
  const sb = await startAuth();
  if (!session) throw new Error("not-signed-in");
  const path = `${session.user.id}/avatar.jpg`;
  const { error } = await sb.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: true, cacheControl: "3600" });
  if (error) throw error;
  return `${sb.storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
}
