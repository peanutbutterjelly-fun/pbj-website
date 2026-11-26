"""Free tickets, the host's guest list and group chats, run against a real (throwaway) Postgres with every migration
applied (the `pg` fixture in conftest.py), so the SQL, the rules and the row locks are all checked.
Events are made the way the dashboard makes them: by the host, straight into public.events under its row level security."""

import json
import threading
import time
import uuid
from datetime import date, timedelta

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

psycopg = pytest.importorskip("psycopg")
from psycopg.rows import dict_row  # noqa: E402

from app import auth  # noqa: E402
from app.db import get_db  # noqa: E402
from app.main import app  # noqa: E402

ISSUER = "https://test.supabase.co/auth/v1"
KEY = ec.generate_private_key(ec.SECP256R1())


class FakeJwks:
    def get_signing_key_from_jwt(self, _token):
        return type("K", (), {"key": KEY.public_key()})()


def token(user_id) -> dict:
    claims = {"sub": str(user_id), "email": "x@y.com", "aud": "authenticated", "iss": ISSUER, "exp": int(time.time()) + 600}
    return {"Authorization": "Bearer " + jwt.encode(claims, KEY, algorithm="ES256")}


@pytest.fixture
def api(pg, monkeypatch):
    monkeypatch.setattr(auth, "_jwks_client", lambda: FakeJwks())

    def db():
        conn = psycopg.connect(pg, row_factory=dict_row)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    app.dependency_overrides[get_db] = db
    yield TestClient(app), pg
    app.dependency_overrides.clear()


def person(pg, name) -> uuid.UUID:
    """A signed-up person with a handle (the sign-up trigger makes their profile)."""
    uid = uuid.uuid4()
    with psycopg.connect(pg, autocommit=True) as conn:
        conn.execute("insert into auth.users (id, email, raw_user_meta_data) values (%s, %s, %s::jsonb)",
                     (uid, f"{name}@x.com", json.dumps({"full_name": name})))
        conn.execute("update public.profiles set handle = %s where id = %s", (name.lower(), uid))
    return uid


def as_person(conn, uid):
    conn.execute("set role authenticated")
    conn.execute("select set_config('request.jwt.claim.sub', %s, false)", (str(uid),))


def day(offset: int) -> str:
    return (date.today() + timedelta(days=offset)).isoformat()


def event(pg, host, kind="open", status="published", qty=50, tickets=None, start=3, end=None) -> str:
    """An event saved the way the dashboard saves it: the host writes it straight to Supabase."""
    eid = f"e{uuid.uuid4().hex[:10]}"
    tickets = tickets if tickets is not None else [{"id": "t1", "type": "guest", "name": "Guest Ticket", "paid": False, "qty": str(qty),
                                                    "enabled": True, "status": "Live"}]
    data = {"id": eid, "type": kind, "title": "Clay and Chai Night", "city": "Mumbai", "dateFrom": day(start),
            "dateTo": day(end if end is not None else start), "tickets": tickets}
    with psycopg.connect(pg, autocommit=True) as conn:
        as_person(conn, host)
        conn.execute("insert into public.events (id, status, starts_on, ends_on, data) values (%s, %s, %s, %s, %s::jsonb)",
                     (eid, status, day(start), day(end if end is not None else start), json.dumps(data)))
    return eid


def set_status(pg, host, eid, status):
    with psycopg.connect(pg, autocommit=True) as conn:
        as_person(conn, host)
        conn.execute("update public.events set status = %s where id = %s", (status, eid))


def guests(c, host, eid):
    return c.get(f"/api/events/{eid}/guests", headers=token(host)).json()["guests"]


# ---- tickets ----

