// The Events lineup. EACH LINE BELOW IS SAMPLE CONTENT (made-up events, names and prices) so the tickets have something
// to show. Replace them with the real hand-picked events: one block per event, same fields.
//
//  title      the event name (short; it is set in big capitals)
//  kind       the little picture on the ticket: music | workshop | comedy | vinyl | film | food | art | games
//  category   the word on the round stamp
//  date       the day, as YYYY-MM-DD. Once this day has passed, the ticket disappears by itself.
//  time       the start time, as you want it written
//  area       the neighbourhood in Mumbai
//  venue      the place (no home addresses)
//  price      "Free" or an amount like "₹800"
//  blurb      one or two friendly lines in our own words
//  link       where "Go to event" goes (the host's page or Instagram). Leave "" until we have it.
//  paper      the ticket colour: sun | jam | cream | peanut | brown
export const EVENTS = [
  {
    title: "Sunset Sessions: Rooftop Jazz",
    kind: "music",
    category: "Music",
    date: "2026-11-07",
    time: "7:30 PM",
    area: "Bandra West",
    venue: "A rooftop above a bookshop",
    price: "₹800",
    blurb: "A trio, a cold drink and the sky turning orange. Grab a cushion, stay till the last song.",
    link: "",
    paper: "sun",
  },
  {
    title: "Clay & Chai Pottery Night",
    kind: "workshop",
    category: "Workshop",
    date: "2026-11-14",
    time: "6:00 PM",
    area: "Kala Ghoda",
    venue: "A courtyard studio",
    price: "₹1,200",
    blurb: "Get your hands muddy, make a wobbly mug, drink chai from someone else's. Kiln-fired and ready next week.",
    link: "",
    paper: "peanut",
  },
  {
    title: "Open Mic Masala",
    kind: "comedy",
    category: "Comedy",
    date: "2026-11-21",
    time: "8:00 PM",
    area: "Andheri West",
    venue: "A basement café",
    price: "₹500",
    blurb: "Ten fresh comics, five minutes each, zero mercy. Come laugh, or sign up to bomb in style.",
    link: "",
    paper: "jam",
  },
  {
    title: "Vinyl Swap & Spin",
    kind: "vinyl",
    category: "Market",
    date: "2026-11-28",
    time: "4:00 PM",
    area: "Lower Parel",
    venue: "A warehouse loft",
    price: "₹300",
    blurb: "Bring a record, swap a record, dance to whatever lands on the turntable next.",
    link: "",
    paper: "cream",
  },
  {
    title: "Midnight Shorts Under the Stars",
    kind: "film",
    category: "Film",
    date: "2026-12-05",
    time: "9:30 PM",
    area: "Versova",
    venue: "A terrace by the sea",
    price: "₹600",
    blurb: "Six short films from Mumbai makers, projected on a bedsheet. Blankets and popcorn included.",
    link: "",
    paper: "brown",
  },
  {
    title: "Bun Maska Heritage Walk",
    kind: "food",
    category: "Food",
    date: "2026-12-12",
    time: "8:00 AM",
    area: "Fort",
    venue: "Starts at an old Irani café",
    price: "₹900",
    blurb: "Three cafés, four chais, one very good story about why the bun is soft. Comfortable shoes please.",
    link: "",
    paper: "sun",
  },
  {
    title: "Sketch & Sip",
    kind: "art",
    category: "Art",
    date: "2026-12-19",
    time: "5:00 PM",
    area: "Colaba",
    venue: "A gallery garden",
    price: "₹1,500",
    blurb: "A model, a pencil, a glass of something nice. No skill needed, just curiosity.",
    link: "",
    paper: "peanut",
  },
  {
    title: "Board Game Bonanza",
    kind: "games",
    category: "Games",
    date: "2027-01-09",
    time: "3:00 PM",
    area: "Powai",
    venue: "A cosy game café",
    price: "₹400",
    blurb: "Two hundred games, a friendly host to teach you any of them, and snacks that survive sticky fingers.",
    link: "",
    paper: "jam",
  },
];
