from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.database import get_connection
from app.services.account_balance import get_account_current_balance

router = APIRouter(prefix="/api/accounts", tags=["Accounts"])

# Keep aligned with the current application until authentication is connected.
DEFAULT_USER_ID = 1

ACCOUNT_TYPES = {
    "CASH": "پول نقد",
    "BANK": "حساب بانکی",
    "CARD": "کارت بانکی",
}
CREDIT_TYPES = {
    "INCOME": "درآمد",
    "DEPOSIT": "افزایش موجودی / واریز",
}


def normalize_account_type(value: str | None) -> str:
    value = (value or "CASH").strip().upper()
    aliases = {
        "CASH_WALLET": "CASH", "WALLET": "CASH", "نقد": "CASH",
        "نقدی": "CASH", "پول نقد": "CASH", "بانک": "BANK",
        "حساب بانکی": "BANK", "کارت": "CARD", "کارت بانکی": "CARD",
    }
    return aliases.get(value, value)


class AccountCreate(BaseModel):
    account_name: str
    account_type: str = "CASH"
    initial_balance: int = 0


class AccountUpdate(BaseModel):
    account_name: str
    account_type: str = "CASH"
    initial_balance: int = 0


class AccountCreditCreate(BaseModel):
    amount: int
    credit_type: Literal["INCOME", "DEPOSIT"] = "DEPOSIT"
    description: str = ""
    credit_date: date = Field(default_factory=date.today)


class AccountTransferCreate(BaseModel):
    from_account_id: int
    to_account_id: int
    amount: int
    description: str = "انتقال وجه"
    transfer_date: date = Field(default_factory=date.today)


def _account_exists(cursor, account_id: int, user_id: int = DEFAULT_USER_ID, active_only: bool = False) -> bool:
    sql = "SELECT 1 FROM EXP_ACCOUNTS WHERE ACCOUNT_ID = :account_id AND USER_ID = :user_id"
    if active_only:
        sql += " AND IS_ACTIVE = 1"
    cursor.execute(sql, {"account_id": account_id, "user_id": user_id})
    return cursor.fetchone() is not None


def _format_account_row(row):
    account_type = row[2] or "CASH"
    return {
        "account_id": int(row[0]),
        "account_name": row[1],
        "account_type": account_type,
        "account_type_label": ACCOUNT_TYPES.get(account_type, account_type),
        "initial_balance": int(row[3] or 0),
        "is_active": int(row[4] or 0) == 1,
        "created_at": row[5].isoformat() if row[5] else None,
        "spent_total": int(row[6] or 0),
        "expense_count": int(row[7] or 0),
        "credit_total": int(row[8] or 0),
        "income_total": int(row[9] or 0),
        "deposit_total": int(row[10] or 0),
        "transfer_in_total": int(row[11] or 0),
        "transfer_out_total": int(row[12] or 0),
        "current_balance": int(row[13] or 0),
    }


