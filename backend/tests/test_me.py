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
                        "created_at": None, "updated_at": None}
        self.last = None

    def execute(self, sql, params=None):
        self.last = (sql, params)
        if sql.startswith("update"):
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
