# PeanutButterJelly.fun: Session Summary (for starting a new chat)

Read this first in a new chat, then `CLAUDE.md`, `PLAN.md` and `INSPIRATION.md`.

## Who and what
- Owner: non-technical founder. Explain things in plain language, small steps, commit progress.
- Site: PeanutButterJelly.fun, "Mining Hidden Gems Around You", Mumbai, playful PB&J brand.
- Desktop-first, but the phone version must look great too. We launch only when both are ready.
- Pushing: the owner pushes via GitHub Desktop ("Push origin"). Terminal pushes fail on the GitHub login.

## What exists now (all committed on `main`)
- **Six folder tabs** (Home, Events, About, List Your Event, Be Our Partner, Our Secret): CSS-only layered paper folders with grain. Phone: cascading bar, tap once to peek and again to open. `src/tabs.js`. Safari needs `-webkit-filter` (SVG filters on HTML are unsupported).
- **Loading intro** ("ooze the fun"): WebGL swirl shader plus a clip-path hole, GSAP timeline. The first swirl version was restored (commit eabc900). `src/intro.js`.
- **3D photo mascot** (`src/mascot.js`, `src/slab.js`): each photo (bread, jelly, peanut butter, bread) becomes a real extruded slab (traced alpha outline, bevel, wall texture, projection-mapped photo). It assembles on scroll (pinned, scrubbed), bounces springily when stacking and unstacking (both scroll directions), and spins 360°. The shadow was removed. Photos live in `public/mascot/`.
- **Smooth scroll:** Lenis on desktop, native touch on phones. `src/main.js`.
- **Typography (latest):** same style as noartmusic.com. Chivo Mono (free) for body text and labels, all caps and justified. Inter Tight is the free stand-in for their paid Neue Haas Grotesk headlines. Swap via `--display` in `src/style.css` if a licence is bought. Email inputs stay lowercase.
- Page background `#F9F9F7`. Colours and fonts are placeholders until the owner shares the final palette.

## How testing worked (browser pane limits)
- The preview pane pauses animation when hidden, so tests used `window.mascotDebug` (`tl.progress`, `draw(t, snap)`), canvas contact sheets, vertex penetration scans and frame-by-frame video analysis. The owner scrolls live and reports back.
- Dev server: `.claude/launch.json` entry "pbj-site" (Vite, port 5173).

## History of notable fixes
- Safari folder tabs: grain as background image; wider tab padding.
- Intro: clip-path sizing, scroll-restoration jump, premultiplied-alpha grey ring.
- Mascot: flat-looking spin led to 3D slabs; flicker and cut-outs fixed (gaps, size differences, tilt clearance, no `discard`, resize guard); wall texture streaks fixed with a `wallU` attribute; laggy reverse scroll fixed with a spring plus floor (OMEGA 13, restitution 0.35, MAX_STRAY 0.22).
- An earlier code-built mascot lives in git history (commit 0438a64).

## Open items and reminders
- The owner must push the unpushed commits through GitHub Desktop (latest: `0acc3e1` Typography).
- Before launch: write the engineer guide and label "version 1" (per PLAN.md).
- The logo is a placeholder (the mascot stands in).
- Check justified placeholder text on phones once real copy is in.
- Offered but not yet accepted: expose the dev server to the phone on the same Wi-Fi, or set up Vercel for a shareable preview link.
- Build checklist is in `PLAN.md` (Building Steps). Steps 1 (setup) and 2 (tabs) are done; the mascot and intro are in progress or done.
