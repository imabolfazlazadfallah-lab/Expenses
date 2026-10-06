import re
from datetime import date, timedelta
import jdatetime


# --------------------------------
# تبدیل اعداد فارسی و عربی به انگلیسی
# --------------------------------

def normalize_digits(text: str) -> str:

    persian_digits = "۰۱۲۳۴۵۶۷۸۹"
    arabic_digits = "٠١٢٣٤٥٦٧٨٩"

    translation_table = str.maketrans(
        persian_digits + arabic_digits,
        "0123456789" + "0123456789"
    )

    return text.translate(translation_table)


def parse_persian_number(text: str):

    ones = {
        "صفر": 0,
        "یک": 1,
        "دو": 2,
        "سه": 3,
        "چهار": 4,
        "پنج": 5,
        "شش": 6,
        "هفت": 7,
        "هشت": 8,
        "نه": 9,
        "ده": 10,
        "یازده": 11,
        "دوازده": 12,
        "سیزده": 13,
        "چهارده": 14,
        "پانزده": 15,
        "شانزده": 16,
        "هفده": 17,
        "هجده": 18,
        "نوزده": 19,
    }

    tens = {
        "بیست": 20,
        "سی": 30,
        "چهل": 40,
        "پنجاه": 50,
        "شصت": 60,
        "هفتاد": 70,
        "هشتاد": 80,
        "نود": 90,
    }

    hundreds = {
        "صد": 100,
        "دویست": 200,
        "سیصد": 300,
        "چهارصد": 400,
        "پانصد": 500,
        "ششصد": 600,
        "هفتصد": 700,
        "هشتصد": 800,
        "نهصد": 900,
    }

    text = text.replace(" و ", " ")

    words = text.split()

    total = 0

    for word in words:

        if word in ones:
            total += ones[word]

        elif word in tens:
            total += tens[word]

        elif word in hundreds:
            total += hundreds[word]

    return total
