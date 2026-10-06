
from datetime import date
from app.schemas.expense import ExpenseDelete
from fastapi import APIRouter
from pydantic import BaseModel

from app.database import get_connection
from app.schemas.expense import ExpenseCreate
from app.services.expense_parser import parse_expense_text
from app.services.expense_validator import validate_expense
from app.services.confirmation_store import (
    create_confirmation,
    get_confirmation,
    update_confirmation,
    delete_confirmation
)


router = APIRouter(
    prefix="/api/expenses",
    tags=["Expenses"]
)


# =========================================================
# Manual Expense
# =========================================================

@router.post("/")
def create_expense(expense: ExpenseCreate):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        sql = """
            INSERT INTO EXP_EXPENSES (
                USER_ID,
                CATEGORY_ID,
                ACCOUNT_ID,
                AMOUNT,
                DESCRIPTION,
                EXPENSE_DATE,
                PAYMENT_METHOD,
                SOURCE_TYPE
            )
            VALUES (
                :user_id,
                :category_id,
                :account_id,
                :amount,
                :description,
                :expense_date,
                :payment_method,
                'MANUAL'
            )
            RETURNING EXPENSE_ID INTO :expense_id
        """

        expense_id = cursor.var(int)

        cursor.execute(
            sql,
            {
                "user_id": 1,
                "category_id": expense.category_id,
                "account_id": expense.account_id,
                "amount": expense.amount,
                "description": expense.description,
                "expense_date": expense.expense_date,
                "payment_method": expense.payment_method,
                "expense_id": expense_id
            }
        )

        connection.commit()

        return {
            "status": "success",
            "expense_id": expense_id.getvalue()[0],
            "message": "Expense saved successfully"
        }

    finally:
        connection.close()


# =========================================================
# Parse Expense From Text
# =========================================================

class ExpenseText(BaseModel):
    text: str


@router.post("/text")
def parse_expense_from_text(data: ExpenseText):

    if not data.text or not data.text.strip():
        return {
            "status": "error",
            "message": "متن هزینه نمی‌تواند خالی باشد."
        }

    try:
        parsed = parse_expense_text(data.text)

    except ValueError as e:
        return {
            "status": "error",
            "message": str(e)
        }

    validation = validate_expense(parsed)

    if not validation["is_valid"]:
        return {
            "status": "error",
            "message": "اطلاعات هزینه معتبر نیست.",
            "errors": validation["errors"]
        }

    confirmation_id = create_confirmation(
        parsed,
        data.text
    )

    return {
        "status": "confirmation_required",
        "message": "اطلاعات هزینه آماده تأیید است.",
        "confirmation_id": confirmation_id,
        "expense": parsed,
        "original_text": data.text
    }


# =========================================================
# Edit Confirmation
# =========================================================


class ExpenseEdit(BaseModel):
    expense_id: int
    amount: int
    description: str
    category_id: int | None = None
    expense_date: date