_ACCOUNT_AGGREGATES = """
    SELECT
        a.ACCOUNT_ID,
        a.ACCOUNT_NAME,
        a.ACCOUNT_TYPE,
        NVL(a.INITIAL_BALANCE, 0) AS INITIAL_BALANCE,
        a.IS_ACTIVE,
        a.CREATED_AT,
        NVL(e.SPENT_TOTAL, 0) AS SPENT_TOTAL,
        NVL(e.EXPENSE_COUNT, 0) AS EXPENSE_COUNT,
        NVL(cr.CREDIT_TOTAL, 0) AS CREDIT_TOTAL,
        NVL(cr.INCOME_TOTAL, 0) AS INCOME_TOTAL,
        NVL(cr.DEPOSIT_TOTAL, 0) AS DEPOSIT_TOTAL,
        NVL(tr.TRANSFER_IN_TOTAL, 0) AS TRANSFER_IN_TOTAL,
        NVL(tr.TRANSFER_OUT_TOTAL, 0) AS TRANSFER_OUT_TOTAL,
        NVL(a.INITIAL_BALANCE, 0) + NVL(cr.CREDIT_TOTAL, 0)
            + NVL(tr.TRANSFER_IN_TOTAL, 0) - NVL(e.SPENT_TOTAL, 0)
            - NVL(tr.TRANSFER_OUT_TOTAL, 0) AS CURRENT_BALANCE
    FROM EXP_ACCOUNTS a
    LEFT JOIN (
        SELECT ACCOUNT_ID, SUM(AMOUNT) AS SPENT_TOTAL, COUNT(*) AS EXPENSE_COUNT
        FROM EXP_EXPENSES
        WHERE USER_ID = :expense_user_id AND ACCOUNT_ID IS NOT NULL
        GROUP BY ACCOUNT_ID
    ) e ON e.ACCOUNT_ID = a.ACCOUNT_ID
    LEFT JOIN (
        SELECT ACCOUNT_ID,
               SUM(AMOUNT) AS CREDIT_TOTAL,
               SUM(CASE WHEN CREDIT_TYPE = 'INCOME' THEN AMOUNT ELSE 0 END) AS INCOME_TOTAL,
               SUM(CASE WHEN CREDIT_TYPE = 'DEPOSIT' THEN AMOUNT ELSE 0 END) AS DEPOSIT_TOTAL
        FROM EXP_ACCOUNT_CREDITS
        WHERE USER_ID = :credit_user_id
        GROUP BY ACCOUNT_ID
    ) cr ON cr.ACCOUNT_ID = a.ACCOUNT_ID
    LEFT JOIN (
        SELECT ACCOUNT_ID,
               SUM(TRANSFER_IN_TOTAL) AS TRANSFER_IN_TOTAL,
               SUM(TRANSFER_OUT_TOTAL) AS TRANSFER_OUT_TOTAL
        FROM (
            SELECT TO_ACCOUNT_ID AS ACCOUNT_ID,
                   SUM(AMOUNT) AS TRANSFER_IN_TOTAL,
                   0 AS TRANSFER_OUT_TOTAL
            FROM EXP_ACCOUNT_TRANSFERS
            WHERE USER_ID = :transfer_in_user_id
            GROUP BY TO_ACCOUNT_ID
            UNION ALL
            SELECT FROM_ACCOUNT_ID AS ACCOUNT_ID,
                   0 AS TRANSFER_IN_TOTAL,
                   SUM(AMOUNT) AS TRANSFER_OUT_TOTAL
            FROM EXP_ACCOUNT_TRANSFERS
            WHERE USER_ID = :transfer_out_user_id
            GROUP BY FROM_ACCOUNT_ID
        )
        GROUP BY ACCOUNT_ID
    ) tr ON tr.ACCOUNT_ID = a.ACCOUNT_ID
"""


@router.get("/summary")
def get_accounts_summary():
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "SELECT COUNT(*), NVL(SUM(INITIAL_BALANCE), 0), NVL(SUM(SPENT_TOTAL), 0), "
            "NVL(SUM(CREDIT_TOTAL), 0), NVL(SUM(INCOME_TOTAL), 0), NVL(SUM(DEPOSIT_TOTAL), 0), "
            "NVL(SUM(CURRENT_BALANCE), 0) FROM (" + _ACCOUNT_AGGREGATES +
            " WHERE a.USER_ID = :user_id AND a.IS_ACTIVE = 1)",
            {
                "user_id": DEFAULT_USER_ID,
                "expense_user_id": DEFAULT_USER_ID,
                "credit_user_id": DEFAULT_USER_ID,
                "transfer_in_user_id": DEFAULT_USER_ID,
                "transfer_out_user_id": DEFAULT_USER_ID,
            },
        )
        row = cursor.fetchone()
        return {
            "status": "success",
            "active_account_count": int(row[0] or 0),
            "initial_balance_total": int(row[1] or 0),
            "spent_total": int(row[2] or 0),
            "credit_total": int(row[3] or 0),
            "income_total": int(row[4] or 0),
            "deposit_total": int(row[5] or 0),
            "current_balance_total": int(row[6] or 0),
        }
    except Exception as exc:
        return {"status": "error", "message": f"خطا در دریافت خلاصه حساب‌ها: {exc}"}
    finally:
        connection.close()


