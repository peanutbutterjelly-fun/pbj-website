// "Know More" (the old "Our Secret" tab): three cards (For Hosts, For Brands, For Spontys) side by side at the centre.
// [next] slides every card one place along; the one at the far end lifts and travels over the top to the other end. Tapping a card widens it into a full
// page (laid out like offlyn.life's host and brand pages) that fits the frame; the close button shrinks it back into the stack.
import "./knowMore.css";
import { gsap } from "gsap";
import { cutText } from "./aboutStory.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---- The words (placeholder copy in PBJ's voice; fees and numbers are not decided yet, so none are promised) ----
const CARDS = [
  {
    id: "hosts", label: "For hosts", role: "Host", bg: "var(--honey)", ink: "var(--brown)", pop: "var(--strawberry)",
    teaser: "Your hidden gem deserves a crowd.",
    kicker: "For hosts",
    head: "Your hidden gem deserves a crowd.",
    sub: "Teachers, artists, studios, clubs and small venues: list your night with PBJ and let Mumbai’s curious crowd find you.",
    cta: ["List your event", "Book a call"],
    strip: ["Easy listing", "Your own magazine cover", "Weekday slots filled", "PBJ Partner badge", "Host dashboard", "Brand matches", "Pilot hosts first"],
    featuresTitle: "What you get",
    features: [
      ["Easy listing", "One short form and your event is in front of people who actually go out. We hand-pick, so you are never lost in a feed."],
      ["Your own magazine cover", "Every host gets a cover in Meet Our Hosts, with your profile, past nights and what is coming next."],
      ["A crowd that shows up", "We write your card in our own words and link guests straight to your page or Instagram. Your audience stays yours."],
      ["Quiet slots, filled", "Venues: tell us your slow weekdays and we help fill them with the right crowd, as a PBJ Partner."],
      ["Your dashboard", "Create, edit and track your events in one place once you are in."],
      ["Brand matches", "Looking for a sponsor or a product partner? We introduce you to brands that fit your night."],
    ],
    stepsTitle: "How it works",
    steps: [["Sign up", "Tell us who you are."], ["Fill the event form", "The night you want to list."], ["Book a call", "If you want to be a pilot host."], ["Go live", "Your dashboard opens."]],
    promiseTitle: "The plain promises",
    promises: [["Outside venues only", "No home addresses, ever. Safer for hosts and guests."], ["You keep your people", "We send guests to you, we do not hold them back."], ["Pricing, told up front", "Pilot hosts hear our fees before they agree to anything."]],
    faq: [
      ["Who can host?", "Solo teachers and artists, studios, small venues, clubs and groups. If your night is small, good and in Mumbai, we want to see it."],
      ["Do I need my own venue?", "No. Many hosts use cafes, studios and rooftops. We only list events at outside venues, never at home addresses."],
      ["What does it cost?", "Fees are still being set for launch. Pilot hosts are told everything before they commit."],
      ["How soon will I hear back?", "Book a call from the form and we get back to you. Hand-picking means we read every submission."],
    ],
    closer: "Your next night deserves better.",
  },
  {
    id: "brands", label: "For brands", role: "Brand", bg: "var(--crust)", ink: "var(--cream)", pop: "var(--honey)",
    teaser: "Be in the room, not in the scroll.",
    kicker: "For brands",
    head: "Be in the room, not in the scroll.",
    sub: "Skip the ads people swipe past. Put your product, your name or your whole evening in front of Mumbai’s most curious crowd, in a room they chose to be in.",
    cta: ["Talk to us", "Book a call"],
    strip: ["Product in the room", "Sponsor a night", "Co-host an evening", "PBJ Originals", "Mumbai crowds", "Pick your nights", "Follow-up after"],
    featuresTitle: "Ways to partner",
    features: [
      ["Product in the room", "Sampling, discount codes or trials, handed over inside a night people are already enjoying."],
      ["Sponsor a night", "Put your name on a PBJ Original: a night we design around your brand, priced per event."],
      ["Co-host an evening", "Build a night together with a host and shape it to what your brand stands for."],
      ["Pick your crowd", "Tell us who you want to meet. We suggest the hosts and nights where they gather."],
      ["Know what happened", "A short recap after the night: who was in the room and how it went."],
      ["Mix and repeat", "Start with one night, then try a different format or come back every month."],
    ],
    stepsTitle: "How it works",
    steps: [["Tell us your goal", "Who, where, how much."], ["We suggest nights", "A shortlist that fits."], ["The night happens", "Your brand in the room."], ["Recap and follow-up", "What worked, what is next."]],
    compareTitle: "Why in-person",
    compareCols: ["In-person nights", "Influencers", "Online ads"],
    compare: [["Attention", "Full", "Partial", "Scrolled past"], ["Trust", "High", "Medium", "Low"], ["Trial", "In hand", "Rare", "Rare"], ["Control", "You pick the nights", "Hard to steer", "Platform decides"]],
    faq: [
      ["How do I choose events?", "Tell us your crowd and budget. We shortlist the nights and hosts that fit, you say yes or no."],
      ["Can I sponsor with product only?", "Yes. Product, discounts or cash, or a mix of them, all work."],
      ["What does it cost?", "Sponsored nights are priced per event. Share a rough budget and we will tell you what is possible."],
      ["Do you track sales?", "Not yet. We share who was in the room and how it went, and we are honest about what we cannot measure."],
    ],
    closer: "Your brand belongs in the room.",
  },
  {
    id: "spontys", label: "For spontys", role: "Spontaneous Planner", bg: "var(--strawberry)", ink: "var(--cream)", pop: "var(--honey)",
    teaser: "Hear about a plan at five, be in a cab by six.",
    kicker: "For spontys",
    head: "Hear about a plan at five. Be in a cab by six.",
    sub: "Tired of “next weekend”? PBJ Sponty is for last-minute plans around Mumbai: find people who are game, or list your own and let them find you.",
    cta: ["List a plan", "See events"],
    strip: ["Last-minute plans", "Spare tickets", "Group outings", "Public places only", "Free to list", "Find your people", "Mumbai first"],
    featuresTitle: "What is in it for you",
    features: [
      ["Plans near you", "Cafe runs, Colaba Causeway shopping sprees, a gig tonight. Plans from people who are game right now."],
      ["Got a spare ticket?", "Pass it on to someone who will actually use it, instead of letting it go to waste."],
      ["List your own plan", "Post a group outing in a minute. No big event needed."],
      ["Your kind of crowd", "Pick the areas and kinds of plans you like and we point you the right way."],
      ["Public places only", "Plans happen at outside venues, never at home addresses."],
      ["Always free to list", "Everyday plans are free to list with PBJ."],
    ],
    stepsTitle: "How it works",
    steps: [["Spot a plan", "Or list your own."], ["Say you are in", "Reach the person who posted it."], ["Show up", "Meet at a public place."], ["Repeat", "The best plans start random."]],
    promiseTitle: "The ground rules",
    promises: [["Outside venues only", "Public places, no home addresses."], ["Small and simple", "Spare tickets and group plans, not big productions."], ["Mumbai first", "Starting where we live, more cities later."]],
    faq: [
      ["Is it free?", "Listing a plan or a spare ticket is free."],
      ["Where do plans happen?", "At outside venues like cafes, parks and shops. Never at home addresses."],
      ["Can I list my own plan?", "Yes. Tell us what, where and when, and the game ones will find it."],
      ["Do I need an account?", "Not to look around. Listing opens through our host form."],
    ],
    closer: "The best plans start random.",
  },
];

