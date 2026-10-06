from fastapi import APIRouter
from pydantic import BaseModel

from app.database import get_connection


router = APIRouter(
    prefix="/api/accounts",
    tags=["Accounts"]
)


# =========================================================
# Schema
# =========================================================

class AccountCreate(BaseModel):
    account_name: str
    account_type: str | None = None
    initial_balance: int = 0


# =========================================================
# Get Accounts
# =========================================================

@router.get("/")
def get_accounts():

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                ACCOUNT_ID,
                ACCOUNT_NAME,
                ACCOUNT_TYPE,
                INITIAL_BALANCE
            FROM EXP_ACCOUNTS
            WHERE USER_ID = :user_id
              AND IS_ACTIVE = 1
            ORDER BY ACCOUNT_ID
            """,
            {
                "user_id": 1
            }
        )

        rows = cursor.fetchall()

        accounts = []

        for row in rows:
            accounts.append({
                "account_id": row[0],
                "account_name": row[1],
                "account_type": row[2],
                "initial_balance": row[3]
            })

        return {
            "status": "success",
            "count": len(accounts),
            "accounts": accounts
        }

    finally:
        connection.close()


# =========================================================
# Create Account
# =========================================================

@router.post("/")
def create_account(account: AccountCreate):

    if not account.account_name.strip():
        return {
            "status": "error",
            "message": "نام حساب نمی‌تواند خالی باشد."
        }

    if account.initial_balance < 0:
        return {
            "status": "error",
            "message": "موجودی اولیه نمی‌تواند منفی باشد."
        }

    connection = get_connection()

    try:
        cursor = connection.cursor()

        sql = """
            INSERT INTO EXP_ACCOUNTS (
                USER_ID,
                ACCOUNT_NAME,
                ACCOUNT_TYPE,
                INITIAL_BALANCE
            )
            VALUES (
                :user_id,
                :account_name,
                :account_type,
                :initial_balance
            )
            RETURNING ACCOUNT_ID INTO :account_id
        """

        account_id = cursor.var(int)

        cursor.execute(
            sql,
            {
                "user_id": 1,
                "account_name": account.account_name.strip(),
                "account_type": account.account_type,
                "initial_balance": account.initial_balance,
                "account_id": account_id
            }
        )

        connection.commit()

        return {
            "status": "success",
            "account_id": account_id.getvalue()[0],
            "message": "حساب با موفقیت ایجاد شد."
        }

    finally:
        connection.close()