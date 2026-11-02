from datetime import date, datetime, timedelta
from uuid import uuid4

import jdatetime

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.database import get_connection
from app.api.auth import get_session_user_id, require_active_user
from app.services.app_clock import app_today
from app.services.expense_parser import parse_expense_text
from app.services.category_catalog import detect_category_from_catalog
from app.services.expense_validator import validate_expense
from app.services.account_balance import get_account_current_balance


router = APIRouter(
    prefix="/api/expenses",
    tags=["Expenses"],
    dependencies=[Depends(require_active_user)],
)


# ============================================================
# SCHEMAS
# ============================================================

class ExpenseEdit(BaseModel):

    expense_id: int

    amount: int

    description: str

    category_id: int | None = None

    account_id: int | None = None

    expense_date: date


class ExpenseDelete(BaseModel):

    expense_id: int


class ExpenseTextRequest(BaseModel):

    text: str


class ExpenseConfirmRequest(BaseModel):

    confirmation_id: str

    account_id: int | None = None


# ============================================================
# APPLICATION CLOCK
# ============================================================

@router.get("/clock/today")
def get_application_today(request: Request):
    """Return the canonical application date used by the parser and validator."""
    return {
        "status": "success",
        "today": app_today().isoformat(),
        "timezone": "Asia/Tehran",
    }


# ============================================================
# GET EXPENSES
# ============================================================

@router.get("/")
def get_expenses(
    request: Request,
    from_date: date | None = None,
    to_date: date | None = None
):
    user_id = get_session_user_id(request)

    connection = get_connection()

    try:

        cursor = connection.cursor()

        sql = """
            SELECT
                e.EXPENSE_ID,
                e.AMOUNT,
                e.DESCRIPTION,
                e.EXPENSE_DATE,
                e.CATEGORY_ID,
                c.CATEGORY_NAME,
                c.ICON,
                e.ACCOUNT_ID,
                e.PAYMENT_METHOD,
                e.NOTE,
                e.SOURCE_TYPE,
                e.CREATED_AT
            FROM EXP_EXPENSES e
            LEFT JOIN EXP_CATEGORIES c
                ON c.CATEGORY_ID = e.CATEGORY_ID
            WHERE e.USER_ID = :user_id
        """

        params = {
            "user_id": user_id
        }

        if from_date is not None:

            sql += """
                AND e.EXPENSE_DATE >= :from_date
            """

            params["from_date"] = from_date

        if to_date is not None:

            sql += """
                AND e.EXPENSE_DATE < :to_date + 1
            """

            params["to_date"] = to_date

        sql += """
            ORDER BY
                e.EXPENSE_DATE DESC,
                e.EXPENSE_ID DESC
        """

        cursor.execute(
            sql,
            params
        )

        rows = cursor.fetchall()

        expenses = []

        for row in rows:

            expense = {

                "expense_id": row[0],

                "amount": int(
                    row[1] or 0
                ),

                "description": row[2],

                "expense_date":
                    row[3].strftime(
                        "%Y-%m-%d"
                    ),

                "category_id": row[4],

                "category_name": row[5],

                "icon": row[6],

                "account_id": row[7],

                "payment_method": row[8],

                "note": row[9],

                "source_type": row[10],

                "created_at":
                    str(row[11])
                    if row[11]
                    else None
            }

            expenses.append(
                expense
            )

        return {

            "status": "success",

            "expenses": expenses,

            "count": len(expenses)
        }

    except Exception as e:

        return {

            "status": "error",

            "message":
                f"خطا در دریافت هزینه‌ها: {str(e)}",

            "expenses": []
        }

    finally:

        connection.close()


# ============================================================
# SUMMARY - TODAY
# ============================================================

@router.get("/summary/today")
def get_today_summary(request: Request):
    user_id = get_session_user_id(request)

    connection = get_connection()

    try:

        cursor = connection.cursor()

        today = app_today()
        tomorrow = today + timedelta(days=1)

        cursor.execute(
            """
            SELECT
                NVL(SUM(AMOUNT), 0),
                COUNT(*)
            FROM EXP_EXPENSES
            WHERE USER_ID = :user_id
              AND EXPENSE_DATE >= :today
              AND EXPENSE_DATE < :tomorrow
            """,
            {
                "user_id": user_id,
                "today": today,
                "tomorrow": tomorrow,
            }
        )

        row = cursor.fetchone()

        total_amount = int(
            row[0] or 0
        )

        expense_count = int(
            row[1] or 0
        )

        return {

            "status": "success",

            "total_amount":
                total_amount,

            "expense_count":
                expense_count
        }

    except Exception as e:

        return {

            "status": "error",

            "message":
                f"خطا در دریافت هزینه امروز: {str(e)}",

            "total_amount": 0,

            "expense_count": 0
        }

    finally:

        connection.close()


# ============================================================
# SUMMARY - CURRENT MONTH
# ============================================================

