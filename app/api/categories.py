from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel

from app.database import get_connection
from app.api.auth import require_active_user, require_owner_user
from app.services.category_catalog import prepare_category_catalog


router = APIRouter(
    prefix="/api/categories",
    tags=["Categories"],
    dependencies=[Depends(require_active_user)]
)


# ============================================================
# MODELS
# ============================================================

class CategoryCreate(BaseModel):
    category_name: str
    icon: Optional[str] = "📁"
    is_active: int = 1


class CategoryUpdate(BaseModel):
    category_name: Optional[str] = None
    icon: Optional[str] = None


class CategoryStatusUpdate(BaseModel):
    is_active: int


# ============================================================
# GET CATEGORIES
# ============================================================

@router.get("/")
def get_categories(include_inactive: bool = False):

    connection = get_connection()

    try:

        cursor = connection.cursor()

        if include_inactive:

            cursor.execute(
                """
                SELECT
                    CATEGORY_ID,
                    CATEGORY_NAME,
                    ICON,
                    IS_ACTIVE
                FROM EXP_CATEGORIES
                ORDER BY CATEGORY_ID
                """
            )

        else:

            cursor.execute(
                """
                SELECT
                    CATEGORY_ID,
                    CATEGORY_NAME,
                    ICON,
                    IS_ACTIVE
                FROM EXP_CATEGORIES
                WHERE IS_ACTIVE = 1
                ORDER BY CATEGORY_ID
                """
            )

        rows = cursor.fetchall()

        categories = []

        for row in rows:

            categories.append(
                {
                    "category_id": row[0],
                    "category_name": row[1],
                    "icon": row[2],
                    "is_active": row[3]
                }
            )

        return {
            "status": "success",
            "categories": categories
        }

    except Exception as e:

        return {
            "status": "error",
            "message": f"خطا در دریافت دسته‌بندی‌ها: {str(e)}",
            "categories": []
        }

    finally:

        connection.close()


# ============================================================
# GET SINGLE CATEGORY
# ============================================================

