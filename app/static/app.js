/* =====================================================
   GLOBAL VARIABLES
===================================================== */

let currentConfirmationId = null;
let currentEditExpenseId = null;
let currentDeleteExpenseId = null;

let currentCategoryId = null;

let categoryChart = null;
let reportTrendChart = null;
let reportCategoryChart = null;
let activeReportRange = "month";
let currentReportExpenses = [];

let speechRecognition = null;
let isListening = false;
let toastTimer = null;
let voiceSupported = false;


/* =====================================================
   SUBSCRIPTION / TRIAL
===================================================== */

const TRIAL_DAYS = 7;

const TRIAL_STORAGE_KEY =
    "expense_app_trial_start";

const MONTHLY_LICENSE_PRICE = 50000;


/* =====================================================
   APP SETTINGS
===================================================== */

const SETTINGS_KEYS = {

    DISPLAY_NAME:
        "expense_app_display_name",

    CURRENCY:
        "expense_app_currency",

    NOTIFICATIONS:
        "expense_app_notifications",

    VOICE_ENABLED:
        "expense_app_voice_enabled",

    THEME:
        "expense_app_theme"
};


/* =====================================================
   DEFAULT SETTINGS
===================================================== */

const DEFAULT_SETTINGS = {

    displayName:
        "کاربر",

    currency:
        "toman",

    notifications:
        "true",

    voiceEnabled:
        "true",

    theme:
        "system"
};


/* =====================================================
   SETTINGS STORAGE
===================================================== */

function getSetting(
    key,
    defaultValue = ""
) {

    const value =
        localStorage.getItem(
            key
        );


    if (
        value === null
    ) {

        return defaultValue;
    }


    return value;
}


function setSetting(
    key,
    value
) {

    localStorage.setItem(
        key,
        String(value)
    );
}


/* =====================================================
   LOAD DEFAULT SETTINGS
===================================================== */

function initializeSettings() {

    if (
        localStorage.getItem(
            SETTINGS_KEYS.DISPLAY_NAME
        ) === null
    ) {

        setSetting(
            SETTINGS_KEYS.DISPLAY_NAME,
            DEFAULT_SETTINGS.displayName
        );
    }


    if (
        localStorage.getItem(
            SETTINGS_KEYS.CURRENCY
        ) === null
    ) {

        setSetting(
            SETTINGS_KEYS.CURRENCY,
            DEFAULT_SETTINGS.currency
        );
    }


    if (
        localStorage.getItem(
            SETTINGS_KEYS.NOTIFICATIONS
        ) === null
    ) {

        setSetting(
            SETTINGS_KEYS.NOTIFICATIONS,
            DEFAULT_SETTINGS.notifications
        );
    }


    if (
        localStorage.getItem(
            SETTINGS_KEYS.VOICE_ENABLED
        ) === null
    ) {

        setSetting(
            SETTINGS_KEYS.VOICE_ENABLED,
            DEFAULT_SETTINGS.voiceEnabled
        );
    }


    if (
        localStorage.getItem(
            SETTINGS_KEYS.THEME
        ) === null
    ) {

        setSetting(
            SETTINGS_KEYS.THEME,
            DEFAULT_SETTINGS.theme
        );
    }
}


/* =====================================================
   CURRENT SETTINGS
===================================================== */

function getDisplayName() {

    return getSetting(
        SETTINGS_KEYS.DISPLAY_NAME,
        DEFAULT_SETTINGS.displayName
    );
}


function getCurrency() {

    return getSetting(
        SETTINGS_KEYS.CURRENCY,
        DEFAULT_SETTINGS.currency
    );
}


function isNotificationsEnabled() {

    return (
        getSetting(
            SETTINGS_KEYS.NOTIFICATIONS,
            DEFAULT_SETTINGS.notifications
        ) ===
        "true"
    );
}


function isVoiceEnabled() {

    return (
        getSetting(
            SETTINGS_KEYS.VOICE_ENABLED,
            DEFAULT_SETTINGS.voiceEnabled
        ) ===
        "true"
    );
}


function getThemePreference() {

    return getSetting(
        SETTINGS_KEYS.THEME,
        DEFAULT_SETTINGS.theme
    );
}


/* =====================================================
   FORMAT NUMBER
===================================================== */

function formatNumber(number) {

    if (
        number === null ||
        number === undefined
    ) {

        return "۰";
    }


    const numericValue =
        Number(number);


    if (
        Number.isNaN(
            numericValue
        )
    ) {

        return "۰";
    }


    return numericValue.toLocaleString(
        "fa-IR"
    );
}


/* =====================================================
   FORMAT TOMAN
   ثابت برای قیمت اشتراک
===================================================== */

function formatToman(amount) {

    return (
        formatNumber(amount) +
        " تومان"
    );
}


/* =====================================================
   FORMAT MONEY
===================================================== */

function formatMoney(amount) {

    const numericAmount =
        Number(amount || 0);


    if (
        getCurrency() ===
        "rial"
    ) {

        return (
            formatNumber(
                numericAmount * 10
            ) +
            " ریال"
        );
    }


    return (
        formatNumber(
            numericAmount
        ) +
        " تومان"
    );
}


/* =====================================================
   PERSIAN DIGITS
===================================================== */

function toPersianDigits(value) {

    return String(value)
        .replace(
            /\d/g,
            digit => "۰۱۲۳۴۵۶۷۸۹"[digit]
        );
}


/* =====================================================
   CATEGORY ICON
===================================================== */

function categoryIcon(categoryName) {

    const icons = {

        "غذا":
            "🍔",

        "حمل و نقل":
            "🚕",

        "خودرو":
            "🚗",

        "خانه":
            "🏠",

        "خرید":
            "🛒",

        "درمان":
            "💊",

        "قبوض":
            "💡",

        "موبایل و اینترنت":
            "📱",

        "آموزش":
            "🎓",

        "پوشاک":
            "👕",

        "تفریح":
            "🎮",

        "سفر":
            "✈️",

        "سایر":
            "📦"

    };

    return (
        icons[categoryName] ||
        "📦"
    );
}


/* =====================================================
   CATEGORY DISPLAY ICON
===================================================== */

function getCategoryDisplayIcon(
    category
) {

    const name =
        category?.category_name ??
        category?.name ??
        "";


    const rawIcon =
        category?.icon;


    if (
        rawIcon !== null &&
        rawIcon !== undefined &&
        String(rawIcon).trim() !== ""
    ) {

        return String(rawIcon).trim();
    }


    return categoryIcon(
        name
    );
}


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }


    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


/* =====================================================
   TOAST
===================================================== */

function showToast(message) {

    const toast =
        document.getElementById(
            "toast"
        );


    if (!toast) {
        return;
    }


    toast.textContent =
        message;


    toast.classList.add(
        "show"
    );


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            3000
        );
}


/* =====================================================
   TODAY GREGORIAN
===================================================== */

function getTodayGregorian() {

    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        String(
            now.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            now.getDate()
        ).padStart(
            2,
            "0"
        );


    return (
        `${year}-${month}-${day}`
    );
}


/* =====================================================
   MONTH START
===================================================== */

function getMonthStartGregorian() {

    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        String(
            now.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    return (
        `${year}-${month}-01`
    );
}


/* =====================================================
   NORMALIZE DATE INPUT
===================================================== */

function normalizeDateInput(value) {

    if (!value) {
        return "";
    }


    const text =
        String(value);


    if (
        text.length >= 10
    ) {

        return text.substring(
            0,
            10
        );
    }


    return text;
}


/* =====================================================
   PERSIAN DATE
===================================================== */

function toPersianDate(dateString) {

    if (!dateString) {
        return "";
    }


    const date =
        new Date(dateString);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return dateString;
    }


    return new Intl.DateTimeFormat(
        "fa-IR-u-ca-persian",
        {
            year:
                "numeric",

            month:
                "2-digit",

            day:
                "2-digit"
        }
    ).format(
        date
    );
}


/* =====================================================
   THEME
===================================================== */

function getSystemTheme() {

    if (
        window.matchMedia &&
        window.matchMedia(
            "(prefers-color-scheme: dark)"
        ).matches
    ) {

        return "dark";
    }


    return "light";
}


function applyTheme() {

    const preference =
        getThemePreference();


    let actualTheme =
        preference;


    if (
        preference ===
        "system"
    ) {

        actualTheme =
            getSystemTheme();
    }


    document.documentElement.dataset.theme =
        actualTheme;


    applyThemeStyle();
}


function applyThemeStyle() {

    let style =
        document.getElementById(
            "expense-app-theme-style"
        );


    if (!style) {

        style =
            document.createElement(
                "style"
            );

        style.id =
            "expense-app-theme-style";

        document.head.appendChild(
            style
        );
    }


    style.textContent = `

        html[data-theme="dark"] body {
            background: #121619;
            color: #f1f3f4;
        }

        html[data-theme="dark"] .app-shell {
            background: #121619;
        }

        html[data-theme="dark"] .top-header,
        html[data-theme="dark"] .settings-card,
        html[data-theme="dark"] .settings-header,
        html[data-theme="dark"] .quick-input-card,
        html[data-theme="dark"] .dashboard-section,
        html[data-theme="dark"] .modal-card,
        html[data-theme="dark"] .subscription-paywall-card {
            background: #1b2024;
            color: #f1f3f4;
        }

        html[data-theme="dark"] .section-title,
        html[data-theme="dark"] .settings-title,
        html[data-theme="dark"] .settings-item-title,
        html[data-theme="dark"] .category-management-name,
        html[data-theme="dark"] .expense-description,
        html[data-theme="dark"] .modal-header h2,
        html[data-theme="dark"] .subscription-paywall-title {
            color: #f1f3f4;
        }

        html[data-theme="dark"] .section-subtitle,
        html[data-theme="dark"] .settings-subtitle,
        html[data-theme="dark"] .settings-item-description,
        html[data-theme="dark"] .category-management-status,
        html[data-theme="dark"] .welcome-text,
        html[data-theme="dark"] .today-date,
        html[data-theme="dark"] .comparison-label {
            color: #aab2b8;
        }

        html[data-theme="dark"] .settings-item,
        html[data-theme="dark"] .settings-close,
        html[data-theme="dark"] .settings-header-icon,
        html[data-theme="dark"] .settings-item-icon,
        html[data-theme="dark"] .settings-item-arrow,
        html[data-theme="dark"] .category-management-icon,
        html[data-theme="dark"] .category-action-button,
        html[data-theme="dark"] .small-action-button,
        html[data-theme="dark"] .voice-button,
        html[data-theme="dark"] .expense-edit-button,
        html[data-theme="dark"] .expense-delete-button,
        html[data-theme="dark"] .modal-close {
            background: #252c31;
            color: #e8eaed;
        }

        html[data-theme="dark"] .settings-item,
        html[data-theme="dark"] .settings-header,
        html[data-theme="dark"] .settings-content,
        html[data-theme="dark"] .settings-close {
            border-color: #333b41;
        }

        html[data-theme="dark"] .quick-input,
        html[data-theme="dark"] .edit-form input,
        html[data-theme="dark"] .edit-form select {
            background: #20262b;
            color: #f1f3f4;
            border-color: #3b444b;
        }

        html[data-theme="dark"] .summary-card,
        html[data-theme="dark"] .monthly-comparison,
        html[data-theme="dark"] .expense-item,
        html[data-theme="dark"] .category-chart-wrapper,
        html[data-theme="dark"] .category-management-item {
            background: #20262b;
            border-color: #333b41;
        }

        html[data-theme="dark"] .category-summary-item {
            background: #20262b !important;
            border-color: #333b41 !important;
        }

        html[data-theme="dark"] .category-summary-name,
        html[data-theme="dark"] .category-summary-amount,
        html[data-theme="dark"] .expense-amount,
        html[data-theme="dark"] .summary-value,
        html[data-theme="dark"] .category-chart-title {
            color: #f1f3f4 !important;
        }

        html[data-theme="dark"] .subscription-paywall-description,
        html[data-theme="dark"] .subscription-plan-label,
        html[data-theme="dark"] .subscription-plan-period,
        html[data-theme="dark"] .subscription-feature-list div {
            color: #aab2b8;
        }

        html[data-theme="dark"] .subscription-plan,
        html[data-theme="dark"] .subscription-feature-list div {
            background: #20262b;
            border-color: #333b41;
        }

        html[data-theme="dark"] .bottom-nav {
            background: rgba(27, 32, 36, 0.96);
            border-top-color: #333b41;
        }

        html[data-theme="dark"] .bottom-nav-item {
            color: #8d969d;
        }

        html[data-theme="dark"] .bottom-nav-item.active {
            color: #f1f3f4;
        }
    `;
}


function initSystemThemeListener() {

    if (
        !window.matchMedia
    ) {

        return;
    }


    const mediaQuery =
        window.matchMedia(
            "(prefers-color-scheme: dark)"
        );


    const handler =
        function () {

            if (
                getThemePreference() ===
                "system"
            ) {

                applyTheme();
            }
        };


    if (
        mediaQuery.addEventListener
    ) {

        mediaQuery.addEventListener(
            "change",
            handler
        );

    } else if (
        mediaQuery.addListener
    ) {

        mediaQuery.addListener(
            handler
        );
    }
}


/* =====================================================
   TRIAL STATUS
===================================================== */

function getTrialStatus() {

    const now =
        Date.now();


    let trialStart =
        Number(
            localStorage.getItem(
                TRIAL_STORAGE_KEY
            )
        );


    if (
        !Number.isFinite(
            trialStart
        ) ||
        trialStart <= 0
    ) {

        trialStart =
            now;


        localStorage.setItem(
            TRIAL_STORAGE_KEY,
            String(
                trialStart
            )
        );
    }


    const trialDuration =
        TRIAL_DAYS *
        24 *
        60 *
        60 *
        1000;


    const trialEnd =
        trialStart +
        trialDuration;


    if (
        now >=
        trialEnd
    ) {

        return {

            status:
                "expired",

            remainingDays:
                0,

            trialStart:
                trialStart,

            trialEnd:
                trialEnd
        };
    }


    const remainingDays =
        Math.max(
            1,
            Math.ceil(
                (
                    trialEnd -
                    now
                ) /
                (
                    24 *
                    60 *
                    60 *
                    1000
                )
            )
        );


    if (
        remainingDays <= 2
    ) {

        return {

            status:
                "warning",

            remainingDays:
                remainingDays,

            trialStart:
                trialStart,

            trialEnd:
                trialEnd
        };
    }


    return {

        status:
            "trial",

        remainingDays:
            remainingDays,

        trialStart:
            trialStart,

        trialEnd:
            trialEnd
    };
}


/* =====================================================
   PAID SUBSCRIPTION
===================================================== */

function isSubscriptionActive() {

    /*
     * فعلاً پرداخت واقعی نداریم.
     *
     * بعداً وضعیت License از Backend/Oracle
     * خوانده می‌شود.
     */

    return false;
}


/* =====================================================
   FEATURE ACCESS
===================================================== */

function hasFeatureAccess() {

    if (
        isSubscriptionActive()
    ) {

        return true;
    }


    const trial =
        getTrialStatus();


    return (
        trial.status !==
        "expired"
    );
}


/* =====================================================
   REQUIRE FEATURE ACCESS
===================================================== */

function requireFeatureAccess() {

    if (
        hasFeatureAccess()
    ) {

        return true;
    }


    showSubscriptionPaywall();

    return false;
}


/* =====================================================
   UPDATE SUBSCRIPTION UI
===================================================== */