@router.get("/summary/month")
def get_month_summary(request: Request):
    """Return current and previous calendar-month summaries using the app's Tehran date."""
    user_id = get_session_user_id(request)
    today = app_today()
    jalali_today = jdatetime.date.fromgregorian(date=today)
    jalali_month_start = jdatetime.date(jalali_today.year, jalali_today.month, 1)
    month_start = jalali_month_start.togregorian()
    if jalali_today.month == 12:
        jalali_next_month_start = jdatetime.date(jalali_today.year + 1, 1, 1)
    else:
        jalali_next_month_start = jdatetime.date(jalali_today.year, jalali_today.month + 1, 1)
    next_month_start = jalali_next_month_start.togregorian()
    if jalali_today.month == 1:
        jalali_previous_month_start = jdatetime.date(jalali_today.year - 1, 12, 1)
    else:
        jalali_previous_month_start = jdatetime.date(jalali_today.year, jalali_today.month - 1, 1)
    previous_month_start = jalali_previous_month_start.togregorian()

    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """SELECT NVL(SUM(AMOUNT), 0), COUNT(*)
                 FROM EXP_EXPENSES
                WHERE USER_ID = :user_id
                  AND EXPENSE_DATE >= :month_start
                  AND EXPENSE_DATE < :next_month_start""",
            {"user_id": user_id, "month_start": month_start, "next_month_start": next_month_start},
        )
        current_row = cursor.fetchone() or (0, 0)
        current_total = int(current_row[0] or 0)
        current_count = int(current_row[1] or 0)

        cursor.execute(
            """SELECT NVL(SUM(AMOUNT), 0), COUNT(*)
                 FROM EXP_EXPENSES
                WHERE USER_ID = :user_id
                  AND EXPENSE_DATE >= :previous_month_start
                  AND EXPENSE_DATE < :month_start""",
            {"user_id": user_id, "previous_month_start": previous_month_start, "month_start": month_start},
        )
        previous_row = cursor.fetchone() or (0, 0)
        previous_total = int(previous_row[0] or 0)
        previous_count = int(previous_row[1] or 0)

        days_passed = max(1, jalali_today.day)
        average_daily = round(current_total / days_passed)
        difference_amount = current_total - previous_total
        percentage = round((difference_amount / previous_total) * 100, 1) if previous_total else (100.0 if current_total else 0.0)

        return {
            "status": "success",
            "current_month": {
                "total_amount": current_total,
                "expense_count": current_count,
                "days_passed": days_passed,
                "average_daily": average_daily,
                "from_date": month_start.isoformat(),
                "to_date_exclusive": next_month_start.isoformat(),
            },
            "previous_month": {
                "total_amount": previous_total,
                "expense_count": previous_count,
                "from_date": previous_month_start.isoformat(),
                "to_date_exclusive": month_start.isoformat(),
            },
            "comparison": {"difference_amount": difference_amount, "percentage": percentage},
        }
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Could not load monthly expense summary")
        return {"status": "error", "message": "خطا در دریافت خلاصه ماه. لاگ سرور را بررسی کنید."}
    finally:
        connection.close()


@router.get("/summary/categories")
def get_category_summary(request: Request):
    user_id = get_session_user_id(request)

    connection = get_connection()

    try:

        cursor = connection.cursor()

        today = app_today()
        jalali_today = jdatetime.date.fromgregorian(date=today)
        month_start = jdatetime.date(jalali_today.year, jalali_today.month, 1).togregorian()
        if jalali_today.month == 12:
            next_month_start = jdatetime.date(jalali_today.year + 1, 1, 1).togregorian()
        else:
            next_month_start = jdatetime.date(jalali_today.year, jalali_today.month + 1, 1).togregorian()
        cursor.execute(
            """SELECT c.CATEGORY_ID, c.CATEGORY_NAME, c.ICON,
                      NVL(SUM(e.AMOUNT), 0) AS TOTAL_AMOUNT,
                      COUNT(e.EXPENSE_ID) AS EXPENSE_COUNT
                 FROM EXP_CATEGORIES c
                 LEFT JOIN EXP_EXPENSES e
                   ON e.CATEGORY_ID = c.CATEGORY_ID
                  AND e.USER_ID = :user_id
                  AND e.EXPENSE_DATE >= :month_start
                  AND e.EXPENSE_DATE < :next_month_start
                WHERE c.IS_ACTIVE = 1
                GROUP BY c.CATEGORY_ID, c.CATEGORY_NAME, c.ICON
                ORDER BY TOTAL_AMOUNT DESC""",
            {"user_id": user_id, "month_start": month_start, "next_month_start": next_month_start}
        )

        rows = cursor.fetchall()

        categories = []

        total_amount = 0

        for row in rows:

            category = {

                "category_id":
                    row[0],

                "category_name":
                    row[1],

                "icon":
                    row[2],

                "total_amount":
                    int(row[3] or 0),

                "expense_count":
                    int(row[4] or 0)
            }

            categories.append(
                category
            )

            total_amount += (
                category["total_amount"]
            )

        for category in categories:

            if total_amount > 0:

                category["percentage"] = round(
                    category["total_amount"]
                    * 100
                    / total_amount,
                    1
                )

            else:

                category["percentage"] = 0

        return {

            "status": "success",

            "total_amount":
                total_amount,

            "categories":
                categories
        }

    except Exception as e:

        return {

            "status": "error",

            "message":
                f"خطا در دریافت آمار دسته‌بندی‌ها: {str(e)}",

            "categories": []
        }

    finally:

        connection.close()


