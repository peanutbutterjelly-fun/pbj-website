// Saves a sign-up or a filled form to the database (Supabase) through its web address, no extra library needed.
// It only works once the two keys are set (see .env.example). Until then it says "not connected" and sends nothing.
// When someone is signed in, the row is linked to their account (the database only lets them link their own).
const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY; // the public key: it can only add rows (see supabase/migrations)

export const leadsConnected = () => Boolean(URL_ && KEY);

export async function saveLead(lead, session = null) {
  if (!leadsConnected()) return { ok: false, reason: "not-connected" };
  const body = session ? { ...lead, user_id: session.user.id } : lead;
  try {
    const res = await fetch(`${URL_.replace(/\/$/, "")}/rest/v1/leads`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${session ? session.access_token : KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(body),
    });
    return res.ok ? { ok: true } : { ok: false, reason: "failed", status: res.status };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