@router.put("/edit")
def edit_expense(data: ExpenseEdit):

    connection = get_connection()

    try:

        cursor = connection.cursor()

        # بررسی وجود هزینه
        cursor.execute(
            """
            SELECT EXPENSE_ID
            FROM EXP_EXPENSES
            WHERE EXPENSE_ID = :expense_id
              AND USER_ID = :user_id
            """,
            {
                "expense_id": data.expense_id,
                "user_id": 1
            }
        )

        expense = cursor.fetchone()

        if not expense:
            return {
                "status": "error",
                "message": "هزینه موردنظر پیدا نشد."
            }


        # بررسی دسته‌بندی
        if data.category_id is not None:

            cursor.execute(
                """
                SELECT CATEGORY_ID
                FROM EXP_CATEGORIES
                WHERE CATEGORY_ID = :category_id
                  AND IS_ACTIVE = 1
                """,
                {
                    "category_id": data.category_id
                }
            )

            category = cursor.fetchone()

            if not category:
                return {
                    "status": "error",
                    "message": "دسته‌بندی معتبر نیست."
                }


        # اعتبارسنجی مبلغ
        if data.amount <= 0:

            return {
                "status": "error",
                "message": "مبلغ باید بیشتر از صفر باشد."
            }


        # تاریخ آینده مجاز نیست
        if data.expense_date > date.today():

            return {
                "status": "error",
                "message": "تاریخ هزینه نمی‌تواند در آینده باشد."
            }


        # Update
        cursor.execute(
            """
            UPDATE EXP_EXPENSES
            SET
                AMOUNT = :amount,
                DESCRIPTION = :description,
                CATEGORY_ID = :category_id,
                EXPENSE_DATE = :expense_date,
                UPDATED_AT = SYSTIMESTAMP
            WHERE EXPENSE_ID = :expense_id
              AND USER_ID = :user_id
            """,
            {
                "amount": data.amount,
                "description": data.description,
                "category_id": data.category_id,
                "expense_date": data.expense_date,
                "expense_id": data.expense_id,
                "user_id": 1
            }
        )

        connection.commit()

        return {
            "status": "success",
            "message": "هزینه با موفقیت ویرایش شد.",
            "expense_id": data.expense_id
        }

    except Exception as e:

        connection.rollback()

        return {
            "status": "error",
            "message": f"خطا در ویرایش هزینه: {str(e)}"
        }

    finally:

        connection.close()

# =========================================================
# Confirm Expense
# =========================================================

class ExpenseConfirm(BaseModel):
    confirmation_id: str


@router.post("/confirm")
def confirm_expense(data: ExpenseConfirm):

    pending = get_confirmation(
        data.confirmation_id
    )

    if not pending:
        return {
            "status": "error",
            "message": "Confirmation معتبر نیست یا منقضی شده است."
        }

    parsed = pending["expense"]
    original_text = pending["original_text"]

    validation = validate_expense(parsed)

    if not validation["is_valid"]:
        return {
            "status": "error",
            "message": "اطلاعات هزینه معتبر نیست.",
            "errors": validation["errors"]
        }

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # -------------------------------------------------
        # Find Category
        # -------------------------------------------------

        cursor.execute(
            """
            SELECT CATEGORY_ID
            FROM EXP_CATEGORIES
            WHERE CATEGORY_NAME = :category_name
            """,
            {
                "category_name": parsed["category"]
            }
        )

        category_result = cursor.fetchone()

        if not category_result:
            return {
                "status": "error",
                "message": "دسته‌بندی هزینه در Oracle پیدا نشد."
            }

        category_id = category_result[0]

        # -------------------------------------------------
        # Insert Expense
        # -------------------------------------------------

        sql = """
            INSERT INTO EXP_EXPENSES (
                USER_ID,
                CATEGORY_ID,
                AMOUNT,
                DESCRIPTION,
                EXPENSE_DATE,
                SOURCE_TYPE,
                AI_RAW_TEXT
            )
            VALUES (
                :user_id,
                :category_id,
                :amount,
                :description,
                :expense_date,
                'TEXT',
                :raw_text
            )
            RETURNING EXPENSE_ID INTO :expense_id
        """

        expense_id = cursor.var(int)

        cursor.execute(
            sql,
            {
                "user_id": 1,
                "category_id": category_id,
                "amount": parsed["amount"],
                "description": parsed["description"],
                "expense_date": date.fromisoformat(
                    parsed["expense_date"]
                ),
                "raw_text": original_text,
                "expense_id": expense_id
            }
        )

        connection.commit()

        # -------------------------------------------------
        # Delete Pending Confirmation
        # -------------------------------------------------

        delete_confirmation(
            data.confirmation_id
        )

        return {
            "status": "success",
            "message": "هزینه با موفقیت ثبت شد.",
            "expense_id": expense_id.getvalue()[0],
            "expense": parsed
        }

    finally:
        connection.close()


# =========================================================
# Cancel Confirmation
# =========================================================

class ExpenseCancel(BaseModel):
    confirmation_id: str


@router.post("/cancel")
def cancel_expense(data: ExpenseCancel):

    pending = get_confirmation(
        data.confirmation_id
    )

    if not pending:
        return {
            "status": "error",
            "message": "Confirmation معتبر نیست یا منقضی شده است."
        }

    delete_confirmation(
        data.confirmation_id
    )

    return {
        "status": "cancelled",
        "message": "ثبت هزینه لغو شد.",
        "confirmation_id": data.confirmation_id
    }

