// Saves a sign-up or a filled form to the database (Supabase) through its web address, no extra library needed.
// It only works once the two keys are set (see .env.example). Until then it says "not connected" and sends nothing.
const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY; // the public key: it can only add rows (see supabase/schema.sql)

export const leadsConnected = () => Boolean(URL_ && KEY);

export async function saveLead(lead) {
  if (!leadsConnected()) return { ok: false, reason: "not-connected" };
  try {
    const res = await fetch(`${URL_.replace(/\/$/, "")}/rest/v1/leads`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(lead),
    });
    return res.ok ? { ok: true } : { ok: false, reason: "failed", status: res.status };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
