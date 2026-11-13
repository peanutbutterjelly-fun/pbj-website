from typing import Annotated

from fastapi import APIRouter, Depends
from psycopg import Connection

from app.db import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Quick check that the server is up."""
    return {"status": "ok"}


@router.get("/health/db")
def health_db(db: Annotated[Connection, Depends(get_db)]) -> dict[str, str]:
    """Check that the server can reach the database."""
    db.execute("select 1")
    return {"status": "ok", "database": "ok"}