function updateSubscriptionStatus() {

    const button =
        document.getElementById(
            "subscriptionStatusButton"
        ) ||
        document.getElementById(
            "notificationButton"
        );


    if (!button) {
        return;
    }


    if (
        isSubscriptionActive()
    ) {

        button.className =
            "subscription-icon-button active";


        button.innerHTML = `
            <span class="subscription-icon">
                👑
            </span>
        `;


        button.title =
            "اشتراک فعال";


        button.setAttribute(
            "aria-label",
            "اشتراک فعال"
        );


        return;
    }


    const trial =
        getTrialStatus();


    button.className =
        "subscription-icon-button " +
        trial.status;


    button.innerHTML = `
        <span class="subscription-icon">
            👑
        </span>
    `;


    if (
        trial.status ===
        "trial"
    ) {

        button.title =
            "نسخه آزمایشی - " +
            toPersianDigits(
                trial.remainingDays
            ) +
            " روز باقی مانده";

    } else if (
        trial.status ===
        "warning"
    ) {

        button.title =
            "نسخه آزمایشی - فقط " +
            toPersianDigits(
                trial.remainingDays
            ) +
            " روز باقی مانده";

    } else {

        button.title =
            "دوره آزمایشی تمام شده است";
    }


    button.setAttribute(
        "aria-label",
        button.title
    );
}


/* =====================================================
   CREATE SUBSCRIPTION PAYWALL
===================================================== */

function createSubscriptionModal() {

    if (
        document.getElementById(
            "subscriptionPaywall"
        )
    ) {

        return;
    }


    const modal =
        document.createElement(
            "div"
        );


    modal.id =
        "subscriptionPaywall";


    modal.className =
        "subscription-paywall hidden";


    modal.innerHTML = `

        <div class="subscription-paywall-card">

            <button
                type="button"
                class="subscription-paywall-close"
                id="subscriptionPaywallClose"
                aria-label="بستن"
            >
                ×
            </button>


            <div class="subscription-paywall-icon">
                👑
            </div>


            <div class="subscription-paywall-title">
                دوره آزمایشی تمام شده است
            </div>


            <div class="subscription-paywall-description">
                برای ادامه ثبت و مدیریت هزینه‌ها،
                اشتراک ماهانه را فعال کنید.
            </div>


            <div class="subscription-plan">

                <div class="subscription-plan-label">
                    اشتراک ماهانه
                </div>


                <div class="subscription-plan-price">
                    ${formatToman(
                        MONTHLY_LICENSE_PRICE
                    )}
                </div>


                <div class="subscription-plan-period">
                    اعتبار ۳۰ روزه
                </div>

            </div>


            <div class="subscription-feature-list">

                <div>
                    ✓ ثبت هزینه
                </div>

                <div>
                    ✓ ثبت صوتی
                </div>

                <div>
                    ✓ ویرایش و حذف هزینه
                </div>

                <div>
                    ✓ گزارش و نمودار
                </div>

            </div>


            <button
                type="button"
                class="primary-button full-width"
                id="buySubscriptionButton"
            >
                فعال‌سازی اشتراک
            </button>


            <button
                type="button"
                class="secondary-button full-width"
                id="subscriptionLaterButton"
            >
                فعلاً بعداً
            </button>

        </div>

    `;


    document.body.appendChild(
        modal
    );


    const closeButton =
        document.getElementById(
            "subscriptionPaywallClose"
        );


    if (
        closeButton
    ) {

        closeButton.addEventListener(
            "click",
            closeSubscriptionPaywall
        );
    }


    const laterButton =
        document.getElementById(
            "subscriptionLaterButton"
        );


    if (
        laterButton
    ) {

        laterButton.addEventListener(
            "click",
            closeSubscriptionPaywall
        );
    }


    const buyButton =
        document.getElementById(
            "buySubscriptionButton"
        );


    if (
        buyButton
    ) {

        buyButton.addEventListener(
            "click",
            function () {

                showToast(
                    "💳 درگاه پرداخت را در مرحله بعد وصل می‌کنیم."
                );
            }
        );
    }


    modal.addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                modal
            ) {

                closeSubscriptionPaywall();
            }
        }
    );
}


/* =====================================================
   SHOW SUBSCRIPTION PAYWALL
===================================================== */

function showSubscriptionPaywall() {

    createSubscriptionModal();


    const modal =
        document.getElementById(
            "subscriptionPaywall"
        );


    if (!modal) {
        return;
    }


    modal.classList.remove(
        "hidden"
    );


    document.body.classList.add(
        "subscription-modal-open"
    );
}


/* =====================================================
   CLOSE SUBSCRIPTION PAYWALL
===================================================== */

function closeSubscriptionPaywall() {

    const modal =
        document.getElementById(
            "subscriptionPaywall"
        );


    if (!modal) {
        return;
    }


    modal.classList.add(
        "hidden"
    );


    document.body.classList.remove(
        "subscription-modal-open"
    );
}


/* =====================================================
   SUBSCRIPTION BUTTON
===================================================== */

function handleSubscriptionClick() {

    if (
        isSubscriptionActive()
    ) {

        showToast(
            "اشتراک شما فعال است ✅"
        );

        return;
    }


    const trial =
        getTrialStatus();


    if (
        trial.status ===
        "trial"
    ) {

        showToast(
            "نسخه آزمایشی شما " +
            toPersianDigits(
                trial.remainingDays
            ) +
            " روز دیگر اعتبار دارد."
        );

        return;
    }


    if (
        trial.status ===
        "warning"
    ) {

        showToast(
            "⚠️ فقط " +
            toPersianDigits(
                trial.remainingDays
            ) +
            " روز از نسخه آزمایشی باقی مانده است."
        );

        return;
    }


    showSubscriptionPaywall();
}


/* =====================================================
   LOAD TODAY DATE
===================================================== */

function loadTodayDate() {

    const element =
        document.getElementById(
            "todayDate"
        );


    if (!element) {
        return;
    }


    element.textContent =
        "امروز " +
        toPersianDate(
            getTodayGregorian()
        );
}


/* =====================================================
   LOAD TODAY SUMMARY
===================================================== */

async function loadTodaySummary() {

    const todayTotal =
        document.getElementById(
            "todayTotal"
        );


    if (!todayTotal) {
        return;
    }


    try {

        const response =
            await fetch(
                "/api/expenses/summary/today"
            );


        if (!response.ok) {

            throw new Error(
                "HTTP " +
                response.status
            );
        }


        const data =
            await response.json();


        console.log(
            "Today Summary:",
            data
        );


        if (
            data.status !==
            "success"
        ) {

            throw new Error(
                data.message ||
                "خطا در دریافت هزینه امروز"
            );
        }


        todayTotal.textContent =
            formatMoney(
                Number(
                    data.total_amount ||
                    0
                )
            );


    } catch (error) {

        console.error(
            "loadTodaySummary ERROR:",
            error
        );


        todayTotal.textContent =
            getCurrency() === "rial"
                ? "۰ ریال"
                : "۰ تومان";
    }
}


/* =====================================================
   LOAD MONTHLY SUMMARY
===================================================== */

async function loadMonthlySummary() {

    const monthlyTotalElement =
        document.getElementById(
            "monthlyTotal"
        );


    const monthlyAverageElement =
        document.getElementById(
            "monthlyAverage"
        );


    const monthlyComparisonElement =
        document.getElementById(
            "monthlyComparison"
        );


    if (
        !monthlyTotalElement ||
        !monthlyAverageElement
    ) {

        return;
    }


    try {

        const response =
            await fetch(
                "/api/expenses/summary/month"
            );


        if (!response.ok) {

            throw new Error(
                "HTTP " +
                response.status
            );
        }


        const data =
            await response.json();


        console.log(
            "Monthly Summary:",
            data
        );


        if (
            data.status !==
            "success"
        ) {

            throw new Error(
                data.message ||
                "خطا در دریافت خلاصه ماه"
            );
        }


        const currentMonth =
            data.current_month ||
            {};


        const previousMonth =
            data.previous_month ||
            {};


        const comparison =
            data.comparison ||
            {};


        const currentTotal =
            Number(
                currentMonth.total_amount ||
                0
            );


        const averageDaily =
            Number(
                currentMonth.average_daily ||
                0
            );


        const previousTotal =
            Number(
                previousMonth.total_amount ||
                0
            );


        const percentage =
            Number(
                comparison.percentage ||
                0
            );


        monthlyTotalElement.textContent =
            formatMoney(
                currentTotal
            );


        monthlyAverageElement.textContent =
            formatMoney(
                averageDaily
            );


        if (
            monthlyComparisonElement
        ) {

            if (
                previousTotal ===
                0
            ) {

                if (
                    currentTotal ===
                    0
                ) {

                    monthlyComparisonElement.textContent =
                        "بدون هزینه";

                } else {

                    monthlyComparisonElement.textContent =
                        "ماه قبل هزینه‌ای ثبت نشده";
                }


                monthlyComparisonElement.className =
                    "comparison-value neutral";

            } else {

                const absolutePercentage =
                    Math.abs(
                        percentage
                    );


                const percentText =
                    toPersianDigits(
                        absolutePercentage
                    );


                if (
                    percentage >
                    0
                ) {

                    monthlyComparisonElement.textContent =
                        `↑ ${percentText}٪ بیشتر از ماه قبل`;


                    monthlyComparisonElement.className =
                        "comparison-value increase";

                } else if (
                    percentage <
                    0
                ) {

                    monthlyComparisonElement.textContent =
                        `↓ ${percentText}٪ کمتر از ماه قبل`;


                    monthlyComparisonElement.className =
                        "comparison-value decrease";

                } else {

                    monthlyComparisonElement.textContent =
                        "→ بدون تغییر نسبت به ماه قبل";


                    monthlyComparisonElement.className =
                        "comparison-value neutral";
                }
            }
        }


    } catch (error) {

        console.error(
            "loadMonthlySummary ERROR:",
            error
        );


        monthlyTotalElement.textContent =
            getCurrency() === "rial"
                ? "۰ ریال"
                : "۰ تومان";


        monthlyAverageElement.textContent =
            getCurrency() === "rial"
                ? "۰ ریال"
                : "۰ تومان";


        if (
            monthlyComparisonElement
        ) {

            monthlyComparisonElement.textContent =
                "خطا در دریافت اطلاعات";


            monthlyComparisonElement.className =
                "comparison-value neutral";
        }
    }
}


/* =====================================================
   LOAD CATEGORIES
===================================================== */

