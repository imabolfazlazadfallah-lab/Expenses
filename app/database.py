

import oracledb

# Use the same values that worked with your previous database.py.
ORACLE_USER = "expense"
ORACLE_PASSWORD = "Solaris2050!!!!"
ORACLE_DSN = "94.184.41.226:1521/orcl"


def get_connection():
    """Open and return one Oracle connection for the current API operation.

    Existing API endpoints already close the returned connection in their
    finally blocks, so this keeps their current behavior unchanged.
    """
    return oracledb.connect(
        user=ORACLE_USER,
        password=ORACLE_PASSWORD,
        dsn=ORACLE_DSN,
    )


def test_connection() -> bool:
    """Return True if Oracle can be reached using the configured credentials."""
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM DUAL")
            row = cursor.fetchone()
            return bool(row and row[0] == 1)
    finally:
        connection.close()
