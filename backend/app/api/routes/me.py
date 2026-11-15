"""The logged-in person's own profile."""

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from psycopg import Connection, errors
from pydantic import BaseModel, Field, field_validator

from app.auth import LoggedIn
from app.config import get_settings
from app.db import get_db

router = APIRouter(prefix="/me", tags=["me"])
Db = Annotated[Connection, Depends(get_db)]

COLUMNS = (
    "id, full_name, avatar_url, city, role, handle, bio, instagram, youtube, x_handle, badge, birthday, "
    "created_at, updated_at"
)


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=120)
    avatar_url: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=80)
    # Letters, numbers, dots and underscores, 3 to 30 characters. Always saved in lowercase.
    handle: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_.]{3,30}$")
    bio: str | None = Field(default=None, max_length=200)
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


@router.get("")
def read_me(user: LoggedIn, db: Db) -> dict:
    row = db.execute(f"select {COLUMNS} from public.profiles where id = %s", (user.id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Profile not found")
    return {**row, "email": user.email}


@router.patch("")
def update_me(body: ProfileUpdate, user: LoggedIn, db: Db) -> dict:
    changes = body.model_dump(exclude_unset=True)
    photo = changes.get("avatar_url")
    if photo:
        # Only a photo from our own storage, in this person's own folder
        prefix = f"{get_settings().supabase_url.rstrip('/')}/storage/v1/object/public/avatars/{user.id}/"
        if not photo.startswith(prefix):
            raise HTTPException(422, "That photo isn't from PB&J storage")
    if changes:
        sets = ", ".join(f"{name} = %({name})s" for name in changes)  # names come from the model, not the user
        try:
            db.execute(f"update public.profiles set {sets} where id = %(id)s", {**changes, "id": user.id})
        except errors.UniqueViolation:
            raise HTTPException(409, "That handle is taken") from None
    return read_me(user, db)
