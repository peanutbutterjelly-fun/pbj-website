"""The logged-in person's own profile."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from psycopg import Connection
from pydantic import BaseModel, Field

from app.auth import LoggedIn
from app.config import get_settings
from app.db import get_db

router = APIRouter(prefix="/me", tags=["me"])
Db = Annotated[Connection, Depends(get_db)]

COLUMNS = (
    "id, full_name, avatar_url, city, role, phone, host_kind, link, about, wants_call,"
    " onboarded_at, created_at, updated_at"
)


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=120)
    avatar_url: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=80)
    phone: str | None = Field(default=None, max_length=40)
    host_kind: str | None = Field(default=None, max_length=80)
    link: str | None = Field(default=None, max_length=300)
    about: str | None = Field(default=None, max_length=600)
    wants_call: bool | None = None
    onboarded: bool | None = None  # true marks the welcome steps as done (the first time only)


@router.get("")
def read_me(user: LoggedIn, db: Db) -> dict:
    row = db.execute(f"select {COLUMNS} from public.profiles where id = %s", (user.id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Profile not found")
    return {**row, "email": user.email}


def _own_photo(url: str, user_id) -> bool:
    """A profile photo must be one this person uploaded to their own folder in our storage."""
    base = get_settings().supabase_url.rstrip("/")
    prefix = f"{base}/storage/v1/object/public/images/{user_id}/"
    rest = url[len(prefix):]
    # no "..", and no %-escapes at all (so an encoded "%2e%2e" can't point into someone else's folder either)
    return bool(base) and url.startswith(prefix) and rest != "" and ".." not in rest and not any(c in rest for c in "\"'<>()% \\?#")


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
        db.execute(f"update public.profiles set {sets} where id = %(id)s", {**changes, "id": user.id})
    return read_me(user, db)