async function loadCategories() {

    const container =
        document.getElementById(
            "categoryList"
        );


    if (!container) {
        return;
    }


    container.innerHTML = `
        <div class="loading">
            در حال دریافت آمار...
        </div>
    `;


    try {

        const monthStart =
            getMonthStartGregorian();


        const today =
            getTodayGregorian();


        const response =
            await fetch(
                `/api/expenses/?from_date=${encodeURIComponent(
                    monthStart
                )}&to_date=${encodeURIComponent(
                    today
                )}`
            );


        if (!response.ok) {

            throw new Error(
                "HTTP " +
                response.status
            );
        }


        const data =
            await response.json();


        console.log(
            "Monthly Expenses For Categories:",
            data
        );


        if (
            data.status !==
            "success"
        ) {

            throw new Error(
                data.message ||
                "خطا در دریافت هزینه‌های ماه جاری"
            );
        }


        const expenses =
            data.expenses ||
            [];


        const categoryMap =
            {};


        expenses.forEach(
            expense => {

                const category =
                    expense.category ||
                    {};


                const categoryName =
                    category.name ||
                    category.category_name ||
                    expense.category_name ||
                    "سایر";


                const amount =
                    Number(
                        expense.amount ||
                        0
                    );


                if (
                    !categoryMap[
                        categoryName
                    ]
                ) {

                    categoryMap[
                        categoryName
                    ] = {

                        category_name:
                            categoryName,

                        total_amount:
                            0,

                        expense_count:
                            0,

                        icon:
                            getCategoryDisplayIcon(
                                {
                                    category_name:
                                        categoryName,

                                    icon:
                                        category.icon
                                }
                            )
                    };
                }


                categoryMap[
                    categoryName
                ].total_amount +=
                    amount;


                categoryMap[
                    categoryName
                ].expense_count +=
                    1;
            }
        );


        const categories =
            Object.values(
                categoryMap
            );


        const totalAmount =
            categories.reduce(
                (
                    sum,
                    category
                ) =>
                    sum +
                    Number(
                        category.total_amount ||
                        0
                    ),
                0
            );


        categories.forEach(
            category => {

                category.percentage =
                    totalAmount > 0

                        ? (
                            Number(
                                category.total_amount
                            ) /
                            totalAmount
                        ) *
                        100

                        : 0;
            }
        );


        categories.sort(
            (a, b) =>
                Number(
                    b.total_amount
                ) -
                Number(
                    a.total_amount
                )
        );


        renderCategoryChart(
            categories
        );


        if (
            categories.length ===
            0
        ) {

            container.innerHTML = `
                <div class="empty-state">

                    <div class="empty-icon">
                        📊
                    </div>

                    <div>
                        هنوز هزینه‌ای در ماه جاری ثبت نشده است.
                    </div>

                </div>
            `;

            return;
        }


        container.innerHTML =
            "";


        categories.forEach(
            category => {

                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "category-summary-item";


                const icon =
                    category.icon ||
                    categoryIcon(
                        category.category_name
                    );


                const amount =
                    formatMoney(
                        category.total_amount
                    );


                const percentage =
                    Number(
                        category.percentage ||
                        0
                    );


                item.innerHTML = `

                    <div
                        class="category-summary-header"
                    >

                        <div
                            class="category-summary-title"
                        >

                            <div
                                class="category-summary-icon"
                            >
                                ${escapeHtml(
                                    icon
                                )}
                            </div>

                            <div>

                                <div
                                    class="category-summary-name"
                                >
                                    ${escapeHtml(
                                        category.category_name
                                    )}
                                </div>

                                <div
                                    class="category-summary-count"
                                >
                                    ${toPersianDigits(
                                        category.expense_count ||
                                        0
                                    )}
                                    هزینه
                                </div>

                            </div>

                        </div>


                        <div
                            class="category-summary-amount"
                        >
                            ${amount}
                        </div>

                    </div>


                    <div
                        class="category-progress"
                    >

                        <div
                            class="category-progress-bar"
                            style="width:${Math.min(
                                Math.max(
                                    percentage,
                                    0
                                ),
                                100
                            )}%"
                        ></div>

                    </div>


                    <div
                        class="category-summary-footer"
                    >

                        <span>
                            ${toPersianDigits(
                                percentage.toFixed(
                                    1
                                )
                            )}٪
                        </span>

                        <span>
                            سهم از کل هزینه‌ها
                        </span>

                    </div>

                `;


                container.appendChild(
                    item
                );
            }
        );


    } catch (error) {

        console.error(
            "loadCategories ERROR:",
            error
        );


        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    ⚠️
                </div>

                <div>
                    خطا در دریافت آمار
                </div>

                <small>
                    ${escapeHtml(
                        error.message
                    )}
                </small>

            </div>

        `;
    }
}


/* =====================================================
   RENDER CATEGORY CHART
===================================================== */

function renderCategoryChart(
    categories
) {

    const canvas =
        document.getElementById(
            "categoryChart"
        );


    if (!canvas) {
        return;
    }


    if (
        categoryChart
    ) {

        categoryChart.destroy();

        categoryChart =
            null;
    }


    if (
        !categories ||
        categories.length ===
        0
    ) {

        return;
    }


    if (
        typeof Chart ===
        "undefined"
    ) {

        console.error(
            "Chart.js is not loaded."
        );

        return;
    }


    const labels =
        categories.map(
            category =>
                category.category_name
        );


    const values =
        categories.map(
            category =>
                Number(
                    category.total_amount ||
                    0
                )
        );


    categoryChart =
        new Chart(
            canvas,
            {

                type:
                    "doughnut",


                data: {

                    labels:
                        labels,


                    datasets: [

                        {
                            data:
                                values,

                            borderWidth:
                                2
                        }

                    ]
                },


                options: {

                    responsive:
                        true,


                    maintainAspectRatio:
                        false,


                    cutout:
                        "65%",


                    plugins: {

                        legend: {

                            position:
                                "bottom",


                            rtl:
                                true,


                            labels: {

                                usePointStyle:
                                    true,


                                padding:
                                    15,


                                font: {

                                    family:
                                        "Vazirmatn, Tahoma, Arial"
                                }
                            }
                        },


                        tooltip: {

                            rtl:
                                true,


                            callbacks: {

                                label:
                                    function(
                                        context
                                    ) {

                                        const value =
                                            context.raw ||
                                            0;


                                        return (
                                            " " +
                                            formatMoney(
                                                value
                                            )
                                        );
                                    }
                            }
                        }
                    }
                }
            }
        );
}


/* =====================================================
   LOAD EXPENSES
===================================================== */

async function loadExpenses() {

    const container =
        document.getElementById(
            "expenseList"
        );


    if (!container) {
        return;
    }


    container.innerHTML = `
        <div class="loading">
            در حال دریافت اطلاعات...
        </div>
    `;


    const monthStart =
        getMonthStartGregorian();


    const today =
        getTodayGregorian();


    try {

        const response =
            await fetch(
                `/api/expenses/?from_date=${encodeURIComponent(
                    monthStart
                )}&to_date=${encodeURIComponent(
                    today
                )}`
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            data.status !==
            "success"
        ) {

            throw new Error(
                data.message ||
                "Expense API error"
            );
        }


        container.innerHTML =
            "";


        if (
            !data.expenses ||
            data.expenses.length ===
            0
        ) {

            container.innerHTML = `

                <div class="empty-state">

                    <div class="empty-icon">
                        🧾
                    </div>

                    <div>
                        در ماه جاری هنوز هزینه‌ای ثبت نشده است.
                    </div>

                </div>

            `;

            return;
        }


        data.expenses.forEach(
            expense => {

                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "expense-item";


                const category =
                    expense.category ||
                    {};


                const categoryName =
                    category.name ||
                    category.category_name ||
                    expense.category_name ||
                    "سایر";


                const description =
                    expense.description ||
                    "بدون توضیح";


                const amount =
                    expense.amount ||
                    0;


                const expenseDate =
                    expense.expense_date ||
                    "";


                const expenseId =
                    expense.expense_id;


                const icon =
                    getCategoryDisplayIcon(
                        {
                            category_name:
                                categoryName,

                            icon:
                                category.icon
                        }
                    );


                item.innerHTML = `

                    <div
                        class="expense-main"
                    >

                        <div
                            class="expense-icon"
                        >
                            ${escapeHtml(
                                icon
                            )}
                        </div>


                        <div
                            class="expense-info"
                        >

                            <div
                                class="expense-description"
                            >
                                ${escapeHtml(
                                    description
                                )}
                            </div>


                            <div
                                class="expense-meta"
                            >

                                <span>
                                    ${escapeHtml(
                                        categoryName
                                    )}
                                </span>


                                <span>
                                    ${toPersianDate(
                                        expenseDate
                                    )}
                                </span>

                            </div>

                        </div>

                    </div>


                    <div
                        class="expense-right"
                    >

                        <div
                            class="expense-amount"
                        >
                            ${formatMoney(
                                amount
                            )}
                        </div>


                        <div
                            class="expense-actions"
                        >

                            <button
                                type="button"
                                class="expense-edit-button"
                                title="ویرایش"
                                onclick="openEditExpense(${Number(
                                    expenseId
                                )})"
                            >
                                ✏️
                            </button>


                            <button
                                type="button"
                                class="expense-delete-button"
                                title="حذف"
                                onclick="openDeleteExpense(${Number(
                                    expenseId
                                )})"
                            >
                                🗑️
                            </button>

                        </div>

                    </div>

                `;


                container.appendChild(
                    item
                );
            }
        );


    } catch (error) {

        console.error(
            "loadExpenses:",
            error
        );


        container.innerHTML = `

            <div class="empty-state">
                خطا در دریافت هزینه‌ها
            </div>

        `;
    }
}


/* =====================================================
   SUBMIT EXPENSE TEXT
===================================================== */

async function submitExpenseText() {

    if (
        !requireFeatureAccess()
    ) {

        return;
    }


    const input =
        document.getElementById(
            "expenseText"
        );


    if (!input) {
        return;
    }


    const text =
        input.value.trim();


    if (!text) {

        showToast(
            "لطفاً هزینه را وارد کنید."
        );


        input.focus();

        return;
    }


    const button =
        document.getElementById(
            "saveExpenseButton"
        );


    if (!button) {
        return;
    }


    button.disabled =
        true;


    button.textContent =
        "در حال بررسی...";


    try {

        const response =
            await fetch(
                "/api/expenses/text",
                {

                    method:
                        "POST",


                    headers: {

                        "Content-Type":
                            "application/json"
                    },


                    body:
                        JSON.stringify({

                            text:
                                text
                        })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            showToast(
                data.message ||
                data.detail ||
                "خطا در ثبت هزینه"
            );

            return;
        }


        if (
            data.status ===
            "confirmation_required"
        ) {

            showConfirmation(
                data
            );

            return;
        }


        if (
            data.status ===
            "success"
        ) {

            showToast(
                "هزینه با موفقیت ثبت شد ✅"
            );


            input.value =
                "";


            await refreshDashboard();

            return;
        }


        showToast(
            data.message ||
            "اطلاعات هزینه معتبر نیست."
        );


    } catch (error) {

        console.error(
            "submitExpenseText ERROR:",
            error
        );


        showToast(
            "خطا در ارتباط با سرور"
        );


    } finally {

        button.disabled =
            false;


        button.textContent =
            "ثبت هزینه";
    }
}


/* =====================================================
   SHOW CONFIRMATION
===================================================== */

function showConfirmation(
    data
) {

    if (
        !requireFeatureAccess()
    ) {

        return;
    }


    currentConfirmationId =
        data.confirmation_id;


    const expense =
        data.expense ||
        {};


    const descriptionElement =
        document.getElementById(
            "confirmationDescription"
        );


    const amountElement =
        document.getElementById(
            "confirmationAmount"
        );


    const categoryElement =
        document.getElementById(
            "confirmationCategory"
        );


    const dateElement =
        document.getElementById(
            "confirmationDate"
        );


    if (
        descriptionElement
    ) {

        descriptionElement.textContent =
            expense.description ||
            "-";
    }


    if (
        amountElement
    ) {

        amountElement.textContent =
            formatMoney(
                expense.amount ||
                0
            );
    }


    if (
        categoryElement
    ) {

        categoryElement.textContent =
            expense.category ||
            "-";
    }


    if (
        dateElement
    ) {

        dateElement.textContent =
            toPersianDate(
                expense.expense_date
            );
    }


    const modal =
        document.getElementById(
            "confirmationModal"
        );


    if (
        modal
    ) {

        modal.classList.remove(
            "hidden"
        );
    }
}


/* =====================================================
   CLOSE CONFIRMATION
===================================================== */

function closeConfirmation() {

    const modal =
        document.getElementById(
            "confirmationModal"
        );


    if (
        modal
    ) {

        modal.classList.add(
            "hidden"
        );
    }


    currentConfirmationId =
        null;
}


/* =====================================================
   CONFIRM EXPENSE
===================================================== */

async function confirmExpense() {

    if (
        !requireFeatureAccess()
    ) {

        closeConfirmation();

        return;
    }


    if (
        !currentConfirmationId
    ) {

        return;
    }


    const button =
        document.getElementById(
            "confirmExpenseButton"
        );


    if (!button) {
        return;
    }


    button.disabled =
        true;


    button.textContent =
        "در حال ثبت...";


    try {

        const response =
            await fetch(
                "/api/expenses/confirm",
                {

                    method:
                        "POST",


                    headers: {

                        "Content-Type":
                            "application/json"
                    },


                    body:
                        JSON.stringify({

                            confirmation_id:
                                currentConfirmationId
                        })
                }
            );


        const data =
            await response.json();


        if (
            data.status ===
            "success"
        ) {

            closeConfirmation();


            const input =
                document.getElementById(
                    "expenseText"
                );


            if (input) {

                input.value =
                    "";
            }


            showToast(
                "هزینه با موفقیت ثبت شد ✅"
            );


            await refreshDashboard();

        } else {

            showToast(
                data.message ||
                "ثبت هزینه انجام نشد."
            );
        }


    } catch (error) {

        console.error(
            "confirmExpense ERROR:",
            error
        );


        showToast(
            "خطا در ثبت هزینه"
        );


    } finally {

        button.disabled =
            false;


        button.textContent =
            "تأیید و ثبت";
    }
}


/* =====================================================
   CANCEL EXPENSE
===================================================== */

async function cancelExpense() {

    if (
        !currentConfirmationId
    ) {

        return;
    }


    try {

        await fetch(
            "/api/expenses/cancel",
            {

                method:
                    "POST",


                headers: {

                    "Content-Type":
                        "application/json"
                },


                body:
                    JSON.stringify({

                        confirmation_id:
                            currentConfirmationId
                    })
            }
        );


    } catch (error) {

        console.error(
            "cancelExpense ERROR:",
            error
        );
    }


    closeConfirmation();


    showToast(
        "ثبت هزینه لغو شد."
    );
}


/* =====================================================
   GET EXPENSE CATEGORY ID
===================================================== */

function getExpenseCategoryId(
    expense
) {

    if (
        expense.category &&
        expense.category.category_id !==
            undefined &&
        expense.category.category_id !==
            null
    ) {

        return Number(
            expense.category.category_id
        );
    }


    if (
        expense.category &&
        expense.category.id !==
            undefined &&
        expense.category.id !==
            null
    ) {

        return Number(
            expense.category.id
        );
    }


    if (
        expense.category_id !==
            undefined &&
        expense.category_id !==
            null
    ) {

        return Number(
            expense.category_id
        );
    }


    return null;
}


/* =====================================================
   OPEN EDIT EXPENSE
===================================================== */

async function openEditExpense(
    expenseId
) {

    if (
        !requireFeatureAccess()
    ) {

        return;
    }


    currentEditExpenseId =
        expenseId;


    try {

        const response =
            await fetch(
                "/api/expenses/?from_date=" +
                encodeURIComponent(
                    getMonthStartGregorian()
                ) +
                "&to_date=" +
                encodeURIComponent(
                    getTodayGregorian()
                )
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            data.status !==
                "success"
        ) {

            showToast(
                "خطا در دریافت اطلاعات هزینه"
            );

            return;
        }


        const expense =
            data.expenses.find(
                item =>
                    Number(
                        item.expense_id
                    ) ===
                    Number(
                        expenseId
                    )
            );


        if (!expense) {

            showToast(
                "هزینه موردنظر پیدا نشد."
            );

            return;
        }


        const amountElement =
            document.getElementById(
                "editAmount"
            );


        const descriptionElement =
            document.getElementById(
                "editDescription"
            );


        const dateElement =
            document.getElementById(
                "editDate"
            );


        if (amountElement) {

            amountElement.value =
                expense.amount;
        }


        if (descriptionElement) {

            descriptionElement.value =
                expense.description ||
                "";
        }


        if (dateElement) {

            dateElement.value =
                normalizeDateInput(
                    expense.expense_date
                );
        }


        const selectedCategoryId =
            getExpenseCategoryId(
                expense
            );


        await loadEditCategories(
            selectedCategoryId
        );


        const modal =
            document.getElementById(
                "editExpenseModal"
            );


        if (modal) {

            modal.classList.remove(
                "hidden"
            );
        }


    } catch (error) {

        console.error(
            "openEditExpense ERROR:",
            error
        );


        showToast(
            "خطا در دریافت اطلاعات هزینه"
        );
    }
}


/* =====================================================
   LOAD EDIT CATEGORIES
===================================================== */

async function loadEditCategories(
    selectedCategoryId = null
) {

    const select =
        document.getElementById(
            "editCategory"
        );


    if (!select) {
        return;
    }


    try {

        const response =
            await fetch(
                "/api/categories/"
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            data.status !==
                "success"
        ) {

            return;
        }


        select.innerHTML = `
            <option value="">
                انتخاب دسته‌بندی
            </option>
        `;


        data.categories.forEach(
            category => {

                const option =
                    document.createElement(
                        "option"
                    );


                const categoryId =
                    category.category_id ??
                    category.id;


                const categoryName =
                    category.category_name ??
                    category.name ??
                    "بدون نام";


                option.value =
                    categoryId;


                option.textContent =
                    categoryName;


                select.appendChild(
                    option
                );
            }
        );


        if (
            selectedCategoryId !==
                null &&
            selectedCategoryId !==
                undefined
        ) {

            const wantedValue =
                String(
                    selectedCategoryId
                );


            const exists =
                Array.from(
                    select.options
                ).some(
                    option =>
                        option.value ===
                        wantedValue
                );


            if (exists) {

                select.value =
                    wantedValue;
            }
        }


    } catch (error) {

        console.error(
            "loadEditCategories ERROR:",
            error
        );
    }
}


/* =====================================================
   CLOSE EDIT
===================================================== */

function closeEditExpense() {

    const modal =
        document.getElementById(
            "editExpenseModal"
        );


    if (modal) {

        modal.classList.add(
            "hidden"
        );
    }


    currentEditExpenseId =
        null;
}


/* =====================================================
   SAVE EDIT
===================================================== */

async function saveEditExpense() {

    if (
        !requireFeatureAccess()
    ) {

        closeEditExpense();

        return;
    }


    if (
        !currentEditExpenseId
    ) {

        return;
    }


    const amountElement =
        document.getElementById(
            "editAmount"
        );


    const descriptionElement =
        document.getElementById(
            "editDescription"
        );


    const categoryElement =
        document.getElementById(
            "editCategory"
        );


    const dateElement =
        document.getElementById(
            "editDate"
        );


    const amount =
        Number(
            amountElement?.value
        );


    const description =
        descriptionElement?.value.trim() ||
        "";


    const categoryId =
        categoryElement?.value ||
        "";


    const expenseDate =
        dateElement?.value ||
        "";


    if (
        !amount ||
        amount <= 0
    ) {

        showToast(
            "مبلغ باید بیشتر از صفر باشد."
        );

        return;
    }


    if (!description) {

        showToast(
            "توضیحات را وارد کنید."
        );

        return;
    }


    if (!categoryId) {

        showToast(
            "دسته‌بندی را انتخاب کنید."
        );

        return;
    }


    if (!expenseDate) {

        showToast(
            "تاریخ را انتخاب کنید."
        );

        return;
    }


    const button =
        document.getElementById(
            "saveEditButton"
        );


    if (!button) {
        return;
    }


    button.disabled =
        true;


    button.textContent =
        "در حال ذخیره...";


    try {

        const response =
            await fetch(
                "/api/expenses/edit",
                {

                    method:
                        "PUT",


                    headers: {

                        "Content-Type":
                            "application/json"
                    },


                    body:
                        JSON.stringify({

                            expense_id:
                                currentEditExpenseId,

                            amount:
                                amount,

                            description:
                                description,

                            category_id:
                                Number(
                                    categoryId
                                ),

                            expense_date:
                                expenseDate
                        })
                }
            );


        const data =
            await response.json();


        if (
            data.status ===
            "success"
        ) {

            closeEditExpense();


            showToast(
                "هزینه با موفقیت ویرایش شد ✅"
            );


            await refreshDashboard();

        } else {

            showToast(
                data.message ||
                "ویرایش هزینه انجام نشد."
            );
        }


    } catch (error) {

        console.error(
            "saveEditExpense ERROR:",
            error
        );


        showToast(
            "خطا در ویرایش هزینه"
        );


    } finally {

        button.disabled =
            false;


        button.textContent =
            "ذخیره تغییرات";
    }
}


/* =====================================================
   OPEN DELETE EXPENSE
===================================================== */

async function openDeleteExpense(
    expenseId
) {

    if (
        !requireFeatureAccess()
    ) {

        return;
    }


    currentDeleteExpenseId =
        expenseId;


    try {

        const response =
            await fetch(
                "/api/expenses/?from_date=" +
                encodeURIComponent(
                    getMonthStartGregorian()
                ) +
                "&to_date=" +
                encodeURIComponent(
                    getTodayGregorian()
                )
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            data.status !==
                "success"
        ) {

            showToast(
                "خطا در دریافت اطلاعات هزینه"
            );

            return;
        }


        const expense =
            data.expenses.find(
                item =>
                    Number(
                        item.expense_id
                    ) ===
                    Number(
                        expenseId
                    )
            );


        if (!expense) {

            showToast(
                "هزینه موردنظر پیدا نشد."
            );

            return;
        }


        const descriptionElement =
            document.getElementById(
                "deleteExpenseDescription"
            );


        const amountElement =
            document.getElementById(
                "deleteExpenseAmount"
            );


        if (
            descriptionElement
        ) {

            descriptionElement.textContent =
                expense.description ||
                "بدون توضیح";
        }


        if (
            amountElement
        ) {

            amountElement.textContent =
                formatMoney(
                    expense.amount
                );
        }


        const modal =
            document.getElementById(
                "deleteExpenseModal"
            );


        if (modal) {

            modal.classList.remove(
                "hidden"
            );
        }


    } catch (error) {

        console.error(
            "openDeleteExpense ERROR:",
            error
        );


        showToast(
            "خطا در دریافت اطلاعات هزینه"
        );
    }
}


/* =====================================================
   CLOSE DELETE
===================================================== */

function closeDeleteExpense() {

    const modal =
        document.getElementById(
            "deleteExpenseModal"
        );


    if (modal) {

        modal.classList.add(
            "hidden"
        );
    }


    currentDeleteExpenseId =
        null;
}


/* =====================================================
   DELETE EXPENSE
===================================================== */

async function deleteExpense() {

    if (
        !requireFeatureAccess()
    ) {

        closeDeleteExpense();

        return;
    }


    if (
        !currentDeleteExpenseId
    ) {

        return;
    }


    const button =
        document.getElementById(
            "confirmDeleteButton"
        );


    if (!button) {
        return;
    }


    button.disabled =
        true;


    button.textContent =
        "در حال حذف...";


    try {

        const response =
            await fetch(
                "/api/expenses/delete",
                {

                    method:
                        "DELETE",


                    headers: {

                        "Content-Type":
                            "application/json"
                    },


                    body:
                        JSON.stringify({

                            expense_id:
                                currentDeleteExpenseId
                        })
                }
            );


        const data =
            await response.json();


        if (
            data.status ===
            "success"
        ) {

            closeDeleteExpense();


            showToast(
                "هزینه با موفقیت حذف شد 🗑️"
            );


            await refreshDashboard();

        } else {

            showToast(
                data.message ||
                "حذف هزینه انجام نشد."
            );
        }


    } catch (error) {

        console.error(
            "deleteExpense ERROR:",
            error
        );


        showToast(
            "خطا در حذف هزینه"
        );


    } finally {

        button.disabled =
            false;


        button.textContent =
            "حذف هزینه";
    }
}


/* =====================================================
   APPLY VOICE SETTING
===================================================== */

function applyVoiceSetting() {

    const voiceButton =
        document.getElementById(
            "voiceButton"
        );


    if (!voiceButton) {
        return;
    }


    if (!voiceSupported) {
        return;
    }


    const enabled =
        isVoiceEnabled();


    if (
        !enabled
    ) {

        if (
            isListening &&
            speechRecognition
        ) {

            try {

                speechRecognition.stop();

            } catch (error) {

                console.error(
                    "Voice stop error:",
                    error
                );
            }
        }


        voiceButton.disabled =
            true;


        voiceButton.classList.remove(
            "recording"
        );


        voiceButton.textContent =
            "🎤";


        voiceButton.title =
            "ثبت صوتی غیرفعال است";


        isListening =
            false;


        return;
    }


    if (
        !isSubscriptionActive() &&
        getTrialStatus().status ===
            "expired"
    ) {

        voiceButton.disabled =
            false;


        voiceButton.title =
            "ثبت صوتی";


        return;
    }


    voiceButton.disabled =
        false;


    voiceButton.title =
        "ثبت صوتی";
}


/* =====================================================
   VOICE INPUT
===================================================== */

function initVoiceRecognition() {

    const voiceButton =
        document.getElementById(
            "voiceButton"
        );


    const expenseText =
        document.getElementById(
            "expenseText"
        );


    if (
        !voiceButton ||
        !expenseText
    ) {

        return;
    }


    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

        voiceSupported =
            false;


        voiceButton.disabled =
            true;


        voiceButton.title =
            "مرورگر شما از ورود صوتی پشتیبانی نمی‌کند";


        voiceButton.style.opacity =
            "0.5";


        return;
    }


    voiceSupported =
        true;


    speechRecognition =
        new SpeechRecognition();


    speechRecognition.lang =
        "fa-IR";


    speechRecognition.continuous =
        false;


    speechRecognition.interimResults =
        true;


    speechRecognition.maxAlternatives =
        1;


    speechRecognition.onstart =
        function () {

            isListening =
                true;


            voiceButton.classList.add(
                "recording"
            );


            voiceButton.textContent =
                "🔴";


            voiceButton.title =
                "در حال شنیدن...";


            showToast(
                "🎤 صحبت کنید..."
            );
        };


    speechRecognition.onresult =
        function (
            event
        ) {

            let finalText =
                "";


            let interimText =
                "";


            for (
                let i =
                    event.resultIndex;

                i <
                    event.results.length;

                i++
            ) {

                const transcript =
                    event.results[i][0]
                        .transcript;


                if (
                    event.results[i].isFinal
                ) {

                    finalText +=
                        transcript;

                } else {

                    interimText +=
                        transcript;
                }
            }


            if (
                finalText.trim() !==
                ""
            ) {

                expenseText.value =
                    finalText.trim();


                expenseText.dispatchEvent(
                    new Event(
                        "input",
                        {
                            bubbles:
                                true
                        }
                    )
                );


                showToast(
                    "✅ متن صوتی دریافت شد"
                );

            } else if (
                interimText.trim() !==
                ""
            ) {

                expenseText.value =
                    interimText.trim();


                expenseText.dispatchEvent(
                    new Event(
                        "input",
                        {
                            bubbles:
                                true
                        }
                    )
                );
            }
        };


    speechRecognition.onend =
        function () {

            isListening =
                false;


            voiceButton.classList.remove(
                "recording"
            );


            voiceButton.textContent =
                "🎤";


            if (
                isVoiceEnabled()
            ) {

                voiceButton.title =
                    "ثبت صوتی";

            } else {

                voiceButton.title =
                    "ثبت صوتی غیرفعال است";
            }
        };


    speechRecognition.onerror =
        function (
            event
        ) {

            isListening =
                false;


            voiceButton.classList.remove(
                "recording"
            );


            voiceButton.textContent =
                "🎤";


            voiceButton.title =
                isVoiceEnabled()
                    ? "ثبت صوتی"
                    : "ثبت صوتی غیرفعال است";


            let message =
                "خطا در دریافت صدا";


            switch (
                event.error
            ) {

                case "not-allowed":

                    message =
                        "❌ اجازه دسترسی به میکروفون داده نشد";

                    break;


                case "no-speech":

                    message =
                        "🎤 صدایی دریافت نشد";

                    break;


                case "audio-capture":

                    message =
                        "❌ میکروفون پیدا نشد";

                    break;


                case "network":

                    message =
                        "❌ خطای شبکه در تشخیص صدا";

                    break;


                case "aborted":

                    message =
                        "تشخیص صدا متوقف شد";

                    break;
            }


            showToast(
                message
            );
        };


    voiceButton.addEventListener(
        "click",
        function () {

            if (
                !isVoiceEnabled()
            ) {

                showToast(
                    "ثبت صوتی از تنظیمات غیرفعال شده است."
                );

                return;
            }


            if (
                !requireFeatureAccess()
            ) {

                return;
            }


            if (
                !speechRecognition
            ) {

                return;
            }


            if (
                isListening
            ) {

                speechRecognition.stop();

                return;
            }


            try {

                expenseText.value =
                    "";


                speechRecognition.start();

            } catch (error) {

                console.error(
                    "Voice recognition start error:",
                    error
                );


                showToast(
                    "❌ امکان شروع تشخیص صدا وجود ندارد"
                );
            }
        }
    );


    applyVoiceSetting();
}


/* =====================================================
   REPORTS PAGE
===================================================== */

function reportDateFromISO(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
        return null;
    }

    const parts = String(value).split("-").map(Number);
    const parsed = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);

    if (
        parsed.getFullYear() !== parts[0] ||
        parsed.getMonth() !== parts[1] - 1 ||
        parsed.getDate() !== parts[2]
    ) {
        return null;
    }

    return parsed;
}

function reportDateToISO(value) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// مقدار قابل نمایش در ورودی تقویم شمسی؛ با ارقام لاتین تا Datepicker
// بتواند تاریخ اولیه را بدون ابهام تشخیص دهد. خود تقویم به زبان فارسی است.
function reportDateToJalaliInput(value) {
    const date = value instanceof Date
        ? value
        : reportDateFromISO(value);

    if (!date || Number.isNaN(date.getTime())) return "";

    const parts = new Intl.DateTimeFormat(
        "en-US-u-ca-persian-nu-latn",
        {
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    ).formatToParts(date);

    const part = type => parts.find(item => item.type === type)?.value || "";
    const year = part("year");
    const month = part("month").padStart(2, "0");
    const day = part("day").padStart(2, "0");

    return year && month && day ? `${year}/${month}/${day}` : "";
}

const REPORT_JALALI_MONTHS = [
    "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
    "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
];
const REPORT_JALALI_WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
let reportJalaliPickerState = { input: null, year: null, month: null };

function normalizeReportDateDigits(value) {
    return String(value ?? "").replace(/[۰-۹٠-٩]/g, digit => {
        const persian = "۰۱۲۳۴۵۶۷۸۹";
        const arabic = "٠١٢٣٤٥٦٧٨٩";
        if (persian.includes(digit)) return String(persian.indexOf(digit));
        if (arabic.includes(digit)) return String(arabic.indexOf(digit));
        return digit;
    });
}

function reportGetJalaliParts(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
        year: "numeric", month: "numeric", day: "numeric"
    }).formatToParts(date);
    const part = type => Number(parts.find(item => item.type === type)?.value);
    const result = { year: part("year"), month: part("month"), day: part("day") };
    return Object.values(result).every(Number.isFinite) ? result : null;
}

function reportJalaliToGregorian(year, month, day) {
    year = Number(year); month = Number(month); day = Number(day);
    if (!Number.isInteger(year) || year < 1200 || year > 1600 ||
        !Number.isInteger(month) || month < 1 || month > 12 ||
        !Number.isInteger(day) || day < 1 || day > 31) return null;

    // Find the exact Gregorian date by comparing the browser's built-in Persian calendar.
    // The search window covers the complete Jalali year without a third-party library.
    const cursor = new Date(year + 621, 0, 1, 12, 0, 0, 0);
    for (let i = 0; i < 500; i++) {
        const parts = reportGetJalaliParts(cursor);
        if (parts && parts.year === year && parts.month === month && parts.day === day) {
            return new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 12, 0, 0, 0);
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    return null;
}

function parseReportJalaliInput(value) {
    const text = normalizeReportDateDigits(value).trim();
    if (!text) return { empty: true, date: null };
    const match = text.match(/^(\d{3,4})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{1,2})$/);
    if (!match) return { empty: false, date: null };
    const [year, month, day] = match.slice(1).map(Number);
    const date = reportJalaliToGregorian(year, month, day);
    const parts = date ? reportGetJalaliParts(date) : null;
    if (!parts || parts.year !== year || parts.month !== month || parts.day !== day) {
        return { empty: false, date: null };
    }
    return { empty: false, date };
}

function reportDateToJalaliInput(value) {
    const date = value instanceof Date ? value : reportDateFromISO(value);
    const parts = reportGetJalaliParts(date);
    if (!parts) return "";
    return `${parts.year}/${String(parts.month).padStart(2, "0")}/${String(parts.day).padStart(2, "0")}`;
}

function createReportJalaliPicker() {
    let picker = document.getElementById("reportJalaliPicker");
    if (picker) return picker;

    picker = document.createElement("div");
    picker.id = "reportJalaliPicker";
    picker.className = "report-jalali-picker";
    picker.hidden = true;
    picker.setAttribute("role", "dialog");
    picker.setAttribute("aria-label", "انتخاب تاریخ شمسی");
    picker.innerHTML = `
        <div class="report-jalali-picker-header">
            <button type="button" class="report-jalali-nav" data-jalali-picker-prev aria-label="ماه قبل">‹</button>
            <div class="report-jalali-picker-title" id="reportJalaliPickerTitle"></div>
            <button type="button" class="report-jalali-nav" data-jalali-picker-next aria-label="ماه بعد">›</button>
        </div>
        <div class="report-jalali-weekdays" id="reportJalaliPickerWeekdays"></div>
        <div class="report-jalali-days" id="reportJalaliPickerDays"></div>
        <div class="report-jalali-picker-footer">
            <button type="button" data-jalali-picker-today>امروز</button>
            <button type="button" data-jalali-picker-close>بستن</button>
        </div>`;
    document.body.appendChild(picker);

    picker.querySelector("[data-jalali-picker-prev]").addEventListener("click", () => {
        changeReportJalaliPickerMonth(-1);
    });
    picker.querySelector("[data-jalali-picker-next]").addEventListener("click", () => {
        changeReportJalaliPickerMonth(1);
    });
    picker.querySelector("[data-jalali-picker-today]").addEventListener("click", () => {
        const today = reportDateFromISO(getTodayGregorian());
        if (today) selectReportJalaliPickerDate(today);
    });
    picker.querySelector("[data-jalali-picker-close]").addEventListener("click", closeReportJalaliPicker);

    document.addEventListener("pointerdown", event => {
        if (picker.hidden) return;
        const target = event.target;
        if (picker.contains(target) || target.closest?.(".report-date-input-wrap")) return;
        closeReportJalaliPicker();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeReportJalaliPicker();
    });
    window.addEventListener("resize", repositionReportJalaliPicker);
    window.addEventListener("scroll", repositionReportJalaliPicker, true);

    const weekdays = picker.querySelector("#reportJalaliPickerWeekdays");
    REPORT_JALALI_WEEKDAYS.forEach(name => {
        const cell = document.createElement("span");
        cell.textContent = name;
        weekdays.appendChild(cell);
    });
    return picker;
}

function initializeReportJalaliDatePicker() {
    try {
        createReportJalaliPicker();
        return true;
    } catch (error) {
        console.error("Report Jalali datepicker initialization failed:", error);
        return false;
    }
}

function openReportJalaliPicker(input) {
    if (!input) return;
    initializeReportJalaliDatePicker();
    const picker = document.getElementById("reportJalaliPicker");
    const parsed = parseReportJalaliInput(input.value);
    const hiddenId = input.id === "reportFromDateJalali" ? "reportFromDate" : "reportToDate";
    const hiddenDate = reportDateFromISO(document.getElementById(hiddenId)?.value);
    const date = parsed.date || hiddenDate || reportDateFromISO(getTodayGregorian());
    const parts = reportGetJalaliParts(date);
    if (!parts) return;

    reportJalaliPickerState = { input, year: parts.year, month: parts.month };
    picker.hidden = false;
    input.setAttribute("aria-expanded", "true");
    renderReportJalaliPicker();
    repositionReportJalaliPicker();
}

function closeReportJalaliPicker() {
    const picker = document.getElementById("reportJalaliPicker");
    if (picker) picker.hidden = true;
    if (reportJalaliPickerState.input) {
        reportJalaliPickerState.input.setAttribute("aria-expanded", "false");
    }
}

function repositionReportJalaliPicker() {
    const picker = document.getElementById("reportJalaliPicker");
    const input = reportJalaliPickerState.input;
    if (!picker || picker.hidden || !input) return;
    const rect = input.getBoundingClientRect();
    const width = Math.min(310, window.innerWidth - 16);
    picker.style.width = `${width}px`;
    let left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    let top = rect.bottom + 6;
    const estimatedHeight = picker.offsetHeight || 340;
    if (top + estimatedHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - estimatedHeight - 6);
    }
    picker.style.left = `${left}px`;
    picker.style.top = `${top}px`;
}

function changeReportJalaliPickerMonth(delta) {
    let { year, month } = reportJalaliPickerState;
    if (!year || !month) return;
    month += delta;
    if (month < 1) { month = 12; year--; }
    if (month > 12) { month = 1; year++; }
    if (year < 1200 || year > 1600) return;
    reportJalaliPickerState.year = year;
    reportJalaliPickerState.month = month;
    renderReportJalaliPicker();
    repositionReportJalaliPicker();
}

function renderReportJalaliPicker() {
    const picker = document.getElementById("reportJalaliPicker");
    if (!picker) return;
    const { year, month, input } = reportJalaliPickerState;
    if (!input || !year || !month) return;

    picker.querySelector("#reportJalaliPickerTitle").textContent = `${REPORT_JALALI_MONTHS[month - 1]} ${year}`;
    const daysContainer = picker.querySelector("#reportJalaliPickerDays");
    daysContainer.replaceChildren();

    const first = reportJalaliToGregorian(year, month, 1);
    if (!first) return;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextFirst = reportJalaliToGregorian(nextYear, nextMonth, 1);
    if (!nextFirst) return;
    const daysInMonth = Math.round((Date.UTC(nextFirst.getFullYear(), nextFirst.getMonth(), nextFirst.getDate()) -
        Date.UTC(first.getFullYear(), first.getMonth(), first.getDate())) / 86400000);
    const leadingBlanks = (first.getDay() + 1) % 7; // Saturday first
    for (let i = 0; i < leadingBlanks; i++) {
        const blank = document.createElement("span");
        blank.className = "report-jalali-empty-day";
        blank.setAttribute("aria-hidden", "true");
        daysContainer.appendChild(blank);
    }

    const todayISO = getTodayGregorian();
    const selectedISO = reportDateFromISO(document.getElementById(
        input.id === "reportFromDateJalali" ? "reportFromDate" : "reportToDate"
    )?.value);
    const selectedKey = selectedISO ? reportDateToISO(selectedISO) : "";

    for (let day = 1; day <= daysInMonth; day++) {
        const gregorian = new Date(first.getFullYear(), first.getMonth(), first.getDate() + day - 1, 12, 0, 0, 0);
        const iso = reportDateToISO(gregorian);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "report-jalali-day";
        button.textContent = String(day);
        button.setAttribute("aria-label", `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`);
        if (iso === todayISO) button.classList.add("today");
        if (iso === selectedKey) button.classList.add("selected");
        if (iso > todayISO) {
            button.disabled = true;
            button.title = "تاریخ آینده مجاز نیست";
        } else {
            button.addEventListener("click", () => selectReportJalaliPickerDate(gregorian));
        }
        daysContainer.appendChild(button);
    }

    const todayParts = reportGetJalaliParts(reportDateFromISO(todayISO));
    picker.querySelector("[data-jalali-picker-next]").disabled = !!todayParts &&
        (year > todayParts.year || (year === todayParts.year && month >= todayParts.month));
}

function selectReportJalaliPickerDate(date) {
    const input = reportJalaliPickerState.input;
    if (!input || !date) return;
    const iso = reportDateToISO(date);
    const hiddenId = input.id === "reportFromDateJalali" ? "reportFromDate" : "reportToDate";
    const hidden = document.getElementById(hiddenId);
    input.value = reportDateToJalaliInput(date);
    if (hidden) hidden.value = iso;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    closeReportJalaliPicker();
}

function bindReportJalaliDatePickerInputs() {
    document.querySelectorAll(".report-jalali-date-input").forEach(input => {
        if (input.dataset.reportDatePickerBound === "true") return;
        input.dataset.reportDatePickerBound = "true";
        input.setAttribute("autocomplete", "off");
        input.setAttribute("aria-expanded", "false");

        const syncHiddenValue = () => {
            const result = parseReportJalaliInput(input.value);
            const hiddenId = input.id === "reportFromDateJalali" ? "reportFromDate" : "reportToDate";
            const hidden = document.getElementById(hiddenId);
            if (!hidden) return;
            if (result.empty) {
                hidden.value = "";
            } else if (result.date) {
                hidden.value = reportDateToISO(result.date);
            } else {
                hidden.value = "";
            }
        };

        input.addEventListener("click", () => openReportJalaliPicker(input));
        input.addEventListener("input", () => {
            syncHiddenValue();
            // Close the calendar as soon as the user begins typing, so the field remains editable.
            if (document.activeElement === input) closeReportJalaliPicker();
        });
        input.addEventListener("change", syncHiddenValue);
        input.addEventListener("blur", () => {
            const result = parseReportJalaliInput(input.value);
            if (result.date) {
                input.value = reportDateToJalaliInput(result.date);
                syncHiddenValue();
            }
        });
    });

    document.querySelectorAll("[data-report-date-picker]").forEach(button => {
        if (button.dataset.reportDatePickerBound === "true") return;
        button.dataset.reportDatePickerBound = "true";
        button.addEventListener("click", () => {
            const input = document.getElementById(button.dataset.reportDatePicker);
            if (input) openReportJalaliPicker(input);
        });
    });
}

function shiftReportDate(value, days) {
    const shifted = new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0);
    shifted.setDate(shifted.getDate() + days);
    return shifted;
}

function reportRangeDayCount(fromDate, toDate) {
    return Math.max(
        1,
        Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1
    );
}

function reportDateCaption(fromDate, toDate) {
    if (reportDateToISO(fromDate) === reportDateToISO(toDate)) {
        return toPersianDate(reportDateToISO(fromDate));
    }

    return `${toPersianDate(reportDateToISO(fromDate))} تا ${toPersianDate(reportDateToISO(toDate))}`;
}

function getSelectedReportRange() {
    const today = reportDateFromISO(getTodayGregorian());
    if (!today) {
        throw new Error("تاریخ امروز قابل شناسایی نیست.");
    }

    let fromDate;
    let toDate = today;

    if (activeReportRange === "today") {
        fromDate = today;
    } else if (activeReportRange === "week") {
        // هفته در تقویم رایج ایران از شنبه آغاز می‌شود.
        const daysSinceSaturday = (today.getDay() + 1) % 7;
        fromDate = shiftReportDate(today, -daysSinceSaturday);
    } else if (activeReportRange === "month") {
        fromDate = new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0, 0);
    } else if (activeReportRange === "last-month") {
        fromDate = new Date(today.getFullYear(), today.getMonth() - 1, 1, 12, 0, 0, 0);
        toDate = new Date(today.getFullYear(), today.getMonth(), 0, 12, 0, 0, 0);
    } else {
        fromDate = reportDateFromISO(document.getElementById("reportFromDate")?.value);
        toDate = reportDateFromISO(document.getElementById("reportToDate")?.value);

        if (!fromDate || !toDate) {
            throw new Error("تاریخ شروع و پایان را به‌صورت شمسی وارد کنید؛ نمونه: 1405/07/09. تاریخ خالی یا نامعتبر است.");
        }
        if (fromDate > toDate) {
            throw new Error("تاریخ شروع نباید بعد از تاریخ پایان باشد.");
        }
        if (toDate > today) {
            throw new Error("تاریخ پایان گزارش نمی‌تواند در آینده باشد.");
        }
    }

    return { fromDate, toDate };
}

function setReportDateInputs(fromDate, toDate) {
    const fromInput = document.getElementById("reportFromDate");
    const toInput = document.getElementById("reportToDate");
    const fromJalaliInput = document.getElementById("reportFromDateJalali");
    const toJalaliInput = document.getElementById("reportToDateJalali");
    if (!fromInput || !toInput) return;

    // Hidden inputs retain Gregorian ISO dates for the existing API.
    fromInput.value = reportDateToISO(fromDate);
    toInput.value = reportDateToISO(toDate);

    // Visible inputs are Jalali dates for the user's date picker.
    if (fromJalaliInput) fromJalaliInput.value = reportDateToJalaliInput(fromDate);
    if (toJalaliInput) toJalaliInput.value = reportDateToJalaliInput(toDate);
}

async function fetchReportExpenses(fromDate, toDate) {
    const url = `/api/expenses/?from_date=${encodeURIComponent(reportDateToISO(fromDate))}` +
        `&to_date=${encodeURIComponent(reportDateToISO(toDate))}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.status !== "success") {
        throw new Error(data.message || "دریافت هزینه‌ها ناموفق بود.");
    }

    return Array.isArray(data.expenses) ? data.expenses : [];
}

