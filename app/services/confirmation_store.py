from datetime import datetime, timedelta
from uuid import uuid4

from app.database import get_connection


CONFIRMATION_TTL_MINUTES = 10


def create_confirmation(
    expense: dict,
    original_text: str | None = None
):
    confirmation_id = str(uuid4())

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO EXP_PENDING_CONFIRMATIONS (
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
            VALUES (
                :confirmation_id,
                :user_id,
                :amount,
                :description,
                :category_name,
                :expense_date,
                :original_text,
                SYSTIMESTAMP,
                SYSTIMESTAMP + INTERVAL '10' MINUTE
            )
            """,
            {
                "confirmation_id": confirmation_id,
                "user_id": 1,
                "amount": expense["amount"],
                "description": expense["description"],
                "category_name": expense["category"],
                "expense_date": datetime.fromisoformat(
                    expense["expense_date"]
                ),
                "original_text": original_text
            }
        )

        connection.commit()

        return confirmation_id

    finally:
        connection.close()


def get_confirmation(confirmation_id: str):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        print("DEBUG confirmation_id:", repr(confirmation_id))

        cursor.execute(
            """
            SELECT
                CONFIRMATION_ID,
                AMOUNT,
                DESCRIPTION,
                CATEGORY_NAME,
                EXPENSE_DATE,
                ORIGINAL_TEXT,
                EXPIRES_AT
            FROM EXP_PENDING_CONFIRMATIONS
            WHERE CONFIRMATION_ID = :confirmation_id
            """,
            {
                "confirmation_id": confirmation_id
            }
        )

        row = cursor.fetchone()

        print("DEBUG row:", row)

        if not row:
            print("DEBUG: confirmation NOT FOUND")
            return None

        confirmation_id_db = row[0]
        amount = row[1]
        description = row[2]
        category_name = row[3]
        expense_date = row[4]
        original_text = row[5]
        expires_at = row[6]

        print("DEBUG DB confirmation_id:", repr(confirmation_id_db))
        print("DEBUG expires_at:", expires_at)

        return {
            "expense": {
                "amount": amount,
                "description": description,
                "category": category_name,
                "expense_date": expense_date.strftime("%Y-%m-%d")
            },
            "original_text": original_text
        }

    finally:
        connection.close()

def update_confirmation(
    confirmation_id: str,
    expense: dict,
    original_text: str | None = None
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            UPDATE EXP_PENDING_CONFIRMATIONS
            SET
                AMOUNT = :amount,
                DESCRIPTION = :description,
                CATEGORY_NAME = :category_name,
                EXPENSE_DATE = :expense_date,
                ORIGINAL_TEXT = :original_text
            WHERE CONFIRMATION_ID = :confirmation_id
              AND EXPIRES_AT > SYSTIMESTAMP
            """,
            {
                "confirmation_id": confirmation_id,
                "amount": expense["amount"],
                "description": expense["description"],
                "category_name": expense["category"],
                "expense_date": datetime.fromisoformat(
                    expense["expense_date"]
                ),
                "original_text": original_text
            }
        )

        updated = cursor.rowcount > 0

        connection.commit()

        return updated

    finally:
        connection.close()


def delete_confirmation(
    confirmation_id: str
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE FROM EXP_PENDING_CONFIRMATIONS
            WHERE CONFIRMATION_ID = :confirmation_id
            """,
            {
                "confirmation_id": confirmation_id
            }
        )

        connection.commit()

    finally:
        connection.close()