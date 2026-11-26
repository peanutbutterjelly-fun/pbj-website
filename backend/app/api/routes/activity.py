"""What lives on a profile besides the basics (issue #29): who you follow, Love / Like / Curious on events, your saved lists,
"I went" with a mood and a note, and the recap a host writes after their event.

The tables are in supabase/migrations/…_profile_activity.sql. The website may only READ them (row level security); every
change goes through these routes. The backend connects as the database owner, so each route checks who is asking itself:
  - people only ever change their own follows, reactions, lists and attendances; only an event's host writes its recap.
  - an event counts only if the person may see it: listed (not a draft) and not hidden by staff, or their own.
  - "I went" and recaps are for events that have started (Mumbai time).
  - who can see the events someone went to follows their own choice (profiles.attended_visibility): public, followers, private.
"""

import re
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Response
from psycopg import Connection, errors
from pydantic import BaseModel, Field, field_validator

from app.auth import LoggedIn, OptionalUser
from app.config import get_settings
from app.db import get_db

router = APIRouter(tags=["activity"])
Db = Annotated[Connection, Depends(get_db)]
EventId = Annotated[str, Path(pattern=r"^[a-z0-9-]{3,40}$")]
Handle = Annotated[str, Path(pattern=r"^[A-Za-z0-9_.]{3,30}$")]

TODAY = "(now() at time zone 'Asia/Kolkata')::date"
MAX_LISTS, MAX_ITEMS = 20, 200
PHOTO_NAME = re.compile(r"[A-Za-z0-9._-]+")
PERSON = "handle, full_name, avatar_url, badge"


# ---------- shared checks ----------

def _event(db: Connection, event_id: str, user_id: UUID) -> dict:
    """The event, if this person may see it (listed and not hidden, or their own). 404 otherwise: we don't say whether it exists."""
    row = db.execute(
        f"""select id, host_id, status, coalesce(starts_on, ends_on) <= {TODAY} as started
            from public.events where id = %s
              and (host_id = %s or (status <> 'draft' and hidden_at is null))""",
        (event_id, user_id),
    ).fetchone()
    if row is None:
        raise HTTPException(404, "Event not found")
    return row


def _person(db: Connection, handle: str) -> dict:
    row = db.execute(f"select id, {PERSON}, attended_visibility from public.profiles where lower(handle) = %s", (handle.lower(),)).fetchone()
    if row is None:
        raise HTTPException(404, "Person not found")
    return row


def _own_list(db: Connection, list_id: UUID, user_id: UUID) -> dict:
    row = db.execute("select id, name from public.saved_lists where id = %s and user_id = %s", (list_id, user_id)).fetchone()
    if row is None:
        raise HTTPException(404, "List not found")
    return row


