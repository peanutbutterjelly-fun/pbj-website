"""What anyone can see about a person: their public profile page. No login needed, and never their email or birthday."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path
from psycopg import Connection

from app.db import get_db

router = APIRouter(prefix="/people", tags=["people"])
Db = Annotated[Connection, Depends(get_db)]

PUBLIC_COLUMNS = "handle, full_name, avatar_url, city, badge, bio, instagram, youtube, x_handle, created_at"


@router.get("/{handle}")
def read_person(db: Db, handle: Annotated[str, Path(pattern=r"^[A-Za-z0-9_.]{3,30}$")]) -> dict:
    row = db.execute(f"select {PUBLIC_COLUMNS} from public.profiles where lower(handle) = %s", (handle.lower(),)).fetchone()
    if row is None:
        raise HTTPException(404, "Person not found")
    return row
