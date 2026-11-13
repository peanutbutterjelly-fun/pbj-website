import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Observer } from "gsap/Observer";
import { Flip } from "gsap/Flip";
import { createCutLetter } from "./cutword.js";
import { saveLead } from "./leads.js";
import { EVENTS } from "./eventsData.js";

gsap.registerPlugin(Flip, ScrollTrigger, Observer);

// The Events page: the paper-cut headline, and the lineup of vintage tickets (one per event in eventsData.js).
export function setupEvents(root) {
  setupHeadline(root);
  setupBrowse(root);
}

// ---- List Your Event: GSAP's "Layered pinning" (codepen.io/GreenSock/pen/VwbywPd, see INSPIRATION.md) ----
// Every section is a full screen that ScrollTrigger pins at the top, so the next one slides up over it like a card laid on a pile.
// The page snaps to the nearest section (ScrollTrigger.maxScroll() gives the end of the page). The last section is a closing line that
// types itself out. It does not loop: after it, scrolling on opens the next folder like on every other page.
// (The "Your events" button is switched off for now; see the note beside the sections.)
// "Know more" on the artists slide opens a little retro "website window" (setupWindows): a + appears at the button, stretches into a box,
// and the text is typed out inside it. The old dissolve + ticket (setupTickets) is switched off; add  ticket: ARTIST_TICKET  to a slide to bring it back.
const ARTIST_WINDOW = {
  know: "Know more", title: "For artists", close: "[\u00D7]",
  body: "Your audience base feels saturated: a bunch in a WhatsApp group, a cluster of \u201CI\u2019m interested\u201D DMs floating on your Instagram, QR codes and \u201CPayment Successful\u201D screenshots circulating across platforms. So the next step toward growth feels like doing things professionally. A clean listing process. A dedicated place to redirect existing folks and be discovered by new audiences. This time, the only link circulating will be \u201CBook Your Tickets on PBJ\u201D",
};
const ARTIST_TICKET = {
      know: "Know more",
      kind: "For artists", code: "TYPE #PBJ-ARTIST", no: "No. 0001",
      body: "Your audience base feels saturated: a bunch in a WhatsApp group, a cluster of \u201CI\u2019m interested\u201D DMs floating on your Instagram, QR codes and \u201CPayment Successful\u201D screenshots circulating across platforms. So the next step toward growth feels like doing things professionally. A clean listing process. A dedicated place to redirect existing folks and be discovered by new audiences. This time, the only link circulating will be <mark>\u201CBook Your Tickets on PBJ\u201D</mark>",
      stubTitle: "That\u2019s me!", stubButton: "Sign me up", stubKind: "Tear-off", stubCode: "#PBJ-A1",
};

// "Know more" windows for the slides in between. The wording below is a first draft written to match each slide: swap in your own text any time.
const padWin = (title, body, color, ask) => ({ know: "Know more", title, close: "[\u00D7]", body, color, ask });
const EXCLUSIVE_WINDOW = padWin("For exclusive hosts", "You are someone who hosts events every weekday or weekend, or you are just getting into hosting; you are either familiar with various ticketing platforms, or this may be your first time trying one. Regardless, there is one thing you have certainly not tried: the fun of exclusivity.\n\nPBJ EXCLUSIVE HOSTS become our stars before listing any event on this platform. You already know the perks of being a star: an absolute makeover, front-line exposure, exclusive promotions, a curated profile, and premium status.\n\nOf course, there will be a catch! A PBJ EXCLUSIVE HOST must highlight two qualities our audience is promised at Peanut Butter Jelly. A unique vibe and a fresh taste. Bring these in and consider yourself in!", undefined, {
  q: "Think you could be in?",
  yes: ["Love the confidence!", "So, what\u2019s your signature move for making the cut?", "(NOTE: A PBJ EXCLUSIVE HOST WILL NOT HOLD BACK FROM CLICKING BOTH BUTTONS)"],
  cta: ["Sign up", "Fill us in"],
});
const QUICKWIT_WINDOW = padWin("For the quick-witted", "You are tired of all your friends repeating \u201CNEXT WEEKEND\u201D for a simple outing. And the thought of cloning your busy friends on a random Tuesday for a cafe outing or a Colaba Causeway shopping spree makes you wonder how nice it would be if only that were possible.\n\nIt is possible! Not cloning, but finding those who are \u201CGAME\u201D for your last-minute plans.\n\nHear about a plan at five and be in a cab by six. These are your people. The ones who skip the planning and chase the fun right from the get-go. PBJ Sponty is built for last-minute plans happening around Mumbai. List yours and let the spontaneous ones find you.", "var(--cream)", {
  q: "Are you a SPONTY?",
  yes: ["Goody goody! Time to vibe with your SPONTY gang.", "You can choose to do both / simply sign up to get notified when we launch.", "(NOTE: FILLING OUT THE FORM HELPS US GET TO KNOW YOU FIRST BEFORE OTHERS IN LINE)"],
});
const VENUE_WINDOW = padWin("For venues", "You love your dining customers. Walk-ins are great. Seasons fill the room with the same workshops. Weekends let you proudly say, \u201CWE ARE BOOKED FOR THE EVENING\u201D. Yet your jaded four walls ask for more. Why wouldn\u2019t they? Every wall deserves to be met by crowds unknown to it. Its ears must yearn for conversations beyond the same old first dates and friends\u2019 gossip. Especially if your walls are prey to the daily midday rinse-and-repeat: the hour-long catch-up over TWO cups of coffee. Dangerously so, if their only crowd is the laptop-users. Maybe it is time you gave your walls a new environment.\n\nWe welcome all kinds of walls. Reach out to PBJ to become our partner venue, and we\u2019ll personally pick the right events to fill your rooms with the perfect kind of buzz, a pinch of quirk, and that off-the-track zest to your normal Monday to Friday. While we\u2019re at it, why leave Saturdays & Sundays?", undefined, {
  q: "What do the walls say?",
  yes: ["Great Choice! Your walls have TASTE!", "You can choose to do both / simply sign up to get notified when we launch.", "(NOTE: FILLING OUT THE FORM HELPS US GET TO KNOW YOU FIRST BEFORE OTHERS IN LINE)"],
});
const BRAND_WINDOW = padWin("For brands", "Marketing is great, but let\u2019s talk connection. \u201CThe room can be well decorated and have everything looking perfect, but if the right names don\u2019t fill it, it\u2019s a shame.\u201D If you share the sentiment, we want to work with you.", "var(--cream)", {
  q: "Ready to LINK?",
  yes: ["Great! We now have one link to a successful connection.", "You can choose to do both / simply sign up to get notified when we launch.", "(NOTE: FILLING OUT THE FORM HELPS US GET TO KNOW YOU FIRST BEFORE OTHERS IN LINE)"],
});
const BACKER_WINDOW = padWin("For backers", "You like investments. You want to be on one side of X, yeah?\nYOU X PBJ ORIGINAL!!!\nWe say. \u201CLet\u2019s do it!\u201D\n\nPBJ ORIGINAL NIGHTS are the evenings we host ourselves, from the first idea to the last song, and every one of them deserves a bold backer. PBJ welcomes creative individuals, brands, venues, institutions, firms, organisations, communities and groups. Everyone who wants to back an ORIGINAL. We want you in the mix!\n\nPut your name where the crowd actually gathers and be part of the night people talk about for weeks. Leave your details, and we will create the night for you.", "var(--cream)", {
  q: "Ready to GLAZE?",
  yes: ["Sweet deal! Your name just found its night.", "You can choose to do both / simply sign up to get notified when we launch.", "(NOTE: FILLING OUT THE FORM HELPS US GET TO KNOW YOU FIRST BEFORE OTHERS IN LINE)"],
});

// The questions inside "Fill the form", slide by slide (first drafts, edit freely). type: text, area (long answer), link (also saved as the link) or pick (tap one).
// Only name and email are required; every question here is optional. Answers are saved together under the question's own wording.
ARTIST_WINDOW.qs = [
  { q: "What do you make?", type: "pick", opts: ["Music", "Comedy", "Poetry / spoken word", "Dance", "Theatre", "Art / craft", "Something else"] },
  { q: "Where can we see your work?", type: "link", ph: "Instagram, YouTube, website\u2026" },
  { q: "Your last event: where was it and how many came?", type: "text" },
  { q: "How do you sell tickets today?", type: "pick", opts: ["WhatsApp / DMs", "Google Form + UPI screenshots", "Another platform", "I don\u2019t yet"] },
  { q: "Which Mumbai spot do you dream of hosting your next event in?", type: "place" },
  { q: "What annoys you most about getting people through the door?", type: "area" },
];
EXCLUSIVE_WINDOW.qs = [
  { q: "What kind of events do you host?", type: "pick", opts: ["Music nights", "Workshops", "Comedy / open mics", "Food & drink", "Markets / pop-ups", "Mixed bag", "Something else"] },
  { q: "How often do you host?", type: "pick", opts: ["Every week", "Every month", "A few times a year", "Just starting"] },
  { q: "Show us a past event", type: "link", ph: "Instagram post, album, website\u2026" },
  { q: "Which ticketing platform do you use now?", type: "text", ph: "Or \u201Cnone yet\u201D" },
  { q: "You think you got something never tested in India before?", type: "pick", opts: ["Yes", "No, but we can always make it"], more: { Yes: "All ears!" } },
  { q: "What\u2019s cookin\u2019 in your brain that fits the \u201CPBJ EXCLUSIVE HOST\u201D label?", type: "area" },
  { q: "Describe the \u201CUnique Vibe\u201D & \u201CFresh Taste\u201D of your upcoming / existing event style?", type: "area" },
];
QUICKWIT_WINDOW.qs = [
  { q: "What is your kind of last-minute plan?", type: "pick", opts: ["Cafe hop", "Shopping spree", "Gig / open mic", "Late-night food run", "Sports / games", "Anything goes", "Nothing we know of?"], more: { "Nothing we know of?": "Let us know now\u2026" } },
  { q: "Which part of Mumbai are you usually in?", type: "place", ph: "Bandra, Andheri, Thane\u2026" },
  { q: "How short a notice is too short?", type: "pick", opts: ["Under 2 hours", "Same day", "Next day is fine"] },
  { q: "Do you host the plan or join it?", type: "pick", opts: ["I host", "I join", "Both"] },
  { q: "How do you usually host / join your spontaneous plans?", type: "pick", opts: ["WhatsApp group", "Insta DMs", "Ring my friends", "Use a specific platform"], more: { "Use a specific platform": "Tell us which" } },
  { q: "Usual gang size?", type: "pick", opts: ["2 to 4", "5 to 10", "10 or more"] },
  { q: "Best spur-of-the-moment plan you ever had?", type: "area" },
  { q: "If you use PBJ today, what kind of spontaneous plan would you list with us?", type: "area" },
];
VENUE_WINDOW.qs = [
  { q: "Venue name", type: "text" },
  { q: "What kind of place is it?", type: "pick", opts: ["Cafe", "Bar", "Restaurant", "Studio", "Rooftop", "Gallery / bookshop", "Something else"] },
  { q: "Which area of Mumbai?", type: "place" },
  { q: "How many people fit comfortably?", type: "text", ph: "A rough number is fine" },
  { q: "Which days or hours sit quiet?", type: "text", ph: "Monday afternoons, Sunday evenings\u2026" },
  { q: "Link to your place", type: "link", ph: "Instagram or Google Maps" },
  { q: "What kind of crowd is your usual customer?", type: "area" },
  { q: "What kind of crowd are your walls most excited to fill?", type: "area" },
  { q: "How does becoming our venue partner sound to you?", type: "pick", opts: ["We\u2019d love to", "Need to think", "We\u2019re okay"] },
];
BRAND_WINDOW.qs = [
  { q: "Brand name", type: "text" },
  { q: "What kind of product / services does the brand sell?", type: "text" },
  { q: "Link to your brand", type: "link", ph: "Instagram or website" },
  { q: "Which crowd do you most want to connect with?", type: "area" },
  { q: "What kind of link are you after?", type: "pick", opts: ["Sponsor a night", "Product in the room", "Co-host an evening", "Not sure yet"] },
  { q: "Roughly what are you thinking of spending?", type: "text", ph: "Punch in the numbers\u2026", note: "Rough figure is fine. Not sure yet? Say so." },
];
BACKER_WINDOW.qs = [
  { q: "Who is backing?", type: "pick", opts: ["Just me", "A brand", "A venue", "A firm / institution", "A community / group"] },
  { q: "Name of your brand or group", type: "text", ph: "Leave blank if it is just you" },
  { q: "Link to you or your work", type: "link", ph: "Instagram, LinkedIn, website\u2026" },
  { q: "How would you like to back a night?", type: "pick", opts: ["With funding", "With a space", "With products", "With skills / time", "Not sure yet"] },
  { q: "What kind of night would you love your name on?", type: "area" },
];

// the colours of the paper-cut question in the windows
ARTIST_WINDOW.look = EXCLUSIVE_WINDOW.look = QUICKWIT_WINDOW.look = VENUE_WINDOW.look = BRAND_WINDOW.look = BACKER_WINDOW.look = { fill: "var(--pop)", shadow: "var(--brown)" }; // all dark yellow with a dark brown shadow