@router.get("/")
def get_accounts(include_inactive: bool = Query(False)):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            _ACCOUNT_AGGREGATES + """
            WHERE a.USER_ID = :user_id
              AND (:include_inactive = 1 OR a.IS_ACTIVE = 1)
            ORDER BY a.IS_ACTIVE DESC, a.CREATED_AT DESC, a.ACCOUNT_ID DESC
            """,
            {
                "user_id": DEFAULT_USER_ID,
                "expense_user_id": DEFAULT_USER_ID,
                "credit_user_id": DEFAULT_USER_ID,
                "transfer_in_user_id": DEFAULT_USER_ID,
                "transfer_out_user_id": DEFAULT_USER_ID,
                "include_inactive": 1 if include_inactive else 0,
            },
        )
        accounts = [_format_account_row(row) for row in cursor.fetchall()]
        return {"status": "success", "accounts": accounts, "count": len(accounts)}
    except Exception as exc:
        return {"status": "error", "message": f"خطا در دریافت حساب‌ها: {exc}", "accounts": []}
    finally:
        connection.close()


@router.post("/")
def create_account(data: AccountCreate):
    account_name = (data.account_name or "").strip()
    account_type = normalize_account_type(data.account_type)
    if not account_name:
        return {"status": "error", "message": "نام حساب را وارد کنید."}
    if len(account_name) > 100:
        return {"status": "error", "message": "نام حساب نباید بیشتر از ۱۰۰ کاراکتر باشد."}
    if data.initial_balance < 0:
        return {"status": "error", "message": "موجودی اولیه نمی‌تواند منفی باشد."}
    if account_type not in ACCOUNT_TYPES:
        return {"status": "error", "message": "نوع حساب معتبر نیست."}

    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """SELECT COUNT(*) FROM EXP_ACCOUNTS
               WHERE USER_ID = :user_id
                 AND UPPER(TRIM(ACCOUNT_NAME)) = UPPER(:account_name)
                 AND IS_ACTIVE = 1""",
            {"user_id": DEFAULT_USER_ID, "account_name": account_name},
        )
        if int(cursor.fetchone()[0] or 0) > 0:
            return {"status": "error", "message": "یک حساب فعال با این نام وجود دارد."}

        account_id_var = cursor.var(int)
        cursor.execute(
            """INSERT INTO EXP_ACCOUNTS
                   (USER_ID, ACCOUNT_NAME, ACCOUNT_TYPE, INITIAL_BALANCE, IS_ACTIVE)
               VALUES (:user_id, :account_name, :account_type, :initial_balance, 1)
               RETURNING ACCOUNT_ID INTO :account_id""",
            {
                "user_id": DEFAULT_USER_ID, "account_name": account_name,
                "account_type": account_type, "initial_balance": data.initial_balance,
                "account_id": account_id_var,
            },
        )
        raw_id = account_id_var.getvalue()
        account_id = int(raw_id[0] if isinstance(raw_id, list) else raw_id)
        connection.commit()
        return {"status": "success", "message": "حساب با موفقیت ایجاد شد.", "account_id": account_id}
    except Exception as exc:
        connection.rollback()
        return {"status": "error", "message": f"خطا در ایجاد حساب: {exc}"}
    finally:
        connection.close()


