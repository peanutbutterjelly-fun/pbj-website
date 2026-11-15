# PBJ Teaser Website — Plan

## The Goal
Build the skeleton of the full PeanutButterJelly.vip site (not a single page) so visitors get our vibe right away. Give them specific things to look forward to, so they stay excited instead of signing up and forgetting us. After signing up, people are pointed to our Instagram and told to watch for dates.

## Who It's For
**Guests:** 20–32-year-olds in Mumbai who spend ₹500–3,500 on a night out but find good small events only by luck.
- At launch: college students (18–23), young working people (24–32), couples (22–35), newcomers to Mumbai (moved here in the last 2 years)
- Later waves: serious hobby learners, parents (30–45, kids aged 4–12)

**Hosts and partners:**
- Paid hosts: solo teachers and artists, studios and small venues, clubs and groups, brands
- Free listings: everyday users with a spare ticket or a group plan (outside venues only, no home addresses)
- Partner program: venues (free repeating listings, "PBJ Partner" badge, we fill their quiet weekday slots) and brands (sponsor "PBJ Originals" nights, priced per event)

## The Site, Tab by Tab
Six folder tabs: **Home, Events, About, List Your Event, Meet Our Hosts, Know More.**
- Computers: tabs along the right edge; hovering shows the full label.
- Phones: tabs stacked close together at the top with part of each label showing. Tap to peek (the tab slides out to show its full label), tap again to open. Switching tabs feels like shuffling through folders.

**Home** (top to bottom)
1. Loading screen (first visit only): jelly-purple screen with "ooze the fun" swirls into a gooey hole like a jelly black hole, then the hero swirls back out of the hole
2. Hero: our mascot, front and centre, with a "Join the list" button
3. Short intro that spins into view as people scroll
4. What PBJ is all about
5. Pre-launch host lineup
6. Early perks
7. Email signup, then the Instagram link and "stay tuned for dates"

