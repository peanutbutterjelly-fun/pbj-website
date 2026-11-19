import time
import uuid

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

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
                        "phone": None, "host_kind": None, "link": None, "about": None, "wants_call": False,
                        "onboarded_at": None, "created_at": None, "updated_at": None}
        self.last = None
        self.updates = []

    def execute(self, sql, params=None):
        self.last = (sql, params)
        if sql.startswith("update"):
            self.updates.append((sql, params))
            self.profile.update({k: v for k, v in params.items() if k != "id"})
        return self

    def fetchone(self):
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


def test_me_finishes_welcome_steps(client):
    c, db = client
    body = {"full_name": "Asha", "phone": "+91 98200 00000", "host_kind": "Venue or studio",
            "link": "instagram.com/asha", "wants_call": True, "onboarded": True}
    r = c.patch("/api/me", json=body, headers={"Authorization": f"Bearer {token()}"})
    assert r.status_code == 200
    sql, params = db.updates[-1]
    assert "onboarded_at = coalesce(onboarded_at, now())" in sql
    assert params["host_kind"] == "Venue or studio" and params["wants_call"] is True
    assert "onboarded" not in params


def test_me_ignores_empty_wants_call(client):
    c, db = client
    r = c.patch("/api/me", json={"wants_call": None}, headers={"Authorization": f"Bearer {token()}"})
    assert r.status_code == 200
    assert db.updates == []


def test_me_onboarding_needs_name_and_kind(client):
    c, db = client
    r = c.patch("/api/me", json={"full_name": "Asha", "onboarded": True}, headers={"Authorization": f"Bearer {token()}"})
    assert r.status_code == 422
    assert db.updates == []


def test_me_photo_must_be_own_upload(client):
    c, db = client
    own = f"https://test.supabase.co/storage/v1/object/public/images/{USER_ID}/profile/a.jpg"
    for bad in ["https://evil.example/a.jpg", "javascript:alert(1)",
                f"https://test.supabase.co/storage/v1/object/public/images/{uuid.uuid4()}/profile/a.jpg",
                own.replace("a.jpg", "a'.jpg"),
                own.replace("profile/a.jpg", f"%2e%2e/{uuid.uuid4()}/profile/a.jpg"),
                own.replace("profile/a.jpg", "%2E%2E/x/a.jpg")]:
        assert c.patch("/api/me", json={"avatar_url": bad}, headers={"Authorization": f"Bearer {token()}"}).status_code == 422
    r = c.patch("/api/me", json={"avatar_url": own}, headers={"Authorization": f"Bearer {token()}"})
    assert r.status_code == 200 and r.json()["avatar_url"] == own
    r = c.patch("/api/me", json={"avatar_url": None}, headers={"Authorization": f"Bearer {token()}"})
    assert r.status_code == 200