@router.put("/{account_id}")
def update_account(account_id: int, data: AccountUpdate):
    account_name = (data.account_name or "").strip()
    account_type = normalize_account_type(data.account_type)
    if not account_name:
        return {"status": "error", "message": "نام حساب را وارد کنید."}
    if len(account_name) > 100:
        return {"status": "error", "message": "نام حساب نباید بیشتر از ۱۰۰ کاراکتر باشد."}
    if data.initial_balance < 0:
        return {"status": "error", "message": "موجودی اولیه نمی‌تواند منفی باشد."}
    if account_type not in ACCOUNT_TYPES:
        return {"status": "error", "message": "نوع حساب معتبر نیست."}

    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "SELECT ACCOUNT_ID, NVL(INITIAL_BALANCE, 0) FROM EXP_ACCOUNTS WHERE ACCOUNT_ID = :account_id AND USER_ID = :user_id FOR UPDATE",
            {"account_id": account_id, "user_id": DEFAULT_USER_ID},
        )
        locked_account = cursor.fetchone()
        if not locked_account:
            return {"status": "error", "message": "حساب موردنظر پیدا نشد."}
        old_initial_balance = int(locked_account[1] or 0)

        cursor.execute(
            """SELECT COUNT(*) FROM EXP_ACCOUNTS
               WHERE USER_ID = :user_id AND ACCOUNT_ID <> :account_id
                 AND UPPER(TRIM(ACCOUNT_NAME)) = UPPER(:account_name) AND IS_ACTIVE = 1""",
            {"user_id": DEFAULT_USER_ID, "account_id": account_id, "account_name": account_name},
        )
        if int(cursor.fetchone()[0] or 0) > 0:
            return {"status": "error", "message": "حساب فعال دیگری با این نام وجود دارد."}

        # A changed opening balance must include credits, expenses, and transfers.
        current_balance = get_account_current_balance(cursor, account_id, DEFAULT_USER_ID)
        resulting_balance = current_balance - old_initial_balance + int(data.initial_balance)
        # Do not block harmless edits to an account that was already negative.
        # Reject only a change that would newly create or worsen a negative balance.
        if resulting_balance < 0 and int(data.initial_balance) < old_initial_balance:
            return {
                "status": "error",
                "message": f"کاهش موجودی اولیه باعث منفی‌تر شدن حساب می‌شود. برای ثبت هزینه جدید، از گزینه افزایش موجودی استفاده کنید.",
            }

        cursor.execute(
            """UPDATE EXP_ACCOUNTS
               SET ACCOUNT_NAME = :account_name, ACCOUNT_TYPE = :account_type, INITIAL_BALANCE = :initial_balance
               WHERE ACCOUNT_ID = :account_id AND USER_ID = :user_id""",
            {
                "account_name": account_name, "account_type": account_type,
                "initial_balance": data.initial_balance, "account_id": account_id,
                "user_id": DEFAULT_USER_ID,
            },
        )
        connection.commit()
        return {"status": "success", "message": "حساب با موفقیت ویرایش شد."}
    except Exception as exc:
        connection.rollback()
        return {"status": "error", "message": f"خطا در ویرایش حساب: {exc}"}
    finally:
        connection.close()


@router.post("/{account_id}/credits")
def create_account_credit(account_id: int, data: AccountCreditCreate):
    if data.amount <= 0:
        return {"status": "error", "message": "مبلغ باید بیشتر از صفر باشد."}
    if data.amount > 999_999_999_999_999_999:
        return {"status": "error", "message": "مبلغ واردشده بیش از حد مجاز است."}
    description = (data.description or "").strip()
    if not description:
        return {"status": "error", "message": "شرح درآمد یا افزایش موجودی را وارد کنید."}
    if len(description) > 500:
        return {"status": "error", "message": "شرح نباید بیشتر از ۵۰۰ کاراکتر باشد."}
    if data.credit_date > date.today():
        return {"status": "error", "message": "تاریخ تراکنش نمی‌تواند در آینده باشد."}

    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """SELECT ACCOUNT_NAME FROM EXP_ACCOUNTS
               WHERE ACCOUNT_ID = :account_id AND USER_ID = :user_id AND IS_ACTIVE = 1
               FOR UPDATE""",
            {"account_id": account_id, "user_id": DEFAULT_USER_ID},
        )
        account_row = cursor.fetchone()
        if not account_row:
            return {"status": "error", "message": "حساب فعال موردنظر پیدا نشد."}

        credit_id_var = cursor.var(int)
        cursor.execute(
            """INSERT INTO EXP_ACCOUNT_CREDITS
                   (USER_ID, ACCOUNT_ID, CREDIT_TYPE, AMOUNT, DESCRIPTION, CREDIT_DATE, CREATED_AT)
               VALUES (:user_id, :account_id, :credit_type, :amount, :description, :credit_date, SYSTIMESTAMP)
               RETURNING CREDIT_ID INTO :credit_id""",
            {
                "user_id": DEFAULT_USER_ID, "account_id": account_id,
                "credit_type": data.credit_type, "amount": data.amount,
                "description": description, "credit_date": data.credit_date,
                "credit_id": credit_id_var,
            },
        )
        raw_id = credit_id_var.getvalue()
        credit_id = int(raw_id[0] if isinstance(raw_id, list) else raw_id)
        new_balance = get_account_current_balance(cursor, account_id, DEFAULT_USER_ID)
        connection.commit()
        label = CREDIT_TYPES[data.credit_type]
        return {
            "status": "success", "message": f"{label} با موفقیت ثبت شد.",
            "credit_id": credit_id, "account_id": account_id,
            "current_balance": new_balance,
        }
    except Exception as exc:
        connection.rollback()
        return {"status": "error", "message": f"خطا در ثبت درآمد یا افزایش موجودی: {exc}"}
    finally:
        connection.close()


