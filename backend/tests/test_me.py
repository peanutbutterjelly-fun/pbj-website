import re
import time
import uuid
from datetime import date, timedelta

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from psycopg import errors

from app import auth
from app.db import get_db
from app.main import app

ISSUER = "https://test.supabase.co/auth/v1"
KEY = ec.generate_private_key(ec.SECP256R1())
USER_ID = uuid.uuid4()


class FakeJwks:
    def get_signing_key_from_jwt(self, _token):
        return type("K", (), {"key": KEY.public_key()})()


class FakeDb:
    """Stands in for the database. A select returns exactly the columns the SQL asks for, so a route that selects a
    private column would leak it here too (and the tests would catch it)."""

    def __init__(self):
        self.profile = {"id": USER_ID, "full_name": None, "avatar_url": None, "city": "Mumbai", "role": "guest",
                        "phone": "+91 98200 00000", "host_kind": None, "link": None, "about": None, "wants_call": False,
                        "onboarded_at": None, "handle": None, "instagram": None, "youtube": None, "x_handle": None,
                        "badge": "vibes", "birthday": "2002-09-21", "email": "private@example.com",
                        "created_at": None, "updated_at": None}
        self.last = None
        self.updates = []
        self.fail_with = None  # an error the next update raises, like the database would

    def execute(self, sql, params=None):
        self.last = (sql, params)
        if sql.startswith("update"):
            if self.fail_with is not None:
                raise self.fail_with
            if params.get("handle") == "taken":
                raise errors.UniqueViolation()
            self.updates.append((sql, params))
            self.profile.update({k: v for k, v in params.items() if k != "id"})
        return self

    def fetchone(self):
        sql, params = self.last
        if "lower(handle)" in sql and self.profile["handle"] != params[0]:  # the public profile lookup
            return None
        cols = [c.strip() for c in re.match(r"select (.*?) from", sql, re.S).group(1).split(",")]
        return {c: self.profile[c] for c in cols}


def token(**overrides):
    claims = {"sub": str(USER_ID), "email": "a@b.com", "aud": "authenticated", "iss": ISSUER,
              "exp": int(time.time()) + 600, **overrides}
    return jwt.encode(claims, KEY, algorithm="ES256")


def auth_header():
    return {"Authorization": f"Bearer {token()}"}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(auth, "_jwks_client", lambda: FakeJwks())
    db = FakeDb()
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app), db
    app.dependency_overrides.clear()


def test_me_needs_login(client):
    c, _ = client
    assert c.get("/api/me").status_code == 401


def test_me_rejects_bad_tokens(client):
    c, _ = client
    for bad in [token(exp=int(time.time()) - 10), token(aud="anon"), token(iss="https://evil.example/auth/v1"), "nonsense"]:
        assert c.get("/api/me", headers={"Authorization": f"Bearer {bad}"}).status_code == 401


def test_me_returns_profile(client):
    c, db = client
    r = c.get("/api/me", headers=auth_header())
    assert r.status_code == 200
    assert r.json()["email"] == "a@b.com" and r.json()["city"] == "Mumbai"
    assert db.last[1] == (USER_ID,)


def test_me_update_only_allowed_fields(client):
    c, db = client
    r = c.patch("/api/me", json={"full_name": "Asha", "role": "admin"}, headers=auth_header())
    assert r.status_code == 200
    assert r.json()["full_name"] == "Asha"
    assert r.json()["role"] == "guest"  # role can't be changed by the person themselves


def test_me_finishes_welcome_steps(client):
    c, db = client
    body = {"full_name": "Asha", "phone": "+91 98200 00000", "host_kind": "Venue or studio",
            "link": "instagram.com/asha", "wants_call": True, "onboarded": True}
    r = c.patch("/api/me", json=body, headers=auth_header())
    assert r.status_code == 200
    sql, params = db.updates[-1]
    assert "onboarded_at = coalesce(onboarded_at, now())" in sql
    assert params["host_kind"] == "Venue or studio" and params["wants_call"] is True
    assert "onboarded" not in params


def test_me_ignores_empty_wants_call(client):
    c, db = client
    r = c.patch("/api/me", json={"wants_call": None}, headers=auth_header())
    assert r.status_code == 200
    assert db.updates == []


def test_me_onboarding_needs_name_and_kind(client):
    c, db = client
    r = c.patch("/api/me", json={"full_name": "Asha", "onboarded": True}, headers=auth_header())
    assert r.status_code == 422
    assert db.updates == []


