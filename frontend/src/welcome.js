// The door to the host dashboard: sign in with an email link, then (the first time only) tell us who you are.
// welcomeGate() resolves with { session, me } once both are done. The profile page (#/profile) reuses the same form.
import { authReady, client, cameFromLink, sendLink, signOut, takeNext, fetchMe, saveMe } from "./auth.js";

// The kinds of hosts from PLAN.md (free listings are for everyday people with a spare ticket or a group plan)
export const HOST_KINDS = [
  ["Artist or teacher", "Workshops, gigs, classes"],
  ["Venue or studio", "A space that hosts nights"],
  ["Club or group", "Run clubs, book clubs, collectives"],
  ["Brand", "Pop-ups and sponsored nights"],
  ["Just me", "A spare ticket or a group plan"],
];

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function welcomeGate(app, after) {
  if (!authReady()) return { session: null, me: null }; // sign-in isn't set up on this copy of the site: the dashboard stays open, as before
  document.documentElement.classList.add("gated");
  let session;
  try {
    const sb = await client();
    const linkError = cameFromLink() ? new URLSearchParams(location.hash.slice(1)).get("error_description") : null;
    session = (await sb.auth.getSession()).data.session;
    if (cameFromLink()) history.replaceState(null, "", location.pathname + location.search); // the dashboard uses the # part for its pages
    if (!session) session = await signInScreen(app, after, linkError);
    takeNext(); // they're here now, so forget where the link was meant to take them
  } catch {
    await problem(app, after, "Couldn't reach the sign-in service. Check your connection and try again.");
    return welcomeGate(app, after);
  }
  let me;
  try { me = await fetchMe(session); }
  catch (err) {
    if (err.message === "me-401") { // the sign-in has run out: sign in again rather than "try again" forever
      try { await signOut("local"); } catch { /* already gone */ }
      return welcomeGate(app, after);
    }
    await problem(app, after, "Couldn't load your profile. Check your connection and try again.");
    return welcomeGate(app, after);
  }
  if (!me.onboarded_at) me = { ...(await profileForm(app, after, session, me, { first: true })), justOnboarded: true };
  document.documentElement.classList.remove("gated");
  return { session, me };
}

function problem(app, after, text) {
  return new Promise((resolve) => {
    app.innerHTML = `<div class="welcome"><div class="card welcome-card"><p class="welcome-msg" data-tone="bad">${esc(text)}</p>
      <div class="nav single"><button class="btn" type="button">Try again</button></div></div></div>`;
    after();
    app.querySelector("button").addEventListener("click", resolve, { once: true });
  });
}

// Signed out: one email box. The link brings them straight back here.
function signInScreen(app, after, linkError) {
  return new Promise(async (resolve) => {
    document.title = "Sign in — PeanutButterJelly.vip";
    app.innerHTML = `<div class="welcome">
      <div class="create-head"><h1 class="cut">Sign in to list your event</h1>
        <p>No password. We email you a link, you tap it, and you're in.</p></div>
      <form class="card welcome-card" novalidate>
        <div class="field"><label for="w-email">Your email <span class="req">*</span></label>
          <input id="w-email" class="box" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com" maxlength="200" /></div>
        <p class="welcome-msg" role="status" aria-live="polite"></p>
        <div class="nav single"><button class="btn" type="submit">Email me a link</button></div>
      </form></div>`;
    after();
    const form = app.querySelector("form"), input = form.querySelector("input"), go = form.querySelector("button"), msg = form.querySelector(".welcome-msg");
    const say = (t, tone = "") => { msg.textContent = t; msg.dataset.tone = tone; };
    if (linkError) say(linkError.includes("expired") ? "That link has expired. Ask for a new one." : linkError, "bad");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const address = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) { say("Type a valid email address.", "bad"); input.focus(); return; }
      go.disabled = true; say("Sending…");
      try {
        const { error } = await sendLink(address, "/dashboard.html");
        if (error) say(error.status === 429 ? "Too many links asked for. Try again in a few minutes." : error.message, "bad");
        else say(`Check ${address} for your sign-in link. You can close this tab.`, "good");
      } catch { say("Couldn't reach the sign-in service. Check your connection and try again.", "bad"); }
      go.disabled = false;
    });
    // Signing in on another tab (or the link opening this one) lets them straight in
    const sb = await client();
    const { data } = sb.auth.onAuthStateChange((_ev, s) => { if (s) { data.subscription.unsubscribe(); resolve(s); } });
  });
}

