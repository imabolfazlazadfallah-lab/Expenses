"""Shared account-balance calculation for the expense tracker."""


def get_account_current_balance(cursor, account_id: int, user_id: int = 1, exclude_expense_id: int | None = None) -> int:
    """Opening balance + credits + transfers in - expenses - transfers out.

    The caller should lock the corresponding account row with SELECT ... FOR UPDATE
    before using this function to validate and post a balance-changing transaction.
    """
    expense_exclusion = ""
    params = {"account_id": account_id, "user_id": user_id}
    if exclude_expense_id is not None:
        expense_exclusion = " AND e.EXPENSE_ID <> :exclude_expense_id"
        params["exclude_expense_id"] = exclude_expense_id

    sql = f"""
        SELECT
            NVL(a.INITIAL_BALANCE, 0)
            + NVL((
                SELECT SUM(cr.AMOUNT)
                FROM EXP_ACCOUNT_CREDITS cr
                WHERE cr.USER_ID = :user_id
                  AND cr.ACCOUNT_ID = :account_id
            ), 0)
            + NVL((
                SELECT SUM(tr.AMOUNT)
                FROM EXP_ACCOUNT_TRANSFERS tr
                WHERE tr.USER_ID = :user_id
                  AND tr.TO_ACCOUNT_ID = :account_id
            ), 0)
            - NVL((
                SELECT SUM(e.AMOUNT)
                FROM EXP_EXPENSES e
                WHERE e.USER_ID = :user_id
                  AND e.ACCOUNT_ID = :account_id
                  {expense_exclusion}
            ), 0)
            - NVL((
                SELECT SUM(tr.AMOUNT)
                FROM EXP_ACCOUNT_TRANSFERS tr
                WHERE tr.USER_ID = :user_id
                  AND tr.FROM_ACCOUNT_ID = :account_id
            ), 0) AS CURRENT_BALANCE
        FROM EXP_ACCOUNTS a
        WHERE a.ACCOUNT_ID = :account_id
          AND a.USER_ID = :user_id
    """
    cursor.execute(sql, params)
    row = cursor.fetchone()
    if not row:
        raise ValueError("حساب موردنظر پیدا نشد.")
    return int(row[0] or 0)
