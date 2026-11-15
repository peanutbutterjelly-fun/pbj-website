"""Events, free tickets and group chats, run against a real (temporary) Postgres so the SQL, the rules and the locking are all checked.

Needs the `pgserver` package (in requirements-dev.txt), which starts a throwaway Postgres. If it is not installed these tests are skipped.
Supabase's own pieces (the auth and storage schemas) are stood in for by the small stub below, then every migration is applied in order.
"""

import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

pgserver = pytest.importorskip("pgserver")
import psycopg  # noqa: E402
from psycopg.rows import dict_row  # noqa: E402

from app import auth  # noqa: E402
from app.db import get_db  # noqa: E402
from app.main import app  # noqa: E402

ISSUER = "https://test.supabase.co/auth/v1"
KEY = ec.generate_private_key(ec.SECP256R1())
MIGRATIONS = sorted((Path(__file__).resolve().parents[2] / "supabase" / "migrations").glob("*.sql"))

STUB = """
create role anon nologin; create role authenticated nologin; create role service_role nologin;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role; -- what Supabase does for every new table
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
"""


class FakeJwks:
    def get_signing_key_from_jwt(self, _token):
        return type("K", (), {"key": KEY.public_key()})()


def token(user_id) -> dict:
    claims = {"sub": str(user_id), "email": "x@y.com", "aud": "authenticated", "iss": ISSUER, "exp": int(time.time()) + 600}
    return {"Authorization": "Bearer " + jwt.encode(claims, KEY, algorithm="ES256")}


@pytest.fixture(scope="module")
def pg(tmp_path_factory):
    server = pgserver.get_server(tmp_path_factory.mktemp("pg"))
    with psycopg.connect(server.get_uri(), autocommit=True) as conn:
        conn.execute(STUB)
        for sql in MIGRATIONS:
            conn.execute(sql.read_text())
    yield server.get_uri()
    server.cleanup()


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


def person(pg, name, verified=True, handle=True) -> uuid.UUID:
    """A signed-up person (the sign-up trigger makes their profile). By default they have a handle and have passed the identity check."""
    uid = uuid.uuid4()
    with psycopg.connect(pg, autocommit=True) as conn:
        conn.execute("insert into auth.users (id, email, raw_user_meta_data) values (%s, %s, %s::jsonb)", (uid, f"{name}@x.com", f'{{"full_name": "{name}"}}'))
        if handle:
            conn.execute("update public.profiles set handle = %s where id = %s", (name.lower(), uid))
        if verified:
            conn.execute("update public.profiles set verified_at = now() where id = %s", (uid,))
    return uid


def soon(hours=48):
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


def live_event(c, host, **extra):
    """A host's event, created and published. Returns (event id, slug, chat id). Ticketed kind by default so a ticket is given at once."""
    made = c.post("/api/events", json={"title": "Clay and Chai Night", "starts_at": soon(), "kind": "open", **extra}, headers=token(host))
    assert made.status_code == 201, made.text
    pub = c.post(f"/api/events/{made.json()['id']}/publish", headers=token(host))
    assert pub.status_code == 200, pub.text
    return made.json()["id"], made.json()["slug"], pub.json()["chat_id"]


def test_listing_needs_an_account_a_profile_and_for_plans_the_identity_check(api):
    c, pg = api
    body = {"title": "My party", "starts_at": soon()}
    assert c.post("/api/events", json=body).status_code == 401  # no account
    nameless = person(pg, "nameless1", handle=False)
    r = c.post("/api/events", json={**body, "kind": "open"}, headers=token(nameless))
    assert r.status_code == 403 and r.json()["detail"]["code"] == "profile_incomplete"
    unverified = person(pg, "unverified1", verified=False)
    r = c.post("/api/events", json=body, headers=token(unverified))  # a Sponty plan
    assert r.status_code == 403 and r.json()["detail"]["code"] == "verification_required"
    assert c.post("/api/events", json={**body, "kind": "open"}, headers=token(unverified)).status_code == 201  # other kinds don't need it
    assert c.post("/api/events", json=body, headers=token(person(pg, "verified1"))).status_code == 201


def test_a_draft_is_hidden_until_published(api):
    c, pg = api
    host = person(pg, "host1")
    made = c.post("/api/events", json={"title": "Secret draft", "starts_at": soon()}, headers=token(host)).json()
    assert c.get(f"/api/events/{made['slug']}").status_code == 404  # public can't see it
    assert c.get(f"/api/events/{made['slug']}", headers=token(host)).status_code == 200  # the host can
    assert all(e["slug"] != made["slug"] for e in c.get("/api/events").json())
    c.post(f"/api/events/{made['id']}/publish", headers=token(host))
    assert c.get(f"/api/events/{made['slug']}").status_code == 200
    assert any(e["slug"] == made["slug"] for e in c.get("/api/events").json())


