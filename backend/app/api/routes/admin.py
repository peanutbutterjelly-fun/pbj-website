"""The back office: what PB&J staff use to run the platform (the screen lives at backoffice.peanutbutterjelly.fun).

Every route here needs the back office login (admin_auth.py); anyone else gets 401 and never sees a thing.
  - overview: the numbers on the first screen
  - events: every event (drafts too), mark one reviewed, hide it from the site (with a reason) or bring it back, delete it
  - people: find anyone, make them a host, give a badge, mark them identity-verified by hand
  - leads: the List Your Event sign-ups and forms
  - reports: what members flagged, and marking them done
  - featured: the "What you missed" highlights and "Lists for you" on Spontys
  - broadcasts: announcements to everyone (saved now, sent once real notifications exist)
  - messages: read an event's group chat and remove a message
"""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from psycopg import Connection
from pydantic import BaseModel, Field

from app.admin_auth import Staff, staff
from app.db import get_db

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(staff)])
Db = Annotated[Connection, Depends(get_db)]
EventId = Annotated[str, Path(pattern=r"^[a-z0-9-]{3,40}$")]
Limit = Annotated[int, Query(ge=1, le=200)]
Search = Annotated[str | None, Query(max_length=80)]


def like(q: str | None) -> str | None:
    """A search box value as a case-insensitive "contains" pattern (its own % and _ count as plain letters)."""
    if not q or not q.strip():
        return None
    return "%" + q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def one(row: dict | None, what: str) -> dict:
    if row is None:
        raise HTTPException(404, f"{what} not found")
    return row


@router.post("/login")
def login(who: Staff) -> dict:
    """The screen calls this to check the username and password before showing anything."""
    return {"ok": True, "username": who}


@router.get("/overview")
def overview(db: Db) -> dict:
    return db.execute(
        """select
             (select count(*) from public.profiles) as people,
             (select count(*) from public.profiles where role = 'host') as hosts,
             (select count(*) from public.profiles where verified_at is not null) as verified,
             (select count(*) from public.events) as events,
             (select count(*) from public.events where status in ('published', 'coming', 'soldout') and hidden_at is null) as live_events,
             (select count(*) from public.events where reviewed_at is null and status <> 'draft') as to_review,
             (select count(*) from public.events where hidden_at is not null) as hidden_events,
             (select count(*) from public.reports where status = 'open') as open_reports,
             (select count(*) from public.leads) as leads,
             (select count(*) from public.leads where created_at > now() - interval '7 days') as leads_this_week,
             (select count(*) from public.tickets where status = 'going') as tickets"""
    ).fetchone()


# ---- events ----

EVENT_COLUMNS = """e.id, e.status, e.starts_on, e.ends_on, e.created_at, e.updated_at, e.reviewed_at, e.hidden_at, e.hidden_reason,
                   e.data->>'title' as title, e.data->>'type' as type, e.data->>'city' as city, e.data->'images'->>0 as cover,
                   e.host_id, p.full_name as host_name, p.handle as host_handle, u.email as host_email,
                   (select count(*) from public.tickets t where t.event_id = e.id and t.status = 'going') as going,
                   (select count(*) from public.reports r where r.target_kind = 'event' and r.target_id = e.id and r.status = 'open') as open_reports"""
EVENT_FROM = "from public.events e left join public.profiles p on p.id = e.host_id left join auth.users u on u.id = e.host_id"


@router.get("/events")
def list_events(db: Db, q: Search = None, show: Literal["all", "to_review", "live", "hidden", "draft"] = "all", limit: Limit = 100) -> list[dict]:
    where = {
        "all": "true",
        "to_review": "e.reviewed_at is null and e.status <> 'draft'",
        "live": "e.status in ('published', 'coming', 'soldout') and e.hidden_at is null",
        "hidden": "e.hidden_at is not null",
        "draft": "e.status = 'draft'",
    }[show]
    pattern = like(q)
    if pattern:
        where += " and (e.data->>'title' ilike %(q)s or e.id ilike %(q)s or p.full_name ilike %(q)s or u.email ilike %(q)s)"
    return db.execute(f"select {EVENT_COLUMNS} {EVENT_FROM} where {where} order by e.created_at desc limit %(limit)s",
                      {"q": pattern, "limit": limit}).fetchall()


@router.get("/events/{event_id}")
def read_event(event_id: EventId, db: Db) -> dict:
    """One event in full: everything guests see (data), who's going, and its chat. Not its private bank or PAN details."""
    ev = one(db.execute(f"select {EVENT_COLUMNS}, e.data {EVENT_FROM} where e.id = %s", (event_id,)).fetchone(), "Event")
    chat = db.execute("select id, title, (select count(*) from public.chat_members m where m.chat_id = c.id) as members "
                      "from public.chats c where c.event_id = %s", (event_id,)).fetchone()
    return {**ev, "chat": chat}


class HideIn(BaseModel):
    reason: str = Field(min_length=1, max_length=300)


