"""Database-backed category item catalog and background preparation.

The first version uses curated local templates. Unknown category names receive
safe generic starter items; an external AI/provider can be plugged in later
without changing the database contract or the expense parser API.
"""
from __future__ import annotations

import re
from typing import Iterable

from app.database import get_connection


_NORMALIZE_TRANSLATION = str.maketrans({"ي": "ی", "ك": "ک", "ۀ": "ه", "ة": "ه"})


def normalize_catalog_text(value: str | None) -> str:
    value = (value or "").translate(_NORMALIZE_TRANSLATION).replace("\u200c", " ").lower()
    value = re.sub(r"[\u064b-\u065f\u0670]", "", value)
    value = re.sub(r"[^\w\s]", " ", value, flags=re.UNICODE)
    return " ".join(value.split())


def _item(name: str, *aliases: str) -> tuple[str, list[str]]:
    """Create one canonical item with alternate user phrases."""
    values = []
    seen = set()
    for value in (name, *aliases):
        normalized = normalize_catalog_text(value)
        if normalized and normalized not in seen:
            seen.add(normalized)
            values.append(value.strip())
    return name.strip(), values


CATALOG_TEMPLATES: dict[str, list[tuple[str, list[str]]]] = {
    "restaurant": [
        _item("چلوکباب کوبیده", "چلو کباب کوبیده", "کباب کوبیده", "کوبیده"),
        _item("کباب برگ", "برگ کباب"), _item("جوجه کباب", "جوجه‌کباب", "جوجه"),
        _item("کباب بختیاری", "بختیاری"), _item("شیشلیک"), _item("کباب سلطانی", "سلطانی"),
        _item("کباب لقمه", "لقمه"), _item("کباب ترش"), _item("کباب چنجه", "چنجه"),
        _item("زرشک پلو با مرغ", "زرشک پلو", "زرشک‌پلو"), _item("باقالی پلو با گوشت", "باقالی پلو", "باقالی‌پلو"),
        _item("چلو مرغ", "چلو مرغ زعفرانی"), _item("مرغ سوخاری", "سوخاری"),
        _item("قورمه سبزی", "قرمه سبزی", "قورمه‌سبزی"), _item("قیمه", "خورشت قیمه"),
        _item("فسنجان", "خورشت فسنجان"), _item("قیمه نثار"), _item("عدس پلو", "عدس‌پلو"),
        _item("لوبیا پلو", "لوبیاپلو"), _item("سبزی پلو با ماهی", "سبزی پلو", "سبزی‌پلو"),
        _item("ته چین", "ته‌چین"), _item("آلبالو پلو", "آلبالوپلو"), _item("استانبولی پلو", "استانبولی"),
        _item("ماهی کبابی", "ماهی سرخ شده", "ماهی"), _item("میگو پلو", "میگو"),
        _item("دیزی", "آبگوشت"), _item("کشک بادمجان"), _item("میرزاقاسمی", "میرزا قاسمی"),
        _item("خوراک جوجه"), _item("استیک", "استیک گوشت"), _item("همبرگر", "برگر"),
        _item("چیزبرگر"), _item("پیتزا", "پیتزا مخلوط", "پیتزا پپرونی"), _item("پاستا", "ماکارونی رستورانی"),
        _item("لازانیا"), _item("ساندویچ مرغ"), _item("ساندویچ ژامبون", "ژامبون"),
        _item("هات داگ", "هات‌داگ"), _item("فلافل"), _item("سمبوسه"), _item("دنر", "دونر کباب", "کباب ترکی"),
        _item("بندری", "ساندویچ بندری"), _item("جوجه چینی"), _item("سالاد سزار"),
        _item("سالاد فصل"), _item("سالاد شیرازی"), _item("سوپ", "سوپ روز"), _item("آش رشته"),
        _item("املت", "املت گوجه"), _item("نیمرو"), _item("صبحانه رستوران"), _item("منوی روز"),
        _item("غذای بیرون بر", "غذای بیرون‌بر", "بیرون بر"), _item("سفارش غذا", "سفارش آنلاین غذا"),
        _item("حق سرویس", "سرویس رستوران"), _item("بسته بندی غذا", "بسته‌بندی غذا"),
        _item("نوشیدنی رستوران", "نوشیدنی"), _item("چای رستوران"), _item("قهوه رستوران"),
        _item("دسر", "کیک دسر"), _item("بستنی رستوران"),
    ],
    "supermarket": [
        _item("آب معدنی", "آب"), _item("آبمیوه"), _item("نوشابه"), _item("دوغ"), _item("شیر"),
        _item("ماست"), _item("پنیر"), _item("خامه"), _item("کره"), _item("تخم مرغ", "تخم‌مرغ"),
        _item("نان"), _item("بیسکویت"), _item("ویفر"), _item("کیک"), _item("کلوچه"), _item("شکلات"),
        _item("آبنبات"), _item("پاستیل"), _item("چیپس"), _item("پفک"), _item("پاپ کورن", "پاپ‌کورن"),
        _item("آجیل"), _item("تخمه"), _item("برنج"), _item("ماکارونی"), _item("رشته سوپ"),
        _item("روغن مایع"), _item("روغن جامد"), _item("روغن زیتون"), _item("رب گوجه فرنگی", "رب گوجه"),
        _item("سس مایونز"), _item("سس کچاپ"), _item("نمک"), _item("فلفل سیاه"), _item("زردچوبه"),
        _item("آویشن"), _item("زعفران"), _item("عدس"), _item("لوبیا قرمز"), _item("لوبیا چیتی"),
        _item("نخود"), _item("لپه"), _item("سویا"), _item("تن ماهی"), _item("کنسرو لوبیا"),
        _item("کنسرو ذرت"), _item("مربا"), _item("عسل"), _item("حلوا شکری"), _item("ارده"),
        _item("شیره خرما"), _item("شکر"), _item("قند"), _item("خرما"), _item("کشمش"), _item("لواشک"),
        _item("ترشک"), _item("خیارشور"), _item("زیتون"), _item("رشته آش"), _item("سوپ آماده"),
        _item("پودر ژله"), _item("پودر کیک"), _item("کنسرو نخود فرنگی"), _item("کنسرو قارچ"),
        _item("سرکه"), _item("آبلیمو"), _item("آبغوره"), _item("پیاز داغ آماده"), _item("بستنی"),
        _item("دستمال کاغذی"), _item("مایع ظرفشویی"), _item("پودر لباسشویی"), _item("شامپو"),
        _item("خمیردندان"), _item("مسواک"), _item("کیسه زباله"), _item("باتری قلمی"),
    ],
    "transport": [
        _item("تاکسی"), _item("اسنپ"), _item("تپسی"), _item("کرایه وانت", "وانت"),
        _item("اتوبوس"), _item("مترو"), _item("بلیط اتوبوس"), _item("بلیط مترو"),
        _item("بلیط قطار"), _item("بلیط هواپیما"), _item("تاکسی اینترنتی"), _item("پارکینگ"),
        _item("عوارض جاده"), _item("عوارض آزادراه"), _item("کرایه باربری", "باربری"),
        _item("دوچرخه اشتراکی"), _item("اجاره خودرو"),
    ],
    "vehicle": [
        _item("بنزین"), _item("تعویض روغن"), _item("روغن موتور"), _item("کارواش"), _item("تعمیر خودرو"),
        _item("لاستیک"), _item("باتری خودرو"), _item("لنت ترمز"), _item("فیلتر هوا"), _item("فیلتر روغن"),
        _item("بیمه شخص ثالث"), _item("بیمه بدنه"), _item("معاینه فنی"), _item("قطعه خودرو"),
        _item("مکانیکی"), _item("پنچرگیری"), _item("باتری به باتری"), _item("شستشوی خودرو"),
    ],
    "home": [
        _item("اجاره خانه"), _item("شارژ ساختمان"), _item("تعمیرات خانه"), _item("لوازم خانه"),
        _item("مبل"), _item("میز و صندلی"), _item("ظرف"), _item("وسایل آشپزخانه"), _item("لامپ"),
        _item("لوازم نظافت"), _item("نظافت منزل"), _item("تعمیر شیر آب"), _item("تعمیر برق"),
        _item("تعمیر کولر"), _item("تعمیر پکیج"), _item("خدمات لوله کشی", "لوله کشی"),
        _item("خدمات برقکاری", "برقکاری"), _item("قفل و کلید"),
    ],
    "health": [
        _item("ویزیت پزشک"), _item("دارو"), _item("داروخانه"), _item("آزمایش خون"), _item("آزمایشگاه"),
        _item("دندانپزشکی"), _item("عینک"), _item("فیزیوتراپی"), _item("تصویربرداری"),
        _item("بیمه درمان"), _item("بستری بیمارستان"), _item("تزریقات"), _item("پانسمان"),
    ],
    "bills": [
        _item("قبض برق"), _item("قبض آب"), _item("قبض گاز"), _item("قبض تلفن ثابت"),
        _item("قبض موبایل"), _item("قبض اینترنت"), _item("عوارض شهرداری"), _item("مالیات"),
        _item("جریمه رانندگی"), _item("هزینه پست"),
    ],
    "mobile_internet": [
        _item("شارژ موبایل"), _item("بسته اینترنت"), _item("اینترنت خانگی"), _item("مودم"),
        _item("سیم کارت"), _item("خرید گوشی"), _item("لوازم جانبی موبایل"), _item("گلس گوشی"),
        _item("قاب گوشی"), _item("تعمیر موبایل"), _item("اشتراک نرم افزار"),
    ],
    "education": [
        _item("شهریه مدرسه"), _item("شهریه دانشگاه"), _item("کلاس زبان"), _item("کلاس آموزشی"),
        _item("کتاب درسی"), _item("کتاب"), _item("لوازم التحریر"), _item("دفتر"), _item("خودکار"),
        _item("مداد"), _item("کیف مدرسه"), _item("هزینه آزمون"), _item("دوره آنلاین"),
    ],
    "clothing": [
        _item("لباس"), _item("پیراهن"), _item("شلوار"), _item("کفش"), _item("کیف"), _item("مانتو"),
        _item("کت و شلوار"), _item("لباس ورزشی"), _item("جوراب"), _item("لباس زیر"), _item("خیاطی"),
        _item("تعمیر کفش"), _item("خشکشویی"),
    ],
    "entertainment": [
        _item("سینما"), _item("بازی"), _item("کنسرت"), _item("پارک"), _item("استخر"), _item("باشگاه"),
        _item("بازی کامپیوتری"), _item("اشتراک بازی"), _item("تفریح خانوادگی"), _item("موزه"),
        _item("بلیت نمایش"), _item("بولینگ"),
    ],
    "travel": [
        _item("هتل"), _item("اقامتگاه"), _item("رزرو بلیت"), _item("بلیت هواپیما"), _item("بلیت قطار"),
        _item("تور مسافرتی"), _item("اجاره ویلا"), _item("عوارض جاده"), _item("سوغات"),
        _item("بیمه مسافرتی"), _item("ویزای سفر"), _item("بار اضافه"), _item("حمل و نقل سفر"),
    ],
}


