"""Events that hosts list, and free tickets (RSVPs) for them. Publishing an event opens its group chat; getting a ticket joins it."""

import re
import secrets
from datetime import datetime, timedelta
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from psycopg import Connection
from pydantic import BaseModel, Field, field_validator, model_validator

from app.auth import CurrentUser, LoggedIn, OptionalUser
from app.db import get_db

router = APIRouter(prefix="/events", tags=["events"])
Db = Annotated[Connection, Depends(get_db)]

EVENT_COLUMNS = "e.id, e.slug, e.title, e.description, e.category, e.city, e.area, e.venue, e.starts_at, e.ends_at, e.capacity, e.kind, e.approval, e.cover_url, e.status"
# What people see about an event: the event, its host's public details, and how many are going
SELECT = f"""
select {EVENT_COLUMNS},
  p.handle as host_handle, p.full_name as host_name, p.avatar_url as host_avatar, p.badge as host_badge,
  (select count(*) from public.tickets t where t.event_id = e.id and t.status = 'going') as going
from public.events e join public.profiles p on p.id = e.host_id
"""


class EventIn(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    category: str | None = Field(default=None, max_length=40)
    city: str = Field(default="Mumbai", max_length=80)
    area: str | None = Field(default=None, max_length=80)
    venue: str | None = Field(default=None, max_length=120)
    starts_at: datetime
    ends_at: datetime | None = None
    capacity: int | None = Field(default=None, ge=1, le=100000)
    kind: Literal["sponty", "exclusive", "open"] = "sponty"
    approval: Literal["manual", "auto"] = "manual"  # Sponty plans: approve each person, or let the first people in
    cover_url: str | None = Field(default=None, max_length=500)

    @field_validator("starts_at", "ends_at")
    @classmethod
    def needs_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("Give the time with a timezone, like 2026-12-05T19:30:00+05:30")
        return value

    @field_validator("cover_url")
    @classmethod
    def https_only(cls, value: str | None) -> str | None:
        if value and not value.startswith("https://"):
            raise ValueError("The cover picture address must start with https://")
        return value

    @model_validator(mode="after")
    def ends_after_start(self) -> "EventIn":
        if self.ends_at is not None and self.ends_at <= self.starts_at:
            raise ValueError("The event must end after it starts")
        return self


class EventPatch(EventIn):
    """Same fields, all optional: only what is sent is changed."""

    title: str | None = Field(default=None, min_length=3, max_length=120)  # type: ignore[assignment]
    city: str | None = Field(default=None, max_length=80)  # type: ignore[assignment]
    starts_at: datetime | None = None  # type: ignore[assignment]
    kind: Literal["sponty", "exclusive", "open"] | None = None  # type: ignore[assignment]
    approval: Literal["manual", "auto"] | None = None  # type: ignore[assignment]


def slugify(title: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:60].strip("-") or "event"
    return f"{base}-{secrets.token_hex(3)}"  # the short code keeps two events with the same name apart


class TicketIn(BaseModel):
    note: str | None = Field(default=None, max_length=140)  # why they'd like to join (the planner reads it)


def gate(code: str, message: str) -> HTTPException:
    """A refusal the website can recognise by `code` and show `message` for."""
    return HTTPException(403, {"code": code, "message": message})


def require_can_host(user: CurrentUser, db: Connection, kind: str) -> None:
    """Anyone with an account can list events once their profile has a name and a handle. A Sponty plan also needs the one-time identity check."""
    p = db.execute("select full_name, handle, verified_at from public.profiles where id = %s", (user.id,)).fetchone()
    if p is None or not p["full_name"] or not p["handle"]:
        raise gate("profile_incomplete", "Add your name and a handle to your profile before you list an event")
    if kind == "sponty" and p["verified_at"] is None:
        raise gate("verification_required", "Sponty planners verify their identity once before listing a plan")


def require_verified(user: CurrentUser, db: Connection) -> None:
    p = db.execute("select verified_at from public.profiles where id = %s", (user.id,)).fetchone()
    if p is None or p["verified_at"] is None:
        raise gate("verification_required", "Verify your identity once to join Sponty plans")


def spots(row: dict) -> dict:
    """Adds how many spots are left (None when there is no limit)."""
    cap = row.get("capacity")
    return {**row, "spots_left": None if cap is None else max(cap - int(row["going"]), 0)}


def own_event(db: Connection, event_id: UUID, user: CurrentUser) -> dict:
    """The event, if this person is its host (else 404, so other people's events aren't revealed)."""
    row = db.execute("select id, status, title, host_id, kind, capacity from public.events where id = %s and host_id = %s", (event_id, user.id)).fetchone()
    if row is None:
        raise HTTPException(404, "Event not found")
    return row


def post_system(db: Connection, chat_id: UUID, host_id: UUID, text: str) -> None:
    db.execute("insert into public.messages (chat_id, sender_id, kind, body) values (%s, %s, 'system', %s)", (chat_id, host_id, text))


@router.get("")
def list_events(db: Db) -> list[dict]:
    """Published events that haven't finished yet, soonest first."""
    rows = db.execute(
        SELECT + " where e.status = 'published' and coalesce(e.ends_at, e.starts_at + interval '6 hours') > now() order by e.starts_at limit 100"
    ).fetchall()
    return [spots(r) for r in rows]


@router.get("/{slug}")
def read_event(slug: str, db: Db, user: OptionalUser) -> dict:
    row = db.execute(SELECT + " where e.slug = %s", (slug,)).fetchone()
    if row is None:
        raise HTTPException(404, "Event not found")
    mine = None
    if user is not None:
        own = db.execute("select 1 from public.events where id = %s and host_id = %s", (row["id"], user.id)).fetchone() is not None
        mine = {"is_host": own}
        t = db.execute("select status from public.tickets where event_id = %s and user_id = %s", (row["id"], user.id)).fetchone()
        c = db.execute("select c.id from public.chats c join public.chat_members m on m.chat_id = c.id where c.event_id = %s and m.user_id = %s", (row["id"], user.id)).fetchone()
        mine.update({"ticket": t["status"] if t else None, "chat_id": c["id"] if c else None})
        if row["status"] != "published" and not own:
            raise HTTPException(404, "Event not found")
    elif row["status"] != "published":
        raise HTTPException(404, "Event not found")
    return {**spots(row), "me": mine}


@router.post("", status_code=201)
def create_event(body: EventIn, user: LoggedIn, db: Db) -> dict:
    """A host starts an event as a draft. Nobody sees it until it is published."""
    require_can_host(user, db, body.kind)
    data = body.model_dump()
    row = db.execute(
        """insert into public.events (host_id, slug, title, description, category, city, area, venue, starts_at, ends_at, capacity, kind, approval, cover_url)
           values (%(host_id)s, %(slug)s, %(title)s, %(description)s, %(category)s, %(city)s, %(area)s, %(venue)s, %(starts_at)s, %(ends_at)s,
                   %(capacity)s, %(kind)s, %(approval)s, %(cover_url)s) returning id, slug, status""",
        {**data, "host_id": user.id, "slug": slugify(body.title)},
    ).fetchone()
    return row


@router.patch("/{event_id}")
def update_event(event_id: UUID, body: EventPatch, user: LoggedIn, db: Db) -> dict:
    own_event(db, event_id, user)
    changes = body.model_dump(exclude_unset=True)
    if changes:
        sets = ", ".join(f"{name} = %({name})s" for name in changes)  # names come from the model, not the person
        db.execute(f"update public.events set {sets} where id = %(id)s", {**changes, "id": event_id})
    return db.execute("select id, slug, status from public.events where id = %s", (event_id,)).fetchone()


@router.post("/{event_id}/publish")
def publish_event(event_id: UUID, user: LoggedIn, db: Db) -> dict:
    """Goes live, and opens the event's group chat with its host in it."""
    ev = own_event(db, event_id, user)
    require_can_host(user, db, ev["kind"])
    if ev["status"] == "cancelled":
        raise HTTPException(409, "A cancelled event can't be published again")
    db.execute("update public.events set status = 'published' where id = %s", (event_id,))
    chat = db.execute(
        "insert into public.chats (event_id, kind, host_id, title) values (%s, 'event', %s, %s) on conflict (event_id) do nothing returning id",
        (event_id, user.id, ev["title"][:120]),
    ).fetchone()
    if chat is not None:  # first time: add the host and say what the chat is for
        db.execute("insert into public.chat_members (chat_id, user_id, role) values (%s, %s, 'host') on conflict do nothing", (chat["id"], user.id))
        post_system(db, chat["id"], user.id, "This is the group chat for this event. Only the host posts here, and updates arrive the moment they are sent.")
    else:
        chat = db.execute("select id from public.chats where event_id = %s", (event_id,)).fetchone()
    return {"id": event_id, "status": "published", "chat_id": chat["id"]}


@router.post("/{event_id}/cancel")
def cancel_event(event_id: UUID, user: LoggedIn, db: Db) -> dict:
    own_event(db, event_id, user)
    db.execute("update public.events set status = 'cancelled' where id = %s", (event_id,))
    chat = db.execute("select id from public.chats where event_id = %s", (event_id,)).fetchone()
    if chat is not None:
        post_system(db, chat["id"], user.id, "This event was cancelled by the host.")
    return {"id": event_id, "status": "cancelled"}


def join_chat(db: Connection, event_id: UUID, user_id: UUID) -> UUID | None:
    chat = db.execute("select id from public.chats where event_id = %s", (event_id,)).fetchone()
    if chat is None:
        return None
    db.execute("insert into public.chat_members (chat_id, user_id, role) values (%s, %s, 'member') on conflict do nothing", (chat["id"], user_id))
    return chat["id"]


def leave_chat(db: Connection, event_id: UUID, user_id: UUID) -> None:
    db.execute(
        """delete from public.chat_members where user_id = %s and role = 'member'
           and chat_id in (select id from public.chats where event_id = %s)""",
        (user_id, event_id),
    )


def going_count(db: Connection, event_id: UUID) -> int:
    return db.execute("select count(*) as n from public.tickets where event_id = %s and status = 'going'", (event_id,)).fetchone()["n"]


@router.put("/{event_id}/ticket")
def get_ticket(event_id: UUID, user: LoggedIn, db: Db, body: TicketIn | None = None) -> dict:
    """Ask for a ticket. A Sponty plan that the planner approves person by person only records a request; otherwise the ticket is given at
    once. Safe to repeat. Joining a Sponty plan needs the one-time identity check."""
    # lock the event row so two people grabbing the last spot can't both get it
    ev = db.execute("select id, host_id, kind, approval, status, starts_at, ends_at, capacity from public.events where id = %s for update", (event_id,)).fetchone()
    if ev is None or ev["status"] != "published":
        raise HTTPException(404, "Event not found")
    if ev["host_id"] == user.id:
        raise HTTPException(409, "You're the host of this one")
    end = ev["ends_at"] or ev["starts_at"] + timedelta(hours=6)
    if end <= db.execute("select now() as n").fetchone()["n"]:
        raise HTTPException(409, "This event has already happened")
    if ev["kind"] == "sponty":
        require_verified(user, db)
    have = db.execute("select status from public.tickets where event_id = %s and user_id = %s", (event_id, user.id)).fetchone()
    if have is not None and have["status"] in ("going", "requested"):
        return {"status": have["status"], "chat_id": join_chat(db, event_id, user.id) if have["status"] == "going" else None}
    if have is not None and have["status"] == "declined":
        raise HTTPException(403, "The host didn't accept this request")
    approve_each = ev["kind"] == "sponty" and ev["approval"] == "manual"
    status = "requested" if approve_each else "going"
    if status == "going" and ev["capacity"] is not None and going_count(db, event_id) >= ev["capacity"]:
        raise HTTPException(409, "This event is full")
    note = body.note.strip() if body and body.note else None
    db.execute(
        """insert into public.tickets (event_id, user_id, status, note) values (%s, %s, %s, %s)
           on conflict (event_id, user_id) do update set status = excluded.status, note = excluded.note, decided_at = null""",
        (event_id, user.id, status, note),
    )
    return {"status": status, "chat_id": join_chat(db, event_id, user.id) if status == "going" else None}


@router.delete("/{event_id}/ticket")
def give_back_ticket(event_id: UUID, user: LoggedIn, db: Db) -> dict:
    """Not going any more (or withdrawing a request): frees the spot and leaves the group chat (the host stays in it)."""
    db.execute("update public.tickets set status = 'cancelled' where event_id = %s and user_id = %s and status in ('requested', 'going')", (event_id, user.id))
    leave_chat(db, event_id, user.id)
    return {"status": "cancelled"}


@router.get("/{event_id}/guests")
def list_guests(event_id: UUID, user: LoggedIn, db: Db) -> dict:
    """For the host: who asked, who is going, who was declined, and how many spots are left. Requests waiting come first."""
    ev = own_event(db, event_id, user)
    rows = db.execute(
        """select t.user_id, t.status, t.note, t.created_at, t.decided_at,
                  p.full_name, p.handle, p.avatar_url, p.badge, p.bio, (p.verified_at is not null) as verified
           from public.tickets t join public.profiles p on p.id = t.user_id
           where t.event_id = %s and t.status in ('requested', 'going', 'declined')
           order by (t.status = 'requested') desc, t.created_at""",
        (event_id,),
    ).fetchall()
    going = sum(1 for r in rows if r["status"] == "going")
    cap = ev["capacity"]
    return {"capacity": cap, "going": going, "spots_left": None if cap is None else max(cap - going, 0), "guests": rows}


def lock_own_event(db: Connection, event_id: UUID, user: CurrentUser) -> dict:
    own_event(db, event_id, user)
    return db.execute("select id, capacity from public.events where id = %s for update", (event_id,)).fetchone()


@router.post("/{event_id}/guests/{guest_id}/accept")
def accept_guest(event_id: UUID, guest_id: UUID, user: LoggedIn, db: Db) -> dict:
    """The host lets someone in: they get the ticket and join the group chat. Refused when the spots are full."""
    ev = lock_own_event(db, event_id, user)
    row = db.execute("select status from public.tickets where event_id = %s and user_id = %s for update", (event_id, guest_id)).fetchone()
    if row is None or row["status"] not in ("requested", "declined"):
        raise HTTPException(404, "No request from that person")
    if ev["capacity"] is not None and going_count(db, event_id) >= ev["capacity"]:
        raise HTTPException(409, "All the spots are taken")
    db.execute("update public.tickets set status = 'going', decided_at = now() where event_id = %s and user_id = %s", (event_id, guest_id))
    return {"status": "going", "chat_id": join_chat(db, event_id, guest_id)}


@router.post("/{event_id}/guests/{guest_id}/decline")
def decline_guest(event_id: UUID, guest_id: UUID, user: LoggedIn, db: Db) -> dict:
    lock_own_event(db, event_id, user)
    row = db.execute("update public.tickets set status = 'declined', decided_at = now() where event_id = %s and user_id = %s and status = 'requested' returning 1", (event_id, guest_id)).fetchone()
    if row is None:
        raise HTTPException(404, "No request from that person")
    return {"status": "declined"}


@router.post("/{event_id}/guests/{guest_id}/remove")
def remove_guest(event_id: UUID, guest_id: UUID, user: LoggedIn, db: Db) -> dict:
    """The host takes back a spot from someone already accepted: it frees the spot and removes them from the chat."""
    lock_own_event(db, event_id, user)
    row = db.execute("update public.tickets set status = 'declined', decided_at = now() where event_id = %s and user_id = %s and status = 'going' returning 1", (event_id, guest_id)).fetchone()
    if row is None:
        raise HTTPException(404, "That person isn't going")
    leave_chat(db, event_id, guest_id)
    return {"status": "declined"}
