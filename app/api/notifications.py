from __future__ import annotations

import hashlib
import os
import re
from urllib.parse import urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.api.auth import get_session_user_id, require_active_user
from app.database import get_connection

router = APIRouter(
    prefix="/api/notifications",
    tags=["Notifications"],
    dependencies=[Depends(require_active_user)],
)
TIME_RE = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")


class PushKeys(BaseModel):
    p256dh: str = Field(min_length=20, max_length=300)
    auth: str = Field(min_length=10, max_length=200)


class PushSubscriptionRequest(BaseModel):
    endpoint: str = Field(min_length=20, max_length=2000)
    keys: PushKeys
    reminder_time: str = Field(default="20:00", min_length=5, max_length=5)
    timezone: str = Field(default="Asia/Tehran", min_length=1, max_length=100)


class ReminderTimeRequest(BaseModel):
    reminder_time: str = Field(min_length=5, max_length=5)


def _vapid_public_key() -> str:
    return (os.getenv("VAPID_PUBLIC_KEY") or "").strip()


def _endpoint_hash(endpoint: str) -> str:
    return hashlib.sha256(endpoint.encode("utf-8")).hexdigest()


def _validate_settings(reminder_time: str, timezone: str) -> None:
    if not TIME_RE.fullmatch(reminder_time):
        raise HTTPException(status_code=400, detail="زمان یادآوری معتبر نیست.")
    try:
        ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(status_code=400, detail="منطقه زمانی معتبر نیست.")


@router.get("/config")
def get_push_config():
    public_key = _vapid_public_key()
    private_key_file = (os.getenv("VAPID_PRIVATE_KEY_FILE") or "").strip()
    subject = (os.getenv("VAPID_SUBJECT") or "").strip()
    subject_valid = subject.startswith(("mailto:", "https://"))
    configured = bool(public_key and private_key_file and os.path.isfile(private_key_file) and subject_valid)
    return {
        "status": "success",
        "configured": configured,
        "public_key": public_key,
        "message": "" if configured else "برای اعلان روزانه باید VAPID_PUBLIC_KEY، VAPID_PRIVATE_KEY_FILE و VAPID_SUBJECT روی سرور تنظیم شوند.",
    }


@router.get("/status")
def get_push_status(request: Request):
    user_id = get_session_user_id(request)
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """SELECT REMINDER_TIME, TIMEZONE
               FROM EXP_PUSH_SUBSCRIPTIONS
               WHERE USER_ID = :user_id AND IS_ACTIVE = 1
               ORDER BY CREATED_AT DESC
               FETCH FIRST 1 ROWS ONLY""",
            {"user_id": user_id},
        )
        row = cursor.fetchone()
        return {
            "status": "success",
            "active": bool(row),
            "reminder_time": row[0] if row else "20:00",
            "timezone": row[1] if row else "Asia/Tehran",
        }
    finally:
        connection.close()


@router.post("/subscribe")
def save_push_subscription(data: PushSubscriptionRequest, request: Request):
    user_id = get_session_user_id(request)
    parsed = urlparse(data.endpoint)
    if parsed.scheme != "https" or not parsed.netloc:
        raise HTTPException(status_code=400, detail="نشانی سرویس اعلان نامعتبر است.")
    _validate_settings(data.reminder_time, data.timezone)

    endpoint_hash = _endpoint_hash(data.endpoint)
    connection = get_connection()
    try:
        cursor = connection.cursor()
        # An endpoint belongs to one browser installation. Reassign it safely if
        # that browser signs into a different account.
        cursor.execute(
            "DELETE FROM EXP_PUSH_SUBSCRIPTIONS WHERE ENDPOINT_HASH = :endpoint_hash",
            {"endpoint_hash": endpoint_hash},
        )
        cursor.execute(
            """INSERT INTO EXP_PUSH_SUBSCRIPTIONS
                   (USER_ID, ENDPOINT, ENDPOINT_HASH, P256DH, AUTH_KEY,
                    REMINDER_TIME, TIMEZONE, IS_ACTIVE, LAST_SENT_DATE,
                    CREATED_AT, UPDATED_AT)
               VALUES
                   (:user_id, :endpoint, :endpoint_hash, :p256dh, :auth_key,
                    :reminder_time, :timezone, 1, NULL, SYSTIMESTAMP, SYSTIMESTAMP)""",
            {
                "user_id": user_id,
                "endpoint": data.endpoint,
                "endpoint_hash": endpoint_hash,
                "p256dh": data.keys.p256dh,
                "auth_key": data.keys.auth,
                "reminder_time": data.reminder_time,
                "timezone": data.timezone,
            },
        )
        connection.commit()
        return {"status": "success", "active": True, "reminder_time": data.reminder_time}
    except Exception as exc:
        connection.rollback()
        raise HTTPException(status_code=500, detail="ذخیره تنظیم اعلان انجام نشد؛ وجود جدول EXP_PUSH_SUBSCRIPTIONS را بررسی کنید.") from exc
    finally:
        connection.close()


@router.post("/reminder-time")
def update_reminder_time(data: ReminderTimeRequest, request: Request):
    user_id = get_session_user_id(request)
    if not TIME_RE.fullmatch(data.reminder_time):
        raise HTTPException(status_code=400, detail="زمان یادآوری معتبر نیست.")
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """UPDATE EXP_PUSH_SUBSCRIPTIONS
               SET REMINDER_TIME = :reminder_time, UPDATED_AT = SYSTIMESTAMP
               WHERE USER_ID = :user_id AND IS_ACTIVE = 1""",
            {"reminder_time": data.reminder_time, "user_id": user_id},
        )
        affected = cursor.rowcount
        connection.commit()
        return {"status": "success", "updated": affected}
    except Exception as exc:
        connection.rollback()
        raise HTTPException(status_code=500, detail="به‌روزرسانی زمان اعلان انجام نشد.") from exc
    finally:
        connection.close()


@router.post("/disable")
def disable_push_notifications(request: Request):
    user_id = get_session_user_id(request)
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """UPDATE EXP_PUSH_SUBSCRIPTIONS
               SET IS_ACTIVE = 0, UPDATED_AT = SYSTIMESTAMP
               WHERE USER_ID = :user_id AND IS_ACTIVE = 1""",
            {"user_id": user_id},
        )
        affected = cursor.rowcount
        connection.commit()
        return {"status": "success", "disabled": affected}
    except Exception as exc:
        connection.rollback()
        raise HTTPException(status_code=500, detail="غیرفعال‌کردن اعلان‌ها انجام نشد.") from exc
    finally:
        connection.close()
