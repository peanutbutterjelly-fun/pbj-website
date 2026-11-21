// The account side of the Spontys app: the "Sign in" button in the top bar, the sign-in card, and keeping the profile on the server.
//   - Signed out: the app works as before, with the profile kept in this browser.
//   - Signed in: the profile is read from and saved to the server (/api/me), so it is the same on every device. The first time, the
//     person is asked whether a profile already saved in this browser should become their account's profile.
// It uses the website's shared sign-in (auth.js: one Supabase client per page) and photo helpers (images.js: the "images" folder).
// The profile on screen always comes from a copy kept in this browser (so screens can draw it right away); this file keeps that copy
// in step with the server:
//   - a change that hasn't reached the server yet is marked "dirty", and is never overwritten by what the server says (it is sent again)
//   - the copy remembers whose account it belongs to; signing out clears it (and the rest of this browser's Spontys data)
import { authReady, apiReady, client, hasSavedSession, cameFromLink, sendLink, signOut, takeNext, fetchMe, saveMe, onAuthChange } from "./auth.js";
import { shrinkImage, uploadImage, imageMessage, removeImages } from "./images.js";
import { PREFIX, read, write, clearAll } from "./spontysStore.js";

const KEY = PREFIX + "profile", DIRTY = PREFIX + "profile-dirty", OWNER = PREFIX + "profile-owner";
const BIO_MAX = 200; // the screen's limit; the server allows up to 600
const SB_URL = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const local = () => read(KEY, {});
const isDirty = () => read(DIRTY, false) === true;
const setDirty = (on) => write(DIRTY, Boolean(on));

/* The screen's profile (name, handle, cities, bio, instagram, youtube, x, birthday, photo, badge) and the server's differ in names only */
const clean = (v) => String(v ?? "").trim() || null;
const toRemote = (p) => ({
  full_name: clean(p.name), city: clean(p.cities), about: clean(String(p.bio ?? "").slice(0, BIO_MAX)), birthday: clean(p.birthday),
  instagram: clean(String(p.instagram || "").replace(/^@/, "")), youtube: clean(String(p.youtube || "").replace(/\s/g, "")),
  x_handle: clean(String(p.x || "").replace(/^@/, "")),
  // People pick vibes, sponty or newbie themselves; the host badges "pro" and "exclusive" are given by the team, so they are never sent
  ...(["vibes", "sponty", "newbie"].includes(p.badge) ? { badge: p.badge } : {}),
  ...(p.handle ? { handle: String(p.handle).toLowerCase() } : {}),
});
const fromRemote = (me) => ({ name: me.full_name || "", handle: me.handle || "", cities: me.city || "Mumbai", bio: me.about || "", instagram: me.instagram || "", youtube: me.youtube || "", x: me.x_handle || "", birthday: me.birthday || "", photo: me.avatar_url || "", badge: me.badge || "vibes" });
/** Does this browser's copy hold anything the person typed (any field, not only the name)? */
const hasContent = (p) => Boolean(p.name || p.handle || p.bio || p.photo || p.birthday || p.instagram || p.youtube || p.x || (p.cities && p.cities !== "Mumbai") || (p.badge && p.badge !== "vibes"));
const remoteEmpty = (me) => !me.full_name && !me.handle && !me.about && !me.avatar_url;
/** A handle the server accepts: 3 to 30 of a-z, 0-9, _ and . */
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 30);
const linkError = () => (cameFromLink() ? new URLSearchParams(location.hash.slice(1)).get("error_description") : null);