@router.post("/transfers")
def create_account_transfer(data: AccountTransferCreate):
    """Post a transfer atomically; it is not an income or expense."""
    source_id = int(data.from_account_id)
    destination_id = int(data.to_account_id)
    amount = int(data.amount)
    description = (data.description or "انتقال وجه").strip() or "انتقال وجه"

    if source_id == destination_id:
        return {"status": "error", "message": "حساب مبدأ و مقصد باید متفاوت باشند."}
    if amount <= 0:
        return {"status": "error", "message": "مبلغ انتقال باید بیشتر از صفر باشد."}
    if amount > 999_999_999_999_999_999:
        return {"status": "error", "message": "مبلغ واردشده بیش از حد مجاز است."}
    if len(description) > 500:
        return {"status": "error", "message": "شرح انتقال نباید بیشتر از ۵۰۰ کاراکتر باشد."}
    if data.transfer_date > date.today():
        return {"status": "error", "message": "تاریخ انتقال نمی‌تواند در آینده باشد."}

    connection = get_connection()
    try:
        cursor = connection.cursor()
        locked_accounts = {}
        # A stable lock order helps avoid deadlocks on concurrent transfers.
        for account_id in sorted([source_id, destination_id]):
            cursor.execute(
                """SELECT ACCOUNT_ID, ACCOUNT_NAME
                   FROM EXP_ACCOUNTS
                   WHERE ACCOUNT_ID = :account_id
                     AND USER_ID = :user_id
                     AND IS_ACTIVE = 1
                   FOR UPDATE""",
                {"account_id": account_id, "user_id": DEFAULT_USER_ID},
            )
            row = cursor.fetchone()
            if not row:
                connection.rollback()
                return {"status": "error", "message": "حساب مبدأ یا مقصد فعال پیدا نشد."}
            locked_accounts[int(row[0])] = row[1]

        source_balance = get_account_current_balance(cursor, source_id, DEFAULT_USER_ID)
        if source_balance < amount:
            connection.rollback()
            return {
                "status": "error",
                "message": f"موجودی حساب مبدأ کافی نیست. موجودی فعلی: {source_balance:,} تومان.",
                "source_balance": source_balance,
            }

        transfer_id_var = cursor.var(int)
        cursor.execute(
            """INSERT INTO EXP_ACCOUNT_TRANSFERS
                   (USER_ID, FROM_ACCOUNT_ID, TO_ACCOUNT_ID, AMOUNT, DESCRIPTION, TRANSFER_DATE, CREATED_AT)
               VALUES
                   (:user_id, :from_account_id, :to_account_id, :amount, :description, :transfer_date, SYSTIMESTAMP)
               RETURNING TRANSFER_ID INTO :transfer_id""",
            {
                "user_id": DEFAULT_USER_ID,
                "from_account_id": source_id,
                "to_account_id": destination_id,
                "amount": amount,
                "description": description,
                "transfer_date": data.transfer_date,
                "transfer_id": transfer_id_var,
            },
        )
        raw_id = transfer_id_var.getvalue()
        transfer_id = int(raw_id[0] if isinstance(raw_id, list) else raw_id)
        source_after = get_account_current_balance(cursor, source_id, DEFAULT_USER_ID)
        destination_after = get_account_current_balance(cursor, destination_id, DEFAULT_USER_ID)
        connection.commit()
        return {
            "status": "success",
            "message": f"انتقال {amount:,} تومان از «{locked_accounts[source_id]}» به «{locked_accounts[destination_id]}» ثبت شد.",
            "transfer_id": transfer_id,
            "from_account_id": source_id,
            "to_account_id": destination_id,
            "amount": amount,
            "source_balance": source_after,
            "destination_balance": destination_after,
        }
    except Exception as exc:
        connection.rollback()
        return {"status": "error", "message": f"خطا در انتقال وجه: {exc}"}
    finally:
        connection.close()

