"""Profile activity tables (follows, reactions, saved lists, "I went", recaps), checked in a real (throwaway) Postgres with every
migration applied: they link to dashboard events (text ids), and the website can only read what each person may see."""

import uuid

import pytest

psycopg = pytest.importorskip("psycopg")


def person(conn):
    uid = uuid.uuid4()
    conn.execute("insert into auth.users (id, email) values (%s, %s)", (uid, f"{uid}@x.com"))
    return uid


def as_person(conn, uid):
    conn.execute("set role authenticated")
    conn.execute("select set_config('request.jwt.claim.sub', %s, false)", (str(uid),))


def test_activity_links_to_dashboard_events_and_stays_private(pg):
    with psycopg.connect(pg, autocommit=True) as conn:
        host, asha, ravi = person(conn), person(conn), person(conn)
        conn.execute("insert into public.events (id, host_id, status, data) values ('eact1', %s, 'published', '{}')", (host,))
        conn.execute("insert into public.reactions (user_id, event_id, kind) values (%s, 'eact1', 'love')", (asha,))
        conn.execute("insert into public.attendances (user_id, event_id, mood) values (%s, 'eact1', 'loved')", (asha,))
        conn.execute("insert into public.event_recaps (event_id, body) values ('eact1', 'What a night')")
        try:
            as_person(conn, ravi)
            assert conn.execute("select count(*) from public.reactions").fetchone()[0] == 0  # someone else's reactions are private
            assert conn.execute("select count(*) from public.event_recaps").fetchone()[0] == 1  # a published event's recap is readable
            with pytest.raises(psycopg.errors.InsufficientPrivilege):  # the website never writes these; the server does
                conn.execute("insert into public.reactions (user_id, event_id, kind) values (%s, 'eact1', 'like')", (ravi,))
        finally:
            conn.execute("reset role")
        # deleting the event takes its activity with it
        conn.execute("delete from public.events where id = 'eact1'")
        assert conn.execute("select count(*) from public.reactions where event_id = 'eact1'").fetchone()[0] == 0
