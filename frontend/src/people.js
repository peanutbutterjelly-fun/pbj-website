// Dummy accounts for the Spontys thread. EVERYTHING HERE IS MADE UP (names, handles, numbers, past events) so the thread and
// profiles have something to show. Replace it with real accounts when sign-up and a database exist.
//
// Badges are what a person calls themselves. The first three are for hosts, the last two for everyone else:
//   exclusive  PBJ Exclusive Host      pro  Professional Host      newbie  Newbie Host
//   sponty     Sponty Planner          vibes  Here For The Vibes (a user who browses and joins)
import { EVENTS } from "./eventsData.js";
import { today } from "./assistant.js";

export const BADGES = {
  exclusive: { label: "PBJ Exclusive Host", blurb: "Hand-picked by PB&J. A paid host at the top of the lineup." },
  pro: { label: "Professional Host", blurb: "Runs events for a living. A paid host." },
  newbie: { label: "Newbie Host", blurb: "Just started hosting. Come and cheer them on." },
  sponty: { label: "Sponty Planner", blurb: "Throws together spontaneous plans. Free to join." },
  vibes: { label: "Here For The Vibes", blurb: "Here to browse, join and soak it all in." },
};
export const BADGE_ORDER = ["exclusive", "pro", "newbie", "sponty", "vibes"];

// Which of the Events lineup each account hosts (the lineup is in eventsData.js)
const HOST_OF = {
  "Sunset Sessions: Rooftop Jazz": "@sunsetsessions", "Clay & Chai Pottery Night": "@clayandchai", "Open Mic Masala": "@openmicmasala",
  "Vinyl Swap & Spin": "@vinylspin", "Midnight Shorts Under the Stars": "@midnightshorts", "Bun Maska Heritage Walk": "@bunmaskawalks",
  "Sketch & Sip": "@sketchandsip", "Board Game Bonanza": "@boardgamekabir",
};

// Events that already happened. going = how many people went.
export const PAST = [
  { id: "p1", recap: "Our first ever jam. Sixty-odd people, one borrowed amp and a lot of peanut butter toast. Strangers ended up singing along by the second set.", best: "Everyone joining the last chorus", title: "Jam Session #1: Peanut Butter Beats", kind: "music", category: "Music", date: "2026-09-13", area: "Bandra West", price: "₹500", paper: "sun", host: "@pbj", going: 64 },
  { id: "p2", recap: "Eighteen wobbly mugs, three that survived the kiln unscathed. Everyone left with clay under their nails and a plan to come back.", best: "The first mug that actually held chai", title: "Clay & Chai: Mug Making", kind: "workshop", category: "Workshop", date: "2026-09-27", area: "Kala Ghoda", price: "₹1,000", paper: "peanut", host: "@clayandchai", going: 18 },
  { id: "p3", title: "Clay & Chai: Wheel Throwing 101", kind: "workshop", category: "Workshop", date: "2026-10-18", area: "Kala Ghoda", price: "₹1,400", paper: "peanut", host: "@clayandchai", going: 14 },
  { id: "p4", recap: "It poured, nobody left. The band moved under the awning and the whole rooftop sang along to the monsoon.", best: "The surprise unplugged encore", title: "Sunset Sessions: Monsoon Blues", kind: "music", category: "Music", date: "2026-08-30", area: "Bandra West", price: "₹700", paper: "sun", host: "@sunsetsessions", going: 90 },
  { id: "p5", recap: "A glowing rooftop, acoustic sets and way too many diyas. Easily our warmest night so far.", best: "Lighting the last diya together", title: "Sunset Sessions: Acoustic Diwali", kind: "music", category: "Music", date: "2026-10-25", area: "Bandra West", price: "₹800", paper: "brown", host: "@sunsetsessions", going: 120 },
  { id: "p6", title: "Open Mic Masala #7", kind: "comedy", category: "Comedy", date: "2026-10-03", area: "Andheri West", price: "₹400", paper: "jam", host: "@openmicmasala", going: 70 },
  { id: "p7", recap: "Eight acts, one heckler who became a regular. The chai was free for the first five sets and gone in ten minutes.", best: "A first-timer's five minutes of pure gold", title: "Open Mic Masala #8", kind: "comedy", category: "Comedy", date: "2026-10-31", area: "Andheri West", price: "₹500", paper: "jam", host: "@openmicmasala", going: 85 },
  { id: "p8", title: "Vinyl Swap & Spin: Bollywood Edition", kind: "vinyl", category: "Market", date: "2026-10-10", area: "Lower Parel", price: "₹300", paper: "cream", host: "@vinylspin", going: 55 },
  { id: "p9", recap: "Three Irani cafés, one very patient guide, and the softest bun maska in Fort. We walked slow and ate faster.", best: "The café owner's story about the bun", title: "Bun Maska Walk: Irani Cafes", kind: "food", category: "Food", date: "2026-10-24", area: "Fort", price: "₹900", paper: "peanut", host: "@bunmaskawalks", going: 22 },
  { id: "p10", title: "Sketch & Sip: Pilot Night", kind: "art", category: "Art", date: "2026-10-17", area: "Bandra West", price: "₹600", paper: "cream", host: "@sketchandsip", going: 12 },
  { id: "p11", title: "Board Games at the Bookshop", kind: "games", category: "Games", date: "2026-10-11", area: "Khar", price: "Free", paper: "sun", host: "@boardgamekabir", going: 9 },
  { id: "p12", recap: "Six of us, sunrise at the sea wall and chai after. No one was fast, everyone was happy.", best: "The sun coming up behind the Gateway", title: "Marine Drive Sunrise Cycle", kind: "outdoors", category: "Outdoors", date: "2026-11-01", area: "Colaba", price: "Free", paper: "sun", host: "@aarav.plans", going: 11 },
  { id: "p13", title: "Juhu Beach Sunset Football", kind: "outdoors", category: "Outdoors", date: "2026-10-26", area: "Juhu", price: "Free", paper: "peanut", host: "@aarav.plans", going: 14 },
  { id: "p14", title: "Pani Puri Crawl: Girgaum", kind: "food", category: "Food", date: "2026-11-08", area: "Girgaum", price: "Free", paper: "jam", host: "@nisha.out", going: 8 },
  { id: "p15", title: "Sunday Thrift Hop", kind: "market", category: "Market", date: "2026-10-19", area: "Bandra West", price: "Free", paper: "cream", host: "@nisha.out", going: 10 },
  { id: "p16", title: "Dawn Hike: Sanjay Gandhi Park", kind: "outdoors", category: "Outdoors", date: "2026-11-09", area: "Borivali", price: "Free", paper: "peanut", host: "@zoya_walks", going: 16 },
  { id: "p17", title: "Film Night: Rooftop Rewatch", kind: "film", category: "Film", date: "2026-10-30", area: "Versova", price: "Free", paper: "brown", host: "@zoya_walks", going: 7 },
  { id: "p18", title: "Shorts Night Zero", kind: "film", category: "Film", date: "2026-10-08", area: "Versova", price: "₹300", paper: "sun", host: "@midnightshorts", going: 25 },
];