def test_a_ticket_opens_the_chat_and_is_safe_to_repeat(api):
    c, pg = api
    host, fan = person(pg, "host1"), person(pg, "fan1")
    eid = event(pg, host)
    assert c.put(f"/api/events/{eid}/ticket").status_code == 401
    first = c.put(f"/api/events/{eid}/ticket", headers=token(fan))
    assert first.status_code == 200 and first.json()["status"] == "going"
    chat_id = first.json()["chat_id"]
    again = c.put(f"/api/events/{eid}/ticket", headers=token(fan))
    assert again.json() == {"status": "going", "chat_id": chat_id}
    state = c.get(f"/api/events/{eid}/rsvp", headers=token(fan)).json()
    assert state["going"] == 1 and state["spots_left"] == 49 and state["me"]["ticket"] == "going" and state["open"] is True
    mine = c.get("/api/me/tickets", headers=token(fan)).json()
    assert [(t["event_id"], t["status"], t["chat_id"]) for t in mine] == [(eid, "going", chat_id)]
    chat = c.get(f"/api/chats/{chat_id}", headers=token(host)).json()
    assert chat["role"] == "host" and chat["members"] == 2 and chat["host_handle"] == "host1"
    assert chat["messages"][0]["kind"] == "system"


def test_only_published_upcoming_events_with_free_tickets_take_rsvps(api):
    c, pg = api
    host, fan = person(pg, "host2"), person(pg, "fan2")
    cases = {
        event(pg, host, status="draft"): 404,
        event(pg, host, status="coming"): 409,
        event(pg, host, status="soldout"): 409,
        event(pg, host, status="cancelled"): 409,
        event(pg, host, start=-3, end=-1): 409,  # already happened
        event(pg, host, tickets=[{"name": "VIP", "paid": True, "qty": "10", "price": "999"}]): 409,  # paid only
        event(pg, host, tickets=[{"name": "Guest", "paid": False, "qty": "10", "enabled": False}]): 409,  # switched off
        "no-such-event": 404,
    }
    for eid, code in cases.items():
        assert c.put(f"/api/events/{eid}/ticket", headers=token(fan)).status_code == code, eid
    assert c.put(f"/api/events/{event(pg, host, start=0)}/ticket", headers=token(fan)).status_code == 200  # today still counts
    assert c.put(f"/api/events/{event(pg, host, start=-2, end=1)}/ticket", headers=token(fan)).status_code == 200  # still running
    assert c.put("/api/events/BAD ID/ticket", headers=token(fan)).status_code == 422


def test_the_host_cant_take_their_own_ticket(api):
    c, pg = api
    host = person(pg, "host3")
    assert c.put(f"/api/events/{event(pg, host)}/ticket", headers=token(host)).status_code == 409


def test_the_last_spot_goes_to_one_person_only(api):
    c, pg = api
    host, a, b = person(pg, "host4"), person(pg, "fan4a"), person(pg, "fan4b")
    eid = event(pg, host, qty=1)
    assert c.put(f"/api/events/{eid}/ticket", headers=token(a)).status_code == 200
    full = c.put(f"/api/events/{eid}/ticket", headers=token(b))
    assert full.status_code == 409 and "full" in full.json()["detail"]
    assert c.get(f"/api/events/{eid}/rsvp").json()["spots_left"] == 0
    assert c.delete(f"/api/events/{eid}/ticket", headers=token(a)).status_code == 200  # a gives it back
    assert c.put(f"/api/events/{eid}/ticket", headers=token(b)).status_code == 200  # now b can have it


def test_two_people_grabbing_the_last_spot_at_once(api):
    c, pg = api
    host = person(pg, "host5")
    fans = [person(pg, f"fan5{i}") for i in range(6)]
    eid = event(pg, host, qty=1)
    results, start = [], threading.Barrier(len(fans))

    def grab(uid):
        start.wait()
        results.append(c.put(f"/api/events/{eid}/ticket", headers=token(uid)).status_code)

    threads = [threading.Thread(target=grab, args=(f,)) for f in fans]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(results) == [200] + [409] * (len(fans) - 1)


