from __future__ import annotations

import re
from datetime import datetime, time, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

import jdatetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.api.auth import get_session_user_id, require_active_user
from app.database import get_connection

router = APIRouter(
    prefix="/api/report-schedules",
    tags=["Scheduled Reports"],
    dependencies=[Depends(require_active_user)],
)

TEHRAN = ZoneInfo("Asia/Tehran")
TIME_RE = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")


class ReportScheduleCreate(BaseModel):
    frequency: Literal["WEEKLY", "MONTHLY"]
    channel: Literal["TELEGRAM"]
    destination: str = Field(min_length=3, max_length=320)
    # WEEKLY: 0=Saturday ... 6=Friday. MONTHLY: 1..28.
    send_day: int = Field(ge=0, le=28)
    send_time: str = Field(min_length=5, max_length=5, default="09:00")


def tehran_now() -> datetime:
    return datetime.now(TEHRAN)


def next_run_at(frequency: str, send_day: int, send_time: str, now: datetime | None = None) -> datetime:
    now = now or tehran_now()
    if now.tzinfo is None:
        now = now.replace(tzinfo=TEHRAN)
    else:
        now = now.astimezone(TEHRAN)
    hour, minute = (int(part) for part in send_time.split(":"))
    local_now = now.replace(tzinfo=None)
    if frequency == "WEEKLY":
        # Python Monday=0 ... Sunday=6; Persian Saturday is 5.
        target_weekday = (int(send_day) + 5) % 7
        delta = (target_weekday - now.weekday()) % 7
        candidate_date = now.date() + timedelta(days=delta)
        candidate = datetime.combine(candidate_date, time(hour, minute))
        if candidate <= local_now:
            candidate += timedelta(days=7)
        return candidate

    if frequency != "MONTHLY" or not 1 <= int(send_day) <= 28:
        raise ValueError("تنظیم روز ارسال نامعتبر است.")
    # Monthly schedules follow the Solar Hijri calendar shown throughout the UI.
    jalali_now = jdatetime.date.fromgregorian(date=now.date())
    candidate_jalali = jdatetime.date(jalali_now.year, jalali_now.month, int(send_day))
    candidate_date = candidate_jalali.togregorian()
    candidate = datetime.combine(candidate_date, time(hour, minute))
    if candidate <= local_now:
        if jalali_now.month == 12:
            next_year, next_month = jalali_now.year + 1, 1
        else:
            next_year, next_month = jalali_now.year, jalali_now.month + 1
        next_jalali = jdatetime.date(next_year, next_month, int(send_day))
        candidate = datetime.combine(next_jalali.togregorian(), time(hour, minute))
    return candidate


def _validate_payload(data: ReportScheduleCreate) -> tuple[str, str]:
    destination = data.destination.strip()
    if not TIME_RE.fullmatch(data.send_time):
        raise HTTPException(status_code=400, detail="ساعت ارسال معتبر نیست.")
    if data.frequency == "WEEKLY" and not 0 <= data.send_day <= 6:
        raise HTTPException(status_code=400, detail="برای گزارش هفتگی، روز هفته را انتخاب کنید.")
    if data.frequency == "MONTHLY" and not 1 <= data.send_day <= 28:
        raise HTTPException(status_code=400, detail="برای گزارش ماهانه، روزی بین ۱ تا ۲۸ انتخاب کنید.")
    if data.channel != "TELEGRAM":
        raise HTTPException(status_code=400, detail="گزارش زمان‌بندی‌شده فقط از طریق تلگرام ارسال می‌شود.")
    if not re.fullmatch(r"(?:-?\d{3,20}|@[A-Za-z0-9_]{5,32})", destination):
        raise HTTPException(status_code=400, detail="شناسه چت تلگرام معتبر نیست؛ Chat ID عددی یا شناسه کانال با @ را وارد کنید.")
    return destination, data.send_time


def _serial(row) -> dict:
    return {
        "schedule_id": int(row[0]),
        "frequency": str(row[1]),
        "channel": str(row[2]),
        "destination": str(row[3]),
        "send_day": int(row[4]),
        "send_time": str(row[5]),
        "is_active": bool(row[6]),
        "next_run_at": row[7].strftime("%Y-%m-%d %H:%M") if row[7] else None,
        "last_run_at": row[8].strftime("%Y-%m-%d %H:%M") if row[8] else None,
        "last_status": str(row[9]) if row[9] else None,
        "last_error": str(row[10]) if row[10] else None,
    }