// Each account. attended = ids from PAST (or titles from the Events lineup) they went to.
export const PEOPLE = [
  { handle: "@pbj", name: "PB&J HQ", badge: "exclusive", area: "Bandra West", joined: "Mar 2026", followers: 1280, following: 12, bio: "The team behind PeanutButterJelly.vip. We mine hidden gems around Mumbai and throw a few of our own.", attended: ["p4", "p6", "p9"] },
  { handle: "@clayandchai", name: "Clay & Chai Studio", badge: "exclusive", area: "Kala Ghoda", joined: "Apr 2026", followers: 640, following: 31, bio: "A courtyard studio in Kala Ghoda. Wobbly mugs, warm chai, no experience needed.", attended: ["p10", "p5"] },
  { handle: "@sunsetsessions", name: "Sunset Sessions", badge: "exclusive", area: "Bandra West", joined: "Apr 2026", followers: 920, following: 20, bio: "Live music on a rooftop above a bookshop. Grab a cushion, stay till the last song.", attended: ["p6", "p8"] },
  { handle: "@openmicmasala", name: "Open Mic Masala", badge: "pro", area: "Andheri West", joined: "May 2026", followers: 410, following: 44, bio: "Ten fresh comics, five minutes each, zero mercy. Every other Saturday.", attended: ["p5", "p17"] },
  { handle: "@vinylspin", name: "Vinyl Swap & Spin", badge: "pro", area: "Lower Parel", joined: "May 2026", followers: 230, following: 18, bio: "Bring a record, swap a record. Crate diggers and slow-dance people welcome.", attended: ["p5", "p15"] },
  { handle: "@bunmaskawalks", name: "Bun Maska Walks", badge: "pro", area: "Fort", joined: "Jun 2026", followers: 260, following: 27, bio: "Heritage food walks through old Mumbai. Comfortable shoes, empty stomach.", attended: ["p2", "p11"] },
  { handle: "@midnightshorts", name: "Midnight Shorts", badge: "newbie", area: "Versova", joined: "Sep 2026", followers: 85, following: 52, bio: "Short films from Mumbai makers, projected on a bedsheet. Just getting started.", attended: ["p17", "p9"] },
  { handle: "@sketchandsip", name: "Priya · Sketch & Sip", badge: "newbie", area: "Bandra West", joined: "Sep 2026", followers: 60, following: 70, bio: "Sketchbook in one hand, drink in the other. My first time hosting, be gentle!", attended: ["p2", "p3", "p5"] },
  { handle: "@boardgamekabir", name: "Kabir Shah", badge: "newbie", area: "Khar", joined: "Oct 2026", followers: 38, following: 61, bio: "Board game nerd learning to host. Snacks are on me.", attended: ["p7", "p8"] },
  { handle: "@aarav.plans", name: "Aarav Mehta", badge: "sponty", area: "Colaba", joined: "Jun 2026", followers: 150, following: 98, bio: "Plans made at 9pm, happening at 6am. Cycling, football, anything outdoors.", attended: ["p13", "p9", "p5"] },
  { handle: "@nisha.out", name: "Nisha Rao", badge: "sponty", area: "Bandra West", joined: "Jul 2026", followers: 210, following: 130, bio: "Chai, thrifting and street food, usually with a stranger who becomes a friend.", attended: ["p12", "p8", "p4"] },
  { handle: "@zoya_walks", name: "Zoya Khan", badge: "sponty", area: "Andheri", joined: "Aug 2026", followers: 97, following: 76, bio: "Dawn hikes and rooftop movie nights. Slow pace, big snacks.", attended: ["p12", "p14", "p6"] },
  { handle: "@rohan.vibes", name: "Rohan Iyer", badge: "vibes", area: "Powai", joined: "Aug 2026", followers: 31, following: 120, bio: "Here for the vibes. Mostly gigs and good food.", attended: ["p4", "p5", "p7", "p9"] },
  { handle: "@meera_here", name: "Meera Nair", badge: "vibes", area: "Khar", joined: "Sep 2026", followers: 44, following: 95, bio: "New to Mumbai, saying yes to everything.", attended: ["p5", "p10", "p12", "p15"] },
  { handle: "@dev.snacks", name: "Dev Patel", badge: "vibes", area: "Fort", joined: "Oct 2026", followers: 52, following: 88, bio: "I go where the snacks are.", attended: ["p9", "p14", "p2"] },
];

