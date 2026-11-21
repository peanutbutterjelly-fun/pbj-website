"""Free tickets (RSVPs) for the events hosts make in the dashboard, and the host's guest list.

The events themselves are made, edited, published and cancelled by the host in the dashboard, straight through Supabase
(public.events, see supabase/migrations/…_events.sql). This file only reads them:
  - status: guests can ask for a ticket only while it is "published". "coming" (bookings not open yet) and "soldout"
    (bookings closed) stay listed but take no new asks; the host can still accept requests that are waiting.
  - dates: nothing is given for an event whose last day (ends_on, else starts_on) has passed, in Mumbai time.
  - data.type: "guestlist" (a Sponty event) means the host approves each person, so asking makes a request.
    "exclusive" and "open" give the ticket at once.
  - data.tickets: the free tickets ("paid" not set, enabled, status Live) and their quantities are the spots.
    PB&J doesn't sell paid tickets yet, so an event with only paid tickets takes no RSVPs here.
Getting a ticket (or being accepted) joins the event's group chat, which opens with its host when the first guest gets in.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path
from psycopg import Connection
from pydantic import BaseModel, Field

from app.auth import CurrentUser, LoggedIn, OptionalUser
from app.db import get_db

router = APIRouter(prefix="/events", tags=["events"])
Db = Annotated[Connection, Depends(get_db)]
EventId = Annotated[str, Path(pattern=r"^[a-z0-9-]{3,40}$")]

OPEN = ("published",)  # guests can ask
LISTED = ("published", "coming", "soldout")  # on the Events page; the host can still let waiting people in
TODAY = "(now() at time zone 'Asia/Kolkata')::date"

FACTS = f"""select id, host_id, status, data->>'type' as type, data->'tickets' as tickets, left(coalesce(nullif(btrim(data->>'title'), ''), 'Event chat'), 120) as title,
                   coalesce(coalesce(ends_on, starts_on) >= {TODAY}, false) as upcoming
            from public.events where id = %s"""


class TicketIn(BaseModel):
    note: str | None = Field(default=None, max_length=140)  # why they'd like to join (the host reads it)


def facts(db: Connection, event_id: str, lock: bool = False) -> dict | None:
    """What the backend needs to know about an event. With lock, two people can't grab the last spot at the same time."""
    return db.execute(FACTS + (" for update" if lock else ""), (event_id,)).fetchone()


def _qty(value) -> int:
    try:
        n = int(str(value).strip())
    except ValueError:
        return 0
    return max(n, 0)


def free_spots(tickets) -> int | None:
    """How many free tickets the host listed (None when there are none: then there's nothing to RSVP for)."""
    free = [t for t in (tickets if isinstance(tickets, list) else []) if isinstance(t, dict) and not t.get("paid")
            and t.get("enabled") is not False and (t.get("status") or "Live") == "Live"]
    return sum(_qty(t.get("qty")) for t in free) if free else None


def going_count(db: Connection, event_id: str) -> int:
    return db.execute("select count(*) as n from public.tickets where event_id = %s and status = 'going'", (event_id,)).fetchone()["n"]


def open_chat(db: Connection, ev: dict) -> UUID:
    """The event's group chat, made the first time with the host in it."""
    chat = db.execute(
        "insert into public.chats (event_id, host_id, title) values (%s, %s, %s) on conflict (event_id) do nothing returning id",
        (ev["id"], ev["host_id"], ev["title"]),
    ).fetchone()
    if chat is None:
        return db.execute("select id from public.chats where event_id = %s", (ev["id"],)).fetchone()["id"]
    db.execute("insert into public.chat_members (chat_id, user_id, role) values (%s, %s, 'host') on conflict do nothing", (chat["id"], ev["host_id"]))
    db.execute(
        "insert into public.messages (chat_id, sender_id, kind, body) values (%s, %s, 'system', %s)",
        (chat["id"], ev["host_id"], "This is the group chat for this event. Only the host posts here, and updates arrive the moment they are sent."),
    )
    return chat["id"]


