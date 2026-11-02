"""Send due daily reminders for active Web Push subscriptions.

Run from project root, for example from Windows Task Scheduler every 5 minutes:
    .venv\\Scripts\\python.exe -m app.scripts.send_daily_reminders
"""
from __future__ import annotations

import json
import os
import sys
from datetime import date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.database import get_connection

DEFAULT_TIMEZONE = "Asia/Tehran"
DEFAULT_TITLE = "یادآوری مدیریت هزینه"
DEFAULT_BODY = "اگر امروز هزینه‌ای داشتی، ثبتش کن تا گزارش‌هایت دقیق بماند."


def local_now(timezone_name: str) -> datetime:
    try:
        return datetime.now(ZoneInfo(timezone_name or DEFAULT_TIMEZONE))
    except (ZoneInfoNotFoundError, ValueError):
        return datetime.now(ZoneInfo(DEFAULT_TIMEZONE))


def main() -> int:
    private_key_file = (os.getenv("VAPID_PRIVATE_KEY_FILE") or "").strip()
    subject = (os.getenv("VAPID_SUBJECT") or "").strip()
    if not private_key_file or not os.path.isfile(private_key_file):
        print("VAPID_PRIVATE_KEY_FILE تنظیم نشده یا فایل کلید خصوصی پیدا نشد.", file=sys.stderr)
        return 2
    if not subject.startswith(("mailto:", "https://")):
        print("VAPID_SUBJECT باید با mailto: یا https:// شروع شود.", file=sys.stderr)
        return 2

    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        print("وابستگی pywebpush نصب نیست؛ requirements_notifications.txt را نصب کن.", file=sys.stderr)
        return 2

    connection = get_connection()
    sent = 0
    skipped = 0
    removed = 0
    try:
        cursor = connection.cursor()
        cursor.execute(
            """SELECT PUSH_SUBSCRIPTION_ID, USER_ID, ENDPOINT, P256DH, AUTH_KEY,
                      REMINDER_TIME, TIMEZONE, LAST_SENT_DATE
               FROM EXP_PUSH_SUBSCRIPTIONS
               WHERE IS_ACTIVE = 1
               ORDER BY PUSH_SUBSCRIPTION_ID"""
        )
        subscriptions = cursor.fetchall()

        for row in subscriptions:
            subscription_id, _user_id, endpoint, p256dh, auth_key, reminder_time, timezone_name, last_sent = row
            now = local_now(str(timezone_name or DEFAULT_TIMEZONE))
            today = now.date()
            current_hhmm = now.strftime("%H:%M")
            target_hhmm = str(reminder_time or "20:00")
            last_sent_day = last_sent.date() if isinstance(last_sent, datetime) else last_sent

            # A task launched a few minutes late will still deliver the reminder;
            # LAST_SENT_DATE prevents duplicate pushes during the same local day.
            if current_hhmm < target_hhmm or (last_sent_day is not None and last_sent_day >= today):
                skipped += 1
                continue

            payload = json.dumps({
                "title": DEFAULT_TITLE,
                "body": DEFAULT_BODY,
                "url": "/",
                "tag": f"daily-expense-reminder-{today.isoformat()}"
            }, ensure_ascii=False)
            try:
                webpush(
                    subscription_info={
                        "endpoint": endpoint,
                        "keys": {"p256dh": p256dh, "auth": auth_key},
                    },
                    data=payload,
                    vapid_private_key=private_key_file,
                    vapid_claims={"sub": subject},
                    timeout=15,
                )
                cursor.execute(
                    """UPDATE EXP_PUSH_SUBSCRIPTIONS
                       SET LAST_SENT_DATE = :sent_date, UPDATED_AT = SYSTIMESTAMP
                       WHERE PUSH_SUBSCRIPTION_ID = :subscription_id AND IS_ACTIVE = 1""",
                    {"sent_date": datetime.combine(today, datetime.min.time()), "subscription_id": subscription_id},
                )
                connection.commit()
                sent += 1
            except WebPushException as exc:
                status_code = getattr(getattr(exc, "response", None), "status_code", None)
                if status_code in (404, 410):
                    cursor.execute(
                        """UPDATE EXP_PUSH_SUBSCRIPTIONS
                           SET IS_ACTIVE = 0, UPDATED_AT = SYSTIMESTAMP
                           WHERE PUSH_SUBSCRIPTION_ID = :subscription_id""",
                        {"subscription_id": subscription_id},
                    )
                    connection.commit()
                    removed += 1
                else:
                    connection.rollback()
                    print(f"ارسال اعلان برای subscription id={subscription_id} شکست خورد: HTTP {status_code or 'unknown'}", file=sys.stderr)
            except Exception as exc:
                connection.rollback()
                print(f"خطا در ارسال اعلان برای subscription id={subscription_id}: {type(exc).__name__}", file=sys.stderr)

        print(f"اعلان‌های ارسال‌شده: {sent} | کنارگذاشته‌شده: {skipped} | اشتراک غیرفعال‌شده: {removed}")
        return 0
    finally:
        connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
