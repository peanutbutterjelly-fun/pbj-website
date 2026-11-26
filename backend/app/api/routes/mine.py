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
    """My tickets and requests, soonest first, with the group chat for each. Cancelled events stay here (with their
    status) so people find out; tickets the person gave back or the host declined don't."""
    return db.execute(
        """select e.id as event_id, e.status as event_status, e.starts_on, e.ends_on, e.data->>'title' as title,
                  e.data->>'city' as city, t.status, c.id as chat_id
           from public.tickets t join public.events e on e.id = t.event_id
           left join public.chats c on c.event_id = e.id
             and exists (select 1 from public.chat_members m where m.chat_id = c.id and m.user_id = t.user_id)
           where t.user_id = %s and t.status in ('going', 'requested') order by e.starts_on nulls last""",
        (user.id,),
    ).fetchall()


@router.get("/chats")
def my_chats(user: LoggedIn, db: Db) -> list[dict]:
    """My group chats, most recent activity first, with the last message and how many updates I haven't read."""
    return db.execute(
        """select c.id, c.title, m.role, c.event_id,
                  (select count(*) from public.chat_members x where x.chat_id = c.id) as members,
                  lm.body as last_body, lm.kind as last_kind, lm.created_at as last_at,
                  (select count(*) from public.messages u where u.chat_id = c.id and u.kind = 'update'
                     and u.sender_id <> m.user_id and u.created_at > m.last_read_at) as unread
           from public.chat_members m join public.chats c on c.id = m.chat_id
           left join lateral (select body, kind, created_at from public.messages where chat_id = c.id order by id desc limit 1) lm on true
           where m.user_id = %s order by coalesce(lm.created_at, c.created_at) desc""",
        (user.id,),
    ).fetchall()