// (text colour and the hard shadow under it; any white text gets a shadow that is not white)
const LIST_LOOP = [
  { textFx: "mask", stack: true, bg: "var(--cream)", fill: "var(--honey)", shadow: "var(--brown)", name: "WHO ARE YOU TODAY?" },
  { textFx: "mask", bg: "var(--honey)", fill: "var(--cream)", shadow: "var(--crust)", name: "AN ARTIST LOOKING FOR YOUR NEXT AUDIENCE?", win: ARTIST_WINDOW },
  { textFx: "mask", bg: "var(--pop)", fill: "var(--cream)", shadow: "var(--brown)", name: "AN ARTIST WITH THE MINDSET OF EXCLUSIVITY?", win: EXCLUSIVE_WINDOW },
  { textFx: "mask", bg: "var(--strawberry)", fill: "var(--honey)", shadow: "var(--brown)", name: "QUICK-WITTED FOLKS WHO DEVOUR SPONTANEOUS PLANS & LEAVE NO CRUMBS?", win: QUICKWIT_WINDOW },
  { textFx: "mask", bg: "var(--cream)", fill: "var(--pop)", shadow: "var(--crust)", name: "A VENUE BRICKED UP & READY FOR HOMING OFF-THE-TRACK, QUIRKY, BUZZY CROWD?", win: VENUE_WINDOW },
  { textFx: "mask", bg: "var(--crust)", fill: "var(--honey)", shadow: "var(--brown)", name: "HOL' ON! YOU ARE A BRAND THAT KNOWS BEST WHEN TO FILL THE RIGHT ROOMS?", win: BRAND_WINDOW },
  // (the "Your events" button is off for now; to bring it back add to this line: button: { label: "Your events", href: "/dashboard.html" })
  { textFx: "mask", bg: "var(--brown)", fill: "var(--cream)", shadow: "var(--crust)", name: "OH...WE CAUGHT YOUR EYE, & YOU WANT TO GLAZE US WITH YOUR MONEY?", win: BACKER_WINDOW },
  // the closing line types itself out when it comes into view
  { type: true, phoneBreak: true, bg: "var(--cream)", fill: "var(--strawberry)", shadow: "var(--brown)", name: "SO, WHO ARE YOU TODAY...", button: { label: "Your dashboard", href: "/dashboard.html" } },
];

// A line that types itself out, letter by letter with a blinking cursor, each time it comes into view
function setupTypewriter(slide, title, auto = true) {
  const letters = [...title.querySelectorAll(".w > *")];
  const cursor = document.createElement("span");
  cursor.className = "ev-cursor";
  cursor.setAttribute("aria-hidden", "true");
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const btn = slide.querySelector(".btn"); // a button on this slide waits until the line has been typed
  let tl = null;
  const reset = () => {
    tl?.kill();
    letters.forEach((l) => (l.style.visibility = "hidden"));
    cursor.remove();
    if (btn) { gsap.killTweensOf(btn); gsap.set(btn, { opacity: 0, y: 14, pointerEvents: "none" }); }
  };
  const play = () => {
    reset();
    if (calm) { letters.forEach((l) => (l.style.visibility = "visible")); if (btn) gsap.set(btn, { opacity: 1, y: 0, pointerEvents: "" }); return; }
    tl = gsap.timeline({ delay: 0.4 });
    // a steady tap-tap-tap, with a beat between words. After a comma the cursor waits, then drops to the start of the next line (or the
    // next word) and blinks there for a moment before the first letter is typed, like a typewriter's carriage return
    const chars = [...title.dataset.text].filter((c) => c !== " ");
    let at = 0;
    letters.forEach((l, i) => {
      if (i) {
        const prev = at;
        at = prev + 0.1;
        if (letters[i - 1].parentNode !== l.parentNode) at += 0.16; // between words
        if (chars[i - 1] === ",") {
          tl.call(() => l.before(cursor), null, prev + 0.4); // the cursor moves first...
          at = prev + 0.95; // ...and the letter follows after it has blinked there
        }
        if (chars[i - 1] === "." && chars[i] === ".") at -= 0.02; // the three dots come a touch quicker
      }
      tl.call(() => { l.style.visibility = "visible"; l.after(cursor); }, null, at);
    });
    if (btn) tl.to(btn, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", onStart: () => { btn.style.pointerEvents = ""; } }, "+=0.35");
    else tl.call(() => {}, null, "+=0.1");
  };
  reset();
  if (auto) {
    let on = false;
    new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.intersectionRatio >= 0.6 && !on) { on = true; play(); }
      else if (!e.isIntersecting && on) { on = false; reset(); }
    }), { threshold: [0, 0.6] }).observe(slide);
  }
  return { play, reset };
}

// Which scroll effect List Your Event uses (on computers and phones alike):
//  "layered":  one swipe or scroll gesture slides the next section up over the last one (and back); the page itself never scrolls
//  "observer": GSAP's "Animated Continuous Sections with GSAP Observer" (codepen.io/GreenSock/pen/XWzRraJ): the page itself does not scroll;
//              each scroll gesture slides the next section in like a curtain, with the letters flying in
//  "pinned":   GSAP's "Layered pinning with infinite looping" (codepen.io/GreenSock/pen/VwbywPd): ScrollTrigger pins each section
const LOOP_MODE = "layered";

// The letters of a title, drawn one by one in paper-cut style (skip: () => true while they are out of sight)
function buildTitle(title, def, skip) {
  const text = title.dataset.text;
  title.setAttribute("aria-label", text);
  text.split(" ").forEach((word, wi, all) => {
    const w = document.createElement("span");
    w.className = "w";
    w.setAttribute("aria-hidden", "true");
    [...word].forEach((ch) => {
      const letter = createCutLetter(ch, { fill: def.fill, shadow: def.shadow, skip });
      if (letter) w.append(letter.el);
      else w.append(document.createTextNode(ch));
    });
    title.append(w);
    if (wi < all.length - 1) title.append(" ");
    if (wi === 0 && def.phoneBreak) { const br = document.createElement("br"); br.className = "ev-br"; title.append(br); } // (only a line break on phones)
  });
}

// The page itself never scrolls (native scrolling plus pinned layers glitched, and a hard flick could skip sections): one gesture lays
// the next section over the last one with a smooth GSAP slide, the same pile-of-cards look on computers and phones
export function setupLoop(root, lenis, LOOP = LIST_LOOP) {
  if (LOOP_MODE === "pinned") return setupPinnedLoop(root, lenis, LOOP); // ScrollTrigger pinning (page really scrolls)
  return setupObserverLoop(root, LOOP, LOOP_MODE !== "observer"); // "layered" (default) or the curtain version
}

// ---- "Animated Continuous Sections": one scroll gesture = one section. The new section's curtain (outer) slides in one way while
// its content (inner) slides the other way, so the colour appears to be wiped across the screen; the old section's colour drifts away
// and the new letters fly up in random order. The page itself never scrolls. After the last section, scrolling on opens the next
// folder (and scrolling up from the first opens the previous one), like on every other page.
// ---- The "know more" tickets ----
// First the slide dissolves into the cream page in square blocks that fill in from the bottom up (like the hero picture on thedesignsociety.fr/evenements
// as you scroll); then a ticket in two pieces (a long side with the story, a short tear-off side) rolls up from below the screen,
// spinning, settles at a tilt, and the short piece is torn off a little way (like the reference ticket). Close it with the cross,
// Escape, or a click outside it: everything plays backwards, the ticket rolls down and the blocks clear to show the slide again.
function setupTickets(stage, sections, LOOP) {
  const entries = [];
  let openIndex = -1;
  let tl = null;

  LOOP.forEach((def, i) => {
    const t = def.ticket;
    if (!t) return;
    const wrap = document.createElement("div");
    wrap.className = "ev-ticket-wrap";
    wrap.hidden = true;
    wrap.innerHTML = `
      <div class="ev-ticket-backdrop"></div>
      <div class="ev-dissolve" aria-hidden="true"></div>
      <div class="ev-ticket" role="dialog" aria-modal="true" aria-label="${esc(def.name)}">
        <button class="ev-ticket-x" type="button" aria-label="Close">\u00D7</button>
        <div class="tk2 tk2-stub">
          <p class="tk2-top"><span>${esc(t.stubKind)}</span><span>${esc(t.stubCode)}</span></p>
          <h3 class="tk2-title">${esc(t.stubTitle)}</h3>
          <button class="tk2-sign" type="button">${esc(t.stubButton)}</button>
        </div>
        <div class="tk2 tk2-main">
          <p class="tk2-top"><span class="tk2-kind">${esc(t.kind)}</span><span>${esc(t.code)}<br>${esc(t.no)}</span></p>
          <p class="tk2-body">${t.body}</p>
          <span class="tk2-rip" aria-hidden="true">Rip here</span>
          <span class="tk2-barcode" aria-hidden="true"><i></i><b>2368 237845 11</b></span>
        </div>
      </div>`;
    stage.append(wrap);
    const ticket = wrap.querySelector(".ev-ticket");
    const stub = wrap.querySelector(".tk2-stub");
    const sign = wrap.querySelector(".tk2-sign");
    const know = sections[i].querySelector(".ev-know");
    const entry = { i, wrap, ticket, stub, know, dissolve: wrap.querySelector(".ev-dissolve") };
    entries[i] = entry;

    know.addEventListener("click", () => open(i));
    wrap.querySelector(".ev-ticket-x").addEventListener("click", () => close());
    wrap.querySelector(".ev-ticket-backdrop").addEventListener("click", () => close());
    // signups are not connected yet (a later step), so for now the button just says so
    sign.addEventListener("click", () => { sign.textContent = "Coming soon"; setTimeout(() => (sign.textContent = t.stubButton), 1800); });
  });

  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const phone = () => window.matchMedia("(max-width: 767px)").matches;

  // a grid of square blocks over the whole slide area (about 110px each, the same cream as the page)
  function buildTiles(e) {
    const box = e.wrap.getBoundingClientRect();
    const size = Math.max(70, Math.min(120, box.width / 9));
    const cols = Math.ceil(box.width / size);
    const rows = Math.ceil(box.height / size);
    e.dissolve.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    e.dissolve.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    e.dissolve.replaceChildren(...Array.from({ length: cols * rows }, () => document.createElement("i")));
    e.cols = cols;
    e.rows = rows;
    return [...e.dissolve.children];
  }

  function open(i) {
    const e = entries[i];
    if (!e || openIndex >= 0) return;
    openIndex = i;
    e.wrap.hidden = false;
    const tilt = phone() ? -4 : -9;
    tl?.kill();
    gsap.set(e.stub, { clearProps: "all" });
    if (calm) {
      buildTiles(e).forEach((t) => (t.style.opacity = 1));
      gsap.set(e.ticket, { autoAlpha: 1, rotation: tilt, yPercent: 0, scale: 1 });
    } else {
      const tiles = buildTiles(e);
      tl = gsap.timeline();
      // the blocks fill in from the bottom of the screen upwards, like a fade-out rising (a little ragged, so it looks like a dissolve)
      const rise = (n) => ((e.rows - 1 - Math.floor(n / e.cols)) / Math.max(1, e.rows - 1)) * 0.6 + Math.random() * 0.2;
      tl.fromTo(tiles, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "none", stagger: rise }, 0)
        // then, on the cream, the ticket rolls up from below the screen, spinning, and settles at a slant
        .fromTo(e.ticket, { autoAlpha: 0, yPercent: 130, rotation: -560 + tilt, scale: 0.45 }, { autoAlpha: 1, yPercent: 0, rotation: tilt, scale: 1, duration: 1.2, ease: "power3.out" }, 0.8)
        // and the short piece is torn off a little way
        .to(e.stub, phone() ? { y: 14, rotation: 3, duration: 0.6, ease: "back.out(2.2)" } : { x: -30, y: 12, rotation: 6, duration: 0.6, ease: "back.out(2.2)" }, 1.75);
    }
    e.wrap.querySelector(".ev-ticket-x").focus({ preventScroll: true });
  }

  function close() {
    if (openIndex < 0) return;
    const e = entries[openIndex];
    const index = openIndex;
    openIndex = -1;
    const done = () => { e.wrap.hidden = true; e.know?.focus({ preventScroll: true }); };
    if (calm || !tl) { done(); return; }
    tl.eventCallback("onReverseComplete", () => { done(); tl = null; });
    tl.timeScale(1.6).reverse(); // it rolls back down the way it came
  }

  // used when the page is left: no animation
  function closeNow() {
    if (openIndex < 0) return;
    const e = entries[openIndex];
    openIndex = -1;
    tl?.kill();
    tl = null;
    e.wrap.hidden = true;
  }

  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") close(); });
  return { isOpen: () => openIndex >= 0, close, closeNow };
}

