from fastapi import APIRouter

from app.database import get_connection


router = APIRouter(
    prefix="/api/categories",
    tags=["Categories"]
)


@router.get("/")
def get_categories():

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