"""Password hashing helpers for the expense application.

Passwords are stored as salted PBKDF2-HMAC-SHA256 strings. No third-party
password-hashing package is required.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets

# Keep this secret stable between restarts. Replace it with a private random
# value before deploying the application publicly. Never publish this file.
SESSION_SECRET_KEY = 'GyXEdt5U5kvSPAknA_L4kHWfKvk1BaiCcKMVVhePQxWTbTMYyS88JUEiMkfDKLK_hykVX0TZJ93vKhMQGieM5w'
PASSWORD_SCHEME = "pbkdf2_sha256"
PASSWORD_ITERATIONS = 390_000


def _b64u(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _unb64u(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def hash_password(password: str) -> str:
    if not isinstance(password, str) or len(password) < 8:
        raise ValueError("رمز عبور باید حداقل ۸ نویسه باشد.")
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS
    )
    return f"{PASSWORD_SCHEME}${PASSWORD_ITERATIONS}${_b64u(salt)}${_b64u(digest)}"


def verify_password(password: str, stored_hash: str | None) -> bool:
    """Verify our PBKDF2 format and a few common legacy hash formats.

    Legacy SHA-256 support is solely for migration. A successful legacy
    login is re-hashed by the login endpoint.
    """
    if not password or not stored_hash:
        return False
    stored = stored_hash.strip()
    try:
        parts = stored.split("$")
        if len(parts) == 4 and parts[0] == PASSWORD_SCHEME:
            iterations = int(parts[1])
            if not 100_000 <= iterations <= 2_000_000:
                return False
            salt = _unb64u(parts[2])
            expected = _unb64u(parts[3])
            actual = hashlib.pbkdf2_hmac(
                "sha256", password.encode("utf-8"), salt, iterations
            )
            return hmac.compare_digest(actual, expected)

        # passlib pbkdf2_sha256: pbkdf2_sha256$rounds$salt$base64digest
        if len(parts) == 4 and parts[0] == "pbkdf2_sha256":
            iterations = int(parts[1])
            if not 1_000 <= iterations <= 2_000_000:
                return False
            salt = parts[2].encode("utf-8")
            encoded = parts[3]
            expected = base64.b64decode(encoded + "=" * (-len(encoded) % 4))
            actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
            return hmac.compare_digest(actual, expected)

        # Legacy SHA-256 hex digest. Re-hash on successful login.
        candidate = stored.lower()
        if re.fullmatch(r"[0-9a-f]{64}", candidate):
            return hmac.compare_digest(hashlib.sha256(password.encode("utf-8")).hexdigest(), candidate)
        if candidate.startswith("sha256:") and re.fullmatch(r"[0-9a-f]{64}", candidate[7:]):
            return hmac.compare_digest(hashlib.sha256(password.encode("utf-8")).hexdigest(), candidate[7:])

        # Optional compatibility if bcrypt is installed in the deployment.
        if stored.startswith(("$2a$", "$2b$", "$2y$")):
            try:
                import bcrypt  # type: ignore
                return bool(bcrypt.checkpw(password.encode("utf-8"), stored.encode("utf-8")))
            except Exception:
                return False
    except (ValueError, TypeError, base64.binascii.Error):
        return False
    return False