def test_giving_a_ticket_back_leaves_the_chat(api):
    c, pg = api
    host, fan = person(pg, "host6"), person(pg, "fan6")
    eid = event(pg, host)
    chat_id = c.put(f"/api/events/{eid}/ticket", headers=token(fan)).json()["chat_id"]
    c.delete(f"/api/events/{eid}/ticket", headers=token(fan))
    assert c.get(f"/api/chats/{chat_id}", headers=token(fan)).status_code == 404
    assert c.get("/api/me/tickets", headers=token(fan)).json() == []
    assert c.get(f"/api/chats/{chat_id}", headers=token(host)).json()["members"] == 1  # the host stays


def test_nobody_reads_another_persons_tickets(api):
    c, pg = api
    host, fan, other = person(pg, "host7"), person(pg, "fan7"), person(pg, "other7")
    c.put(f"/api/events/{event(pg, host)}/ticket", headers=token(fan))
    assert len(c.get("/api/me/tickets", headers=token(fan)).json()) == 1
    assert c.get("/api/me/tickets", headers=token(other)).json() == []
    assert c.get("/api/me/tickets").status_code == 401


def test_a_cancelled_event_tells_the_chat_and_stays_with_ticket_holders(api):
    c, pg = api
    host, fan = person(pg, "host8"), person(pg, "fan8")
    eid = event(pg, host)
    chat_id = c.put(f"/api/events/{eid}/ticket", headers=token(fan)).json()["chat_id"]
    set_status(pg, host, eid, "cancelled")  # done in the dashboard
    assert "cancelled" in c.get(f"/api/chats/{chat_id}", headers=token(fan)).json()["messages"][-1]["body"]
    assert [(t["event_id"], t["event_status"]) for t in c.get("/api/me/tickets", headers=token(fan)).json()] == [(eid, "cancelled")]
    with psycopg.connect(pg, autocommit=True) as conn:  # and the browser can still read the event itself
        as_person(conn, fan)
        assert conn.execute("select status from public.events where id = %s", (eid,)).fetchone() == ("cancelled",)
        set_status(pg, host, eid, "draft")  # even if the host hides it again
        assert conn.execute("select status from public.events where id = %s", (eid,)).fetchone() == ("draft",)
        as_person(conn, person(pg, "stranger8"))
        assert conn.execute("select status from public.events where id = %s", (eid,)).fetchone() is None


# ---- Sponty events (guestlist): asking, and the host accepting or declining ----

def test_a_sponty_event_takes_requests_not_tickets(api):
    c, pg = api
    host, fan = person(pg, "host9"), person(pg, "fan9")
    eid = event(pg, host, kind="guestlist", qty=2)
    r = c.put(f"/api/events/{eid}/ticket", json={"note": "I know the route well"}, headers=token(fan))
    assert r.json() == {"status": "requested", "chat_id": None}
    assert c.get(f"/api/events/{eid}/rsvp").json()["going"] == 0  # a request doesn't take a spot
    assert c.get("/api/me/tickets", headers=token(fan)).json()[0]["status"] == "requested"


def test_the_host_accepts_declines_and_removes(api):
    c, pg = api
    host, a, b = person(pg, "host10"), person(pg, "fan10a"), person(pg, "fan10b")
    eid = event(pg, host, kind="guestlist", qty=1)
    for who, note in ((a, "first"), (b, "second")):
        c.put(f"/api/events/{eid}/ticket", json={"note": note}, headers=token(who))
    seen = c.get(f"/api/events/{eid}/guests", headers=token(host)).json()
    assert seen["spots_left"] == 1 and [g["handle"] for g in seen["guests"]] == ["fan10a", "fan10b"]
    assert "user_id" not in seen["guests"][0] and seen["guests"][0]["note"] == "first"
    ta, tb = (g["ticket_id"] for g in seen["guests"])
    ok = c.post(f"/api/events/{eid}/guests/{ta}/accept", headers=token(host))
    assert ok.status_code == 200 and c.get(f"/api/chats/{ok.json()['chat_id']}", headers=token(a)).status_code == 200
    full = c.post(f"/api/events/{eid}/guests/{tb}/accept", headers=token(host))
    assert full.status_code == 409 and "taken" in full.json()["detail"]
    assert c.post(f"/api/events/{eid}/guests/{tb}/decline", headers=token(host)).status_code == 200
    assert c.put(f"/api/events/{eid}/ticket", headers=token(b)).status_code == 403  # can't ask again after a decline
    assert c.post(f"/api/events/{eid}/guests/{ta}/remove", headers=token(host)).status_code == 200
    assert c.get(f"/api/chats/{ok.json()['chat_id']}", headers=token(a)).status_code == 404
    assert c.post(f"/api/events/{eid}/guests/{tb}/accept", headers=token(host)).status_code == 200  # the freed spot goes to b