// The thread. kind: announce (an upcoming event), plan (a spontaneous plan to join), recap (went to something), vibe (a question or a thought)
export const POSTS = [
  { id: "t1", by: "@clayandchai", ago: "2h", kind: "announce", ev: "Clay & Chai Pottery Night", text: "A few seats left. Wobbly mugs guaranteed." },
  { id: "t2", by: "@aarav.plans", ago: "3h", kind: "plan", text: "Sunrise cycle along Marine Drive tomorrow. Bring a bike or rent one on the spot.", plan: { title: "Marine Drive sunrise cycle", when: "Fri 13 Nov · 6:00 AM", area: "Colaba", spots: 6 } },
  { id: "t3", by: "@rohan.vibes", ago: "5h", kind: "vibe", text: "Anyone know a chill spot for a first date under ₹1,000? Not too loud please." },
  { id: "t4", by: "@openmicmasala", ago: "8h", kind: "announce", ev: "Open Mic Masala", text: "Sign-ups open at 7. The first five sets get a free chai." },
  { id: "t5", by: "@nisha.out", ago: "11h", kind: "plan", text: "Thrift hop and chai in Bandra on Sunday. Zero pressure, bring a friend or make one.", plan: { title: "Thrift hop & chai", when: "Sun 15 Nov · 4:00 PM", area: "Bandra West", spots: 4 } },
  { id: "t6", by: "@meera_here", ago: "1d", kind: "recap", past: "p5", text: "Acoustic Diwali was pure magic. Go next time, seriously." },
  { id: "t7", by: "@bunmaskawalks", ago: "1d", kind: "announce", ev: "Bun Maska Heritage Walk", text: "Three cafés, four chais, one very good story about why the bun is soft." },
  { id: "t8", by: "@zoya_walks", ago: "2d", kind: "plan", text: "Dawn hike if the weather holds. Slow pace, snacks at the top.", plan: { title: "Dawn hike, Sanjay Gandhi Park", when: "Sat 14 Nov · 5:30 AM", area: "Borivali", spots: 8 } },
  { id: "t9", by: "@sketchandsip", ago: "2d", kind: "announce", ev: "Sketch & Sip", text: "My first time hosting for real! Come and sketch badly with me." },
  { id: "t10", by: "@dev.snacks", ago: "3d", kind: "recap", past: "p9", text: "The Irani café walk was worth every bun." },
  { id: "t11", by: "@vinylspin", ago: "3d", kind: "announce", ev: "Vinyl Swap & Spin", text: "Bring a record, swap a record, dance to whatever lands on the turntable." },
  { id: "t12", by: "@midnightshorts", ago: "4d", kind: "announce", ev: "Midnight Shorts Under the Stars", text: "Six films, one bedsheet, unlimited popcorn." },
  { id: "t13", by: "@boardgamekabir", ago: "5d", kind: "announce", ev: "Board Game Bonanza", text: "Newbie host here. Snacks are on me, bring your competitive side." },
  { id: "t14", by: "@pbj", ago: "6d", kind: "vibe", text: "Welcome to the thread! Follow hosts, join plans, tell us what you loved." },
];

export const personBy = (h) => PEOPLE.find((p) => p.handle === h);
export const isPast = (e) => e.date < today();
/** Find an event by a PAST id or an Events lineup title. */
export const byRef = (ref) => PAST.find((e) => e.id === ref) || EVENTS.find((e) => e.title === ref);
/** Everything a person hosted, newest first (past ones and the ones coming up). */
export const hostedOf = (p) => [...PAST.filter((e) => e.host === p.handle), ...EVENTS.filter((e) => HOST_OF[e.title] === p.handle).map((e) => ({ ...e, host: p.handle }))].sort((a, b) => b.date.localeCompare(a.date));
export const attendedOf = (p) => p.attended.map(byRef).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date));
export const hostOfEvent = (e) => HOST_OF[e.title];
