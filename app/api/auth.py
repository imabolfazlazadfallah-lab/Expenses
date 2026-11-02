from __future__ import annotations

import math
import re
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.auth_security import hash_password, verify_password
from app.database import get_connection

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

USERNAME_RE = re.compile(r"^[A-Za-z0-9_.@+-]{3,100}$")
TRIAL_DAYS = 7


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=1, max_length=256)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=8, max_length=256)
    # The registration UI does not collect a full name. The backend will use
    # the username as a compatibility display value for older NOT NULL schemas.
    full_name: str | None = Field(default=None, max_length=200)


def get_session_user_id(request: Request) -> int:
    try:
        return int(request.session.get("user_id"))
    except (TypeError, ValueError, AttributeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="ابتدا وارد حساب کاربری شوید.")


def _serialize_date(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat(sep=" ", timespec="seconds")
    return str(value)


def _trial_payload(status_value: str, remaining_days: int, created_at: Any, trial_end: Any) -> dict[str, Any]:
    return {
        "days": TRIAL_DAYS,
        "status": status_value or "expired",
        "remainingDays": max(0, int(remaining_days or 0)),
        "createdAt": _serialize_date(created_at),
        "trialEnd": _serialize_date(trial_end),
    }


def require_active_user(request: Request) -> dict[str, Any]:
    """Resolve the current session and calculate the trial from Oracle's CREATED_AT."""
    user_id = get_session_user_id(request)
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """SELECT USER_ID, USERNAME, FULL_NAME, IS_ACTIVE, CREATED_AT,
                      CASE
                        WHEN CAST(CREATED_AT AS DATE) + :trial_days <= SYSDATE THEN 'expired'
                        WHEN CAST(CREATED_AT AS DATE) + :trial_days <= SYSDATE + 2 THEN 'warning'
                        ELSE 'trial'
                      END AS TRIAL_STATUS,
                      GREATEST(0, CEIL(CAST(CREATED_AT AS DATE) + :trial_days - SYSDATE)) AS REMAINING_DAYS,
                      CAST(CREATED_AT AS DATE) + :trial_days AS TRIAL_END
               FROM EXP_USERS
               WHERE USER_ID = :user_id""",
            {"trial_days": TRIAL_DAYS, "user_id": user_id},
        )
        row = cursor.fetchone()
        if not row or int(row[3] or 0) != 1:
            request.session.clear()
            raise HTTPException(status_code=401, detail="حساب کاربری فعال نیست؛ دوباره وارد شوید.")

        trial = _trial_payload(row[5], row[6], row[4], row[7])
        return {
            "user_id": int(row[0]),
            "username": row[1],
            "full_name": row[2],
            "created_at": _serialize_date(row[4]),
            "trial": trial,
        }
    except HTTPException:
        raise
    finally:
        connection.close()


def require_owner_user(request: Request) -> None:
    # EXP_CATEGORIES is a shared catalog; only the existing owner can edit it.
    user_id = get_session_user_id(request)
    if user_id != 1:
        raise HTTPException(status_code=403, detail="مدیریت دسته‌بندی‌های مشترک فقط برای مالک برنامه فعال است.")


@router.get("/me")
def get_me(request: Request):
    try:
        user = require_active_user(request)
        return {
            "status": "success",
            "authenticated": True,
            "user": {
                "user_id": user["user_id"],
                "username": user["username"],
                "full_name": user["full_name"],
                "created_at": user["created_at"],
            },
            "trial": user["trial"],
        }
    except HTTPException:
        return {"status": "success", "authenticated": False, "user": None, "trial": None}


