from datetime import date, datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter
from pydantic import BaseModel

from app.database import get_connection
from app.services.expense_parser import parse_expense_text
from app.services.expense_validator import validate_expense


router = APIRouter(
    prefix="/api/expenses",
    tags=["Expenses"]
)


# ============================================================
# SCHEMAS
# ============================================================

class ExpenseEdit(BaseModel):

    expense_id: int

    amount: int

    description: str

    category_id: int | None = None

    expense_date: date


class ExpenseDelete(BaseModel):

    expense_id: int


class ExpenseTextRequest(BaseModel):

    text: str


class ExpenseConfirmRequest(BaseModel):

    confirmation_id: str


# ============================================================
# GET EXPENSES
# ============================================================

@router.get("/")
def get_expenses(
    from_date: date | None = None,
    to_date: date | None = None
):

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
            "user_id": 1
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
def get_today_summary():

    connection = get_connection()

    try:

        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                NVL(SUM(AMOUNT), 0),
                COUNT(*)
            FROM EXP_EXPENSES
            WHERE USER_ID = :user_id
              AND EXPENSE_DATE >= TRUNC(SYSDATE)
              AND EXPENSE_DATE < TRUNC(SYSDATE) + 1
            """,
            {
                "user_id": 1
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
def get_month_summary():

    user_id = 1

    today = date.today()

    connection = get_connection()

    try:

        cursor = connection.cursor()

        # ==========================================
        # ماه جاری
        # ==========================================

        cursor.execute(
            """
            SELECT
                NVL(SUM(AMOUNT), 0),
                COUNT(*)
            FROM EXP_EXPENSES
            WHERE USER_ID = :user_id
              AND EXPENSE_DATE >= TRUNC(
                    TO_DATE(:today, 'YYYY-MM-DD'),
                    'MM'
                  )
              AND EXPENSE_DATE < TO_DATE(
                    :today,
                    'YYYY-MM-DD'
                  ) + 1
            """,
            {
                "user_id": user_id,
                "today": today.strftime("%Y-%m-%d")
            }
        )

        current_row = cursor.fetchone()

        current_total = int(current_row[0] or 0)
        current_count = int(current_row[1] or 0)

        # تعداد روزهای سپری شده ماه جاری
        days_passed = today.day

        # میانگین روزانه ماه جاری
        average_daily = (
            round(current_total / days_passed)
            if days_passed > 0
            else 0
        )

        # ==========================================
        # ماه قبل
        # ==========================================

        cursor.execute(
            """
            SELECT
                NVL(SUM(AMOUNT), 0),
                COUNT(*)
            FROM EXP_EXPENSES
            WHERE USER_ID = :user_id
              AND EXPENSE_DATE >= ADD_MONTHS(
                    TRUNC(
                        TO_DATE(:today, 'YYYY-MM-DD'),
                        'MM'
                    ),
                    -1
                  )
              AND EXPENSE_DATE < TRUNC(
                    TO_DATE(:today, 'YYYY-MM-DD'),
                    'MM'
                  )
            """,
            {
                "user_id": user_id,
                "today": today.strftime("%Y-%m-%d")
            }
        )

        previous_row = cursor.fetchone()

        previous_total = int(previous_row[0] or 0)
        previous_count = int(previous_row[1] or 0)

        # ==========================================
        # مقایسه
        # ==========================================

        difference_amount = (
            current_total - previous_total
        )

        if previous_total > 0:

            percentage = round(
                (
                    difference_amount
                    / previous_total
                ) * 100,
                1
            )

        else:

            percentage = 100.0 if current_total > 0 else 0.0

        return {
            "status": "success",

            "current_month": {
                "total_amount": current_total,
                "expense_count": current_count,
                "days_passed": days_passed,
                "average_daily": average_daily
            },

            "previous_month": {
                "total_amount": previous_total,
                "expense_count": previous_count
            },

            "comparison": {
                "difference_amount": difference_amount,
                "percentage": percentage
            }
        }

    except Exception as e:

        return {
            "status": "error",
            "message": f"خطا در دریافت خلاصه ماه: {str(e)}"
        }

    finally:

        connection.close()
# ============================================================
# SUMMARY - CATEGORIES
# ============================================================

@router.get("/summary/categories")
def get_category_summary():

    connection = get_connection()

    try:

        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                c.CATEGORY_ID,
                c.CATEGORY_NAME,
                c.ICON,
                NVL(
                    SUM(e.AMOUNT),
                    0
                ) AS TOTAL_AMOUNT,
                COUNT(e.EXPENSE_ID)
                    AS EXPENSE_COUNT
            FROM EXP_CATEGORIES c

            LEFT JOIN EXP_EXPENSES e
                ON e.CATEGORY_ID =
                    c.CATEGORY_ID
               AND e.USER_ID =
                    :user_id

            WHERE c.IS_ACTIVE = 1

            GROUP BY
                c.CATEGORY_ID,
                c.CATEGORY_NAME,
                c.ICON

            ORDER BY
                TOTAL_AMOUNT DESC
            """,
            {
                "user_id": 1
            }
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
    data: ExpenseTextRequest
):

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

        if parsed_date > date.today():

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
                        1,

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
    data: ExpenseConfirmRequest
):

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
            """,
            {

                "confirmation_id":
                    data.confirmation_id,

                "user_id":
                    1
            }
        )

        row = cursor.fetchone()

        if not row:

            return {

                "status": "error",

                "message":
                    "اطلاعات تأیید هزینه پیدا نشد."
            }
        amount = row[2]

        description = row[3]

        category_name = row[4]

        expense_date = row[5]

        if isinstance(expense_date, datetime):
            expense_date = expense_date.date()

        original_text = row[6]

        # ----------------------------------------------------
        # SECURITY CHECK
        # ----------------------------------------------------

        if expense_date > date.today():
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
                    1,

                "category_id":
                    category_id,

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
    data: ExpenseConfirmRequest
):

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
                    1
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
    data: ExpenseEdit
):

    connection = get_connection()

    try:

        cursor = connection.cursor()

        # ----------------------------------------------------
        # CHECK EXPENSE
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
                    1
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

        if data.expense_date > date.today():

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

                "expense_date":
                    data.expense_date,

                "expense_id":
                    data.expense_id,

                "user_id":
                    1
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
    data: ExpenseDelete
):

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
                    1
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
                    1
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