def join_chat(db: Connection, ev: dict, user_id: UUID) -> UUID:
    chat_id = open_chat(db, ev)
    db.execute("insert into public.chat_members (chat_id, user_id, role) values (%s, %s, 'member') on conflict do nothing", (chat_id, user_id))
    return chat_id


def leave_chat(db: Connection, event_id: str, user_id: UUID) -> None:
    db.execute(
        "delete from public.chat_members where user_id = %s and role = 'member' and chat_id in (select id from public.chats where event_id = %s)",
        (user_id, event_id),
    )


def my_chat(db: Connection, event_id: str, user_id: UUID) -> UUID | None:
    row = db.execute(
        "select c.id from public.chats c join public.chat_members m on m.chat_id = c.id where c.event_id = %s and m.user_id = %s",
        (event_id, user_id),
    ).fetchone()
    return row["id"] if row else None


@router.get("/{event_id}/rsvp")
def rsvp_state(event_id: EventId, db: Db, user: OptionalUser) -> dict:
    """For the event page: spots left, whether guests can ask now, and (when signed in) my ticket and chat."""
    ev = facts(db, event_id)
    if ev is None or ev["status"] == "draft" and (user is None or user.id != ev["host_id"]):
        raise HTTPException(404, "Event not found")
    cap = free_spots(ev["tickets"])
    going = going_count(db, event_id)
    me = None
    if user is not None:
        t = db.execute("select status from public.tickets where event_id = %s and user_id = %s", (event_id, user.id)).fetchone()
        me = {"is_host": user.id == ev["host_id"], "ticket": t["status"] if t else None, "chat_id": my_chat(db, event_id, user.id)}
    return {
        "open": ev["status"] in OPEN and ev["upcoming"] and cap is not None,
        "approval": ev["type"] == "guestlist",  # the host approves each person
        "going": going,
        "spots_left": None if cap is None else max(cap - going, 0),
        "me": me,
    }


@router.put("/{event_id}/ticket")
def get_ticket(event_id: EventId, user: LoggedIn, db: Db, body: TicketIn | None = None) -> dict:
    """Ask for a ticket. For a Sponty event this records a request the host accepts or declines; otherwise the ticket is
    given at once (while spots last). Safe to repeat."""
    ev = facts(db, event_id, lock=True)
    if ev is None or ev["status"] == "draft":
        raise HTTPException(404, "Event not found")
    if ev["host_id"] == user.id:
        raise HTTPException(409, "You're the host of this one")
    have = db.execute("select status from public.tickets where event_id = %s and user_id = %s", (event_id, user.id)).fetchone()
    if have is not None and have["status"] in ("going", "requested"):
        return {"status": have["status"], "chat_id": my_chat(db, event_id, user.id)}
    if have is not None and have["status"] == "declined":
        raise HTTPException(403, "The host didn't accept this request")
    if ev["status"] not in OPEN:
        raise HTTPException(409, {"cancelled": "This event was cancelled", "soldout": "Bookings for this event are closed",
                                  "coming": "Bookings for this event aren't open yet"}.get(ev["status"], "Bookings are closed"))
    if not ev["upcoming"]:
        raise HTTPException(409, "This event has already happened")
    cap = free_spots(ev["tickets"])
    if cap is None:
        raise HTTPException(409, "This event has no free tickets to RSVP for")
    status = "requested" if ev["type"] == "guestlist" else "going"
    if status == "going" and going_count(db, event_id) >= cap:
        raise HTTPException(409, "This event is full")
    note = (body.note or "").strip() or None if body else None
    db.execute(
        """insert into public.tickets (event_id, user_id, status, note) values (%s, %s, %s, %s)
           on conflict (event_id, user_id) do update set status = excluded.status, note = excluded.note, decided_at = null""",
        (event_id, user.id, status, note),
    )
    return {"status": status, "chat_id": join_chat(db, ev, user.id) if status == "going" else None}


@router.delete("/{event_id}/ticket")
def give_back_ticket(event_id: EventId, user: LoggedIn, db: Db) -> dict:
    """Not going any more (or withdrawing a request): frees the spot and leaves the group chat (the host stays in it)."""
    db.execute("update public.tickets set status = 'cancelled' where event_id = %s and user_id = %s and status in ('requested', 'going')", (event_id, user.id))
    leave_chat(db, event_id, user.id)
    return {"status": "cancelled"}