// ---- The "know more" window: a small + appears beside the button, stretches into a box, the text is typed in, and then it is a tiny
// working notepad (menus, toolbar, fonts, find, save...). The typed listing text is protected: only your own lines below it can be edited. ----
const PAD_ICONS = {
  new: '<path d="M3 1.5h6l3.5 3.5v9.5H3z" fill="#fff" stroke="#463721"/><path d="M9 1.5V5h3.5" fill="none" stroke="#463721"/>',
  open: '<path d="M1.5 4h5l1.5 1.5h6.5v8h-13z" fill="#FFE386" stroke="#463721"/>',
  save: '<rect x="2" y="2" width="12" height="12" fill="#8A4B1E" stroke="#463721"/><rect x="4.5" y="2.5" width="7" height="4.5" fill="#fff"/><rect x="5" y="9.5" width="6" height="4" fill="#F8F8F0"/>',
  print: '<rect x="2" y="6" width="12" height="6" fill="#F8F8F0" stroke="#463721"/><rect x="4.5" y="2" width="7" height="4" fill="#fff" stroke="#463721"/><rect x="4.5" y="10" width="7" height="4" fill="#fff" stroke="#463721"/>',
  find: '<circle cx="6" cy="6" r="3.8" fill="#FFE386" stroke="#463721"/><path d="M9 9l5 5" stroke="#463721" stroke-width="2"/>',
  cut: '<path d="M5 2l6 8M11 2L5 10" stroke="#463721" stroke-width="1.4"/><circle cx="4.5" cy="12" r="2" fill="none" stroke="#C2184F" stroke-width="1.4"/><circle cx="11.5" cy="12" r="2" fill="none" stroke="#C2184F" stroke-width="1.4"/>',
  copy: '<path d="M2.5 2.5h6v8h-6z" fill="#fff" stroke="#463721"/><path d="M7.5 5.5h6v8h-6z" fill="#fff" stroke="#463721"/>',
  paste: '<rect x="2.5" y="3" width="9" height="11" fill="#FFE386" stroke="#463721"/><rect x="5" y="1.5" width="4" height="3" fill="#8A4B1E"/><path d="M8 7h6v7H8z" fill="#fff" stroke="#463721"/>',
  undo: '<path d="M4 6h6a3.5 3.5 0 010 7H6" fill="none" stroke="#463721" stroke-width="1.6"/><path d="M6.5 2.5L3 6l3.5 3.5z" fill="#463721"/>',
};
const PAD_TOOLS = ["new", "open", "save", "print", "|", "find", "|", "cut", "copy", "paste", "|", "undo"];
const PAD_TOOL_NAMES = { new: "New", open: "Open", save: "Save", print: "Print", find: "Find", cut: "Cut", copy: "Copy", paste: "Paste", undo: "Undo" };
const PAD_MENUS = {
  File: [["New", "new", "Ctrl+N"], ["Open…", "open", "Ctrl+O"], ["Save", "save", "Ctrl+S"], ["Print…", "print", "Ctrl+P"], "-", ["Exit", "exit"]],
  Edit: [["Undo", "undo", "Ctrl+Z"], ["Redo", "redo", "Ctrl+Y"], "-", ["Cut", "cut", "Ctrl+X"], ["Copy", "copy", "Ctrl+C"], ["Paste", "paste", "Ctrl+V"], "-", ["Select all", "all", "Ctrl+A"], ["Find…", "find", "Ctrl+F"]],
  View: [["Toolbar", "v-tools"], ["Format bar", "v-fmt"], ["Ruler", "v-ruler"], ["Status bar", "v-status"]],
  Insert: [["Date and time", "date"], ["Bullet", "bullet"], ["Mumbai sign-off", "sign"]],
  Format: [["Bold", "bold", "Ctrl+B"], ["Italic", "italic", "Ctrl+I"], ["Underline", "underline", "Ctrl+U"], "-", ["Justify", "justify"], ["Align left", "left"], ["Centre", "center"], ["Align right", "right"]],
  Help: [["Help topics", "help", "F1"], ["About PBJ Pad", "about"]],
};
const REGIONS = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra (outside Mumbai)", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman & Nicobar Islands", "Chandigarh", "Dadra & Nagar Haveli and Daman & Diu", "Delhi", "Jammu & Kashmir", "Ladakh", "Lakshadweep", "Puducherry", "Outside India"];
const PAD_FONTS = [["Chivo Mono", "var(--mono)"], ["Helvetica Neue", "var(--display)"]];
const PAD_SIZES = [10, 12, 13, 14, 16, 18, 20, 24, 28];
const padSize = () => (matchMedia("(max-width: 767px)").matches ? Math.round(Math.min(15, Math.max(12, innerWidth * 0.037))) : 16); // phones start at the same size as the About page sub text
const PAD_CASES = [["ALL CAPS", "uppercase"], ["Normal", "none"], ["lowercase", "lowercase"]];
// the question under the listing, and what each answer says
const ASK = {
  q: "Is this you?",
  cta: ["Sign up", "Fill the form"],
  yes: ["Good Job! You found yourself.", "You can choose to do both / simply sign up to get notified when we launch.", "(NOTE: FILLING OUT THE FORM HELPS US GET TO KNOW YOU FIRST BEFORE OTHERS IN LINE)"],
  no: ["No worries. Scroll on and see who you are today."],
  maybe: ["Fair enough. Take your time, we are not going anywhere."],
};
const PAD_VIEW = { "v-tools": "tools", "v-fmt": "fmt", "v-ruler": "ruler", "v-status": "status" };

