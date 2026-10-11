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

    # یکسان‌سازی حروف عربی و فارسی
    text = text.replace("ي", "ی").replace("ك", "ک")

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
        for token in re.split(r"\s+و\s+|\s+", text)
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

    if( "پریروز" in normalized or    "پری روز" in text):

        return today - timedelta(days=2)

    if ("دیروز" in normalized or "دی روز" in text):

        return today - timedelta(days=1)

    if( "امروز" in normalized or  "ام روز" in text):

        return today

    return None


# ============================================================
# JALALI DATE
# ============================================================

JALALI_MONTHS = {
    "فروردین": 1,
    "اردیبهشت": 2,
    "خرداد": 3,
    "تیر": 4,
    "مرداد": 5,
    "شهریور": 6,
    "مهر": 7,
    "آبان": 8,
    "آذر": 9,
    "دی": 10,
    "بهمن": 11,
    "اسفند": 12,
}

# روزهای تقویم به شکل عددی، شمارشی و ترتیبی فارسی.
# پشتیبانی از نمونه‌هایی مانند: 3 مهر، سه مهر، سوم مهر، بیست و سوم مهر، سی و یکم مهر.
JALALI_DAY_ORDINALS = {
    "اول": 1, "اولین": 1, "یکم": 1,
    "دوم": 2,
    "سوم": 3,
    "چهارم": 4,
    "پنجم": 5,
    "ششم": 6,
    "هفتم": 7,
    "هشتم": 8,
    "نهم": 9,
    "دهم": 10,
    "یازدهم": 11,
    "دوازدهم": 12,
    "سیزدهم": 13,
    "چهاردهم": 14,
    "پانزدهم": 15,
    "شانزدهم": 16,
    "هفدهم": 17,
    "هجدهم": 18,
    "نوزدهم": 19,
    "بیستم": 20,
    "بیست و یکم": 21,
    "بیست و دوم": 22,
    "بیست و سوم": 23,
    "بیست و چهارم": 24,
    "بیست و پنجم": 25,
    "بیست و ششم": 26,
    "بیست و هفتم": 27,
    "بیست و هشتم": 28,
    "بیست و نهم": 29,
    "سی ام": 30,
    "سی‌ام": 30,
    "سی و یکم": 31,
}

# صورت‌های شمارشی روز برای مواردی مانند «سه مهر» نیز پشتیبانی می‌شوند.
JALALI_DAY_WORDS = [
    "سی و یک", "بیست و نه", "بیست و هشت", "بیست و هفت",
    "بیست و شش", "بیست و پنج", "بیست و چهار", "بیست و سه",
    "بیست و دو", "بیست و یک", "بیست", "سی",
    "نوزده", "هجده", "هفده", "شانزده", "پانزده", "چهارده",
    "سیزده", "دوازده", "یازده", "ده", "نه", "هشت", "هفت",
    "شش", "پنج", "چهار", "سه", "دو", "یک", "یه",
]

_ALL_DAY_WORDS = sorted(
    set(JALALI_DAY_WORDS) | set(JALALI_DAY_ORDINALS.keys()),
    key=len,
    reverse=True,
)
_DAY_WORD_PATTERN = "(?:" + "|".join(
    re.escape(word) for word in _ALL_DAY_WORDS
) + ")"
_DAY_PATTERN = rf"(?:\d{{1,2}}|{_DAY_WORD_PATTERN})(?:\s*ام)?"
_MONTH_PATTERN = "(?:" + "|".join(
    re.escape(month) for month in sorted(JALALI_MONTHS, key=len, reverse=True)
) + ")"
_YEAR_PATTERN = r"(?:13\d{2}|14\d{2})"