function summarizeReportExpenses(expenses) {
    const categoryMap = new Map();
    const dailyMap = new Map();
    let totalAmount = 0;

    expenses.forEach(expense => {
        const amount = Number(expense.amount || 0);
        const expenseDate = String(expense.expense_date || "").slice(0, 10);
        const categoryName =
            expense.category_name ||
            expense.category?.category_name ||
            expense.category?.name ||
            "سایر";
        const icon = expense.icon || expense.category?.icon || categoryIcon(categoryName);

        totalAmount += amount;

        if (expenseDate) {
            dailyMap.set(expenseDate, (dailyMap.get(expenseDate) || 0) + amount);
        }

        if (!categoryMap.has(categoryName)) {
            categoryMap.set(categoryName, {
                category_name: categoryName,
                icon,
                total_amount: 0,
                expense_count: 0
            });
        }

        const category = categoryMap.get(categoryName);
        category.total_amount += amount;
        category.expense_count += 1;
    });

    const categories = Array.from(categoryMap.values())
        .sort((a, b) => b.total_amount - a.total_amount);

    categories.forEach(category => {
        category.percentage = totalAmount > 0
            ? (category.total_amount / totalAmount) * 100
            : 0;
    });

    return {
        totalAmount,
        count: expenses.length,
        categories,
        dailyMap
    };
}