function setupWindows(stage, sections, LOOP) {
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(pointer: fine)").matches;
  let open = null; // the entry that is showing
  const entries = [];
  const tool = (k) => k === "|" ? '<i class="ev-win-sep"></i>' : `<button class="ev-win-ic" type="button" data-do="${k}" title="${PAD_TOOL_NAMES[k]}" aria-label="${PAD_TOOL_NAMES[k]}"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${PAD_ICONS[k]}</svg></button>`;

  LOOP.forEach((def, i) => {
    const btn = sections[i].querySelector(".ev-know");
    if (!def.win || !btn || i === 0 || i === LOOP.length - 1) return; // never on the first or the last slide, only the ones in between
    const A = { ...ASK, ...def.win.ask }; // this slide's own question and replies (anything it leaves out uses the standard ones)
    const wrap = document.createElement("div");
    wrap.className = "ev-ticket-wrap ev-win-wrap";
    wrap.hidden = true;
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("data-lenis-prevent", ""); // the smooth-scroll helper must leave the wheel and swipes inside the window alone
    wrap.setAttribute("aria-label", def.win.title);
    wrap.innerHTML = `<div class="ev-ticket-backdrop"></div>
      <div class="ev-win"><div class="ev-win-in">
        <div class="ev-win-bar"><svg class="ev-win-logo" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 1.5h6l3.5 3.5v9.5H3z" fill="#fff" stroke="#463721"/><path d="M5 8h6M5 10h6M5 12h4" stroke="#C2184F"/></svg><span class="ev-win-ttl">${esc(def.win.title)} - PBJ Pad</span>
          <button class="ev-win-b ev-win-min" type="button" aria-label="Minimise"><u></u></button><button class="ev-win-b ev-win-max" type="button" aria-label="Maximise"><u></u></button>
          <button class="ev-win-b ev-win-x" type="button" aria-label="Close"><u></u></button></div>
        <div class="ev-win-menu">${Object.keys(PAD_MENUS).map((m) => `<button type="button" data-menu="${m}">${m}</button>`).join("")}</div>
        <div class="ev-win-tools">${PAD_TOOLS.map(tool).join("")}</div>
        <div class="ev-win-fmt"><button class="ev-win-sel w1" type="button" data-pick="font"><span></span><b>▾</b></button><button class="ev-win-sel w2" type="button" data-pick="size"><span></span><b>▾</b></button><button class="ev-win-sel w3" type="button" data-pick="case"><span></span><b>▾</b></button><button class="ev-win-fb" type="button" data-do="bold" title="Bold" aria-label="Bold"><b>B</b></button><button class="ev-win-fb" type="button" data-do="italic" title="Italic" aria-label="Italic"><em>I</em></button><button class="ev-win-fb" type="button" data-do="underline" title="Underline" aria-label="Underline"><u>U</u></button></div>
        <div class="ev-win-findbar" hidden><label>Find <input type="text" autocomplete="off" spellcheck="false"></label><button type="button" data-do="findnext">Next</button><button type="button" data-do="findclose" aria-label="Close find">×</button></div>
        <div class="ev-win-ruler" aria-hidden="true"></div>
        <div class="ev-win-card"><div class="ev-win-body"><span class="on"></span><span class="off">${esc(def.win.body)}</span>
          <div class="ev-win-ask" hidden>
            <p class="q"></p>
            <div class="opts" hidden><button type="button" data-ask="yes">Yes</button><button type="button" data-ask="no">No</button><button type="button" data-ask="maybe">Maybe</button></div>
            <p class="r1"></p><p class="r2"></p><p class="r3"></p>
            <div class="cta" hidden><button type="button" data-do="signup">${esc(A.cta[0])}</button><button type="button" data-do="form">${esc(A.cta[1])}</button></div>
          </div>
          <span class="mine" contenteditable="false" spellcheck="false" role="textbox" aria-multiline="true" aria-label="Your own lines"></span></div></div>
        <div class="ev-win-status"><span class="msg">For help, press F1</span><span class="cnt"></span></div>
        <div class="ev-win-pop" hidden></div>
        <div class="ev-win-dlg" hidden><div class="ev-win-dlg-in"><div class="ev-win-dlg-bar"><span></span></div><p></p><button type="button" data-do="dlgok">OK</button></div></div>
        <div class="ev-win-form" hidden></div>
        <i class="ev-win-size" aria-hidden="true"></i>
      </div></div>`;
    stage.appendChild(wrap);
    const $ = (s) => wrap.querySelector(s);
    const win = $(".ev-win"), inner = $(".ev-win-in"), card = $(".ev-win-card");
    const body = $(".ev-win-body"), on = $(".on"), off = $(".off"), mine = $(".mine");
    const pop = $(".ev-win-pop"), dlg = $(".ev-win-dlg"), msg = $(".msg"), cnt = $(".cnt");
    const findBar = $(".ev-win-findbar"), findIn = findBar.querySelector("input");
    const text = def.win.body;
    const ask = $(".ev-win-ask"), askQ = ask.querySelector(".q"), askOpts = ask.querySelector(".opts"), askCta = ask.querySelector(".cta");
    const askR = [".r1", ".r2", ".r3"].map((c) => ask.querySelector(c));
    let askTl = null, askRun = 0;
    const st = { font: 0, size: padSize(), kase: 0, align: "justify" };
    const entry = { wrap, btn, tl: null, shut: null };
    entries.push(entry);

    // ---- small helpers ----
    const say = (m) => { msg.textContent = m; };
    const counted = () => { const n = mine.textContent.length; cnt.textContent = n ? `${n} typed` : ""; };
    const inMine = (node) => !!node && mine.contains(node.nodeType === 3 ? node.parentNode : node);
    const selIn = () => { const s = getSelection(); return s.rangeCount > 0 && inMine(s.anchorNode) && inMine(s.focusNode); };
    const endCaret = () => {
      if (mine.contentEditable !== "true") return false;
      mine.focus({ preventScroll: true });
      const r = document.createRange(); r.selectNodeContents(mine); r.collapse(false);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      return true;
    };
    const ensure = () => selIn() || endCaret();
    const insert = (t) => { if (ensure()) { document.execCommand("insertText", false, t); counted(); } };
    const fullText = () => body.innerText.replace(/​/g, "").trim();
    const wholeBody = () => { const r = document.createRange(); r.selectNodeContents(body); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
    const applyLook = () => {
      body.style.fontFamily = PAD_FONTS[st.font][1];
      body.style.fontSize = st.size + "px";
      body.style.textTransform = PAD_CASES[st.kase][1];
      body.style.textAlign = st.align;
      $('[data-pick="font"] span').textContent = PAD_FONTS[st.font][0];
      $('[data-pick="size"] span').textContent = st.size;
      $('[data-pick="case"] span').textContent = PAD_CASES[st.kase][0];
    };
    const syncMarks = () => {
      ["bold", "italic", "underline"].forEach((c) => {
        let v = false; try { v = selIn() && document.queryCommandState(c); } catch (e) { /* ignore */ }
        $(`.ev-win-fb[data-do="${c}"]`).classList.toggle("is-on", !!v);
      });
    };

    // ---- pop-up lists (menus and the three pick-boxes) ----
    let popFor = null;
    const closePop = () => { pop.hidden = true; popFor = null; wrap.querySelectorAll("[data-menu].is-open,[data-pick].is-open").forEach((b) => b.classList.remove("is-open")); };
    const showPop = (trigger, items) => {
      closePop();
      popFor = trigger; trigger.classList.add("is-open");
      pop.innerHTML = items.map((it) => it === "-" ? '<hr>' : `<button type="button" data-do="${it.do}"${it.val !== undefined ? ` data-val="${it.val}"` : ""}><span class="ck">${it.on ? "✓" : ""}</span><span>${it.label}</span><em>${it.key || ""}</em></button>`).join("");
      const a = inner.getBoundingClientRect(), t = trigger.getBoundingClientRect();
      pop.hidden = false;
      const maxLeft = Math.max(0, a.width - pop.offsetWidth - 4);
      pop.style.left = Math.min(maxLeft, Math.max(0, t.left - a.left)) + "px";
      pop.style.top = t.bottom - a.top + "px";
    };
    const menuItems = (m) => PAD_MENUS[m].map((it) => {
      if (it === "-") return it;
      const o = { label: it[0], do: it[1], key: it[2] || "" };
      if (PAD_VIEW[it[1]]) { o.on = !wrap.classList.contains("hide-" + PAD_VIEW[it[1]]); o.do = "view"; o.val = it[1]; }
      return o;
    });
    const pickItems = (k) => k === "font" ? PAD_FONTS.map((f, n) => ({ label: f[0], do: "set-font", val: n, on: n === st.font }))
      : k === "size" ? PAD_SIZES.map((s) => ({ label: s, do: "set-size", val: s, on: s === st.size }))
      : PAD_CASES.map((c, n) => ({ label: c[0], do: "set-case", val: n, on: n === st.kase }));

    // ---- dialog (help / about) ----
    const dialog = (title, html) => { closePop(); dlg.querySelector("span").textContent = title; dlg.querySelector("p").innerHTML = html; dlg.hidden = false; dlg.querySelector("button").focus({ preventScroll: true }); };
    const closeDlg = () => { if (dlg.hidden) return false; dlg.hidden = true; return true; };

    // ---- the sign-up and the longer form (saved to the database once it is connected, see src/leads.js) ----
    const formEl = $(".ev-win-form");
    let formMaxed = false; // true while the form's own Maximise is what made the window big
    const closeForm = () => { formEl.hidden = true; formEl.innerHTML = ""; formEl.classList.remove("fmin", "fmax"); if (formMaxed) { formMaxed = false; wrap.classList.remove("max"); } };
    const openForm = (kind) => {
      closePop(); closeDlg();
      const signup = kind === "signup";
      const title = signup ? A.cta[0] : A.cta[1];
      const qs = def.win.qs || [];
      const isOther = (o) => /^(something else|another platform|other)$/i.test(o || ""); // these options open a small box to say what
      const fieldHtml = (x, i) => x.type === "pick"
        ? `<fieldset class="pick" data-more="${esc(JSON.stringify(x.more || {}))}"><legend>${esc(x.q)}</legend>${x.opts.map((o) => `<label><input type="radio" name="q${i}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join("")}${x.opts.some(isOther) || x.more ? `<input class="pick-other" name="q${i}o" maxlength="${x.more ? 600 : 150}" placeholder="Tell us what" hidden>` : ""}</fieldset>`
        : x.type === "place"
          ? `<div class="place"><label><span data-q="${esc(x.q)}">${esc(x.q)}</span><input name="q${i}" maxlength="200" placeholder="${esc(x.ph || "")}"></label>
            <label class="notmum"><input type="checkbox" name="q${i}n"><span>Not in Mumbai?</span></label>
            <div class="region" hidden><input name="q${i}s" autocomplete="off" role="combobox" aria-expanded="false" placeholder="Select region / state"><ul class="region-list" role="listbox" hidden></ul></div></div>`
        : x.type === "area"
          ? `<label>${esc(x.q)}<textarea name="q${i}" rows="3" maxlength="600"></textarea></label>`
          : x.type === "link"
            ? `<label><span>${esc(x.q)} <small class="linkhint"><svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6.5 9.5a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-.8.8"/><path d="M9.5 6.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l.8-.8"/></svg>paste a link</small></span><input name="q${i}" type="text" inputmode="url" autocapitalize="off" spellcheck="false" maxlength="300" placeholder="${esc(x.ph || "")}"></label>`
            : `<label>${esc(x.q)}<input name="q${i}" maxlength="200" placeholder="${esc(x.ph || "")}">${x.note ? `<small class="note">${esc(x.note)}</small>` : ""}</label>`;
      formEl.innerHTML = `<div class="ev-win-form-bar"><span>${esc(title)} \u00B7 ${esc(def.win.title)}</span><button type="button" class="ev-win-b ev-win-fmin" aria-label="Minimise form"><u></u></button><button type="button" class="ev-win-b ev-win-fmax" aria-label="Maximise form"><u></u></button><button type="button" class="ev-win-b ev-win-fx" aria-label="Close form"><u></u></button></div>
        <form class="ev-win-form-body" novalidate>
          <p class="hint">${signup ? "Leave your details and we will tell you the moment we launch." : "Tell us a little about you. Only name and email are needed; the rest helps us get to know you before others in line."}</p>
          <label><span>Name <i class="req">*</i></span><input name="name" autocomplete="name" maxlength="120"></label>
          <label><span>Email <i class="req">*</i></span><input name="email" type="email" autocomplete="email" maxlength="200"></label>
          <label><span>Phone / WhatsApp <small class="opt">optional</small></span><input name="phone" type="tel" autocomplete="tel" maxlength="40"></label>
          ${signup ? "" : (qs.length ? qs.map(fieldHtml).join("") : `<label><span>Instagram or website <small>(optional)</small></span><input name="link" maxlength="300"></label>
          <label>Tell us about you<textarea name="message" rows="4" maxlength="2000"></textarea></label>`)}
          <input class="hp" name="company" tabindex="-1" autocomplete="off" aria-hidden="true">
          <p class="err" role="alert"></p>
          <div class="row"><button type="submit" class="go">Send</button><button type="button" class="cancel">Cancel</button></div>
        </form>`;
      formEl.hidden = false;
      const f = formEl.querySelector("form"), err = formEl.querySelector(".err"), go = formEl.querySelector(".go");
      formEl.querySelector(".ev-win-fx").addEventListener("click", closeForm);
      formEl.querySelector(".ev-win-fmin").addEventListener("click", () => formEl.classList.toggle("fmin")); // shrinks to its title bar along the bottom
      formEl.querySelector(".ev-win-fmax").addEventListener("click", () => { // opens the whole window out to full size, and puts it back the way it was
        formEl.classList.remove("fmin");
        const on = formEl.classList.toggle("fmax");
        if (on && !wrap.classList.contains("max")) { $(".ev-win-max").click(); formMaxed = true; }
        else if (!on && formMaxed) { formMaxed = false; $(".ev-win-max").click(); }
      });
      formEl.querySelector(".cancel").addEventListener("click", closeForm);
      f.addEventListener("change", (e) => { // "Not in Mumbai?" opens the region list and asks for the city or town instead
        const n = e.target.closest(".notmum input");
        if (!n) return;
        const g = n.closest(".place"), reg = g.querySelector(".region"), cap = g.querySelector("label span[data-q]");
        reg.hidden = !n.checked;
        cap.textContent = n.checked ? "Which city or town?" : cap.dataset.q;
        if (n.checked) reg.querySelector("input").focus({ preventScroll: true });
      });
      // the region list works like the dashboard's drop-downs: tap to open, type to narrow it down, tap a name to choose it
      const regionBox = (reg) => {
        const input = reg.querySelector("input"), list = reg.querySelector("ul");
        const shut = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); };
        const show = () => {
          const q = input.value.trim().toLowerCase();
          const hits = REGIONS.filter((r) => !q || r.toLowerCase().includes(q));
          list.innerHTML = hits.length ? hits.map((r) => `<li role="option">${esc(r)}</li>`).join("") : `<li class="none">No match</li>`;
          list.hidden = false; input.setAttribute("aria-expanded", "true");
        };
        input.addEventListener("focus", () => { input.select(); show(); });
        input.addEventListener("click", show);
        input.addEventListener("input", show);
        input.addEventListener("keydown", (e) => { if (e.key === "Escape" && !list.hidden) { shut(); e.stopPropagation(); } });
        list.addEventListener("mousedown", (e) => e.preventDefault()); // keep the box focused while choosing
        list.addEventListener("click", (e) => { const li = e.target.closest("li:not(.none)"); if (li) { input.value = li.textContent; shut(); } });
        input.addEventListener("blur", () => { shut(); if (!REGIONS.includes(input.value)) input.value = ""; }); // only a name from the list is kept
      };
      f.querySelectorAll(".region").forEach(regionBox);
      f.addEventListener("change", (e) => { // picking "Something else" opens its little box; picking anything else tucks it away
        const g = e.target.closest("fieldset.pick"), box = g && g.querySelector(".pick-other");
        if (!box) return;
        const more = JSON.parse(g.dataset.more || "{}")[e.target.value]; // some options (like "Yes") open the box with their own prompt
        box.hidden = !(more || isOther(e.target.value));
        box.placeholder = more || (/platform/i.test(e.target.value) ? "Tell us which" : "Tell us what");
        if (!box.hidden) box.focus({ preventScroll: true });
      });
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(f));
        if (d.company) { closeForm(); return; } // a hidden field only robots fill in
        const name = (d.name || "").trim(), email = (d.email || "").trim();
        if (!name) { err.textContent = "Please add your name."; f.elements.name.focus(); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err.textContent = "Please add a valid email."; f.elements.email.focus(); return; }
        err.textContent = ""; go.disabled = true; go.textContent = "Sending\u2026";
        const answers = {};
        let link = (d.link || "").trim() || null;
        qs.forEach((x, i) => { let v = (d["q" + i] || "").trim(); if (x.type === "place" && d["q" + i + "n"]) { const r = d["q" + i + "s"] || "region not chosen"; v = "Not in Mumbai (" + r + ")" + (v ? ": " + v : ""); } if (!v) return; if (x.type === "pick" && (isOther(v) || (x.more && x.more[v]))) { const more = (d["q" + i + "o"] || "").trim(); if (more) v += ": " + more; } answers[x.q] = v; if (x.type === "link" && !link) link = v; });
        const r = await saveLead({ kind, role: def.win.title, name, email, phone: (d.phone || "").trim() || null, link, message: (d.message || "").trim() || null, answers: Object.keys(answers).length ? answers : null, page: location.pathname });
        if (r.ok) {
          f.innerHTML = `<p class="thanks">Thank you, ${esc(name.split(" ")[0])}! You are on the list.</p><div class="row"><button type="button" class="go">Done</button></div>`;
          f.querySelector(".go").addEventListener("click", closeForm);
          say("Saved. Thank you!");
        } else {
          go.disabled = false; go.textContent = "Send";
          err.textContent = r.reason === "not-connected" ? "Saving is not connected yet, so nothing was saved." : "Could not send. Please try again.";
        }
      });
      if (matchMedia("(pointer: fine)").matches && !navigator.maxTouchPoints) f.elements.name.focus({ preventScroll: true }); // on a phone, do not pop the keyboard up before they have even seen the form
    };

    // ---- the actions ----
    const clipSel = () => (selIn() ? getSelection().toString() : "") || fullText();
    const download = () => {
      const url = URL.createObjectURL(new Blob([fullText() + "\n"], { type: "text/plain" }));
      const a = document.createElement("a"); a.href = url; a.download = "pbj-notes.txt"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000); say("Saved as pbj-notes.txt");
    };
    const printIt = () => {
      const f = document.createElement("iframe"); f.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0";
      document.body.appendChild(f);
      const d = f.contentDocument; d.open(); d.write(`<pre style="white-space:pre-wrap;font:16px/1.5 monospace">${esc(fullText())}</pre>`); d.close();
      f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 3000); say("Sent to the printer");
    };
    const openFile = () => {
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".txt,text/plain";
      inp.onchange = () => { const f = inp.files[0]; if (!f) return; f.text().then((t) => { insert(t.slice(0, 5000)); say("Opened " + f.name); }); };
      inp.click();
    };
    const doFind = (again) => {
      const q = findIn.value; if (!q) return;
      const ok = window.find(q, false, false, true, false, false, false);
      say(ok ? "Found “" + q + "”" : "Not found");
    };
    const openFind = () => { closePop(); findBar.hidden = false; findIn.focus({ preventScroll: true }); findIn.select(); };
    const act = (a, val) => {
      if (a !== "view") closePop();
      switch (a) {
        case "new": if (mine.contentEditable === "true") { mine.innerHTML = ""; counted(); endCaret(); say("New page: your own lines were cleared"); } break;
        case "open": openFile(); break;
        case "save": download(); break;
        case "print": printIt(); break;
        case "exit": entry.shut?.(); break;
        case "undo": case "redo": if (ensure()) { document.execCommand(a); counted(); } break;
        case "cut": if (selIn() && !getSelection().isCollapsed) { document.execCommand("cut"); counted(); say("Cut"); } else say("Only your own lines can be cut"); break;
        case "copy": navigator.clipboard?.writeText(clipSel()).then(() => say("Copied"), () => say("Press Ctrl+C to copy")); break;
        case "paste": if (navigator.clipboard?.readText) navigator.clipboard.readText().then((t) => { insert(t.slice(0, 5000)); say("Pasted"); }, () => say("Press Ctrl+V to paste")); else say("Press Ctrl+V to paste"); break;
        case "all": wholeBody(); say("Everything selected"); break;
        case "find": openFind(); break;
        case "findnext": doFind(); break;
        case "findclose": findBar.hidden = true; break;
        case "view": { const k = PAD_VIEW[val]; wrap.classList.toggle("hide-" + k); showPop(popFor || $('[data-menu="View"]'), menuItems("View")); break; }
        case "date": insert(new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })); break;
        case "bullet": insert("• "); break;
        case "sign": insert("— sent from Mumbai, via PeanutButterJelly.vip"); break;
        case "bold": case "italic": case "underline": if (ensure()) { document.execCommand(a); syncMarks(); } break;
        case "justify": case "left": case "center": case "right": st.align = a === "center" ? "center" : a; applyLook(); break;
        case "set-font": st.font = +val; applyLook(); break;
        case "set-size": st.size = +val; applyLook(); break;
        case "set-case": st.kase = +val; applyLook(); break;
        case "help": dialog("Help topics", "Type your own lines under the listing. The listing text itself stays put: it can’t be deleted or changed.<br><br>Keys: Ctrl+B bold, Ctrl+I italic, Ctrl+U underline, Ctrl+Z undo, Ctrl+S save, Ctrl+F find, Esc closes."); break;
        case "about": dialog("About PBJ Pad", "PBJ Pad is a tiny notepad on PeanutButterJelly.vip.<br>Mining hidden gems around you, from Mumbai."); break;
        case "dlgok": closeDlg(); break;
        case "signup": openForm("signup"); break;
        case "form": openForm("form"); break;
        default: break;
      }
    };

    // clicks: keep the text selection alive while pressing the toolbar (mousedown is cancelled), then run the action
    inner.addEventListener("mousedown", (e) => { if (e.target.closest("button") && !e.target.closest(".ev-win-b")) e.preventDefault(); });
    inner.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.menu) { b.classList.contains("is-open") ? closePop() : showPop(b, menuItems(b.dataset.menu)); return; }
      if (b.dataset.pick) { b.classList.contains("is-open") ? closePop() : showPop(b, pickItems(b.dataset.pick)); return; }
      if (b.dataset.ask) { answer(b.dataset.ask); return; }
      if (b.dataset.do) act(b.dataset.do, b.dataset.val);
    });
    wrap.querySelectorAll("[data-menu]").forEach((b) => b.addEventListener("pointerenter", () => { if (popFor && popFor.dataset.menu && popFor !== b) showPop(b, menuItems(b.dataset.menu)); }));
    wrap.addEventListener("pointerdown", (e) => { if (!pop.hidden && !e.target.closest(".ev-win-pop,[data-menu],[data-pick]")) closePop(); });
    findIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doFind(); } });

    // ---- the protected text: only the lines in `mine` can change ----
    mine.addEventListener("beforeinput", (e) => {
      if (/^delete.*Backward$/.test(e.inputType)) {
        const s = getSelection();
        if (s.isCollapsed) { const r = document.createRange(); r.selectNodeContents(mine); r.setEnd(s.anchorNode, s.anchorOffset); if (!r.toString()) e.preventDefault(); }
      }
    });
    mine.addEventListener("input", () => { counted(); syncMarks(); });
    mine.addEventListener("paste", (e) => { e.preventDefault(); insert((e.clipboardData?.getData("text/plain") || "").slice(0, 5000)); });
    document.addEventListener("selectionchange", () => { if (!wrap.hidden) syncMarks(); });
    card.addEventListener("click", (e) => {
      if (entry.tl && entry.tl.progress() < 1 && open === entry) { entry.tl.progress(1, false); return; } // a click finishes the typing
      if (e.target.closest("button")) return; // tapping a button (Yes, No, Fill the form...) must never drop the cursor into the text, or a phone's keyboard pops up
      if (matchMedia("(pointer: coarse)").matches && !e.target.closest(".mine")) return; // on a touch screen the cursor goes in only when they tap their own line
      if (e.target.closest(".ev-win-body") && !getSelection().toString()) endCaret();
      else if (e.target === card) endCaret();
    });
    // the page behind (its swipe-to-change-slide) must never grab a scroll or swipe that starts inside the window
    ["touchstart", "touchmove", "wheel"].forEach((t) => wrap.addEventListener(t, (e) => e.stopPropagation(), { passive: true }));
    wrap.addEventListener("keydown", (e) => {
      const k = e.key, mod = e.ctrlKey || e.metaKey;
      if (k === "Escape") { if (!formEl.hidden) { closeForm(); e.stopPropagation(); } else if (!pop.hidden) { closePop(); e.stopPropagation(); } else if (closeDlg()) e.stopPropagation(); else if (!findBar.hidden) { findBar.hidden = true; e.stopPropagation(); } return; }
      e.stopPropagation(); // the page behind must not react to typing
      if (e.target.closest?.(".ev-win-form")) return; // typing in the form is just typing
      if (k === "F1") { e.preventDefault(); act("help"); return; }
      if (mod) {
        const c = k.toLowerCase();
        const map = { s: "save", p: "print", f: "find", n: "new", o: "open", a: "all" };
        if (map[c]) { e.preventDefault(); act(map[c]); }
        return;
      }
      if (e.target === findIn) return;
      if (e.target.closest?.(".ev-win-ask,.ev-win-dlg,.ev-win-pop,.ev-win-menu,.ev-win-tools,.ev-win-fmt,.ev-win-bar,.ev-win-findbar")) return;
      // typing while the cursor is not in the user's lines: send it there; deleting outside them does nothing
      if (!selIn() && (k.length === 1 || k === "Enter" || k === "Backspace" || k === "Delete")) {
        e.preventDefault();
        if (k.length === 1) insert(k); else if (k === "Enter") insert("\n");
      }
    });

    // ---- the question: it writes itself, then three answers; "yes" brings a message, a second line, a note and two buttons ----
    const scrollDown = () => { card.scrollTop = card.scrollHeight; };
    const typeInto = (tl, el, str, at) => {
      const o = { v: 0 };
      tl.add(() => { el.classList.add("is-typing"); el.textContent = ""; }, at);
      if (calm) { tl.add(() => { el.textContent = str; el.classList.remove("is-typing"); scrollDown(); }); return; }
      tl.to(o, { v: str.length, duration: Math.max(0.3, str.length * 0.028), ease: "none", onUpdate: () => { el.textContent = str.slice(0, Math.round(o.v)); scrollDown(); } })
        .add(() => el.classList.remove("is-typing"));
    };
    // the question is drawn in the same paper-cut lettering as the slide headings (wobbling edges and all), and comes in the same way:
    // it rises up out of a mask (like the "Text Masking" reveal on the slides)
    let qLetters = [];
    const typeCut = (tl, el, str) => {
      qLetters.forEach((l) => l.dispose?.()); qLetters = [];
      el.textContent = ""; el.setAttribute("aria-label", str);
      const look = def.win.look || {};
      const mask = document.createElement("span"), line = document.createElement("span");
      mask.className = "ev-mask"; line.className = "ev-reveal-line"; mask.append(line);
      str.split(" ").forEach((word, wi, all) => {
        const w = document.createElement("span");
        w.className = "w"; w.setAttribute("aria-hidden", "true");
        [...word].forEach((ch) => {
          const L = createCutLetter(ch, { fill: look.fill || "var(--brown)", shadow: look.shadow || "var(--crust)", shadowK: 1.4 });
          if (L) { qLetters.push(L); w.append(L.el); } else w.append(document.createTextNode(ch));
        });
        line.append(w);
        if (wi < all.length - 1) line.append(" ");
      });
      el.append(mask);
      if (calm) return;
      tl.fromTo(line, { yPercent: 130, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: "expo.out" });
    };
    const showEl = (tl, el, at) => tl.add(() => { el.hidden = false; if (!calm) gsap.fromTo(el, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }); scrollDown(); }, at);
    const resetAsk = () => {
      askTl?.kill(); askTl = null; askRun++;
      ask.hidden = true; askOpts.hidden = true; askCta.hidden = true;
      qLetters.forEach((l) => l.dispose?.()); qLetters = [];
      askQ.textContent = ""; askR.forEach((r) => { r.textContent = ""; });
      askOpts.querySelectorAll("button").forEach((b) => b.classList.remove("is-chosen"));
    };
    const startAsk = () => {
      resetAsk();
      ask.hidden = false;
      askTl = gsap.timeline({ delay: 0.5 });
      typeCut(askTl, askQ, A.q);
      showEl(askTl, askOpts, "+=0.15");
    };
    const answer = (k) => {
      askTl?.kill(); askRun++;
      askR.forEach((r) => { r.textContent = ""; r.classList.remove("is-typing"); });
      askCta.hidden = true;
      askOpts.querySelectorAll("button").forEach((b) => b.classList.toggle("is-chosen", b.dataset.ask === k));
      const lines = A[k];
      askTl = gsap.timeline({ delay: 0.15 });
      lines.forEach((ln, n) => typeInto(askTl, askR[n], ln, n ? "+=0.35" : undefined));
      if (k === "yes") showEl(askTl, askCta, "+=0.3");
    };

    // ---- open / close ----
    const reset = () => {
      win.style.width = win.style.height = win.style.translate = ""; win.classList.remove("sized"); pos.x = pos.y = 0;
      resetAsk(); mine.innerHTML = ""; mine.contentEditable = "false"; counted(); say("For help, press F1");
      Object.assign(st, { font: 0, size: padSize(), kase: 0, align: "justify" }); applyLook();
      wrap.classList.remove("min", "max", "hide-status"); wrap.classList.add("hide-tools", "hide-fmt", "hide-ruler"); findBar.hidden = true; findIn.value = ""; closePop(); dlg.hidden = true; closeForm(); // (the toolbar, font bar and ruler start tucked away; the View menu brings them back)
    };
    const pos = { x: 0, y: 0 };
    const grab = (el, move) => el.addEventListener("pointerdown", (e) => {
      if (e.button || e.target.closest(".ev-win-b") || wrap.classList.contains("max")) return;
      e.preventDefault();
      const x0 = e.clientX, y0 = e.clientY, r = win.getBoundingClientRect(), p0 = { ...pos };
      el.setPointerCapture(e.pointerId);
      const mv = (ev) => move(ev.clientX - x0, ev.clientY - y0, r, p0);
      const up = () => { el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); };
      el.addEventListener("pointermove", mv); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    });
    grab($(".ev-win-bar"), (dx, dy, r, p0) => {
      const f = wrap.getBoundingClientRect();
      const cx = Math.min(f.right - 60 - r.left, Math.max(f.left + 60 - r.right, dx));
      const cy = Math.min(f.bottom - 32 - r.top, Math.max(f.top - r.top, dy));
      pos.x = p0.x + cx; pos.y = p0.y + cy;
      win.style.translate = `${pos.x}px ${pos.y}px`;
    });
    grab($(".ev-win-size"), (dx, dy, r) => {
      const f = wrap.getBoundingClientRect();
      win.style.width = Math.min(f.right - r.left, Math.max(240, r.width + dx)) + "px";
      win.style.height = Math.min(f.bottom - r.top, Math.max(130, r.height + dy)) + "px";
      win.classList.add("sized");
      wrap.classList.remove("min");
    });

    // when the typing is done the words slide apart, slowly, from left-aligned into justified (each line's gaps open up together)
    const finish = () => {
      wrap.classList.remove("typing");
      const done = () => {
        on.innerHTML = esc(text).replace(/\n/g, "<br>"); off.textContent = "";
        body.style.textAlign = st.align;
        if (open === entry && ask.hidden) startAsk();
      };
      mine.contentEditable = "true"; counted();
      if (fine && open === entry) endCaret();
      const chars = [...on.children];
      if (calm || st.align !== "justify" || !chars.length || wrap.hidden) { done(); return; }
      const limit = body.getBoundingClientRect().right;
      const lines = []; let cur = null, top = null;
      chars.forEach((c) => {
        if (c.tagName === "BR") { if (cur) cur.hard = true; cur = null; return; } // the end of a paragraph: that line is not stretched
        if (c.textContent === " ") { cur?.items.push(c); return; }
        const r = c.getBoundingClientRect(), t = Math.round(r.top);
        if (!cur || Math.abs(t - top) > 4) { cur = { items: [], right: 0 }; lines.push(cur); top = t; }
        cur.items.push(c); cur.right = r.right; cur.last = cur.items.length - 1;
      });
      const moves = lines.slice(0, -1).filter((l) => !l.hard).map((l) => {
        const spaces = l.items.slice(0, l.last).filter((c) => c.textContent === " ");
        return { spaces, extra: spaces.length ? Math.max(0, limit - l.right - 0.5) / spaces.length : 0 };
      }).filter((m) => m.extra > 0);
      const o = { p: 0 };
      entry.just = gsap.to(o, { p: 1, duration: 1.8, ease: "power2.inOut", onUpdate: () => moves.forEach((m) => { const v = m.extra * o.p + "px"; m.spaces.forEach((c) => { c.style.paddingRight = v; }); }), onComplete: done });
    };
    const placeTop = () => {
      // the free space starts right under the lowest of the three options (role / city / menu) and ends at the bottom of the page
      const tops = [...document.querySelectorAll(".topbar .tb-item")].map((e) => e.getBoundingClientRect()).filter((r) => r.height && r.bottom < innerHeight * 0.5);
      wrap.style.top = tops.length ? Math.ceil(Math.max(...tops.map((r) => r.bottom))) + "px" : "";
    };
    window.addEventListener("resize", () => { if (!wrap.hidden) placeTop(); });
    const play = () => {
      entry.tl?.kill(); entry.just?.kill(); entry.closing?.kill(); // (a window that is still folding away must not hide the new one)
      reset();
      // stay clear of the three options (role / city / menu) at the top of the page
      placeTop();
      wrap.hidden = false;
      wrap.classList.add("typing");
      body.style.textAlign = "left"; // left-aligned while it types; it spaces out into the chosen alignment once it is all in
      // every letter is already in its final place (invisible); typing just switches them on, so the lines never re-flow or jump
      on.textContent = ""; off.textContent = "";
      const chars = [...text].map((ch) => { const c = document.createElement(ch === "\n" ? "br" : "span"); if (ch !== "\n") c.textContent = ch; c.style.opacity = "0"; on.append(c); return c; });
      let shown = 0, cur = null; // the cursor is just a bar painted beside the last letter (a real element in the text let words hop to the next line)
      const reveal = (k) => {
        for (; shown < k; shown++) chars[shown].style.opacity = "1";
        for (; shown > k; ) chars[--shown].style.opacity = "0";
        cur?.classList.remove("cur"); cur = k > 0 ? chars[k - 1] : null; cur?.classList.add("cur");
      };
      reveal(0);
      const w = win.getBoundingClientRect(), b = btn.getBoundingClientRect();
      const cx = b.right + 12, cy = b.top + b.height / 2; // the window opens out from just right of the button
      const px = Math.min(96, Math.max(4, ((cx - w.left) / w.width) * 100));
      const py = Math.min(96, Math.max(4, ((cy - w.top) / w.height) * 100));
      const ex = (2 / w.width) * 100, ey = (2 / w.height) * 100;
      const clip = (t, r, bo, l) => `inset(${t}% ${r}% ${bo}% ${l}%)`;
      const dot = clip(py - ey, 100 - px - ex, 100 - py - ey, px - ex);
      entry.dot = dot;
            gsap.set(win, { clipPath: dot });
      const n = { v: 0 };
      const tl = gsap.timeline({ onReverseComplete: () => { if (entry.tl === tl) wrap.hidden = true; } });
      if (calm) {
        tl.set(win, { clipPath: clip(0, 0, 0, 0) }).add(finish);
      } else {
        tl.to(win, { clipPath: clip(0, 0, 0, 0), duration: 0.6, ease: "power3.out" })
          .to(n, { v: text.length, duration: text.length * 0.014, ease: "none", onUpdate: () => {
            reveal(Math.round(n.v));
          } }, "+=0.05")
          .add(finish);
      }
      entry.tl = tl;
      open = entry;
      btn.setAttribute("aria-expanded", "true");
      $(".ev-win-x").focus({ preventScroll: true });
    };
    btn.addEventListener("click", () => { if (!open) play(); });
    const shut = () => {
      if (open !== entry) return;
      open = null;
      closePop(); dlg.hidden = true; closeForm(); mine.contentEditable = "false";
      btn.setAttribute("aria-expanded", "false");
      // close at once: stop the typing and everything else, then fold the box back into the button in a quick snap (no un-typing)
      entry.tl.kill(); entry.just?.kill(); askTl?.kill(); askRun++;
      if (calm) wrap.hidden = true;
      else entry.closing = gsap.to(win, { clipPath: entry.dot, duration: 0.22, ease: "power2.in", onComplete: () => { wrap.hidden = true; } });
      btn.focus({ preventScroll: true });
    };
    entry.shut = shut;
    $(".ev-win-x").addEventListener("click", shut);
    $(".ev-ticket-backdrop").addEventListener("click", shut);
    $(".ev-win-min").addEventListener("click", () => { closePop(); wrap.classList.remove("max"); wrap.classList.toggle("min"); });
    $(".ev-win-max").addEventListener("click", () => { wrap.classList.remove("min"); wrap.classList.toggle("max"); if (wrap.classList.contains("max")) { win.style.width = win.style.height = win.style.translate = ""; win.classList.remove("sized"); pos.x = pos.y = 0; } });
    applyLook();
  });
  const closeNow = () => {
    if (!open) return;
    open.tl.kill(); open.wrap.hidden = true; open = null;
  };
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") open?.shut?.(); });
  return { isOpen: () => !!open, closeNow };
}

