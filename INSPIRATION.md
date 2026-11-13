# Inspiration

Design ideas for PeanutButterJelly.vip, grouped by section of the site.
Screenshots go in the `inspiration/` folder.

To add an idea, copy the template below into the right section and fill it in.

```
### Idea name
- **Link:**
- **What I like:**
- **Where I'd use it:**
- **Screenshot:** inspiration/
```

---

## Hero
_The first thing people see at the top of the homepage._

### Cabi Foods hero
- **Link:** https://hero.gallery/hero-gallery/cabi-foods
- **What I like:** The folder effect on the right side: the menu (Home, Shop, For Us, Recipes) sits along the right edge as vertical tabs, like the dividers in a folder.
- **Where I'd use it:** In the hero.
- **Screenshot:** inspiration/
- **Phone version:** Same folder effect, but with the tabs along the top of the screen. Tapping a tab feels like shuffling through folders: that tab's page comes to the front.

### No Art page load
- **Link:** https://www.awwwards.com/inspiration/no-art-page-load-no-art
- **What I like:** The way the hero loads in (about 9 seconds in the video):
  1. A black screen with a tiny line of loading text in the centre.
  2. The screen turns white and a tiny picture appears in the middle, framed by small corner marks like a camera viewfinder.
  3. The picture grows from that small box until it fills the whole screen.
  4. Full-screen photos and video of their events flick past, with the hand-drawn logo in the middle inside the viewfinder marks.
- **Where I'd use it:** When our site first opens, with the loading text **"ooze the fun"**. The small framed picture grows to fill the screen and reveals the hero and mascot. We can swap black and white for our PB&J colours.
- **Screenshot:** inspiration/
- **To plan for:** Keep it short (a second or two) so people on mobile data aren't kept waiting, and ideally show it only on the first visit, not every time someone switches tabs.

## Animations
_Bounces, wiggles, hover effects, page transitions._

### Horizontal Text demo
- **Link:** https://demos.gsap.com/demo/horizontal-text
- **Code:** https://codepen.io/GreenSock/pen/MYyBrZw (uses GSAP's ScrollTrigger and SplitText)
- **What I like:** Big text slides sideways as I scroll down, and the letters animate individually as they move.
- **Where I'd use it:** Not decided yet. Probably for the tagline, "Mining Hidden Gems Around You", but nothing is fixed on where else it might go.
- **Screenshot:** inspiration/

### No Art shop "shop now" cursor
- **Link:** https://www.noartmusic.com/products
- **What I like:** When the mouse moves over a product, a small "shop now" label follows the cursor around.
- **Where I'd use it:** On the Events page, the button follows the cursor over each event card:
  - **"Go to event"** for curated events that link out to other platforms (from launch)
  - **"I AM IN"** for PBJ's own events (later, once we have them)
- **Screenshot:** inspiration/
- **Phone version:** Phones have no cursor, so on phones the button sits on each event card as a normal button.