function setReportStatus(message, isError = false) {
    const element = document.getElementById("reportsStatus");
    if (!element) return;
    element.textContent = message || "";
    element.classList.toggle("error", Boolean(isError));
}

function renderReportTrendChart(fromDate, toDate, dailyMap) {
    const canvas = document.getElementById("reportTrendChart");
    if (!canvas || typeof Chart === "undefined") return;

    if (reportTrendChart) {
        reportTrendChart.destroy();
        reportTrendChart = null;
    }

    const labels = [];
    const values = [];
    const dayCount = reportRangeDayCount(fromDate, toDate);

    for (let i = 0; i < dayCount; i++) {
        const day = shiftReportDate(fromDate, i);
        const iso = reportDateToISO(day);
        labels.push(toPersianDate(iso));
        values.push(Number(dailyMap.get(iso) || 0));
    }

    reportTrendChart = new Chart(canvas, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "مجموع هزینه",
                data: values,
                borderColor: "#546e7a",
                backgroundColor: "rgba(84, 110, 122, 0.12)",
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: dayCount > 45 ? 0 : 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: "index" },
            plugins: {
                legend: { display: false },
                tooltip: {
                    rtl: true,
                    callbacks: {
                        label: context => ` ${formatMoney(context.parsed.y || 0)}`
                    }
                }
            },
            scales: {
                x: {
                    reverse: false,
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 8,
                        maxRotation: 0,
                        font: { family: "Vazirmatn, Tahoma, Arial" }
                    },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        font: { family: "Vazirmatn, Tahoma, Arial" },
                        callback: value => formatNumber(value)
                    }
                }
            }
        }
    });
}

function renderReportCategoryChart(categories) {
    const canvas = document.getElementById("reportCategoryChart");
    if (!canvas || typeof Chart === "undefined") return;

    if (reportCategoryChart) {
        reportCategoryChart.destroy();
        reportCategoryChart = null;
    }

    const usableCategories = categories.filter(category => Number(category.total_amount) > 0);
    if (!usableCategories.length) return;

    reportCategoryChart = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels: usableCategories.map(category => category.category_name),
            datasets: [{
                data: usableCategories.map(category => Number(category.total_amount || 0)),
                backgroundColor: ["#607d8b", "#80cbc4", "#ffcc80", "#9fa8da", "#ef9a9a", "#a5d6a7", "#ce93d8", "#90caf9", "#bcaaa4", "#cfd8dc"],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "62%",
            plugins: {
                legend: {
                    position: "bottom",
                    rtl: true,
                    labels: {
                        usePointStyle: true,
                        padding: 14,
                        font: { family: "Vazirmatn, Tahoma, Arial" }
                    }
                },
                tooltip: {
                    rtl: true,
                    callbacks: {
                        label: context => ` ${formatMoney(context.raw || 0)}`
                    }
                }
            }
        }
    });
}

