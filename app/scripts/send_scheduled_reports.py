"""Send due scheduled expense reports. Intended to run every 5 minutes via Windows Task Scheduler.

Run from the project root:
    .venv\\Scripts\\python.exe -m app.scripts.send_scheduled_reports
"""
from __future__ import annotations

import io
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, time, timedelta
from typing import Any

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from zoneinfo import ZoneInfo

import jdatetime

from app.api.report_schedules import next_run_at
from app.database import get_connection

TEHRAN = ZoneInfo("Asia/Tehran")
HTTP_TIMEOUT = 35


def _env(name: str) -> str:
    return (os.getenv(name) or "").strip()


def _as_date(value: Any) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def _jalali(value: date) -> str:
    try:
        j = jdatetime.date.fromgregorian(date=value)
        return f"{j.year:04d}/{j.month:02d}/{j.day:02d}"
    except Exception:
        return value.isoformat()


def _period(frequency: str, now: datetime) -> tuple[date, date, str]:
    """Return [start, end) for a completed week or month; end is exclusive."""
    today = now.date()
    if frequency == "WEEKLY":
        end_date = today
        start_date = today - timedelta(days=7)
        caption = f"هفته {_jalali(start_date)} تا {_jalali(end_date - timedelta(days=1))}"
    else:
        # The application displays dates in the Solar Hijri calendar, so monthly
        # reports use the previous complete Jalali month as well.
        current_jalali = jdatetime.date.fromgregorian(date=today)
        current_start_jalali = jdatetime.date(current_jalali.year, current_jalali.month, 1)
        end_date = current_start_jalali.togregorian()
        if current_jalali.month == 1:
            previous_jalali = jdatetime.date(current_jalali.year - 1, 12, 1)
        else:
            previous_jalali = jdatetime.date(current_jalali.year, current_jalali.month - 1, 1)
        start_date = previous_jalali.togregorian()
        caption = f"ماه {_jalali(start_date)} تا {_jalali(end_date - timedelta(days=1))}"
    return start_date, end_date, caption