# ============================================================
# TEXT INPUT
# ============================================================

@router.post("/text")
def create_expense_from_text(
    request: Request,
    data: ExpenseTextRequest
):
    user_id = get_session_user_id(request)

    if not data.text or not data.text.strip():

        return {

            "status": "error",

            "message":
                "متن هزینه وارد نشده است."
        }

    try:

        # ----------------------------------------------------
        # PARSE
        # ----------------------------------------------------

        parsed = parse_expense_text(
            data.text
        )

        # دسته‌بندی دیتابیس‌محور، در صورت وجود تطبیق دقیق‌تر بر فهرست
        # ثابت قدیمی پارسر اولویت دارد؛ در صورت نبود جداول/تطبیق، روال قبلی حفظ می‌شود.
        catalog_category = detect_category_from_catalog(
            f"{parsed.get('description', '')} {data.text}"
        )
        if catalog_category:
            parsed["category"] = catalog_category

        print(
            "PARSED EXPENSE:",
            parsed
        )

        # ----------------------------------------------------
        # VALIDATE
        # ----------------------------------------------------

        validation = validate_expense(
            parsed
        )

        if not validation["is_valid"]:

            return {

                "status": "error",

                "message":
                    "اطلاعات هزینه معتبر نیست.",

                "errors":
                    validation["errors"],

                "parsed":
                    parsed
            }

        # ----------------------------------------------------
        # SECURITY CHECK
        # حتی اگر Parser اشتباه کند،
        # تاریخ آینده اجازه ادامه ندارد.
        # ----------------------------------------------------

        parsed_date = date.fromisoformat(
            parsed["expense_date"]
        )

        if parsed_date > app_today():

            return {

                "status": "error",

                "message":
                    "تاریخ هزینه نمی‌تواند در آینده باشد.",

                "errors": [
                    "تاریخ هزینه نمی‌تواند در آینده باشد."
                ],

                "parsed":
                    parsed
            }

        # ----------------------------------------------------
        # CATEGORY ID
        # ----------------------------------------------------

        connection = get_connection()

        try:

            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT
                    CATEGORY_ID
                FROM EXP_CATEGORIES
                WHERE CATEGORY_NAME =
                    :category_name
                  AND IS_ACTIVE = 1
                """,
                {
                    "category_name":
                        parsed["category"]
                }
            )

            category_row = cursor.fetchone()

            if not category_row:

                return {

                    "status": "error",

                    "message":
                        "دسته‌بندی معتبر پیدا نشد."
                }

            category_id = category_row[0]

            # ------------------------------------------------
            # CREATE CONFIRMATION
            # ------------------------------------------------

            confirmation_id = str(
                uuid4()
            )

            now = datetime.now()

            expires_at = (
                now
                + timedelta(minutes=10)
            )

            cursor.execute(
                """
                INSERT INTO
                    EXP_PENDING_CONFIRMATIONS
                (
                    CONFIRMATION_ID,
                    USER_ID,
                    AMOUNT,
                    DESCRIPTION,
                    CATEGORY_NAME,
                    EXPENSE_DATE,
                    ORIGINAL_TEXT,
                    CREATED_AT,
                    EXPIRES_AT
                )
                VALUES
                (
                    :confirmation_id,
                    :user_id,
                    :amount,
                    :description,
                    :category_name,
                    :expense_date,
                    :original_text,
                    SYSTIMESTAMP,
                    :expires_at
                )
                """,
                {

                    "confirmation_id":
                        confirmation_id,

                    "user_id":
                        user_id,

                    "amount":
                        parsed["amount"],

                    "description":
                        parsed["description"],

                    "category_name":
                        parsed["category"],

                    "expense_date":
                        parsed_date,

                    "original_text":
                        data.text,

                    "expires_at":
                        expires_at
                }
            )

            connection.commit()

            return {

                "status":
                    "confirmation_required",

                "confirmation_id":
                    confirmation_id,

                "expense": {

                    "amount":
                        parsed["amount"],

                    "description":
                        parsed["description"],

                    "category":
                        parsed["category"],

                    "category_id":
                        category_id,

                    "expense_date":
                        parsed["expense_date"]
                },

                "original_text":
                    data.text
            }

        finally:

            connection.close()

    except Exception as e:

        return {

            "status": "error",

            "message":
                f"خطا در پردازش هزینه: {str(e)}"
        }


# ============================================================
# CONFIRM
# ============================================================

@router.post("/confirm")
def confirm_expense(
    request: Request,
    data: ExpenseConfirmRequest
):
    user_id = get_session_user_id(request)

    connection = get_connection()

    try:

        cursor = connection.cursor()

        # ----------------------------------------------------
        # GET PENDING
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                CONFIRMATION_ID,
                USER_ID,
                AMOUNT,
                DESCRIPTION,
                CATEGORY_NAME,
                EXPENSE_DATE,
                ORIGINAL_TEXT
            FROM EXP_PENDING_CONFIRMATIONS
            WHERE CONFIRMATION_ID =
                :confirmation_id
              AND USER_ID = :user_id
            FOR UPDATE
            """,
            {

                "confirmation_id":
                    data.confirmation_id,

                "user_id":
                    user_id
            }
        )

        row = cursor.fetchone()

        if not row:

            return {

                "status": "error",

                "message":
                    "اطلاعات تأیید هزینه پیدا نشد."
            }
        if data.account_id is None:
            return {
                "status": "error",
                "message": "لطفاً حساب پرداخت‌کننده را انتخاب کنید."
            }

        # Lock the account row so two concurrent expense confirmations cannot
        # spend the same remaining balance.
        cursor.execute(
            """
            SELECT ACCOUNT_ID, ACCOUNT_NAME
            FROM EXP_ACCOUNTS
            WHERE ACCOUNT_ID = :account_id
              AND USER_ID = :user_id
              AND IS_ACTIVE = 1
            FOR UPDATE
            """,
            {"account_id": data.account_id, "user_id": user_id}
        )
        account_row = cursor.fetchone()
        if not account_row:
            connection.rollback()
            return {
                "status": "error",
                "message": "حساب انتخاب‌شده معتبر یا فعال نیست. لطفاً حساب دیگری انتخاب کنید."
            }

        amount = int(row[2] or 0)
        current_balance = get_account_current_balance(cursor, data.account_id, user_id)
        if amount > current_balance:
            connection.rollback()
            return {
                "status": "error",
                "message": (
                    f"موجودی حساب «{account_row[1]}» کافی نیست. "
                    f"موجودی فعلی: {current_balance:,} تومان؛ "
                    f"مبلغ هزینه: {amount:,} تومان. ابتدا افزایش موجودی ثبت کنید یا حساب دیگری انتخاب کنید."
                ),
                "current_balance": current_balance,
                "required_amount": amount,
                "account_id": data.account_id,
            }

        description = row[3]

        category_name = row[4]

        expense_date = row[5]

        if isinstance(expense_date, datetime):
            expense_date = expense_date.date()

        original_text = row[6]

        # ----------------------------------------------------
        # SECURITY CHECK
        # ----------------------------------------------------

        if expense_date > app_today():
            cursor.execute(
                """
                DELETE FROM
                    EXP_PENDING_CONFIRMATIONS
                WHERE CONFIRMATION_ID =
                    :confirmation_id
                """,
                {
                    "confirmation_id":
                        data.confirmation_id
                }
            )

            connection.commit()

            return {
                "status": "error",
                "message": "تاریخ هزینه نمی‌تواند در آینده باشد."
            }

        # ----------------------------------------------------
        # CATEGORY
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                CATEGORY_ID
            FROM EXP_CATEGORIES
            WHERE CATEGORY_NAME =
                :category_name
              AND IS_ACTIVE = 1
            """,
            {
                "category_name":
                    category_name
            }
        )

        category_row = cursor.fetchone()

        if not category_row:

            return {

                "status": "error",

                "message":
                    "دسته‌بندی معتبر پیدا نشد."
            }

        category_id = category_row[0]

        # ----------------------------------------------------
        # INSERT EXPENSE
        # ----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO EXP_EXPENSES
            (
                USER_ID,
                CATEGORY_ID,
                ACCOUNT_ID,
                AMOUNT,
                DESCRIPTION,
                EXPENSE_DATE,
                SOURCE_TYPE,
                AI_RAW_TEXT,
                CREATED_AT
            )
            VALUES
            (
                :user_id,
                :category_id,
                :account_id,
                :amount,
                :description,
                :expense_date,
                'TEXT',
                :original_text,
                SYSTIMESTAMP
            )
            RETURNING EXPENSE_ID
            INTO :expense_id
            """,
            {

                "user_id":
                    user_id,

                "category_id":
                    category_id,

                "account_id":
                    data.account_id,

                "amount":
                    amount,

                "description":
                    description,

                "expense_date":
                    expense_date,

                "original_text":
                    original_text,

                "expense_id":
                    cursor.var(int)
            }
        )

        expense_id = cursor.bindvars[
            "expense_id"
        ].getvalue()[0]

        # ----------------------------------------------------
        # DELETE PENDING
        # ----------------------------------------------------

        cursor.execute(
            """
            DELETE FROM
                EXP_PENDING_CONFIRMATIONS
            WHERE CONFIRMATION_ID =
                :confirmation_id
            """,
            {
                "confirmation_id":
                    data.confirmation_id
            }
        )

        connection.commit()

        return {

            "status": "success",

            "message":
                "هزینه با موفقیت ثبت شد.",

            "expense_id":
                int(expense_id)
        }

    except Exception as e:

        connection.rollback()

        return {

            "status": "error",

            "message":
                f"خطا در ثبت هزینه: {str(e)}"
        }

    finally:

        connection.close()