**Events:** "PBJ-approved events happening around you until we mine exclusive hidden gems for you."
- Curated picks from around Mumbai (not everything), filterable by neighbourhood, price (low to high), date and category
- Each event gets a PBJ-style card in our own words, using only photos we have permission for
- A "Go to event" button links out (to the host's own page or Instagram where possible), next to a "Get notified about events like this" signup
- On computers, the "Go to event" button follows the cursor over each event card (see "No Art shop cursor" in INSPIRATION.md); on phones it's a normal button on the card. Later, PBJ's own events get an "I AM IN" button that works the same way.
- We add events by hand through a simple form or spreadsheet (no code). Events hide themselves automatically once their date has passed.

**About:** the story behind PBJ and the founders' details.

**List Your Event:** who can list, a peek at "how to list" (design to be decided), a few rules (including outside venues only) and a host interest signup.

**Host sign-up and event form (new):** the host dashboard is only reachable after someone signs up and fills out the event form. On List Your Event, the button first asks them to sign up. Once signed up, they see a form to enter details about the event they want to list, plus the option to book a call with us if they're seriously considering becoming one of our pilot hosts. Only after that do they get into the dashboard.

**Meet Our Hosts:** an endless, draggable grid of 3D magazine covers, one per host. Tapping a cover grows it to the middle while the others drift away, then the magazine opens wide and people tap to flip its pages (cover, host profile, past events, current events, then teasers of future events; each host's page count varies). Built (blank) in `src/hosts.js` and `src/magazine.js`; the details and design come later. The partner-program pitch ("Be Our Partner") moves elsewhere for now.

**Know More (was Our Secret):** three cards stacked at the centre (For Hosts, For Brands, For Spontys). A small [next] button shuffles the card behind to the top; tapping a card widens it into a full page laid out like offlyn.life (hero, perks strip, numbered feature cards, how it works, FAQ, closing call to action). Built in `src/knowMore.js` and `src/knowMore.css`; the copy is placeholder (no fees or numbers promised). Buttons on the pages jump to List Your Event on the matching role.

## Must-Haves (all needed for launch)
- All six tabs working, with the folder effect on computers and phones
- Every page with the content above
- Working email signups, feeding two lists: **guests**, and **hosts and partners**
- The 3D sandwich mascot that builds itself as people scroll (needs a 3D artist, so find one early)
- Smooth scrolling on computers (Lenis); normal touch scrolling on phones
- The intro spinning in, line-by-line text effects and the folder-shuffle animation
- Works well on phones and loads fast on mobile data

## Where Email Signups Go
- **Home:** at the bottom, plus a "Join the list" button in the hero that jumps to it (guest list)
- **Events:** "Get notified about events like this" on each event card (guest list)
- **List Your Event:** host interest signup (hosts and partners list)
- **Our Secret:** a "reach out" contact button instead of a signup

## Building Steps
- [x] 1. Starting project (Vite, GSAP, Lenis, Three.js)
- [ ] 2. The six folder tabs (done as layered paper folders: curved shoulders, grain, soft shadows, open folder merges into the page; hover on computers, tap to peek / tap to open on phones)
- [ ] 3. Home page sections in order (placeholders in place)
- [ ] 4. The other five tabs
- [ ] 5. Effects: "ooze the fun" loading screen (first version done), intro spin-in, line-by-line text, uneven-gap text, cursor-following button
- [ ] 6. Events page: curated cards, filters, easy way to add events, old events hide automatically
- [ ] 7. Email signups (guests list; hosts and partners list)
- [ ] 8. Sandwich mascot (now built from the owner's four photos: bread, jelly, peanut butter, bread; a real 3D sandwich wrapped in the photos (each photo cut into a solid slab and projected back on), so it stays 3D from every side; same scroll animation as the earlier 3D version: layout, drops, camera follow and 360-degree spin; click to wobble)
- [ ] 9. Phone version rounds
- [ ] Before launch: write an engineer guide (how to run the site, what each file does, what's unfinished), label the "version 1" point in GitHub, and have an engineer review it (optional short check-in earlier, once the main pages are built)
- [ ] 10. Launch on PeanutButterJelly.vip (only when desktop and phone are both ready)

## Not Building Yet
- Spin-off Events section (later, once we've handpicked and organised our own events)
- Partner Hosts list with a profile page for each host (later, once we have partners on our roster; see "No Art Music Week artist page" in INSPIRATION.md)
- Buying tickets or paying on the site
- Guest accounts and logins (host sign-up for the dashboard is the only login for now)
- Curator program (3rd wave)
- Sections for hobby learners and parents (2nd and 3rd waves)
- AI helper to catch events cancelled before their date

## Spontys dashboard (built: first version)
Page `spontys.html` (`src/spontys.js`, `src/spontysScreens.js`, `src/spontys.css`), modelled on the Corner app (see INSPIRATION.md). Bottom bar: **For you** (feed with filter tags, invite card, what you missed, lists, top hosts), **Map** (coming soon), **Messages** (empty state), **Search** ("Ask FUN": emoji suggestion cards, then a hand-drawn Mumbai map with numbered pins, a chat sheet that shows its steps with a progress bar, big result cards, thumbs up/down, "more events we considered", "find more" and follow-up chips; all over the Events lineup), **Profile** (list tiles, Edit Profile with photo crop, Settings) and a round **+** menu (create a post works; lists and imports are "coming soon"). Events shown are the sample lineup in `src/eventsData.js`. Everything is kept in the browser until accounts and a database exist. **People and the thread:** `src/people.js` holds 15 made-up accounts (one badge each: PBJ Exclusive Host, Professional Host, Newbie Host, Sponty Planner, Here For The Vibes), their hosted and attended events and a thread of posts (event announcements, spontaneous plans with an "I'm in" button, recaps). The For you feed is that thread; every name opens a profile at `#/u/handle` with Follow, Hosted and Attended; people pick their own badge in Edit profile. Not linked from the website yet.

## Spontys Messages: host updates and group chats (built: first version)
Only hosts send official updates, for events you hold a ticket for. Buying a ticket opens that event's group chat (`frontend/src/chats.js` holds the rules, `frontend/src/spontysChats.js` the screens). An update lands in the chat the moment it is posted. A logged-in member also sees it as an "Updates for you" card on For you, a badge on the bell and a dot on the Messages icon; a guest buyer gets it at the email or number saved in the browser when they bought (the "outbox", for a backend job to send). On the For you thread, "I'm in" on a sponty plan is a request: once the planner accepts, you are added to the plan's group chat with the others going. Stand-ins until the backend exists: everything is kept in the browser, the planner's Accept is automatic after a few seconds (`DEMO_AUTO_ACCEPT`), and no email or text is actually sent. Next: a "Send update" button for hosts in the host dashboard, the planner's Accept list, and the guest contact form on the public ticket page.
Update: group chats are read-only for everyone except the host (or sponty planner). The host or planner can send one optional quick question at a time (2 to 4 tap-to-answer options and, if they allow it, a short note); everyone sees the counts after answering, names and notes stay with the asker. Members can also send one short private "last-minute doubt" (160 characters, 3 per chat) that only the host or planner sees; they answer the group with an update marked "answering questions from the group". Letting members write in plan chats was tried and removed for now.
Host and planner screen (built, demo view): `#/manage` lists the chats you run; `#/manage/<chat>` (`frontend/src/chatConsole.js`) lets a host or sponty planner send an update, read members' last-minute doubts (with names), tick the ones an update answers and post it, set a doubt aside, send one quick question (2 to 4 options, optional note), watch the counts and notes, and close it. It currently opens any chat in the browser; once accounts exist it should only list the chats you host or plan. Next: put the same screen in the host dashboard, and make members' doubts and answers arrive from the backend.