@router.post("/{account_id}/deactivate")
def deactivate_account(account_id: int):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        if not _account_exists(cursor, account_id, active_only=True):
            return {"status": "error", "message": "حساب فعال موردنظر پیدا نشد."}
        cursor.execute(
            "UPDATE EXP_ACCOUNTS SET IS_ACTIVE = 0 WHERE ACCOUNT_ID = :account_id AND USER_ID = :user_id",
            {"account_id": account_id, "user_id": DEFAULT_USER_ID},
        )
        connection.commit()
        return {"status": "success", "message": "حساب غیرفعال شد. سوابق تراکنش‌ها حفظ می‌شوند."}
    except Exception as exc:
        connection.rollback()
        return {"status": "error", "message": f"خطا در غیرفعال‌سازی حساب: {exc}"}
    finally:
        connection.close()


@router.post("/{account_id}/activate")
def activate_account(account_id: int):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        if not _account_exists(cursor, account_id, active_only=False):
            return {"status": "error", "message": "حساب موردنظر پیدا نشد."}
        cursor.execute(
            "UPDATE EXP_ACCOUNTS SET IS_ACTIVE = 1 WHERE ACCOUNT_ID = :account_id AND USER_ID = :user_id",
            {"account_id": account_id, "user_id": DEFAULT_USER_ID},
        )
        connection.commit()
        return {"status": "success", "message": "حساب دوباره فعال شد."}
    except Exception as exc:
        connection.rollback()
        return {"status": "error", "message": f"خطا در فعال‌سازی حساب: {exc}"}
    finally:
        connection.close()