def own_event(db: Connection, event_id: str, user: CurrentUser, lock: bool = False) -> dict:
    """The event, if this person is its host (else 404, so other people's events aren't revealed)."""
    ev = facts(db, event_id, lock=lock)
    if ev is None or ev["host_id"] != user.id:
        raise HTTPException(404, "Event not found")
    return ev


@router.get("/{event_id}/guests")
def list_guests(event_id: EventId, user: LoggedIn, db: Db) -> dict:
    """For the host: who asked, who is going, who was declined, and how many spots are left. Requests waiting come first.
    Each guest is identified by their ticket id (never their account id)."""
    ev = own_event(db, event_id, user)
    rows = db.execute(
        """select t.id as ticket_id, t.status, t.note, t.created_at, t.decided_at,
                  p.full_name, p.handle, p.avatar_url, p.badge, p.about
           from public.tickets t join public.profiles p on p.id = t.user_id
           where t.event_id = %s and t.status in ('requested', 'going', 'declined')
           order by (t.status = 'requested') desc, t.created_at""",
        (event_id,),
    ).fetchall()
    going = sum(1 for r in rows if r["status"] == "going")
    cap = free_spots(ev["tickets"])
    chat = db.execute("select id from public.chats where event_id = %s", (event_id,)).fetchone()
    return {"capacity": cap, "going": going, "spots_left": None if cap is None else max(cap - going, 0),
            "chat_id": chat["id"] if chat else None, "guests": rows}


def ticket_of(db: Connection, event_id: str, ticket_id: UUID) -> dict:
    row = db.execute("select id, user_id, status from public.tickets where id = %s and event_id = %s for update", (ticket_id, event_id)).fetchone()
    if row is None:
        raise HTTPException(404, "No request from that person")
    return row


@router.post("/{event_id}/guests/{ticket_id}/accept")
def accept_guest(event_id: EventId, ticket_id: UUID, user: LoggedIn, db: Db) -> dict:
    """The host lets someone in: they get the ticket and join the group chat. Only for a listed event that hasn't
    happened yet, and refused when the spots are full."""
    ev = own_event(db, event_id, user, lock=True)
    if ev["status"] not in LISTED:
        raise HTTPException(409, "This event isn't listed" if ev["status"] == "draft" else "This event was cancelled")
    if not ev["upcoming"]:
        raise HTTPException(409, "This event has already happened")
    t = ticket_of(db, event_id, ticket_id)
    if t["status"] not in ("requested", "declined"):
        raise HTTPException(404, "No request from that person")
    cap = free_spots(ev["tickets"])
    if cap is None or going_count(db, event_id) >= cap:
        raise HTTPException(409, "All the spots are taken")
    db.execute("update public.tickets set status = 'going', decided_at = now() where id = %s", (ticket_id,))
    return {"status": "going", "chat_id": join_chat(db, ev, t["user_id"])}


@router.post("/{event_id}/guests/{ticket_id}/decline")
def decline_guest(event_id: EventId, ticket_id: UUID, user: LoggedIn, db: Db) -> dict:
    own_event(db, event_id, user, lock=True)
    if ticket_of(db, event_id, ticket_id)["status"] != "requested":
        raise HTTPException(404, "No request from that person")
    db.execute("update public.tickets set status = 'declined', decided_at = now() where id = %s", (ticket_id,))
    return {"status": "declined"}


@router.post("/{event_id}/guests/{ticket_id}/remove")
def remove_guest(event_id: EventId, ticket_id: UUID, user: LoggedIn, db: Db) -> dict:
    """The host takes back a spot from someone already going: it frees the spot and removes them from the chat."""
    own_event(db, event_id, user, lock=True)
    t = ticket_of(db, event_id, ticket_id)
    if t["status"] != "going":
        raise HTTPException(404, "That person isn't going")
    db.execute("update public.tickets set status = 'declined', decided_at = now() where id = %s", (ticket_id,))
    leave_chat(db, event_id, t["user_id"])
    return {"status": "declined"}