_TEMPLATE_ALIASES = [
    ("supermarket", ["سوپرمارکت", "سوپر مارکت", "خواربار", "خواروبار", "مواد غذایی", "فروشگاه مواد غذایی"]),
    ("restaurant", ["رستوران", "غذا", "غذاخوری", "فست فود", "فستفود", "اغذیه", "کترینگ", "غذای بیرون بر"]),
    ("transport", ["حمل و نقل", "رفت و آمد", "رفت وآمد", "تاکسی", "وانت", "باربری", "کرایه"]),
    ("vehicle", ["خودرو", "ماشین", "تعمیرگاه", "قطعات خودرو", "لوازم خودرو"]),
    ("home", ["خانه", "لوازم خانه", "اثاثیه", "وسایل منزل", "تعمیرات منزل"]),
    ("health", ["درمان", "سلامت", "پزشکی", "داروخانه", "بیمارستان"]),
    ("bills", ["قبوض", "قبض", "عوارض", "پرداخت های ماهانه"]),
    ("mobile_internet", ["موبایل", "اینترنت", "مخابرات", "تلفن همراه"]),
    ("education", ["آموزش", "تحصیل", "مدرسه", "دانشگاه", "لوازم التحریر"]),
    ("clothing", ["پوشاک", "لباس", "کفش و لباس"]),
    ("entertainment", ["تفریح", "سرگرمی", "ورزش", "فرهنگ"]),
    ("travel", ["سفر", "مسافرت", "گردشگری", "هتل"]),
]