function setupObserverLoop(root, LOOP, layered = false) {
  const stage = document.createElement("div");
  stage.className = "ev-loop obs" + (layered ? " layered" : "");
  stage.innerHTML = LOOP.map((s, n) => `<section class="ev-loop-slide" aria-label="${esc(s.name)}">
      <div class="ev-outer"><div class="ev-inner"><div class="ev-bg" style="--bg:${s.bg};--fill:${s.fill};--shade:${s.shadow}">
        <h2 class="ev-loop-title${s.stack ? " stack" : ""}" data-text="${esc(s.name)}"></h2>
        ${s.button ? `<p><a class="btn" href="${esc(s.button.href)}">${esc(s.button.label)}</a></p>` : ""}
        ${s.ticket ? `<p><button class="ev-know" type="button" aria-haspopup="dialog">${esc(s.ticket.know)}</button></p>` : ""}
        ${s.win && n > 0 && n < LOOP.length - 1 ? `<p><button class="ev-know" type="button" aria-haspopup="dialog"${s.win.color ? ` style="color:${s.win.color}"` : ""}>${esc(s.win.know)}</button></p>` : ""}
      </div></div></div>
    </section>`).join("");
  root.prepend(stage);

  const sections = [...stage.querySelectorAll(".ev-loop-slide")];
  const tickets = setupWindows(stage, sections, LOOP); // the "know more" windows (see setupWindows)
  const outers = sections.map((s) => s.querySelector(".ev-outer"));
  const inners = sections.map((s) => s.querySelector(".ev-inner"));
  const bgs = sections.map((s) => s.querySelector(".ev-bg"));
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const seen = new Set(); // letters of sections that are out of sight stop wobbling
  const typers = [];
  const letters = sections.map((section, i) => {
    const title = section.querySelector(".ev-loop-title");
    buildTitle(title, LOOP[i], () => !seen.has(section));
    typers[i] = LOOP[i].type ? setupTypewriter(section, title, false) : null;
    return [...title.querySelectorAll(".w > *")];
  });

  const resetAll = () => {
    if (layered) { gsap.set([...outers, ...inners], { yPercent: 0 }); gsap.set(sections, { autoAlpha: 0, yPercent: 0, zIndex: 0 }); }
    else { gsap.set(outers, { yPercent: 100 }); gsap.set(inners, { yPercent: -100 }); gsap.set(sections, { autoAlpha: 0 }); }
  };
  resetAll();

  let current = -1;
  let animating = false;
  const last = sections.length - 1;

  // GSAP's "Animate Text" demo (demos.gsap.com/demo/animate-text, a SplitText demo): the text arrives piece by piece. Our titles are
  // already split into words (.w) and letters, so no SplitText is needed. "chars": letters slide in from the right; "words": words
  // drop in from above at random angles, with a little overshoot. (A section opts in with textFx in LIST_LOOP.)
  const fxTween = [];
  const unmask = (title) => title.querySelectorAll(".ev-mask").forEach((mask) => { mask.before(...mask.firstChild.childNodes); mask.remove(); });
  const btnTween = [];
  const textFxOut = (i) => {
    btnTween[i]?.revert();
    btnTween[i] = null;
    fxTween[i]?.revert();
    fxTween[i] = null;
    const title = sections[i].querySelector(".ev-loop-title");
    title.style.perspective = "";
    unmask(title); // lines go back to flowing naturally
  };
  const textFxIn = (i, delay = 0) => {
    const kind = LOOP[i].textFx;
    textFxOut(i);
    if (!kind || calm) return;
    const know = sections[i].querySelector(".ev-know");
    if (know) btnTween[i] = gsap.fromTo(know, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, ease: "expo.out", delay: delay + 0.55 }); // the button follows the last line
    const words = [...sections[i].querySelectorAll(".ev-loop-title .w")];
    if (kind === "mask") {
      // GSAP's "Text Masking" demo (demos.gsap.com/demo/text-masking): every line sits in a mask (a clipping box) and rises up out of it, from
      // below its bottom edge, one line after another. The lines are found by where the words sit now (so it follows the screen size);
      // the masks reach a little past each line (clip-path) so the lettering's shadow and wobble are not clipped.
      const title = sections[i].querySelector(".ev-loop-title");
      unmask(title);
      const found = [];
      words.forEach((w) => {
        const top = Math.round(w.offsetTop);
        const last = found[found.length - 1];
        if (last && last.top === top) last.words.push(w);
        else found.push({ top, words: [w] });
      });
      const lines = found.map(({ words: ws }) => {
        const mask = document.createElement("span");
        const line = document.createElement("span");
        mask.className = "ev-mask";
        line.className = "ev-reveal-line";
        mask.append(line);
        ws[0].before(mask);
        for (let n = ws[0]; n; ) { // the line's words, and the spaces between them
          const next = n.nextSibling;
          line.append(n);
          if (n === ws[ws.length - 1]) break;
          n = next;
        }
        return line;
      });
      // (fromTo, so the hidden starting state is set up at once, even while there is a delay)
      fxTween[i] = gsap.fromTo(lines, { yPercent: 130, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: "expo.out", stagger: 0.1, delay });
      return;
    }
    if (kind === "lines") {
      // each line tips up out of the page in 3D, one line after the other (a "line" is whatever words sit at the same height)
      const title = sections[i].querySelector(".ev-loop-title");
      title.style.perspective = "500px";
      const tops = [...new Set(words.map((w) => Math.round(w.offsetTop)))].sort((a, b) => a - b);
      const lineOf = words.map((w) => tops.indexOf(Math.round(w.offsetTop)));
      fxTween[i] = gsap.from(words, { rotationX: -100, transformOrigin: "50% 50% -160px", opacity: 0, duration: 0.8, ease: "power3", immediateRender: true, delay: (n) => delay + lineOf[n] * 0.25 });
      return;
    }
    fxTween[i] = kind === "chars"
      ? gsap.from(letters[i], { x: 150, opacity: 0, duration: 0.7, ease: "power4", stagger: 0.04, delay, immediateRender: true })
      : gsap.from(words, { y: -100, opacity: 0, rotation: "random(-80, 80)", transformOrigin: "0% 60%", duration: 0.7, ease: "back", stagger: 0.15, delay, immediateRender: true });
  };

  // Layered (phones): the new section slides up over the old one; going back, the top section slides away to uncover the one under it
  function gotoLayered(index, direction) {
    animating = true;
    const dur = calm ? 0.01 : 0.9;
    const old = current;
    const forward = direction !== -1;
    typers[old]?.reset();
    seen.add(sections[index]);
    const done = () => { animating = false; typers[index]?.play(); };
    if (old >= 0) textFxOut(old);
    if (old < 0) { gsap.set(sections[index], { autoAlpha: 1, yPercent: 0, zIndex: 1 }); textFxIn(index, 0.15); done(); current = index; return; }
    if (forward) {
      textFxIn(index, dur * 0.5); // the words start dropping in as the section is half way up
      gsap.set(sections[old], { zIndex: 1 });
      gsap.set(sections[index], { autoAlpha: 1, yPercent: 100, zIndex: 2 });
      gsap.to(sections[index], { yPercent: 0, duration: dur, ease: "power2.inOut", onComplete: () => { gsap.set(sections[old], { autoAlpha: 0 }); seen.delete(sections[old]); done(); } });
    } else {
      gsap.set(sections[index], { autoAlpha: 1, yPercent: 0, zIndex: 1 });
      gsap.set(sections[old], { zIndex: 2 });
      gsap.to(sections[old], { yPercent: 100, duration: dur, ease: "power2.inOut", onComplete: () => { gsap.set(sections[old], { autoAlpha: 0, yPercent: 0 }); seen.delete(sections[old]); done(); } });
    }
    current = index;
  }

  function gotoSection(index, direction) {
    if (layered) return gotoLayered(index, direction);
    animating = true;
    const d = direction === -1 ? -1 : 1;
    const dur = calm ? 0.01 : 1.25;
    const tl = gsap.timeline({ defaults: { duration: dur, ease: "power1.inOut" }, onComplete: () => { animating = false; typers[index]?.play(); } });
    if (current >= 0) {
      const old = current;
      typers[old]?.reset();
      gsap.set(sections[old], { zIndex: 0 });
      tl.to(bgs[old], { yPercent: -15 * d }).set(sections[old], { autoAlpha: 0 }).add(() => seen.delete(sections[old]));
    }
    gsap.set(sections[index], { autoAlpha: 1, zIndex: 1 });
    seen.add(sections[index]);
    tl.fromTo([outers[index], inners[index]], { yPercent: (i) => (i ? -100 * d : 100 * d) }, { yPercent: 0 }, 0)
      .fromTo(bgs[index], { yPercent: 15 * d }, { yPercent: 0 }, 0);
    if (!typers[index]) {
      tl.fromTo(letters[index], { autoAlpha: 0, yPercent: 150 * d }, { autoAlpha: 1, yPercent: 0, duration: calm ? 0.01 : 1, ease: "power2", stagger: { each: 0.02, from: "random" } }, 0.2);
    }
    current = index;
  }

  // While the sections are using the scroll, the folder-changing scroll (tabs.js) stays out of it; at the very first or last
  // section, scrolling further in that direction is left to it, so it opens the neighbouring folder
  const root$ = document.documentElement;
  const setLock = (dir) => {
    const atEnd = (dir > 0 && current === last) || (dir < 0 && current === 0);
    root$.toggleAttribute("data-loop-lock", !atEnd);
  };
  let touchY = null;
  // One gesture moves one section. A trackpad keeps sending ever-smaller scrolls for a second or more after the fingers lift (the
  // "coasting"), which would otherwise be read as another gesture and move a second section. A new gesture is recognised by a pause
  // in the scrolling, or by the scrolling suddenly getting stronger again (a fresh flick on top of the coasting), so a deliberate
  // second scroll is never ignored.
  let used = false;
  let lastAt = 0;
  let lastAbs = 0;
  const onWheel = (e) => {
    setLock(Math.sign(e.deltaY));
    const now = performance.now();
    const abs = Math.abs(e.deltaY);
    if (now - lastAt > 110 || (abs > 30 && abs > lastAbs * 1.5)) used = false;
    lastAt = now;
    lastAbs = abs;
  };
  const onTouchStart = (e) => { used = false; touchY = e.touches[0]?.clientY ?? null; };
  const onTouchMove = (e) => {
    if (touchY === null || !e.touches[0]) return;
    setLock(Math.sign(touchY - e.touches[0].clientY)); // a finger moving up means "next"
  };

  let observer = null;
  const start = () => {
    if (observer) return;
    current = -1;
    seen.clear();
    resetAll();
    root$.setAttribute("data-loop-lock", "");
    window.addEventListener("wheel", onWheel, { capture: true, passive: true });
    window.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    window.addEventListener("touchmove", onTouchMove, { capture: true, passive: true });
    observer = Observer.create({
      type: "wheel,touch,pointer",
      wheelSpeed: -1,
      tolerance: 10,
      preventDefault: true,
      ignore: ".ev-ticket-wrap", // a ticket that is open keeps its own gestures (and can scroll on small screens)
      onDown: () => { if (animating || used || current <= 0 || tickets.isOpen()) return; used = true; gotoSection(current - 1, -1); },
      onUp: () => { if (animating || used || current >= last || tickets.isOpen()) return; used = true; gotoSection(current + 1, 1); },
    });
    gotoSection(0, 1);
  };
  const stop = () => {
    if (!observer) return;
    observer.kill();
    observer = null;
    window.removeEventListener("wheel", onWheel, { capture: true });
    window.removeEventListener("touchstart", onTouchStart, { capture: true });
    window.removeEventListener("touchmove", onTouchMove, { capture: true });
    root$.removeAttribute("data-loop-lock");
    gsap.killTweensOf([...outers, ...inners, ...bgs, ...sections, ...letters.flat()]);
    typers.forEach((t) => t?.reset());
    tickets.closeNow();
    sections.forEach((_, i) => textFxOut(i));
    animating = false;
  };
  new MutationObserver(() => (root.hidden ? stop() : start())).observe(root, { attributes: true, attributeFilter: ["hidden"] });
  if (!root.hidden) start();
}