@router.post("/events/{event_id}/review")
def review_event(event_id: EventId, db: Db) -> dict:
    """Staff looked at this event and it's fine (it leaves the "to review" list)."""
    return one(db.execute("update public.events set reviewed_at = now() where id = %s returning id, reviewed_at", (event_id,)).fetchone(), "Event")


@router.post("/events/{event_id}/hide")
def hide_event(event_id: EventId, body: HideIn, db: Db) -> dict:
    """Take an event off the site: it leaves the Events page and its link, and takes no new tickets. Its host still sees it."""
    return one(db.execute("update public.events set hidden_at = now(), hidden_reason = %s, reviewed_at = now() where id = %s "
                          "returning id, hidden_at, hidden_reason", (body.reason.strip(), event_id)).fetchone(), "Event")


@router.post("/events/{event_id}/unhide")
def unhide_event(event_id: EventId, db: Db) -> dict:
    return one(db.execute("update public.events set hidden_at = null, hidden_reason = null where id = %s returning id, hidden_at",
                          (event_id,)).fetchone(), "Event")


@router.delete("/events/{event_id}", status_code=204)
def delete_event(event_id: EventId, db: Db, confirm: Annotated[str, Query()] = "") -> None:
    """Deletes an event for good, with its private details, tickets and chat. Needs ?confirm=DELETE."""
    if confirm != "DELETE":
        raise HTTPException(400, "Send confirm=DELETE to delete an event for good")
    one(db.execute("delete from public.events where id = %s returning id", (event_id,)).fetchone(), "Event")


# ---- people ----

PERSON_COLUMNS = """p.id, p.full_name, p.handle, p.avatar_url, p.city, p.role, p.badge, p.host_kind, p.link, p.phone, p.verified_at,
                    p.onboarded_at, p.created_at, u.email,
                    (select count(*) from public.events e where e.host_id = p.id) as events,
                    (select count(*) from public.tickets t where t.user_id = p.id and t.status = 'going') as tickets"""


@router.get("/people")
def list_people(db: Db, q: Search = None, show: Literal["all", "hosts", "unverified_hosts", "verified"] = "all", limit: Limit = 100) -> list[dict]:
    where = {
        "all": "true",
        "hosts": "p.role = 'host'",
        "unverified_hosts": "(p.role = 'host' or p.host_kind is not null) and p.verified_at is null",
        "verified": "p.verified_at is not null",
    }[show]
    pattern = like(q)
    if pattern:
        where += " and (p.full_name ilike %(q)s or p.handle ilike %(q)s or u.email ilike %(q)s or p.phone ilike %(q)s)"
    return db.execute(f"select {PERSON_COLUMNS} from public.profiles p left join auth.users u on u.id = p.id "
                      f"where {where} order by p.created_at desc limit %(limit)s", {"q": pattern, "limit": limit}).fetchall()


class PersonChange(BaseModel):
    role: Literal["guest", "host", "admin"] | None = None
    badge: Literal["vibes", "sponty", "newbie", "pro", "exclusive"] | None = None
    verified: bool | None = None


@router.patch("/people/{person_id}")
def change_person(person_id: UUID, body: PersonChange, db: Db) -> dict:
    """Make someone a host (approve them), give them a badge, or mark them identity-verified (or not)."""
    sets, args = [], {"id": person_id}
    if body.role is not None:
        sets.append("role = %(role)s")
        args["role"] = body.role
    if body.badge is not None:
        sets.append("badge = %(badge)s")
        args["badge"] = body.badge
    if body.verified is not None:
        sets.append("verified_at = " + ("coalesce(verified_at, now())" if body.verified else "null"))
    if not sets:
        raise HTTPException(422, "Nothing to change")
    return one(db.execute(f"update public.profiles set {', '.join(sets)} where id = %(id)s returning id, role, badge, verified_at",
                          args).fetchone(), "Person")


# ---- leads ----

@router.get("/leads")
def list_leads(db: Db, q: Search = None, kind: Literal["all", "signup", "form"] = "all", limit: Limit = 200) -> list[dict]:
    where, pattern = ("true" if kind == "all" else "kind = %(kind)s"), like(q)
    if pattern:
        where += " and (name ilike %(q)s or email ilike %(q)s or role ilike %(q)s or message ilike %(q)s)"
    return db.execute(f"select id, created_at, kind, role, name, email, phone, link, message, answers, page, user_id from public.leads "
                      f"where {where} order by created_at desc limit %(limit)s", {"kind": kind, "q": pattern, "limit": limit}).fetchall()


# ---- reports ----