def test_bad_event_values_are_refused(api):
    c, pg = api
    host = person(pg, "host2")
    for bad in [{"title": "ab"}, {"starts_at": "2026-12-05T19:30:00"}, {"ends_at": soon(1)}, {"capacity": 0}, {"cover_url": "http://x.com/a.jpg"}, {"approval": "whenever"}]:
        r = c.post("/api/events", json={"title": "Fine title", "starts_at": soon(), **bad}, headers=token(host))
        assert r.status_code == 422, (bad, r.text)


def test_publishing_opens_the_chat_with_the_host_in_it(api):
    c, pg = api
    host = person(pg, "host3")
    _, _, chat_id = live_event(c, host)
    chat = c.get(f"/api/chats/{chat_id}", headers=token(host)).json()
    assert chat["role"] == "host" and chat["members"] == 1
    assert chat["messages"][0]["kind"] == "system"


def test_a_ticket_joins_the_chat_and_is_safe_to_repeat(api):
    c, pg = api
    host, fan = person(pg, "host4"), person(pg, "fan1")
    event_id, slug, chat_id = live_event(c, host)
    first = c.put(f"/api/events/{event_id}/ticket", headers=token(fan))
    assert first.status_code == 200 and first.json() == {"status": "going", "chat_id": chat_id}
    assert c.put(f"/api/events/{event_id}/ticket", headers=token(fan)).status_code == 200  # repeating changes nothing
    assert c.get(f"/api/events/{slug}", headers=token(fan)).json()["going"] == 1
    assert [t["slug"] for t in c.get("/api/me/tickets", headers=token(fan)).json()] == [slug]
    assert c.get(f"/api/chats/{chat_id}", headers=token(fan)).json()["members"] == 2


def test_the_last_spot_goes_to_one_person_only(api):
    c, pg = api
    host, a, b = person(pg, "host5"), person(pg, "fan2"), person(pg, "fan3")
    event_id, slug, _ = live_event(c, host, capacity=1)
    assert c.put(f"/api/events/{event_id}/ticket", headers=token(a)).status_code == 200
    full = c.put(f"/api/events/{event_id}/ticket", headers=token(b))
    assert full.status_code == 409 and "full" in full.json()["detail"]
    assert c.get(f"/api/events/{slug}").json()["spots_left"] == 0
    assert c.delete(f"/api/events/{event_id}/ticket", headers=token(a)).status_code == 200  # a gives it back
    assert c.put(f"/api/events/{event_id}/ticket", headers=token(b)).status_code == 200  # now b can have it


def test_giving_a_ticket_back_leaves_the_chat(api):
    c, pg = api
    host, fan = person(pg, "host6"), person(pg, "fan4")
    event_id, _, chat_id = live_event(c, host)
    c.put(f"/api/events/{event_id}/ticket", headers=token(fan))
    c.delete(f"/api/events/{event_id}/ticket", headers=token(fan))
    assert c.get(f"/api/chats/{chat_id}", headers=token(fan)).status_code == 404
    assert c.get("/api/me/tickets", headers=token(fan)).json() == []
    assert c.get(f"/api/chats/{chat_id}", headers=token(host)).json()["members"] == 1  # the host stays


def test_only_the_host_posts_updates_and_only_members_read_them(api):
    c, pg = api
    host, fan, stranger = person(pg, "host7"), person(pg, "fan5"), person(pg, "stranger1")
    event_id, _, chat_id = live_event(c, host)
    c.put(f"/api/events/{event_id}/ticket", headers=token(fan))
    assert c.post(f"/api/chats/{chat_id}/updates", json={"body": "Doors at 6"}, headers=token(fan)).status_code == 403
    assert c.post(f"/api/chats/{chat_id}/updates", json={"body": "Doors at 6"}, headers=token(stranger)).status_code == 404
    assert c.post(f"/api/chats/{chat_id}/updates", json={"body": ""}, headers=token(host)).status_code == 422
    assert c.post(f"/api/chats/{chat_id}/updates", json={"body": "x" * 601}, headers=token(host)).status_code == 422
    assert c.post(f"/api/chats/{chat_id}/updates", json={"body": "Doors at 6"}, headers=token(host)).status_code == 201
    seen = c.get(f"/api/chats/{chat_id}", headers=token(fan)).json()["messages"]
    assert seen[-1]["body"] == "Doors at 6" and seen[-1]["kind"] == "update" and seen[-1]["sender_name"] == "host7"
    assert c.get(f"/api/chats/{chat_id}", headers=token(stranger)).status_code == 404
    newer = c.get(f"/api/chats/{chat_id}?after={seen[-2]['id']}", headers=token(fan)).json()["messages"]
    assert [m["body"] for m in newer] == ["Doors at 6"]