function setupPinnedLoop(root, lenis, LOOP) {


  const stage = document.createElement("div");
  stage.className = "ev-loop";
  const slideHTML = (s) => `<section class="ev-loop-slide" style="--bg:${s.bg}" aria-label="${esc(s.name)}">
      <h2 class="ev-loop-title${s.stack ? " stack" : ""}" data-text="${esc(s.name)}"></h2>
      ${s.button ? `<p><a class="btn" href="${esc(s.button.href)}">${esc(s.button.label)}</a></p>` : ""}
    </section>`;
  stage.innerHTML = LOOP.map(slideHTML).join("");
  root.prepend(stage);

  const slides = [...stage.querySelectorAll(".ev-loop-slide")];
  // letters of sections that are out of sight stop wobbling
  const seen = new Set();
  const watcher = new IntersectionObserver((entries) => entries.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target))));
  slides.forEach((slide, si) => {
    watcher.observe(slide);
    const def = LOOP[si];
    const title = slide.querySelector(".ev-loop-title");
    buildTitle(title, def, () => !seen.has(slide));
    if (def.type) setupTypewriter(slide, title);
  });

  // jump to another spot on the page (Lenis keeps its own idea of where the page is, so it is told too)
  const jump = (y) => {
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
    ScrollTrigger.update();
  };

  // ---- One scroll gesture = one section. The page is moved by us (a smooth, eased glide to the next or previous screen) instead of
  // by the wheel, so a hard flick or a trackpad's long coasting can never carry it past more than one section, and the pinned sections
  // are always left exactly lined up. ScrollTrigger still pins every section; ScrollTrigger.maxScroll() gives the end of the page.
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2); // power2.inOut, like the other slides
  let triggers = [];
  let observer = null;
  let gliding = false; // a glide is in progress
  let used = false; // this gesture has already moved a section
  let lastWheel = 0;
  let stopped = false; // true while we are the ones holding Lenis still

  const onWheel = () => {
    const now = performance.now();
    if (now - lastWheel >= 180) used = false; // a new wheel click, or the coasting has died down: a new gesture
    lastWheel = now;
  };
  const onTouchStart = () => { used = false; };

  const glide = (dir) => {
    const vh = window.innerHeight;
    const max = ScrollTrigger.maxScroll(window);
    const here = Math.round(window.scrollY / vh);
    const target = Math.min(max, Math.max(0, (here + dir) * vh));
    if (target === Math.round(window.scrollY)) return;
    gliding = true;
    const done = () => { gliding = false; };
    if (!lenis) { window.scrollTo({ top: target, behavior: calm ? "instant" : "smooth" }); setTimeout(done, calm ? 0 : 900); return; }
    lenis.scrollTo(target, { duration: calm ? 0 : 1, easing: ease, force: true, onComplete: done });
  };

  const step = (dir) => {
    if (gliding || used) return;
    const vh = window.innerHeight;
    const here = Math.round(window.scrollY / vh);
    const atEnd = (dir > 0 && window.scrollY >= ScrollTrigger.maxScroll(window) - 2) || (dir < 0 && here === 0);
    if (atEnd) return; // at the very first or last section the page's folder-changing scroll (tabs.js) takes over
    used = true;
    glide(dir);
  };

  const holdLenis = () => { if (!lenis.isStopped) { lenis.stop(); stopped = true; } };
  const build = () => {
    if (triggers.length) return;
    // pin every section at the top as it arrives (the very last one needs no pin, it is where the page ends)
    slides.slice(0, -1).forEach((slide) => {
      triggers.push(ScrollTrigger.create({ trigger: slide, start: "top top", pin: true, pinSpacing: false }));
    });
    jump(0);
    gsap.delayedCall(0.8, () => triggers.length && ScrollTrigger.refresh()); // the folder slide-in has finished by now
    // the wheel no longer scrolls the page by itself (checked every tick, because the page's opening animation can switch Lenis back on)
    if (lenis) gsap.ticker.add(holdLenis);
    used = false;
    window.addEventListener("wheel", onWheel, { capture: true, passive: true });
    window.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    observer = Observer.create({
      type: "wheel,touch",
      wheelSpeed: -1,
      tolerance: 10,
      preventDefault: true,
      onUp: () => step(1),
      onDown: () => step(-1),
    });
  };
  const teardown = () => {
    observer?.kill();
    observer = null;
    window.removeEventListener("wheel", onWheel, { capture: true });
    window.removeEventListener("touchstart", onTouchStart, { capture: true });
    if (lenis) gsap.ticker.remove(holdLenis);
    if (lenis && stopped) { lenis.start(); stopped = false; }
    gliding = false;
    triggers.forEach((t) => t.kill(true));
    triggers = [];
  };

  new MutationObserver(() => (root.hidden ? teardown() : build())).observe(root, { attributes: true, attributeFilter: ["hidden"] });
  if (!root.hidden) build();
}