@router.get("/reports")
def list_reports(db: Db, show: Literal["open", "resolved", "dismissed", "all"] = "open", limit: Limit = 100) -> list[dict]:
    where = "true" if show == "all" else "r.status = %(show)s"
    return db.execute(
        f"""select r.id, r.target_kind, r.target_id, r.reason, r.note, r.status, r.created_at, r.resolved_at,
                   p.full_name as reporter_name, p.handle as reporter_handle,
                   case r.target_kind
                     when 'event' then (select e.data->>'title' from public.events e where e.id = r.target_id)
                     when 'person' then (select coalesce(t.full_name, t.handle) from public.profiles t where t.id::text = r.target_id)
                     when 'chat' then (select c.title from public.chats c where c.id::text = r.target_id)
                     when 'message' then (select left(m.body, 120) from public.messages m where m.id::text = r.target_id)
                   end as target_label
            from public.reports r left join public.profiles p on p.id = r.reporter_id
            where {where} order by r.created_at desc limit %(limit)s""",
        {"show": show, "limit": limit},
    ).fetchall()


class ReportChange(BaseModel):
    status: Literal["open", "resolved", "dismissed"]


@router.patch("/reports/{report_id}")
def change_report(report_id: UUID, body: ReportChange, db: Db) -> dict:
    return one(db.execute("update public.reports set status = %s, resolved_at = case when %s = 'open' then null else now() end "
                          "where id = %s returning id, status, resolved_at", (body.status, body.status, report_id)).fetchone(), "Report")


# ---- PB&J picks: highlights and lists ----

FEATURED_COLUMNS = "id, kind, title, subtitle, query, event_ids, position, live, created_at, updated_at"


class FeaturedIn(BaseModel):
    kind: Literal["highlight", "list"]
    title: str = Field(min_length=1, max_length=80)
    subtitle: str | None = Field(default=None, max_length=160)
    query: str | None = Field(default=None, max_length=120)
    event_ids: list[Annotated[str, Field(pattern=r"^[a-z0-9-]{3,40}$")]] = Field(default_factory=list, max_length=40)
    position: int = Field(default=0, ge=0, le=1000)
    live: bool = True


@router.get("/featured")
def list_featured(db: Db) -> list[dict]:
    return db.execute(f"select {FEATURED_COLUMNS} from public.featured order by kind, position, created_at").fetchall()


@router.post("/featured", status_code=201)
def add_featured(body: FeaturedIn, db: Db) -> dict:
    return db.execute(f"insert into public.featured (kind, title, subtitle, query, event_ids, position, live) "
                      f"values (%(kind)s, %(title)s, %(subtitle)s, %(query)s, %(event_ids)s, %(position)s, %(live)s) returning {FEATURED_COLUMNS}",
                      body.model_dump()).fetchone()


@router.put("/featured/{featured_id}")
def change_featured(featured_id: UUID, body: FeaturedIn, db: Db) -> dict:
    return one(db.execute(f"update public.featured set kind = %(kind)s, title = %(title)s, subtitle = %(subtitle)s, query = %(query)s, "
                          f"event_ids = %(event_ids)s, position = %(position)s, live = %(live)s where id = %(id)s returning {FEATURED_COLUMNS}",
                          {**body.model_dump(), "id": featured_id}).fetchone(), "Pick")


@router.delete("/featured/{featured_id}", status_code=204)
def remove_featured(featured_id: UUID, db: Db) -> None:
    one(db.execute("delete from public.featured where id = %s returning id", (featured_id,)).fetchone(), "Pick")


# ---- broadcasts ----

class BroadcastIn(BaseModel):
    audience: Literal["everyone", "hosts", "members"] = "everyone"
    title: str = Field(min_length=1, max_length=80)
    body: str = Field(min_length=1, max_length=600)


@router.get("/broadcasts")
def list_broadcasts(db: Db, limit: Limit = 50) -> list[dict]:
    return db.execute("select id, audience, title, body, created_at from public.broadcasts order by created_at desc limit %s", (limit,)).fetchall()


@router.post("/broadcasts", status_code=201)
def add_broadcast(body: BroadcastIn, db: Db) -> dict:
    if not body.body.strip() or not body.title.strip():
        raise HTTPException(422, "Write a title and a message")
    return db.execute("insert into public.broadcasts (audience, title, body) values (%s, %s, %s) returning id, audience, title, body, created_at",
                      (body.audience, body.title.strip(), body.body.strip())).fetchone()


# ---- group chats ----

@router.get("/events/{event_id}/messages")
def event_messages(event_id: EventId, db: Db, limit: Limit = 100) -> list[dict]:
    """An event's group chat, newest first."""
    return db.execute(
        """select m.id, m.kind, m.body, m.created_at, p.full_name as sender_name, p.handle as sender_handle
           from public.messages m join public.chats c on c.id = m.chat_id left join public.profiles p on p.id = m.sender_id
           where c.event_id = %s order by m.id desc limit %s""",
        (event_id, limit),
    ).fetchall()


@router.delete("/messages/{message_id}", status_code=204)
def remove_message(message_id: Annotated[int, Path(ge=1)], db: Db) -> None:
    one(db.execute("delete from public.messages where id = %s returning id", (message_id,)).fetchone(), "Message")