function renderReportCategoryBreakdown(categories) {
    const container = document.getElementById("reportCategoryBreakdown");
    if (!container) return;

    if (!categories.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><div>در این بازه هزینه‌ای ثبت نشده است.</div></div>`;
        return;
    }

    container.innerHTML = categories.map(category => {
        const pct = Math.max(0, Math.min(100, Number(category.percentage || 0)));
        return `
            <div class="report-category-row">
                <div class="report-category-row-top">
                    <div class="report-category-name">
                        <span class="report-category-icon">${escapeHtml(category.icon || categoryIcon(category.category_name))}</span>
                        <span>${escapeHtml(category.category_name)}</span>
                    </div>
                    <div class="report-category-amount">${escapeHtml(formatMoney(category.total_amount))}</div>
                </div>
                <div class="report-category-progress"><span style="width:${pct.toFixed(1)}%"></span></div>
                <div class="report-category-row-footer">
                    <span>${toPersianDigits(category.expense_count)} تراکنش</span>
                    <span>${toPersianDigits(pct.toFixed(1))}٪</span>
                </div>
            </div>
        `;
    }).join("");
}

function renderReportComparison(currentTotal, previousTotal, previousRange) {
    const valueEl = document.getElementById("reportComparisonValue");
    const captionEl = document.getElementById("reportComparisonCaption");
    if (!valueEl || !captionEl) return;

    valueEl.className = "report-comparison-value neutral";
    captionEl.textContent = `بازه قبلی: ${reportDateCaption(previousRange.fromDate, previousRange.toDate)}`;

    if (currentTotal === previousTotal) {
        valueEl.textContent = currentTotal === 0 ? "در هر دو بازه هزینه‌ای ثبت نشده است" : "بدون تغییر نسبت به بازه قبلی";
        return;
    }

    if (previousTotal === 0) {
        valueEl.textContent = "در بازه قبلی هزینه‌ای ثبت نشده بود";
        valueEl.classList.add(currentTotal > 0 ? "increase" : "decrease");
        return;
    }

    const difference = currentTotal - previousTotal;
    const percent = Math.abs((difference / previousTotal) * 100);
    const direction = difference > 0 ? "افزایش" : "کاهش";
    valueEl.textContent = `${direction} ${toPersianDigits(percent.toFixed(1))}٪`;
    valueEl.classList.add(difference > 0 ? "increase" : "decrease");
}

async function loadReports() {
    const status = document.getElementById("reportsStatus");
    if (!status) return;

    setReportStatus("در حال دریافت اطلاعات گزارش...");
    const totalEl = document.getElementById("reportTotalAmount");
    const countEl = document.getElementById("reportExpenseCount");
    const averageEl = document.getElementById("reportDailyAverage");
    const topCategoryEl = document.getElementById("reportTopCategory");
    const topCategoryAmountEl = document.getElementById("reportTopCategoryAmount");

    try {
        const range = getSelectedReportRange();
        const rangeDays = reportRangeDayCount(range.fromDate, range.toDate);
        const previousEnd = shiftReportDate(range.fromDate, -1);
        const previousStart = shiftReportDate(previousEnd, -(rangeDays - 1));
        const previousRange = { fromDate: previousStart, toDate: previousEnd };

        const caption = document.getElementById("reportsDateCaption");
        if (caption) caption.textContent = reportDateCaption(range.fromDate, range.toDate);

        const [expenses, previousExpenses] = await Promise.all([
            fetchReportExpenses(range.fromDate, range.toDate),
            fetchReportExpenses(previousRange.fromDate, previousRange.toDate)
        ]);

        currentReportExpenses = expenses;
        const summary = summarizeReportExpenses(expenses);
        const previousSummary = summarizeReportExpenses(previousExpenses);

        if (totalEl) totalEl.textContent = formatMoney(summary.totalAmount);
        if (countEl) countEl.textContent = toPersianDigits(summary.count);
        if (averageEl) averageEl.textContent = formatMoney(Math.round(summary.totalAmount / rangeDays));

        const topCategory = summary.categories[0];
        if (topCategoryEl) topCategoryEl.textContent = topCategory ? topCategory.category_name : "—";
        if (topCategoryAmountEl) topCategoryAmountEl.textContent = topCategory ? formatMoney(topCategory.total_amount) : "بدون هزینه";

        renderReportComparison(summary.totalAmount, previousSummary.totalAmount, previousRange);
        renderReportTrendChart(range.fromDate, range.toDate, summary.dailyMap);
        renderReportCategoryChart(summary.categories);
        renderReportCategoryBreakdown(summary.categories);

        if (expenses.length === 0) {
            setReportStatus("برای این بازه هزینه‌ای ثبت نشده است.");
        } else {
            setReportStatus(`${toPersianDigits(expenses.length)} هزینه در این بازه بررسی شد.`);
        }
    } catch (error) {
        console.error("loadReports ERROR:", error);
        setReportStatus(error.message || "خطا در دریافت گزارش‌ها.", true);
        if (totalEl) totalEl.textContent = "—";
        if (countEl) countEl.textContent = "—";
        if (averageEl) averageEl.textContent = "—";
        if (topCategoryEl) topCategoryEl.textContent = "—";
        if (topCategoryAmountEl) topCategoryAmountEl.textContent = "";
        const comparison = document.getElementById("reportComparisonValue");
        if (comparison) {
            comparison.textContent = "گزارش قابل دریافت نیست";
            comparison.className = "report-comparison-value neutral";
        }
        renderReportCategoryBreakdown([]);
    }
}

function showAppView(viewName) {
    const homeView = document.getElementById("homeView");
    const reportsView = document.getElementById("reportsView");
    const title = document.getElementById("appTitle");
    const showReports = viewName === "reports";

    if (homeView) homeView.hidden = showReports;
    if (reportsView) reportsView.hidden = !showReports;
    if (title) title.textContent = showReports ? "گزارشات" : "مدیریت هزینه";

    document.querySelectorAll('.bottom-nav-item[data-nav]').forEach(item => {
        item.classList.toggle("active", item.dataset.nav === viewName);
    });

    if (showReports) {
        initializeReportJalaliDatePicker();
        bindReportJalaliDatePickerInputs();
        loadReports();
    }
}

function initializeReportControls() {
    const today = reportDateFromISO(getTodayGregorian());
    if (!today) return;

    initializeReportJalaliDatePicker();
    bindReportJalaliDatePickerInputs();

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0, 0);
    setReportDateInputs(monthStart, today);

    document.querySelectorAll("[data-report-range]").forEach(button => {
        button.addEventListener("click", () => {
            activeReportRange = button.dataset.reportRange || "month";
            document.querySelectorAll("[data-report-range]").forEach(item => {
                item.classList.toggle("active", item === button);
            });

            const customDates = document.getElementById("reportCustomDates");
            if (customDates) customDates.hidden = activeReportRange !== "custom";

            if (activeReportRange === "custom") {
                const fromInput = document.getElementById("reportFromDate");
                const toInput = document.getElementById("reportToDate");
                if (fromInput && !fromInput.value) fromInput.value = reportDateToISO(monthStart);
                if (toInput && !toInput.value) toInput.value = getTodayGregorian();

                const fromJalaliInput = document.getElementById("reportFromDateJalali");
                const toJalaliInput = document.getElementById("reportToDateJalali");
                if (fromInput?.value && fromJalaliInput && !fromJalaliInput.value) {
                    fromJalaliInput.value = reportDateToJalaliInput(fromInput.value);
                }
                if (toInput?.value && toJalaliInput && !toJalaliInput.value) {
                    toJalaliInput.value = reportDateToJalaliInput(toInput.value);
                }
                return;
            }

            loadReports();
        });
    });

    const applyButton = document.getElementById("applyReportDates");
    if (applyButton) {
        applyButton.addEventListener("click", () => {
            activeReportRange = "custom";
            document.querySelectorAll("[data-report-range]").forEach(item => {
                item.classList.toggle("active", item.dataset.reportRange === "custom");
            });
            loadReports();
        });
    }
}


/* =====================================================
   REFRESH DASHBOARD
===================================================== */

async function refreshDashboard() {

    loadTodayDate();

    updateSubscriptionStatus();

    applyVoiceSetting();


    if (
        document.getElementById(
            "settingsModal"
        )
    ) {

        updateSettingsSubscriptionStatus();
    }


    await Promise.all([
        loadTodaySummary(),
        loadMonthlySummary(),
        loadCategories(),
        loadExpenses()
    ]);
}


/* =====================================================
   SETTINGS PAGE HELPERS
===================================================== */

function createSettingsDetailModal() {

    let modal =
        document.getElementById(
            "settingsDetailModal"
        );


    if (modal) {
        return modal;
    }


    modal =
        document.createElement(
            "div"
        );


    modal.id =
        "settingsDetailModal";


    modal.className =
        "settings-modal hidden";


    document.body.appendChild(
        modal
    );


    return modal;
}


function closeSettingsDetail() {

    const modal =
        document.getElementById(
            "settingsDetailModal"
        );


    if (!modal) {
        return;
    }


    modal.classList.add(
        "hidden"
    );


    document.body.classList.remove(
        "settings-modal-open"
    );
}


function renderSettingsDetail(
    title,
    subtitle,
    icon,
    content
) {

    const modal =
        createSettingsDetailModal();


    modal.innerHTML = `

        <div class="settings-card">

            <div class="settings-header">

                <div
                    class="settings-header-title"
                >

                    <div
                        class="settings-header-icon"
                    >
                        ${escapeHtml(icon)}
                    </div>


                    <div>

                        <div
                            class="settings-title"
                        >
                            ${escapeHtml(title)}
                        </div>


                        <div
                            class="settings-subtitle"
                        >
                            ${escapeHtml(subtitle)}
                        </div>

                    </div>

                </div>


                <button
                    type="button"
                    class="settings-close"
                    id="settingsDetailCloseButton"
                    aria-label="بستن"
                >
                    ✕
                </button>

            </div>


            <div class="settings-content">

                ${content}

            </div>

        </div>

    `;


    const closeButton =
        document.getElementById(
            "settingsDetailCloseButton"
        );


    if (
        closeButton
    ) {

        closeButton.addEventListener(
            "click",
            closeSettingsDetail
        );
    }


    modal.classList.remove(
        "hidden"
    );


    document.body.classList.add(
        "settings-modal-open"
    );
}


/* =====================================================
   ACCOUNT SETTINGS
===================================================== */

function openAccountSettings() {

    const currentName =
        getDisplayName();


    renderSettingsDetail(
        "حساب کاربری",
        "تنظیمات اطلاعات کاربر",
        "👤",
        `

            <div class="edit-form">

                <label for="settingsDisplayName">
                    نام نمایشی
                </label>


                <input
                    type="text"
                    id="settingsDisplayName"
                    maxlength="100"
                    value="${escapeHtml(
                        currentName
                    )}"
                    placeholder="نام شما"
                />


                <button
                    type="button"
                    class="primary-button full-width"
                    id="saveDisplayNameButton"
                >
                    ذخیره تغییرات
                </button>

            </div>

        `
    );


    const saveButton =
        document.getElementById(
            "saveDisplayNameButton"
        );


    if (
        saveButton
    ) {

        saveButton.addEventListener(
            "click",
            function () {

                const input =
                    document.getElementById(
                        "settingsDisplayName"
                    );


                const name =
                    input?.value.trim() ||
                    "";


                if (!name) {

                    showToast(
                        "لطفاً نام کاربر را وارد کنید."
                    );

                    return;
                }


                setSetting(
                    SETTINGS_KEYS.DISPLAY_NAME,
                    name
                );


                showToast(
                    "نام کاربر ذخیره شد ✅"
                );


                closeSettingsDetail();
            }
        );
    }
}


/* =====================================================
   FINANCIAL SETTINGS
===================================================== */

function openFinancialSettings() {

    const currency =
        getCurrency();


    renderSettingsDetail(
        "تنظیمات مالی",
        "نحوه نمایش مبالغ",
        "💰",
        `

            <div class="edit-form">

                <label for="settingsCurrency">
                    واحد نمایش مبلغ
                </label>


                <select id="settingsCurrency">

                    <option
                        value="toman"
                        ${
                            currency === "toman"
                                ? "selected"
                                : ""
                        }
                    >
                        تومان
                    </option>


                    <option
                        value="rial"
                        ${
                            currency === "rial"
                                ? "selected"
                                : ""
                        }
                    >
                        ریال
                    </option>

                </select>


                <button
                    type="button"
                    class="primary-button full-width"
                    id="saveFinancialSettingsButton"
                >
                    ذخیره تنظیمات
                </button>

            </div>

        `
    );


    const saveButton =
        document.getElementById(
            "saveFinancialSettingsButton"
        );


    if (
        saveButton
    ) {

        saveButton.addEventListener(
            "click",
            async function () {

                const select =
                    document.getElementById(
                        "settingsCurrency"
                    );


                const selectedCurrency =
                    select?.value ||
                    "toman";


                setSetting(
                    SETTINGS_KEYS.CURRENCY,
                    selectedCurrency
                );


                closeSettingsDetail();


                await refreshDashboard();


                showToast(
                    selectedCurrency === "rial"
                        ? "واحد نمایش به ریال تغییر کرد ✅"
                        : "واحد نمایش به تومان تغییر کرد ✅"
                );
            }
        );
    }
}


/* =====================================================
   NOTIFICATION SETTINGS
===================================================== */

function openNotificationSettings() {

    const enabled =
        isNotificationsEnabled();


    renderSettingsDetail(
        "اعلان‌ها",
        "تنظیمات یادآوری",
        "🔔",
        `

            <div class="edit-form">

                <label for="settingsNotifications">
                    وضعیت اعلان‌ها
                </label>


                <select id="settingsNotifications">

                    <option
                        value="true"
                        ${
                            enabled
                                ? "selected"
                                : ""
                        }
                    >
                        فعال
                    </option>


                    <option
                        value="false"
                        ${
                            !enabled
                                ? "selected"
                                : ""
                        }
                    >
                        غیرفعال
                    </option>

                </select>


                <button
                    type="button"
                    class="primary-button full-width"
                    id="saveNotificationSettingsButton"
                >
                    ذخیره تنظیمات
                </button>

            </div>

        `
    );


    const saveButton =
        document.getElementById(
            "saveNotificationSettingsButton"
        );


    if (
        saveButton
    ) {

        saveButton.addEventListener(
            "click",
            function () {

                const select =
                    document.getElementById(
                        "settingsNotifications"
                    );


                const value =
                    select?.value ===
                    "true";


                setSetting(
                    SETTINGS_KEYS.NOTIFICATIONS,
                    value
                );


                closeSettingsDetail();


                showToast(
                    value
                        ? "اعلان‌ها فعال شد ✅"
                        : "اعلان‌ها غیرفعال شد ✅"
                );
            }
        );
    }
}


/* =====================================================
   VOICE SETTINGS
===================================================== */

function openVoiceSettings() {

    const enabled =
        isVoiceEnabled();


    renderSettingsDetail(
        "ثبت صوتی",
        "تنظیمات ورود صوتی هزینه",
        "🎤",
        `

            <div class="edit-form">

                <label for="settingsVoice">
                    وضعیت ثبت صوتی
                </label>


                <select id="settingsVoice">

                    <option
                        value="true"
                        ${
                            enabled
                                ? "selected"
                                : ""
                        }
                    >
                        فعال
                    </option>


                    <option
                        value="false"
                        ${
                            !enabled
                                ? "selected"
                                : ""
                        }
                    >
                        غیرفعال
                    </option>

                </select>


                <button
                    type="button"
                    class="primary-button full-width"
                    id="saveVoiceSettingsButton"
                >
                    ذخیره تنظیمات
                </button>

            </div>

        `
    );


    const saveButton =
        document.getElementById(
            "saveVoiceSettingsButton"
        );


    if (
        saveButton
    ) {

        saveButton.addEventListener(
            "click",
            function () {

                const select =
                    document.getElementById(
                        "settingsVoice"
                    );


                const value =
                    select?.value ===
                    "true";


                setSetting(
                    SETTINGS_KEYS.VOICE_ENABLED,
                    value
                );


                applyVoiceSetting();


                closeSettingsDetail();


                showToast(
                    value
                        ? "ثبت صوتی فعال شد ✅"
                        : "ثبت صوتی غیرفعال شد ✅"
                );
            }
        );
    }
}


/* =====================================================
   THEME SETTINGS
===================================================== */

function openThemeSettings() {

    const theme =
        getThemePreference();


    renderSettingsDetail(
        "ظاهر برنامه",
        "انتخاب حالت نمایش برنامه",
        "🎨",
        `

            <div class="edit-form">

                <label for="settingsTheme">
                    حالت نمایش
                </label>


                <select id="settingsTheme">

                    <option
                        value="system"
                        ${
                            theme === "system"
                                ? "selected"
                                : ""
                        }
                    >
                        سیستم
                    </option>


                    <option
                        value="light"
                        ${
                            theme === "light"
                                ? "selected"
                                : ""
                        }
                    >
                        روشن
                    </option>


                    <option
                        value="dark"
                        ${
                            theme === "dark"
                                ? "selected"
                                : ""
                        }
                    >
                        تاریک
                    </option>

                </select>


                <button
                    type="button"
                    class="primary-button full-width"
                    id="saveThemeSettingsButton"
                >
                    ذخیره تنظیمات
                </button>

            </div>

        `
    );


    const saveButton =
        document.getElementById(
            "saveThemeSettingsButton"
        );


    if (
        saveButton
    ) {

        saveButton.addEventListener(
            "click",
            function () {

                const select =
                    document.getElementById(
                        "settingsTheme"
                    );


                const value =
                    select?.value ||
                    "system";


                setSetting(
                    SETTINGS_KEYS.THEME,
                    value
                );


                applyTheme();


                closeSettingsDetail();


                showToast(
                    "ظاهر برنامه ذخیره شد ✅"
                );
            }
        );
    }
}


/* =====================================================
   SUBSCRIPTION SETTINGS
===================================================== */

function openSubscriptionSettings() {

    const modalContent =
        getTrialStatus();


    let statusTitle =
        "";


    let statusDescription =
        "";


    if (
        isSubscriptionActive()
    ) {

        statusTitle =
            "اشتراک فعال است";


        statusDescription =
            "اشتراک فعلی شما فعال است.";

    } else if (
        modalContent.status ===
        "trial"
    ) {

        statusTitle =
            "نسخه آزمایشی فعال است";


        statusDescription =
            `نسخه آزمایشی شما ${
                toPersianDigits(
                    modalContent.remainingDays
                )
            } روز دیگر اعتبار دارد.`;

    } else if (
        modalContent.status ===
        "warning"
    ) {

        statusTitle =
            "نسخه آزمایشی رو به پایان است";


        statusDescription =
            `فقط ${
                toPersianDigits(
                    modalContent.remainingDays
                )
            } روز از نسخه آزمایشی باقی مانده است.`;

    } else {

        statusTitle =
            "دوره آزمایشی تمام شده است";


        statusDescription =
            "برای ادامه استفاده از امکانات ثبت و مدیریت هزینه، اشتراک را فعال کنید.";
    }


    renderSettingsDetail(
        "اشتراک و Trial",
        "وضعیت دسترسی برنامه",
        "💳",
        `

            <div class="settings-item">

                <div
                    class="settings-item-icon"
                >
                    👑
                </div>


                <div
                    class="settings-item-text"
                >

                    <div
                        class="settings-item-title"
                    >
                        ${escapeHtml(
                            statusTitle
                        )}
                    </div>


                    <div
                        class="settings-item-description"
                    >
                        ${escapeHtml(
                            statusDescription
                        )}
                    </div>

                </div>

            </div>


            <div
                class="edit-form"
                style="margin-top:16px;"
            >

                <button
                    type="button"
                    class="primary-button full-width"
                    id="openSubscriptionPaywallButton"
                >
                    فعال‌سازی اشتراک
                </button>

            </div>

        `
    );


    const paywallButton =
        document.getElementById(
            "openSubscriptionPaywallButton"
        );


    if (
        paywallButton
    ) {

        paywallButton.addEventListener(
            "click",
            function () {

                closeSettingsDetail();


                if (
                    isSubscriptionActive()
                ) {

                    showToast(
                        "اشتراک شما فعال است ✅"
                    );

                    return;
                }


                showSubscriptionPaywall();
            }
        );
    }
}


/* =====================================================
   OPEN SETTINGS SECTION
===================================================== */

function openSettingsSection(
    section
) {

    switch (
        section
    ) {

        case "account":

            openAccountSettings();

            break;


        case "finance":

            openFinancialSettings();

            break;


        case "notifications":

            openNotificationSettings();

            break;


        case "voice":

            openVoiceSettings();

            break;


        case "theme":

            openThemeSettings();

            break;


        case "subscription":

            openSubscriptionSettings();

            break;


        default:

            showToast(
                "این بخش هنوز آماده نشده است."
            );
    }
}


/* =====================================================
   CREATE SETTINGS MODAL
===================================================== */

function createSettingsModal() {

    if (
        document.getElementById(
            "settingsModal"
        )
    ) {

        return;
    }


    const modal =
        document.createElement(
            "div"
        );


    modal.id =
        "settingsModal";


    modal.className =
        "settings-modal hidden";


    modal.innerHTML = `

        <div class="settings-card">

            <div class="settings-header">

                <div
                    class="settings-header-title"
                >

                    <div
                        class="settings-header-icon"
                    >
                        ⚙️
                    </div>


                    <div>

                        <div
                            class="settings-title"
                        >
                            تنظیمات
                        </div>


                        <div
                            class="settings-subtitle"
                        >
                            تنظیمات برنامه و حساب کاربری
                        </div>

                    </div>

                </div>


                <button
                    type="button"
                    class="settings-close"
                    id="settingsCloseButton"
                    aria-label="بستن"
                >
                    ✕
                </button>

            </div>


            <div class="settings-content">


                <button
                    class="settings-item"
                    type="button"
                    data-setting="account"
                >

                    <div class="settings-item-icon">
                        👤
                    </div>


                    <div class="settings-item-text">

                        <div class="settings-item-title">
                            حساب کاربری
                        </div>


                        <div class="settings-item-description">
                            ${escapeHtml(
                                getDisplayName()
                            )}
                        </div>

                    </div>


                    <div class="settings-item-arrow">
                        ‹
                    </div>

                </button>


                <button
                    class="settings-item"
                    type="button"
                    data-setting="finance"
                >

                    <div class="settings-item-icon">
                        💰
                    </div>


                    <div class="settings-item-text">

                        <div class="settings-item-title">
                            تنظیمات مالی
                        </div>


                        <div class="settings-item-description">
                            واحد نمایش: ${
                                getCurrency() === "rial"
                                    ? "ریال"
                                    : "تومان"
                            }
                        </div>

                    </div>


                    <div class="settings-item-arrow">
                        ‹
                    </div>

                </button>


                <button
                    class="settings-item"
                    id="settingsCategoriesButton"
                    type="button"
                >

                    <div class="settings-item-icon">
                        📂
                    </div>


                    <div class="settings-item-text">

                        <div class="settings-item-title">
                            مدیریت دسته‌بندی‌ها
                        </div>


                        <div class="settings-item-description">
                            افزودن، ویرایش و فعال/غیرفعال کردن دسته‌ها
                        </div>

                    </div>


                    <div class="settings-item-arrow">
                        ‹
                    </div>

                </button>


                <button
                    class="settings-item"
                    type="button"
                    data-setting="notifications"
                >

                    <div class="settings-item-icon">
                        🔔
                    </div>


                    <div class="settings-item-text">

                        <div class="settings-item-title">
                            اعلان‌ها
                        </div>


                        <div class="settings-item-description">
                            ${
                                isNotificationsEnabled()
                                    ? "فعال"
                                    : "غیرفعال"
                            }
                        </div>

                    </div>


                    <div class="settings-item-arrow">
                        ‹
                    </div>

                </button>


                <button
                    class="settings-item"
                    type="button"
                    data-setting="voice"
                >

                    <div class="settings-item-icon">
                        🎤
                    </div>


                    <div class="settings-item-text">

                        <div class="settings-item-title">
                            ثبت صوتی
                        </div>


                        <div class="settings-item-description">
                            ${
                                isVoiceEnabled()
                                    ? "فعال"
                                    : "غیرفعال"
                            }
                        </div>

                    </div>


                    <div class="settings-item-arrow">
                        ‹
                    </div>

                </button>


                <button
                    class="settings-item"
                    type="button"
                    data-setting="theme"
                >

                    <div class="settings-item-icon">
                        🎨
                    </div>


                    <div class="settings-item-text">

                        <div class="settings-item-title">
                            ظاهر برنامه
                        </div>


                        <div class="settings-item-description">
                            ${
                                getThemePreference() === "dark"
                                    ? "تاریک"
                                    : getThemePreference() === "light"
                                        ? "روشن"
                                        : "سیستم"
                            }
                        </div>

                    </div>


                    <div class="settings-item-arrow">
                        ‹
                    </div>

                </button>


                <button
                    class="settings-item"
                    id="settingsSubscriptionButton"
                    type="button"
                    data-setting="subscription"
                >

                    <div class="settings-item-icon">
                        💳
                    </div>


                    <div class="settings-item-text">

                        <div class="settings-item-title">
                            اشتراک و Trial
                        </div>


                        <div
                            class="settings-item-description"
                            id="settingsSubscriptionStatus"
                        >
                            در حال بررسی وضعیت اشتراک...
                        </div>

                    </div>


                    <div class="settings-item-arrow">
                        ‹
                    </div>

                </button>

            </div>

        </div>

    `;


    document.body.appendChild(
        modal
    );


    const closeButton =
        document.getElementById(
            "settingsCloseButton"
        );


    if (
        closeButton
    ) {

        closeButton.addEventListener(
            "click",
            closeSettings
        );
    }


    modal.addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                modal
            ) {

                closeSettings();
            }
        }
    );


    modal
        .querySelectorAll(
            "[data-setting]"
        )
        .forEach(
            item => {

                item.addEventListener(
                    "click",
                    function () {

                        openSettingsSection(
                            item.dataset.setting
                        );
                    }
                );
            }
        );


    const categoriesButton =
        document.getElementById(
            "settingsCategoriesButton"
        );


    if (
        categoriesButton
    ) {

        categoriesButton.addEventListener(
            "click",
            openCategoryManagement
        );
    }


    updateSettingsSubscriptionStatus();
}


/* =====================================================
   OPEN SETTINGS
===================================================== */

function openSettings() {

    createSettingsModal();


    const modal =
        document.getElementById(
            "settingsModal"
        );


    if (!modal) {
        return;
    }


    modal.classList.remove(
        "hidden"
    );


    document.body.classList.add(
        "settings-modal-open"
    );


    updateSettingsSubscriptionStatus();
}


/* =====================================================
   CLOSE SETTINGS
===================================================== */

function closeSettings() {

    const modal =
        document.getElementById(
            "settingsModal"
        );


    if (!modal) {
        return;
    }


    modal.classList.add(
        "hidden"
    );


    document.body.classList.remove(
        "settings-modal-open"
    );
}


/* =====================================================
   UPDATE SETTINGS SUBSCRIPTION STATUS
===================================================== */

function updateSettingsSubscriptionStatus() {

    const element =
        document.getElementById(
            "settingsSubscriptionStatus"
        );


    if (!element) {
        return;
    }


    if (
        isSubscriptionActive()
    ) {

        element.textContent =
            "اشتراک فعال است";

        return;
    }


    const status =
        getTrialStatus();


    if (
        status.status ===
        "trial"
    ) {

        element.textContent =
            `نسخه آزمایشی — ${
                toPersianDigits(
                    status.remainingDays
                )
            } روز باقی مانده`;

    } else if (
        status.status ===
        "warning"
    ) {

        element.textContent =
            `نسخه آزمایشی — فقط ${
                toPersianDigits(
                    status.remainingDays
                )
            } روز باقی مانده`;

    } else {

        element.textContent =
            "Trial تمام شده است — فعال‌سازی اشتراک";
    }
}


/* =====================================================
   SETTINGS GLOBALS
===================================================== */

window.openSettings =
    openSettings;


window.closeSettings =
    closeSettings;


window.closeSettingsDetail =
    closeSettingsDetail;


/* =====================================================
   CATEGORY MANAGEMENT
===================================================== */

function createCategoryManagementModal() {

    if (
        document.getElementById(
            "categoryManagementModal"
        )
    ) {

        return;
    }


    const modal =
        document.createElement(
            "div"
        );


    modal.id =
        "categoryManagementModal";


    modal.className =
        "settings-modal hidden";


    modal.innerHTML = `

        <div
            class="settings-card category-management-card"
        >

            <div class="settings-header">

                <div
                    class="settings-header-title"
                >

                    <div
                        class="settings-header-icon"
                    >
                        📂
                    </div>


                    <div>

                        <div
                            class="settings-title"
                        >
                            مدیریت دسته‌بندی‌ها
                        </div>


                        <div
                            class="settings-subtitle"
                        >
                            دسته‌بندی‌های هزینه
                        </div>

                    </div>

                </div>


                <button
                    type="button"
                    class="settings-close"
                    id="categoryManagementCloseButton"
                    aria-label="بستن"
                >
                    ✕
                </button>

            </div>


            <div
                class="category-management-list"
                id="categoryManagementList"
            >

                <div
                    class="category-management-loading"
                >
                    در حال دریافت دسته‌بندی‌ها...
                </div>

            </div>


            <div
                class="category-management-footer"
            >

                <button
                    type="button"
                    class="primary-button"
                    id="addCategoryButton"
                >
                    ➕ افزودن دسته‌بندی
                </button>

            </div>

        </div>

    `;


    document.body.appendChild(
        modal
    );


    const closeButton =
        document.getElementById(
            "categoryManagementCloseButton"
        );


    if (
        closeButton
    ) {

        closeButton.addEventListener(
            "click",
            closeCategoryManagement
        );
    }


    modal.addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                modal
            ) {

                closeCategoryManagement();
            }
        }
    );


    const addCategoryButton =
        document.getElementById(
            "addCategoryButton"
        );


    if (
        addCategoryButton
    ) {

        addCategoryButton.addEventListener(
            "click",
            openAddCategory
        );
    }
}


/* =====================================================
   CATEGORY FORM MODAL
===================================================== */

function createCategoryFormModal() {

    let modal =
        document.getElementById(
            "categoryFormModal"
        );


    if (modal) {

        return modal;
    }


    modal =
        document.createElement(
            "div"
        );


    modal.id =
        "categoryFormModal";


    modal.className =
        "settings-modal hidden";


    document.body.appendChild(
        modal
    );


    return modal;
}


/* =====================================================
   OPEN CATEGORY FORM
===================================================== */

function openCategoryForm(
    mode,
    category = null
) {

    if (
        !requireFeatureAccess()
    ) {

        return;
    }


    const modal =
        createCategoryFormModal();


    const isEdit =
        mode ===
        "edit";


    currentCategoryId =
        isEdit
            ? Number(
                category?.category_id ??
                category?.id
            )
            : null;


    const currentName =
        isEdit
            ? (
                category?.category_name ??
                category?.name ??
                ""
            )
            : "";


    const currentIcon =
        isEdit
            ? getCategoryDisplayIcon(
                category
            )
            : "📁";


    modal.innerHTML = `

        <div class="settings-card">

            <div class="settings-header">

                <div
                    class="settings-header-title"
                >

                    <div
                        class="settings-header-icon"
                    >
                        ${isEdit ? "✏️" : "➕"}
                    </div>


                    <div>

                        <div
                            class="settings-title"
                        >
                            ${
                                isEdit
                                    ? "ویرایش دسته‌بندی"
                                    : "افزودن دسته‌بندی"
                            }
                        </div>


                        <div
                            class="settings-subtitle"
                        >
                            ${
                                isEdit
                                    ? "تغییر نام یا آیکن دسته‌بندی"
                                    : "ایجاد یک دسته‌بندی جدید"
                            }
                        </div>

                    </div>

                </div>


                <button
                    type="button"
                    class="settings-close"
                    id="categoryFormCloseButton"
                    aria-label="بستن"
                >
                    ✕
                </button>

            </div>


            <div class="settings-content">

                <div class="edit-form">

                    <label for="categoryFormName">
                        نام دسته‌بندی
                    </label>


                    <input
                        type="text"
                        id="categoryFormName"
                        maxlength="100"
                        value="${escapeHtml(
                            currentName
                        )}"
                        placeholder="مثلاً رستوران"
                    />


                    <label for="categoryFormIcon">
                        آیکن
                    </label>


                    <input
                        type="text"
                        id="categoryFormIcon"
                        maxlength="10"
                        value="${escapeHtml(
                            currentIcon
                        )}"
                        placeholder="مثلاً 🍔"
                    />


                    <button
                        type="button"
                        class="primary-button full-width"
                        id="saveCategoryButton"
                    >
                        ${
                            isEdit
                                ? "ذخیره تغییرات"
                                : "ایجاد دسته‌بندی"
                        }
                    </button>

                </div>

            </div>

        </div>

    `;


    const closeButton =
        document.getElementById(
            "categoryFormCloseButton"
        );


    if (
        closeButton
    ) {

        closeButton.addEventListener(
            "click",
            closeCategoryForm
        );
    }


    modal.addEventListener(
        "click",
        handleCategoryFormOutsideClick
    );


    const saveButton =
        document.getElementById(
            "saveCategoryButton"
        );


    if (
        saveButton
    ) {

        saveButton.addEventListener(
            "click",
            () =>
                saveCategory(
                    isEdit
                )
        );
    }


    modal.classList.remove(
        "hidden"
    );


    document.body.classList.add(
        "settings-modal-open"
    );


    const nameInput =
        document.getElementById(
            "categoryFormName"
        );


    if (
        nameInput
    ) {

        setTimeout(
            () => {

                nameInput.focus();

            },
            50
        );
    }
}


/* =====================================================
   CATEGORY FORM OUTSIDE CLICK
===================================================== */

function handleCategoryFormOutsideClick(
    event
) {

    const modal =
        document.getElementById(
            "categoryFormModal"
        );


    if (
        modal &&
        event.target ===
            modal
    ) {

        closeCategoryForm();
    }
}


/* =====================================================
   OPEN ADD CATEGORY
===================================================== */

function openAddCategory() {

    openCategoryForm(
        "create"
    );
}


/* =====================================================
   OPEN EDIT CATEGORY
===================================================== */

async function openEditCategory(
    categoryId
) {

    if (
        !requireFeatureAccess()
    ) {

        return;
    }


    try {

        const response =
            await fetch(
                `/api/categories/${encodeURIComponent(
                    categoryId
                )}`
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            data.status !==
                "success"
        ) {

            showToast(
                data.message ||
                "خطا در دریافت دسته‌بندی"
            );

            return;
        }


        openCategoryForm(
            "edit",
            data.category
        );

    } catch (error) {

        console.error(
            "openEditCategory ERROR:",
            error
        );


        showToast(
            "خطا در دریافت دسته‌بندی"
        );
    }
}


/* =====================================================
   CLOSE CATEGORY FORM
===================================================== */

function closeCategoryForm() {

    const modal =
        document.getElementById(
            "categoryFormModal"
        );


    if (!modal) {
        return;
    }


    modal.classList.add(
        "hidden"
    );


    currentCategoryId =
        null;


    /*
     * اگر صفحه مدیریت دسته‌بندی باز است،
     * قفل اسکرول آن را نگه می‌داریم.
     */

    const managementModal =
        document.getElementById(
            "categoryManagementModal"
        );


    if (
        managementModal &&
        !managementModal.classList.contains(
            "hidden"
        )
    ) {

        document.body.classList.add(
            "settings-modal-open"
        );

    } else {

        document.body.classList.remove(
            "settings-modal-open"
        );
    }
}


/* =====================================================
   SAVE CATEGORY
===================================================== */

async function saveCategory(
    isEdit
) {

    if (
        !requireFeatureAccess()
    ) {

        return;
    }


    const nameInput =
        document.getElementById(
            "categoryFormName"
        );


    const iconInput =
        document.getElementById(
            "categoryFormIcon"
        );


    const button =
        document.getElementById(
            "saveCategoryButton"
        );


    const categoryName =
        nameInput?.value.trim() ||
        "";


    let icon =
        iconInput?.value.trim() ||
        "📁";


    if (!categoryName) {

        showToast(
            "لطفاً نام دسته‌بندی را وارد کنید."
        );


        nameInput?.focus();

        return;
    }


    if (
        categoryName.length >
        100
    ) {

        showToast(
            "نام دسته‌بندی بیش از حد طولانی است."
        );

        return;
    }


    if (!icon) {

        icon =
            "📁";
    }


    if (!button) {
        return;
    }


    button.disabled =
        true;


    button.textContent =
        isEdit
            ? "در حال ذخیره..."
            : "در حال ایجاد...";


    try {

        let url =
            "/api/categories/";


        let method =
            "POST";


        let body = {

            category_name:
                categoryName,

            icon:
                icon,

            is_active:
                1
        };


        if (
            isEdit
        ) {

            if (
                !currentCategoryId
            ) {

                showToast(
                    "شناسه دسته‌بندی مشخص نیست."
                );

                return;
            }


            url =
                `/api/categories/${encodeURIComponent(
                    currentCategoryId
                )}`;


            method =
                "PUT";


            body = {

                category_name:
                    categoryName,

                icon:
                    icon
            };
        }


        const response =
            await fetch(
                url,
                {

                    method:
                        method,


                    headers: {

                        "Content-Type":
                            "application/json"
                    },


                    body:
                        JSON.stringify(
                            body
                        )
                }
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            data.status !==
                "success"
        ) {

            showToast(
                data.message ||
                data.detail ||
                (
                    isEdit
                        ? "ویرایش دسته‌بندی انجام نشد."
                        : "ایجاد دسته‌بندی انجام نشد."
                )
            );

            return;
        }


        closeCategoryForm();


        await loadCategoryManagement();


        await refreshDashboard();


        showToast(
            isEdit
                ? "دسته‌بندی با موفقیت ویرایش شد ✅"
                : "دسته‌بندی با موفقیت ایجاد شد ✅"
        );


    } catch (error) {

        console.error(
            "saveCategory ERROR:",
            error
        );


        showToast(
            "خطا در ارتباط با سرور"
        );


    } finally {

        button.disabled =
            false;


        button.textContent =
            isEdit
                ? "ذخیره تغییرات"
                : "ایجاد دسته‌بندی";
    }
}


/* =====================================================
   CHANGE CATEGORY STATUS
===================================================== */

async function changeCategoryStatus(
    categoryId,
    isCurrentlyActive
) {

    if (
        !requireFeatureAccess()
    ) {

        return;
    }


    const newStatus =
        isCurrentlyActive
            ? 0
            : 1;


    const message =
        isCurrentlyActive

            ? "آیا از غیرفعال کردن این دسته‌بندی مطمئن هستید؟"

            : "آیا دسته‌بندی دوباره فعال شود؟";


    if (
        !window.confirm(
            message
        )
    ) {

        return;
    }


    try {

        const response =
            await fetch(
                `/api/categories/${encodeURIComponent(
                    categoryId
                )}/status`,
                {

                    method:
                        "PATCH",


                    headers: {

                        "Content-Type":
                            "application/json"
                    },


                    body:
                        JSON.stringify({

                            is_active:
                                newStatus
                        })
                }
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            data.status !==
                "success"
        ) {

            showToast(
                data.message ||
                "تغییر وضعیت دسته‌بندی انجام نشد."
            );

            return;
        }


        await loadCategoryManagement();


        await refreshDashboard();


        showToast(
            newStatus === 1
                ? "دسته‌بندی فعال شد ✅"
                : "دسته‌بندی غیرفعال شد ✅"
        );


    } catch (error) {

        console.error(
            "changeCategoryStatus ERROR:",
            error
        );


        showToast(
            "خطا در تغییر وضعیت دسته‌بندی"
        );
    }
}


/* =====================================================
   DELETE CATEGORY
   Soft Delete
===================================================== */

async function deleteCategory(
    categoryId,
    categoryName
) {

    if (
        !requireFeatureAccess()
    ) {

        return;
    }


    const confirmed =
        window.confirm(
            `آیا از حذف دسته‌بندی «${categoryName}» مطمئن هستید؟`
        );


    if (!confirmed) {

        return;
    }


    try {

        const response =
            await fetch(
                `/api/categories/${encodeURIComponent(
                    categoryId
                )}`,
                {

                    method:
                        "DELETE"
                }
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            data.status !==
                "success"
        ) {

            showToast(
                data.message ||
                "حذف دسته‌بندی انجام نشد."
            );

            return;
        }


        await loadCategoryManagement();


        await refreshDashboard();


        showToast(
            data.message ||
            "دسته‌بندی حذف شد ✅"
        );


    } catch (error) {

        console.error(
            "deleteCategory ERROR:",
            error
        );


        showToast(
            "خطا در حذف دسته‌بندی"
        );
    }
}


/* =====================================================
   LOAD CATEGORY MANAGEMENT
===================================================== */

async function loadCategoryManagement() {

    const list =
        document.getElementById(
            "categoryManagementList"
        );


    if (!list) {
        return;
    }


    list.innerHTML = `
        <div class="category-management-loading">
            در حال دریافت دسته‌بندی‌ها...
        </div>
    `;


    try {

        /*
         * اینجا عمداً include_inactive=true
         * می‌فرستیم تا دسته‌های غیرفعال نیز
         * در صفحه مدیریت قابل مشاهده باشند.
         */

        const response =
            await fetch(
                "/api/categories/?include_inactive=true"
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }


        const data =
            await response.json();


        if (
            data.status !==
                "success"
        ) {

            throw new Error(
                data.message ||
                "خطا در دریافت دسته‌بندی‌ها"
            );
        }


        const categories =
            data.categories ||
            [];


        if (
            categories.length ===
            0
        ) {

            list.innerHTML = `
                <div
                    class="category-management-empty"
                >
                    هنوز دسته‌بندی‌ای وجود ندارد.
                </div>
            `;

            return;
        }


        list.innerHTML =
            "";


        categories.forEach(
            category => {

                const categoryId =
                    Number(
                        category.category_id ??
                        category.id
                    );


                const categoryName =
                    category.category_name ??
                    category.name ??
                    "بدون نام";


                const icon =
                    getCategoryDisplayIcon(
                        category
                    );


                const isActive =
                    Number(
                        category.is_active ??
                        1
                    ) ===
                    1;


                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "category-management-item";


                item.innerHTML = `

                    <div
                        class="category-management-main"
                    >

                        <div
                            class="category-management-icon"
                        >
                            ${escapeHtml(
                                icon
                            )}
                        </div>


                        <div
                            class="category-management-info"
                        >

                            <div
                                class="category-management-name"
                            >
                                ${escapeHtml(
                                    categoryName
                                )}
                            </div>


                            <div
                                class="category-management-status ${
                                    isActive
                                        ? "active"
                                        : "inactive"
                                }"
                            >
                                ${
                                    isActive
                                        ? "فعال"
                                        : "غیرفعال"
                                }
                            </div>

                        </div>

                    </div>


                    <div
                        class="category-management-actions"
                    >

                        <button
                            type="button"
                            class="category-action-button category-edit-action"
                            title="ویرایش"
                        >
                            ✏️
                        </button>


                        <button
                            type="button"
                            class="category-action-button category-status-action"
                            title="${
                                isActive
                                    ? "غیرفعال کردن"
                                    : "فعال کردن"
                            }"
                        >
                            ${
                                isActive
                                    ? "🔴"
                                    : "🟢"
                            }
                        </button>


                        <button
                            type="button"
                            class="category-action-button category-delete-action"
                            title="حذف"
                        >
                            🗑️
                        </button>

                    </div>

                `;


                /*
                 * ویرایش
                 */

                const editButton =
                    item.querySelector(
                        ".category-edit-action"
                    );


                if (
                    editButton
                ) {

                    editButton.addEventListener(
                        "click",
                        () =>
                            openEditCategory(
                                categoryId
                            )
                    );
                }


                /*
                 * فعال / غیرفعال
                 */

                const statusButton =
                    item.querySelector(
                        ".category-status-action"
                    );


                if (
                    statusButton
                ) {

                    statusButton.addEventListener(
                        "click",
                        () =>
                            changeCategoryStatus(
                                categoryId,
                                isActive
                            )
                    );
                }


                /*
                 * حذف
                 */

                const deleteButton =
                    item.querySelector(
                        ".category-delete-action"
                    );


                if (
                    deleteButton
                ) {

                    deleteButton.addEventListener(
                        "click",
                        () =>
                            deleteCategory(
                                categoryId,
                                categoryName
                            )
                    );
                }


                list.appendChild(
                    item
                );
            }
        );


    } catch (error) {

        console.error(
            "Category management error:",
            error
        );


        list.innerHTML = `

            <div
                class="category-management-error"
            >
                دریافت دسته‌بندی‌ها انجام نشد.
                <br>
                <small>
                    ${escapeHtml(
                        error.message
                    )}
                </small>
            </div>

        `;
    }
}


/* =====================================================
   OPEN CATEGORY MANAGEMENT
===================================================== */

async function openCategoryManagement() {

    if (
        !requireFeatureAccess()
    ) {

        return;
    }


    closeSettings();


    createCategoryManagementModal();


    const modal =
        document.getElementById(
            "categoryManagementModal"
        );


    if (!modal) {
        return;
    }


    modal.classList.remove(
        "hidden"
    );


    document.body.classList.add(
        "settings-modal-open"
    );


    await loadCategoryManagement();
}


/* =====================================================
   CLOSE CATEGORY MANAGEMENT
===================================================== */

function closeCategoryManagement() {

    const modal =
        document.getElementById(
            "categoryManagementModal"
        );


    if (!modal) {
        return;
    }


    modal.classList.add(
        "hidden"
    );


    /*
     * اگر فرم دسته‌بندی نیز باز است، آن را ببند.
     */

    const formModal =
        document.getElementById(
            "categoryFormModal"
        );


    if (
        formModal
    ) {

        formModal.classList.add(
            "hidden"
        );
    }


    currentCategoryId =
        null;


    document.body.classList.remove(
        "settings-modal-open"
    );
}


/* =====================================================
   CATEGORY MANAGEMENT GLOBALS
===================================================== */

window.openCategoryManagement =
    openCategoryManagement;


window.closeCategoryManagement =
    closeCategoryManagement;


window.openAddCategory =
    openAddCategory;


window.openEditCategory =
    openEditCategory;


window.deleteCategory =
    deleteCategory;


/* =====================================================
   INLINE EDIT / DELETE
===================================================== */

window.openEditExpense =
    openEditExpense;


window.openDeleteExpense =
    openDeleteExpense;


/* =====================================================
   EVENTS
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeSettings();

        applyTheme();

        initSystemThemeListener();


        /* =================================================
           SETTINGS BUTTON
        ================================================= */

        const settingsButton =
            document.getElementById(
                "settingsButton"
            );


        if (
            settingsButton
        ) {

            settingsButton.addEventListener(
                "click",
                function (
                    event
                ) {

                    event.stopPropagation();

                    openSettings();
                }
            );
        }


        /* =================================================
           SUBSCRIPTION PAYWALL
        ================================================= */

        createSubscriptionModal();


        /* =================================================
           ثبت هزینه
        ================================================= */

        const saveExpenseButton =
            document.getElementById(
                "saveExpenseButton"
            );


        if (
            saveExpenseButton
        ) {

            saveExpenseButton.addEventListener(
                "click",
                submitExpenseText
            );
        }


        /* =================================================
           Enter
        ================================================= */

        const expenseText =
            document.getElementById(
                "expenseText"
            );


        if (
            expenseText
        ) {

            expenseText.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key ===
                        "Enter"
                    ) {

                        event.preventDefault();

                        submitExpenseText();
                    }
                }
            );
        }


        /* =================================================
           Confirmation
        ================================================= */

        const confirmExpenseButton =
            document.getElementById(
                "confirmExpenseButton"
            );


        if (
            confirmExpenseButton
        ) {

            confirmExpenseButton.addEventListener(
                "click",
                confirmExpense
            );
        }


        const cancelConfirmationButton =
            document.getElementById(
                "cancelConfirmationButton"
            );


        if (
            cancelConfirmationButton
        ) {

            cancelConfirmationButton.addEventListener(
                "click",
                cancelExpense
            );
        }


        const closeModalButton =
            document.getElementById(
                "closeModalButton"
            );


        if (
            closeModalButton
        ) {

            closeModalButton.addEventListener(
                "click",
                cancelExpense
            );
        }


        /* =================================================
           Edit
        ================================================= */

        const saveEditButton =
            document.getElementById(
                "saveEditButton"
            );


        if (
            saveEditButton
        ) {

            saveEditButton.addEventListener(
                "click",
                saveEditExpense
            );
        }


        const cancelEditButton =
            document.getElementById(
                "cancelEditButton"
            );


        if (
            cancelEditButton
        ) {

            cancelEditButton.addEventListener(
                "click",
                closeEditExpense
            );
        }


        const closeEditModalButton =
            document.getElementById(
                "closeEditModalButton"
            );


        if (
            closeEditModalButton
        ) {

            closeEditModalButton.addEventListener(
                "click",
                closeEditExpense
            );
        }


        /* =================================================
           Delete
        ================================================= */

        const confirmDeleteButton =
            document.getElementById(
                "confirmDeleteButton"
            );


        if (
            confirmDeleteButton
        ) {

            confirmDeleteButton.addEventListener(
                "click",
                deleteExpense
            );
        }


        const cancelDeleteButton =
            document.getElementById(
                "cancelDeleteButton"
            );


        if (
            cancelDeleteButton
        ) {

            cancelDeleteButton.addEventListener(
                "click",
                closeDeleteExpense
            );
        }


        const closeDeleteModalButton =
            document.getElementById(
                "closeDeleteModalButton"
            );


        if (
            closeDeleteModalButton
        ) {

            closeDeleteModalButton.addEventListener(
                "click",
                closeDeleteExpense
            );
        }


        /* =================================================
           Refresh
        ================================================= */

        const refreshButton =
            document.getElementById(
                "refreshButton"
            );


        if (
            refreshButton
        ) {

            refreshButton.addEventListener(
                "click",
                refreshDashboard
            );
        }


        /* =================================================
           Bottom Add
        ================================================= */

        const bottomAddButton =
            document.getElementById(
                "bottomAddButton"
            );


        if (
            bottomAddButton
        ) {

            bottomAddButton.addEventListener(
                "click",
                () => {

                    if (
                        !requireFeatureAccess()
                    ) {

                        return;
                    }


                    showAppView("home");

                    const input =
                        document.getElementById(
                            "expenseText"
                        );


                    if (
                        input
                    ) {

                        input.focus();
                    }
                }
            );
        }


        /* =================================================
           Voice
        ================================================= */

        initVoiceRecognition();


        /* =================================================
           Subscription Button
        ================================================= */

        const subscriptionButton =
            document.getElementById(
                "subscriptionStatusButton"
            ) ||
            document.getElementById(
                "notificationButton"
            );


        if (
            subscriptionButton
        ) {

            subscriptionButton.addEventListener(
                "click",
                handleSubscriptionClick
            );
        }


        /* =================================================
           Bottom Navigation
        ================================================= */

        document
            .querySelectorAll(
                ".bottom-nav-item"
            )
            .forEach(
                item => {

                    item.addEventListener(
                        "click",
                        () => {

                            const nav = item.dataset.nav;

                            if (nav === "settings") {
                                return;
                            }

                            if (nav === "home") {
                                showAppView("home");
                                return;
                            }

                            if (nav === "reports") {
                                showAppView("reports");
                                return;
                            }

                            showToast(
                                "بخش حساب‌ها را در مرحله بعد می‌سازیم."
                            );
                        }
                    );
                }
            );

        initializeReportControls();


        /* =================================================
           INITIAL LOAD
        ================================================= */

        refreshDashboard();

    }
);