def _make_report(connection, user_id: int, frequency: str, now: datetime) -> tuple[bytes, str, int, int]:
    """Build a professionally formatted Persian RTL Excel report."""
    start_date, end_date, caption = _period(frequency, now)
    cursor = connection.cursor()
    cursor.execute(
        """SELECT e.EXPENSE_DATE,
                  NVL(c.CATEGORY_NAME, 'سایر') AS CATEGORY_NAME,
                  NVL(e.DESCRIPTION, '-') AS DESCRIPTION,
                  NVL(e.AMOUNT, 0) AS AMOUNT,
                  NVL(a.ACCOUNT_NAME, '-') AS ACCOUNT_NAME
             FROM EXP_EXPENSES e
             LEFT JOIN EXP_CATEGORIES c ON c.CATEGORY_ID = e.CATEGORY_ID
             LEFT JOIN EXP_ACCOUNTS a ON a.ACCOUNT_ID = e.ACCOUNT_ID AND a.USER_ID = e.USER_ID
            WHERE e.USER_ID = :user_id
              AND e.EXPENSE_DATE >= :from_date
              AND e.EXPENSE_DATE < :to_date
            ORDER BY e.EXPENSE_DATE, e.EXPENSE_ID""",
        {"user_id": user_id, "from_date": start_date, "to_date": end_date},
    )
    rows = cursor.fetchall()
    normalized_rows = []
    total = 0
    category_totals: dict[str, dict[str, int]] = {}
    for row in rows:
        expense_date = _jalali(_as_date(row[0]))
        category = str(row[1] or "سایر").replace("\n", " ").strip()
        description = str(row[2] or "-").replace("\n", " ").strip()
        amount = int(row[3] or 0)
        account = str(row[4] or "-").replace("\n", " ").strip()
        normalized_rows.append((expense_date, category, description, account, amount))
        total += amount
        bucket = category_totals.setdefault(category, {"amount": 0, "count": 0})
        bucket["amount"] += amount
        bucket["count"] += 1

    wb = Workbook()
    ws = wb.active
    ws.title = "گزارش هزینه‌ها"
    ws.sheet_view.rightToLeft = True
    ws.freeze_panes = "A7"
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.page_margins.left = 0.25
    ws.page_margins.right = 0.25
    ws.page_margins.top = 0.5
    ws.page_margins.bottom = 0.5

    navy = "17324D"
    teal = "20A39E"
    light_blue = "EAF2F8"
    light_gray = "F4F6F8"
    white = "FFFFFF"
    dark = "243746"
    muted = "667784"
    border_color = "D9E2EC"
    thin_border = Border(
        left=Side(style="thin", color=border_color),
        right=Side(style="thin", color=border_color),
        top=Side(style="thin", color=border_color),
        bottom=Side(style="thin", color=border_color),
    )

    ws.merge_cells("A1:F1")
    ws["A1"] = "گزارش مالی شخصی | مدیریت هزینه"
    ws["A1"].fill = PatternFill("solid", fgColor=navy)
    ws["A1"].font = Font(name="Vazirmatn", size=17, bold=True, color=white)
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 36

    ws.merge_cells("A2:F2")
    ws["A2"] = f"دوره گزارش: {caption}"
    ws["A2"].fill = PatternFill("solid", fgColor=light_blue)
    ws["A2"].font = Font(name="Vazirmatn", size=11, bold=True, color=dark)
    ws["A2"].alignment = Alignment(horizontal="right", vertical="center")
    ws.row_dimensions[2].height = 25

    # KPI strip, with clear visual hierarchy.
    kpis = [("A4:B4", "تعداد هزینه‌ها", len(normalized_rows)),
            ("C4:D4", "مجموع هزینه‌ها (تومان)", total),
            ("E4:F4", "میانگین هر هزینه (تومان)", round(total / len(normalized_rows)) if normalized_rows else 0)]
    for merged_range, label, value in kpis:
        ws.merge_cells(merged_range)
        top_left = merged_range.split(":")[0]
        ws[top_left] = label
        ws[top_left].fill = PatternFill("solid", fgColor=teal)
        ws[top_left].font = Font(name="Vazirmatn", size=10, bold=True, color=white)
        ws[top_left].alignment = Alignment(horizontal="center", vertical="center")
        # Value in the next row under the merged KPI label.
        cols = re.match(r"([A-Z]+)4:([A-Z]+)4", merged_range).groups()
        value_range = f"{cols[0]}5:{cols[1]}5"
        ws.merge_cells(value_range)
        value_cell = ws[f"{cols[0]}5"]
        value_cell.value = int(value)
        value_cell.number_format = "#,##0"
        value_cell.fill = PatternFill("solid", fgColor="F0F9F8")
        value_cell.font = Font(name="Vazirmatn", size=13, bold=True, color=navy)
        value_cell.alignment = Alignment(horizontal="center", vertical="center")
        for row_cells in ws[merged_range]:
            for cell in row_cells:
                cell.border = thin_border
        for row_cells in ws[value_range]:
            for cell in row_cells:
                cell.border = thin_border
    ws.row_dimensions[4].height = 24
    ws.row_dimensions[5].height = 30

    headers = ["ردیف", "تاریخ شمسی", "دسته‌بندی", "شرح هزینه", "حساب پرداخت", "مبلغ (تومان)"]
    header_row = 7
    for col, title in enumerate(headers, 1):
        cell = ws.cell(row=header_row, column=col, value=title)
        cell.fill = PatternFill("solid", fgColor=navy)
        cell.font = Font(name="Vazirmatn", size=10, bold=True, color=white)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
    ws.row_dimensions[header_row].height = 27

    if not normalized_rows:
        ws.merge_cells(start_row=8, start_column=1, end_row=8, end_column=6)
        ws.cell(row=8, column=1, value="در این دوره هزینه‌ای ثبت نشده است.")
        ws.cell(row=8, column=1).font = Font(name="Vazirmatn", size=11, color=muted, italic=True)
        ws.cell(row=8, column=1).alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[8].height = 30
    else:
        for index, (expense_date, category, description, account, amount) in enumerate(normalized_rows, 1):
            row_index = header_row + index
            values = [index, expense_date, category, description, account, amount]
            for col, value in enumerate(values, 1):
                cell = ws.cell(row=row_index, column=col, value=value)
                cell.font = Font(name="Vazirmatn", size=10, color=dark)
                cell.fill = PatternFill("solid", fgColor=white if index % 2 else light_gray)
                cell.border = thin_border
                cell.alignment = Alignment(
                    horizontal="right" if col in (3, 4, 5) else "center",
                    vertical="center",
                    wrap_text=col in (3, 4, 5),
                )
                if col == 6:
                    cell.number_format = "#,##0"
                    cell.font = Font(name="Vazirmatn", size=10, bold=True, color=navy)
            ws.row_dimensions[row_index].height = 24
        last_row = header_row + len(normalized_rows)
        ws.auto_filter.ref = f"A{header_row}:F{last_row}"
        total_row = last_row + 1
        ws.merge_cells(start_row=total_row, start_column=1, end_row=total_row, end_column=5)
        ws.cell(row=total_row, column=1, value="مجموع کل")
        ws.cell(row=total_row, column=6, value=total)
        for cell in ws[total_row]:
            cell.fill = PatternFill("solid", fgColor=navy)
            cell.font = Font(name="Vazirmatn", size=11, bold=True, color=white)
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="center", vertical="center")
        ws.cell(row=total_row, column=6).number_format = "#,##0"
        ws.row_dimensions[total_row].height = 28

    widths = [9, 16, 19, 42, 22, 20]
    for index, width in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(index)].width = width
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_title_rows = f"1:{header_row}"

    # Second sheet: ranked category summary for quick scanning.
    summary = wb.create_sheet("خلاصه دسته‌ها")
    summary.sheet_view.rightToLeft = True
    summary.merge_cells("A1:D1")
    summary["A1"] = "خلاصه هزینه بر اساس دسته‌بندی"
    summary["A1"].fill = PatternFill("solid", fgColor=navy)
    summary["A1"].font = Font(name="Vazirmatn", size=15, bold=True, color=white)
    summary["A1"].alignment = Alignment(horizontal="center", vertical="center")
    summary.row_dimensions[1].height = 34
    summary["A2"] = "دوره"
    summary["B2"] = caption
    summary["C2"] = "مجموع کل"
    summary["D2"] = total
    summary["D2"].number_format = "#,##0"
    for cell in summary[2]:
        cell.fill = PatternFill("solid", fgColor=light_blue)
        cell.font = Font(name="Vazirmatn", size=10, bold=True, color=dark)
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border
    summary_headers = ["دسته‌بندی", "تعداد", "مبلغ (تومان)", "سهم از کل"]
    for col, title in enumerate(summary_headers, 1):
        cell = summary.cell(row=4, column=col, value=title)
        cell.fill = PatternFill("solid", fgColor=teal)
        cell.font = Font(name="Vazirmatn", size=10, bold=True, color=white)
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border
    for idx, (category, values) in enumerate(sorted(category_totals.items(), key=lambda item: item[1]["amount"], reverse=True), 5):
        row_values = [category, values["count"], values["amount"], (values["amount"] / total) if total else 0]
        for col, value in enumerate(row_values, 1):
            cell = summary.cell(row=idx, column=col, value=value)
            cell.fill = PatternFill("solid", fgColor=white if idx % 2 else light_gray)
            cell.font = Font(name="Vazirmatn", size=10, color=dark)
            cell.alignment = Alignment(horizontal="right" if col == 1 else "center", vertical="center")
            cell.border = thin_border
            if col == 3:
                cell.number_format = "#,##0"
            elif col == 4:
                cell.number_format = "0.0%"
    for col, width in enumerate([28, 14, 22, 16], 1):
        summary.column_dimensions[get_column_letter(col)].width = width
    summary.freeze_panes = "A5"
    if category_totals:
        summary.auto_filter.ref = f"A4:D{4 + len(category_totals)}"

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue(), caption, len(normalized_rows), total


