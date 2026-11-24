// "[ Sign in ]" in the top bar opens a small card: type your email, we send a link, tapping it brings you back signed in.
// Once signed in, the card says hello and links to your dashboard (or to "Finish your profile" until the welcome steps are done).
import { googleButtonHtml, wireGoogle, authReady, client, hasSavedSession, cameFromLink, sendLink, signOut, takeNext, fetchMe } from "./auth.js";

export function setupAccount() {
  const item = document.querySelector('.tb-item[data-menu="account"]');
  if (!item) return;
  const btn = item.querySelector(".tb-btn");
  const pop = document.querySelector('.tb-pop[data-menu="account"]') || item.querySelector(".tb-pop");
  const $ = (sel) => pop.querySelector(sel);
  const form = $("#acct-form"), email = $("#acct-email"), send = $("#acct-send"), msg = $("#acct-msg");
  const signedIn = $("#acct-in"), nameEl = $("#acct-name"), mailEl = $("#acct-mail"), out = $("#acct-out"), dash = $("#acct-dash");
  const labelOut = btn.querySelector("[data-out]"), labelIn = btn.querySelector("[data-in]");

  if (!authReady()) {
    form.hidden = true;
    say("Sign-in is not connected yet.");
    return;
  }

  function say(text, tone = "") {
    msg.textContent = text;
    msg.dataset.tone = tone;
    msg.hidden = !text;
  }

  form.insertAdjacentHTML("afterbegin", googleButtonHtml());
  btn.addEventListener("click", () => wireGoogle(form, location.pathname, (t) => say(t, "bad")), { once: true }); // asks Supabase only once the card is opened

  let activeUser = null; // whose details the card is showing; a late answer for anyone else is ignored

  async function showProfile(session) {
    const userId = session.user.id;
    mailEl.textContent = session.user.email || "";
    nameEl.textContent = "";
    dash.textContent = "Your dashboard";
    try {
      const me = await fetchMe(session);
      if (activeUser !== userId) return;
      nameEl.textContent = me.full_name ? `Hi, ${me.full_name}` : "";
      if (!me.onboarded_at) dash.textContent = "Finish your profile";
    } catch { /* the backend being away doesn't stop you being signed in */ }
  }

  function render(session) {
    const inNow = !!session;
    activeUser = session?.user.id ?? null;
    form.hidden = inNow;
    signedIn.hidden = !inNow;
    labelOut.hidden = inNow;
    labelIn.hidden = !inNow;
    $(".tb-head").textContent = inNow ? "Signed in" : "Sign in";
    if (inNow) { say(""); showProfile(session); }
  }

  let started;
  const start = () =>
    (started ??= client()
      .then(async (sb) => {
        sb.auth.onAuthStateChange((_event, session) => render(session));
        const { data } = await sb.auth.getSession();
        render(data.session);
        return sb;
      })
      .catch((err) => { started = undefined; throw err; }));

  // Coming back from the email link: carry on to the page they were heading for (the dashboard, say),
  // or open the card to show you're in (or why the link didn't work), and tidy the address bar
  if (cameFromLink()) {
    const params = new URLSearchParams(location.hash.slice(1));
    const error = params.get("error_description");
    start().then(async (sb) => {
      history.replaceState(null, "", location.pathname + location.search);
      const next = takeNext();
      const { data } = await sb.auth.getSession();
      if (!error && data.session && next && next !== location.pathname) { location.replace(next); return; }
      if (error) say(error.includes("expired") ? "That link has expired. Ask for a new one." : error, "bad");
      btn.click();
    }).catch(() => {
      say("Couldn't finish signing in. Check your connection and try the link again.", "bad");
      btn.click();
    });
  } else if (hasSavedSession()) {
    start().catch(() => {});
  }
  // Start loading the library as soon as someone heads for the button (a failure here is retried when they send the form)
  const warmUp = () => { start().catch(() => {}); };
  btn.addEventListener("pointerenter", warmUp, { once: true });
  btn.addEventListener("click", warmUp);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const address = email.value.trim();
    if (!email.checkValidity() || !address) { say("Type a valid email address.", "bad"); email.focus(); return; }
    send.disabled = true;
    say("Sending…");
    try {
      await start();
      const { error } = await sendLink(address);
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
    try {
      await start();
      await signOut();
      say("Signed out.");
    } catch {
      say("Couldn't sign out. Check your connection and try again.", "bad");
    }
  });
}
