# PB&J Launch Map: what exists, how it all links, what is missing

Written for the owner (plain language). It lists every feature we have built so far as a real thing a visitor will use, how the three "rooms" connect at launch, what is still missing, and how we would build it.

**Status words used below**
- **BUILT**: looks and works as designed; only needs real data behind it.
- **DEMO**: works on screen, but only inside one browser with made-up data (nothing is saved on a server, nobody else can see it).
- **NOT BUILT**: does not exist yet.

---

## 1. The big picture: three rooms, one account

| Room | Who it is for | Where it lives today | What it is for |
|---|---|---|---|
| **The website** | Anyone | `frontend/index.html` (six folder tabs) | Tell people what PB&J is, show events, recruit hosts and brands, collect sign-ups |
| **The Spontys app** ("For you", Messages, Search, Profile) | People who go to things (members) and sponty planners | `frontend/spontys.html` | Discover events and plans, react, get tickets, join group chats, build a profile |
| **The host dashboard** | People who run events | `frontend/dashboard.html` (+ `frontend/event.html`, the public page of an event) | List an event, manage it, run its chat, see sales |

**"For you" is not a dashboard.** It is the home feed of the Spontys app: a stream of posts from hosts and planners, PB&J highlights, lists and people to follow. The **host dashboard** is a separate workspace for people who create events. The two meet in the middle: what a host publishes in the dashboard is what members see in For you, Events and Search.

**One person, one account.** At launch a person logs in once. They are a member by default (badge "Here For The Vibes"). They can also be a sponty planner or a host, and then they see an extra "Host" entry (a switch between "Spontys" and "Host" at the top). Someone who only buys one ticket as a guest does not need an account (see section 4).

---

## 2. How everything links (the journeys)

### A. A member goes to an event
1. Finds it: For you, Events tab, Search ("Ask FUN"), a friend's post, a shared link.
2. Opens the **event page** (details, host, photos, who is interested). Reacts Love / Like / Curious (it lands on their profile lists).
3. **Gets a ticket** (free RSVP first, paid later). A **group chat opens** for that event.
4. The **host posts updates** in the chat. They arrive instantly in Messages, as an "Updates for you" card on For you, and as a badge on the bell. A last-minute doubt goes privately to the host; the host answers everyone in one update.
5. After the event: "Did you go?" then **I went** with a mood and a note. It lands on their profile under **Attended**.

### B. A host runs an event
1. Signs up as a host (List Your Event tab) then opens the **dashboard**.
2. Creates the event (8 steps), publishes it. It appears on the **Events tab**, in **For you**, in **Search** and on its own **public event page**.
3. People get tickets. The dashboard shows sales. Each ticket holder is in the event's **group chat**.
4. The host opens **Run a chat** (inside the dashboard) to send updates, quick questions and answer doubts.
5. After: writes a recap with photos. It lands on their profile under **Hosted**.

### C. A sponty planner runs a plan
1. Posts a plan (title, when, where, spots). It shows in the For you thread.
2. A member taps **I'm in**. This is only a request.
3. The planner accepts. The member is added to the plan's **group chat** with the others going. The planner can post updates and one quick question at a time.
4. After: the plan can become an Attended / Hosted entry.

### D. A guest buys without an account
1. Opens a public event page from a link, buys a ticket with an email and phone number.
2. Updates arrive by **email or text** to those details (the "outbox").
3. After purchase we invite them to create an account; their tickets and chat attach automatically by matching the email or number.

### E. The "everything links" rule
Every thing has **one page with a stable address**, and every other screen links to it: an event is always `/e/<name>`, a person is `/u/<handle>`, a chat is `/chat/<id>`. A post, a notification, a search result and a calendar invite all point at the same address.

### Planned addresses at launch
| Address | What |
|---|---|
| `/` | Website (six tabs) |
| `/e/<name>` | Public event page (shareable, works without login) |
| `/app` | Spontys app (For you, Search, Messages, Profile) |
| `/app/u/<handle>` | A person's profile |
| `/app/chat/<id>` | A group chat |
| `/host` | Host dashboard |
| `/host/run/<id>` | Run a chat (host and planner screen) |
| `/login` | Log in / sign up |

---

## 3. Feature inventory: what we have, in plain terms

### The website
| Feature | What users do | Status | To make it real |
|---|---|---|---|
| Home (loading screen, 3D sandwich, intro, sign-up) | Look, scroll, join the list | BUILT | Email sign-up needs the Supabase keys switched on |
| Events tab | Browse hand-picked events, filter, "Go to event", "Get notified" | DEMO (sample events typed into `eventsData.js`) | Read published events from the database instead |
| About | Read the story | BUILT | Final text and founder details |
| List Your Event (slides, "Know more" windows) | Learn, sign up, fill a form | BUILT (saves to Supabase once keys are set) | Switch the keys on; connect "Sign up" to real login |
| Meet Our Hosts (3D magazines) | Browse host covers | NOT BUILT (blank covers) | Needs real host profiles |
| Know More (hosts / brands / spontys) | Read three pitch pages | BUILT (placeholder copy) | Final copy, no numbers promised |
| Top bar (Who are you, Choose your city) | Pick a role and city | DEMO (remembers in the browser) | Tie to the account and city list |

