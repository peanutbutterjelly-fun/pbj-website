// The account side of the Spontys app: the "Sign in" button in the top bar, the sign-in card, and keeping the profile on the server.
//   - Signed out: the app works as before, with the profile kept in this browser.
//   - Signed in: the profile is read from and saved to the server (/api/me), so it is the same on every device. The first time, a profile
//     already saved in this browser is sent up so nothing typed earlier is lost.
// The profile shown on screen always comes from a copy kept in this browser (so screens can draw it right away); this file keeps that copy
// in step with the server.
import { authConfigured, hasSavedSession, cameFromLink, linkError, startAuth, getSession, onSession, signInWithEmail, signOut, api, uploadAvatar } from "./authClient.js";

const KEY = "pbj-sponty-profile";
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };

/* The screen's profile (name, handle, cities, bio, instagram, youtube, x, birthday, photo) and the server's differ in names only */
const toRemote = (p) => {
  const clean = (v) => (String(v ?? "").trim() || null);
  return {
    full_name: clean(p.name), city: clean(p.cities), bio: clean(p.bio), birthday: clean(p.birthday),
    instagram: clean(String(p.instagram || "").replace(/^@/, "")), youtube: clean(String(p.youtube || "").replace(/\s/g, "")),
    x_handle: clean(String(p.x || "").replace(/^@/, "")),
    // People pick vibes, sponty or newbie themselves; the host badges "pro" and "exclusive" are given by the team, so they are never sent
    ...(["vibes", "sponty", "newbie"].includes(p.badge) ? { badge: p.badge } : {}),
  };
};
const fromRemote = (me) => ({ name: me.full_name || "", handle: me.handle || "", cities: me.city || "Mumbai", bio: me.bio || "", instagram: me.instagram || "", youtube: me.youtube || "", x: me.x_handle || "", birthday: me.birthday || "", photo: me.avatar_url || "", badge: me.badge || "vibes" });
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 24);

const dataUrlToBlob = async (url) => (await fetch(url)).blob();

