"""The logged-in person's own profile."""

import re
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from psycopg import Connection, errors
from pydantic import BaseModel, Field, field_validator

from app.auth import LoggedIn
from app.config import get_settings
from app.db import get_db

router = APIRouter(prefix="/me", tags=["me"])
Db = Annotated[Connection, Depends(get_db)]
MUMBAI = timezone(timedelta(hours=5, minutes=30))  # India has one time zone and no daylight saving

COLUMNS = (
    "id, full_name, avatar_url, city, role, phone, host_kind, link, about, wants_call, onboarded_at,"
    " handle, instagram, youtube, x_handle, badge, birthday, created_at, updated_at"
)


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=120)
    avatar_url: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=80)
    phone: str | None = Field(default=None, max_length=40)
    host_kind: str | None = Field(default=None, max_length=80)
    link: str | None = Field(default=None, max_length=300)
    about: str | None = Field(default=None, max_length=600)  # the one short "about me" text, shown on the public profile too
    wants_call: bool | None = None
    onboarded: bool | None = None  # true marks the welcome steps as done (the first time only)
    # Letters, numbers, dots and underscores, 3 to 30 characters. Always saved in lowercase.
    handle: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_.]{3,30}$")
    instagram: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_.]{1,40}$")
    youtube: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_.@-]{1,60}$")
    x_handle: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_]{1,40}$")
    # People pick these three themselves. "pro" and "exclusive" are given by the PB&J team only.
    badge: Literal["vibes", "sponty", "newbie"] | None = None
    birthday: date | None = None

    @field_validator("handle")
    @classmethod
    def lower_handle(cls, value: str | None) -> str | None:
        return value.lower() if value else value

    @field_validator("badge", "city")
    @classmethod
    def not_empty(cls, value: str | None) -> str:
        # these always have a value in the database (sending null is a mistake, not "clear it")
        if value is None:
            raise ValueError("can't be empty")
        return value

    @field_validator("birthday")
    @classmethod
    def real_birthday(cls, value: date | None) -> date | None:
        if value is not None and not (date(1900, 1, 1) <= value <= datetime.now(MUMBAI).date()):
            raise ValueError("must be a real birthday: not in the future, and not before 1900")
        return value


@router.get("")
def read_me(user: LoggedIn, db: Db) -> dict:
    row = db.execute(f"select {COLUMNS} from public.profiles where id = %s", (user.id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Profile not found")
    return {**row, "email": user.email}


PHOTO_NAME = re.compile(r"[A-Za-z0-9._-]+")


def _own_photo(url: str, user_id) -> bool:
    """A profile photo must be one this person uploaded to their own profile folder in our storage:
    <supabase>/storage/v1/object/public/images/<their id>/profile/<file name>. The database checks the same shape."""
    base = get_settings().supabase_url.rstrip("/")
    prefix = f"{base}/storage/v1/object/public/images/{user_id}/profile/"
    name = url[len(prefix):]
    # just a plain file name: no more slashes, no "..", no %-escapes (so an encoded "%2e%2e" can't point elsewhere), no quotes
    return bool(base) and url.startswith(prefix) and PHOTO_NAME.fullmatch(name) is not None and ".." not in name


@router.patch("")
def update_me(body: ProfileUpdate, user: LoggedIn, db: Db) -> dict:
    changes = body.model_dump(exclude_unset=True)
    onboarded = changes.pop("onboarded", None)
    if changes.get("wants_call", False) is None:
        del changes["wants_call"]  # it's always yes or no in the database
    if changes.get("avatar_url") and not _own_photo(changes["avatar_url"], user.id):
        raise HTTPException(422, "Profile photo must be uploaded through the site")
    if onboarded:
        # The welcome step counts as done only with a name and "who are you" (from this request or already saved)
        current = read_me(user, db)
        name = changes["full_name"] if "full_name" in changes else current.get("full_name")
        kind = changes["host_kind"] if "host_kind" in changes else current.get("host_kind")
        if not (name or "").strip() or not (kind or "").strip():
            raise HTTPException(422, "Add your name and who you are first")
    sets = [f"{name} = %({name})s" for name in changes]  # names come from the model, not the user
    if onboarded:
        sets.append("onboarded_at = coalesce(onboarded_at, now())")
    if sets:
        sets = ", ".join(sets)
        try:
            db.execute(f"update public.profiles set {sets} where id = %(id)s", {**changes, "id": user.id})
        except errors.UniqueViolation:
            raise HTTPException(409, "That handle is taken") from None
    return read_me(user, db)