def parse_amount(text: str):

    # --------------------------------
    # جلوگیری از قبول مبلغ منفی
    # --------------------------------

    negative_pattern = (
        r"-\s*\d[\d,]*"
        r"(?:\s*(?:هزار|میلیون|تومان|تومن))?"
    )

    negative_match = re.search(
        negative_pattern,
        text
    )

    if negative_match:
        raise ValueError(
            "مبلغ نمی‌تواند منفی باشد."
        )

    # --------------------------------
    # میلیون + هزار
    # --------------------------------

    million_thousand_pattern = (
        r"(.+?)\s+میلیون"
        r"(?:\s+و\s+(.+?)\s+هزار)?"
    )

    match = re.search(
        million_thousand_pattern,
        text
    )

    if match:

        million_text = match.group(1).strip()
        thousand_text = match.group(2)

        million_part = parse_persian_number(
            million_text
        )

        thousand_part = 0

        if thousand_text:

            thousand_part = parse_persian_number(
                thousand_text.strip()
            )

        amount = (
            million_part * 1_000_000
            + thousand_part * 1_000
        )

        return amount, match.group(0)

    # --------------------------------
    # عدد انگلیسی + میلیون
    # --------------------------------

    pattern = r"(\d[\d,]*)\s*میلیون"

    match = re.search(pattern, text)

    if match:

        number = int(
            match.group(1).replace(",", "")
        )

        return number * 1_000_000, match.group(0)

    # --------------------------------
    # عدد نوشتاری + میلیون
    # --------------------------------

    pattern = (
        r"((?:"
        r"یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|"
        r"یازده|دوازده|سیزده|چهارده|پانزده|شانزده|"
        r"هفده|هجده|نوزده|بیست|سی|چهل|پنجاه|شصت|"
        r"هفتاد|هشتاد|نود|صد|دویست|سیصد|چهارصد|"
        r"پانصد|ششصد|هفتصد|هشتصد|نهصد)"
        r"(?:\s+و\s+"
        r"(?:یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|"
        r"یازده|دوازده|سیزده|چهارده|پانزده|شانزده|"
        r"هفده|هجده|نوزده|بیست|سی|چهل|پنجاه|شصت|"
        r"هفتاد|هشتاد|نود|صد|دویست|سیصد|چهارصد|"
        r"پانصد|ششصد|هفتصد|هشتصد|نهصد)"
        r")*)\s+میلیون"
    )

    match = re.search(pattern, text)

    if match:

        number_text = match.group(1)

        number = parse_persian_number(
            number_text
        )

        return number * 1_000_000, match.group(0)

    # --------------------------------
    # عدد + هزار
    # --------------------------------

    pattern = r"(\d[\d,]*)\s*هزار"

    match = re.search(pattern, text)

    if match:

        number = int(
            match.group(1).replace(",", "")
        )

        return number * 1_000, match.group(0)

    # --------------------------------
    # عدد نوشتاری + هزار
    # --------------------------------

    pattern = (
        r"((?:"
        r"یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|"
        r"یازده|دوازده|سیزده|چهارده|پانزده|شانزده|"
        r"هفده|هجده|نوزده|بیست|سی|چهل|پنجاه|شصت|"
        r"هفتاد|هشتاد|نود|صد|دویست|سیصد|چهارصد|"
        r"پانصد|ششصد|هفتصد|هشتصد|نهصد)"
        r"(?:\s+و\s+"
        r"(?:یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|"
        r"یازده|دوازده|سیزده|چهارده|پانزده|شانزده|"
        r"هفده|هجده|نوزده|بیست|سی|چهل|پنجاه|شصت|"
        r"هفتاد|هشتاد|نود|صد|دویست|سیصد|چهارصد|"
        r"پانصد|ششصد|هفتصد|هشتصد|نهصد)"
        r")*)\s+هزار"
    )

    match = re.search(pattern, text)

    if match:

        number_text = match.group(1)

        number = parse_persian_number(
            number_text
        )

        return number * 1_000, match.group(0)

    # --------------------------------
    # عدد معمولی با تومان
    # --------------------------------

    pattern = r"(\d[\d,]*)\s*(?:تومان|تومن)"

    match = re.search(pattern, text)

    if match:

        number = int(
            match.group(1).replace(",", "")
        )

        return number, match.group(0)

    # --------------------------------
    # عدد ساده
    # --------------------------------

    pattern = r"(\d[\d,]*)"

    match = re.search(pattern, text)

    if match:

        number = int(
            match.group(1).replace(",", "")
        )

        return number, match.group(0)

    raise ValueError(
        "مبلغ در متن پیدا نشد."
    )
    # --------------------------------
# تشخیص تاریخ
# --------------------------------

def parse_date(text: str):

    today = date.today()

    # امروز
    if "امروز" in text:
        return today, "امروز"

    # دیروز
    if "دیروز" in text:
        return today - timedelta(days=1), "دیروز"

    # پریروز
    if "پریروز" in text:
        return today - timedelta(days=2), "پریروز"

    # --------------------------------
    # تاریخ جلالی
    # مثال:
    # 1405/07/14
    # 1405-07-14
    # ۱۴۰۵/۰۷/۱۰
    # --------------------------------

    jalali_pattern = r"(\d{4})\s*[/\-]\s*(\d{1,2})\s*[/\-]\s*(\d{1,2})"

    match = re.search(jalali_pattern, text)

    if match:

        year = int(match.group(1))
        month = int(match.group(2))
        day = int(match.group(3))

        jalali_date = jdatetime.date(
            year,
            month,
            day
        )

        gregorian_date = jalali_date.togregorian()

        date_text = match.group(0)

        return gregorian_date, date_text

    return today, None


# --------------------------------
# تشخیص دسته‌بندی
# --------------------------------