# سال اختیاری است. اگر نوشته نشود، سال شمسی جاری در نظر گرفته می‌شود.
# پشتیبانی:
#   3 مهر 1405 / سه مهر 1405 / سوم مهر 1405
#   سوم مهر / 3 مهر / روز سوم مهر
#   مهر سوم 1405 / 1405 مهر سوم
NAMED_JALALI_DATE_PATTERNS = [
    re.compile(
        rf"(?<!\w)(?:روز\s+)?(?P<day>{_DAY_PATTERN})\s+"
        rf"(?:ماه\s+)?(?P<month>{_MONTH_PATTERN})(?:\s+ماه)?"
        rf"(?:\s+(?P<year>{_YEAR_PATTERN}))?(?!\w)"
    ),
    re.compile(
        rf"(?<!\w)(?P<month>{_MONTH_PATTERN})\s+"
        rf"(?P<day>{_DAY_PATTERN})(?:\s+(?P<year>{_YEAR_PATTERN}))?(?!\w)"
    ),
    re.compile(
        rf"(?<!\d)(?P<year>{_YEAR_PATTERN})\s+(?P<month>{_MONTH_PATTERN})\s+"
        rf"(?P<day>{_DAY_PATTERN})(?!\w)"
    ),
]

NUMERIC_JALALI_DATE_PATTERN = re.compile(
    r"(?<!\d)(1[34]\d{2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{1,2})(?!\d)"
)


def _jalali_day_number(value: str):
    value = normalize_text(value.strip())
    value = re.sub(r"\s*ام$", "", value)

    if value.isdigit():
        return int(value)

    if value in JALALI_DAY_ORDINALS:
        return JALALI_DAY_ORDINALS[value]

    return parse_persian_number_words(value)


def _named_jalali_match(text: str):
    normalized = normalize_text(text)
    for pattern in NAMED_JALALI_DATE_PATTERNS:
        match = pattern.search(normalized)
        if match:
            return match
    return None


def has_explicit_jalali_date(text: str) -> bool:
    normalized = normalize_text(text)
    if NUMERIC_JALALI_DATE_PATTERN.search(normalized):
        return True
    return _named_jalali_match(normalized) is not None


def parse_jalali_date(text: str):
    normalized = normalize_text(text)

    match = NUMERIC_JALALI_DATE_PATTERN.search(normalized)
    if match:
        year, month, day = map(int, match.groups())
        try:
            return jdatetime.date(year, month, day).togregorian()
        except ValueError:
            return None

    match = _named_jalali_match(normalized)
    if not match:
        return None

    year_text = match.groupdict().get("year")
    if year_text:
        year = int(year_text)
    else:
        # تبدیل تاریخ امروز میلادی به سال شمسی جاری.
        year = jdatetime.date.fromgregorian(date=date.today()).year

    month_name = match.group("month")
    month = JALALI_MONTHS.get(month_name)
    day = _jalali_day_number(match.group("day"))

    if month is None or day is None:
        return None

    try:
        return jdatetime.date(year, month, day).togregorian()
    except (ValueError, TypeError):
        return None


def remove_date_expressions(text: str) -> str:
    """حذف تاریخ از متن تا اجزای تاریخ وارد مبلغ یا شرح هزینه نشوند."""
    result = normalize_text(text)

    result = NUMERIC_JALALI_DATE_PATTERN.sub(" ", result)

    for pattern in NAMED_JALALI_DATE_PATTERNS:
        result = pattern.sub(" ", result)

    relative_patterns = [
        r"پس\s*فردا", r"پری\s*روز", r"دی\s*روز", r"فردا", r"ام\s*روز"
    ]
    for pattern in relative_patterns:
        result = re.sub(pattern, " ", result)

    # تمیزکاری مواردی مانند «ماه سوم مهر» پس از حذف تاریخ.
    result = re.sub(r"(?<!\w)ماه(?!\w)", " ", result)
    return " ".join(result.split())


# ============================================================
# AMOUNT
# ============================================================


