"""Follows, Love / Like / Curious, saved lists, "I went" and recaps (app/api/routes/activity.py), run against a real (throwaway)
Postgres with every migration applied. The checks that matter: people only change their own things, only see what they may,
and only the host writes a recap."""

import pytest

pytest.importorskip("psycopg")
import psycopg  # noqa: E402

from tests.test_events_chats import api, event, person, set_status, token  # noqa: E402,F401  (api is a fixture)

PHOTOS = "https://test.supabase.co/storage/v1/object/public/images"


def hide(pg, eid):
    """Staff take an event off the site (the back office does this)."""
    with psycopg.connect(pg, autocommit=True) as conn:
        conn.execute("update public.events set hidden_at = now(), hidden_reason = 'test' where id = %s", (eid,))


# ---- follows ----

def test_following_someone_and_the_counts(api):
    c, pg = api
    asha, ravi = person(pg, "asha_f"), person(pg, "ravi_f")
    assert c.put("/api/people/ravi_f/follow", headers=token(asha)).status_code == 204
    assert c.put("/api/people/RAVI_F/follow", headers=token(asha)).status_code == 204  # again (and any capitals) is fine
    assert c.get("/api/people/ravi_f/follows").json() == {"followers": 1, "following": 0, "you_follow": False}  # no login
    assert c.get("/api/people/ravi_f/follows", headers=token(asha)).json()["you_follow"] is True
    assert [p["handle"] for p in c.get("/api/me/following", headers=token(asha)).json()] == ["ravi_f"]
    assert c.delete("/api/people/ravi_f/follow", headers=token(asha)).status_code == 204
    assert c.get("/api/people/ravi_f/follows").json()["followers"] == 0


def test_follow_rules(api):
    c, pg = api
    asha = person(pg, "asha_g")
    assert c.put("/api/people/asha_g/follow", headers=token(asha)).status_code == 422  # not yourself
    assert c.put("/api/people/nobody_here/follow", headers=token(asha)).status_code == 404
    assert c.put("/api/people/asha_g/follow").status_code == 401  # needs a login


# ---- Love / Like / Curious ----

def test_reacting_to_an_event(api):
    c, pg = api
    host, asha, ravi = person(pg, "host_r"), person(pg, "asha_r"), person(pg, "ravi_r")
    eid = event(pg, host)
    assert c.put(f"/api/events/{eid}/reaction", json={"kind": "love"}, headers=token(asha)).json()["kind"] == "love"
    assert c.put(f"/api/events/{eid}/reaction", json={"kind": "curious"}, headers=token(asha)).json()["kind"] == "curious"  # replaces
    assert c.put(f"/api/events/{eid}/reaction", json={"kind": "meh"}, headers=token(asha)).status_code == 422
    assert [r["kind"] for r in c.get("/api/me/reactions", headers=token(asha)).json()] == ["curious"]
    assert c.get("/api/me/reactions", headers=token(ravi)).json() == []  # nobody sees someone else's
    assert c.delete(f"/api/events/{eid}/reaction", headers=token(asha)).status_code == 204
    assert c.get("/api/me/reactions", headers=token(asha)).json() == []


def test_drafts_and_hidden_events_are_off_limits_to_others(api):
    c, pg = api
    host, asha = person(pg, "host_d"), person(pg, "asha_d")
    draft, hidden = event(pg, host, status="draft"), event(pg, host)
    hide(pg, hidden)
    for eid in (draft, hidden, "enosuchevent"):
        assert c.put(f"/api/events/{eid}/reaction", json={"kind": "like"}, headers=token(asha)).status_code == 404
    assert c.put(f"/api/events/{draft}/reaction", json={"kind": "like"}, headers=token(host)).status_code == 200  # the host's own


# ---- saved lists ----

def test_lists_belong_to_their_owner(api):
    c, pg = api
    host, asha, ravi = person(pg, "host_l"), person(pg, "asha_l"), person(pg, "ravi_l")
    eid = event(pg, host)
    lst = c.post("/api/me/lists", json={"name": "  Weekend   plans "}, headers=token(asha)).json()
    assert lst["name"] == "Weekend plans"
    assert c.post("/api/me/lists", json={"name": "Weekend plans"}, headers=token(asha)).status_code == 409
    assert c.post("/api/me/lists", json={"name": "   "}, headers=token(asha)).status_code == 422
    assert c.put(f"/api/me/lists/{lst['id']}/events/{eid}", headers=token(asha)).status_code == 204
    assert c.get("/api/me/lists", headers=token(asha)).json()[0]["events"] == [eid]
    # someone else can't read, fill, rename or delete it
    assert c.get("/api/me/lists", headers=token(ravi)).json() == []
    assert c.put(f"/api/me/lists/{lst['id']}/events/{eid}", headers=token(ravi)).status_code == 404
    assert c.patch(f"/api/me/lists/{lst['id']}", json={"name": "Mine now"}, headers=token(ravi)).status_code == 404
    assert c.delete(f"/api/me/lists/{lst['id']}", headers=token(ravi)).status_code == 404
    assert c.patch(f"/api/me/lists/{lst['id']}", json={"name": "Sundays"}, headers=token(asha)).json()["name"] == "Sundays"
    assert c.delete(f"/api/me/lists/{lst['id']}/events/{eid}", headers=token(asha)).status_code == 204
    assert c.delete(f"/api/me/lists/{lst['id']}", headers=token(asha)).status_code == 204
    assert c.get("/api/me/lists", headers=token(asha)).json() == []


