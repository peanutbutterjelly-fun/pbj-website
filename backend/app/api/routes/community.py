"""What members and visitors send to, or read from, the back office: reporting something, and PB&J's live picks.
  - POST /api/reports   a signed-in member flags an event, a person, a chat or a message (staff see it in the back office)
  - GET  /api/featured  the "What you missed" highlights and "Lists for you" that staff chose (anyone can read them)
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from psycopg import Connection
from pydantic import BaseModel, Field

from app.auth import LoggedIn
from app.db import get_db

router = APIRouter(tags=["community"])
Db = Annotated[Connection, Depends(get_db)]

DAILY_REPORTS = 20  # per person, so one account can't flood the team


class ReportIn(BaseModel):
    target_kind: Literal["event", "person", "chat", "message"]
    target_id: str = Field(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_.-]+$")
    reason: str = Field(min_length=1, max_length=80)
    note: str | None = Field(default=None, max_length=1000)


@router.post("/reports", status_code=201)
def send_report(body: ReportIn, user: LoggedIn, db: Db) -> dict:
    sent = db.execute("select count(*) as n from public.reports where reporter_id = %s and created_at > now() - interval '1 day'",
                      (user.id,)).fetchone()["n"]
    if sent >= DAILY_REPORTS:
        raise HTTPException(429, "You've sent a lot of reports today. Our team will look at them; try again tomorrow.")
    return db.execute(
        "insert into public.reports (reporter_id, target_kind, target_id, reason, note) values (%s, %s, %s, %s, %s) returning id, status, created_at",
        (user.id, body.target_kind, body.target_id, body.reason.strip(), (body.note or "").strip() or None),
    ).fetchone()


@router.get("/featured")
def featured(db: Db) -> dict:
    rows = db.execute("select id, kind, title, subtitle, query, event_ids from public.featured where live order by position, created_at").fetchall()
    return {"highlights": [r for r in rows if r["kind"] == "highlight"], "lists": [r for r in rows if r["kind"] == "list"]}