// "Tell us about you": the first time it leads into the dashboard; later (#/profile) it edits the same details.
export function profileForm(app, after, session, me, { first = false } = {}) {
  return new Promise((resolve) => {
    document.title = (first ? "Welcome" : "Your profile") + " — PeanutButterJelly.vip";
    const kinds = HOST_KINDS.map(([k, d]) => `<label class="kind"><input type="radio" name="kind" value="${esc(k)}" ${me.host_kind === k ? "checked" : ""} /><span><b>${esc(k)}</b><small>${esc(d)}</small></span></label>`).join("");
    app.innerHTML = `<div class="welcome">
      <div class="create-head"><h1 class="cut">${first ? "Welcome to PB&amp;J" : "Your profile"}</h1>
        <p>${first ? "A few quick things about you, then you can list your first event." : "This is how we know you. Guests don't see it."}</p></div>
      <form class="card welcome-card" novalidate>
        <p class="welcome-who">Signed in as <b>${esc(session.user.email)}</b></p>
        <div class="field" id="w-f-name"><label for="w-name">Your name <span class="req">*</span></label>
          <input id="w-name" class="box" type="text" autocomplete="name" maxlength="120" value="${esc(me.full_name)}" placeholder="e.g. Asha Kulkarni" />
          <p class="err">Please add your name.</p></div>
        <div class="field" id="w-f-kind"><span class="lab">Who are you? <span class="req">*</span></span>
          <div class="kinds">${kinds}</div>
          <p class="err">Pick the one closest to you.</p></div>
        <div class="field"><label for="w-phone">Phone / WhatsApp <span class="opt">Optional</span></label>
          <input id="w-phone" class="box" type="tel" autocomplete="tel" maxlength="40" value="${esc(me.phone)}" placeholder="+91 98200 00000" /></div>
        <div class="field"><label for="w-link">Instagram or website <span class="opt">Optional</span></label>
          <input id="w-link" class="box" type="text" inputmode="url" autocapitalize="off" spellcheck="false" maxlength="300" value="${esc(me.link)}" placeholder="instagram.com/yourpage" /></div>
        <div class="field"><label for="w-about">Tell us about you <span class="opt">Optional</span></label>
          <textarea id="w-about" class="box" rows="3" maxlength="600" placeholder="What do you host, and where in Mumbai?">${esc(me.about)}</textarea></div>
        <label class="check"><input type="checkbox" id="w-call" ${me.wants_call ? "checked" : ""} /><span>I'm keen to be a PB&amp;J pilot host. Book me a quick call.</span></label>
        <p class="welcome-msg" role="status" aria-live="polite"></p>
        <div class="nav">${first ? `<button class="btn ghost" type="button" data-out>Sign out</button>` : `<a class="btn ghost" href="#/">Back</a>`}<button class="btn" type="submit">${first ? "Take me to my dashboard" : "Save"}</button></div>
      </form></div>`;
    after();
    const form = app.querySelector("form"), msg = form.querySelector(".welcome-msg"), go = form.querySelector("[type=submit]");
    const $ = (id) => form.querySelector("#" + id);
    form.querySelector("[data-out]")?.addEventListener("click", async () => { try { await signOut(); } finally { location.reload(); } });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("w-name").value.trim(), kind = form.querySelector("[name=kind]:checked")?.value;
      $("w-f-name").classList.toggle("bad", !name);
      $("w-f-kind").classList.toggle("bad", !kind);
      if (!name) { $("w-name").focus(); return; }
      if (!kind) { form.querySelector("[name=kind]").focus(); return; }
      go.disabled = true; msg.textContent = "Saving…"; msg.dataset.tone = "";
      const blank = (v) => v.trim() || null;
      try {
        const saved = await saveMe(session, {
          full_name: name, host_kind: kind, phone: blank($("w-phone").value), link: blank($("w-link").value),
          about: blank($("w-about").value), wants_call: $("w-call").checked, onboarded: true,
        });
        resolve(saved);
      } catch {
        go.disabled = false;
        msg.textContent = "Couldn't save. Check your connection and try again."; msg.dataset.tone = "bad";
      }
    });
    if (matchMedia("(pointer: fine)").matches && !me.full_name) $("w-name").focus({ preventScroll: true });
  });
}
