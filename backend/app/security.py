"""Password hashing and signed admin tokens using only the standard library.

Passwords: PBKDF2-HMAC-SHA256 with a random salt.
Tokens:    base64url(JSON payload) + "." + base64url(HMAC-SHA256 signature).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .models import AdminUser

PBKDF2_ITERATIONS = 240_000
_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt_hex, digest_hex = stored.split("$")
    except ValueError:
        return False
    if algo != "pbkdf2_sha256":
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations))
    return hmac.compare_digest(digest.hex(), digest_hex)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _sign(body: str) -> str:
    key = get_settings().secret_key.encode()
    return _b64(hmac.new(key, body.encode(), hashlib.sha256).digest())


def create_token(username: str) -> tuple[str, datetime]:
    expires = datetime.now(timezone.utc) + timedelta(minutes=get_settings().token_ttl_minutes)
    body = _b64(json.dumps({"sub": username, "exp": int(expires.timestamp())}).encode())
    return f"{body}.{_sign(body)}", expires


def decode_token(token: str) -> str | None:
    try:
        body, sig = token.split(".")
        if not hmac.compare_digest(sig, _sign(body)):
            return None
        payload = json.loads(_unb64(body))
        if payload["exp"] < datetime.now(timezone.utc).timestamp():
            return None
        return str(payload["sub"])
    except (ValueError, KeyError, json.JSONDecodeError):
        return None


def authenticate(db: Session, username: str, password: str) -> AdminUser | None:
    user = db.scalar(select(AdminUser).where(AdminUser.username == username))
    if user is None or not verify_password(password, user.password_hash):
        return None
    return user


def require_admin(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> AdminUser:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Admin authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if creds is None:
        raise unauthorized
    username = decode_token(creds.credentials)
    if username is None:
        raise unauthorized
    user = db.scalar(select(AdminUser).where(AdminUser.username == username))
    if user is None:
        raise unauthorized
    return user