def _http_json(url: str, payload: dict, headers: dict[str, str] | None = None) -> dict:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request_headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if headers:
        request_headers.update(headers)
    request = urllib.request.Request(url, data=body, headers=request_headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:800]
        raise RuntimeError(f"سرویس ارسال پیام خطا داد (HTTP {exc.code}): {detail}") from None
    except Exception as exc:
        raise RuntimeError(f"ارتباط با سرویس ارسال پیام برقرار نشد: {type(exc).__name__}") from None
    try:
        result = json.loads(raw.decode("utf-8"))
    except Exception:
        raise RuntimeError("پاسخ سرویس ارسال پیام قابل‌خواندن نبود.") from None
    if not isinstance(result, dict):
        raise RuntimeError("ساختار پاسخ سرویس ارسال پیام معتبر نیست.")
    return result


def _send_telegram(destination: str, content: bytes, caption: str, count: int, total: int) -> None:
    token = _env("TELEGRAM_BOT_TOKEN")
    if not token:
        raise RuntimeError("تنظیم TELEGRAM_BOT_TOKEN روی سرور لازم است.")
    boundary = "----ExpenseExcelReportBoundary7MA4YWxkTrZu0gW"
    short_caption = f"📊 گزارش هزینه‌ها\n{caption}\n🧾 تعداد: {count:,}\n💰 مجموع: {total:,} تومان\nفایل Excel با جزئیات و خلاصه دسته‌ها پیوست است."[:1000]
    filename = "expense-report.xlsx"
    content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    chunks = [
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"chat_id\"\r\n\r\n{destination}\r\n".encode("utf-8"),
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"caption\"\r\n\r\n{short_caption}\r\n".encode("utf-8"),
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"document\"; filename=\"{filename}\"\r\nContent-Type: {content_type}\r\n\r\n".encode("utf-8"),
        content,
        f"\r\n--{boundary}--\r\n".encode("utf-8"),
    ]
    request = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendDocument",
        data=b"".join(chunks),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")[:800]
        raise RuntimeError(f"تلگرام درخواست را نپذیرفت (HTTP {exc.code}): {body}") from None
    except Exception as exc:
        raise RuntimeError(f"ارسال فایل Excel به تلگرام ناموفق بود: {type(exc).__name__}") from None
    if not payload.get("ok"):
        raise RuntimeError(f"تلگرام فایل را ارسال نکرد: {str(payload.get('description') or 'خطای نامشخص')[:500]}")