def _resolve_template(category_name: str) -> str | None:
    normalized = normalize_catalog_text(category_name)
    for template_key, aliases in _TEMPLATE_ALIASES:
        for alias in aliases:
            alias_n = normalize_catalog_text(alias)
            if normalized == alias_n or f" {alias_n} " in f" {normalized} ":
                return template_key
    return None


def build_catalog_items(category_name: str) -> tuple[list[tuple[str, str]], str, str]:
    """Return (canonical name, pipe-separated aliases), kind, user-facing message."""
    template_key = _resolve_template(category_name)
    if template_key:
        source = CATALOG_TEMPLATES[template_key]
        result: list[tuple[str, str]] = []
        seen: set[str] = set()
        for name, aliases in source:
            normalized = normalize_catalog_text(name)
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            other_aliases = [a for a in aliases if normalize_catalog_text(a) != normalized]
            result.append((name, "|".join(other_aliases)[:1900]))
        return result, "TEMPLATE", "فهرست اقلام پیشنهادی از الگوی داخلی آماده شد."

    # For an unseen category, create a small, honest starter catalog rather than
    # pretend that an exhaustive category list was generated.
    generic_names = [
        category_name.strip(),
        f"خرید {category_name.strip()}",
        f"خدمات {category_name.strip()}",
        f"هزینه {category_name.strip()}",
        f"{category_name.strip()} متفرقه",
    ]
    result = []
    seen = set()
    for name in generic_names:
        normalized = normalize_catalog_text(name)
        if normalized and normalized not in seen:
            seen.add(normalized)
            result.append((name, ""))
    return result, "GENERIC", "فهرست پایه آماده شد؛ برای این نام هنوز الگوی تخصصی تعریف نشده است."


