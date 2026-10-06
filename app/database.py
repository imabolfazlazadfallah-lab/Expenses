import oracledb

connection = oracledb.connect(
    user="expense",
    password="Solaris2050!!!!",
    dsn="94.184.41.226:1521/orcl"
)


def get_connection():
    return oracledb.connect(
        user="expense",
        password="Solaris2050!!!!",
        dsn="94.184.41.226:1521/orcl"
    )

connection.close()