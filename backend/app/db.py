"""Postgres (Supabase) connection pool.

The backend connects as the database owner, so Supabase's row level security does
NOT apply to it: every route must check who is asking before it reads or writes.
"""

from collections.abc import Iterator

from fastapi import HTTPException
from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.config import get_settings

_pool: ConnectionPool | None = None


def open_pool() -> None:
    global _pool
    url = get_settings().database_url
    if url and _pool is None:
        # prepare_threshold=None keeps it working through Supabase's pooler
        _pool = ConnectionPool(
            url,
            min_size=1,
            max_size=5,
            kwargs={"row_factory": dict_row, "prepare_threshold": None},
            open=True,
        )


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def get_db() -> Iterator[Connection]:
    """FastAPI dependency: one connection per request, committed if the route succeeds."""
    if _pool is None:
        raise HTTPException(status_code=503, detail="Database is not configured")
    with _pool.connection() as conn:
        yield conn
