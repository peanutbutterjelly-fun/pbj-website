// Sign in with an email link (Supabase). "[ Sign in ]" in the top bar opens a small card: type your email, we send a
// link, tapping it brings you back here signed in. The Supabase library only loads when it's needed (you open the card,
// you're already signed in, or you just came back from the link), so the page stays light for everyone else.
const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY; // the publishable key: safe in the browser
const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

let clientPromise;
const client = () =>
  (clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } })
  ));

const storageKey = () => `sb-${new URL(SB_URL).hostname.split(".")[0]}-auth-token`;
const hasSavedSession = () => { try { return !!localStorage.getItem(storageKey()); } catch { return false; } };
const cameFromLink = () => /access_token=|error_description=/.test(location.hash);

export function setupAccount() {
  const item = document.querySelector('.tb-item[data-menu="account"]');
  if (!item) return;
  const btn = item.querySelector(".tb-btn");
  const pop = document.querySelector('.tb-pop[data-menu="account"]') || item.querySelector(".tb-pop");
  const $ = (sel) => pop.querySelector(sel);
  const form = $("#acct-form"), email = $("#acct-email"), send = $("#acct-send"), msg = $("#acct-msg");
  const signedIn = $("#acct-in"), nameEl = $("#acct-name"), mailEl = $("#acct-mail"), out = $("#acct-out");
  const labelOut = btn.querySelector("[data-out]"), labelIn = btn.querySelector("[data-in]");

  if (!SB_URL || !SB_KEY) {
    form.hidden = true;
    say("Sign-in is not connected yet.");
    return;
  }

  function say(text, tone = "") {
    msg.textContent = text;
    msg.dataset.tone = tone;
    msg.hidden = !text;
  }

  async function showProfile(session) {
    mailEl.textContent = session.user.email || "";
    nameEl.textContent = "";
    if (!API) return;
    try {
      const res = await fetch(`${API}/api/me`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (res.ok) {
        const me = await res.json();
        nameEl.textContent = me.full_name ? `Hi, ${me.full_name}` : "";
      }
    } catch { /* the backend being away doesn't stop you being signed in */ }
  }

  function render(session) {
    const inNow = !!session;
    form.hidden = inNow;
    signedIn.hidden = !inNow;
    labelOut.hidden = inNow;
    labelIn.hidden = !inNow;
    $(".tb-head").textContent = inNow ? "Signed in" : "Sign in";
    if (inNow) { say(""); showProfile(session); }
  }

  let started;
  const start = () =>
    (started ??= client().then(async (sb) => {
      sb.auth.onAuthStateChange((_event, session) => render(session));
      const { data } = await sb.auth.getSession();
      render(data.session);
      return sb;
    }));

  // Coming back from the email link: open the card to show you're in (or why the link didn't work), and tidy the address bar
  if (cameFromLink()) {
    const params = new URLSearchParams(location.hash.slice(1));
    const error = params.get("error_description");
    start().then(() => {
      history.replaceState(null, "", location.pathname + location.search);
      if (error) say(error.includes("expired") ? "That link has expired. Ask for a new one." : error, "bad");
      btn.click();
    });
  } else if (hasSavedSession()) {
    start();
  }
  // Start loading the library as soon as someone heads for the button
  btn.addEventListener("pointerenter", start, { once: true });
  btn.addEventListener("click", start);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const address = email.value.trim();
    if (!email.checkValidity() || !address) { say("Type a valid email address.", "bad"); email.focus(); return; }
    send.disabled = true;
    say("Sending…");
    try {
      const sb = await start();
      const { error } = await sb.auth.signInWithOtp({ email: address, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) {
        say(error.status === 429 ? "Too many links asked for. Try again in a few minutes." : error.message, "bad");
      } else {
        say(`Check ${address} for your sign-in link.`, "good");
        form.reset();
      }
    } catch {
      say("Couldn't reach the sign-in service. Check your connection and try again.", "bad");
    } finally {
      send.disabled = false;
    }
  });

  out.addEventListener("click", async () => {
    const sb = await start();
    await sb.auth.signOut();
    say("Signed out.");
  });
}