### The host dashboard
| Feature | Status | To make it real |
|---|---|---|
| My events list (statuses, tickets, search, duplicate, delete) | DEMO (kept in the browser) | Store in the database, per host |
| Create event, 8 steps (type, basic info, details, schedule, tickets, partners, organizer, review) | DEMO | Same; plus image upload to storage |
| Event types (Sponty, Exclusive, Non-exclusive) and rules (Sponty = free tickets only) | BUILT | Commission and payout terms still "to be set" |
| Coupons, sales, graphs, visitor map | DEMO (empty or made-up numbers) | Real orders and visits |
| Public event page | DEMO | Real page per event with a shareable address |
| Run a chat (updates, doubts, quick questions) | DEMO, **not yet inside the dashboard** | Put it in the dashboard; real chats |

### The Spontys app
| Feature | What users do | Status | To make it real |
|---|---|---|---|
| For you thread | Read posts from hosts and planners, follow people | DEMO (made-up people and posts) | Real posts, a ranking order |
| What you missed (PB&J highlights) | Swipe through highlighted events | DEMO | Staff pick highlights in an admin screen |
| Friends tab | PB&J is the first friend; follow people to fill it | DEMO | Real follows |
| Love / Like / Curious | React on any event; files it into Favorites / Recommend / Want to go | DEMO | Store reactions per account |
| Search, "Ask FUN" | Ask in words; finds events, then your picks; asks before stepping outside | DEMO (word matching; "step out" not connected) | Real search over real events; a server that talks to Claude |
| City picker (India) | Choose a city | BUILT (only Mumbai live) | Add cities as you launch them |
| Messages: group chats | Read host updates, answer quick questions, send a private doubt | DEMO | Realtime chat in the database |
| Get ticket / Reserve | Opens the event's chat | DEMO (no payment) | Real tickets (free first, paid later) |
| Plans: "I'm in" then accept | Request, then join the plan's chat | DEMO (auto-accepts after 6 s) | Planner's accept list |
| Profile (bread-slice photo, crop, tiles, tabs: Posts / Hosted / Attended) | Edit, share, build a profile | DEMO | Store in the database |
| "I went" and host recap with photos | Mark attended, write up a hosted event | DEMO | Photo storage, moderation |
| Badges (five, self-picked) | Show who you are | DEMO | Verify the three host badges (see section 4) |
| Settings (privacy, notifications, delete account) | Switches, sign out, delete | DEMO | Real preferences, real deletion |
| + menu | Create a post (works), lists, imports | Mostly NOT BUILT | Build create-list and imports |
| Map | Map of events | NOT BUILT (removed from the bar) | Real map with pins |

---

## 4. What is missing (and what has to be built)

Ordered by how much of the rest depends on it.

### 1. Accounts and identity (everything depends on this)
- **Sign up and log in**: email code, Google, and phone code (most India users prefer phone). The org repo's server already checks Supabase login tokens, so this is mostly switching it on in the website.
- **Profiles table** (name, handle, photo, city, badge, role) so a profile is the same on every device.
- **Roles**: member, sponty planner, host (with a switch). Host and planner screens only open for the person who runs the chat.
- **Guest to account**: attach a guest's tickets when they sign up with the same email or number.
- **Privacy and deletion** (Digital Personal Data Protection Act): consent text, download my data, delete my account.

### 2. A real database instead of "this browser only"
Today almost everything is kept in the browser. At launch these live in the database (Supabase), each with the right person's name on it: profiles, events, ticket types, orders and tickets, plans and plan requests, follows, reactions and saved lists, attended and hosted recaps, group chats and members, messages, questions and answers, doubts, notifications, the email/text outbox, leads.
- **How:** write the tables as migrations (the org repo has a migrations folder and a check for them), add server routes for each, and replace the browser storage in the front end one feature at a time. Row-level rules so nobody reads another person's private doubt or notes.

### 3. Tickets, then payments
- **Phase 1 (recommended first): free RSVP and guest-list tickets.** Fast, no money risk; proves chats and updates.
- **Phase 2: paid tickets.** A payment provider for India (Razorpay or Cashfree), orders, receipts with GST, **QR tickets**, **check-in at the door** (a scan page for hosts), refunds and cancellations, coupons.
- **Payouts to hosts**: commission, settlement schedule, tax handling. The plan lists "buying tickets" under Not Building Yet; this is a decision for you (see section 6).

### 4. Notifications that actually arrive
- **In the app**: realtime (Supabase Realtime) so a host's update appears the second it is sent.
- **Email**: a mail service (for example Resend or SES).
- **Text / WhatsApp** for guests: a provider (MSG91 or Gupshup). **India needs sender registration (DLT) for texts and approved templates for WhatsApp, which takes time. Start this early.**
- **Push** to phones once the app is installable (web app / PWA).
- A **preferences** screen already exists; it then controls real sending. A "stop" rule per chat.