def _send_report(channel: str, destination: str, content: bytes, caption: str, count: int, total: int) -> None:
    if channel != "TELEGRAM":
        raise RuntimeError("از این نسخه فقط ارسال گزارش از طریق تلگرام پشتیبانی می‌شود.")
    _send_telegram(destination, content, caption, count, total)


def _process_due_schedule(schedule_id: int) -> bool:
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """SELECT SCHEDULE_ID, USER_ID, FREQUENCY, CHANNEL, DESTINATION,
                      SEND_DAY, SEND_TIME, NEXT_RUN_AT
                 FROM EXP_REPORT_SCHEDULES
                WHERE SCHEDULE_ID = :schedule_id
                  AND IS_ACTIVE = 1
                  AND NEXT_RUN_AT <= CAST(SYSTIMESTAMP AT TIME ZONE 'Asia/Tehran' AS TIMESTAMP)
                FOR UPDATE SKIP LOCKED""",
            {"schedule_id": schedule_id},
        )
        row = cursor.fetchone()
        if not row:
            connection.rollback()
            return False

        now = datetime.now(TEHRAN)
        now_naive = now.replace(tzinfo=None)
        try:
            content, caption, count, total = _make_report(connection, int(row[1]), str(row[2]), now)
            _send_report(str(row[3]), str(row[4]), content, caption, count, total)
            status_value = "SENT"
            error = None
            print(f"گزارش زمان‌بندی {int(row[0])} ارسال شد.")
        except Exception as exc:
            status_value = "FAILED"
            error = f"{type(exc).__name__}: {exc}"[:1000]
            print(f"گزارش زمان‌بندی {int(row[0])} ارسال نشد: {error}")

        next_at = next_run_at(str(row[2]), int(row[5]), str(row[6]), now)
        cursor.execute(
            """UPDATE EXP_REPORT_SCHEDULES
                  SET LAST_RUN_AT = :last_run_at,
                      LAST_STATUS = :last_status,
                      LAST_ERROR = :last_error,
                      NEXT_RUN_AT = :next_run_at,
                      UPDATED_AT = SYSTIMESTAMP
                WHERE SCHEDULE_ID = :schedule_id""",
            {
                "last_run_at": now_naive,
                "last_status": status_value,
                "last_error": error,
                "next_run_at": next_at,
                "schedule_id": int(row[0]),
            },
        )
        connection.commit()
        return status_value == "SENT"
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def main() -> int:
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """SELECT SCHEDULE_ID
                 FROM EXP_REPORT_SCHEDULES
                WHERE IS_ACTIVE = 1
                  AND NEXT_RUN_AT <= CAST(SYSTIMESTAMP AT TIME ZONE 'Asia/Tehran' AS TIMESTAMP)
                ORDER BY NEXT_RUN_AT"""
        )
        due_ids = [int(row[0]) for row in cursor.fetchall()]
    finally:
        connection.close()

    print(f"زمان‌بندی‌های آماده ارسال: {len(due_ids)}")
    for schedule_id in due_ids:
        try:
            _process_due_schedule(schedule_id)
        except Exception as exc:
            print(f"خطای پردازش زمان‌بندی {schedule_id}: {type(exc).__name__}: {exc}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