@router.get("/{category_id}")
def get_category(category_id: int):

    connection = get_connection()

    try:

        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                CATEGORY_ID,
                CATEGORY_NAME,
                ICON,
                IS_ACTIVE
            FROM EXP_CATEGORIES
            WHERE CATEGORY_ID = :category_id
            """,
            {
                "category_id": category_id
            }
        )

        row = cursor.fetchone()

        if not row:

            return {
                "status": "error",
                "message": "دسته‌بندی موردنظر پیدا نشد.",
                "category": None
            }

        category = {
            "category_id": row[0],
            "category_name": row[1],
            "icon": row[2],
            "is_active": row[3]
        }

        return {
            "status": "success",
            "category": category
        }

    except Exception as e:

        return {
            "status": "error",
            "message": f"خطا در دریافت دسته‌بندی: {str(e)}",
            "category": None
        }

    finally:

        connection.close()


# ============================================================
# CREATE CATEGORY
# ============================================================

@router.post("/")
def create_category(category: CategoryCreate, background_tasks: BackgroundTasks):

    connection = get_connection()

    try:

        category_name = (category.category_name or "").strip()
        icon = (category.icon or "📁").strip()

        if not category_name:

            return {
                "status": "error",
                "message": "نام دسته‌بندی الزامی است."
            }

        if len(category_name) > 100:

            return {
                "status": "error",
                "message": "نام دسته‌بندی نمی‌تواند بیشتر از 100 کاراکتر باشد."
            }

        if not icon:

            icon = "📁"

        is_active = 1 if category.is_active else 0

        cursor = connection.cursor()

        # جلوگیری از ثبت نام تکراری
        cursor.execute(
            """
            SELECT
                CATEGORY_ID
            FROM EXP_CATEGORIES
            WHERE LOWER(TRIM(CATEGORY_NAME)) = LOWER(TRIM(:category_name))
            """,
            {
                "category_name": category_name
            }
        )

        duplicate = cursor.fetchone()

        if duplicate:

            return {
                "status": "error",
                "message": "این دسته‌بندی قبلاً وجود دارد.",
                "category_id": duplicate[0]
            }

        # جلوگیری از تداخل CATEGORY_ID در درخواست‌های همزمان
        cursor.execute(
            """
            LOCK TABLE EXP_CATEGORIES IN EXCLUSIVE MODE
            """
        )

        cursor.execute(
            """
            SELECT
                NVL(MAX(CATEGORY_ID), 0) + 1
            FROM EXP_CATEGORIES
            """
        )

        new_category_id = cursor.fetchone()[0]

        cursor.execute(
            """
            INSERT INTO EXP_CATEGORIES
            (
                CATEGORY_ID,
                CATEGORY_NAME,
                ICON,
                IS_ACTIVE
            )
            VALUES
            (
                :category_id,
                :category_name,
                :icon,
                :is_active
            )
            """,
            {
                "category_id": new_category_id,
                "category_name": category_name,
                "icon": icon,
                "is_active": is_active
            }
        )

        # Queue catalog preparation in the same transaction if the new catalog
        # tables have already been installed. A missing catalog table must not
        # undo successful category creation.
        catalog_job_id = None
        catalog_status = "NOT_CONFIGURED"
        try:
            cursor.execute("SAVEPOINT before_catalog_job")
            job_id_var = cursor.var(int)
            cursor.execute(
                """INSERT INTO EXP_CATEGORY_CATALOG_JOBS (CATEGORY_ID, STATUS)
                   VALUES (:category_id, 'PENDING')
                   RETURNING JOB_ID INTO :job_id""",
                {"category_id": new_category_id, "job_id": job_id_var},
            )
            returned_job_id = job_id_var.getvalue()
            if isinstance(returned_job_id, (list, tuple)):
                returned_job_id = returned_job_id[0] if returned_job_id else None
            catalog_job_id = int(returned_job_id) if returned_job_id is not None else None
            catalog_status = "PENDING" if catalog_job_id else "NOT_CONFIGURED"
        except Exception as catalog_error:
            try:
                cursor.execute("ROLLBACK TO SAVEPOINT before_catalog_job")
            except Exception:
                pass
            print(f"CATEGORY CATALOG NOT CONFIGURED: {catalog_error}")

        connection.commit()

        if catalog_job_id:
            background_tasks.add_task(
                prepare_category_catalog,
                catalog_job_id,
                new_category_id,
                category_name,
            )

        return {
            "status": "success",
            "message": "دسته‌بندی با موفقیت ایجاد شد.",
            "catalog_status": catalog_status,
            "catalog_job_id": catalog_job_id,
            "catalog_message": (
                "در حال آماده‌سازی فهرست اقلام..."
                if catalog_job_id
                else "دسته ساخته شد، اما جداول فهرست اقلام نصب نشده‌اند. اسکریپت SQL را اجرا کنید."
            ),
            "category": {
                "category_id": new_category_id,
                "category_name": category_name,
                "icon": icon,
                "is_active": is_active
            }
        }

    except Exception as e:

        connection.rollback()

        return {
            "status": "error",
            "message": f"خطا در ایجاد دسته‌بندی: {str(e)}"
        }

    finally:

        connection.close()


# ============================================================
# UPDATE CATEGORY
# ============================================================

@router.put("/{category_id}", dependencies=[Depends(require_owner_user)])
def update_category(
    category_id: int,
    category: CategoryUpdate
):

    connection = get_connection()

    try:

        cursor = connection.cursor()

        # دریافت دسته‌بندی فعلی
        cursor.execute(
            """
            SELECT
                CATEGORY_NAME,
                ICON,
                IS_ACTIVE
            FROM EXP_CATEGORIES
            WHERE CATEGORY_ID = :category_id
            """,
            {
                "category_id": category_id
            }
        )

        current = cursor.fetchone()

        if not current:

            return {
                "status": "error",
                "message": "دسته‌بندی موردنظر پیدا نشد."
            }

        current_name = current[0]
        current_icon = current[1]
        current_is_active = current[2]

        new_name = (
            category.category_name.strip()
            if category.category_name is not None
            else current_name
        )

        new_icon = (
            category.icon.strip()
            if category.icon is not None
            else current_icon
        )

        if not new_name:

            return {
                "status": "error",
                "message": "نام دسته‌بندی نمی‌تواند خالی باشد."
            }

        if len(new_name) > 100:

            return {
                "status": "error",
                "message": "نام دسته‌بندی نمی‌تواند بیشتر از 100 کاراکتر باشد."
            }

        if not new_icon:

            new_icon = "📁"

        # بررسی نام تکراری
        cursor.execute(
            """
            SELECT
                CATEGORY_ID
            FROM EXP_CATEGORIES
            WHERE LOWER(TRIM(CATEGORY_NAME)) = LOWER(TRIM(:category_name))
              AND CATEGORY_ID <> :category_id
            """,
            {
                "category_name": new_name,
                "category_id": category_id
            }
        )

        duplicate = cursor.fetchone()

        if duplicate:

            return {
                "status": "error",
                "message": "دسته‌بندی دیگری با این نام وجود دارد.",
                "category_id": duplicate[0]
            }

        cursor.execute(
            """
            UPDATE EXP_CATEGORIES
            SET
                CATEGORY_NAME = :category_name,
                ICON = :icon
            WHERE CATEGORY_ID = :category_id
            """,
            {
                "category_name": new_name,
                "icon": new_icon,
                "category_id": category_id
            }
        )

        connection.commit()

        return {
            "status": "success",
            "message": "دسته‌بندی با موفقیت ویرایش شد.",
            "category": {
                "category_id": category_id,
                "category_name": new_name,
                "icon": new_icon,
                "is_active": current_is_active
            }
        }

    except Exception as e:

        connection.rollback()

        return {
            "status": "error",
            "message": f"خطا در ویرایش دسته‌بندی: {str(e)}"
        }

    finally:

        connection.close()


# ============================================================
# CHANGE CATEGORY STATUS
# ============================================================

@router.patch("/{category_id}/status", dependencies=[Depends(require_owner_user)])
def update_category_status(
    category_id: int,
    status: CategoryStatusUpdate
):

    connection = get_connection()

    try:

        is_active = 1 if status.is_active else 0

        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                CATEGORY_NAME,
                ICON
            FROM EXP_CATEGORIES
            WHERE CATEGORY_ID = :category_id
            """,
            {
                "category_id": category_id
            }
        )

        row = cursor.fetchone()

        if not row:

            return {
                "status": "error",
                "message": "دسته‌بندی موردنظر پیدا نشد."
            }

        cursor.execute(
            """
            UPDATE EXP_CATEGORIES
            SET
                IS_ACTIVE = :is_active
            WHERE CATEGORY_ID = :category_id
            """,
            {
                "is_active": is_active,
                "category_id": category_id
            }
        )

        connection.commit()

        return {
            "status": "success",
            "message": (
                "دسته‌بندی فعال شد."
                if is_active == 1
                else "دسته‌بندی غیرفعال شد."
            ),
            "category": {
                "category_id": category_id,
                "category_name": row[0],
                "icon": row[1],
                "is_active": is_active
            }
        }

    except Exception as e:

        connection.rollback()

        return {
            "status": "error",
            "message": f"خطا در تغییر وضعیت دسته‌بندی: {str(e)}"
        }

    finally:

        connection.close()