# ---- "I went" ----

def test_i_went_only_once_it_started(api):
    c, pg = api
    host, asha = person(pg, "host_w"), person(pg, "asha_w")
    upcoming, past = event(pg, host, start=5), event(pg, host, start=-2)
    assert c.put(f"/api/events/{upcoming}/attendance", json={"mood": "loved"}, headers=token(asha)).status_code == 409
    r = c.put(f"/api/events/{past}/attendance", json={"mood": "loved", "note": "  Best night  "}, headers=token(asha)).json()
    assert r["mood"] == "loved" and r["note"] == "Best night"
    assert c.put(f"/api/events/{past}/attendance", json={"note": "x" * 281}, headers=token(asha)).status_code == 422
    assert [a["event_id"] for a in c.get("/api/me/attendances", headers=token(asha)).json()] == [past]


def test_who_sees_the_events_someone_went_to(api):
    c, pg = api
    host, asha, friend, stranger = person(pg, "host_v"), person(pg, "asha_v"), person(pg, "friend_v"), person(pg, "stranger_v")
    past = event(pg, host, start=-3)
    c.put(f"/api/events/{past}/attendance", json={"mood": "good"}, headers=token(asha))
    c.put("/api/people/asha_v/follow", headers=token(friend))
    seen = lambda who: c.get("/api/people/asha_v/attended", headers=token(who) if who else {}).json()["visible"]  # noqa: E731
    # default: followers only
    assert seen(asha) and seen(friend) and not seen(stranger) and not seen(None)
    assert c.patch("/api/me", json={"attended_visibility": "private"}, headers=token(asha)).status_code == 200
    assert seen(asha) and not seen(friend)
    assert c.patch("/api/me", json={"attended_visibility": "public"}, headers=token(asha)).status_code == 200
    assert seen(None) and seen(stranger)
    assert c.patch("/api/me", json={"attended_visibility": None}, headers=token(asha)).status_code == 422
    assert c.patch("/api/me", json={"attended_visibility": "everyone"}, headers=token(asha)).status_code == 422
    # an event staff hid drops out of the list
    hide(pg, past)
    assert c.get("/api/people/asha_v/attended").json()["events"] == []


# ---- recaps ----

def test_only_the_host_writes_the_recap(api):
    c, pg = api
    host, asha = person(pg, "host_c"), person(pg, "asha_c")
    past, upcoming = event(pg, host, start=-1), event(pg, host, start=4)
    good = f"{PHOTOS}/{host}/events/m1-ab12.jpg"
    assert c.put(f"/api/events/{past}/recap", json={"body": "What a night"}, headers=token(asha)).status_code == 403
    assert c.put(f"/api/events/{upcoming}/recap", json={"body": "Early"}, headers=token(host)).status_code == 409
    for bad in [f"{PHOTOS}/{asha}/events/a.jpg", f"{PHOTOS}/{host}/profile/a.jpg", "https://evil.example/a.jpg",
                f"{PHOTOS}/{host}/events/a.jpg\"><script>", f"{PHOTOS}/{host}/events/%2e%2e"]:
        assert c.put(f"/api/events/{past}/recap", json={"body": "Hi", "photos": [bad]}, headers=token(host)).status_code == 422, bad
    assert c.put(f"/api/events/{past}/recap", json={"body": "   "}, headers=token(host)).status_code == 422
    r = c.put(f"/api/events/{past}/recap", json={"body": "What a night", "photos": [good]}, headers=token(host)).json()
    assert r["photos"] == [good]
    assert c.get(f"/api/events/{past}/recap").json()["body"] == "What a night"  # anyone can read a listed event's recap
    assert c.delete(f"/api/events/{past}/recap", headers=token(asha)).status_code == 403
    assert c.delete(f"/api/events/{past}/recap", headers=token(host)).status_code == 204
    assert c.get(f"/api/events/{past}/recap").status_code == 404


def test_a_drafts_recap_stays_with_its_host(api):
    c, pg = api
    host, asha = person(pg, "host_x"), person(pg, "asha_x")
    past = event(pg, host, start=-1)
    c.put(f"/api/events/{past}/recap", json={"body": "Notes"}, headers=token(host))
    set_status(pg, host, past, "draft")
    assert c.get(f"/api/events/{past}/recap").status_code == 404
    assert c.get(f"/api/events/{past}/recap", headers=token(asha)).status_code == 404
    assert c.get(f"/api/events/{past}/recap", headers=token(host)).status_code == 200