def _phrase_in_text(text: str, phrase: str) -> bool:
    if not text or not phrase:
        return False
    padded_text = f" {text} "
    padded_phrase = f" {phrase} "
    return padded_phrase in padded_text


def detect_category_from_catalog(text: str) -> str | None:
    """Match description against the active DB catalog; safe if SQL wasn't installed yet."""
    normalized_text = normalize_catalog_text(text)
    if not normalized_text:
        return None

    connection = None
    try:
        connection = get_connection()
        cursor = connection.cursor()

        # Directly mentioned specific category names are useful, but catalog item
        # matches still work when users don't name the category explicitly.
        cursor.execute(
            """SELECT CATEGORY_NAME FROM EXP_CATEGORIES WHERE IS_ACTIVE = 1"""
        )
        category_names = [str(row[0]) for row in cursor.fetchall() if row[0]]

        cursor.execute(
            """SELECT c.CATEGORY_NAME, i.ITEM_NAME, i.KEYWORDS
                 FROM EXP_CATEGORY_ITEMS i
                 JOIN EXP_CATEGORIES c ON c.CATEGORY_ID = i.CATEGORY_ID
                WHERE i.IS_ACTIVE = 1 AND c.IS_ACTIVE = 1"""
        )
        rows = cursor.fetchall()

        best_item: tuple[int, int, str] | None = None
        generic_category_names = {"غذا", "خرید", "سایر", "خانه", "تفریح", "سفر"}
        for category_name, item_name, keywords in rows:
            candidate_phrases = [str(item_name or "")]
            if keywords:
                keyword_text = keywords.read() if hasattr(keywords, "read") else str(keywords)
                candidate_phrases.extend(keyword_text.split("|"))
            for phrase in candidate_phrases:
                normalized_phrase = normalize_catalog_text(phrase)
                if normalized_phrase and _phrase_in_text(normalized_text, normalized_phrase):
                    score = len(normalized_phrase)
                    category_normalized = normalize_catalog_text(str(category_name))
                    specificity = 0 if category_normalized in generic_category_names else 1
                    candidate = (score, specificity, str(category_name))
                    if best_item is None or candidate[:2] > best_item[:2]:
                        best_item = candidate

        best_category: tuple[int, str] | None = None
        for category_name in category_names:
            normalized_category = normalize_catalog_text(category_name)
            if normalized_category and normalized_category not in generic_category_names and _phrase_in_text(normalized_text, normalized_category):
                score = len(normalized_category) + 10
                if best_category is None or score > best_category[0]:
                    best_category = (score, str(category_name))

        # Explicit category mention can win; otherwise the longest item/alias is
        # the most specific match. This keeps "ماست" mapped to supermarket, while
        # "ناهار در رستوران" can use the explicit restaurant category.
        if best_category and (best_item is None or best_category[0] >= best_item[0]):
            return best_category[1]
        return best_item[2] if best_item else None

    except Exception as exc:
        # This lookup must not break ordinary expense entry if the catalog tables
        # have not been created yet. Log the issue for the developer.
        print(f"CATEGORY CATALOG LOOKUP WARNING: {exc}")
        return None
    finally:
        if connection is not None:
            connection.close()


