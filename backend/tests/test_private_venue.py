"""A hidden location ("exact place shared after booking", and every women-only event) stays out of the public event, and
only the host and people with a ticket get it (GET /api/events/<id>/venue). Real (throwaway) Postgres, every migration."""

import json
import uuid

import pytest

psycopg = pytest.importorskip("psycopg")

from tests.test_events_chats import api, as_person, day, person, token  # noqa: E402,F401  (api is a fixture)

PLACE = {"venue": "Studio 4, Kala Ghoda", "venueAddress": "12 Rope Walk Lane, Fort, Mumbai", "venueLat": 18.9285, "venueLon": 72.8318}


def save(pg, host, eid, **extra) -> None:
    """The host saves the event straight to Supabase, the way today's dashboard does (venue inside the public data)."""
    data = {"title": "Women's Pottery Night", "city": "Mumbai", "venueStatus": "Decided", "dateFrom": day(3), "dateTo": day(3),
            "tickets": [{"id": "t1", "type": "guest", "name": "Guest", "paid": False, "qty": "20", "enabled": True, "status": "Live"}],
            **PLACE, **extra}
    with psycopg.connect(pg, autocommit=True) as conn:
        as_person(conn, host)
        conn.execute("insert into public.events (id, status, starts_on, ends_on, data) values (%s, 'published', %s, %s, %s::jsonb) "
                     "on conflict (id) do update set data = excluded.data", (eid, day(3), day(3), json.dumps(data)))
        conn.execute("insert into public.event_private (event_id, data) values (%s, '{\"organizers\": []}') "
                     "on conflict (event_id) do update set data = excluded.data", (eid,))


def public_data(pg, eid) -> dict:
    with psycopg.connect(pg, autocommit=True) as conn:
        conn.execute("set role anon")
        return conn.execute("select data from public.events where id = %s", (eid,)).fetchone()[0]


def test_a_hidden_location_never_reaches_the_public_event(api):
    _, pg = api
    host = person(pg, "pvhost1")
    for flag in ("womenOnly", "hideLocation"):
        eid = f"e{uuid.uuid4().hex[:10]}"
        save(pg, host, eid, **{flag: True})
        seen = public_data(pg, eid)
        assert not set(PLACE) & set(seen), flag  # name, address and map pin are all gone from what visitors can read
        assert seen["venueStatus"] == "Decided" and seen["city"] == "Mumbai"
        save(pg, host, eid, **{flag: True})  # saving again (the private half without a venue) keeps the address
        with psycopg.connect(pg, autocommit=True) as conn:
            assert conn.execute("select data->'venue'->>'venueAddress' from public.event_private where event_id = %s",
                                (eid,)).fetchone()[0] == PLACE["venueAddress"]


def test_an_open_location_stays_public(api):
    _, pg = api
    eid = f"e{uuid.uuid4().hex[:10]}"
    save(pg, person(pg, "pvhost2"), eid)
    assert public_data(pg, eid)["venueAddress"] == PLACE["venueAddress"]


def test_only_the_host_and_ticket_holders_get_the_exact_place(api):
    c, pg = api
    host, guest, stranger = person(pg, "pvhost3"), person(pg, "pvguest3"), person(pg, "pvstranger3")
    eid = f"e{uuid.uuid4().hex[:10]}"
    save(pg, host, eid, womenOnly=True)
    url = f"/api/events/{eid}/venue"
    assert c.get(url).status_code == 401
    assert c.get(url, headers=token(stranger)).status_code == 403
    assert c.get(url, headers=token(host)).json() == PLACE
    assert c.put(f"/api/events/{eid}/ticket", headers=token(guest)).json()["status"] == "going"
    assert c.get(url, headers=token(guest)).json() == PLACE
    c.delete(f"/api/events/{eid}/ticket", headers=token(guest))  # gave the ticket back
    assert c.get(url, headers=token(guest)).status_code == 403
