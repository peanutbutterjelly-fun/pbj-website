"""Who is calling? Checks the Supabase login token sent as `Authorization: Bearer <token>`.

Supabase signs tokens with a key pair and publishes the public half, so checking
them needs no secret.
"""

from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: UUID
    email: str | None


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    url = get_settings().supabase_issuer + "/.well-known/jwks.json"
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=3600)


def _unauthorized(message: str) -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, message, headers={"WWW-Authenticate": "Bearer"})


def current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> CurrentUser:
    """FastAPI dependency: the logged-in user, or 401."""
    if creds is None:
        raise _unauthorized("Not logged in")
    settings = get_settings()
    if not settings.supabase_url:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Login is not configured")
    try:
        key = _jwks_client().get_signing_key_from_jwt(creds.credentials).key
        claims = jwt.decode(
            creds.credentials,
            key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=settings.supabase_issuer,
        )
        return CurrentUser(id=UUID(claims["sub"]), email=claims.get("email"))
    except (jwt.PyJWTError, KeyError, ValueError):
        raise _unauthorized("Login expired or invalid") from None


LoggedIn = Annotated[CurrentUser, Depends(current_user)]