def _parse_numeric_amount_prefix(text: str):
    """استخراج عددی که در ابتدای عبارت مبلغ قرار دارد."""
    value_text = text.strip().lstrip(":：=،,؛; ")
    if not value_text:
        return None

    # 2 میلیون و 500 هزار
    combo = re.match(
        r"^(\d[\d,]*)\s*میلیون(?:\s*و\s*(\d[\d,]*)\s*هزار)?",
        value_text,
    )
    if combo:
        amount = int(combo.group(1).replace(",", "")) * 1_000_000
        if combo.group(2):
            amount += int(combo.group(2).replace(",", "")) * 1_000
        return amount

    match = re.match(r"^(\d[\d,]*)\s*(میلیارد|میلیون|هزار)?", value_text)
    if not match:
        return None

    number = int(match.group(1).replace(",", ""))
    scale = match.group(2)
    multiplier = {None: 1, "هزار": 1_000, "میلیون": 1_000_000, "میلیارد": 1_000_000_000}[scale]
    amount = number * multiplier

    # اگر عدد به صورت "2 میلیون و 500 هزار" نوشته شده باشد، بخش هزارم را هم لحاظ کن.
    rest = value_text[match.end():]
    if scale == "میلیون":
        extra = re.match(r"\s*و\s*(\d[\d,]*)\s*هزار", rest)
        if extra:
            amount += int(extra.group(1).replace(",", "")) * 1_000

    return amount


def _parse_written_amount_prefix(text: str):
    """خواندن عدد نوشتاری از ابتدای متن؛ متن توضیحی بعد از آن نادیده گرفته می‌شود."""
    words = normalize_text(text).split()
    accepted = set(ONES) | set(TENS) | set(HUNDREDS) | {"هزار", "میلیون", "میلیارد", "و"}
    candidate = []
    found_number = False

    for word in words:
        clean_word = word.strip("،,؛;:()[]")
        if clean_word in accepted:
            candidate.append(clean_word)
            if clean_word != "و" and clean_word not in {"هزار", "میلیون", "میلیارد"}:
                found_number = True
        else:
            break

    if not candidate or not found_number:
        return None
    return parse_persian_number_words(" ".join(candidate))