def test_unread_updates_are_counted_until_read(api):
    c, pg = api
    host, fan = person(pg, "host8"), person(pg, "fan6")
    event_id, _, chat_id = live_event(c, host)
    c.put(f"/api/events/{event_id}/ticket", headers=token(fan))
    for text in ("One", "Two"):
        c.post(f"/api/chats/{chat_id}/updates", json={"body": text}, headers=token(host))
    mine = c.get("/api/me/chats", headers=token(fan)).json()
    assert mine[0]["unread"] == 2 and mine[0]["last_body"] == "Two" and mine[0]["role"] == "member"
    c.post(f"/api/chats/{chat_id}/read", headers=token(fan))
    assert c.get("/api/me/chats", headers=token(fan)).json()[0]["unread"] == 0
    assert c.get("/api/me/chats", headers=token(host)).json()[0]["unread"] == 0  # my own posts never count


def test_cancelling_tells_the_chat_and_stops_new_tickets(api):
    c, pg = api
    host, fan = person(pg, "host9"), person(pg, "fan7")
    event_id, _, chat_id = live_event(c, host)
    assert c.post(f"/api/events/{event_id}/cancel", headers=token(fan)).status_code == 404  # not their event
    assert c.post(f"/api/events/{event_id}/cancel", headers=token(host)).status_code == 200
    assert "cancelled" in c.get(f"/api/chats/{chat_id}", headers=token(host)).json()["messages"][-1]["body"]
    assert c.put(f"/api/events/{event_id}/ticket", headers=token(fan)).status_code == 404
    assert c.post(f"/api/events/{event_id}/publish", headers=token(host)).status_code == 409


def test_past_events_take_no_new_tickets(api):
    c, pg = api
    host, fan = person(pg, "host10"), person(pg, "fan8")
    event_id, _, _ = live_event(c, host)
    with psycopg.connect(pg, autocommit=True) as conn:  # pretend it happened yesterday
        conn.execute("update public.events set starts_at = now() - interval '2 days', ends_at = now() - interval '1 day' where id = %s", (event_id,))
    r = c.put(f"/api/events/{event_id}/ticket", headers=token(fan))
    assert r.status_code == 409 and "already happened" in r.json()["detail"]


# ---- Sponty plans: asking, and the planner accepting or declining ----

def plan(c, host, **extra):
    """A Sponty plan (the planner approves each person by default). Returns (event id, slug, chat id)."""
    return live_event(c, host, kind="sponty", title="Sunrise cycle", **extra)


def test_joining_a_plan_needs_the_identity_check_and_sends_a_request(api):
    c, pg = api
    planner, fan, unverified = person(pg, "planner1"), person(pg, "fan10"), person(pg, "unverified2", verified=False)
    event_id, slug, chat_id = plan(c, planner, capacity=2)
    r = c.put(f"/api/events/{event_id}/ticket", headers=token(unverified))
    assert r.status_code == 403 and r.json()["detail"]["code"] == "verification_required"
    assert c.put(f"/api/events/{event_id}/ticket", json={"note": "I know the route well"}, headers=token(fan)).json() == {"status": "requested", "chat_id": None}
    assert c.get(f"/api/events/{slug}", headers=token(fan)).json()["me"]["ticket"] == "requested"
    assert c.get(f"/api/chats/{chat_id}", headers=token(fan)).status_code == 404  # not in the chat yet
    assert c.get(f"/api/events/{slug}").json()["going"] == 0  # a request doesn't take a spot
    assert c.put(f"/api/events/{event_id}/ticket", headers=token(planner)).status_code == 409  # can't join your own plan