// The Events headline wears the same paper-cut lettering as the layer titles on Home (see cutword.js and mascot.js):
// every letter is a little hand-cut vector shape with a hard brown shadow. Letters we have no outline for stay plain text.
function setupHeadline(root) {
  const title = root.querySelector(".events-intro .story-title");
  if (!title) return;
  const text = title.textContent.replace(/\s+/g, " ").trim();
  title.setAttribute("aria-label", text);
  title.textContent = "";
  text.split(" ").forEach((word, i, all) => {
    const w = document.createElement("span");
    w.className = "w";
    w.setAttribute("aria-hidden", "true");
    [...word].forEach((ch) => {
      const letter = createCutLetter(ch, { fill: "var(--pop)", shadow: "var(--brown)" });
      if (letter) w.append(letter.el);
      else w.append(document.createTextNode(ch));
    });
    title.append(w);
    if (i < all.length - 1) title.append(" ");
  });
}

// ---- The little pictures on the tickets (drawn in the ticket's own colours, over a dark panel) ----
// p = paper colour, a = accent colour, k = dark; lp / la = round-ended lines in paper / accent
const SKYLINE = `<path class="a" d="M0 128V108h12V96h9v12h8V90h6v18h10V100h12v8h8V84h8v24h12V98h9v10h11V92h7v16h12V104h10v4h13V94h8v14h9V86h6v22h10v20z"/>`;
const ART = {
  music: `<circle class="p" cx="100" cy="58" r="30"/><path class="la" d="M24 40q10-9 20 0t20 0M136 30q10-9 20 0t20 0"/><circle class="a" cx="42" cy="76" r="6"/><path class="la" d="M48 76V56l16-4"/>`,
  workshop: `<path class="p" d="M70 42h60q10 0 8 14l-6 34q-2 10-14 10H82q-12 0-14-10l-6-34q-2-14 8-14z"/><ellipse class="a" cx="100" cy="42" rx="30" ry="7"/><path class="la" d="M84 22q-6 8 0 14t0 12M116 22q-6 8 0 14t0 12"/>`,
  comedy: `<rect class="p" x="90" y="26" width="20" height="42" rx="10"/><path class="lp" d="M76 62q0 26 24 26t24-26M100 88v20M84 108h32"/><path class="la" d="M44 36l4 9 10 1-8 7 3 10-9-6-9 6 3-10-8-7 10-1zM152 30l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z"/>`,
  vinyl: `<circle class="p" cx="100" cy="62" r="44"/><circle class="a" cx="100" cy="62" r="15"/><circle class="k" cx="100" cy="62" r="3.5"/><circle cx="100" cy="62" r="30" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="2"/><circle cx="100" cy="62" r="38" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="2"/>`,
  film: `<rect class="p" x="38" y="22" width="124" height="76" rx="4"/><rect class="a" x="52" y="36" width="96" height="48" rx="2"/><g class="k"><rect x="44" y="26" width="8" height="6"/><rect x="62" y="26" width="8" height="6"/><rect x="80" y="26" width="8" height="6"/><rect x="98" y="26" width="8" height="6"/><rect x="116" y="26" width="8" height="6"/><rect x="134" y="26" width="8" height="6"/><rect x="44" y="88" width="8" height="6"/><rect x="62" y="88" width="8" height="6"/><rect x="80" y="88" width="8" height="6"/><rect x="98" y="88" width="8" height="6"/><rect x="116" y="88" width="8" height="6"/><rect x="134" y="88" width="8" height="6"/></g>`,
  food: `<path class="p" d="M66 52h64v26q0 22-32 22t-32-22z"/><path class="lp" d="M130 58q22 0 20 16t-22 8"/><ellipse class="a" cx="98" cy="52" rx="32" ry="6"/><path class="la" d="M82 24q-6 8 0 14t0 10M98 20q-6 8 0 14t0 14M114 24q-6 8 0 14t0 10"/>`,
  art: `<path class="p" d="M100 24c-38 0-62 22-62 44 0 18 16 28 34 22 10-3 14 6 10 16-2 8 8 12 22 12 34 0 60-22 60-50 0-26-26-44-64-44z"/><circle class="a" cx="72" cy="50" r="8"/><circle class="k" cx="104" cy="42" r="8"/><circle class="a" cx="136" cy="58" r="8"/><circle class="k" cx="64" cy="76" r="7"/>`,
  games: `<rect class="p" x="68" y="30" width="64" height="64" rx="12" transform="rotate(-12 100 62)"/><g class="k" transform="rotate(-12 100 62)"><circle cx="84" cy="46" r="5"/><circle cx="116" cy="46" r="5"/><circle cx="100" cy="62" r="5"/><circle cx="84" cy="78" r="5"/><circle cx="116" cy="78" r="5"/></g>`,
};
const art = (kind) => `<svg viewBox="0 0 200 128" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${ART[kind] || ART.music}${SKYLINE}</svg>`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const TILTS = [-1.6, 1.2, -0.8, 1.7, -1.3, 0.9, -1.8, 1.4]; // each ticket sits at its own small angle
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function ticket(ev, i) {
  const [y, m, d] = ev.date.split("-").map(Number);
  const day = new Date(y, m - 1, d);
  const where = `${ev.area}${ev.venue ? ` · ${ev.venue}` : ""}`;
  const href = ev.link || "#";
  return `
    <article class="tk tk-${esc(ev.paper || "sun")}" style="--tilt:${TILTS[i % TILTS.length]}deg">
      <div class="tk-main">
        <p class="tk-top"><span>★ Admit one ★</span><span>No. ${String(i + 1).padStart(4, "0")}</span></p>
        <div class="tk-art">${art(ev.kind)}<span class="tk-stamp">${esc(ev.category)}</span></div>
        <h3>${esc(ev.title)}</h3>
        <p class="tk-where">${esc(where)}</p>
        <p class="tk-blurb">${esc(ev.blurb)}</p>
      </div>
      <div class="tk-stub">
        <div class="tk-date"><b>${String(d).padStart(2, "0")}</b><span>${MONTHS[m - 1]}<br />${DAYS[day.getDay()]}</span></div>
        <div class="tk-meta"><span>${esc(ev.time)}</span><span class="tk-price">${esc(ev.price)}</span></div>
        <a class="tk-btn" href="${esc(href)}" target="_blank" rel="noopener"${ev.link ? "" : ' aria-disabled="true"'}>Go to event <span aria-hidden="true">→</span></a>
        <span class="tk-bars" aria-hidden="true"></span>
      </div>
    </article>`;
}