def detect_category(text: str):

    categories = {
        "غذا": [
            "غذا",
            "رستوران",
            "ناهار",
            "شام",
            "صبحانه",
            "فست فود",
            "پیتزا",
            "کافه"
        ],

        "حمل و نقل": [
            "تاکسی",
            "اسنپ",
            "تپسی",
            "کرایه",
            "موتور",
            "اتوبوس",
            "مترو"
        ],

        "خودرو": [
            "بنزین",
            "سوخت",
            "تعمیر",
            "کارواش",
            "روغن"
        ],

        "خرید": [
            "خرید",
            "فروشگاه",
            "سوپر",
            "لباس",
            "کفش"
        ],

        "درمان": [
            "دکتر",
            "دارو",
            "داروخانه",
            "پزشک"
        ],

        "قبوض": [
            "برق",
            "آب",
            "گاز",
            "قبض"
        ],

        "موبایل و اینترنت": [
            "اینترنت",
            "شارژ",
            "موبایل",
            "همراه اول",
            "ایرانسل"
        ],

        "آموزش": [
            "کتاب",
            "دوره",
            "آموزش",
            "کلاس"
        ],

        "پوشاک": [
            "لباس",
            "پیراهن",
            "شلوار",
            "کفش"
        ],

        "تفریح": [
            "سینما",
            "بازی",
            "تفریح"
        ],

        "سفر": [
            "هتل",
            "سفر",
            "بلیط",
            "هواپیما"
        ]
    }

    for category, keywords in categories.items():

        for keyword in keywords:

            if keyword in text:
                return category

    return "سایر"


# --------------------------------
# حذف کلمات اضافی از توضیحات
# --------------------------------

def clean_description(text: str):

    words_to_remove = [
        "امروز",
        "دیروز",
        "پریروز",
        "تومان",
        "تومن",
        "هزار",
        "میلیون"
    ]

    result = text

    for word in words_to_remove:
        result = result.replace(word, "")

    # حذف اعداد باقی‌مانده
    result = re.sub(r"\b\d+\b", "", result)

    # حذف کاما
    result = result.replace(",", "")

    # حذف فاصله‌های اضافی
    result = re.sub(r"\s+", " ", result)

    return result.strip()


# --------------------------------
# Parser اصلی
# --------------------------------

def parse_expense_text(text: str):

    # نرمال‌سازی اعداد فارسی
    text = normalize_digits(text)

    # --------------------------------
    # مرحله 1: تاریخ را پیدا کن
    # --------------------------------

    expense_date, date_text = parse_date(text)

    working_text = text

    # تاریخ جلالی را قبل از پیدا کردن مبلغ حذف کن
    if date_text:
        working_text = working_text.replace(
            date_text,
            "",
            1
        )

    # کلمات نسبی تاریخ را هم حذف کن
    for word in ["امروز", "دیروز", "پریروز"]:
        working_text = working_text.replace(word, "")

    # --------------------------------
    # مرحله 2: مبلغ را پیدا کن
    # --------------------------------

    amount, amount_text = parse_amount(working_text)

    if amount is None:
        raise ValueError(
            "مبلغ در متن پیدا نشد."
        )

    # مبلغ را از متن حذف کن
    if amount_text:
        working_text = working_text.replace(
            amount_text,
            "",
            1
        )

    # --------------------------------
    # مرحله 3: دسته‌بندی
    # --------------------------------

    category = detect_category(working_text)

    # --------------------------------
    # مرحله 4: توضیحات
    # --------------------------------

    description = clean_description(working_text)

    if not description:
        description = "هزینه"

    # --------------------------------
    # نتیجه
    # --------------------------------

    return {
        "amount": amount,
        "description": description,
        "category": category,
        "expense_date": expense_date.isoformat()
    }


# --------------------------------
# Test
# --------------------------------

if __name__ == "__main__":

    test_inputs = [
        "امروز 200 هزار تومان کرایه تاکسی",
        "دیروز 350 هزار تومان رستوران",
        "پریروز 100 هزار تومان خرید",
        "173 هزار تومان کرایه موتور",
        "1405/07/14 200 هزار تومان کرایه تاکسی",
        "۱۴۰۵/۰۷/۱۰ ۵۰۰ هزار تومان خرید"
    ]

    for text in test_inputs:

        print("\nINPUT:")
        print(text)

        try:

            result = parse_expense_text(text)

            print("OUTPUT:")
            print(result)

        except Exception as e:

            print("ERROR:")
            print(e)