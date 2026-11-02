"""One-time local tool to set login credentials for existing EXP_USERS.USER_ID=1.

Run from the project root after the normal app/database.py is configured:
    python scripts/initialize_owner_login.py

This script updates only EXP_USERS.USER_ID=1; it does not modify expenses,
accounts, or any transaction rows.
"""
from __future__ import annotations

import getpass
import re
import sys

from app.auth_security import hash_password
from app.database import get_connection

USERNAME_RE = re.compile(r"^[A-Za-z0-9_.@+-]{3,100}$")


def main() -> int:
    print("تنظیم ورود مالک برای کاربر فعلی (USER_ID=1)")
    print("این ابزار اطلاعات هزینه و حساب‌ها را تغییر نمی‌دهد.\n")
    username = input("نام کاربری جدید: ").strip()
    if not USERNAME_RE.fullmatch(username):
        print("نام کاربری باید ۳ تا ۱۰۰ نویسه و شامل حروف انگلیسی، عدد یا . _ @ + - باشد.")
        return 2
    full_name = input("نام نمایشی: ").strip()
    if not full_name or len(full_name) > 200:
        print("نام نمایشی معتبر نیست (۱ تا ۲۰۰ نویسه).")
        return 2
    password = getpass.getpass("رمز عبور جدید (حداقل ۸ نویسه): ")
    confirm = getpass.getpass("تکرار رمز عبور: ")
    if password != confirm:
        print("رمزهای عبور یکسان نیستند.")
        return 2
    try:
        password_hash = hash_password(password)
    except ValueError as exc:
        print(str(exc))
        return 2

    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("SELECT USER_ID FROM EXP_USERS WHERE USER_ID = 1 FOR UPDATE")
        owner_row = cursor.fetchone()
        if not owner_row:
            print("ردیف EXP_USERS.USER_ID=1 پیدا نشد؛ هیچ تغییری اعمال نشد.")
            connection.rollback()
            return 3

        cursor.execute(
            "SELECT USER_ID FROM EXP_USERS WHERE UPPER(USERNAME) = UPPER(:username)",
            {"username": username},
        )
        existing = cursor.fetchone()
        if existing and int(existing[0]) != 1:
            print("این نام کاربری متعلق به کاربر دیگری است؛ نام دیگری انتخاب کن.")
            connection.rollback()
            return 3

        cursor.execute(
            """UPDATE EXP_USERS
               SET USERNAME = :username,
                   PASSWORD_HASH = :password_hash,
                   FULL_NAME = :full_name,
                   IS_ACTIVE = 1
               WHERE USER_ID = 1""",
            {"username": username, "password_hash": password_hash, "full_name": full_name},
        )
        connection.commit()
        print("ورود مالک آماده شد. USER_ID=1 حفظ شد و اطلاعات مالی تغییر نکرد.")
        print(f"نام کاربری: {username}")
        print("اکنون در صفحه برنامه با همین نام کاربری و رمز جدید وارد شو.")
        return 0
    except Exception as exc:
        connection.rollback()
        print(f"خطا در تنظیم ورود مالک: {exc}")
        return 4
    finally:
        connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