def test_the_planner_sees_requests_and_accepts_or_declines(api):
    c, pg = api
    planner, a, b, other = person(pg, "planner2"), person(pg, "fan11"), person(pg, "fan12"), person(pg, "fan13")
    event_id, slug, chat_id = plan(c, planner, capacity=1)
    for who, note in ((a, "first"), (b, "second")):
        c.put(f"/api/events/{event_id}/ticket", json={"note": note}, headers=token(who))
    assert c.get(f"/api/events/{event_id}/guests", headers=token(other)).status_code == 404  # only the planner
    seen = c.get(f"/api/events/{event_id}/guests", headers=token(planner)).json()
    assert seen["spots_left"] == 1 and [g["handle"] for g in seen["guests"]] == ["fan11", "fan12"]
    assert seen["guests"][0]["note"] == "first" and seen["guests"][0]["verified"] is True and seen["guests"][0]["status"] == "requested"
    ok = c.post(f"/api/events/{event_id}/guests/{a}/accept", headers=token(planner))
    assert ok.status_code == 200 and ok.json()["chat_id"] == chat_id
    assert c.get(f"/api/chats/{chat_id}", headers=token(a)).status_code == 200  # now in the chat
    full = c.post(f"/api/events/{event_id}/guests/{b}/accept", headers=token(planner))
    assert full.status_code == 409 and "taken" in full.json()["detail"]
    assert c.post(f"/api/events/{event_id}/guests/{b}/decline", headers=token(planner)).status_code == 200
    assert c.put(f"/api/events/{event_id}/ticket", headers=token(b)).status_code == 403  # can't ask again after a decline
    assert c.get(f"/api/events/{slug}").json()["spots_left"] == 0


def test_the_planner_can_remove_someone_and_free_the_spot(api):
    c, pg = api
    planner, a, b = person(pg, "planner3"), person(pg, "fan14"), person(pg, "fan15")
    event_id, slug, chat_id = plan(c, planner, capacity=1)
    c.put(f"/api/events/{event_id}/ticket", headers=token(a))
    c.put(f"/api/events/{event_id}/ticket", headers=token(b))
    c.post(f"/api/events/{event_id}/guests/{a}/accept", headers=token(planner))
    assert c.post(f"/api/events/{event_id}/guests/{a}/remove", headers=token(planner)).status_code == 200
    assert c.get(f"/api/chats/{chat_id}", headers=token(a)).status_code == 404
    assert c.post(f"/api/events/{event_id}/guests/{b}/accept", headers=token(planner)).status_code == 200  # the freed spot goes to b


def test_withdrawing_a_request_and_auto_approval(api):
    c, pg = api
    planner, a, b = person(pg, "planner4"), person(pg, "fan16"), person(pg, "fan17")
    event_id, _, _ = plan(c, planner, capacity=1)
    c.put(f"/api/events/{event_id}/ticket", headers=token(a))
    assert c.delete(f"/api/events/{event_id}/ticket", headers=token(a)).status_code == 200
    assert c.get(f"/api/events/{event_id}/guests", headers=token(planner)).json()["guests"] == []
    auto_id, _, auto_chat = plan(c, planner, capacity=1, approval="auto")  # first come, first served
    assert c.put(f"/api/events/{auto_id}/ticket", headers=token(a)).json() == {"status": "going", "chat_id": auto_chat}
    assert c.put(f"/api/events/{auto_id}/ticket", headers=token(b)).status_code == 409


def test_the_database_itself_keeps_chats_private(pg):
    """Even straight to the database (what the website's own Supabase connection uses), a person only reads chats they are in."""
    with psycopg.connect(pg, autocommit=True) as conn:
        host, fan, other = person(pg, "host11"), person(pg, "fan9"), person(pg, "other9")
        ev = conn.execute("insert into public.events (host_id, slug, title, starts_at, status) values (%s, %s, 'Private chat night', now() + interval '2 days', 'published') returning id", (host, f"private-{uuid.uuid4().hex[:6]}")).fetchone()[0]
        chat = conn.execute("insert into public.chats (event_id, host_id, title) values (%s, %s, 'Private chat night') returning id", (ev, host)).fetchone()[0]
        conn.execute("insert into public.chat_members (chat_id, user_id, role) values (%s, %s, 'host'), (%s, %s, 'member')", (chat, host, chat, fan))
        conn.execute("insert into public.messages (chat_id, sender_id, body) values (%s, %s, 'Secret update')", (chat, host))
        def as_person(uid):
            conn.execute("set role authenticated")
            conn.execute("select set_config('request.jwt.claim.sub', %s, false)", (str(uid),))
        try:
            as_person(fan)
            assert conn.execute("select count(*) from public.messages").fetchone()[0] >= 1
            assert conn.execute("select count(*) from public.messages where chat_id = %s", (chat,)).fetchone()[0] == 1
            as_person(other)
            assert conn.execute("select count(*) from public.messages where chat_id = %s", (chat,)).fetchone()[0] == 0
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                conn.execute("insert into public.messages (chat_id, sender_id, body) values (%s, %s, 'hacked')", (chat, other))
        finally:
            conn.execute("reset role")