def _blank_is_none(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


# ---------- follows ----------

@router.put("/people/{handle}/follow", status_code=204)
def follow(handle: Handle, user: LoggedIn, db: Db) -> Response:
    them = _person(db, handle)
    if them["id"] == user.id:
        raise HTTPException(422, "You can't follow yourself")
    db.execute("insert into public.follows (follower_id, followee_id) values (%s, %s) on conflict do nothing", (user.id, them["id"]))
    return Response(status_code=204)


@router.delete("/people/{handle}/follow", status_code=204)
def unfollow(handle: Handle, user: LoggedIn, db: Db) -> Response:
    them = _person(db, handle)
    db.execute("delete from public.follows where follower_id = %s and followee_id = %s", (user.id, them["id"]))
    return Response(status_code=204)


@router.get("/people/{handle}/follows")
def follow_counts(handle: Handle, user: OptionalUser, db: Db) -> dict:
    """Follower and following counts are public; whether *you* follow them needs a login."""
    them = _person(db, handle)
    row = db.execute(
        """select (select count(*) from public.follows where followee_id = %(id)s) as followers,
                  (select count(*) from public.follows where follower_id = %(id)s) as following,
                  exists (select 1 from public.follows where follower_id = %(me)s and followee_id = %(id)s) as you_follow""",
        {"id": them["id"], "me": user.id if user else None},
    ).fetchone()
    return {**row, "you_follow": bool(user) and row["you_follow"]}


@router.get("/me/following")
def my_following(user: LoggedIn, db: Db) -> list[dict]:
    return db.execute(
        f"""select {", ".join("p." + c.strip() for c in PERSON.split(","))}, f.created_at as since
            from public.follows f join public.profiles p on p.id = f.followee_id
            where f.follower_id = %s and p.handle is not null order by f.created_at desc""",
        (user.id,),
    ).fetchall()


# ---------- Love / Like / Curious ----------

class ReactionIn(BaseModel):
    kind: Literal["love", "like", "curious"]


@router.put("/events/{event_id}/reaction")
def react(event_id: EventId, body: ReactionIn, user: LoggedIn, db: Db) -> dict:
    """One reaction per person per event; picking another replaces it."""
    _event(db, event_id, user.id)
    return db.execute(
        """insert into public.reactions (user_id, event_id, kind) values (%s, %s, %s)
           on conflict (user_id, event_id) do update set kind = excluded.kind, created_at = now()
           returning event_id, kind, created_at""",
        (user.id, event_id, body.kind),
    ).fetchone()


@router.delete("/events/{event_id}/reaction", status_code=204)
def unreact(event_id: EventId, user: LoggedIn, db: Db) -> Response:
    db.execute("delete from public.reactions where user_id = %s and event_id = %s", (user.id, event_id))
    return Response(status_code=204)


@router.get("/me/reactions")
def my_reactions(user: LoggedIn, db: Db) -> list[dict]:
    return db.execute("select event_id, kind, created_at from public.reactions where user_id = %s order by created_at desc", (user.id,)).fetchall()


# ---------- saved lists ----------

class ListIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)

    @field_validator("name")
    @classmethod
    def tidy(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("needs a name")
        return value


@router.get("/me/lists")
def my_lists(user: LoggedIn, db: Db) -> list[dict]:
    """Your lists, each with the events in it (newest first)."""
    return db.execute(
        """select l.id, l.name, l.created_at,
                  coalesce((select json_agg(i.event_id order by i.created_at desc) from public.saved_items i where i.list_id = l.id), '[]') as events
           from public.saved_lists l where l.user_id = %s order by l.created_at""",
        (user.id,),
    ).fetchall()


@router.post("/me/lists", status_code=201)
def make_list(body: ListIn, user: LoggedIn, db: Db) -> dict:
    if db.execute("select count(*) as n from public.saved_lists where user_id = %s", (user.id,)).fetchone()["n"] >= MAX_LISTS:
        raise HTTPException(422, f"You can have up to {MAX_LISTS} lists")
    try:
        return db.execute("insert into public.saved_lists (user_id, name) values (%s, %s) returning id, name, created_at",
                          (user.id, body.name)).fetchone()
    except errors.UniqueViolation:
        raise HTTPException(409, "You already have a list with that name") from None


@router.patch("/me/lists/{list_id}")
def rename_list(list_id: UUID, body: ListIn, user: LoggedIn, db: Db) -> dict:
    _own_list(db, list_id, user.id)
    try:
        return db.execute("update public.saved_lists set name = %s where id = %s returning id, name, created_at", (body.name, list_id)).fetchone()
    except errors.UniqueViolation:
        raise HTTPException(409, "You already have a list with that name") from None


@router.delete("/me/lists/{list_id}", status_code=204)
def delete_list(list_id: UUID, user: LoggedIn, db: Db) -> Response:
    _own_list(db, list_id, user.id)
    db.execute("delete from public.saved_lists where id = %s", (list_id,))  # its items go with it
    return Response(status_code=204)


@router.put("/me/lists/{list_id}/events/{event_id}", status_code=204)
def save_to_list(list_id: UUID, event_id: EventId, user: LoggedIn, db: Db) -> Response:
    _own_list(db, list_id, user.id)
    _event(db, event_id, user.id)
    if db.execute("select count(*) as n from public.saved_items where list_id = %s", (list_id,)).fetchone()["n"] >= MAX_ITEMS:
        raise HTTPException(422, f"A list holds up to {MAX_ITEMS} events")
    db.execute("insert into public.saved_items (list_id, event_id) values (%s, %s) on conflict do nothing", (list_id, event_id))
    return Response(status_code=204)


@router.delete("/me/lists/{list_id}/events/{event_id}", status_code=204)
def remove_from_list(list_id: UUID, event_id: EventId, user: LoggedIn, db: Db) -> Response:
    _own_list(db, list_id, user.id)
    db.execute("delete from public.saved_items where list_id = %s and event_id = %s", (list_id, event_id))
    return Response(status_code=204)


# ---------- "I went" ----------

class AttendanceIn(BaseModel):
    mood: Literal["loved", "good", "okay", "meh"] | None = None
    note: str | None = Field(default=None, max_length=280)

    @field_validator("note")
    @classmethod
    def tidy_note(cls, value: str | None) -> str | None:
        return _blank_is_none(value)


@router.put("/events/{event_id}/attendance")
def i_went(event_id: EventId, body: AttendanceIn, user: LoggedIn, db: Db) -> dict:
    ev = _event(db, event_id, user.id)
    if not ev["started"]:
        raise HTTPException(409, "You can say you went once the event has started")
    return db.execute(
        """insert into public.attendances (user_id, event_id, mood, note) values (%s, %s, %s, %s)
           on conflict (user_id, event_id) do update set mood = excluded.mood, note = excluded.note
           returning event_id, mood, note, created_at""",
        (user.id, event_id, body.mood, body.note),
    ).fetchone()


@router.delete("/events/{event_id}/attendance", status_code=204)
def didnt_go(event_id: EventId, user: LoggedIn, db: Db) -> Response:
    db.execute("delete from public.attendances where user_id = %s and event_id = %s", (user.id, event_id))
    return Response(status_code=204)


@router.get("/me/attendances")
def my_attendances(user: LoggedIn, db: Db) -> list[dict]:
    return db.execute("select event_id, mood, note, created_at from public.attendances where user_id = %s order by created_at desc", (user.id,)).fetchall()


@router.get("/people/{handle}/attended")
def their_attendances(handle: Handle, user: OptionalUser, db: Db) -> dict:
    """The events someone went to, if their privacy choice lets you see them. Drafts and staff-hidden events are left out."""
    them = _person(db, handle)
    me = user.id if user else None
    allowed = (
        me == them["id"]
        or them["attended_visibility"] == "public"
        or (them["attended_visibility"] == "followers" and me is not None and db.execute(
            "select 1 from public.follows where follower_id = %s and followee_id = %s", (me, them["id"])).fetchone() is not None)
    )
    if not allowed:
        return {"visible": False, "events": []}
    events = db.execute(
        """select a.event_id, e.data->>'title' as title, coalesce(e.starts_on, e.ends_on) as day, a.mood, a.note
           from public.attendances a join public.events e on e.id = a.event_id
           where a.user_id = %s and e.status <> 'draft' and e.hidden_at is null order by day desc nulls last""",
        (them["id"],),
    ).fetchall()
    return {"visible": True, "events": events}


# ---------- the host's recap ----------

class RecapIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
    photos: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("body")
    @classmethod
    def not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("can't be empty")
        return value.strip()


def _own_event_photo(url: str, user_id: UUID) -> bool:
    """A recap photo must be one the host uploaded to their own events folder: <supabase>/storage/v1/object/public/images/<id>/events/<file>."""
    base = get_settings().supabase_url.rstrip("/")
    prefix = f"{base}/storage/v1/object/public/images/{user_id}/events/"
    name = url[len(prefix):]
    return bool(base) and url.startswith(prefix) and PHOTO_NAME.fullmatch(name) is not None and ".." not in name


@router.get("/events/{event_id}/recap")
def read_recap(event_id: EventId, user: OptionalUser, db: Db) -> dict:
    row = db.execute(
        """select r.event_id, r.body, r.photos, r.created_at, r.updated_at from public.event_recaps r join public.events e on e.id = r.event_id
           where r.event_id = %s and (e.host_id = %s or (e.status <> 'draft' and e.hidden_at is null))""",
        (event_id, user.id if user else None),
    ).fetchone()
    if row is None:
        raise HTTPException(404, "No recap yet")
    return row


@router.put("/events/{event_id}/recap")
def write_recap(event_id: EventId, body: RecapIn, user: LoggedIn, db: Db) -> dict:
    ev = _event(db, event_id, user.id)
    if ev["host_id"] != user.id:
        raise HTTPException(403, "Only the event's host writes its recap")
    if not ev["started"]:
        raise HTTPException(409, "You can write the recap once the event has started")
    if any(not _own_event_photo(p, user.id) for p in body.photos):
        raise HTTPException(422, "Recap photos must be uploaded through the site")
    return db.execute(
        """insert into public.event_recaps (event_id, body, photos) values (%s, %s, %s)
           on conflict (event_id) do update set body = excluded.body, photos = excluded.photos
           returning event_id, body, photos, created_at, updated_at""",
        (event_id, body.body, body.photos),
    ).fetchone()


@router.delete("/events/{event_id}/recap", status_code=204)
def delete_recap(event_id: EventId, user: LoggedIn, db: Db) -> Response:
    ev = _event(db, event_id, user.id)
    if ev["host_id"] != user.id:
        raise HTTPException(403, "Only the event's host can delete its recap")
    db.execute("delete from public.event_recaps where event_id = %s", (event_id,))
    return Response(status_code=204)
