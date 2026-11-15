"""Group chats: read one, mark it read, and (for the host only) post an update. Only members of a chat can see it."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from psycopg import Connection
from pydantic import BaseModel, Field

from app.auth import CurrentUser, LoggedIn
from app.db import get_db

router = APIRouter(prefix="/chats", tags=["chats"])
Db = Annotated[Connection, Depends(get_db)]


class UpdateIn(BaseModel):
    body: str = Field(min_length=1, max_length=600)


def membership(db: Connection, chat_id: UUID, user: CurrentUser) -> dict:
    """This person's place in the chat, or 404 (a chat you're not in doesn't reveal that it exists)."""
    row = db.execute("select role, last_read_at from public.chat_members where chat_id = %s and user_id = %s", (chat_id, user.id)).fetchone()
    if row is None:
        raise HTTPException(404, "Chat not found")
    return row


@router.get("/{chat_id}")
def read_chat(chat_id: UUID, user: LoggedIn, db: Db, after: int | None = None) -> dict:
    """The chat and its messages (the latest 100, oldest first). Send `after` (a message id) to get only newer ones."""
    me = membership(db, chat_id, user)
    chat = db.execute(
        """select c.id, c.kind, c.title, c.host_id, e.slug as event_slug, hp.full_name as host_name, hp.handle as host_handle,
                  (select count(*) from public.chat_members x where x.chat_id = c.id) as members
           from public.chats c left join public.events e on e.id = c.event_id join public.profiles hp on hp.id = c.host_id
           where c.id = %s""",
        (chat_id,),
    ).fetchone()
    base = """select m.id, m.kind, m.body, m.created_at, m.sender_id, p.full_name as sender_name, p.handle as sender_handle, p.avatar_url as sender_avatar
              from public.messages m join public.profiles p on p.id = m.sender_id where m.chat_id = %s"""
    if after is None:
        rows = list(reversed(db.execute(base + " order by m.id desc limit 100", (chat_id,)).fetchall()))
    else:
        rows = db.execute(base + " and m.id > %s order by m.id limit 100", (chat_id, after)).fetchall()
    return {**chat, "role": me["role"], "last_read_at": me["last_read_at"], "messages": rows}


@router.post("/{chat_id}/read")
def mark_read(chat_id: UUID, user: LoggedIn, db: Db) -> dict:
    membership(db, chat_id, user)
    db.execute("update public.chat_members set last_read_at = now() where chat_id = %s and user_id = %s", (chat_id, user.id))
    return {"ok": True}


@router.post("/{chat_id}/updates", status_code=201)
def post_update(chat_id: UUID, body: UpdateIn, user: LoggedIn, db: Db) -> dict:
    """The host posts an update. Everyone in the chat gets it the moment it is saved."""
    me = membership(db, chat_id, user)
    if me["role"] != "host":
        raise HTTPException(403, "Only the host can post updates here")
    return db.execute(
        "insert into public.messages (chat_id, sender_id, kind, body) values (%s, %s, 'update', %s) returning id, kind, body, created_at",
        (chat_id, user.id, body.body.strip()),
    ).fetchone()
