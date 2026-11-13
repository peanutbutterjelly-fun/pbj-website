# PeanutButterJelly.vip — Project Notes

## Brand
- **Name:** PeanutButterJelly.vip (short form: PB&J)
- **Tagline:** "Mining Hidden Gems Around You"
- **Audience & place:** Built for Mumbai. Content, examples, and copy should feel local to Mumbai.

## Look & Feel
- **Style:** Playful and bouncy. Rounded corners, soft shadows, gentle bounce/wiggle animations on buttons and cards. Friendly, fun, never corporate.
- **Colors (PB&J sandwich palette, placeholders until the owner shares the final palette):**
  - Peanut butter: warm tan/caramel (e.g. `#C68B3E`)
  - Jelly: grape purple (e.g. `#6B2D5C`) and strawberry red (e.g. `#D7263D`)
  - **Chosen palette: Deep Jam (light):** cream background `#F8F8F0`, text `#463721`, bread/primary `#FFE386`, optional pop `#F0A830`, crust `#8A4B1E`, jam/secondary `#C2184F`, accent `#463721`. Applied in `frontend/src/style.css`. **Locked pair, we switch between them:** Dark = background `#463721`, text `#F8F8F0`, jam `#C2184F` (bread, crust and pop unchanged). Dark is applied by setting `data-theme="dark"` on `<html>`; light is the default. Preview at `frontend/palettes.html`.
  - Bread: soft cream (e.g. `#FFF4DC`) for cards and accents
  - Crust: toasted brown (e.g. `#8B5A2B`) for text and outlines
- **Typography (copied exactly from noartmusic.com):** Chivo Mono 400 for text and labels (no letter-spacing, line-height 1.2, all caps, justified paragraphs), headlines 700 with a fixed -1.44px letter-spacing and line-height 1, left-aligned. All sizes are multiples of one unit `--u` that scales with screen width (computers: width/90, tablets: width/52.125, phones: width/23.4375): text 0.75em, headlines 3em (2em on tablets and phones). Their headline font is Neue Haas Grotesk (paid, cannot be copied), so we use Helvetica Neue where installed, then Inter Tight. If a licence is bought, swap it in (`--display` in `frontend/src/style.css`).
- Keep text readable: dark text on light backgrounds, good contrast.
- Respect users who turn off motion (reduce animations when "reduced motion" is on).

## Build Priorities
- **Desktop-first:** Design for computers first, then adapt for tablets and phones. The phone version must still work and look great: we only launch when both desktop and phone versions are ready.
- Keep pages fast and light — many visitors will be on mobile data.
- Large, easy-to-tap buttons.

## Folders
- `frontend/`: the website (Vite). Pages, `src/`, `public/`, `scripts/`, `film/` (videos) and `lab/` (local experiments). Run npm commands from inside `frontend/`.
- `backend/`: the server (Python, FastAPI). Just a starter for now. See `backend/README.md`.
- Top folder: shared notes (`PLAN.md`, `INSPIRATION.md`, `inspiration/`), GitHub setup (`.github/`) and git hooks.

## Plan
- Follow `PLAN.md` for what we're building, in what order, and what we're not building yet.

## Git and pull requests
- Follow `AGENTS.md`: squash-merge only, `type(scope): summary` titles with a summary of 5 words at most, commit messages of 2 lines at most, and its PR description format with before/after screenshots.

@AGENTS.md

## Inspiration
- Check `INSPIRATION.md` (and screenshots in `inspiration/`) whenever we build something new.

## Working With the Owner
- The owner is not technical. Explain changes in plain language and avoid jargon.

# Motion studio rules
(These apply to videos and films only, not to the website's own bouncy animations.)

## Render contract
- Every film is a pure function of time: window.seek(t) paints frame t.
- No CSS transitions, no setTimeout, no requestAnimationFrame in render mode,
  no state carried between frames. Seeded noise only, never Math.random.
- Render with node render.mjs (from inside `frontend/`). Encode H.264 yuv420p, CRF 16.

## Look
- Banned: centered title on a gradient, everything fading in,
  corner labels and frame borders, glow on UI, generic particle bursts.
- One display font, one UI font. One accent color unless the brief says otherwise.
- Every 2 to 4 seconds something new must happen on screen.

## Sound
- Music and sound effects are synthesized in code unless a track is supplied.
- Place hits on the measured beat grid (beats.json). Loudness -14 LUFS.

## Loop before you show me anything
1. Render one frame per beat as a contact sheet and LOOK at it.
2. Score it 1-10 on: hook in first 2s, readability at phone size,
   motion quality, variety, brand accuracy, sound sync.
3. Fix the 3 worst problems. Repeat until every score is 8+.
4. Only then do the full render.

## Effort and usage
- Default to medium effort for small fixes and re-renders; xhigh for new videos; max only when the first 3 seconds must carry a big launch.
- Before using high, xhigh or max, ask the owner first with a rough usage estimate and how much plan limit is left.
