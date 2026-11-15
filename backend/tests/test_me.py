import time
import uuid

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
    def __init__(self):
        self.profile = {"id": USER_ID, "full_name": None, "avatar_url": None, "city": "Mumbai", "role": "guest",
                        "handle": None, "bio": None, "instagram": None, "youtube": None, "x_handle": None,
                        "badge": "vibes", "birthday": None, "created_at": None, "updated_at": None}
        self.last = None

    def execute(self, sql, params=None):
        self.last = (sql, params)
        if sql.startswith("update"):
            if params.get("handle") == "taken":
                raise errors.UniqueViolation()
            self.profile.update({k: v for k, v in params.items() if k != "id"})
        return self

    def fetchone(self):
        sql, params = self.last
        if "lower(handle)" in sql:  # the public profile lookup
            return {k: self.profile[k] for k in ("handle", "full_name", "avatar_url", "city", "badge", "bio", "instagram",
                                                 "youtube", "x_handle", "created_at")} if self.profile["handle"] == params[0] else None
        return dict(self.profile)


def token(**overrides):
    claims = {"sub": str(USER_ID), "email": "a@b.com", "aud": "authenticated", "iss": ISSUER,
              "exp": int(time.time()) + 600, **overrides}
    return jwt.encode(claims, KEY, algorithm="ES256")


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
    r = c.get("/api/me", headers={"Authorization": f"Bearer {token()}"})
    assert r.status_code == 200
    assert r.json()["email"] == "a@b.com" and r.json()["city"] == "Mumbai"
    assert db.last[1] == (USER_ID,)


def test_me_update_only_allowed_fields(client):
    c, db = client
    r = c.patch("/api/me", json={"full_name": "Asha", "role": "admin"}, headers={"Authorization": f"Bearer {token()}"})
    assert r.status_code == 200
    assert r.json()["full_name"] == "Asha"
    assert r.json()["role"] == "guest"  # role can't be changed by the person themselves


def auth_header():
    return {"Authorization": f"Bearer {token()}"}


def test_me_saves_the_new_profile_fields(client):
    c, _ = client
    r = c.patch("/api/me", json={"handle": "Asha_K", "bio": "Hunting hidden gems", "instagram": "asha.k", "youtube": "@ashak",
                                 "x_handle": "ashak", "badge": "sponty", "birthday": "2002-09-21"}, headers=auth_header())
    assert r.status_code == 200
    body = r.json()
    assert body["handle"] == "asha_k"  # saved in lowercase
    assert body["badge"] == "sponty" and body["bio"] == "Hunting hidden gems" and body["birthday"] == "2002-09-21"


def test_me_rejects_bad_values(client):
    c, _ = client
    for bad in [{"handle": "no"}, {"handle": "has space"}, {"bio": "x" * 201}, {"instagram": "not valid!"}, {"x_handle": "a" * 41}]:
        assert c.patch("/api/me", json=bad, headers=auth_header()).status_code == 422, bad


def test_host_badges_are_not_self_service(client):
    c, _ = client
    for badge in ("pro", "exclusive", "admin"):
        assert c.patch("/api/me", json={"badge": badge}, headers=auth_header()).status_code == 422


def test_photo_must_be_from_own_folder(client):
    c, _ = client
    own = f"https://test.supabase.co/storage/v1/object/public/avatars/{USER_ID}/me.jpg"
    other = "https://test.supabase.co/storage/v1/object/public/avatars/00000000-0000-0000-0000-000000000000/me.jpg"
    assert c.patch("/api/me", json={"avatar_url": own}, headers=auth_header()).status_code == 200
    for bad in (other, "https://evil.example/me.jpg"):
        assert c.patch("/api/me", json={"avatar_url": bad}, headers=auth_header()).status_code == 422


def test_taken_handle_is_a_clear_conflict(client):
    c, _ = client
    r = c.patch("/api/me", json={"handle": "taken"}, headers=auth_header())
    assert r.status_code == 409 and "taken" in r.json()["detail"]


def test_public_profile_needs_no_login_and_hides_private_fields(client):
    c, db = client
    db.profile["handle"] = "asha_k"
    db.profile["birthday"] = "2002-09-21"
    r = c.get("/api/people/Asha_K")  # no login, capitals ignored
    assert r.status_code == 200
    body = r.json()
    assert body["handle"] == "asha_k" and body["badge"] == "vibes"
    assert "email" not in body and "birthday" not in body and "role" not in body
    assert c.get("/api/people/nobody_here").status_code == 404
    assert c.get("/api/people/a").status_code == 422
