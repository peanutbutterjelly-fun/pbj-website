// Sign-in shared by every page (the top bar card, the List Your Event forms and the dashboard).
// The Supabase library only loads when it's needed (someone signs in, is already signed in, or just tapped the email link),
// so the page stays light for everyone else.
const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY; // the publishable key: safe in the browser
const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const NEXT = "pbj-after-signin"; // where to go once the email link brings someone back

export const authReady = () => Boolean(SB_URL && SB_KEY);
export const apiReady = () => Boolean(API);

let clientPromise;
export const client = () =>
  (clientPromise ??= import("@supabase/supabase-js")
    .then(({ createClient }) =>
      createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } })
    )
    .catch((err) => { clientPromise = undefined; throw err; })); // a failed load (bad connection) can be tried again

const storageKey = () => `sb-${new URL(SB_URL).hostname.split(".")[0]}-auth-token`;
export const hasSavedSession = () => { if (!authReady()) return false; try { return !!localStorage.getItem(storageKey()); } catch { return false; } };
export const cameFromLink = () => /access_token=|error_description=/.test(location.hash);

// The signed-in session, or null. Doesn't load the library for people who aren't signed in.
export async function currentSession() {
  if (!authReady() || (!hasSavedSession() && !cameFromLink())) return null;
  const sb = await client();
  const { data } = await sb.auth.getSession();
  return data.session;
}

// Email a sign-in link. `next` is the page to land on afterwards (also remembered here, in case Supabase sends people home instead).
export async function sendLink(email, next = location.pathname) {
  const sb = await client();
  try { localStorage.setItem(NEXT, next); } catch { /* private mode: they land on the page the link opens */ }
  return sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + next } });
}

// After the email link: the page someone asked to go to, once (then forgotten)
export function takeNext() {
  try { const n = localStorage.getItem(NEXT); localStorage.removeItem(NEXT); return n; } catch { return null; }
}

// scope "local" just forgets the sign-in on this device (used when it has already run out)
export async function signOut(scope = "global") {
  const sb = await client();
  return sb.auth.signOut({ scope });
}

// The person's profile from the backend: { full_name, phone, host_kind, link, about, wants_call, onboarded_at, email, ... }
export async function fetchMe(session) {
  if (!API) throw new Error("no-api");
  const res = await fetch(`${API}/api/me`, { headers: { Authorization: `Bearer ${session.access_token}` } });
  if (!res.ok) throw new Error(`me-${res.status}`);
  return res.json();
}

export async function saveMe(session, changes) {
  if (!API) throw new Error("no-api");
  const res = await fetch(`${API}/api/me`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  if (!res.ok) throw new Error(`me-${res.status}`);
  return res.json();
}