@router.get("/usage-level")
def get_usage_level(request: Request):
    """Compute a transparent usage tier from recorded financial activity."""
    user_id = get_session_user_id(request)
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """SELECT
                   (SELECT COUNT(*) FROM EXP_EXPENSES WHERE USER_ID = :u1),
                   (SELECT COUNT(*) FROM EXP_ACCOUNT_CREDITS WHERE USER_ID = :u2),
                   (SELECT COUNT(*) FROM EXP_ACCOUNT_TRANSFERS WHERE USER_ID = :u3),
                   (SELECT COUNT(*) FROM EXP_ACCOUNTS WHERE USER_ID = :u4 AND IS_ACTIVE = 1)
                 FROM DUAL""",
            {"u1": user_id, "u2": user_id, "u3": user_id, "u4": user_id},
        )
        row = cursor.fetchone() or (0, 0, 0, 0)
        expense_count, credit_count, transfer_count, account_count = [int(value or 0) for value in row]
        activity_count = expense_count + credit_count + transfer_count
        score = activity_count + (account_count * 3)
        if score >= 300:
            level, label, next_level_at = "PLATINUM", "پلاتینیوم", None
        elif score >= 100:
            level, label, next_level_at = "GOLD", "طلایی", 300
        elif score >= 25:
            level, label, next_level_at = "SILVER", "نقره‌ای", 100
        else:
            level, label, next_level_at = "BRONZE", "برنز", 25
        return {
            "status": "success",
            "usage": {
                "level": level,
                "label": label,
                "score": score,
                "expense_count": expense_count,
                "credit_count": credit_count,
                "transfer_count": transfer_count,
                "active_account_count": account_count,
                "next_level_at": next_level_at,
            },
        }
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Could not calculate usage level")
        raise HTTPException(status_code=503, detail="سطح کاربری در حال حاضر قابل محاسبه نیست.")
    finally:
        connection.close()


@router.post("/login")
def login(data: LoginRequest, request: Request):
    username = data.username.strip()
    if not USERNAME_RE.fullmatch(username):
        raise HTTPException(status_code=400, detail="نام کاربری معتبر نیست.")

    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """SELECT USER_ID, USERNAME, PASSWORD_HASH, FULL_NAME, IS_ACTIVE
               FROM EXP_USERS WHERE UPPER(USERNAME) = UPPER(:username)""",
            {"username": username},
        )
        row = cursor.fetchone()
        if not row or int(row[4] or 0) != 1 or not verify_password(data.password, row[2]):
            raise HTTPException(status_code=401, detail="نام کاربری یا رمز عبور اشتباه است.")

        # Rehash compatible legacy hashes with the current stronger format.
        if not str(row[2] or "").startswith("pbkdf2_sha256$"):
            cursor.execute(
                "UPDATE EXP_USERS SET PASSWORD_HASH = :password_hash WHERE USER_ID = :user_id",
                {"password_hash": hash_password(data.password), "user_id": int(row[0])},
            )
            connection.commit()

        request.session.clear()
        request.session["user_id"] = int(row[0])
        return {"status": "success", "message": "ورود موفق بود.", "user": {
            "user_id": int(row[0]), "username": row[1], "full_name": row[3]
        }}
    except HTTPException:
        raise
    except Exception as exc:
        connection.rollback()
        raise HTTPException(status_code=500, detail="خطا در ورود؛ اتصال دیتابیس و لاگ سرور را بررسی کنید.") from exc
    finally:
        connection.close()


@router.post("/register", status_code=201)
def register(data: RegisterRequest, request: Request):
    username = data.username.strip()
    full_name = (data.full_name or username).strip() or username
    if not USERNAME_RE.fullmatch(username):
        raise HTTPException(status_code=400, detail="نام کاربری باید ۳ تا ۱۰۰ نویسه و شامل حروف انگلیسی، عدد یا . _ @ + - باشد.")
    try:
        password_hash = hash_password(data.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "SELECT COUNT(*) FROM EXP_USERS WHERE UPPER(USERNAME) = UPPER(:username)",
            {"username": username},
        )
        if int(cursor.fetchone()[0] or 0) > 0:
            raise HTTPException(status_code=409, detail="این نام کاربری قبلاً ثبت شده است.")

        user_id_var = cursor.var(int)
        cursor.execute(
            """INSERT INTO EXP_USERS (USERNAME, PASSWORD_HASH, FULL_NAME, IS_ACTIVE)
               VALUES (:username, :password_hash, :full_name, 1)
               RETURNING USER_ID INTO :user_id""",
            {"username": username, "password_hash": password_hash,
             "full_name": full_name, "user_id": user_id_var},
        )
        raw = user_id_var.getvalue()
        user_id = int(raw[0] if isinstance(raw, list) else raw)
        connection.commit()
        request.session.clear()
        request.session["user_id"] = user_id
        return {"status": "success", "message": "حساب ساخته شد.", "user": {
            "user_id": user_id, "username": username, "full_name": full_name
        }}
    except HTTPException:
        connection.rollback()
        raise
    except Exception as exc:
        connection.rollback()
        raise HTTPException(status_code=500, detail="خطا در ثبت‌نام؛ لاگ سرور را بررسی کنید.") from exc
    finally:
        connection.close()


@router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {"status": "success", "message": "از حساب خارج شدید."}
