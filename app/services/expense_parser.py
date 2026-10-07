import re

from datetime import date, timedelta

import jdatetime


# ============================================================
# DIGIT NORMALIZATION
# ============================================================

PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"
ENGLISH_DIGITS = "0123456789"


def normalize_digits(text: str) -> str:

    translation_table = str.maketrans(
        PERSIAN_DIGITS + ARABIC_DIGITS,
        ENGLISH_DIGITS + ENGLISH_DIGITS
    )

    return text.translate(translation_table)


# ============================================================
# TEXT NORMALIZATION
# ============================================================

def normalize_text(text: str) -> str:

    text = text.strip()

    # نیم فاصله
    text = text.replace("\u200c", " ")

    # فاصله‌های اضافی
    text = " ".join(text.split())

    # اعداد فارسی / عربی
    text = normalize_digits(text)

    return text


# ============================================================
# PERSIAN NUMBER WORDS
# ============================================================

ONES = {
    "صفر": 0,
    "یک": 1,
    "یه": 1,
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

TENS = {
    "بیست": 20,
    "سی": 30,
    "چهل": 40,
    "پنجاه": 50,
    "شصت": 60,
    "هفتاد": 70,
    "هشتاد": 80,
    "نود": 90,
}

HUNDREDS = {
    "صد": 100,
    "یکصد": 100,
    "دویست": 200,
    "سیصد": 300,
    "چهارصد": 400,
    "پانصد": 500,
    "ششصد": 600,
    "هفتصد": 700,
    "هشتصد": 800,
    "نهصد": 900,
}


def parse_persian_number_words(text: str):

    text = text.strip()

    if not text:
        return None

    text = text.replace("\u200c", " ")

    tokens = [
        token
        for token in re.split(r"\s+|و", text)
        if token
    ]

    total = 0
    current = 0
    found = False

    for token in tokens:

        token = token.strip()

        if not token:
            continue

        if token in ONES:

            current += ONES[token]
            found = True

        elif token in TENS:

            current += TENS[token]
            found = True

        elif token in HUNDREDS:

            current += HUNDREDS[token]
            found = True

        elif token == "هزار":

            if current == 0:
                current = 1

            total += current * 1_000

            current = 0

            found = True

        elif token == "میلیون":

            if current == 0:
                current = 1

            total += current * 1_000_000

            current = 0

            found = True

        elif token == "میلیارد":

            if current == 0:
                current = 1

            total += current * 1_000_000_000

            current = 0

            found = True

    if not found:
        return None

    return total + current


# ============================================================
# RELATIVE DATE
# ============================================================

def parse_relative_date(text: str):

    """
    پشتیبانی:

    امروز
    دیروز
    پریروز
    فردا
    پس فردا
    پس‌فردا
    """

    normalized = text.replace("\u200c", " ")

    normalized = " ".join(
        normalized.split()
    )

    today = date.today()

    # --------------------------------------------------------
    # مهم:
    # پس فردا باید قبل از فردا بررسی شود.
    # --------------------------------------------------------

    if (
        "پس فردا" in normalized
        or "پس‌فردا" in text
    ):

        return today + timedelta(days=2)

    if "فردا" in normalized:

        return today + timedelta(days=1)

    if "پریروز" in normalized:

        return today - timedelta(days=2)

    if "دیروز" in normalized:

        return today - timedelta(days=1)

    if "امروز" in normalized:

        return today

    return None


# ============================================================
# JALALI DATE
# ============================================================

def parse_jalali_date(text: str):

    text = normalize_digits(text)

    pattern = (
        r"(?<!\d)"
        r"(1[34]\d{2})"
        r"[\/\-.]"
        r"(\d{1,2})"
        r"[\/\-.]"
        r"(\d{1,2})"
        r"(?!\d)"
    )

    match = re.search(
        pattern,
        text
    )

    if not match:
        return None

    year = int(match.group(1))
    month = int(match.group(2))
    day = int(match.group(3))

    try:

        jalali_date = jdatetime.date(
            year,
            month,
            day
        )

        return jalali_date.togregorian()

    except ValueError:

        return None


# ============================================================
# AMOUNT
# ============================================================

def parse_amount(text: str):

    normalized = normalize_text(text)

    # --------------------------------------------------------
    # مثال:
    # 2 میلیون و 500 هزار
    # --------------------------------------------------------

    million_match = re.search(
        r"(?<!\d)(\d[\d,]*)\s*میلیون",
        normalized
    )

    thousand_after_million = re.search(
        r"میلیون\s*(?:و\s*)?(\d[\d,]*)\s*هزار",
        normalized
    )

    if million_match:

        million_value = int(
            million_match.group(1).replace(",", "")
        )

        amount = (
            million_value
            * 1_000_000
        )

        if thousand_after_million:

            thousand_value = int(
                thousand_after_million.group(1)
                .replace(",", "")
            )

            amount += (
                thousand_value
                * 1_000
            )

        return amount

    # --------------------------------------------------------
    # عدد + هزار
    # مثال:
    # 200 هزار
    # --------------------------------------------------------

    thousand_match = re.search(
        r"(?<!\d)(\d[\d,]*)\s*هزار",
        normalized
    )

    if thousand_match:

        value = int(
            thousand_match.group(1)
            .replace(",", "")
        )

        return value * 1_000

    # --------------------------------------------------------
    # عدد معمولی
    # مثال:
    # 2500000
    # 2,500,000
    # --------------------------------------------------------

    numeric_matches = re.findall(
        r"(?<!\d)(\d[\d,]*)(?!\d)",
        normalized
    )

    # تاریخ جلالی را از اعداد حذف می‌کنیم
    for match in numeric_matches:

        value = match.replace(",", "")

        if len(value) == 8 and value.startswith("14"):
            continue

        try:

            number = int(value)

            if number > 0:
                return number

        except ValueError:
            pass

    # --------------------------------------------------------
    # اعداد نوشتاری
    # --------------------------------------------------------

    currency_match = re.search(
        r"(.+?)\s*(?:تومان|تومن|ریال)",
        normalized
    )

    if currency_match:

        amount = parse_persian_number_words(
            currency_match.group(1)
        )

        if amount is not None:
            return amount

    # بدون واحد پول
    amount = parse_persian_number_words(
        normalized
    )

    if amount is not None:
        return amount

    return None


# ============================================================
# CATEGORY
# ============================================================

CATEGORY_KEYWORDS = {

    "غذا": [
        "غذا",
        "رستوران",
        "ناهار",
        "شام",
        "صبحانه",
        "فست فود",
        "پیتزا",
        "برگر",
        "کباب",
        "چلو",
        "ساندویچ",
        "میوه",
        "سیب",
        "موز",
        "پرتقال",
        "گلابی",
        "خوراک",
        "قهوه",
        "چای",
        "کافی"
    ],

    "حمل و نقل": [
        "تاکسی",
        "اسنپ",
        "تپسی",
        "موتور",
        "اتوبوس",
        "مترو",
        "بلیط",
        "کرایه"
    ],

    "خودرو": [
        "ماشین",
        "خودرو",
        "بنزین",
        "تعمیر",
        "روغن",
        "لاستیک",
        "کارواش",
        "باتری",
        "قطعه"
    ],

    "خانه": [
        "خانه",
        "اجاره",
        "لوازم خانه",
        "ظرف",
        "مبل",
        "تعمیرات خانه"
    ],

    "خرید": [
        "خرید",
        "خریدم",
        "خریدم",
        "فروشگاه",
        "سوپر",
        "کالا"
    ],

    "درمان": [
        "دکتر",
        "پزشک",
        "دارو",
        "داروخانه",
        "درمان",
        "بیمارستان",
        "آزمایش",
        "ویزیت"
    ],

    "قبوض": [
        "قبض",
        "برق",
        "آب",
        "گاز",
        "تلفن",
        "عوارض"
    ],

    "موبایل و اینترنت": [
        "موبایل",
        "اینترنت",
        "شارژ",
        "سیم کارت",
        "همراه اول",
        "ایرانسل",
        "رایتل"
    ],

    "آموزش": [
        "آموزش",
        "کلاس",
        "دوره",
        "کتاب",
        "دانشگاه",
        "مدرسه",
        "شهریه"
    ],

    "پوشاک": [
        "لباس",
        "پیراهن",
        "شلوار",
        "کفش",
        "کیف",
        "پوشاک"
    ],

    "تفریح": [
        "تفریح",
        "سینما",
        "بازی",
        "کنسرت",
        "پارک",
        "سرگرمی"
    ],

    "سفر": [
        "سفر",
        "هتل",
        "هواپیما",
        "قطار",
        "رزرو",
        "مسافرت"
    ]
}


def detect_category(text: str):

    normalized = normalize_text(text)

    for category, keywords in CATEGORY_KEYWORDS.items():

        for keyword in keywords:

            if keyword in normalized:
                return category

    return "سایر"


# ============================================================
# DESCRIPTION
# ============================================================

def clean_description(text: str):

    description = normalize_text(text)

    # تاریخ‌های نسبی
    description = re.sub(
        r"\bامروز\b",
        "",
        description
    )

    description = re.sub(
        r"\bدیروز\b",
        "",
        description
    )

    description = re.sub(
        r"\bپریروز\b",
        "",
        description
    )

    description = re.sub(
        r"\bفردا\b",
        "",
        description
    )

    description = re.sub(
        r"پس\s*فردا",
        "",
        description
    )

    # تاریخ جلالی
    description = re.sub(
        r"(?<!\d)"
        r"1[34]\d{2}"
        r"[\/\-.]"
        r"\d{1,2}"
        r"[\/\-.]"
        r"\d{1,2}"
        r"(?!\d)",
        "",
        description
    )

    # اعداد
    description = re.sub(
        r"(?<!\d)\d[\d,]*(?!\d)",
        "",
        description
    )

    # واحد پول
    description = re.sub(
        r"\b(?:تومان|تومن|ریال)\b",
        "",
        description
    )

    # واحدهای مبلغ
    description = re.sub(
        r"\b(?:هزار|میلیون|میلیارد)\b",
        "",
        description
    )

    # اعداد نوشتاری
    number_words = (
        list(ONES.keys())
        + list(TENS.keys())
        + list(HUNDREDS.keys())
    )

    for word in sorted(
        number_words,
        key=len,
        reverse=True
    ):

        description = re.sub(
            rf"\b{re.escape(word)}\b",
            "",
            description
        )

    # فاصله‌های اضافی
    description = " ".join(
        description.split()
    )

    return description.strip()


# ============================================================
# MAIN PARSER
# ============================================================

def parse_expense(text: str):

    if not text or not text.strip():

        return {
            "amount": None,
            "description": "",
            "category": "سایر",
            "expense_date": date.today().isoformat()
        }

    original_text = text

    normalized = normalize_text(
        original_text
    )

    # --------------------------------------------------------
    # DATE
    # --------------------------------------------------------

    relative_date = parse_relative_date(
        original_text
    )

    if relative_date is not None:

        expense_date = relative_date

    else:

        jalali_date = parse_jalali_date(
            normalized
        )

        if jalali_date is not None:

            expense_date = jalali_date

        else:

            expense_date = date.today()

    # --------------------------------------------------------
    # AMOUNT
    # --------------------------------------------------------

    amount = parse_amount(
        normalized
    )

    # --------------------------------------------------------
    # CATEGORY
    # --------------------------------------------------------

    category = detect_category(
        normalized
    )

    # --------------------------------------------------------
    # DESCRIPTION
    # --------------------------------------------------------

    description = clean_description(
        normalized
    )

    if not description:

        description = normalized

    # --------------------------------------------------------
    # RESULT
    # --------------------------------------------------------

    return {
        "amount": amount,
        "description": description,
        "category": category,
        "expense_date": expense_date.isoformat()
    }


# ============================================================
# COMPATIBILITY WITH expenses.py
# ============================================================

def parse_expense_text(text: str):

    return parse_expense(text)


# ============================================================
# LOCAL TEST
# ============================================================

if __name__ == "__main__":

    test_cases = [

        "امروز 200 هزار تومان کرایه تاکسی",

        "دیروز 350 هزار تومان رستوران",

        "پریروز 100 هزار تومان خرید",

        "فردا 200 هزار تومان سیب",

        "پس فردا 300 هزار تومان سیب",

        "پس‌فردا 400 هزار تومان گلابی",

        "1405/07/14 200 هزار تومان کرایه تاکسی",

        "۱۴۰۵/۰۷/۱۰ ۵۰۰ هزار تومان خرید",

        "1 میلیون و 200 هزار تومان رستوران",

        "2,500,000 تومان تعمیر ماشین",

        "پنجاه هزار تومان تاکسی",

        "سیصد و پنجاه هزار تومان خرید",

        "یک میلیون و دویست هزار تومان رستوران",

        "پس فردا سیب میخرم"
    ]

    print("=" * 70)

    for text in test_cases:

        print()
        print("INPUT:")
        print(text)

        print("RESULT:")

        print(
            parse_expense_text(text)
        )

    print()
    print("=" * 70)