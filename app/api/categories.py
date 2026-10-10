from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.database import get_connection


router = APIRouter(
    prefix="/api/categories",
    tags=["Categories"]
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
def create_category(category: CategoryCreate):

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

        connection.commit()

        return {
            "status": "success",
            "message": "دسته‌بندی با موفقیت ایجاد شد.",
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

@router.put("/{category_id}")
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

@router.patch("/{category_id}/status")
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

@router.delete("/{category_id}")
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