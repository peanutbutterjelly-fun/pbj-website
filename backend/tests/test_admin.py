"""The back office (routes/admin.py), run against a real (throwaway) Postgres with every migration applied: only the back
office login gets in, and each staff action does what it says, also for what the website itself can then see."""

import base64
import json
import uuid

import pytest

psycopg = pytest.importorskip("psycopg")

from app import admin_auth  # noqa: E402
from app.config import get_settings  # noqa: E402
from tests.test_events_chats import api, as_person, event, person, token  # noqa: E402,F401  (api is a fixture)

PASSWORD = "correct horse battery staple"


def login(user="pbj-admin", password=PASSWORD) -> dict:
    return {"Authorization": "Basic " + base64.b64encode(f"{user}:{password}".encode()).decode()}


@pytest.fixture
def admin(api, monkeypatch):  # noqa: F811  (api is the fixture imported above)
    monkeypatch.setattr(get_settings(), "admin_password_hash", admin_auth.make_hash(PASSWORD))
    monkeypatch.setattr(admin_auth, "_fails", {})
    monkeypatch.setattr(admin_auth, "_ok", set())
    monkeypatch.setattr(admin_auth.time, "sleep", lambda _s: None)
    return api


def test_only_the_back_office_login_gets_in(admin):
    c, pg = admin
    member = person(pg, "admmember1")
    for headers in ({}, token(member), login(password="wrong"), login(user="admin")):  # a normal member's login isn't enough
        assert c.get("/api/admin/overview", headers=headers).status_code == 401
    assert c.post("/api/admin/login", headers=login()).json() == {"ok": True, "username": "pbj-admin"}
    assert c.get("/api/admin/overview", headers=login()).json()["people"] >= 1


def test_wrong_guesses_are_refused_for_a_while(admin):
    c, _ = admin
    for _ in range(admin_auth.MAX_FAILS):
        assert c.post("/api/admin/login", headers=login(password="guess")).status_code == 401
    assert c.post("/api/admin/login", headers=login()).status_code == 429  # even the right password waits now


def test_the_password_itself_is_never_stored():
    stored = get_settings().admin_password_hash
    assert stored.startswith("scrypt$") and admin_auth.password_matches("not it", stored) is False
    fresh = admin_auth.make_hash("abc")
    assert admin_auth.password_matches("abc", fresh) and not admin_auth.password_matches("abd", fresh) and "abc" not in fresh


def test_hiding_an_event_takes_it_off_the_site_but_not_from_its_host(admin):
    c, pg = admin
    host, fan = person(pg, "admhost2"), person(pg, "admfan2")
    eid = event(pg, host)
    assert eid in [e["id"] for e in c.get("/api/admin/events?show=to_review", headers=login()).json()]
    assert c.post(f"/api/admin/events/{eid}/hide", json={"reason": "Fake listing"}, headers=login()).json()["hidden_reason"] == "Fake listing"
    assert eid not in [e["id"] for e in c.get("/api/admin/events?show=to_review", headers=login()).json()]  # hiding counts as reviewed
    assert c.put(f"/api/events/{eid}/ticket", headers=token(fan)).status_code == 404  # no new tickets
    assert c.get(f"/api/events/{eid}/rsvp").status_code == 404
    assert c.get(f"/api/events/{eid}/rsvp", headers=token(host)).status_code == 200
    with psycopg.connect(pg, autocommit=True) as conn:
        try:
            conn.execute("set role anon")
            assert conn.execute("select count(*) from public.events where id = %s", (eid,)).fetchone()[0] == 0  # gone from the Events page
            as_person(conn, host)
            assert conn.execute("select count(*) from public.events where id = %s", (eid,)).fetchone()[0] == 1  # the host still sees it
            # ...and can keep editing it, but can't un-hide it (or mark it reviewed) themselves
            conn.execute("update public.events set hidden_at = null, hidden_reason = null, reviewed_at = null, data = data || '{\"title\": \"New\"}' where id = %s", (eid,))
            conn.execute("insert into public.events (id, status, hidden_at, reviewed_at) values (%s, 'published', null, now())", (eid + "b",))
        finally:
            conn.execute("reset role")
        row = conn.execute("select hidden_at is not null, reviewed_at is not null, data->>'title' from public.events where id = %s", (eid,)).fetchone()
        assert row == (True, True, "New")
        assert conn.execute("select reviewed_at from public.events where id = %s", (eid + "b",)).fetchone()[0] is None
    assert c.post(f"/api/admin/events/{eid}/unhide", headers=login()).json()["hidden_at"] is None
    assert c.get(f"/api/events/{eid}/rsvp").status_code == 200