export function initAccount({ esc, toast, onProfile }) {
  let pulling = null;

  /* ---------- Server profile ---------- */
  async function say(res) { try { return (await res.json()).detail || ""; } catch { return ""; } }

  /** Reads the server profile into this browser's copy. The first time, sends up what was typed here before signing in. */
  async function pull() {
    if (!getSession()) return;
    if (pulling) return pulling;
    pulling = (async () => {
      try {
        const res = await api("/api/me");
        if (!res.ok) return;
        const me = await res.json(), local = read();
        const remoteEmpty = !me.full_name && !me.handle && !me.bio;
        if (remoteEmpty && (local.name || local.handle || local.bio)) await pushUp(local, me);
        else { write({ ...local, ...fromRemote(me) }); }
        if (!read().handle) await claimHandle(me);
        onProfile?.();
      } catch { /* the server being away doesn't stop you being signed in */ } finally { pulling = null; }
    })();
    return pulling;
  }

  /** First sign-in on this account: the profile typed in this browser goes up (photo included). */
  async function pushUp(local) {
    const r = await save({ ...local }, { photoChanged: !!local.photo?.startsWith("data:") });
    if (r.ok) toast("Your saved profile is now on your account");
  }

  /** Gives a new account a handle (the one typed before, or one made from the name or email) and tries a few numbers if it is taken. */
  async function claimHandle(me) {
    const base = slug(read().handle || me.full_name || (getSession()?.user.email || "").split("@")[0]) || "spontys";
    for (let i = 0; i < 6; i++) {
      const handle = (i ? base.slice(0, 22) + Math.floor(100 + Math.random() * 900) : base).padEnd(3, "x");
      const res = await api("/api/me", { method: "PATCH", body: JSON.stringify({ handle }) });
      if (res.ok) { write({ ...read(), handle }); return; }
      if (res.status !== 409) return;
    }
  }

  /**
   * Saves the profile on the server (when signed in). A new photo (a data address from the crop window) is uploaded first.
   * Resolves to { ok: true } or { ok: false, message } with a sentence that can be shown as it is.
   */
  async function save(profile, { photoChanged = false } = {}) {
    if (!getSession()) return { ok: true, local: true };
    try {
      const body = toRemote(profile);
      if (profile.handle) body.handle = profile.handle;
      if (photoChanged && profile.photo?.startsWith("data:")) {
        try { profile = { ...profile, photo: await uploadAvatar(await dataUrlToBlob(profile.photo)) }; }
        catch { return { ok: false, message: "The photo couldn't be saved just now. Everything else is kept; try the photo again in a bit" }; }
        body.avatar_url = profile.photo;
      }
      const res = await api("/api/me", { method: "PATCH", body: JSON.stringify(body) });
      if (res.status === 409) return { ok: false, message: "That handle is taken. Try another one" };
      if (res.status === 422) { const d = await say(res); return { ok: false, message: typeof d === "string" && d ? d : "Something in your profile isn't in a format we can save. Check the handle and the links." }; }
      if (!res.ok) return { ok: false, message: "We couldn't save to your account just now. Your changes are kept on this device; try again in a bit" };
      write({ ...read(), ...fromRemote(await res.json()) });
      return { ok: true };
    } catch {
      return { ok: false, message: "We couldn't reach the server. Your changes are kept on this device; try again in a bit" };
    }
  }

  /* ---------- Top bar button and the sign-in card ---------- */
  const nav = document.querySelector(".dash-nav");
  let btn;
  if (nav && authConfigured()) {
    btn = document.createElement("button");
    btn.type = "button"; btn.className = "sp-acct"; btn.id = "sp-acct";
    nav.prepend(btn);
    btn.addEventListener("click", () => openSheet());
  }
  const label = () => { if (btn) btn.textContent = getSession() ? "Account" : "Sign in"; };

  function openSheet(msg = "") {
    if (!authConfigured()) { toast("Sign-in isn't connected yet"); return; }
    document.querySelector(".wd-back.si")?.remove();
    const back = document.createElement("div"); back.className = "wd-back si";
    const draw = () => {
      const s = getSession();
      back.innerHTML = s
        ? `<div class="wd-card" role="dialog" aria-modal="true" aria-label="Your account"><h2>Signed in</h2><p class="sp-sub">${esc(s.user.email || "")}</p><p class="gt-note">Your profile is saved to your account, so it is the same on every device.</p><div class="wd-btns"><button type="button" class="btn small ghost" data-close>Close</button><button type="button" class="btn small" data-out>Sign out</button></div></div>`
        : `<form class="wd-card" role="dialog" aria-modal="true" aria-label="Sign in" novalidate><h2>Sign in</h2><p class="gt-note">We'll email you a link. Tap it and you're in. No password to remember.</p>
            <label class="si-f"><span>Email</span><input name="email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" required /></label>
            <p class="si-msg" id="si-msg" role="status" ${msg ? "" : "hidden"}>${esc(msg)}</p>
            <div class="wd-btns"><button type="button" class="btn small ghost" data-close>Cancel</button><button type="submit" class="btn small" id="si-send">Send link</button></div></form>`;
    };
    draw();
    document.body.append(back);
    const close = () => { document.removeEventListener("keydown", onKey); back.classList.remove("show"); setTimeout(() => back.remove(), 200); unsub(); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    const unsub = onSession(() => { draw(); });
    back.addEventListener("click", async (e) => {
      if (e.target === back || e.target.closest("[data-close]")) close();
      if (e.target.closest("[data-out]")) { try { await signOut(); toast("Signed out"); close(); } catch { toast("Couldn't sign out. Check your connection and try again."); } }
    });
    back.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target, say2 = (t, tone = "") => { const m = back.querySelector("#si-msg"); m.textContent = t; m.dataset.tone = tone; m.hidden = !t; }, address = f.email.value.trim();
      if (!f.email.checkValidity() || !address) { say2("Type a valid email address.", "bad"); f.email.focus(); return; }
      const send = back.querySelector("#si-send"); send.disabled = true; say2("Sending…");
      try {
        const { error } = await signInWithEmail(address);
        if (error) say2(error.status === 429 ? "Too many links asked for. Try again in a few minutes." : error.message, "bad");
        else { say2(`Check ${address} for your sign-in link.`, "good"); f.reset(); }
      } catch { say2("Couldn't reach the sign-in service. Check your connection and try again.", "bad"); }
      finally { send.disabled = false; }
    });
    requestAnimationFrame(() => { back.classList.add("show"); (back.querySelector("input") || back.querySelector("button")).focus({ preventScroll: true }); });
  }

  /** A card for the top of the profile when signed out. */
  const nudge = () => (authConfigured() && !getSession() ? `<section class="sp-card si-nudge"><div><b>Sign in to keep your profile</b><p class="sp-sub">It's saved only on this device right now. Sign in and it follows you to any phone or computer.</p></div><button type="button" class="btn small" data-signin>Sign in</button></section>` : "");

  /* ---------- Wiring ---------- */
  if (authConfigured()) {
    onSession(() => { label(); if (getSession()) pull(); });
    // Coming back from the email link: finish signing in, tidy the address bar and land on the profile
    if (cameFromLink()) {
      const err = linkError();
      startAuth().then(() => {
        history.replaceState(null, "", location.pathname + location.search + "#/profile");
        window.dispatchEvent(new HashChangeEvent("hashchange"));
        if (err) openSheet(err.includes("expired") ? "That link has expired. Ask for a new one." : err);
        else toast("You're signed in");
      }).catch(() => openSheet("Couldn't finish signing in. Check your connection and try the link again."));
    } else if (hasSavedSession()) startAuth().catch(() => {});
    label();
    btn?.addEventListener("pointerenter", () => startAuth().catch(() => {}), { once: true });
  }

  return { isSignedIn: () => Boolean(getSession()), email: () => getSession()?.user.email || "", openSheet, save, pull, nudge, configured: authConfigured };
}