# ============================================================
# CANCEL
# ============================================================

@router.post("/cancel")
def cancel_expense(
    request: Request,
    data: ExpenseConfirmRequest
):
    user_id = get_session_user_id(request)

    connection = get_connection()

    try:

        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE FROM
                EXP_PENDING_CONFIRMATIONS
            WHERE CONFIRMATION_ID =
                :confirmation_id
              AND USER_ID = :user_id
            """,
            {

                "confirmation_id":
                    data.confirmation_id,

                "user_id":
                    user_id
            }
        )

        deleted_rows = cursor.rowcount

        connection.commit()

        if deleted_rows == 0:

            return {

                "status": "error",

                "message":
                    "اطلاعات تأیید پیدا نشد."
            }

        return {

            "status": "success",

            "message":
                "ثبت هزینه لغو شد."
        }

    except Exception as e:

        connection.rollback()

        return {

            "status": "error",

            "message":
                f"خطا در لغو هزینه: {str(e)}"
        }

    finally:

        connection.close()


# ============================================================
# EDIT
# ============================================================

@router.put("/edit")
def edit_expense(
    request: Request,
    data: ExpenseEdit
):
    user_id = get_session_user_id(request)

    connection = get_connection()

    try:

        cursor = connection.cursor()

        # ----------------------------------------------------
        # CHECK EXPENSE
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT EXPENSE_ID, ACCOUNT_ID, AMOUNT
            FROM EXP_EXPENSES
            WHERE EXPENSE_ID = :expense_id
              AND USER_ID = :user_id
            FOR UPDATE
            """,
            {"expense_id": data.expense_id, "user_id": user_id}
        )

        expense = cursor.fetchone()

        if not expense:
            return {
                "status": "error",
                "message": "هزینه موردنظر پیدا نشد."
            }

        old_account_id = int(expense[1]) if expense[1] is not None else None
        old_amount = int(expense[2] or 0)
        target_account_id = data.account_id if data.account_id is not None else old_account_id

        # ----------------------------------------------------
        # AMOUNT
        # ----------------------------------------------------

        if data.amount <= 0:

            return {

                "status": "error",

                "message":
                    "مبلغ باید بیشتر از صفر باشد."
            }

        # ----------------------------------------------------
        # FUTURE DATE
        # ----------------------------------------------------

        if data.expense_date > app_today():

            return {

                "status": "error",

                "message":
                    "تاریخ هزینه نمی‌تواند در آینده باشد."
            }

        # ----------------------------------------------------
        # DESCRIPTION
        # ----------------------------------------------------

        if (
            not data.description
            or not data.description.strip()
        ):

            return {

                "status": "error",

                "message":
                    "توضیحات هزینه نمی‌تواند خالی باشد."
            }

        # ----------------------------------------------------
        # CATEGORY
        # ----------------------------------------------------

        if data.category_id is not None:

            cursor.execute(
                """
                SELECT
                    CATEGORY_ID
                FROM EXP_CATEGORIES
                WHERE CATEGORY_ID =
                    :category_id
                  AND IS_ACTIVE = 1
                """,
                {
                    "category_id":
                        data.category_id
                }
            )

            category = cursor.fetchone()

            if not category:

                return {

                    "status": "error",

                    "message":
                        "دسته‌بندی معتبر نیست."
                }

        # ----------------------------------------------------
        # ACCOUNT AND OVERDRAFT VALIDATION
        # ----------------------------------------------------

        if target_account_id is not None:
            # Lock the destination account. If the user explicitly selected an
            # account, it must be active; legacy expenses can still be edited
            # without changing an already-assigned inactive account.
            account_sql = "SELECT ACCOUNT_ID FROM EXP_ACCOUNTS WHERE ACCOUNT_ID = :account_id AND USER_ID = :user_id"
            account_params = {"account_id": target_account_id, "user_id": user_id}
            if data.account_id is not None:
                account_sql += " AND IS_ACTIVE = 1"
            account_sql += " FOR UPDATE"
            cursor.execute(account_sql, account_params)
            if not cursor.fetchone():
                connection.rollback()
                return {
                    "status": "error",
                    "message": "حساب انتخاب‌شده معتبر یا فعال نیست."
                }

            # Only validate when the account or amount changes. Description,
            # category and date corrections must remain possible even if an
            # older account is already overdrawn.
            balance_impact_changed = (
                target_account_id != old_account_id or data.amount != old_amount
            )
            if balance_impact_changed:
                available_before_this_expense = get_account_current_balance(
                    cursor,
                    target_account_id,
                    user_id,
                    exclude_expense_id=(data.expense_id if target_account_id == old_account_id else None),
                )
                if data.amount > available_before_this_expense:
                    connection.rollback()
                    return {
                        "status": "error",
                        "message": (
                            f"موجودی حساب برای این تغییر کافی نیست. "
                            f"موجودی قابل استفاده: {available_before_this_expense:,} تومان. "
                            "ابتدا افزایش موجودی ثبت کنید یا حساب دیگری انتخاب کنید."
                        ),
                        "current_balance_before_expense": available_before_this_expense,
                        "required_amount": data.amount,
                        "account_id": target_account_id,
                    }

        # ----------------------------------------------------
        # UPDATE
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE EXP_EXPENSES
            SET
                AMOUNT =
                    :amount,

                DESCRIPTION =
                    :description,

                CATEGORY_ID =
                    :category_id,

                ACCOUNT_ID =
                    COALESCE(:account_id, ACCOUNT_ID),

                EXPENSE_DATE =
                    :expense_date,

                UPDATED_AT =
                    SYSTIMESTAMP

            WHERE EXPENSE_ID =
                :expense_id

              AND USER_ID =
                :user_id
            """,
            {

                "amount":
                    data.amount,

                "description":
                    data.description.strip(),

                "category_id":
                    data.category_id,

                "account_id":
                    data.account_id,

                "expense_date":
                    data.expense_date,

                "expense_id":
                    data.expense_id,

                "user_id":
                    user_id
            }
        )

        connection.commit()

        return {

            "status": "success",

            "message":
                "هزینه با موفقیت ویرایش شد.",

            "expense_id":
                data.expense_id
        }

    except Exception as e:

        connection.rollback()

        return {

            "status": "error",

            "message":
                f"خطا در ویرایش هزینه: {str(e)}"
        }

    finally:

        connection.close()


# ============================================================
# DELETE
# ============================================================

@router.delete("/delete")
def delete_expense(
    request: Request,
    data: ExpenseDelete
):
    user_id = get_session_user_id(request)

    connection = get_connection()

    try:

        cursor = connection.cursor()

        # ----------------------------------------------------
        # CHECK
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                EXPENSE_ID
            FROM EXP_EXPENSES
            WHERE EXPENSE_ID =
                :expense_id
              AND USER_ID =
                :user_id
            """,
            {

                "expense_id":
                    data.expense_id,

                "user_id":
                    user_id
            }
        )

        expense = cursor.fetchone()

        if not expense:

            return {

                "status": "error",

                "message":
                    "هزینه موردنظر پیدا نشد."
            }

        # ----------------------------------------------------
        # DELETE
        # ----------------------------------------------------

        cursor.execute(
            """
            DELETE FROM EXP_EXPENSES
            WHERE EXPENSE_ID =
                :expense_id

              AND USER_ID =
                :user_id
            """,
            {

                "expense_id":
                    data.expense_id,

                "user_id":
                    user_id
            }
        )

        connection.commit()

        return {

            "status": "success",

            "message":
                "هزینه با موفقیت حذف شد.",

            "expense_id":
                data.expense_id
        }

    except Exception as e:

        connection.rollback()

        return {

            "status": "error",

            "message":
                f"خطا در حذف هزینه: {str(e)}"
        }

    finally:

        connection.close()