def test_a_non_host_cant_see_or_decide_guests(api):
    c, pg = api
    host, fan, other = person(pg, "host11"), person(pg, "fan11"), person(pg, "other11")
    eid = event(pg, host, kind="guestlist")
    c.put(f"/api/events/{eid}/ticket", headers=token(fan))
    ticket = guests(c, host, eid)[0]["ticket_id"]
    for who in (fan, other):
        assert c.get(f"/api/events/{eid}/guests", headers=token(who)).status_code == 404
        for action in ("accept", "decline", "remove"):
            assert c.post(f"/api/events/{eid}/guests/{ticket}/{action}", headers=token(who)).status_code == 404
    assert c.post(f"/api/events/{eid}/guests/{ticket}/accept").status_code == 401
    # a ticket from another event can't be decided through this one
    other_event = event(pg, other, kind="guestlist")
    assert c.post(f"/api/events/{other_event}/guests/{ticket}/accept", headers=token(other)).status_code == 404
    assert guests(c, host, eid)[0]["status"] == "requested"


def test_accepting_needs_a_listed_upcoming_event(api):
    c, pg = api
    host, fan = person(pg, "host12"), person(pg, "fan12")
    eid = event(pg, host, kind="guestlist")
    c.put(f"/api/events/{eid}/ticket", headers=token(fan))
    ticket = guests(c, host, eid)[0]["ticket_id"]
    for status in ("cancelled", "draft"):
        set_status(pg, host, eid, status)
        assert c.post(f"/api/events/{eid}/guests/{ticket}/accept", headers=token(host)).status_code == 409
    set_status(pg, host, eid, "soldout")  # bookings closed, but the host can still let a waiting person in
    assert c.post(f"/api/events/{eid}/guests/{ticket}/accept", headers=token(host)).status_code == 200
    past = event(pg, host, kind="guestlist", start=2)
    c.put(f"/api/events/{past}/ticket", headers=token(fan))
    with psycopg.connect(pg, autocommit=True) as conn:
        conn.execute("update public.events set starts_on = %s, ends_on = %s where id = %s", (day(-3), day(-1), past))
    ticket = guests(c, host, past)[0]["ticket_id"]
    assert c.post(f"/api/events/{past}/guests/{ticket}/accept", headers=token(host)).status_code == 409


# ---- chats ----

def test_only_the_host_posts_and_only_members_read(api):
    c, pg = api
    host, fan, stranger = person(pg, "host13"), person(pg, "fan13"), person(pg, "stranger13")
    eid = event(pg, host)
    chat_id = c.put(f"/api/events/{eid}/ticket", headers=token(fan)).json()["chat_id"]
    post = lambda who, text: c.post(f"/api/chats/{chat_id}/updates", json={"body": text}, headers=token(who))  # noqa: E731
    assert post(fan, "Doors at 6").status_code == 403
    assert post(stranger, "Doors at 6").status_code == 404
    for bad in ("", "   ", "x" * 601):
        assert post(host, bad).status_code == 422
    assert c.post(f"/api/chats/{chat_id}/updates", json={"body": None}, headers=token(host)).status_code == 422
    assert post(host, "  Doors at 6 ").status_code == 201
    chat = c.get(f"/api/chats/{chat_id}", headers=token(fan)).json()
    seen = chat["messages"]
    assert seen[-1]["body"] == "Doors at 6" and seen[-1]["kind"] == "update" and seen[-1]["sender_handle"] == "host13"
    assert all("sender_id" not in m for m in seen) and "host_id" not in chat
    assert str(host) not in json.dumps(chat) and str(fan) not in json.dumps(chat)  # no account ids anywhere
    assert c.get(f"/api/chats/{chat_id}", headers=token(stranger)).status_code == 404
    assert c.post(f"/api/chats/{chat_id}/read", headers=token(stranger)).status_code == 404
    newer = c.get(f"/api/chats/{chat_id}?after={seen[-2]['id']}", headers=token(fan)).json()["messages"]
    assert [m["body"] for m in newer] == ["Doors at 6"]