export function initAccount({ esc, toast, onProfile }) {
  const configured = () => authReady() && apiReady();
  let session = null, readyDone = false, readyResolve;
  const ready = new Promise((r) => { readyResolve = r; });
  const markReady = () => { if (!readyDone) { readyDone = true; readyResolve(); } };
  if (!configured() || (!hasSavedSession() && !cameFromLink())) markReady(); // nobody can be signed in yet, so nothing to wait for
  const ownPhoto = (u) => Boolean(session && typeof u === "string" && u.startsWith(`${SB_URL}/storage/v1/object/public/images/${session.user.id}/profile/`));

  /* ---------- Saving to the server ---------- */
  const problem = (err) => {
    if (err?.status === 409) return { ok: false, taken: true, message: "That handle is taken. Try another one." };
    if (err?.status === 422) return { ok: false, message: "Something in your profile isn't in a format we can save. Check the handle (3 to 30 letters, numbers, _ or .) and the social handles." };
    if (err?.status === 401) return { ok: false, message: "You've been signed out. Sign in again to save to your account. Your changes are kept on this device." };
    if (err?.status) return { ok: false, message: "We couldn't save to your account just now. Your changes are kept on this device; try again in a bit." };
    return { ok: false, message: "We couldn't reach the server. Your changes are kept on this device; try again in a bit." };
  };

  /**
   * Saves the profile on the server (when signed in). A photo that is still only on this device (a data address from the crop window)
   * is uploaded first, every time, until it has made it. Resolves to { ok: true } or { ok: false, message } with a sentence to show as it is.
   * Waits for a sign-in still being restored, so an edit made in the first moments after opening the page isn't skipped.
   */
  async function save(profile, { skipHandle = false } = {}) {
    if (!readyDone) await ready;
    if (!session) return { ok: true, local: true };
    setDirty(true); // until the server has it
    const s = session;
    try {
      const body = toRemote(profile);
      if (skipHandle) delete body.handle;
      let oldPhoto = null, uploaded = null;
      if (String(profile.photo || "").startsWith("data:")) {
        try {
          const blob = await shrinkImage(await (await fetch(profile.photo)).blob(), 400);
          body.avatar_url = uploaded = await uploadImage(s, blob, "profile");
          oldPhoto = lastPhoto;
        } catch (err) { return { ok: false, message: (imageMessage(err) || "The photo couldn't be saved just now.") + " Everything else is kept on this device." }; }
      } else if (!profile.photo) body.avatar_url = null;
      else if (ownPhoto(profile.photo)) body.avatar_url = profile.photo; // anything else (a link that isn't their own upload) is never sent
      let me;
      try { me = await saveMe(s, body); } catch (err) { if (uploaded) removeImages(s, [uploaded]); throw err; } // a refused save leaves no stray photo behind
      if (session?.user.id !== s.user.id) return { ok: false, message: "You signed out before this was saved." };
      // the server's answer is now the truth, unless more was typed while it was being saved: that stays, still marked to send
      const now = local();
      if (JSON.stringify(now) === JSON.stringify(profile)) { write(KEY, { ...now, ...fromRemote(me) }); setDirty(false); }
      else if (now.photo === profile.photo) write(KEY, { ...now, photo: me.avatar_url || "" });
      write(OWNER, s.user.id);
      if (oldPhoto && oldPhoto !== me.avatar_url && ownPhoto(oldPhoto)) removeImages(s, [oldPhoto]); // the replaced photo stops being reachable
      lastPhoto = me.avatar_url || null;
      return { ok: true };
    } catch (err) { return problem(err); }
  }
  let lastPhoto = null; // the photo the server has now, so it can be removed once a new one replaces it

  /** Gives an account without a handle one (the one typed before, or one made from the name or email), trying a few numbers if taken.
   *  `taken` skips straight to the numbered tries (the plain one was just refused). */
  async function claimHandle(me, want = "", taken = false) {
    let base = slug(want || local().handle || me.full_name || local().name || (session?.user.email || "").split("@")[0]);
    if (base.length < 3) base = (base + "spontys").slice(0, 7);
    base = base.slice(0, 21); // room for a three-digit number within the 30 the server allows
    for (let i = taken ? 1 : 0; i < 7; i++) {
      const handle = i ? base + Math.floor(100 + Math.random() * 900) : base;
      try { const r = await saveMe(session, { handle }); write(KEY, { ...local(), handle: r.handle || handle }); return handle; }
      catch (err) { if (err?.status !== 409) return null; }
    }
    return null;
  }

  /** A yes / no card. Resolves to true or false. */
  const ask = (title, text, yes, no) => new Promise((done) => {
    const back = document.createElement("div"); back.className = "wd-back si";
    back.innerHTML = `<div class="wd-card" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2><p class="gt-note">${esc(text)}</p><div class="wd-btns"><button type="button" class="btn small ghost" data-no>${esc(no)}</button><button type="button" class="btn small" data-yes>${esc(yes)}</button></div></div>`;
    document.body.append(back);
    const finish = (v) => { back.classList.remove("show"); setTimeout(() => back.remove(), 200); done(v); };
    back.querySelector("[data-yes]").addEventListener("click", () => finish(true));
    back.querySelector("[data-no]").addEventListener("click", () => finish(false));
    requestAnimationFrame(() => { back.classList.add("show"); back.querySelector("[data-yes]").focus({ preventScroll: true }); });
  });

  /** First sign-in with a profile typed on this device: it goes up, minus the handle if that is taken (then a free one is picked). */
  async function pushUp(me) {
    const p = local();
    write(OWNER, session.user.id); // they said yes: if this doesn't reach the server now, it is sent again next time (not asked again)
    let r = await save(p);
    if (r.taken) {
      r = await save(p, { skipHandle: true });
      if (r.ok) { const h = await claimHandle(me, p.handle, true); toast(`@${p.handle} was taken${h ? `, so you're @${h} for now. Change it in Edit profile` : ". Pick another one in Edit profile"}`); return; }
    }
    toast(r.ok ? "Your saved profile is now on your account" : r.message);
  }

  /* ---------- Reading from the server (only when someone signs in or the page opens signed in) ---------- */
  let pulling = null;
  function pull() {
    if (!session || pulling) return pulling;
    const s = session;
    pulling = (async () => {
      try {
        const me = await fetchMe(s);
        if (session?.user.id !== s.user.id) return;
        lastPhoto = me.avatar_url || null;
        let owner = read(OWNER, null), mine = local();
        if (owner && owner !== s.user.id) { clearAll(); owner = null; mine = {}; } // someone else's copy was left here: it never goes to this account
        const adopt = () => { write(KEY, { ...local(), ...fromRemote(me) }); setDirty(false); write(OWNER, s.user.id); };
        if (owner === s.user.id && isDirty()) {
          // changes that didn't reach the server yet: send them again, and never overwrite them with the older server copy
          const r = await save(local()); if (!r.ok) toast(r.message);
        } else if (!owner && hasContent(mine) && remoteEmpty(me)) {
          // a profile typed on this device before signing in, and an empty account: on a shared device it might be someone else's, so ask
          if (await ask("Use this profile?", "Use the profile saved on this device for your account?", "Yes, use it", "Start fresh")) await pushUp(me);
          else { clearAll(); adopt(); }
        } else adopt();
        if (session?.user.id === s.user.id && !local().handle && !me.handle) await claimHandle(me);
      } catch { /* the server being away doesn't stop you being signed in */ } finally { pulling = null; onProfile?.(); }
    })();
    return pulling;
  }

  /* ---------- Top bar button and the sign-in card ---------- */
  const nav = document.querySelector(".dash-nav");
  let btn;
  if (nav && configured()) {
    btn = document.createElement("button");
    btn.type = "button"; btn.className = "sp-acct"; btn.id = "sp-acct";
    nav.prepend(btn);
    btn.addEventListener("click", () => openSheet());
  }
  const label = () => { if (btn) btn.textContent = session ? "Account" : "Sign in"; };

  let draws = new Set(); // open sign-in cards redraw when the session changes
  function openSheet(msg = "") {
    if (!configured()) { toast("Sign-in isn't connected yet"); return; }
    start();
    document.querySelector(".wd-back.si")?.remove();
    const back = document.createElement("div"); back.className = "wd-back si";
    const draw = () => {
      back.innerHTML = session
        ? `<div class="wd-card" role="dialog" aria-modal="true" aria-label="Your account"><h2>Signed in</h2><p class="sp-sub">${esc(session.user.email || "")}</p><p class="gt-note">Your profile is saved to your account, so it is the same on every device. Signing out clears it from this device.</p><p class="si-msg" id="si-msg" role="status" hidden></p><div class="wd-btns"><button type="button" class="btn small ghost" data-close>Close</button><button type="button" class="btn small" data-out>Sign out</button></div></div>`
        : `<form class="wd-card" role="dialog" aria-modal="true" aria-label="Sign in" novalidate><h2>Sign in</h2><p class="gt-note">We'll email you a link. Tap it and you're in. No password to remember.</p>
            <label class="si-f"><span>Email</span><input name="email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" required /></label>
            <p class="si-msg" id="si-msg" role="status" ${msg ? "" : "hidden"}>${esc(msg)}</p>
            <div class="wd-btns"><button type="button" class="btn small ghost" data-close>Cancel</button><button type="submit" class="btn small" id="si-send">Send link</button></div></form>`;
    };
    draw(); draws.add(draw);
    document.body.append(back);
    const say2 = (t, tone = "") => { const m = back.querySelector("#si-msg"); if (!m) return; m.textContent = t; m.dataset.tone = tone; m.hidden = !t; };
    const close = () => { document.removeEventListener("keydown", onKey); draws.delete(draw); back.classList.remove("show"); setTimeout(() => back.remove(), 200); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    back.addEventListener("click", async (e) => {
      if (e.target === back || e.target.closest("[data-close]")) return close();
      const out = e.target.closest("[data-out]"); if (!out) return;
      out.disabled = true;
      try {
        const { error } = await signOut();
        if (error) { say2("Couldn't sign out. Check your connection and try again.", "bad"); out.disabled = false; return; }
        forget(); toast("Signed out. Your profile was cleared from this device"); close();
      } catch { say2("Couldn't sign out. Check your connection and try again.", "bad"); out.disabled = false; }
    });
    back.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target, address = f.email.value.trim();
      if (!f.email.checkValidity() || !address) { say2("Type a valid email address.", "bad"); f.email.focus(); return; }
      const send = back.querySelector("#si-send"); send.disabled = true; say2("Sending…");
      try {
        const { error } = await sendLink(address, location.pathname);
        if (error) say2(error.status === 429 ? "Too many links asked for. Try again in a few minutes." : "Couldn't send the link. Check the address and try again.", "bad");
        else { say2(`Check ${address} for your sign-in link.`, "good"); f.reset(); }
      } catch { say2("Couldn't reach the sign-in service. Check your connection and try again.", "bad"); }
      finally { send.disabled = false; }
    });
    requestAnimationFrame(() => { back.classList.add("show"); (back.querySelector("input") || back.querySelector("button")).focus({ preventScroll: true }); });
  }

  /** After signing out: this device forgets the profile and the rest of the account's Spontys data, so the next person doesn't see it. */
  function forget() { clearAll(); session = null; label(); onProfile?.(); }

  /** A card for the top of the profile when signed out. */
  const nudge = () => (configured() && !session ? `<section class="sp-card si-nudge"><div><b>Sign in to keep your profile</b><p class="sp-sub">It's saved only on this device right now. Sign in and it follows you to any phone or computer.</p></div><button type="button" class="btn small" data-signin>Sign in</button></section>` : "");

  /* ---------- Wiring ---------- */
  let started = null;
  function start() {
    if (!configured()) return Promise.resolve();
    return (started ??= onAuthChange((event, s) => {
      session = s; label(); draws.forEach((d) => d());
      // pull only when someone signs in or the page opens signed in; a token refresh changes nothing on the profile
      // (later, outside this callback: Supabase asks for no other calls from inside it)
      if (s && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) setTimeout(pull, 0);
      else if (event !== "TOKEN_REFRESHED") setTimeout(() => onProfile?.(), 0); // the nudge and Settings follow the change
      if (event === "INITIAL_SESSION") markReady();
    }).catch((err) => { started = null; markReady(); throw err; }));
  }
  if (configured()) {
    // Coming back from the email link: finish signing in, tidy the address bar and land on the profile
    if (cameFromLink()) {
      const err = linkError();
      start().then(() => client()).then((sb) => sb.auth.getSession()).then(() => {
        takeNext(); // this page is where the link was meant to land
        history.replaceState(history.state, "", location.pathname + location.search + "#/profile");
        window.dispatchEvent(new HashChangeEvent("hashchange"));
        if (err) openSheet(err.includes("expired") ? "That link has expired. Ask for a new one." : "That link didn't work. Ask for a new one.");
        else toast("You're signed in");
      }).catch(() => openSheet("Couldn't finish signing in. Check your connection and try the link again."));
    } else if (hasSavedSession()) start().catch(() => {});
    label();
    btn?.addEventListener("pointerenter", () => start().catch(() => {}), { once: true });
  }

  return { isSignedIn: () => Boolean(session), email: () => session?.user.email || "", openSheet, save, pull, nudge, configured, ready: () => ready };
}