@router.get("/")
def list_report_schedules(request: Request):
    user_id = get_session_user_id(request)
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """SELECT SCHEDULE_ID, FREQUENCY, CHANNEL, DESTINATION,
                      SEND_DAY, SEND_TIME, IS_ACTIVE, NEXT_RUN_AT,
                      LAST_RUN_AT, LAST_STATUS, LAST_ERROR
                 FROM EXP_REPORT_SCHEDULES
                WHERE USER_ID = :user_id
                ORDER BY IS_ACTIVE DESC, NEXT_RUN_AT""",
            {"user_id": user_id},
        )
        return {"status": "success", "schedules": [_serial(row) for row in cursor.fetchall()]}
    except Exception as exc:
        print(f"LIST REPORT SCHEDULES ERROR: {exc}")
        raise HTTPException(status_code=503, detail="تنظیمات گزارش زمان‌بندی‌شده نصب نشده است؛ اسکریپت SQL را اجرا کنید.") from exc
    finally:
        connection.close()


@router.post("/", status_code=201)
def create_report_schedule(data: ReportScheduleCreate, request: Request):
    user_id = get_session_user_id(request)
    destination, send_time = _validate_payload(data)
    next_at = next_run_at(data.frequency, data.send_day, send_time)
    connection = get_connection()
    try:
        cursor = connection.cursor()
        schedule_id_var = cursor.var(int)
        cursor.execute(
            """INSERT INTO EXP_REPORT_SCHEDULES
                   (USER_ID, FREQUENCY, CHANNEL, DESTINATION, SEND_DAY, SEND_TIME,
                    IS_ACTIVE, NEXT_RUN_AT, LAST_STATUS, CREATED_AT, UPDATED_AT)
               VALUES (:user_id, :frequency, :channel, :destination, :send_day, :send_time,
                       1, :next_run_at, 'PENDING', SYSTIMESTAMP, SYSTIMESTAMP)
               RETURNING SCHEDULE_ID INTO :schedule_id""",
            {
                "user_id": user_id,
                "frequency": data.frequency,
                "channel": data.channel,
                "destination": destination,
                "send_day": data.send_day,
                "send_time": send_time,
                "next_run_at": next_at,
                "schedule_id": schedule_id_var,
            },
        )
        raw_id = schedule_id_var.getvalue()
        if isinstance(raw_id, (list, tuple)):
            raw_id = raw_id[0] if raw_id else None
        if raw_id is None:
            raise RuntimeError("Oracle did not return SCHEDULE_ID")
        schedule_id = int(raw_id)
        connection.commit()
        return {
            "status": "success",
            "message": "زمان‌بندی گزارش ذخیره شد.",
            "schedule": {
                "schedule_id": schedule_id,
                "frequency": data.frequency,
                "channel": data.channel,
                "destination": destination,
                "send_day": data.send_day,
                "send_time": send_time,
                "is_active": True,
                "next_run_at": next_at.strftime("%Y-%m-%d %H:%M"),
                "last_run_at": None,
                "last_status": "PENDING",
                "last_error": None,
            },
        }
    except HTTPException:
        connection.rollback()
        raise
    except Exception as exc:
        connection.rollback()
        print(f"CREATE REPORT SCHEDULE ERROR: {exc}")
        raise HTTPException(status_code=503, detail="ذخیره زمان‌بندی انجام نشد؛ وجود جدول EXP_REPORT_SCHEDULES و دسترسی دیتابیس را بررسی کنید.") from exc
    finally:
        connection.close()


@router.delete("/{schedule_id}")
def deactivate_report_schedule(schedule_id: int, request: Request):
    user_id = get_session_user_id(request)
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """UPDATE EXP_REPORT_SCHEDULES
                  SET IS_ACTIVE = 0, UPDATED_AT = SYSTIMESTAMP
                WHERE SCHEDULE_ID = :schedule_id AND USER_ID = :user_id""",
            {"schedule_id": schedule_id, "user_id": user_id},
        )
        changed = cursor.rowcount
        connection.commit()
        if not changed:
            raise HTTPException(status_code=404, detail="زمان‌بندی پیدا نشد.")
        return {"status": "success", "message": "ارسال زمان‌بندی‌شده غیرفعال شد."}
    except HTTPException:
        connection.rollback()
        raise
    except Exception as exc:
        connection.rollback()
        print(f"DELETE REPORT SCHEDULE ERROR: {exc}")
        raise HTTPException(status_code=503, detail="غیرفعال‌کردن زمان‌بندی انجام نشد.") from exc
    finally:
        connection.close()