### Flip Carousel demo (the "caterpillar")
- **Link:** https://demos.gsap.com/demo/flip-carousel
- **Code:** https://codepen.io/GreenSock/pen/eYwbjdz (uses GSAP's Flip plugin)
- **What I like:** A line of cards that moves like a caterpillar. On "Next", the first card shrinks away into its bottom-left corner, all the others glide one place to the left, and a new card grows in at the end from its bottom-right corner. "Previous" does it the other way round.
- **Where I'd use it:** On the Events page, on the brown belt where the event cards are lined up. Built in `src/events.js` (the arrows, or a swipe, move the belt).
- **Screenshot:** none (it's an animation, nothing to see in a still)
- **To plan for:** The belt always shows the same number of cards (5 on computers); on tablets and phones the extra cards are hidden off the edge. When we have real events, the cards that grow in will be the next real events in the list.

### Flexbox Filtering demo
- **Link:** https://demos.gsap.com/demo/flexbox-filtering
- **Code:** https://codepen.io/GreenSock/pen/NWRxarv (uses GSAP's Flip plugin)
- **What I like:** When you switch a filter, nothing just pops. The boxes that still match glide smoothly to their new places, the ones that don't match shrink and fade away, and any that come back grow in, one after another.
- **Where I'd use it:** On the Events page, when someone uses the filters (sort, day, month, area, price) or the category line: the event cards glide into place, shrink away or grow in. Built in `src/events.js`.
- **Screenshot:** none (it's an animation, nothing to see in a still)
- **To plan for:** While the cards fly about, the space under the grid is held in place so the page below doesn't jump. With "reduce motion" switched on, the cards just swap.

## Scrolling
_What happens as people scroll down the page._

### Lenis: Smooth Scroll
- **Link:** https://github.com/darkroomengineering/lenis
- **Demo:** https://lenis.darkroom.engineering
- **What I like:** The whole smooth scroll effect.
- **Where I'd use it:** Everywhere, across the whole website and web app.
- **Screenshot:** inspiration/
- **Notes:** Works together with GSAP's ScrollTrigger, so it can be the smooth scroll that the other scroll ideas (line splits, horizontal text, the sandwich mascot) play on top of.
- **Decision:** Smooth scroll on computers only. On phones, leave the phone's normal touch scrolling alone (this is Lenis's default). Scroll animations still play on phones.

### Responsive Line Splits on Scroll demo
- **Link:** https://demos.gsap.com/demo/responsive-line-splits-on-scroll
- **Code:** https://codepen.io/GreenSock/pen/GggpRoB (uses GSAP's ScrollTrigger and SplitText)
- **What I like:** Clean, desktop-sized text for key info, trends, etc., shown between the smooth-scrolling parts of the site.
- **Where I'd use it:** On one or more pages, as part of the smooth scroll effect.
- **Screenshot:** inspiration/

#### How it would work
1. We write short, punchy text blocks for key info, like a trend or a hidden-gem fact about Mumbai.
2. As people scroll, each block appears line by line, with each line sliding or fading in smoothly.
3. The text resizes and re-arranges its lines to fit the screen, so it still looks clean on phones, not just desktops.

**To plan for:** Keep these text moments short (one to three sentences) so they're quick to read on a phone, and space them out between other sections so they feel special.

### Stagger Items In on Scroll demo
- **Link:** https://demos.gsap.com/demo/stagger-items-in-on-scroll
- **Code:** https://codepen.io/GreenSock/pen/NWGPxGZ (uses GSAP's ScrollTrigger)
- **What I like:** It shows many things neatly lined up, appearing one after another as I scroll.
- **Where I'd use it:** The "Spin-off Events" section showing all the events we've done so far. This probably comes later, once we have a few successful events under our belt.
- **Screenshot:** inspiration/

### 197 Historias Ilustradas grid scroll
- **Link:** https://www.awwwards.com/inspiration/grid-scroll-197-historias-ilustradas
- **What I like:** The grid scroll effect: each illustrated story card in the grid looks clean and focused.
- **Where I'd use it:** As an option for the "Spin-off Events" / Successful Events section (alternative to the Stagger Items idea above).
- **Click transition:** https://www.awwwards.com/inspiration/grid-transition-197-historias-ilustradas — when someone taps a card in the grid, this is how it opens into that event's full story.
- **End of story:** https://www.awwwards.com/inspiration/story-fade-197-historias-ilustradas — when someone scrolls to the end of an event's full story, a lineup of the next stories appears below and the story above fades out.
- **Screenshot:** inspiration/

### Shader on Scroll demo
- **Link:** https://demos.gsap.com/demo/shader-on-scroll
- **Code:** https://codepen.io/GreenSock/pen/EaVbXeM (uses GSAP's ScrollTrigger and Three.js)
- **What I like:** The trippy scroll effect: the picture warps and distorts as you scroll, and the faster you scroll, the stronger it gets.
- **Where I'd use it:** The Events section, on the event photos, as the trippy scroll effect (alternative or addition to the grid ideas above).
- **Screenshot:** inspiration/

#### How it would work
1. Each event photo is drawn on a small graphics canvas (WebGL) instead of a normal image.
2. A "shader" (a tiny program that bends the picture) warps it, driven by how fast the person is scrolling.
3. When scrolling stops, the picture settles back to normal.

**To plan for:** Needs a graphics library (Three.js) which adds weight on mobile data, so use it on a few images only and load it only when the section is near. Turn the warp off for people with "reduced motion" on, and fall back to plain images if their phone can't run it.

### Dynamic Morphing demo
- **Link:** https://demos.gsap.com/demo/dynamic-morphing
- **Code:** https://codepen.io/GreenSock/pen/qBedXpg (uses GSAP's MorphSVG plugin)
- **What I like:** Shapes that melt and change into other shapes, used as a page transition.
- **Where I'd use it:** Page transitions between pages of the site, with a blobby shape (jelly or peanut butter) that morphs across the screen and reveals the next page.
- **Screenshot:** inspiration/

**Tried and set aside (for now):** We built the wavy-sheet version for switching folders (bread and jam sheets rise up, cover the page, then sweep off the top). It worked, but we went back to the folder-slide animation. Easy to bring back: the demo is just wavy shapes (no paid plugin), about a second long.

**To plan for:** Shapes are lightweight, so this is easy on mobile data. Keep the transition quick so it never slows people down, and skip the morph for people with "reduced motion" on (a simple fade instead). Note: I couldn't see the demo run, so this is based on its title and tags.

### GSAP Observer (swipe, touch and scroll input)
- **Link:** https://cdn.jsdelivr.net/npm/gsap@3.15/dist/Observer.min.js
- **What it is:** A small GSAP tool that notices swipes, drags, scrolls and touches in one tidy way. Already included with the GSAP we have installed, so nothing extra to download.
- **Where I'd use it (in use):** Moving between folders by scrolling. Scroll past the end of a folder and the next one opens; scroll up past the top and the previous one opens (you land at the end of it).
- **Meet Our Hosts folder:** The page itself never scrolls, so plain scrolling changes folder there too. On computers and laptops, hold Shift and scroll to move the loop of magazines (hint at the bottom: "[Shift and scroll]"). On phones, one finger drags the magazines and three fingers change folder ("[Use three fingers to scroll]").
- **Screenshot:** none (it's a tool, nothing to see)

**To plan for:** It takes a deliberate extra scroll past the end so it never opens by accident, and the last folder has no next one.

## Email signup
_Forms and boxes where people join the mailing list._

## Mascot
_Characters, illustrations, and personality._

### Image Sequence demo
- **Link:** https://demos.gsap.com/demo/image-sequence
- **Code:** https://codepen.io/GreenSock/pen/VwgevYW (uses GSAP's ScrollTrigger)
- **What I like:** The image lights up and looks like a scene from a commercial.
- **Where I'd use it:** For my mascot: a 3D PB&J sandwich that builds itself as people scroll (not interactive, just scroll-driven).
- **Screenshot:** inspiration/

#### How it would work
1. Someone creates the sandwich-assembly scene in a 3D design program: bread lands, peanut butter spreads, jelly drops, the top slice closes. We could hire a 3D artist or look for ready-made models.
2. The scene is saved as a series of still pictures, often around 100 to 150.
3. On the site, scrolling flips through those pictures, so the sandwich builds as people scroll down and comes apart as they scroll back up.

**To plan for:** That many pictures can be heavy on mobile data. Keep them small and fast to load, and maybe use fewer frames on phones.

## Other
_Anything that doesn't fit above._

### No Art "About" text style (uneven gaps)
- **Link:** https://www.noartmusic.com (About section)
- **What I like:** The uneven gaps between words. Each line is stretched to fill the full width, so the spaces between words grow and shrink (this is called "justified" text). A big, bold headline sits on the left, and smaller all-caps typewriter-style text on the right.
- **Where I'd use it:** On the texts where I say so (not everywhere).
- **Screenshot:** inspiration/other-no-art-justified-text.webp
- **To plan for:** On narrow phone screens, lines with only a few words can get very large gaps. The phone version will take a few rounds of trying and adjusting until each spot reads well.

### No Art Music Week artist page
- **Link:** https://www.noartmusicweek.com/artists/itz3bby
- **What it looks like:** Each artist gets a profile: a big bold name, a large photo, the event they're playing (with date), and buttons to their Instagram and SoundCloud. Below it, a "Discover more artists" list shows everyone else on the lineup.
- **Where I'd use it:** Our list of Partner Hosts under PBJ, once we have them on our roster. Each host gets a profile like this (photo, name, their upcoming PBJ event, links to their Instagram or website), with "Discover more hosts" below.
- **Screenshot:** inspiration/

## GSAP "Layered pinning with infinite looping" (codepen.io/GreenSock/pen/VwbywPd), with ScrollTrigger pinning and ScrollTrigger.maxScroll()
- **Where I'd use it:** The List Your Event page: six full-screen sections, each pinned at the top while the next slides up over it like cards on a pile. The page snaps to the nearest section. The page does not loop: the last section (a typewriter line) is the end, and scrolling on opens the next folder. (`ScrollTrigger.maxScroll()` finds the end for the snapping.) The "Your events" button sits on the last section so it is never lost. Built in `src/events.js` (`setupLoop`).
- **To plan for:** The sections' wording and colours are placeholders until final.

## GSAP "Animated Continuous Sections with GSAP Observer" (codepen.io/GreenSock/pen/XWzRraJ)
- **Where I'd use it:** The List Your Event page (tried and set aside for now; the "Layered pinning" version above is the one in use. To try this one again, set `LOOP_MODE` to `"observer"` in `src/events.js`). The page itself does not scroll: each scroll gesture wipes the next section in like a curtain (the colour slides one way while its content slides the other), the old colour drifts away, and the new letters fly up in random order. The last section types itself out. After the last section, scrolling on opens the next folder; scrolling up from the first opens the previous one.
- **To plan for:** Uses GSAP's Observer plugin (no ScrollTrigger). The sections' wording and colours are placeholders until final.

- **List Your Event on phones:** same pile-of-cards look, but swipe-driven: the page itself does not scroll on phones (native scrolling with pinned layers glitches on touch screens). One swipe slides the next section up over the last (a swipe the other way slides the top one away); built with GSAP's Observer in `src/events.js` (`setupObserverLoop`, "layered"). Computers keep the ScrollTrigger pinning.

- **List Your Event on computers (update):** the sections are still pinned by ScrollTrigger, but one scroll gesture now glides exactly one section (an eased move of the page, driven by us, not by the wheel), so a hard flick or a trackpad's coasting can never skip a section. `ScrollTrigger.maxScroll()` marks the end of the page; scrolling on past it opens the next folder.

- **List Your Event, final (computers and phones):** both now use the same swipe/scroll-driven version: the page itself never scrolls, and one gesture slides the next section up over the last (and back). The ScrollTrigger pinning version is still in `src/events.js`; set `LOOP_MODE` to `"pinned"` there to use it again.

## "Know more" website box (List Your Event, slides 2 to 7)
- **What it is:** a "Know more" button under each in-between slide's title opens a small window (a tiny notepad look, in our own colours: rounded cream body, crust-brown title bar, thin edge, no shadow). It grows out of the button, types the slide's text, then asks a paper-cut question (Is this you? etc.) with Yes / No / Maybe; Yes brings a reply, a note and two buttons (sign up / fill the form). Buttons copy the NEXT button look (soft yellow, rounded, hard brown shadow).
- **Rules the owner set:** never on the first or last slide; the typed text can't be backspaced (only the visitor's own lines can); it opens centred with equal space above and below and never covers the three top options; menus, toolbar and fonts work but start tucked away.
- **Earlier idea, switched off:** the cream block-dissolve and the two-piece "rip here" ticket (code kept dormant in src/events.js as setupTickets).