# ============================================================
# DELETE CATEGORY
# SOFT DELETE
# ============================================================

@router.delete("/{category_id}", dependencies=[Depends(require_owner_user)])
def delete_category(category_id: int):

    connection = get_connection()

    try:

        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                CATEGORY_NAME,
                IS_ACTIVE
            FROM EXP_CATEGORIES
            WHERE CATEGORY_ID = :category_id
            """,
            {
                "category_id": category_id
            }
        )

        row = cursor.fetchone()

        if not row:

            return {
                "status": "error",
                "message": "دسته‌بندی موردنظر پیدا نشد."
            }

        if row[1] == 0:

            return {
                "status": "success",
                "message": "این دسته‌بندی قبلاً غیرفعال شده است."
            }

        # حذف فیزیکی انجام نمی‌دهیم
        # تا سابقه هزینه‌ها و CATEGORY_IDها آسیب نبینند.
        cursor.execute(
            """
            UPDATE EXP_CATEGORIES
            SET
                IS_ACTIVE = 0
            WHERE CATEGORY_ID = :category_id
            """,
            {
                "category_id": category_id
            }
        )

        connection.commit()

        return {
            "status": "success",
            "message": f"دسته‌بندی «{row[0]}» غیرفعال شد."
        }

    except Exception as e:

        connection.rollback()

        return {
            "status": "error",
            "message": f"خطا در حذف دسته‌بندی: {str(e)}"
        }

    finally:

        connection.close()

# ============================================================
# CATEGORY ITEM CATALOG
# ============================================================

@router.get("/catalog-jobs/{job_id}")
def get_category_catalog_job(job_id: int):
    """Poll this endpoint while the catalog background task is running."""
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """SELECT JOB_ID, CATEGORY_ID, STATUS, ITEM_COUNT,
                      CATALOG_KIND, MESSAGE, ERROR_MESSAGE,
                      CREATED_AT, STARTED_AT, FINISHED_AT
                 FROM EXP_CATEGORY_CATALOG_JOBS
                WHERE JOB_ID = :job_id""",
            {"job_id": job_id},
        )
        row = cursor.fetchone()
        if not row:
            return {"status": "error", "message": "فرایند آماده‌سازی پیدا نشد."}
        return {
            "status": "success",
            "job": {
                "job_id": int(row[0]),
                "category_id": int(row[1]),
                "job_status": row[2],
                "item_count": int(row[3] or 0),
                "catalog_kind": row[4],
                "message": row[5],
                "error_message": row[6],
                "created_at": str(row[7]) if row[7] else None,
                "started_at": str(row[8]) if row[8] else None,
                "finished_at": str(row[9]) if row[9] else None,
            },
        }
    except Exception as exc:
        print(f"GET CATEGORY CATALOG JOB ERROR: {exc}")
        return {
            "status": "error",
            "message": "وضعیت آماده‌سازی قابل دریافت نیست؛ وجود جداول فهرست اقلام را بررسی کنید.",
        }
    finally:
        connection.close()


@router.get("/{category_id}/items")
def get_category_items(category_id: int, include_inactive: bool = False):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        sql = """SELECT ITEM_ID, CATEGORY_ID, ITEM_NAME, KEYWORDS, SOURCE_TYPE, IS_ACTIVE, CREATED_AT
                   FROM EXP_CATEGORY_ITEMS WHERE CATEGORY_ID = :category_id"""
        if not include_inactive:
            sql += " AND IS_ACTIVE = 1"
        sql += " ORDER BY ITEM_NAME"
        cursor.execute(sql, {"category_id": category_id})
        rows = cursor.fetchall()
        items = []
        for row in rows:
            keywords = row[3].read() if hasattr(row[3], "read") else row[3]
            items.append({
                "item_id": int(row[0]),
                "category_id": int(row[1]),
                "item_name": row[2],
                "keywords": keywords or "",
                "source_type": row[4],
                "is_active": int(row[5] or 0),
                "created_at": str(row[6]) if row[6] else None,
            })
        return {"status": "success", "items": items, "count": len(items)}
    except Exception as exc:
        print(f"GET CATEGORY ITEMS ERROR: {exc}")
        return {"status": "error", "message": "فهرست اقلام در دسترس نیست؛ اسکریپت SQL را بررسی کنید.", "items": [], "count": 0}
    finally:
        connection.close()


@router.post("/prepare-existing-catalogs", dependencies=[Depends(require_owner_user)])
def prepare_existing_category_catalogs(background_tasks: BackgroundTasks):
    """Queue catalog generation for active legacy categories without active items.

    This endpoint replaces the need to execute a Python module manually on IIS.
    It requires the EXP_CATEGORY_ITEMS and EXP_CATEGORY_CATALOG_JOBS tables.
    """
    connection = get_connection()
    queued: list[tuple[int, int, str]] = []
    try:
        cursor = connection.cursor()
        cursor.execute(
            """SELECT c.CATEGORY_ID, c.CATEGORY_NAME
                 FROM EXP_CATEGORIES c
                WHERE c.IS_ACTIVE = 1
                  AND NOT EXISTS (
                      SELECT 1 FROM EXP_CATEGORY_ITEMS i
                       WHERE i.CATEGORY_ID = c.CATEGORY_ID AND i.IS_ACTIVE = 1
                  )
                ORDER BY c.CATEGORY_ID"""
        )
        categories = cursor.fetchall()
        for category_id, category_name in categories:
            job_id_var = cursor.var(int)
            cursor.execute(
                """INSERT INTO EXP_CATEGORY_CATALOG_JOBS (CATEGORY_ID, STATUS)
                   VALUES (:category_id, 'PENDING') RETURNING JOB_ID INTO :job_id""",
                {"category_id": int(category_id), "job_id": job_id_var},
            )
            value = job_id_var.getvalue()
            if isinstance(value, (list, tuple)):
                value = value[0] if value else None
            if value is not None:
                queued.append((int(value), int(category_id), str(category_name)))
        connection.commit()
        for job_id, category_id, category_name in queued:
            background_tasks.add_task(prepare_category_catalog, job_id, category_id, category_name)
        return {
            "status": "success",
            "queued_count": len(queued),
            "job_ids": [item[0] for item in queued],
            "message": (
                f"آماده‌سازی برای {len(queued)} دسته‌بندی موجود در صف قرار گرفت."
                if queued else "همه دسته‌بندی‌های فعال از قبل فهرست اقلام دارند."
            ),
        }
    except Exception as exc:
        connection.rollback()
        print(f"PREPARE EXISTING CATEGORY CATALOGS ERROR: {exc}")
        return {
            "status": "error",
            "message": "آماده‌سازی دسته‌های قبلی انجام نشد؛ وجود جدول‌های EXP_CATEGORY_ITEMS و EXP_CATEGORY_CATALOG_JOBS را بررسی کنید.",
        }
    finally:
        connection.close()


@router.post("/{category_id}/prepare-catalog", dependencies=[Depends(require_owner_user)])
def retry_category_catalog(category_id: int, background_tasks: BackgroundTasks):
    """Manually retry catalog setup if a previous job failed."""
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "SELECT CATEGORY_NAME, IS_ACTIVE FROM EXP_CATEGORIES WHERE CATEGORY_ID = :category_id",
            {"category_id": category_id},
        )
        category_row = cursor.fetchone()
        if not category_row or int(category_row[1] or 0) != 1:
            return {"status": "error", "message": "دسته‌بندی فعال پیدا نشد."}
        job_id_var = cursor.var(int)
        cursor.execute(
            """INSERT INTO EXP_CATEGORY_CATALOG_JOBS (CATEGORY_ID, STATUS)
               VALUES (:category_id, 'PENDING') RETURNING JOB_ID INTO :job_id""",
            {"category_id": category_id, "job_id": job_id_var},
        )
        returned_job_id = job_id_var.getvalue()
        if isinstance(returned_job_id, (list, tuple)):
            returned_job_id = returned_job_id[0] if returned_job_id else None
        if returned_job_id is None:
            connection.rollback()
            return {"status": "error", "message": "شناسه فرایند ایجاد نشد."}
        job_id = int(returned_job_id)
        connection.commit()
        background_tasks.add_task(prepare_category_catalog, job_id, category_id, str(category_row[0]))
        return {"status": "success", "job_id": job_id, "message": "آماده‌سازی دوباره آغاز شد."}
    except Exception as exc:
        connection.rollback()
        print(f"RETRY CATEGORY CATALOG ERROR: {exc}")
        return {"status": "error", "message": "امکان شروع آماده‌سازی وجود ندارد؛ وجود جداول فهرست اقلام را بررسی کنید."}
    finally:
        connection.close()
