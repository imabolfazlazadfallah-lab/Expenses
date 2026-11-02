from datetime import date

from app.services.app_clock import app_today


MAX_AMOUNT = 1_000_000_000_000

VALID_CATEGORIES = {
    "غذا",
    "حمل و نقل",
    "خودرو",
    "خانه",
    "خرید",
    "درمان",
    "قبوض",
    "موبایل و اینترنت",
    "آموزش",
    "پوشاک",
    "تفریح",
    "سفر",
    "سایر",
}


def validate_expense(parsed: dict):
    errors = []

    # -------------------------
    # Amount
    # -------------------------
    amount = parsed.get("amount")

    if amount is None:
        errors.append("مبلغ مشخص نشده است.")

    elif not isinstance(amount, int):
        errors.append("مبلغ باید عدد صحیح باشد.")

    elif amount <= 0:
        errors.append("مبلغ باید بیشتر از صفر باشد.")

    elif amount > MAX_AMOUNT:
        errors.append(
            f"مبلغ نمی‌تواند بیشتر از {MAX_AMOUNT:,} تومان باشد."
        )

    # -------------------------
    # Description
    # -------------------------
    description = parsed.get("description")

    if not description or not description.strip():
        errors.append("توضیحات هزینه مشخص نشده است.")

    elif len(description.strip()) > 500:
        errors.append("توضیحات نمی‌تواند بیشتر از 500 کاراکتر باشد.")

    # -------------------------
    # Category
    # -------------------------
    category = parsed.get("category")

    if not category or not category.strip():
        errors.append("دسته‌بندی هزینه مشخص نشده است.")

    # فهرست دسته‌ها دیگر ثابت نیست. نام دسته‌بندی پس از اعتبارسنجی اولیه
    # در API با ردیف فعال EXP_CATEGORIES کنترل می‌شود؛ بنابراین دسته‌های جدید
    # و اقلام پیشنهادی که از مخزن Oracle تشخیص داده می‌شوند نیز پذیرفته می‌شوند.
    elif len(category.strip()) > 100:
        errors.append("نام دسته‌بندی بیش از حد طولانی است.")

    # -------------------------
    # Date
    # -------------------------
    expense_date = parsed.get("expense_date")

    if not expense_date:
        errors.append("تاریخ هزینه مشخص نشده است.")

    else:
        try:
            parsed_date = date.fromisoformat(expense_date)

            # جلوگیری از تاریخ‌های غیرواقعی آینده
            if parsed_date > app_today():
                errors.append(
                    "تاریخ هزینه نمی‌تواند در آینده باشد."
                )

        except ValueError:
            errors.append("تاریخ هزینه معتبر نیست.")

    return {
        "is_valid": len(errors) == 0,
        "errors": errors
    }