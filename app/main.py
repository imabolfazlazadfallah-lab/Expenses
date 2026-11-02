import os
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app.database import get_connection
from app.api.expenses import router as expenses_router
from app.api.categories import router as categories_router
from app.api.accounts import router as accounts_router
from app.api.auth import router as auth_router
from app.api.notifications import router as notifications_router
from app.api.report_schedules import router as report_schedules_router
from app.api.payments import router as payments_router
from app.auth_security import SESSION_SECRET_KEY


app = FastAPI(title="Expense Tracker")


@app.middleware("http")
async def prevent_api_cache(request: Request, call_next):
    """Financial data and account balances must always be fetched live."""
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# Sessions are signed and HttpOnly. Keep SESSION_SECRET_KEY private and stable.
# HTTPS-only cookies are correct when IIS terminates HTTPS in front of Uvicorn.
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET_KEY,
    session_cookie="expense_session",
    max_age=int(os.getenv("SESSION_MAX_AGE_SECONDS", str(30 * 24 * 60 * 60))),
    same_site="lax",
    # Keep Secure cookies enabled in production HTTPS. Set SESSION_COOKIE_HTTPS_ONLY=false
    # only when the browser connects directly over HTTP (e.g. temporary internal test).
    https_only=os.getenv("SESSION_COOKIE_HTTPS_ONLY", "true").strip().lower() not in {"0", "false", "no"},
)


#@app.middleware("http")
#async def same_origin_write_guard(request: Request, call_next):
#    if request.method in {"POST", "PUT", "PATCH", "DELETE"} and request.url.path.startswith("/api/"):
#        origin = request.headers.get("origin")
##        if origin:
#            origin_host = urlparse(origin).hostname
#            request_host = request.url.hostname
#            if origin_host and request_host and origin_host.lower() != request_host.lower():
#                return JSONResponse(status_code=403, content={"detail": "درخواست از مبدأ نامعتبر رد شد."})
#    return await call_next(request)


# API Routers
app.include_router(auth_router)
app.include_router(expenses_router)
app.include_router(categories_router)
app.include_router(accounts_router)
app.include_router(notifications_router)
app.include_router(report_schedules_router)
app.include_router(payments_router)


# Static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.get("/service-worker.js", include_in_schema=False)
def service_worker():
    # Serve at the origin root so its scope can cover the whole PWA.
    path = Path("app/static/service-worker.js")
    return FileResponse(
        path,
        media_type="application/javascript",
        headers={"Service-Worker-Allowed": "/", "Cache-Control": "no-cache"},
    )


@app.get("/manifest.webmanifest", include_in_schema=False)
def manifest():
    return FileResponse(
        "app/static/manifest.webmanifest",
        media_type="application/manifest+json",
        headers={"Cache-Control": "no-cache"},
    )


@app.get("/", include_in_schema=False)
def home():
    return FileResponse("app/static/index.html", headers={"Cache-Control": "no-cache"})


@app.get("/db-test")
def database_test():
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("SELECT SYSDATE FROM DUAL")
        result = cursor.fetchone()
        return {"database": "Oracle", "status": "connected", "oracle_date": str(result[0])}
    finally:
        connection.close()