# =========================================================
# Get Expenses
# =========================================================

@router.get("/")
def get_expenses(
    from_date: date | None = None,
    to_date: date | None = None,
    category_id: int | None = None,
    account_id: int | None = None
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
                e.PAYMENT_METHOD,
                e.SOURCE_TYPE,
                c.CATEGORY_ID,
                c.CATEGORY_NAME,
                c.ICON,
                a.ACCOUNT_ID,
                a.ACCOUNT_NAME
            FROM EXP_EXPENSES e

            LEFT JOIN EXP_CATEGORIES c
                ON c.CATEGORY_ID = e.CATEGORY_ID

            LEFT JOIN EXP_ACCOUNTS a
                ON a.ACCOUNT_ID = e.ACCOUNT_ID

            WHERE e.USER_ID = :user_id
        """

        params = {
            "user_id": 1
        }

        if from_date:
            sql += """
                AND e.EXPENSE_DATE >= :from_date
            """
            params["from_date"] = from_date

        if to_date:
            sql += """
                AND e.EXPENSE_DATE < :to_date + 1
            """
            params["to_date"] = to_date

        if category_id:
            sql += """
                AND e.CATEGORY_ID = :category_id
            """
            params["category_id"] = category_id

        if account_id:
            sql += """
                AND e.ACCOUNT_ID = :account_id
            """
            params["account_id"] = account_id

        sql += """
            ORDER BY e.EXPENSE_DATE DESC,
                     e.EXPENSE_ID DESC
        """

        cursor.execute(
            sql,
            params
        )

        rows = cursor.fetchall()

        expenses = []

        for row in rows:

            expenses.append({
                "expense_id": row[0],
                "amount": row[1],
                "description": row[2],
                "expense_date": row[3].strftime("%Y-%m-%d"),
                "payment_method": row[4],
                "source_type": row[5],
                "category": {
                    "category_id": row[6],
                    "name": row[7],
                    "icon": row[8]
                } if row[6] else None,
                "account": {
                    "account_id": row[9],
                    "name": row[10]
                } if row[9] else None
            })

        total_amount = sum(
            expense["amount"]
            for expense in expenses
        )

        return {
            "status": "success",
            "count": len(expenses),
            "total_amount": total_amount,
            "expenses": expenses
        }

    finally:
        connection.close()


# =========================================================
# Expense Summary
# =========================================================

@router.get("/summary")
def get_expense_summary(
    from_date: date | None = None,
    to_date: date | None = None
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # -------------------------------------------------
        # Overall Summary
        # -------------------------------------------------

        summary_sql = """
            SELECT
                COUNT(*),
                NVL(SUM(AMOUNT), 0),
                NVL(MAX(AMOUNT), 0),
                NVL(MIN(AMOUNT), 0)
            FROM EXP_EXPENSES
            WHERE USER_ID = :user_id
        """

        summary_params = {
            "user_id": 1
        }

        if from_date:
            summary_sql += """
                AND EXPENSE_DATE >= :from_date
            """
            summary_params["from_date"] = from_date

        if to_date:
            summary_sql += """
                AND EXPENSE_DATE < :to_date + 1
            """
            summary_params["to_date"] = to_date

        cursor.execute(
            summary_sql,
            summary_params
        )

        summary = cursor.fetchone()

        # -------------------------------------------------
        # Category Summary
        # -------------------------------------------------

        category_sql = """
            SELECT
                c.CATEGORY_ID,
                c.CATEGORY_NAME,
                c.ICON,
                COUNT(e.EXPENSE_ID),
                NVL(SUM(e.AMOUNT), 0)
            FROM EXP_EXPENSES e

            INNER JOIN EXP_CATEGORIES c
                ON c.CATEGORY_ID = e.CATEGORY_ID

            WHERE e.USER_ID = :user_id
        """

        category_params = {
            "user_id": 1
        }

        if from_date:
            category_sql += """
                AND e.EXPENSE_DATE >= :from_date
            """
            category_params["from_date"] = from_date

        if to_date:
            category_sql += """
                AND e.EXPENSE_DATE < :to_date + 1
            """
            category_params["to_date"] = to_date

        category_sql += """
            GROUP BY
                c.CATEGORY_ID,
                c.CATEGORY_NAME,
                c.ICON

            ORDER BY
                SUM(e.AMOUNT) DESC
        """

        cursor.execute(
            category_sql,
            category_params
        )

        category_rows = cursor.fetchall()

        categories = []

        for row in category_rows:

            categories.append({
                "category_id": row[0],
                "category_name": row[1],
                "icon": row[2],
                "expense_count": row[3],
                "total_amount": row[4]
            })

        return {
            "status": "success",

            "summary": {
                "expense_count": summary[0],
                "total_amount": summary[1],
                "max_amount": summary[2],
                "min_amount": summary[3]
            },

            "categories": categories
        }

    finally:
        connection.close()


@router.delete("/delete")
def delete_expense(data: ExpenseDelete):

    connection = get_connection()

    try:

        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT EXPENSE_ID
            FROM EXP_EXPENSES
            WHERE EXPENSE_ID = :expense_id
              AND USER_ID = :user_id
            """,
            {
                "expense_id": data.expense_id,
                "user_id": 1
            }
        )

        expense = cursor.fetchone()

        if not expense:
            return {
                "status": "error",
                "message": "هزینه موردنظر پیدا نشد."
            }

        cursor.execute(
            """
            DELETE FROM EXP_EXPENSES
            WHERE EXPENSE_ID = :expense_id
              AND USER_ID = :user_id
            """,
            {
                "expense_id": data.expense_id,
                "user_id": 1
            }
        )

        connection.commit()

        return {
            "status": "success",
            "message": "هزینه با موفقیت حذف شد.",
            "expense_id": data.expense_id
        }

    except Exception as e:

        connection.rollback()

        return {
            "status": "error",
            "message": f"خطا در حذف هزینه: {str(e)}"
        }

    finally:
        connection.close()

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
                NVL(SUM(e.AMOUNT), 0) AS TOTAL_AMOUNT,
                COUNT(e.EXPENSE_ID) AS EXPENSE_COUNT
            FROM EXP_CATEGORIES c
            LEFT JOIN EXP_EXPENSES e
                ON e.CATEGORY_ID = c.CATEGORY_ID
               AND e.USER_ID = :user_id
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
                "category_id": row[0],
                "category_name": row[1],
                "icon": row[2],
                "total_amount": int(row[3] or 0),
                "expense_count": int(row[4] or 0)
            }

            categories.append(category)

            total_amount += category["total_amount"]

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
            "total_amount": total_amount,
            "categories": categories
        }

    except Exception as e:

        return {
            "status": "error",
            "message": f"خطا در دریافت آمار دسته‌بندی‌ها: {str(e)}",
            "categories": []
        }

    finally:

        connection.close()
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

        total_amount = int(row[0] or 0)
        expense_count = int(row[1] or 0)

        return {
            "status": "success",
            "total_amount": total_amount,
            "expense_count": expense_count
        }

    except Exception as e:

        return {
            "status": "error",
            "message": f"خطا در دریافت هزینه امروز: {str(e)}",
            "total_amount": 0,
            "expense_count": 0
        }

    finally:

        connection.close()


@router.get("/summary/month")
def get_month_summary():

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
              AND EXPENSE_DATE >= TRUNC(SYSDATE, 'MM')
              AND EXPENSE_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'MM'), 1)
            """,
            {
                "user_id": 1
            }
        )

        row = cursor.fetchone()

        total_amount = int(row[0] or 0)
        expense_count = int(row[1] or 0)

        return {
            "status": "success",
            "total_amount": total_amount,
            "expense_count": expense_count
        }

    except Exception as e:

        return {
            "status": "error",
            "message": f"خطا در دریافت هزینه ماه: {str(e)}",
            "total_amount": 0,
            "expense_count": 0
        }

    finally:

        connection.close()