def test_me_photo_must_be_own_upload(client):
    c, db = client
    own = f"https://test.supabase.co/storage/v1/object/public/images/{USER_ID}/profile/a.jpg"
    for bad in ["https://evil.example/a.jpg", "javascript:alert(1)",
                f"https://test.supabase.co/storage/v1/object/public/images/{uuid.uuid4()}/profile/a.jpg",
                own.replace("a.jpg", "a'.jpg"),
                own.replace("profile/a.jpg", f"%2e%2e/{uuid.uuid4()}/profile/a.jpg"),
                own.replace("profile/a.jpg", "%2E%2E/x/a.jpg"),
                own.replace("profile/a.jpg", "events/a.jpg"),  # not their profile folder
                own.replace("a.jpg", "sub/a.jpg"),  # no further folders
                own.replace("a.jpg", "..%2Fx.jpg"), own.replace("a.jpg", ".."), own.replace("a.jpg", "a.jpg?x=1"),
                own.replace("a.jpg", "a.jpg#\"><script>"), own + "/", own.replace("https://", "http://")]:
        assert c.patch("/api/me", json={"avatar_url": bad}, headers=auth_header()).status_code == 422
    r = c.patch("/api/me", json={"avatar_url": own}, headers=auth_header())
    assert r.status_code == 200 and r.json()["avatar_url"] == own
    r = c.patch("/api/me", json={"avatar_url": None}, headers=auth_header())
    assert r.status_code == 200


def test_me_saves_the_new_profile_fields(client):
    c, db = client
    r = c.patch("/api/me", json={"handle": "Asha_K", "about": "Hunting hidden gems", "instagram": "asha.k", "youtube": "@ashak",
                                 "x_handle": "ashak", "badge": "sponty", "birthday": "2002-09-21"}, headers=auth_header())
    assert r.status_code == 200
    body = r.json()
    assert body["handle"] == "asha_k"  # saved in lowercase
    assert body["badge"] == "sponty" and body["about"] == "Hunting hidden gems" and body["birthday"] == "2002-09-21"
    assert body["instagram"] == "asha.k" and body["youtube"] == "@ashak" and body["x_handle"] == "ashak"
    assert db.updates[-1][1]["instagram"] == "asha.k" and db.updates[-1][1]["x_handle"] == "ashak"


def test_me_rejects_bad_values(client):
    c, db = client
    for bad in [{"handle": "no"}, {"handle": "has space"}, {"about": "x" * 601}, {"instagram": "not valid!"}, {"x_handle": "a" * 41},
                {"bio": "old field"}]:
        r = c.patch("/api/me", json=bad, headers=auth_header())
        assert r.status_code == 422 or (r.status_code == 200 and db.updates == []), bad  # unknown fields change nothing


def test_host_badges_are_not_self_service(client):
    c, _ = client
    for badge in ("pro", "exclusive", "admin"):
        assert c.patch("/api/me", json={"badge": badge}, headers=auth_header()).status_code == 422


def test_taken_handle_is_a_clear_conflict(client):
    c, _ = client
    r = c.patch("/api/me", json={"handle": "taken"}, headers=auth_header())
    assert r.status_code == 409 and "taken" in r.json()["detail"]


PUBLIC = {"handle", "full_name", "avatar_url", "city", "badge", "about", "instagram", "youtube", "x_handle", "created_at"}


def test_public_profile_needs_no_login_and_hides_private_fields(client):
    c, db = client
    db.profile.update(handle="asha_k", about="Hunting hidden gems", host_kind="Artist", link="asha.example", wants_call=True)
    r = c.get("/api/people/Asha_K")  # no login, capitals ignored
    assert r.status_code == 200
    body = r.json()
    assert set(body) == PUBLIC
    assert body["handle"] == "asha_k" and body["badge"] == "vibes" and body["about"] == "Hunting hidden gems"
    assert c.get("/api/people/nobody_here").status_code == 404
    assert c.get("/api/people/a").status_code == 422


def test_me_rejects_empty_badge_and_city(client):
    c, db = client
    for bad in ({"badge": None}, {"city": None}):
        assert c.patch("/api/me", json=bad, headers=auth_header()).status_code == 422, bad
    assert db.updates == []


def test_me_rejects_impossible_birthdays(client):
    c, db = client
    tomorrow = (date.today() + timedelta(days=2)).isoformat()
    for bad in (tomorrow, "1899-12-31", "2002-02-30", "not a date"):
        assert c.patch("/api/me", json={"birthday": bad}, headers=auth_header()).status_code == 422, bad
    assert db.updates == []
    assert c.patch("/api/me", json={"birthday": "1900-01-01"}, headers=auth_header()).status_code == 200
    assert c.patch("/api/me", json={"birthday": None}, headers=auth_header()).status_code == 200  # clearing it is fine


def test_values_the_database_refuses_are_a_422_not_a_crash(client):
    c, db = client
    for err in (errors.CheckViolation(), errors.NotNullViolation()):
        db.fail_with = err
        r = c.patch("/api/me", json={"full_name": "Asha"}, headers=auth_header())
        assert r.status_code == 422
