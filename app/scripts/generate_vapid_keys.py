"""Generate Web Push VAPID keys and save the private key outside the project tree."""
from __future__ import annotations

import argparse
import base64
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate VAPID keys for PWA push notifications")
    parser.add_argument(
        "--private-key-path",
        default=str(Path.home() / "expense-vapid-private.pem"),
        help="Path outside the project where the private PEM file will be saved",
    )
    args = parser.parse_args()
    path = Path(args.private_key_path).expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)

    private_key = ec.generate_private_key(ec.SECP256R1())
    pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    path.write_bytes(pem)
    try:
        path.chmod(0o600)
    except OSError:
        pass
    public_raw = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )
    print("VAPID_PUBLIC_KEY=" + b64url(public_raw))
    print("VAPID_PRIVATE_KEY_FILE=" + str(path))
    print("کلید خصوصی در مسیر بالا ذخیره شد؛ آن را منتشر نکن و داخل ZIP پروژه قرار نده.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