def test_deleting_an_event_needs_the_typed_word(admin):
    c, pg = admin
    eid = event(pg, person(pg, "admhost3"))
    assert c.delete(f"/api/admin/events/{eid}", headers=login()).status_code == 400
    assert c.delete(f"/api/admin/events/{eid}?confirm=DELETE", headers=login()).status_code == 204
    assert c.get(f"/api/admin/events/{eid}", headers=login()).status_code == 404


def test_staff_approve_hosts_give_badges_and_verify_people(admin):
    c, pg = admin
    uid = person(pg, "admasha4")
    found = c.get("/api/admin/people?q=admasha4", headers=login()).json()
    assert [p["id"] for p in found] == [str(uid)] and found[0]["email"] == "admasha4@x.com"
    out = c.patch(f"/api/admin/people/{uid}", json={"role": "host", "badge": "pro", "verified": True}, headers=login()).json()
    assert out["role"] == "host" and out["badge"] == "pro" and out["verified_at"]
    assert c.patch(f"/api/admin/people/{uid}", json={"badge": "admin"}, headers=login()).status_code == 422
    assert c.patch(f"/api/admin/people/{uid}", json={"verified": False}, headers=login()).json()["verified_at"] is None
    assert c.patch(f"/api/admin/people/{uuid.uuid4()}", json={"role": "host"}, headers=login()).status_code == 404


def test_reports_go_from_members_to_staff(admin):
    c, pg = admin
    reporter, host = person(pg, "admrep5"), person(pg, "admhost5")
    eid = event(pg, host)
    assert c.post("/api/reports", json={"target_kind": "event", "target_id": eid, "reason": "Spam"}).status_code == 401  # signed in only
    rid = c.post("/api/reports", json={"target_kind": "event", "target_id": eid, "reason": "Spam", "note": "Same post 5 times"},
                 headers=token(reporter)).json()["id"]
    open_ = c.get("/api/admin/reports", headers=login()).json()
    mine = next(r for r in open_ if r["id"] == rid)
    assert mine["target_label"] == "Clay and Chai Night" and mine["reporter_handle"] == "admrep5"
    assert c.patch(f"/api/admin/reports/{rid}", json={"status": "resolved"}, headers=login()).json()["resolved_at"]
    assert rid not in [r["id"] for r in c.get("/api/admin/reports", headers=login()).json()]


def test_picks_are_chosen_by_staff_and_read_by_everyone(admin):
    c, pg = admin
    eid = event(pg, person(pg, "admhost6"))
    pick = c.post("/api/admin/featured", json={"kind": "highlight", "title": "Clay night recap", "event_ids": [eid]}, headers=login()).json()
    hidden = c.post("/api/admin/featured", json={"kind": "list", "title": "Not yet", "live": False}, headers=login()).json()
    public = c.get("/api/featured").json()
    assert pick["id"] in [h["id"] for h in public["highlights"]] and hidden["id"] not in [x["id"] for x in public["lists"]]
    with psycopg.connect(pg, autocommit=True) as conn:  # the website can read the live ones but never write
        try:
            conn.execute("set role anon")
            ids = [str(r[0]) for r in conn.execute("select id from public.featured").fetchall()]
            assert pick["id"] in ids and hidden["id"] not in ids
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                conn.execute("insert into public.featured (kind, title) values ('list', 'x')")
        finally:
            conn.execute("reset role")
    assert c.delete(f"/api/admin/featured/{pick['id']}", headers=login()).status_code == 204


def test_broadcasts_are_saved_and_chat_messages_can_be_removed(admin):
    c, pg = admin
    host, fan = person(pg, "admhost7"), person(pg, "admfan7")
    eid = event(pg, host)
    chat_id = c.put(f"/api/events/{eid}/ticket", headers=token(fan)).json()["chat_id"]
    c.post(f"/api/chats/{chat_id}/updates", json={"body": "Something nasty"}, headers=token(host))
    msgs = c.get(f"/api/admin/events/{eid}/messages", headers=login()).json()
    bad = next(m for m in msgs if m["body"] == "Something nasty")
    assert c.delete(f"/api/admin/messages/{bad['id']}", headers=login()).status_code == 204
    assert "Something nasty" not in json.dumps(c.get(f"/api/chats/{chat_id}", headers=token(fan)).json())
    sent = c.post("/api/admin/broadcasts", json={"title": "Welcome", "body": "PB&J is live in Mumbai"}, headers=login()).json()
    assert sent["audience"] == "everyone" and sent["id"] in [b["id"] for b in c.get("/api/admin/broadcasts", headers=login()).json()]
