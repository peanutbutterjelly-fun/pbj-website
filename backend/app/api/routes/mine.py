"""What the logged-in person has: their tickets and their group chats."""

from typing import Annotated

from fastapi import APIRouter, Depends
from psycopg import Connection

from app.auth import LoggedIn
from app.db import get_db

router = APIRouter(prefix="/me", tags=["me"])
Db = Annotated[Connection, Depends(get_db)]


@router.get("/tickets")
def my_tickets(user: LoggedIn, db: Db) -> list[dict]:
    """Events I'm going to, soonest first, with the group chat for each."""
    return db.execute(
        """select e.id, e.slug, e.title, e.area, e.venue, e.starts_at, e.ends_at, e.status, c.id as chat_id
           from public.tickets t join public.events e on e.id = t.event_id left join public.chats c on c.event_id = e.id
           where t.user_id = %s and t.status = 'going' order by e.starts_at""",
        (user.id,),
    ).fetchall()


@router.get("/chats")
def my_chats(user: LoggedIn, db: Db) -> list[dict]:
    """My group chats, most recent activity first, with the last message and how many updates I haven't read."""
    return db.execute(
        """select c.id, c.kind, c.title, m.role, e.slug as event_slug,
                  (select count(*) from public.chat_members x where x.chat_id = c.id) as members,
                  lm.body as last_body, lm.kind as last_kind, lm.created_at as last_at,
                  (select count(*) from public.messages u where u.chat_id = c.id and u.kind = 'update'
                     and u.sender_id <> m.user_id and u.created_at > m.last_read_at) as unread
           from public.chat_members m join public.chats c on c.id = m.chat_id left join public.events e on e.id = c.event_id
           left join lateral (select body, kind, created_at from public.messages where chat_id = c.id order by id desc limit 1) lm on true
           where m.user_id = %s order by coalesce(lm.created_at, c.created_at) desc""",
        (user.id,),
    ).fetchall()