@router.get("/{account_id}/transactions")
def get_account_transactions(account_id: int, limit: int = Query(50, ge=1, le=200)):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "SELECT ACCOUNT_NAME FROM EXP_ACCOUNTS WHERE ACCOUNT_ID = :account_id AND USER_ID = :user_id",
            {"account_id": account_id, "user_id": DEFAULT_USER_ID},
        )
        account_row = cursor.fetchone()
        if not account_row:
            return {"status": "error", "message": "حساب موردنظر پیدا نشد.", "transactions": []}

        cursor.execute(
            """SELECT * FROM (
                   SELECT * FROM (
                       SELECT e.EXPENSE_ID AS TRANSACTION_ID, e.AMOUNT, e.DESCRIPTION,
                              e.EXPENSE_DATE AS TRANSACTION_DATE, e.CREATED_AT,
                              'EXPENSE' AS TRANSACTION_TYPE, NVL(c.CATEGORY_NAME, 'سایر') AS LABEL
                       FROM EXP_EXPENSES e
                       LEFT JOIN EXP_CATEGORIES c ON c.CATEGORY_ID = e.CATEGORY_ID
                       WHERE e.USER_ID = :expense_user_id AND e.ACCOUNT_ID = :expense_account_id
                       UNION ALL
                       SELECT cr.CREDIT_ID AS TRANSACTION_ID, cr.AMOUNT, cr.DESCRIPTION,
                              cr.CREDIT_DATE AS TRANSACTION_DATE, cr.CREATED_AT,
                              cr.CREDIT_TYPE AS TRANSACTION_TYPE,
                              CASE cr.CREDIT_TYPE WHEN 'INCOME' THEN 'درآمد' ELSE 'افزایش موجودی' END AS LABEL
                       FROM EXP_ACCOUNT_CREDITS cr
                       WHERE cr.USER_ID = :credit_user_id AND cr.ACCOUNT_ID = :credit_account_id
                       UNION ALL
                       SELECT tr.TRANSFER_ID AS TRANSACTION_ID, tr.AMOUNT, tr.DESCRIPTION,
                              tr.TRANSFER_DATE AS TRANSACTION_DATE, tr.CREATED_AT,
                              'TRANSFER_OUT' AS TRANSACTION_TYPE,
                              'انتقال به ' || dst.ACCOUNT_NAME AS LABEL
                       FROM EXP_ACCOUNT_TRANSFERS tr
                       JOIN EXP_ACCOUNTS dst ON dst.ACCOUNT_ID = tr.TO_ACCOUNT_ID
                       WHERE tr.USER_ID = :transfer_out_user_id AND tr.FROM_ACCOUNT_ID = :transfer_out_account_id
                       UNION ALL
                       SELECT tr.TRANSFER_ID AS TRANSACTION_ID, tr.AMOUNT, tr.DESCRIPTION,
                              tr.TRANSFER_DATE AS TRANSACTION_DATE, tr.CREATED_AT,
                              'TRANSFER_IN' AS TRANSACTION_TYPE,
                              'انتقال از ' || src.ACCOUNT_NAME AS LABEL
                       FROM EXP_ACCOUNT_TRANSFERS tr
                       JOIN EXP_ACCOUNTS src ON src.ACCOUNT_ID = tr.FROM_ACCOUNT_ID
                       WHERE tr.USER_ID = :transfer_in_user_id AND tr.TO_ACCOUNT_ID = :transfer_in_account_id
                   ) ORDER BY TRANSACTION_DATE DESC, CREATED_AT DESC, TRANSACTION_ID DESC
               ) WHERE ROWNUM <= :max_rows""",
            {
                "expense_user_id": DEFAULT_USER_ID, "expense_account_id": account_id,
                "credit_user_id": DEFAULT_USER_ID, "credit_account_id": account_id,
                "transfer_out_user_id": DEFAULT_USER_ID, "transfer_out_account_id": account_id,
                "transfer_in_user_id": DEFAULT_USER_ID, "transfer_in_account_id": account_id,
                "max_rows": limit,
            },
        )
        transactions = []
        type_labels = {
            "EXPENSE": ("expense", "هزینه", "out"),
            "INCOME": ("income", "درآمد", "in"),
            "DEPOSIT": ("deposit", "افزایش موجودی", "in"),
            "TRANSFER_OUT": ("transfer_out", "انتقال خروجی", "out"),
            "TRANSFER_IN": ("transfer_in", "انتقال ورودی", "in"),
        }
        for row in cursor.fetchall():
            raw_type = str(row[5] or "EXPENSE").upper()
            trans_type, trans_label, direction = type_labels.get(raw_type, ("expense", raw_type, "out"))
            label = row[6] or trans_label
            transactions.append({
                "transaction_id": int(row[0]),
                "amount": int(row[1] or 0),
                "description": row[2] or "بدون توضیح",
                "expense_date": row[3].strftime("%Y-%m-%d") if row[3] else None,
                "created_at": row[4].isoformat() if row[4] else None,
                "transaction_type": trans_type,
                "transaction_label": label,
                "category_name": label,
                "direction": direction,
            })
        return {
            "status": "success", "account_id": account_id, "account_name": account_row[0],
            "transactions": transactions, "count": len(transactions),
        }
    except Exception as exc:
        return {"status": "error", "message": f"خطا در دریافت گردش حساب: {exc}", "transactions": []}
    finally:
        connection.close()