// ---- Building a card and its page ----
const pageHTML = (c) => `
  <header class="km-hero">
    <p class="km-kicker">■ ${esc(c.kicker)}</p>
    <h2 class="km-head">${esc(c.head)}</h2>
    <p class="km-sub">${esc(c.sub)}</p>
    <p class="km-ctas"><button type="button" class="km-btn km-go" data-role="${esc(c.role)}">${esc(c.cta[0])}</button><button type="button" class="km-btn alt km-go" data-role="${esc(c.role)}">${esc(c.cta[1])}</button></p>
  </header>
  <div class="km-strip" aria-hidden="true"><div class="km-run">${[0, 1].map(() => `<span>${c.strip.map((s) => `<b>${esc(s)}</b>`).join("")}</span>`).join("")}</div></div>
  <section class="km-sec"><h3>${esc(c.featuresTitle)}</h3>
    <ol class="km-feats">${c.features.map(([t, d], i) => `<li><i>${String(i + 1).padStart(2, "0")}</i><h4>${esc(t)}</h4><p>${esc(d)}</p></li>`).join("")}</ol></section>
  <section class="km-sec"><h3>${esc(c.stepsTitle)}</h3>
    <ol class="km-steps">${c.steps.map(([t, d], i) => `<li><i>${i + 1}</i><h4>${esc(t)}</h4><p>${esc(d)}</p></li>`).join("")}</ol></section>
  ${c.promises ? `<section class="km-sec"><h3>${esc(c.promiseTitle)}</h3>
    <ul class="km-promises">${c.promises.map(([t, d]) => `<li><h4>${esc(t)}</h4><p>${esc(d)}</p></li>`).join("")}</ul></section>` : ""}
  ${c.compare ? `<section class="km-sec"><h3>${esc(c.compareTitle)}</h3>
    <div class="km-table-wrap"><table class="km-table"><thead><tr><th></th>${c.compareCols.map((x, i) => `<th${i === 0 ? ' class="us"' : ""}>${esc(x)}</th>`).join("")}</tr></thead>
    <tbody>${c.compare.map(([r, ...v]) => `<tr><th scope="row">${esc(r)}</th>${v.map((x, i) => `<td${i === 0 ? ' class="us"' : ""}>${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section>` : ""}
  <section class="km-sec"><h3>Questions</h3>
    <div class="km-faq">${c.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div></section>
  <footer class="km-closer"><h3>${esc(c.closer)}</h3>
    <p class="km-ctas"><button type="button" class="km-btn km-go" data-role="${esc(c.role)}">${esc(c.cta[0])}</button><button type="button" class="km-btn alt km-go" data-role="${esc(c.role)}">${esc(c.cta[1])}</button></p></footer>`;

export function setupKnowMore(panel) {
  panel.innerHTML = `<div class="km" style="--n:${CARDS.length}">
    <div class="km-stage">
      <button type="button" class="km-next" aria-label="Show the next card"><i>[</i><span>next</span><i>]</i></button>
      <div class="km-deck">${CARDS.map((c) => `
        <article class="km-card" data-id="${c.id}" role="button" tabindex="0" aria-label="${esc(c.label)}: open the page" style="--bg:${c.bg};--ink:${c.ink};--pop:${c.pop}">
          <div class="km-face"><p class="km-tag">${esc(c.label)}</p><p class="km-teaser">${esc(c.teaser)}</p><p class="km-open">Tap to open</p></div>
          <div class="km-page" data-lenis-prevent tabindex="-1"><button type="button" class="km-close" aria-label="Close this page"><i>[</i><span>close</span><i>]</i></button>${pageHTML(c)}</div>
        </article>`).join("")}</div>
    </div>
  </div>`;

  const root = panel.querySelector(".km");
  let openCard = null;
  const deck = root.querySelector(".km-deck");
  const nextBtn = root.querySelector(".km-next");
  const cards = [...root.querySelectorAll(".km-card")];
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let order = [...cards]; // order[0] is on top, the last is at the back
  let busy = false;

  // three places side by side: left, centre (the one in focus, a touch bigger), right. On phones the side cards peek in from the edges.
  const TILT = [-2.5, 0, 2.5];
  const geo = () => {
    const w = cards[0].offsetWidth;
    const phone = matchMedia("(max-width: 767px)").matches;
    return { step: phone ? w * 1.06 : w + parseFloat(getComputedStyle(root).getPropertyValue("--gap") || 20), side: phone ? 0.88 : 0.94 };
  };
  const slotOf = (i) => { const g = geo(); return { x: (i - 1) * g.step, y: i === 1 ? 0 : 14, r: TILT[i], s: i === 1 ? 1 : g.side }; };
    const place = (instant) => order.forEach((c, i) => {
    const s = slotOf(i);
    c.style.zIndex = String(i === 1 ? 3 : 2);
    c.classList.toggle("front", i === 1);
    if (instant || calm) { gsap.killTweensOf(c); gsap.set(c, { x: s.x, y: s.y, rotation: s.r, scale: s.s }); } // (set at once, so it can be measured right away)
    else gsap.to(c, { x: s.x, y: s.y, rotation: s.r, scale: s.s, duration: 0.6, ease: "back.out(1.4)", overwrite: "auto" });
  });
  place(true);
  // the headline on each card is paper-cut lettering that shakes like our other headings (only while the cards are showing)
  const LOOK = { hosts: ["var(--cream)", "#F0A830"], brands: ["var(--honey)", "var(--brown)"], spontys: ["var(--honey)", "var(--brown)"] }; // the headline colours of each card (the colours were rotated one place: Hosts has the old Brands look, Brands the old Spontys look, Spontys the old Hosts look)
  cards.forEach((c) => cutText(c.querySelector(".km-teaser"), ...LOOK[c.dataset.id], () => !panel.hidden && !openCard));
  addEventListener("resize", () => { if (!openCard) place(true); });

  // [next] (or a swipe left): everything slides one place to the left; the card that was on the far left lifts and travels over the top to
  // the far right. [previous] (a swipe right) does the same the other way round.
  const shift = (dir) => {
    if (busy || openCard) return;
    busy = true;
    const wrapping = dir > 0 ? order[0] : order[2];
    order = dir > 0 ? [order[1], order[2], order[0]] : [order[2], order[0], order[1]];
    const finish = () => { busy = false; };
    if (calm) { place(true); finish(); return; }
    const tl = gsap.timeline({ onComplete: finish });
    order.forEach((c, i) => {
      const s = slotOf(i);
      c.classList.toggle("front", i === 1);
      if (c === wrapping) {
        c.style.zIndex = "4";
        tl.to(c, { y: -60, rotation: -8 * dir, scale: 1, duration: 0.3, ease: "power2.out", overwrite: "auto" }, 0)
          .to(c, { x: s.x, duration: 0.45, ease: "power2.inOut" }, 0.2)
          .to(c, { y: s.y, rotation: s.r, scale: s.s, duration: 0.45, ease: "back.out(1.4)", onStart: () => { c.style.zIndex = "2"; } }, 0.55);
      } else {
        c.style.zIndex = i === 1 ? "3" : "2";
        tl.to(c, { x: s.x, y: s.y, rotation: s.r, scale: s.s, duration: 0.6, ease: "back.out(1.3)", overwrite: "auto" }, 0.1);
      }
    });
  };
  const next = () => shift(1);
  // swiping the row sideways (phones): a swipe left brings the next card, a swipe right the one before
  {
    let x0 = null, y0 = 0;
    deck.addEventListener("touchstart", (e) => { if (e.touches.length === 1 && !openCard) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } }, { passive: true });
    deck.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) shift(dx < 0 ? 1 : -1);
    }, { passive: true });
  }
  nextBtn.addEventListener("click", (e) => { e.stopPropagation(); next(); });

  // ---- Open a card into its page, and shrink it back ----
  // Opening: the card keeps its own colour and its headline while it widens (the headline is pinned to the card's stacked size, so
  // nothing re-wraps on the way), the headline fades, and the page fades in over it. Closing plays the same thing backwards:
  // the page fades away, the card shrinks back to its place, and the headline fades back in as it lands.
  // The main headings on a page are paper-cut lettering (the small card and step titles stay plain, except the titles on the red promise and feature cards) (made the first time the card is opened), and every one of them shakes, but only
  // while it is on screen inside the open page (so hundreds of letters out of sight never cost anything).
  const CREAM = { hosts: ["#F0A830", "var(--brown)"], brands: ["#F0A830", "var(--brown)"], spontys: ["#F0A830", "var(--brown)"] }; // headings on the cream part of a page
  const cutHeadings = (card, page) => {
    if (page.dataset.cut) return;
    page.dataset.cut = "1";
    const id = card.dataset.id, seen = new WeakSet();
    const io = new IntersectionObserver((list) => list.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target))), { root: page });
    page.querySelectorAll(".km-head, .km-sec h3, .km-closer h3, .km-promises h4, .km-feats h4").forEach((el) => {
      io.observe(el);
      // headings on the cream part of the page take the page's own colour (a pale yellow would vanish there, so Brands uses the deeper dark yellow)
      const onCream = el.matches(".km-sec h3");
      cutText(el, ...(onCream ? CREAM[id] : LOOK[id]), () => openCard === card && !panel.hidden && seen.has(el));
    });
  };
  const box = (el) => ({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight }); // the real box, ignoring tilt and scale
  const open = (card) => {
    if (busy || openCard) return;
    busy = true;
    openCard = card;
    document.documentElement.setAttribute("data-loop-lock", ""); // the page scrolls inside itself, not the folder
    root.classList.add("open");
    const face = card.querySelector(".km-face"), page = card.querySelector(".km-page");
    expand(card, face, page);
  };
  const expand = (card, face, page) => {
    // where the card is now (its real box, before any tilt or scaling), and its current tilt and size
    const from = { ...box(card), x: gsap.getProperty(card, "x"), y: gsap.getProperty(card, "y"), rotation: gsap.getProperty(card, "rotation"), scale: gsap.getProperty(card, "scale") };
    card.classList.add("is-open");
    card.removeAttribute("role"); card.removeAttribute("tabindex");
    card.style.zIndex = "50";
    page.scrollTop = 0;
    gsap.set(page, { opacity: calm ? 1 : 0 });
    gsap.set(face, { opacity: calm ? 0 : 1 });
    cutHeadings(card, page);
    const to = box(card); // (its box once it is the page)
    Object.assign(page.style, { width: to.width + "px", height: to.height + "px" }); // the page holds its final size while the card grows, so its words never re-wrap on the way
    // one tween moves, resizes, straightens and un-shrinks the card together, so every card (middle or side) moves the same way
    gsap.fromTo(card, { ...from, margin: 0 }, {
      left: to.left, top: to.top, width: to.width, height: to.height, x: 0, y: 0, rotation: 0, scale: 1,
      duration: calm ? 0.01 : 0.75, ease: "power3.inOut", overwrite: true,
      onComplete: () => { gsap.set(card, { clearProps: "left,top,width,height,margin,transform" }); page.style.width = page.style.height = ""; busy = false; page.focus({ preventScroll: true }); },
    });
    if (!calm) {
      gsap.to(face, { opacity: 0, duration: 0.3, ease: "power1.out" });
      gsap.to(page, { opacity: 1, duration: 0.4, delay: 0.4, ease: "power1.out" });
    }
  };
  const close = (instant) => {
    const card = openCard;
    if (!card || (busy && !instant)) return;
    busy = true;
    const face = card.querySelector(".km-face"), page = card.querySelector(".km-page");
    const finish = () => {
      busy = false; openCard = null;
      document.documentElement.removeAttribute("data-loop-lock");
      gsap.set(page, { opacity: 1 }); gsap.set(face, { opacity: 1 });
      card.style.zIndex = order.indexOf(card) === 1 ? "3" : "2"; // now it can take its place in the row
      card.focus({ preventScroll: true });
    };
    const settle = () => {
      page.style.width = page.style.height = "";
      card.classList.remove("is-open");
      card.setAttribute("role", "button"); card.setAttribute("tabindex", "0");
      root.classList.remove("open");
    };
    const shrink = () => {
      const from = box(card); // (the page's box)
      Object.assign(page.style, { width: from.width + "px", height: from.height + "px" });
      card.classList.remove("is-open");
      place(true);
      const to = box(card), slot = slotOf(order.indexOf(card)); // (its box in the row, and its tilt and size there)
      if (instant || calm) { settle(); finish(); return; }
      card.classList.add("is-open"); // (kept on for a moment, so the page can fade while the card is already on its way)
      // the shrinking card stays in front of the others until it has landed (it never slips behind the middle card on the way)
      card.style.zIndex = "50";
      gsap.set(face, { opacity: 0 });
      gsap.to(face, { opacity: 1, duration: 0.35, delay: 0.3, ease: "power1.in" });
      gsap.to(page, { opacity: 0, duration: 0.2, ease: "power1.in", onComplete: settle });
      gsap.fromTo(card, { ...from, margin: 0, x: 0, y: 0, rotation: 0, scale: 1 }, {
        left: to.left, top: to.top, width: to.width, height: to.height, x: slot.x, y: slot.y, rotation: slot.r, scale: slot.s,
        duration: 0.7, ease: "power3.inOut", overwrite: true,
        onComplete: () => { gsap.set(card, { clearProps: "left,top,width,height,margin" }); finish(); },
      });
    };
    if (instant || calm) gsap.killTweensOf([page, face, ...page.children]);
    shrink();
  };

  cards.forEach((card) => {
    card.addEventListener("click", (e) => {
      if (card.classList.contains("is-open")) {
        if (e.target.closest(".km-close")) close();
        const go = e.target.closest(".km-go");
        if (go) document.dispatchEvent(new CustomEvent("pbj-role", { detail: go.dataset.role })); // to List Your Event, on that role
        return;
      }
      open(card);
    });
    card.addEventListener("keydown", (e) => {
      if (!card.classList.contains("is-open") && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(card); }
    });
  });
  document.addEventListener("keydown", (e) => {
    if (panel.hidden) return;
    if (e.key === "Escape" && openCard) close();
    else if (!openCard && e.key === "ArrowRight") next();
    else if (!openCard && e.key === "ArrowLeft") shift(-1);
  });

  // leaving the tab puts everything back the way it was
  new MutationObserver(() => {
    if (!panel.hidden) { place(true); return; } // (the cards can only be measured once the tab is showing)
    if (openCard) { gsap.killTweensOf(openCard); close(true); busy = false; }
  }).observe(panel, { attributes: true, attributeFilter: ["hidden"] });
}