def parse_amount(text: str):
    normalized = normalize_text(text)
    # مهم: ابتدا تاریخ را کامل حذف می‌کنیم تا روز و سال به‌عنوان مبلغ انتخاب نشوند.
    amount_text = remove_date_expressions(normalized)

    # 1) اولویت اول: مبلغی که صریحاً بعد از «مبلغ» آمده است.
    label_match = re.search(r"(?:به\s*)?مبلغ\s*[:：=]?\s*(.*)$", amount_text)
    if label_match:
        tail = label_match.group(1).strip()
        amount = _parse_numeric_amount_prefix(tail)
        if amount is not None and amount > 0:
            return amount
        amount = _parse_written_amount_prefix(tail)
        if amount is not None and amount > 0:
            return amount

    # 2) مبالغ ترکیبی؛ مانند 2 میلیون و 500 هزار.
    combo = re.search(
        r"(?<!\d)(\d[\d,]*)\s*میلیون(?:\s*و\s*(\d[\d,]*)\s*هزار)?",
        amount_text,
    )
    if combo:
        amount = int(combo.group(1).replace(",", "")) * 1_000_000
        if combo.group(2):
            amount += int(combo.group(2).replace(",", "")) * 1_000
        return amount

    # 3) مبلغ عددی همراه واحد پول؛ مانند 250000 تومان یا 200 هزار تومان.
    currency_numeric = re.search(
        r"(?<!\d)(\d[\d,]*)\s*(میلیارد|میلیون|هزار)?\s*(?:تومان|تومن|ریال)(?!\w)",
        amount_text,
    )
    if currency_numeric:
        amount = _parse_numeric_amount_prefix(currency_numeric.group(0))
        if amount is not None and amount > 0:
            return amount

    # 4) مقدار عددی همراه «هزار»، «میلیون» یا «میلیارد».
    scaled = re.search(r"(?<!\d)(\d[\d,]*)\s*(میلیارد|میلیون|هزار)", amount_text)
    if scaled:
        amount = _parse_numeric_amount_prefix(scaled.group(0))
        if amount is not None and amount > 0:
            return amount

    # 5) مبلغ نوشتاری با واحد پول؛ مانند «پنجاه هزار تومان».
    currency_word = re.search(r"(.+?)\s*(?:تومان|تومن|ریال)(?!\w)", amount_text)
    if currency_word:
        # اگر عبارت شامل ارقام باشد، آخرین عدد قبل از واحد پول را ترجیح بده.
        numeric_before_currency = re.search(
            r"(\d[\d,]*)(?:\s*(?:میلیارد|میلیون|هزار))?\s*$",
            currency_word.group(1),
        )
        if numeric_before_currency:
            amount = _parse_numeric_amount_prefix(numeric_before_currency.group(0))
            if amount is not None and amount > 0:
                return amount

        amount = parse_persian_number_words(currency_word.group(1))
        if amount is not None and amount > 0:
            return amount

    # 6) بدون برچسب/واحد: اولین عدد باقی‌مانده بعد از حذف تاریخ.
    numeric_matches = re.findall(r"(?<!\d)(\d[\d,]*)(?!\d)", amount_text)
    for match in numeric_matches:
        try:
            number = int(match.replace(",", ""))
            if number > 0:
                return number
        except ValueError:
            continue

    # پشتیبانی از عدد نوشتاری دارای مقیاس پولی، حتی اگر واحد تومان ذکر نشده باشد.
    written_scaled = re.search(
        r"((?:[\wآ-ی]+\s+)*(?:هزار|میلیون|میلیارد)(?:\s+و\s+[\wآ-ی]+\s+هزار)?)",
        amount_text,
    )
    if written_scaled:
        amount = parse_persian_number_words(written_scaled.group(1))
        if amount is not None and amount > 0:
            return amount

    # برای متن‌هایی که فقط یک عبارت عددی نوشتاری دارند.
    amount = _parse_written_amount_prefix(amount_text)
    if amount is not None and amount > 0:
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
    description = remove_date_expressions(text)

    # برچسب مبلغ را حذف می‌کنیم، نه خود شرح را.
    description = re.sub(r"(?:به\s*)?مبلغ", " ", description)

    # اعداد و جداکننده‌های عددی مبلغ
    description = re.sub(r"(?<!\d)\d[\d,]*(?!\d)", " ", description)

    # واحد پول و واحدهای مقیاس مبلغ
    description = re.sub(
        r"(?<!\w)(?:تومان|تومن|ریال|هزار|میلیون|میلیارد)(?!\w)",
        " ",
        description,
    )

    # اعداد نوشتاری‌ای که برای بیان مبلغ استفاده شده‌اند.
    number_words = list(ONES.keys()) + list(TENS.keys()) + list(HUNDREDS.keys())
    for word in sorted(number_words, key=len, reverse=True):
        description = re.sub(rf"(?<!\w){re.escape(word)}(?!\w)", " ", description)

    description = re.sub(r"\s+و\s+", " ", description)
    description = re.sub(r"\s+", " ", description)
    description = description.strip(" \t\r\n،,؛;:.-")
    return description


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
        elif has_explicit_jalali_date(normalized):
            raise ValueError("تاریخ جلالی واردشده معتبر نیست. روز، ماه و سال را بررسی کنید.")
        else:
            expense_date = date.today()

    # --------------------------------------------------------
    # AMOUNT
    # --------------------------------------------------------

    amount = parse_amount(
        normalized
    )

    # --------------------------------------------------------
    # DESCRIPTION
    # --------------------------------------------------------

    description = clean_description(
        normalized
    )

    # تشخیص دسته‌بندی از شرحِ پاک‌سازی‌شده انجام می‌شود تا کلماتی مثل «مبلغ»
    # به‌اشتباه با کلیدواژه‌هایی مثل «مبل» تطبیق پیدا نکنند.
    category = detect_category(
        description or normalized
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

        "سوم مهر چیپس خریدم به مبلغ 240000",

        "سه مهر 1405 چیپس خریدم به مبلغ 240000",

        "روز بیست و سوم مهر چیپس خریدم به مبلغ 240000",

        "اول مهر خرید به مبلغ 50000",

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