def prepare_category_catalog(job_id: int, category_id: int, category_name: str) -> None:
    """Background task: idempotently seed one category then mark the job complete."""
    connection = None
    try:
        connection = get_connection()
        cursor = connection.cursor()
        cursor.execute(
            """UPDATE EXP_CATEGORY_CATALOG_JOBS
                  SET STATUS = 'RUNNING', STARTED_AT = SYSTIMESTAMP,
                      ERROR_MESSAGE = NULL
                WHERE JOB_ID = :job_id""",
            {"job_id": job_id},
        )
        connection.commit()

        items, catalog_kind, message = build_catalog_items(category_name)
        for item_name, keywords in items:
            normalized_name = normalize_catalog_text(item_name)
            if not normalized_name:
                continue
            cursor.execute(
                """MERGE INTO EXP_CATEGORY_ITEMS target
                   USING (SELECT :category_id AS CATEGORY_ID,
                                 :item_name AS ITEM_NAME,
                                 :normalized_name AS NORMALIZED_NAME,
                                 :keywords AS KEYWORDS,
                                 :source_type AS SOURCE_TYPE
                            FROM DUAL) source
                      ON (target.CATEGORY_ID = source.CATEGORY_ID
                          AND target.NORMALIZED_NAME = source.NORMALIZED_NAME)
                    WHEN MATCHED THEN UPDATE SET
                         target.KEYWORDS = CASE WHEN target.SOURCE_TYPE = 'USER'
                                                THEN target.KEYWORDS ELSE source.KEYWORDS END,
                         target.SOURCE_TYPE = CASE WHEN target.SOURCE_TYPE = 'USER'
                                                   THEN target.SOURCE_TYPE ELSE source.SOURCE_TYPE END,
                         target.IS_ACTIVE = 1
                    WHEN NOT MATCHED THEN INSERT
                         (CATEGORY_ID, ITEM_NAME, NORMALIZED_NAME, KEYWORDS, SOURCE_TYPE, IS_ACTIVE)
                    VALUES
                         (source.CATEGORY_ID, source.ITEM_NAME, source.NORMALIZED_NAME,
                          source.KEYWORDS, source.SOURCE_TYPE, 1)""",
                {
                    "category_id": category_id,
                    "item_name": item_name[:200],
                    "normalized_name": normalized_name[:200],
                    "keywords": keywords[:1900],
                    "source_type": catalog_kind,
                },
            )

        cursor.execute(
            """SELECT COUNT(*) FROM EXP_CATEGORY_ITEMS
                WHERE CATEGORY_ID = :category_id AND IS_ACTIVE = 1""",
            {"category_id": category_id},
        )
        item_count = int(cursor.fetchone()[0] or 0)
        cursor.execute(
            """UPDATE EXP_CATEGORY_CATALOG_JOBS
                  SET STATUS = 'COMPLETED', ITEM_COUNT = :item_count,
                      CATALOG_KIND = :catalog_kind, MESSAGE = :message,
                      FINISHED_AT = SYSTIMESTAMP
                WHERE JOB_ID = :job_id""",
            {
                "item_count": item_count,
                "catalog_kind": catalog_kind,
                "message": message[:1000],
                "job_id": job_id,
            },
        )
        connection.commit()
    except Exception as exc:
        if connection is not None:
            try:
                connection.rollback()
                cursor = connection.cursor()
                cursor.execute(
                    """UPDATE EXP_CATEGORY_CATALOG_JOBS
                          SET STATUS = 'FAILED', ERROR_MESSAGE = :error_message,
                              FINISHED_AT = SYSTIMESTAMP
                        WHERE JOB_ID = :job_id""",
                    {"error_message": str(exc)[:1000], "job_id": job_id},
                )
                connection.commit()
            except Exception as status_exc:
                print(f"CATEGORY CATALOG JOB UPDATE ERROR: {status_exc}")
        print(f"CATEGORY CATALOG JOB FAILED ({job_id}): {exc}")
    finally:
        if connection is not None:
            connection.close()
