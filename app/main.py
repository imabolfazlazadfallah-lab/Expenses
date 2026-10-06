from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.database import get_connection
from app.api.expenses import router as expenses_router
from app.api.categories import router as categories_router
from app.api.accounts import router as accounts_router


app = FastAPI(title="Expense Tracker")


# API Routers
app.include_router(expenses_router)
app.include_router(categories_router)
app.include_router(accounts_router)


# Static files
app.mount(
    "/static",
    StaticFiles(directory="app/static"),
    name="static"
)


# Home
@app.get("/", include_in_schema=False)
def home():
    return FileResponse("app/static/index.html")


# Database test
@app.get("/db-test")
def database_test():
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            "SELECT SYSDATE FROM DUAL"
        )

        result = cursor.fetchone()

        return {
            "database": "Oracle",
            "status": "connected",
            "oracle_date": str(result[0])
        }

    finally:
        connection.close()