### 5. Host and planner tools (the missing half of the chats)
- **Host dashboard**: put **Run a chat** inside the dashboard, an **attendee list**, **check-in**, **send update to all ticket holders** that also sends email/text to guests.
- **Automatic messages**: when a host edits the time, place or cancels, a system message goes to the chat and an email/text goes out.
- **Planner tools**: **create a plan** (there is no screen for this yet), accept or decline requests, spots left and a waiting list, cancel a plan.
- **Chat lifetime**: close each chat some days after the event (suggest 7) and keep it read-only.

### 6. Trust and safety (needed before strangers meet)
- **Verify hosts** for the badges (PBJ Exclusive, Professional): today people pick their own badge. Needs a PB&J approval step.
- **Sponty plans meet strangers**: public venues only, a safety page, a "report" button on every post, chat and person, **block** and **mute**, and a way for PB&J to remove content.
- **Age rule** (for example 18+), spam and rate limits, house rules.
- **Legal pages**: terms, privacy policy, refund policy, community guidelines, contact. (Settings has "Legal" but it only shows "coming soon".)

### 7. FUN, the assistant, made real
- A small **server route** that calls Claude with web search, with the secret key kept on the server, a monthly cost cap, rate limits and an "outside PB&J" label on results. The plan is written in the chat; the switch is `VITE_ASSISTANT_URL` (in `frontend/.env.example`).
- Make it learn from Love / Like / Curious picks (with the person's consent).
- **Real search** over real events (a search index in the database), not only word matching.

### 8. PB&J's own admin screen (you will need this)
- Approve events and hosts; choose the **PB&J highlights** shown in "What you missed" and the **Lists for you**; read leads and reports; send a broadcast; hide or remove anything.

### 9. The public event page and sharing
- A real page per event at `/e/<name>` that works without login, with a preview card when shared on WhatsApp or Instagram, **add to calendar**, map link, and "more like this".

### 10. Smaller features still marked "soon"
Map, create a list, collaborative lists, import from Instagram / YouTube / Google Maps, comments on posts, notifications screen, "Meet Our Hosts" magazine pages.

### 11. Launch plumbing
- **Hosting**: website on a static host (for example Vercel), server on Railway (already set up in the org repo), database on Supabase; staging and live versions; the domain.
- **Quality**: tests for the rules that matter (who can read what, who can post), error reporting, backups, performance on mobile data, accessibility check on phone.
- **Engineer review and "version 1" label**, as already written in `PLAN.md`.

---

## 5. How we would build it: suggested order

| Phase | What | Why this order |
|---|---|---|
| **0. Decisions** | Answer the questions in section 6 | Avoid rebuilding |
| **1. Accounts + real data** | Login, profiles, events in the database; host publishes and it shows on Events, For you and Search | Everything else needs it |
| **2. Free tickets + chats + notifications** | RSVP, group chat per event, host updates, in-app + email | Proves the whole loop with no payment risk |
| **3. Sponty plans** | Create a plan, requests, accept, plan chat, safety basics | Your unique feature |
| **4. Host dashboard completion** | Run a chat in the dashboard, attendees, check-in, auto messages | Hosts need it to trust the product |
| **5. Payments** | Paid tickets, QR check-in, receipts, payouts | Only after Phases 1 to 4 work |
| **6. FUN + search + admin** | Real assistant, search index, PB&J admin screen | Makes discovery good |
| **7. Launch hardening** | Legal pages, safety, tests, speed, review, soft launch in Mumbai | Required before the public |

A **soft launch** (one city, invited hosts, free events) can happen after Phase 4.

---

## 6. Decisions only you can make
1. **Payments at launch or later?** (We suggest free tickets first.)
2. **Login methods**: phone code, email, Google? (We suggest phone + Google.)
3. **How guests get updates**: email only, or also text / WhatsApp (needs registration, costs per message)?
4. **Who verifies host badges**: PB&J approves each host?
5. **Commission and payout terms** for hosts (currently "to be set").
6. **Rules for sponty plans**: age limit, public venues only, can anyone plan, or only approved planners?
7. **Chat life**: how many days after the event do chats close (we suggest 7)?
8. **Who can see who went**: public on profiles, friends only, or private by default?
9. **Cities**: Mumbai only at launch, which next?
10. **Budget for running costs**: the assistant and any texts cost money per use. Set a monthly cap.

---

## 7. What is "demo" today and should not be shown as real
- All people, posts, hosts and numbers on For you are **made up** (`frontend/src/people.js`). The sample events are in `frontend/src/eventsData.js`.
- The planner's **Accept** happens by itself after a few seconds (`DEMO_AUTO_ACCEPT` in `frontend/src/chats.js`).
- No email or text is ever sent; the "outbox" only lists what would be sent.
- Everything is stored in the visitor's own browser; clearing the browser clears it.
