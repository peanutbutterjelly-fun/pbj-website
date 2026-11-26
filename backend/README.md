# PB&J backend

The server for PeanutButterJelly.fun, built with [FastAPI](https://fastapi.tiangolo.com/) (Python). This is a starter for now: one health check route, settings, and a test.

## Run it

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Then open http://localhost:8000/api/health (should say `{"status":"ok"}`) or http://localhost:8000/docs for the interactive API page.

## Routes so far

- `GET /api/health`: the server is up.
- `GET /api/health/db`: the server can reach the database.
- `GET /api/me` and `PATCH /api/me`: the logged-in person's profile. Send the Supabase login token as `Authorization: Bearer <token>`. They can change `full_name`, `avatar_url` (only a photo they uploaded to their own `images/<account id>/profile/` folder), `city`, `phone`, `host_kind`, `link`, `about`, `wants_call`, `handle` (unique, saved in lowercase), `instagram`, `youtube`, `x_handle`, `badge` (`vibes`, `sponty` or `newbie`) and `birthday`. Sending `"onboarded": true` marks the welcome steps as done (the dashboard asks for them until then). `role` and the team-given badges `pro` and `exclusive` can't be changed here.
- `DELETE /api/me` with `{"confirm": "DELETE"}`: deletes the logged-in person's account for good, and everything linked to it (profile, events they host with their tickets and chats, their tickets and messages, sign-ups they sent while signed in). The website removes their photos from storage first.
- `GET /api/people/{handle}`: anyone's public profile, no login needed: handle, name, photo, city, badge, about, Instagram, YouTube, X and when they joined. Never their email, phone, birthday, role or welcome answers.
- **Profile activity** (`app/api/routes/activity.py`, login needed unless noted; everyone only ever changes their own):
  - `PUT` / `DELETE /api/people/{handle}/follow`; `GET /api/people/{handle}/follows` (counts, no login needed); `GET /api/me/following`.
  - `PUT` / `DELETE /api/events/{id}/reaction` with `{"kind": "love" | "like" | "curious"}`; `GET /api/me/reactions`.
  - `GET` / `POST /api/me/lists`, `PATCH` / `DELETE /api/me/lists/{list_id}`, `PUT` / `DELETE /api/me/lists/{list_id}/events/{id}` (up to 20 lists, 200 events each).
  - `PUT` / `DELETE /api/events/{id}/attendance` ("I went", once the event has started) with an optional mood and note; `GET /api/me/attendances`; `GET /api/people/{handle}/attended` follows the person's `attended_visibility` (set it with `PATCH /api/me`: public, followers or private).
  - `GET /api/events/{id}/recap` (anyone, for listed events); `PUT` / `DELETE` by the event's host only, once it has started; photos must be the host's own uploads in `images/<id>/events/`.
  - Only events the person may see count: listed and not hidden by staff, or their own.
- Tickets (free RSVPs) for the events hosts make in the dashboard. Guests can ask only while an event is `published` and its last day hasn't passed (Mumbai time), and only for its free tickets (their quantities are the spots). A Sponty event (`guestlist`) makes a request the host accepts or declines; other events give the ticket at once.
  - `GET /api/events/{id}/rsvp`: spots left, whether it takes asks now, and (signed in) my ticket and chat.
  - `PUT /api/events/{id}/ticket` (optional `{"note": "…"}`) and `DELETE /api/events/{id}/ticket`: ask for or give back a ticket.
  - For the host only: `GET /api/events/{id}/guests`, then `POST /api/events/{id}/guests/{ticket_id}/accept`, `/decline` or `/remove`. Accepting needs a listed (`published`, `coming` or `soldout`) event that hasn't happened.
  - `GET /api/me/tickets`: my tickets and requests (cancelled events stay, with their status).
- Group chats (one per event, opened when the first guest gets in; only the host posts): `GET /api/me/chats`, `GET /api/chats/{id}` (`?after=<message id>` for newer ones), `POST /api/chats/{id}/read`, and for the host `POST /api/chats/{id}/updates` with `{"body": "…"}`. People are shown by name, handle and photo, never by account id.
- The events themselves are made, edited, published and cancelled in the dashboard, straight through Supabase (not through these routes).

The backend connects to the database as its owner, so Supabase's row level security doesn't protect it: every route must check who is asking (`LoggedIn` in `app/auth.py`). Database changes live in `../supabase/migrations/` (see `../supabase/README.md`).

## Test it

```bash
pytest
```

The ticket, chat and profile database tests start a throwaway Postgres (the `pgserver` package in `requirements-dev.txt`) and apply every migration in `../supabase/migrations/` first.

## Where it runs

On Railway: project **pbj-backend**, service **api**, Singapore region (the closest to Mumbai).
- Live: https://api-production-bb76bfb9.up.railway.app/api/health
- Deploys automatically when a `feat(backend)`, `fix(backend)` or `chore(backend)` PR is merged into `main` (see `.github/workflows/deploy-backend.yml`). To deploy `main` by hand: GitHub → Actions → Deploy backend → Run workflow.
- `railway.json` holds the Railway settings (region, health check, restarts). `railpack.json` holds the start command.
- Settings and secrets (like `ENVIRONMENT`) are set in Railway under the **api** service's Variables, never in code.

## Layout

```
backend/
  app/
    main.py          # creates the app, CORS, mounts routes
    config.py        # settings from environment / .env
    db.py            # database connection pool
    auth.py          # checks Supabase login tokens
    api/
      router.py      # gathers all routes under /api
      routes/
        health.py    # GET /api/health, /api/health/db
        me.py        # GET/PATCH /api/me
        people.py    # GET /api/people/{handle}
        events.py    # tickets and the host's guest list
        chats.py     # group chats
        mine.py      # GET /api/me/tickets, /api/me/chats
  tests/             # pytest tests
  railway.json           # Railway settings (region, health check)
  railpack.json          # how Railway starts the server
  requirements.txt       # what the server needs
  requirements-dev.txt   # plus testing tools
  .env.example           # copy to .env for local settings
```

To add a feature, make a new file in `app/api/routes/`, then include it in `app/api/router.py`.