# ============================================================
# SMART SPENDING INSIGHTS
# ============================================================

JALALI_MONTH_NAMES = [
    "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
    "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
]


def _jalali_month_days(year: int, month: int) -> int:
    if 1 <= month <= 6:
        return 31
    if 7 <= month <= 11:
        return 30
    try:
        jdatetime.date(year, 12, 30)
        return 30
    except ValueError:
        return 29


def _spending_increase(current: int, previous: int, minimum_difference: int = 100_000,
                       minimum_percent: float = 20.0, first_time_threshold: int = 300_000) -> tuple[bool, float | None]:
    """Return whether an increase is noteworthy and its percentage (if calculable)."""
    current = int(current or 0)
    previous = int(previous or 0)
    if current <= previous:
        return False, None
    difference = current - previous
    if previous <= 0:
        return current >= first_time_threshold, None
    percentage = round((difference / previous) * 100, 1)
    return difference >= minimum_difference and percentage >= minimum_percent, percentage


@router.get("/insights")
def get_spending_insights(request: Request):
    user_id = get_session_user_id(request)
    """Compare spending from the start of this Jalali month to today with the same days last month.

    Insights are evaluated from day 10 of the Jalali month to avoid noisy early-month comparisons.
    The endpoint only analyzes expenses; internal transfers are not treated as income or expense.
    """
    today_j = jdatetime.date.fromgregorian(date=app_today())
    period_key = f"{today_j.year:04d}-{today_j.month:02d}"

    if today_j.day < 10:
        return {
            "status": "success",
            "active": False,
            "period_key": period_key,
            "current_day": today_j.day,
            "current_month_name": JALALI_MONTH_NAMES[today_j.month - 1],
            "insights": [],
        }

    current_start_j = jdatetime.date(today_j.year, today_j.month, 1)
    current_start = current_start_j.togregorian()
    current_end = today_j.togregorian() + timedelta(days=1)

    if today_j.month == 1:
        previous_year, previous_month = today_j.year - 1, 12
    else:
        previous_year, previous_month = today_j.year, today_j.month - 1

    previous_compare_day = min(
        today_j.day,
        _jalali_month_days(previous_year, previous_month),
    )
    previous_start_j = jdatetime.date(previous_year, previous_month, 1)
    previous_last_day_j = jdatetime.date(previous_year, previous_month, previous_compare_day)
    previous_start = previous_start_j.togregorian()
    previous_end = previous_last_day_j.togregorian() + timedelta(days=1)

    params = {
        "user_id": user_id,
        "current_start": current_start,
        "current_end": current_end,
        "previous_start": previous_start,
        "previous_end": previous_end,
    }

    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                NVL(c.CATEGORY_NAME, 'سایر') AS CATEGORY_NAME,
                NVL(SUM(CASE
                    WHEN e.EXPENSE_DATE >= :current_start
                     AND e.EXPENSE_DATE < :current_end
                    THEN NVL(e.AMOUNT, 0) ELSE 0 END), 0) AS CURRENT_TOTAL,
                NVL(SUM(CASE
                    WHEN e.EXPENSE_DATE >= :previous_start
                     AND e.EXPENSE_DATE < :previous_end
                    THEN NVL(e.AMOUNT, 0) ELSE 0 END), 0) AS PREVIOUS_TOTAL,
                NVL(SUM(CASE
                    WHEN e.EXPENSE_DATE >= :current_start
                     AND e.EXPENSE_DATE < :current_end
                    THEN 1 ELSE 0 END), 0) AS CURRENT_COUNT,
                NVL(SUM(CASE
                    WHEN e.EXPENSE_DATE >= :previous_start
                     AND e.EXPENSE_DATE < :previous_end
                    THEN 1 ELSE 0 END), 0) AS PREVIOUS_COUNT
            FROM EXP_EXPENSES e
            LEFT JOIN EXP_CATEGORIES c
                ON c.CATEGORY_ID = e.CATEGORY_ID
            WHERE e.USER_ID = :user_id
              AND (
                    (e.EXPENSE_DATE >= :current_start AND e.EXPENSE_DATE < :current_end)
                 OR (e.EXPENSE_DATE >= :previous_start AND e.EXPENSE_DATE < :previous_end)
              )
            GROUP BY NVL(c.CATEGORY_NAME, 'سایر')
            """,
            params,
        )
        category_rows = cursor.fetchall()

        # Specific lunch insight: only uses expenses whose descriptions explicitly mention lunch.
        cursor.execute(
            """
            SELECT
                NVL(SUM(CASE
                    WHEN EXPENSE_DATE >= :current_start AND EXPENSE_DATE < :current_end
                    THEN NVL(AMOUNT, 0) ELSE 0 END), 0) AS CURRENT_TOTAL,
                NVL(SUM(CASE
                    WHEN EXPENSE_DATE >= :previous_start AND EXPENSE_DATE < :previous_end
                    THEN NVL(AMOUNT, 0) ELSE 0 END), 0) AS PREVIOUS_TOTAL,
                NVL(SUM(CASE
                    WHEN EXPENSE_DATE >= :current_start AND EXPENSE_DATE < :current_end
                    THEN 1 ELSE 0 END), 0) AS CURRENT_COUNT,
                NVL(SUM(CASE
                    WHEN EXPENSE_DATE >= :previous_start AND EXPENSE_DATE < :previous_end
                    THEN 1 ELSE 0 END), 0) AS PREVIOUS_COUNT
            FROM EXP_EXPENSES
            WHERE USER_ID = :user_id
              AND (
                    INSTR(DESCRIPTION, 'ناهار') > 0
                 OR INSTR(DESCRIPTION, 'نهار') > 0
                 OR INSTR(DESCRIPTION, 'غذای ظهر') > 0
              )
              AND (
                    (EXPENSE_DATE >= :current_start AND EXPENSE_DATE < :current_end)
                 OR (EXPENSE_DATE >= :previous_start AND EXPENSE_DATE < :previous_end)
              )
            """,
            params,
        )
        lunch_row = cursor.fetchone() or (0, 0, 0, 0)

        insights = []
        lunch_added = False
        lunch_current = int(lunch_row[0] or 0)
        lunch_previous = int(lunch_row[1] or 0)
        lunch_current_count = int(lunch_row[2] or 0)
        lunch_previous_count = int(lunch_row[3] or 0)

        lunch_is_noteworthy, lunch_percent = _spending_increase(
            lunch_current,
            lunch_previous,
            minimum_difference=50_000,
            minimum_percent=20.0,
            first_time_threshold=300_000,
        )
        if lunch_is_noteworthy:
            lunch_difference = lunch_current - lunch_previous
            if lunch_previous <= 0:
                lunch_message = (
                    f"تا امروز {lunch_current:,} تومان برای هزینه‌هایی که با عنوان ناهار ثبت کرده‌ای، "
                    "هزینه ثبت شده؛ در همین بازه ماه قبل موردی ثبت نشده بود. شاید بد نباشد این بخش را زیر نظر بگیری."
                )
            else:
                lunch_message = (
                    f"هزینه‌های ثبت‌شده با عنوان ناهار تا امروز {lunch_current:,} تومان شده؛ "
                    f"یعنی {lunch_percent:g}٪ بیشتر از همین بازه ماه قبل ({lunch_previous:,} تومان). "
                    "شاید بتوانی کمی در هزینه ناهار صرفه‌جویی کنی."
                )
            insights.append({
                "kind": "lunch",
                "title": "هزینه ناهار بیشتر شده",
                "message": lunch_message,
                "current_total": lunch_current,
                "previous_total": lunch_previous,
                "increase_amount": lunch_difference,
                "increase_percent": lunch_percent,
                "current_count": lunch_current_count,
                "previous_count": lunch_previous_count,
            })
            lunch_added = True

        category_insights = []
        for row in category_rows:
            category_name = str(row[0] or "سایر")
            current_total = int(row[1] or 0)
            previous_total = int(row[2] or 0)
            current_count = int(row[3] or 0)
            previous_count = int(row[4] or 0)

            if current_total <= 0:
                continue

            # Signal 1: materially higher amount than the same elapsed period last month.
            amount_is_noteworthy, percent = _spending_increase(
                current_total,
                previous_total,
                minimum_difference=100_000,
                minimum_percent=20.0,
                first_time_threshold=400_000,
            )

            # Signal 2: unusually frequent transactions in the same category.
            # Require a usable comparison baseline and a meaningful current total to reduce noise.
            count_difference = current_count - previous_count
            frequency_is_noteworthy = (
                previous_count >= 2
                and count_difference >= 3
                and current_count >= previous_count * 1.5
                and current_total >= 200_000
            )

            if not amount_is_noteworthy and not frequency_is_noteworthy:
                continue

            difference = current_total - previous_total
            if amount_is_noteworthy:
                if previous_total <= 0:
                    message = (
                        f"از ابتدای ماه تا امروز {current_total:,} تومان در دسته «{category_name}» هزینه کرده‌ای؛ "
                        "در همین بازه ماه قبل هزینه‌ای در این دسته ثبت نشده بود. شاید بهتر باشد این مخارج را بررسی کنی."
                    )
                    change_label = "هزینه قابل توجه جدید"
                else:
                    message = (
                        f"هزینه‌های دسته «{category_name}» تا امروز {current_total:,} تومان شده؛ "
                        f"یعنی {percent:g}٪ بیشتر از همین بازه ماه قبل ({previous_total:,} تومان). "
                        "اگر ممکن است، این بخش از هزینه‌ها را کمی کنترل کن."
                    )
                    change_label = f"{percent:g}٪ افزایش مبلغ"

                if frequency_is_noteworthy:
                    message += (
                        f" همچنین تعداد ثبت‌ها از {previous_count} مورد به {current_count} مورد رسیده است."
                    )
                title = f"افزایش هزینه در دسته {category_name}"
            else:
                message = (
                    f"تا امروز {current_count} هزینه در دسته «{category_name}» ثبت کرده‌ای، "
                    f"درحالی‌که در همین بازه ماه قبل {previous_count} مورد ثبت شده بود. "
                    f"مجموع مبلغ این ماه {current_total:,} تومان است. شاید بد نباشد دفعات خرید این دسته را بررسی کنی."
                )
                title = f"تکرار بیشتر هزینه در دسته {category_name}"
                change_label = f"{count_difference} مورد بیشتر"

            category_insights.append({
                "kind": "category",
                "title": title,
                "category_name": category_name,
                "message": message,
                "current_total": current_total,
                "previous_total": previous_total,
                "increase_amount": difference,
                "increase_percent": percent if amount_is_noteworthy else None,
                "current_count": current_count,
                "previous_count": previous_count,
                "frequency_increase": frequency_is_noteworthy,
                "change_label": change_label,
                "priority_score": max(difference, 0) + (count_difference * 50_000 if frequency_is_noteworthy else 0),
            })

        # Show every category that crosses the thresholds, not only the top three.
        category_insights.sort(
            key=lambda item: int(item.get("priority_score") or 0),
            reverse=True,
        )
        insights.extend(category_insights)

        return {
            "status": "success",
            "active": True,
            "period_key": period_key,
            "current_day": today_j.day,
            "current_month_name": JALALI_MONTH_NAMES[today_j.month - 1],
            "previous_month_name": JALALI_MONTH_NAMES[previous_month - 1],
            "current_period_start": current_start.isoformat(),
            "current_period_end": today_j.togregorian().isoformat(),
            "previous_period_start": previous_start.isoformat(),
            "previous_period_end": previous_last_day_j.togregorian().isoformat(),
            "insights": insights,
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"خطا در تحلیل هوشمند هزینه‌ها: {str(e)}",
            "insights": [],
        }
    finally:
        connection.close()