function setupLineup(root) {
  const track = root.querySelector(".lineup-track");
  if (!track) return;

  // Only events that haven't happened yet, soonest first (a ticket vanishes by itself once its day has passed)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = EVENTS.filter((ev) => {
    const [y, m, d] = ev.date.split("-").map(Number);
    return new Date(y, m - 1, d) >= today;
  }).sort((a, b) => a.date.localeCompare(b.date));

  if (!upcoming.length) {
    track.innerHTML = `<p class="lineup-empty">The next lineup is being mined. Check back soon.</p>`;
    root.querySelector(".lineup-bar")?.setAttribute("hidden", "");
    return;
  }
  track.innerHTML = upcoming.map(ticket).join("");

  // A "Go to event" with no link yet does nothing
  track.addEventListener("click", (e) => {
    const link = e.target.closest(".tk-btn");
    if (link && link.getAttribute("aria-disabled") === "true") e.preventDefault();
  });

  // Arrows: one ticket at a time
  const step = () => (track.querySelector(".tk")?.getBoundingClientRect().width || 300) + 24;
  root.querySelector(".lineup-prev")?.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
  root.querySelector(".lineup-next")?.addEventListener("click", () => track.scrollBy({ left: step(), behavior: "smooth" }));

  // Drag to scroll with a mouse (fingers already scroll it on phones)
  let down = null;
  let moved = false;
  track.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    down = { x: e.clientX, left: track.scrollLeft };
    moved = false;
  });
  window.addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - down.x;
    if (!moved && Math.abs(dx) > 5) {
      moved = true;
      track.classList.add("dragging");
    }
    if (moved) track.scrollLeft = down.left - dx;
  });
  window.addEventListener("pointerup", () => {
    if (!down) return;
    down = null;
    track.classList.remove("dragging");
  });
  // a drag must not count as a click on a ticket's button
  track.addEventListener("click", (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
}


// ---- The browse layout: banner of posters, category bar, filters on the left, event cards on the right ----
const PAPER = { sun: ["#ffe386", "#463721"], jam: ["#c2184f", "#f8f8f0"], cream: ["#f8f8f0", "#463721"], peanut: ["#f0a830", "#463721"], brown: ["#463721", "#ffe386"] };
const priceNum = (p) => (/free/i.test(p) ? 0 : Number(String(p).replace(/[^\d]/g, "")) || 0);
const dateOf = (ev) => { const [y, m, d] = ev.date.split("-").map(Number); return new Date(y, m - 1, d); };
const longDate = (ev) => { const d = dateOf(ev); return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };

// For now every card is empty, with only "Coming soon" on it in the same paper-cut lettering as the page headline
const SHOWN = 5; // cards in the line on the brown belt
const slideHTML = (i) => `<div class="ev-slide" data-i="${i}">${emptyCard()}</div>`;
const emptyCard = () => `<div class="ev-poster ev-empty"><span class="ev-soon" aria-label="Coming soon">Coming soon</span></div>`;
function poster() { return emptyCard(); }
function card() { return `<div class="ev-card-b">${emptyCard()}</div>`; }
// (the cards in the big grid are drawn once and then keep still, so twenty of them don't slow the page down; the belt's cards still wobble)
function cutSoon(scope, still = false) {
  scope.querySelectorAll(".ev-soon:not([data-cut])").forEach((el) => {
    el.dataset.cut = "1";
    const text = el.textContent;
    el.textContent = "";
    text.split(" ").forEach((word) => {
      const w = document.createElement("span");
      w.className = "w";
      w.setAttribute("aria-hidden", "true");
      [...word].forEach((ch) => {
        const letter = createCutLetter(ch, { fill: "var(--pop)", shadow: "var(--brown)" });
        if (letter) { w.append(letter.el); if (still) letter.dispose(); }
        else w.append(document.createTextNode(ch));
      });
      el.append(w);
    });
  });
}

// Until the real events arrive, the cards are placeholders with made-up details, spread out at random (the same spread every visit)
// so every category and every filter option has a different, uneven number of cards (some a lot, some only one or two).
function makePlaceholders(today) {
  let seed = 20261024;
  const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const shuffle = (arr) => arr.map((v) => [rand(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
  const cats = [...new Set(EVENTS.map((e) => e.category))];
  const areas = [...new Set(EVENTS.map((e) => e.area))];
  const prices = ["Free", "₹300", "₹400", "₹500", "₹600", "₹800", "₹1,200", "₹1,500"];
  const N = 20;
  const catOrder = shuffle(cats);
  const areaOrder = shuffle(areas);
  const out = [];
  for (let i = 0; i < N; i++) {
    const d = new Date(today);
    // the first few land on today, tomorrow and the weekend, the rest are spread over the next ten weeks
    d.setDate(d.getDate() + (i === 0 ? 0 : i === 1 ? 1 : Math.floor(rand() * 70)));
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({
      category: i < cats.length ? catOrder[i] : pick(cats), // every category gets at least one, then it is up to chance
      area: i < areas.length ? areaOrder[i] : pick(areas),
      price: i < prices.length ? prices[i] : pick(prices),
      date,
      time: "7:00 PM",
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const FILTERS = {
  sort: { label: "Sort By", opts: [["soon", "Soonest first"], ["low", "Price: low to high"], ["high", "Price: high to low"]], def: "soon" },
  day: { label: "Day", opts: [["today", "Today"], ["tomorrow", "Tomorrow"], ["weekend", "This weekend"]] },
  month: { label: "Filter By Month", opts: null },
  area: { label: "Search by your area", opts: null },
  price: { label: "Price", opts: [["free", "Free"], ["u500", "Under ₹500"], ["u1000", "₹500 to ₹1,000"], ["o1000", "Over ₹1,000"]] },
};

function setupBrowse(root) {
  const host = root.querySelector(".ev-browse");
  if (!host) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = makePlaceholders(today);
  if (!upcoming.length) {
    host.innerHTML = `<p class="lineup-empty">The next lineup is being mined. Check back soon.</p>`;
    return;
  }
  const uniq = (arr) => [...new Set(arr)];
  FILTERS.month.opts = uniq(upcoming.map((e) => e.date.slice(0, 7))).map((k) => { const [y, m] = k.split("-").map(Number); return [k, `${MONTHS[m - 1]} ${y}`]; });
  FILTERS.area.opts = uniq(upcoming.map((e) => e.area)).sort().map((a) => [a, a]);
  const cats = uniq(upcoming.map((e) => e.category));

  const state = { cat: "", sort: "soon", day: "", month: "", area: "", price: "" };
  const banner = upcoming.slice(0, 8);

  host.innerHTML = `
    <div class="ev-banner">
      <button class="ev-arrow prev" aria-label="Previous">←</button>
      <div class="ev-banner-track">${banner.slice(0, SHOWN).map((ev, i) => slideHTML(i)).join("")}</div>
      <button class="ev-arrow next" aria-label="Next">→</button>
    </div>
    <div class="ev-cats"><button class="ev-arrow sm prev" aria-label="Previous">←</button>
      <div class="ev-cats-track"><button class="on" data-cat="">All events</button><button data-cat="PBJ Exclusive Events">PBJ Exclusive Events</button>${cats.map((c) => `<button data-cat="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      <button class="ev-arrow sm next" aria-label="Next">→</button></div>
    <div class="ev-body">
      <aside class="ev-filters">
        <div class="ev-filters-head"><h2>Filter Options</h2><button class="ev-clear" data-clear="all">clear</button></div>
        ${Object.entries(FILTERS).map(([key, f]) => {
          const opts = key === "sort" ? f.opts : [["", "Any"], ...f.opts];
          return `
          <div class="ev-dd" data-key="${key}">
            <p class="ev-dd-label">${f.label}</p>
            <button class="ev-dd-btn" type="button" aria-haspopup="listbox" aria-expanded="false"><span></span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 7l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            <ul class="ev-dd-list" role="listbox" hidden>${opts.map(([v, l]) => `<li><button type="button" role="option" data-value="${esc(v)}">${esc(l)}</button></li>`).join("")}</ul>
          </div>`;
        }).join("")}
      </aside>
      <div class="ev-results"><p class="ev-count"></p><div class="ev-grid"></div><p class="lineup-empty" hidden>Nothing matches yet. Try clearing a filter.</p></div>
    </div>`;

  cutSoon(host);
  const grid = host.querySelector(".ev-grid");
  const count = host.querySelector(".ev-count");
  const emptyMsg = host.querySelector(".lineup-empty");
  // one card per event, made once; filtering only hides, shows and re-orders them (so they can glide, like GSAP's "Flexbox Filtering")
  grid.innerHTML = upcoming.map(card).join("");
  cutSoon(grid, true);
  const cardEls = [...grid.children];
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let firstRender = true;
  let token = 0; // numbers each move, so only the latest one tidies up
  let flipTL = null; // the move in progress, and the little grow/shrink tweens that belong to it
  let extra = [];
  const settle = () => {
    if (flipTL) { flipTL.progress(1).kill(); flipTL = null; }
    extra.forEach((t) => t.kill());
    extra = [];
    gsap.set(cardEls, { clearProps: "opacity,scale,transform,position,top,left,width,height,margin,padding,gridArea,transition,translate,rotate" });
    grid.style.minHeight = "";
  };
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const same = (a, b) => a.getTime() === b.getTime();

  const render = () => {
    let list = upcoming.filter((ev) => {
      const d = dateOf(ev), p = priceNum(ev.price);
      // (PBJ Exclusive Events has no real events yet, so for now it shows the same "Coming soon" cards)
      if (state.cat && state.cat !== "PBJ Exclusive Events" && ev.category !== state.cat) return false;
      if (state.day === "today" && !same(d, today)) return false;
      if (state.day === "tomorrow" && !same(d, tomorrow)) return false;
      if (state.day === "weekend" && ![0, 6].includes(d.getDay())) return false;
      if (state.month && ev.date.slice(0, 7) !== state.month) return false;
      if (state.area && ev.area !== state.area) return false;
      if (state.price === "free" && p !== 0) return false;
      if (state.price === "u500" && !(p > 0 && p < 500)) return false;
      if (state.price === "u1000" && !(p >= 500 && p <= 1000)) return false;
      if (state.price === "o1000" && p <= 1000) return false;
      return true;
    });
    if (state.sort === "low") list = [...list].sort((a, b) => priceNum(a.price) - priceNum(b.price));
    if (state.sort === "high") list = [...list].sort((a, b) => priceNum(b.price) - priceNum(a.price));
    const shown = new Set(list.map((ev) => cardEls[upcoming.indexOf(ev)]));
    // if a move is still going when the next filter is picked, finish it off first, so cards never get stuck half way
    settle();
    const state0 = !firstRender && !calm ? Flip.getState(cardEls) : null;
    if (state0) grid.style.minHeight = grid.offsetHeight + "px"; // the page below shouldn't jump while cards fly about
    // order: the matching cards in their new order first, then the hidden ones
    list.forEach((ev) => grid.append(cardEls[upcoming.indexOf(ev)]));
    cardEls.forEach((el) => { if (!shown.has(el)) grid.append(el); el.style.display = shown.has(el) ? "" : "none"; });
    emptyMsg.hidden = list.length > 0;
    const mine = ++token;
    if (state0) {
      flipTL = Flip.from(state0, {
        duration: 0.7,
        ease: "power1.inOut",
        stagger: 0.05,
        absolute: true,
        scale: true,
        onEnter: (els) => { extra.push(gsap.fromTo(els, { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.7, ease: "power1.inOut" })); },
        onLeave: (els) => { extra.push(gsap.to(els, { opacity: 0, scale: 0, duration: 0.5, ease: "power1.inOut" })); },
        onComplete: () => { if (mine === token) settle(); },
      });
      // belt and braces: whatever happens, once the move should be over every card goes back to plain, clean positions
      setTimeout(() => { if (mine === token) settle(); }, 3200);
    }
    firstRender = false;
    count.textContent = `${list.length} event${list.length === 1 ? "" : "s"} in Mumbai`;
  };
  const sync = () => {
    host.querySelectorAll(".ev-cats-track button").forEach((b) => b.classList.toggle("on", b.dataset.cat === state.cat));
    host.querySelectorAll(".ev-dd").forEach((d) => {
      const k = d.dataset.key;
      const picked = d.querySelector(`.ev-dd-list button[data-value="${state[k]}"]`);
      d.querySelector(".ev-dd-btn span").textContent = picked ? picked.textContent : "Any";
      d.classList.toggle("active", !!state[k] && k !== "sort");
      d.querySelectorAll(".ev-dd-list button").forEach((o) => {
        o.classList.toggle("on", o === picked);
        o.setAttribute("aria-selected", String(o === picked));
      });
    });
    render();
  };

  host.addEventListener("click", (e) => {
    const cat = e.target.closest("[data-cat]");
    if (cat) { state.cat = cat.dataset.cat; sync(); return; }
    const dd = e.target.closest(".ev-dd");
    const optBtn = e.target.closest(".ev-dd-list button");
    if (optBtn) { state[dd.dataset.key] = optBtn.dataset.value; closeDD(); sync(); return; }
    if (e.target.closest(".ev-dd-btn")) {
      const list = dd.querySelector(".ev-dd-list");
      const open = list.hidden;
      closeDD();
      list.hidden = !open;
      dd.classList.toggle("open", open);
      dd.querySelector(".ev-dd-btn").setAttribute("aria-expanded", String(open));
      return;
    }
    const clr = e.target.closest("[data-clear]");
    if (clr) {
      e.preventDefault();
      const k = clr.dataset.clear;
      if (k === "all") Object.assign(state, { cat: "", sort: "soon", day: "", month: "", area: "", price: "" });
      else state[k] = k === "sort" ? "soon" : "";
      sync(); return;
    }
    const link = e.target.closest("a[aria-disabled], a[href='#']");
    if (link) e.preventDefault();
  });
  // dropdowns close when you click anywhere else or press Escape
  const closeDD = () => host.querySelectorAll(".ev-dd").forEach((d) => {
    d.querySelector(".ev-dd-list").hidden = true;
    d.classList.remove("open");
    d.querySelector(".ev-dd-btn").setAttribute("aria-expanded", "false");
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".ev-dd")) closeDD(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDD(); });

  // arrows scroll their row
  const scroller = (btn, track, amount) => btn.addEventListener("click", () => track.scrollBy({ left: amount(), behavior: "smooth" }));
  const ct = host.querySelector(".ev-cats-track");
  setupCaterpillar(host.querySelector(".ev-banner"), banner.length);
  scroller(host.querySelector(".ev-cats .prev"), ct, () => -ct.clientWidth * 0.6);
  scroller(host.querySelector(".ev-cats .next"), ct, () => ct.clientWidth * 0.6);
  sync();
}


// ---- The belt of cards: GSAP's "Flip Carousel" (see INSPIRATION.md). Next: the first card shrinks away into its bottom-left
// corner, the others glide one place left, and a new card grows in at the end from its bottom-right corner. Previous does it backwards.
function setupCaterpillar(banner, total) {
  const track = banner.querySelector(".ev-banner-track");
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let busy = false;

  const step = (forward) => {
    if (busy) return;
    const cards = gsap.utils.toArray(".ev-slide", track);
    const first = cards[0];
    const last = cards[cards.length - 1];
    const wrap = (n) => (n + total) % total;
    const make = (i) => {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = slideHTML(i);
      cutSoon(wrapper);
      return wrapper.firstElementChild;
    };
    const newCard = make(wrap(forward ? Number(last.dataset.i) + 1 : Number(first.dataset.i) - 1));
    if (calm) {
      forward ? (first.remove(), track.append(newCard)) : (last.remove(), track.prepend(newCard));
      return;
    }
    busy = true;
    const state = Flip.getState(cards);
    gsap.set(newCard, { scale: 0, opacity: 0 });
    if (forward) {
      track.append(newCard);
      first.classList.add("hide");
    } else {
      track.prepend(newCard);
      last.classList.add("hide");
    }
    Flip.from(state, {
      targets: ".ev-slide",
      fade: true,
      absoluteOnLeave: true,
      duration: 0.7,
      ease: "power2.inOut",
      onEnter: (els) => { gsap.to(els, { opacity: 1, scale: 1, duration: 0.7, ease: "power2.inOut", transformOrigin: forward ? "bottom right" : "bottom left" }); },
      onLeave: (els) => { gsap.to(els, {
        opacity: 0,
        scale: 0,
        duration: 0.7,
        ease: "power2.inOut",
        transformOrigin: forward ? "bottom left" : "bottom right",
        onComplete: () => { els.forEach((el) => el.remove()); busy = false; },
      }); },
    });
  };

  banner.querySelector(".prev").addEventListener("click", () => step(false));
  banner.querySelector(".next").addEventListener("click", () => step(true));
  // fingers and mice can swipe the belt too
  let startX = null;
  track.addEventListener("pointerdown", (e) => { startX = e.clientX; });
  window.addEventListener("pointerup", (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 40) step(dx < 0);
  });
}
