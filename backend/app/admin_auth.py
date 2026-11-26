"""The back office login: one staff username and password, sent with every admin request (HTTP Basic, over HTTPS).

Only a scrypt fingerprint of the password is kept (config.py, or ADMIN_PASSWORD_HASH on Railway), so reading the code
doesn't give the password away. Wrong guesses are slowed down and then refused for a while.

Make a fingerprint for a new password:  python -m app.admin_auth
"""

import base64
import hashlib
import hmac
import secrets
import threading
import time
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from app.config import get_settings

_basic = HTTPBasic(auto_error=False)

MAX_FAILS = 5  # wrong tries from one address...
WINDOW = 15 * 60  # ...within this many seconds, then that address waits this long
_fails: dict[str, list[float]] = {}
_ok: set[bytes] = set()  # logins already checked (scrypt is slow on purpose, so it isn't run on every request)
_lock = threading.Lock()


def make_hash(password: str, n: int = 2**14, r: int = 8, p: int = 1) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=n, r=r, p=p, dklen=32)
    return f"scrypt${n}${r}${p}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def password_matches(password: str, stored: str) -> bool:
    try:
        name, n, r, p, salt, digest = stored.split("$")
        if name != "scrypt":
            return False
        want = base64.b64decode(digest)
        got = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt), n=int(n), r=int(r), p=int(p), dklen=len(want))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(got, want)


def _address(request: Request) -> str:
    # Railway puts the real address last in X-Forwarded-For (earlier entries can be made up by the caller)
    forwarded = request.headers.get("x-forwarded-for", "")
    return forwarded.split(",")[-1].strip() or (request.client.host if request.client else "?")


def _refused() -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong username or password")


def staff(request: Request, creds: Annotated[HTTPBasicCredentials | None, Depends(_basic)]) -> str:
    """FastAPI dependency: lets the back office login through, refuses everyone else (401, or 429 after too many tries)."""
    if creds is None:
        raise _refused()
    settings = get_settings()
    who, now = _address(request), time.monotonic()
    key = hashlib.sha256(f"{creds.username}\0{creds.password}\0{settings.admin_password_hash}".encode()).digest()
    with _lock:
        recent = [t for t in _fails.get(who, []) if now - t < WINDOW]
        _fails[who] = recent
        if len(recent) >= MAX_FAILS:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many wrong tries. Wait 15 minutes and try again.")
        if key in _ok:
            return creds.username
        # Count this try as wrong before checking it, so many tries sent at the same moment can't all slip past the limit.
        # A right password takes the mark back off.
        recent.append(now)
    good = hmac.compare_digest(creds.username.encode(), settings.admin_username.encode())
    good = password_matches(creds.password, settings.admin_password_hash) and good
    with _lock:
        if good:
            _ok.add(key)
            _fails.pop(who, None)
            return creds.username
    time.sleep(0.5)
    raise _refused()


Staff = Annotated[str, Depends(staff)]


if __name__ == "__main__":
    import getpass

    print(make_hash(getpass.getpass("New back office password: ")))
