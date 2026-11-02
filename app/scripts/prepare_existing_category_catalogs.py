"""One-time backfill: prepare item catalogs for active existing categories.

Run from the project root after sql/create_exp_category_catalog.sql:
    .venv\\Scripts\\python.exe -m app.scripts.prepare_existing_category_catalogs
"""
from app.database import get_connection
from app.services.category_catalog import prepare_category_catalog


def main() -> None:
    connection = get_connection()
    jobs: list[tuple[int, int, str]] = []
    try:
        cursor = connection.cursor()
        cursor.execute(
            """SELECT CATEGORY_ID, CATEGORY_NAME
                 FROM EXP_CATEGORIES
                WHERE IS_ACTIVE = 1
                ORDER BY CATEGORY_ID"""
        )
        categories = cursor.fetchall()

        for category_id, category_name in categories:
            cursor.execute(
                """SELECT COUNT(*) FROM EXP_CATEGORY_ITEMS
                    WHERE CATEGORY_ID = :category_id AND IS_ACTIVE = 1""",
                {"category_id": int(category_id)},
            )
            if int(cursor.fetchone()[0] or 0) > 0:
                continue

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
                jobs.append((int(value), int(category_id), str(category_name)))

        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    print(f"برای {len(jobs)} دسته‌بندی فرایند آماده‌سازی در صف قرار گرفت.")
    for job_id, category_id, category_name in jobs:
        print(f"در حال آماده‌سازی: {category_name} (CATEGORY_ID={category_id})")
        prepare_category_catalog(job_id, category_id, category_name)
    print("آماده‌سازی دسته‌بندی‌های موجود تمام شد. وضعیت هر فرایند در EXP_CATEGORY_CATALOG_JOBS ذخیره شده است.")


if __name__ == "__main__":
    main()