def test_unread_updates_are_counted_until_read(api):
    c, pg = api
    host, fan = person(pg, "host14"), person(pg, "fan14")
    eid = event(pg, host)
    chat_id = c.put(f"/api/events/{eid}/ticket", headers=token(fan)).json()["chat_id"]
    for text in ("One", "Two"):
        c.post(f"/api/chats/{chat_id}/updates", json={"body": text}, headers=token(host))
    mine = c.get("/api/me/chats", headers=token(fan)).json()
    assert mine[0]["unread"] == 2 and mine[0]["last_body"] == "Two" and mine[0]["role"] == "member" and mine[0]["event_id"] == eid
    c.post(f"/api/chats/{chat_id}/read", headers=token(fan))
    assert c.get("/api/me/chats", headers=token(fan)).json()[0]["unread"] == 0
    assert c.get("/api/me/chats", headers=token(host)).json()[0]["unread"] == 0  # my own posts never count


# ---- the database itself (what the website's own Supabase connection can do) ----

def test_the_database_keeps_tickets_and_chats_private_and_read_only(api):
    c, pg = api
    host, fan, other = person(pg, "host15"), person(pg, "fan15"), person(pg, "other15")
    eid = event(pg, host)
    chat_id = c.put(f"/api/events/{eid}/ticket", headers=token(fan)).json()["chat_id"]
    c.post(f"/api/chats/{chat_id}/updates", json={"body": "Secret update"}, headers=token(host))
    with psycopg.connect(pg, autocommit=True) as conn:
        count = lambda table, where, arg: conn.execute(f"select count(*) from public.{table} where {where}", (arg,)).fetchone()[0]  # noqa: E731
        try:
            as_person(conn, fan)
            assert count("tickets", "event_id = %s", eid) == 1
            assert count("chats", "id = %s", chat_id) == 1 and count("messages", "chat_id = %s", chat_id) == 2
            assert count("chat_members", "chat_id = %s", chat_id) == 1  # only their own membership, not the host's
            as_person(conn, other)
            for table, col in (("tickets", "event_id"), ("chats", "id"), ("messages", "chat_id"), ("chat_members", "chat_id")):
                assert count(table, f"{col} = %s", eid if table == "tickets" else chat_id) == 0, table
            for who in (fan, other):
                as_person(conn, who)
                for sql, args in (
                    ("insert into public.messages (chat_id, sender_id, body) values (%s, %s, 'hacked')", (chat_id, who)),
                    ("insert into public.tickets (event_id, user_id) values (%s, %s)", (eid, who)),
                    ("insert into public.chat_members (chat_id, user_id, role) values (%s, %s, 'host')", (chat_id, who)),
                    ("update public.tickets set status = 'going' where event_id = %s and user_id = %s", (eid, who)),
                    ("delete from public.messages where chat_id = %s and sender_id <> %s", (chat_id, who)),
                ):
                    with pytest.raises(psycopg.errors.InsufficientPrivilege):
                        conn.execute(sql, args)
            conn.execute("reset role")
            conn.execute("set role anon")
            for table in ("tickets", "chats", "chat_members", "messages"):
                with pytest.raises(psycopg.errors.InsufficientPrivilege):
                    conn.execute(f"select 1 from public.{table}")
        finally:
            conn.execute("reset role")
