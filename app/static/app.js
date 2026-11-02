/* =====================================================
   GLOBAL VARIABLES
===================================================== */

let currentConfirmationId = null;
let currentAuthUser = null;
let serverTrialStatus = null;
let pushDailyReminderActive = false;
let appServiceWorkerRegistration = null;
let currentConfirmationData = null;
let currentAccountEditId = null;
let currentAccountCreditId = null;
let creditFormReturnToConfirmation = false;
let currentAccountTransactionsId = null;
let accountFormReturnToConfirmation = false;
let currentAccounts = [];
let includeInactiveAccounts = false;
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

// Canonical business date returned by FastAPI (Asia/Tehran).
let appTodayISO = null;
let voiceSupported = false;


/* =====================================================
   SUBSCRIPTION / TRIAL
===================================================== */

const TRIAL_DAYS = 7;

let MONTHLY_LICENSE_PRICE = 50000;
let serverSubscriptionStatus = { active: false, activeUntil: null };


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
        "expense_app_theme",

    DAILY_REMINDER_TIME:
        "expense_app_daily_reminder_time"
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

async function syncApplicationDate() {
    try {
        const response = await fetch("/api/expenses/clock/today", { cache: "no-store" });
        if (!response.ok) throw new Error(`Clock API HTTP ${response.status}`);
        const data = await response.json();
        if (data?.status === "success" && /^\d{4}-\d{2}-\d{2}$/.test(data.today || "")) {
            appTodayISO = data.today;
            return appTodayISO;
        }
    } catch (error) {
        console.warn("Could not sync application date; using Asia/Tehran fallback.", error);
    }
    return getTodayGregorian();
}

function getTodayGregorian() {
    if (appTodayISO && /^\d{4}-\d{2}-\d{2}$/.test(appTodayISO)) {
        return appTodayISO;
    }

    // Fallback aligns with backend even if the browser computer has another timezone.
    try {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Tehran",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(new Date());
        const values = {};
        for (const part of parts) {
            if (["year", "month", "day"].includes(part.type)) values[part.type] = part.value;
        }
        if (values.year && values.month && values.day) {
            return `${values.year}-${values.month}-${values.day}`;
        }
    } catch (error) {
        console.warn("Asia/Tehran date is unavailable; using browser local date.", error);
    }

    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function getMonthStartGregorian() {
    return `${getTodayGregorian().slice(0, 7)}-01`;
}
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
    if (!dateString) return "";
    let date;
    if (dateString instanceof Date) {
        date = new Date(dateString.getFullYear(), dateString.getMonth(), dateString.getDate(), 12, 0, 0, 0);
    } else {
        const text = String(dateString).slice(0, 10);
        const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        date = match
            ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0)
            : new Date(dateString);
    }
    if (Number.isNaN(date.getTime())) return String(dateString);
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        year: "numeric", month: "2-digit", day: "2-digit"
    }).format(date);
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
    // Trial is authoritative in Oracle; localStorage must not reset it.
    if (!serverTrialStatus || !serverTrialStatus.status) {
        return { status: "expired", remainingDays: 0, trialStart: null, trialEnd: null };
    }
    return {
        status: serverTrialStatus.status,
        remainingDays: Math.max(0, Number(serverTrialStatus.remainingDays || 0)),
        trialStart: serverTrialStatus.createdAt || null,
        trialEnd: serverTrialStatus.trialEnd || null
    };
}

/* =====================================================
   PAID SUBSCRIPTION
===================================================== */

function isSubscriptionActive() {
    // Oracle is authoritative; the browser never grants paid access locally.
    return Boolean(serverSubscriptionStatus && serverSubscriptionStatus.active);
}

async function loadSubscriptionStatus() {
    const response = await fetch("/api/payments/status", {
        credentials: "same-origin",
        cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status !== "success") {
        throw new Error(data.detail || "وضعیت اشتراک دریافت نشد.");
    }
    serverSubscriptionStatus = data.subscription || { active: false, activeUntil: null };
    const serverPrice = Number(data.priceToman);
    if (Number.isFinite(serverPrice) && serverPrice > 0) {
        MONTHLY_LICENSE_PRICE = serverPrice;
    }
    updateSubscriptionStatus();
    return serverSubscriptionStatus;
}

function showPaymentReturnNotice() {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("payment");
    if (!result) return;

    closeSubscriptionPaywall();
    document.body.classList.remove("subscription-modal-open");
    updateSubscriptionStatus();
    if (result === "success") {
        showToast(isSubscriptionActive()
            ? "پرداخت با موفقیت تأیید شد؛ اشتراک شما فعال شد ✅"
            : "پرداخت تأیید شده است؛ وضعیت اشتراک در حال همگام‌سازی است.");
    } else if (result === "failed") {
        showToast("پرداخت انجام نشد یا توسط درگاه تأیید نشد.");
    } else {
        showToast("نتیجه پرداخت هنوز نهایی نشده است؛ کمی بعد وضعیت را بررسی کنید.");
    }

    params.delete("payment");
    const query = params.toString();
    const cleanUrl = window.location.pathname + (query ? `?${query}` : "") + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);
}

async function beginSubscriptionPayment() {
    const button = document.getElementById("buySubscriptionButton");
    if (!button || button.disabled) return;
    const previousText = button.textContent;
    button.disabled = true;
    button.textContent = "در حال اتصال به درگاه...";

    try {
        const response = await fetch("/api/payments/zibal/request", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Accept": "application/json" }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.status !== "success" || !data.checkoutUrl) {
            throw new Error(data.detail || "ایجاد درخواست پرداخت ناموفق بود.");
        }
        const checkoutUrl = new URL(data.checkoutUrl, window.location.origin);
        if (checkoutUrl.protocol !== "https:" || !["gateway.zibal.ir", "gateway.zibal.io"].includes(checkoutUrl.hostname)) {
            throw new Error("آدرس بازگشت درگاه معتبر نیست.");
        }
        // Close the subscription dialog as soon as the server has created a valid
        // checkout session; then leave the app for the official gateway.
        closeSubscriptionPaywall();
        window.location.assign(checkoutUrl.href);
    } catch (error) {
        showToast(error?.message || "ارتباط با درگاه پرداخت برقرار نشد.");
        button.disabled = false;
        button.textContent = previousText || "فعال‌سازی اشتراک";
    }
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
    const button = document.getElementById("subscriptionStatusButton");
    if (!button) return;

    const trial = getTrialStatus();
    button.className = "subscription-icon-button " + (isSubscriptionActive() ? "active" : trial.status);
    button.innerHTML = `
        <span class="subscription-icon" aria-hidden="true">👑</span>
        <span class="subscription-button-label">${isSubscriptionActive() ? "اشتراک فعال" : "تمدید اشتراک"}</span>
    `;

    if (isSubscriptionActive()) {
        button.title = "اشتراک فعال";
    } else if (trial.status === "trial") {
        button.title = `نسخه آزمایشی — ${toPersianDigits(trial.remainingDays)} روز باقی مانده`;
    } else if (trial.status === "warning") {
        button.title = `نسخه آزمایشی — فقط ${toPersianDigits(trial.remainingDays)} روز باقی مانده`;
    } else {
        button.title = "دوره آزمایشی تمام شده است؛ برای ادامه اشتراک تهیه کنید";
    }
    button.setAttribute("aria-label", button.title);
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


            <div class="subscription-paywall-description" id="subscriptionTrialSummary">
                برای ادامه ثبت و مدیریت هزینه‌ها، اشتراک ماهانه را فعال کنید.
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

        buyButton.addEventListener("click", beginSubscriptionPayment);
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
    const modal = document.getElementById("subscriptionPaywall");
    if (!modal) return;

    const title = modal.querySelector(".subscription-paywall-title");
    const summary = document.getElementById("subscriptionTrialSummary");
    const trial = getTrialStatus();

    if (isSubscriptionActive()) {
        if (title) title.textContent = "اشتراک شما فعال است";
        if (summary) summary.textContent = "در صورت نیاز می‌توانید اطلاعات طرح اشتراک را بررسی کنید.";
    } else if (trial.status === "trial") {
        if (title) title.textContent = "دوره آزمایشی فعال است";
        if (summary) summary.textContent = `از تاریخ ثبت‌نام شما در دیتابیس محاسبه شده؛ ${toPersianDigits(trial.remainingDays)} روز باقی مانده است.`;
    } else if (trial.status === "warning") {
        if (title) title.textContent = "دوره آزمایشی رو به پایان است";
        if (summary) summary.textContent = `فقط ${toPersianDigits(trial.remainingDays)} روز از دوره آزمایشی باقی مانده است.`;
    } else {
        if (title) title.textContent = "دوره آزمایشی تمام شده است";
        if (summary) summary.textContent = "برای ادامه استفاده از امکانات ثبت و مدیریت هزینه، اشتراک را فعال کنید.";
    }

    const checkoutButton = document.getElementById("buySubscriptionButton");
    if (checkoutButton) {
        checkoutButton.textContent = isSubscriptionActive()
            ? "تمدید ۳۰ روزه اشتراک"
            : "پرداخت و فعال‌سازی اشتراک";
    }

    modal.classList.remove("hidden");
    document.body.classList.add("subscription-modal-open");
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
    // The header button consistently opens subscription details/checkout.
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
                "/api/expenses/summary/today",
                { cache: "no-store" }
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
                "/api/expenses/summary/month",
                { credentials: "same-origin", cache: "no-store" }
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
                )}`,
                { cache: "no-store" }
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

function showConfirmation(data, preferredAccountId = null) {
    if (!requireFeatureAccess()) return;

    currentConfirmationId = data.confirmation_id;
    currentConfirmationData = data;
    const expense = data.expense || {};

    const descriptionElement = document.getElementById("confirmationDescription");
    const amountElement = document.getElementById("confirmationAmount");
    const categoryElement = document.getElementById("confirmationCategory");
    const dateElement = document.getElementById("confirmationDate");

    if (descriptionElement) descriptionElement.textContent = expense.description || "-";
    if (amountElement) amountElement.textContent = formatMoney(expense.amount || 0);
    if (categoryElement) categoryElement.textContent = expense.category || "-";
    if (dateElement) dateElement.textContent = toPersianDate(expense.expense_date);

    const modal = document.getElementById("confirmationModal");
    if (modal) modal.classList.remove("hidden");

    populateConfirmationAccounts(preferredAccountId);
}

function closeConfirmation() {
    const modal = document.getElementById("confirmationModal");
    if (modal) modal.classList.add("hidden");
    currentConfirmationId = null;
    currentConfirmationData = null;
}

async function populateConfirmationAccounts(preferredAccountId = null) {
    const select = document.getElementById("confirmationAccount");
    const hint = document.getElementById("confirmationAccountHint");
    const confirmButton = document.getElementById("confirmExpenseButton");
    const createButton = document.getElementById("createAccountFromConfirmation");
    if (!select) return;

    select.disabled = true;
    select.innerHTML = '<option value="">در حال دریافت حساب‌ها...</option>';
    if (hint) hint.textContent = "";
    if (confirmButton) confirmButton.disabled = true;

    try {
        const response = await fetch("/api/accounts/");
        const data = await response.json();
        if (!response.ok || data.status !== "success") {
            throw new Error(data.message || "دریافت حساب‌ها ناموفق بود.");
        }

        const accounts = (data.accounts || []).filter(account => account.is_active);
        currentAccounts = accounts;
        select.innerHTML = '<option value="">حساب پرداخت‌کننده را انتخاب کنید</option>';

        const requiredAmount = Number(currentConfirmationData?.expense?.amount || 0);
        accounts.forEach(account => {
            const option = document.createElement("option");
            const balance = Number(account.current_balance || 0);
            const sufficient = balance >= requiredAmount;
            option.value = String(account.account_id);
            option.textContent = `${account.account_name} — ${formatMoney(balance)}${sufficient ? "" : " · موجودی ناکافی"}`;
            option.disabled = !sufficient;
            option.dataset.sufficient = sufficient ? "true" : "false";
            select.appendChild(option);
        });

        const sufficientAccounts = accounts.filter(account => Number(account.current_balance || 0) >= requiredAmount);
        if (preferredAccountId && sufficientAccounts.some(a => Number(a.account_id) === Number(preferredAccountId))) {
            select.value = String(preferredAccountId);
        } else if (sufficientAccounts.length === 1) {
            select.value = String(sufficientAccounts[0].account_id);
        } else if (sufficientAccounts.length === 0) {
            select.value = "";
        }

        if (accounts.length === 0) {
            if (hint) hint.textContent = "برای ثبت این هزینه ابتدا یک حساب ایجاد کنید.";
            if (createButton) createButton.classList.remove("hidden");
            document.getElementById("increaseAccountFromConfirmation")?.classList.add("hidden");
        } else if (sufficientAccounts.length === 0) {
            if (hint) hint.textContent = "موجودی هیچ‌یک از حساب‌ها برای این هزینه کافی نیست. می‌توانید مستقیماً افزایش موجودی ثبت کنید.";
            if (createButton) createButton.classList.remove("hidden");
            document.getElementById("increaseAccountFromConfirmation")?.classList.remove("hidden");
        } else {
            if (hint) hint.textContent = "حسابی را انتخاب کنید که موجودی کافی برای پرداخت این هزینه داشته باشد.";
            if (createButton) createButton.classList.remove("hidden");
            document.getElementById("increaseAccountFromConfirmation")?.classList.remove("hidden");
        }
        select.disabled = accounts.length === 0;
        syncConfirmationSubmitState();
    } catch (error) {
        console.error("populateConfirmationAccounts ERROR:", error);
        select.innerHTML = '<option value="">حساب‌ها بارگذاری نشدند</option>';
        if (hint) hint.textContent = "ارتباط با سرویس حساب‌ها برقرار نشد. دوباره تلاش کنید.";
        if (createButton) createButton.classList.remove("hidden");
        if (confirmButton) confirmButton.disabled = true;
    }
}

function syncConfirmationSubmitState() {
    const select = document.getElementById("confirmationAccount");
    const button = document.getElementById("confirmExpenseButton");
    if (!select || !button || button.textContent.includes("در حال ثبت")) return;
    const selectedOption = select.selectedOptions?.[0];
    button.disabled = !select.value || selectedOption?.dataset?.sufficient === "false" || Boolean(selectedOption?.disabled);
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


    const accountSelect = document.getElementById("confirmationAccount");
    const selectedAccountId = Number(accountSelect?.value || 0);
    if (!selectedAccountId) {
        showToast("لطفاً حساب پرداخت‌کننده را انتخاب کنید.");
        accountSelect?.focus();
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
                                currentConfirmationId,

                            account_id:
                                selectedAccountId
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
            if (data.account_id) {
                await populateConfirmationAccounts(data.account_id);
            }
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
            const cleaned = normalizeMoneyInput(expense.amount);
            amountElement.value = toPersianDigits(
                cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, "٬")
            );
        }


        if (descriptionElement) {

            descriptionElement.value =
                expense.description ||
                "";
        }


        if (dateElement) {
            dateElement.value = normalizeDateInput(expense.expense_date);
        }

        const jalaliDateElement = document.getElementById("editDateJalali");
        if (jalaliDateElement) {
            jalaliDateElement.value = reportDateToJalaliInput(expense.expense_date);
        }


        const selectedCategoryId =
            getExpenseCategoryId(
                expense
            );


        await loadEditCategories(
            selectedCategoryId
        );
        await loadEditAccountOptions(expense.account_id ?? null);


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

    const accountElement = document.getElementById("editExpenseAccount");
    const accountId = accountElement?.value ? Number(accountElement.value) : null;


    const amount =
        Number(normalizeMoneyInput(amountElement?.value || ""));


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
                                expenseDate,

                            account_id:
                                accountId
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
    const date = value instanceof Date ? value : reportDateFromISO(value);
    if (!date || Number.isNaN(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
        year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    const part = type => parts.find(item => item.type === type)?.value || "";
    const year = part("year");
    const month = part("month").padStart(2, "0");
    const day = part("day").padStart(2, "0");
    return year && month && day ? toPersianDigits(`${year}/${month}/${day}`) : "";
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
    if (!date || Number.isNaN(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
        year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    const part = type => parts.find(item => item.type === type)?.value || "";
    const year = part("year");
    const month = part("month").padStart(2, "0");
    const day = part("day").padStart(2, "0");
    return year && month && day ? toPersianDigits(`${year}/${month}/${day}`) : "";
}

function getReportJalaliHiddenInputId(input) {
    if (!input) return null;
    if (input.id === "reportFromDateJalali") return "reportFromDate";
    if (input.id === "reportToDateJalali") return "reportToDate";
    if (input.id === "editDateJalali") return "editDate";
    if (input.id === "accountCreditDateJalali") return "accountCreditDate";
    if (input.id === "accountTransferDateJalali") return "accountTransferDate";
    return null;
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
    const hiddenId = getReportJalaliHiddenInputId(input);
    const hiddenDate = reportDateFromISO(hiddenId ? document.getElementById(hiddenId)?.value : "");
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

    picker.querySelector("#reportJalaliPickerTitle").textContent = `${REPORT_JALALI_MONTHS[month - 1]} ${toPersianDigits(year)}`;
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
    const hiddenId = getReportJalaliHiddenInputId(input);
    const selectedISO = reportDateFromISO(hiddenId ? document.getElementById(hiddenId)?.value : "");
    const selectedKey = selectedISO ? reportDateToISO(selectedISO) : "";

    for (let day = 1; day <= daysInMonth; day++) {
        const gregorian = new Date(first.getFullYear(), first.getMonth(), first.getDate() + day - 1, 12, 0, 0, 0);
        const iso = reportDateToISO(gregorian);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "report-jalali-day";
        button.textContent = toPersianDigits(day);
        button.setAttribute("aria-label", `${toPersianDigits(year)}/${toPersianDigits(String(month).padStart(2, "0"))}/${toPersianDigits(String(day).padStart(2, "0"))}`);
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
    const hiddenId = getReportJalaliHiddenInputId(input);
    const hidden = hiddenId ? document.getElementById(hiddenId) : null;
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
            const hiddenId = getReportJalaliHiddenInputId(input);
            const hidden = hiddenId ? document.getElementById(hiddenId) : null;
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
            const cursor = input.selectionStart;
            const localized = toPersianDigits(input.value);
            if (input.value !== localized) {
                input.value = localized;
                if (cursor !== null) input.setSelectionRange(cursor, cursor);
            }
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
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
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

function renderReportCategoryBreakdown() {
    // Category amounts are represented only by the pie/doughnut chart.
    const container = document.getElementById("reportCategoryBreakdown");
    if (container) container.remove();
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

const REPORT_SCHEDULE_WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

function setReportScheduleStatus(message, isError = false) {
    const el = document.getElementById("reportScheduleStatus");
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("error", Boolean(isError));
}

function updateReportScheduleDayOptions() {
    const frequency = document.getElementById("reportScheduleFrequency")?.value || "WEEKLY";
    const select = document.getElementById("reportScheduleDay");
    const label = document.getElementById("reportScheduleDayLabel");
    if (!select) return;
    const previous = select.value;
    if (frequency === "MONTHLY") {
        if (label) label.textContent = "روز ماه";
        select.innerHTML = Array.from({ length: 28 }, (_, i) => {
            const day = i + 1;
            return `<option value="${day}">روز ${toPersianDigits(day)} ماه</option>`;
        }).join("");
        select.value = String(Math.min(28, Math.max(1, Number(previous) || 1)));
    } else {
        if (label) label.textContent = "روز هفته";
        select.innerHTML = REPORT_SCHEDULE_WEEKDAYS.map((name, i) =>
            `<option value="${i}">${name}</option>`
        ).join("");
        select.value = String(Math.min(6, Math.max(0, Number(previous) || 0)));
    }
}

function syncReportScheduleChannel() {
    const input = document.getElementById("reportScheduleDestination");
    const label = document.getElementById("reportScheduleDestinationLabel");
    const help = document.getElementById("reportScheduleHelp");
    if (input) {
        input.type = "text";
        input.autocomplete = "off";
        input.placeholder = "Chat ID عددی یا شناسه کانال با @";
    }
    if (label) label.textContent = "شناسه چت تلگرام";
    if (help) help.textContent = "گزارش قالب‌بندی‌شده Excel به تلگرام ارسال می‌شود. ابتدا ربات را Start کنید و Chat ID یا شناسه کانال عمومی را وارد کنید.";
}

function reportScheduleDescription(schedule) {
    const timeText = escapeHtml(schedule.send_time || "09:00");
    if (schedule.frequency === "WEEKLY") {
        const day = REPORT_SCHEDULE_WEEKDAYS[Number(schedule.send_day)] || "شنبه";
        return `هر هفته ${day} ساعت ${timeText}`;
    }
    return `هر ماه روز ${toPersianDigits(schedule.send_day)} ساعت ${timeText}`;
}

function reportScheduleChannelLabel(channel) {
    return channel === "TELEGRAM" ? "تلگرام · Excel" : "کانال قدیمی";
}

function renderReportSchedules(schedules) {
    const list = document.getElementById("reportScheduleList");
    if (!list) return;
    if (!schedules.length) {
        list.innerHTML = '<div class="report-schedule-empty">هنوز گزارشی زمان‌بندی نشده است.</div>';
        return;
    }
    list.innerHTML = schedules.map(schedule => {
        const active = Boolean(schedule.is_active);
        const statusLabel = schedule.last_status === "SENT"
            ? "آخرین ارسال موفق"
            : schedule.last_status === "FAILED"
                ? `خطای ارسال: ${escapeHtml(schedule.last_error || "تنظیم کانال را بررسی کنید")}`
                : "در انتظار ارسال";
        const nextRun = schedule.next_run_at ? `ارسال بعدی: ${escapeHtml(schedule.next_run_at)}` : "زمان ارسال مشخص نیست";
        return `
            <article class="report-schedule-item ${active ? "" : "inactive"}">
                <div class="report-schedule-item-main">
                    <strong>${escapeHtml(reportScheduleChannelLabel(schedule.channel))} · ${escapeHtml(schedule.destination)}</strong>
                    <span>${reportScheduleDescription(schedule)}</span>
                    <small>${active ? nextRun : "غیرفعال"} · ${statusLabel}</small>
                </div>
                ${active ? `<button type="button" class="report-schedule-remove" data-report-schedule-delete="${Number(schedule.schedule_id)}" aria-label="غیرفعال کردن زمان‌بندی">غیرفعال</button>` : ""}
            </article>`;
    }).join("");
}

async function loadReportSchedules() {
    const list = document.getElementById("reportScheduleList");
    if (!list) return;
    try {
        const response = await fetch("/api/report-schedules/", { credentials: "same-origin", cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.status !== "success") {
            throw new Error(data.detail || data.message || "دریافت زمان‌بندی‌ها انجام نشد.");
        }
        renderReportSchedules(Array.isArray(data.schedules) ? data.schedules : []);
        setReportScheduleStatus("");
    } catch (error) {
        console.error("loadReportSchedules ERROR:", error);
        list.innerHTML = '<div class="report-schedule-empty">جدول زمان‌بندی گزارش روی دیتابیس نصب نشده یا دریافت اطلاعات ناموفق بود.</div>';
        setReportScheduleStatus(error.message || "دریافت زمان‌بندی‌ها ناموفق بود.", true);
    }
}

async function saveReportSchedule(event) {
    event.preventDefault();
    const button = document.getElementById("saveReportScheduleButton");
    const payload = {
        frequency: document.getElementById("reportScheduleFrequency")?.value || "WEEKLY",
        channel: "TELEGRAM",
        destination: document.getElementById("reportScheduleDestination")?.value.trim() || "",
        send_day: Number(document.getElementById("reportScheduleDay")?.value || 0),
        send_time: document.getElementById("reportScheduleTime")?.value || "09:00"
    };
    if (!payload.destination) {
        setReportScheduleStatus("مقصد ارسال را وارد کنید.", true);
        document.getElementById("reportScheduleDestination")?.focus();
        return;
    }
    if (button) { button.disabled = true; button.textContent = "در حال ذخیره..."; }
    setReportScheduleStatus("در حال ذخیره زمان‌بندی...");
    try {
        const response = await fetch("/api/report-schedules/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.status !== "success") {
            throw new Error(data.detail || data.message || "ذخیره زمان‌بندی انجام نشد.");
        }
        setReportScheduleStatus(data.message || "زمان‌بندی ذخیره شد.");
        showToast(data.message || "زمان‌بندی ذخیره شد.");
        await loadReportSchedules();
    } catch (error) {
        console.error("saveReportSchedule ERROR:", error);
        setReportScheduleStatus(error.message || "ذخیره زمان‌بندی انجام نشد.", true);
    } finally {
        if (button) { button.disabled = false; button.textContent = "ذخیره زمان‌بندی"; }
    }
}

async function deactivateReportSchedule(scheduleId) {
    if (!Number.isInteger(scheduleId) || scheduleId <= 0) return;
    try {
        const response = await fetch(`/api/report-schedules/${scheduleId}`, {
            method: "DELETE",
            credentials: "same-origin"
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.status !== "success") throw new Error(data.detail || data.message || "غیرفعال‌کردن زمان‌بندی انجام نشد.");
        showToast(data.message || "زمان‌بندی غیرفعال شد.");
        await loadReportSchedules();
    } catch (error) {
        setReportScheduleStatus(error.message || "غیرفعال‌کردن زمان‌بندی انجام نشد.", true);
    }
}

function bindReportScheduleControls() {
    const form = document.getElementById("reportScheduleForm");
    if (form && form.dataset.bound !== "true") {
        form.dataset.bound = "true";
        form.addEventListener("submit", saveReportSchedule);
    }
    const frequency = document.getElementById("reportScheduleFrequency");
    if (frequency && frequency.dataset.bound !== "true") {
        frequency.dataset.bound = "true";
        frequency.addEventListener("change", updateReportScheduleDayOptions);
    }
    const channel = document.getElementById("reportScheduleChannel");
    if (channel && channel.dataset.bound !== "true") {
        channel.dataset.bound = "true";
        channel.addEventListener("change", syncReportScheduleChannel);
    }
    const list = document.getElementById("reportScheduleList");
    if (list && list.dataset.bound !== "true") {
        list.dataset.bound = "true";
        list.addEventListener("click", event => {
            const button = event.target.closest("[data-report-schedule-delete]");
            if (button) deactivateReportSchedule(Number(button.dataset.reportScheduleDelete));
        });
    }
    updateReportScheduleDayOptions();
    syncReportScheduleChannel();
}

function accountTypeLabel(type) {
    return ({ CASH: "پول نقد", BANK: "حساب بانکی", CARD: "کارت بانکی" })[String(type || "CASH").toUpperCase()] || "حساب";
}

function accountTypeIcon(type) {
    return ({ CASH: "👛", BANK: "🏦", CARD: "💳" })[String(type || "CASH").toUpperCase()] || "💼";
}

function normalizeMoneyInput(value) {
    return String(value ?? "")
        .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
        .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
        .replace(/[٬,،\s]/g, "");
}

function setAccountsStatus(message = "", isError = false) {
    const el = document.getElementById("accountsStatus");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("error", Boolean(isError));
}

function renderHomeWalletBalances(accounts) {
    const container = document.getElementById("homeWalletBalanceItems");
    const totalEl = document.getElementById("homeWalletTotal");
    if (!container || !totalEl) return;

    const active = (Array.isArray(accounts) ? accounts : []).filter(account => account && account.is_active);
    const total = active.reduce((sum, account) => sum + Number(account.current_balance || 0), 0);
    totalEl.textContent = formatMoney(total);

    if (!active.length) {
        container.innerHTML = '<span class="home-wallet-empty">هنوز کیف پول یا حساب فعالی ثبت نشده است.</span>';
        return;
    }

    container.innerHTML = active
        .slice()
        .sort((a, b) => String(a.account_name || "").localeCompare(String(b.account_name || ""), "fa"))
        .map(account => {
            const balance = Number(account.current_balance || 0);
            const type = String(account.account_type || "CASH").toUpperCase();
            return `<div class="home-wallet-balance-item ${balance < 0 ? "negative" : ""}">
                <span class="home-wallet-account-icon" aria-hidden="true">${accountTypeIcon(type)}</span>
                <span class="home-wallet-account-name">${escapeHtml(account.account_name || accountTypeLabel(type))}</span>
                <strong>${escapeHtml(formatMoney(balance))}</strong>
            </div>`;
        }).join("");
}


async function loadAccounts() {
    const list = document.getElementById("accountsList");
    if (!list) return;
    list.innerHTML = '<div class="loading">در حال دریافت حساب‌ها...</div>';
    setAccountsStatus("");

    try {
        const includeInactive = document.getElementById("showInactiveAccounts")?.checked ?? includeInactiveAccounts;
        const response = await fetch(`/api/accounts/?include_inactive=${includeInactive ? "true" : "false"}`, {
            credentials: "same-origin", cache: "no-store"
        });
        const data = await response.json();
        if (!response.ok || data.status !== "success") throw new Error(data.message || "دریافت حساب‌ها ناموفق بود.");

        currentAccounts = (data.accounts || []).filter(item => item.is_active);
        const shownAccounts = data.accounts || [];
        renderHomeWalletBalances(shownAccounts);
        const active = shownAccounts.filter(item => item.is_active);
        const balanceTotal = active.reduce((sum, item) => sum + Number(item.current_balance || 0), 0);
        const spentTotal = active.reduce((sum, item) => sum + Number(item.spent_total || 0), 0);

        const balanceEl = document.getElementById("accountsTotalBalance");
        const countEl = document.getElementById("accountsActiveCount");
        const spentEl = document.getElementById("accountsSpentTotal");
        const creditEl = document.getElementById("accountsCreditTotal");
        const creditTotal = active.reduce((sum, item) => sum + Number(item.credit_total || 0), 0);
        if (balanceEl) balanceEl.textContent = formatMoney(balanceTotal);
        if (countEl) countEl.textContent = formatNumber(active.length);
        if (spentEl) spentEl.textContent = formatMoney(spentTotal);
        if (creditEl) creditEl.textContent = formatMoney(creditTotal);

        if (!shownAccounts.length) {
            list.innerHTML = `
                <div class="accounts-empty-state">
                    <div class="accounts-empty-icon">💳</div>
                    <strong>هنوز حسابی ثبت نکرده‌ای</strong>
                    <p>اولین حساب را بساز؛ مثلاً کیف پول نقدی یا کارت بانکی.</p>
                    <button type="button" class="primary-button" id="emptyAddAccountButton">ایجاد اولین حساب</button>
                </div>`;
            setAccountsStatus("");
            await loadUsageLevel();
            return;
        }

        list.innerHTML = shownAccounts.map(account => {
            const accountId = Number(account.account_id);
            const type = String(account.account_type || "CASH").toUpperCase();
            const isActive = Boolean(account.is_active);
            const spent = Number(account.spent_total || 0);
            const credits = Number(account.credit_total || 0);
            const transferIn = Number(account.transfer_in_total || 0);
            const transferOut = Number(account.transfer_out_total || 0);
            const netTransfer = transferIn - transferOut;
            const netTransferText = netTransfer > 0
                ? `+${formatMoney(netTransfer)}`
                : formatMoney(netTransfer);
            const balance = Number(account.current_balance || 0);
            return `
                <article class="account-card ${isActive ? "" : "account-card-inactive"}" data-account-id="${accountId}">
                    <div class="account-card-top">
                        <div class="account-card-identity">
                            <div class="account-card-icon">${accountTypeIcon(type)}</div>
                            <div class="account-card-names">
                                <h3>${escapeHtml(account.account_name || "حساب بدون نام")}</h3>
                                <span>${escapeHtml(accountTypeLabel(type))}${isActive ? "" : " · غیرفعال"}</span>
                            </div>
                        </div>
                        <div class="account-card-menu">
                            <button type="button" class="account-icon-action" data-account-action="edit" data-account-id="${accountId}" title="ویرایش حساب" aria-label="ویرایش حساب">✏️</button>
                            ${isActive
                                ? `<button type="button" class="account-icon-action account-icon-danger" data-account-action="deactivate" data-account-id="${accountId}" title="غیرفعال‌سازی" aria-label="غیرفعال‌سازی حساب">⏸</button>`
                                : `<button type="button" class="account-icon-action" data-account-action="activate" data-account-id="${accountId}" title="فعال‌سازی" aria-label="فعال‌سازی حساب">▶</button>`}
                        </div>
                    </div>
                    <div class="account-balance-block ${balance < 0 ? "account-balance-negative" : ""}">
                        <span>موجودی فعلی</span>
                        <strong>${formatMoney(balance)}</strong>
                    </div>
                    <div class="account-card-stats">
                        <div><span>موجودی اولیه</span><strong>${formatMoney(Number(account.initial_balance || 0))}</strong></div>
                        <div><span>درآمد و واریز</span><strong>${formatMoney(credits)}</strong></div>
                        <div><span>هزینه‌های ثبت‌شده</span><strong>${formatMoney(spent)}</strong></div>
                        <div><span>خالص انتقال</span><strong class="${netTransfer > 0 ? "account-stat-positive" : netTransfer < 0 ? "account-stat-negative" : ""}" title="انتقال ورودی منهای انتقال خروجی">${netTransferText}</strong></div>
                        <div><span>تعداد هزینه</span><strong>${formatNumber(Number(account.expense_count || 0))}</strong></div>
                    </div>
                    ${isActive ? `<button type="button" class="account-credit-button" data-account-action="credit" data-account-id="${accountId}">＋ ثبت درآمد / افزایش موجودی</button>` : ""}
                    <button type="button" class="account-transactions-button" data-account-action="history" data-account-id="${accountId}">
                        مشاهده گردش حساب <span aria-hidden="true">←</span>
                    </button>
                </article>`;
        }).join("");
        setAccountsStatus(`${formatNumber(shownAccounts.length)} حساب نمایش داده شد.`);
        await loadUsageLevel();
    } catch (error) {
        console.error("loadAccounts ERROR:", error);
        list.innerHTML = '<div class="empty-state">خطا در دریافت حساب‌ها. سرویس حساب‌ها و اتصال Oracle را بررسی کنید.</div>';
        setAccountsStatus(error.message || "خطا در دریافت حساب‌ها.", true);
        const homeWallet = document.getElementById("homeWalletBalanceItems");
        const homeTotal = document.getElementById("homeWalletTotal");
        if (homeWallet) homeWallet.innerHTML = '<span class="home-wallet-empty">موجودی در حال حاضر قابل دریافت نیست؛ دوباره تلاش کنید.</span>';
        if (homeTotal) homeTotal.textContent = "—";
    }
}

function openAccountForm(account = null) {
    currentAccountEditId = account ? Number(account.account_id) : null;
    const modal = document.getElementById("accountModal");
    const title = document.getElementById("accountModalTitle");
    const nameInput = document.getElementById("accountNameInput");
    const typeInput = document.getElementById("accountTypeInput");
    const balanceInput = document.getElementById("accountInitialBalanceInput");
    const saveButton = document.getElementById("saveAccountButton");

    if (title) title.textContent = account ? "ویرایش حساب" : "ایجاد حساب جدید";
    if (nameInput) nameInput.value = account?.account_name || "";
    if (typeInput) typeInput.value = String(account?.account_type || "CASH").toUpperCase();
    if (balanceInput) balanceInput.value = account ? String(account.initial_balance || 0) : "0";
    if (saveButton) saveButton.textContent = account ? "ذخیره تغییرات" : "ذخیره حساب";
    if (modal) modal.classList.remove("hidden");
    setTimeout(() => nameInput?.focus(), 50);
}

function closeAccountForm(restoreConfirmation = true) {
    document.getElementById("accountModal")?.classList.add("hidden");
    currentAccountEditId = null;
    if (restoreConfirmation && accountFormReturnToConfirmation && currentConfirmationData) {
        accountFormReturnToConfirmation = false;
        showConfirmation(currentConfirmationData);
    }
}

async function saveAccount() {
    const name = document.getElementById("accountNameInput")?.value.trim() || "";
    const type = document.getElementById("accountTypeInput")?.value || "CASH";
    const balanceRaw = normalizeMoneyInput(document.getElementById("accountInitialBalanceInput")?.value || "0");
    const balance = Number(balanceRaw || 0);
    if (!name) return showToast("نام حساب را وارد کنید.");
    if (!Number.isFinite(balance) || balance < 0 || !Number.isSafeInteger(balance)) return showToast("موجودی اولیه باید عدد صحیح و نامنفی باشد.");

    const button = document.getElementById("saveAccountButton");
    const isEditing = currentAccountEditId !== null;
    const defaultButtonText = isEditing ? "ذخیره تغییرات" : "ذخیره حساب";
    if (button) { button.disabled = true; button.textContent = "در حال ذخیره..."; }
    try {
        const url = isEditing ? `/api/accounts/${currentAccountEditId}` : "/api/accounts/";
        const response = await fetch(url, {
            method: isEditing ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ account_name: name, account_type: type, initial_balance: balance })
        });
        const data = await response.json();
        if (!response.ok || data.status !== "success") throw new Error(data.message || "ذخیره حساب انجام نشد.");

        const createdAccountId = data.account_id ?? null;
        closeAccountForm(false);
        accountFormReturnToConfirmation = false;
        showToast(data.message || "حساب ذخیره شد.");
        await loadAccounts();

        if (!isEditing && currentConfirmationId && currentConfirmationData) {
            showConfirmation(currentConfirmationData, createdAccountId);
        }
    } catch (error) {
        console.error("saveAccount ERROR:", error);
        showToast(error.message || "خطا در ذخیره حساب.");
    } finally {
        if (button) { button.disabled = false; button.textContent = defaultButtonText; }
    }
}

function openAccountCreditForm(account) {
    if (!account || !account.is_active) {
        showToast("برای ثبت درآمد یا افزایش موجودی، یک حساب فعال انتخاب کنید.");
        return;
    }

    currentAccountCreditId = Number(account.account_id);
    const modal = document.getElementById("accountCreditModal");
    const title = document.getElementById("accountCreditModalTitle");
    const label = document.getElementById("accountCreditAccountLabel");
    const amount = document.getElementById("accountCreditAmountInput");
    const description = document.getElementById("accountCreditDescriptionInput");
    const type = document.getElementById("accountCreditTypeInput");
    const dateHidden = document.getElementById("accountCreditDate");
    const dateVisible = document.getElementById("accountCreditDateJalali");
    if (title) title.textContent = "ثبت درآمد یا افزایش موجودی";
    if (label) label.textContent = `حساب: ${account.account_name} · موجودی فعلی: ${formatMoney(account.current_balance || 0)}`;
    if (amount) amount.value = "";
    if (description) description.value = "";
    if (type) type.value = "DEPOSIT";
    if (dateHidden) dateHidden.value = getTodayGregorian();
    if (dateVisible) dateVisible.value = reportDateToJalaliInput(reportDateFromISO(getTodayGregorian()));
    if (modal) modal.classList.remove("hidden");
    initializeReportJalaliDatePicker();
    bindReportJalaliDatePickerInputs();
    setTimeout(() => amount?.focus(), 50);
}

function closeAccountCreditForm() {
    document.getElementById("accountCreditModal")?.classList.add("hidden");
    currentAccountCreditId = null;
    if (creditFormReturnToConfirmation && currentConfirmationId && currentConfirmationData) {
        creditFormReturnToConfirmation = false;
        const confirmationModal = document.getElementById("confirmationModal");
        if (confirmationModal) confirmationModal.classList.remove("hidden");
        populateConfirmationAccounts();
    }
}

async function saveAccountCredit() {
    if (!currentAccountCreditId) return;

    const type = document.getElementById("accountCreditTypeInput")?.value || "DEPOSIT";
    const amountRaw = normalizeMoneyInput(document.getElementById("accountCreditAmountInput")?.value || "");
    const amount = Number(amountRaw);
    const description = document.getElementById("accountCreditDescriptionInput")?.value.trim() || "";
    const creditDate = document.getElementById("accountCreditDate")?.value || "";

    if (!Number.isSafeInteger(amount) || amount <= 0) {
        showToast("مبلغ باید عدد صحیح و بیشتر از صفر باشد.");
        document.getElementById("accountCreditAmountInput")?.focus();
        return;
    }
    if (!description) {
        showToast("شرح درآمد یا افزایش موجودی را وارد کنید.");
        document.getElementById("accountCreditDescriptionInput")?.focus();
        return;
    }
    if (!creditDate) {
        showToast("تاریخ شمسی را به‌درستی انتخاب یا وارد کنید.");
        document.getElementById("accountCreditDateJalali")?.focus();
        return;
    }
    if (creditDate > getTodayGregorian()) {
        showToast("تاریخ تراکنش نمی‌تواند در آینده باشد.");
        return;
    }

    const button = document.getElementById("saveAccountCreditButton");
    if (button) {
        button.disabled = true;
        button.textContent = "در حال ثبت...";
    }
    try {
        const response = await fetch(`/api/accounts/${currentAccountCreditId}/credits`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                amount,
                credit_type: type,
                description,
                credit_date: creditDate
            })
        });
        const data = await response.json();
        if (!response.ok || data.status !== "success") throw new Error(data.message || "ثبت درآمد یا افزایش موجودی انجام نشد.");

        const accountId = currentAccountCreditId;
        closeAccountCreditForm();
        showToast(data.message || "تراکنش ثبت شد.");
        await loadAccounts();
        if (currentAccountTransactionsId === accountId && !document.getElementById("accountTransactionsModal")?.classList.contains("hidden")) {
            await openAccountTransactions(accountId);
        }
        // Also refresh active expense confirmation account balances if it is currently open.
        if (currentConfirmationId) await populateConfirmationAccounts(accountId);
    } catch (error) {
        console.error("saveAccountCredit ERROR:", error);
        showToast(error.message || "خطا در ثبت درآمد یا افزایش موجودی.");
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "ثبت";
        }
    }
}

async function openAccountTransferForm() {
    const modal = document.getElementById("accountTransferModal");
    const fromSelect = document.getElementById("accountTransferFromInput");
    const toSelect = document.getElementById("accountTransferToInput");
    const amount = document.getElementById("accountTransferAmountInput");
    const description = document.getElementById("accountTransferDescriptionInput");
    const dateHidden = document.getElementById("accountTransferDate");
    const dateVisible = document.getElementById("accountTransferDateJalali");

    let accounts = (currentAccounts || []).filter(account => account.is_active);
    if (accounts.length < 2) {
        try {
            const response = await fetch("/api/accounts/");
            const data = await response.json();
            if (response.ok && data.status === "success") {
                accounts = (data.accounts || []).filter(account => account.is_active);
                currentAccounts = accounts;
            }
        } catch (error) {
            console.error("openAccountTransferForm account fetch:", error);
        }
    }
    if (accounts.length < 2) {
        showToast("برای انتقال وجه، حداقل دو حساب فعال لازم است.");
        return;
    }

    const optionMarkup = accounts.map(account =>
        `<option value="${Number(account.account_id)}">${escapeHtml(account.account_name)} · موجودی ${escapeHtml(formatMoney(account.current_balance || 0))}</option>`
    ).join("");
    if (fromSelect) fromSelect.innerHTML = optionMarkup;
    if (toSelect) toSelect.innerHTML = optionMarkup;
    if (fromSelect) fromSelect.value = String(accounts[0].account_id);
    if (toSelect) toSelect.value = String(accounts.find(account => Number(account.account_id) !== Number(accounts[0].account_id))?.account_id || accounts[1].account_id);

    if (amount) amount.value = "";
    if (description) description.value = "انتقال وجه";
    if (dateHidden) dateHidden.value = getTodayGregorian();
    if (dateVisible) dateVisible.value = reportDateToJalaliInput(reportDateFromISO(getTodayGregorian()));
    if (modal) modal.classList.remove("hidden");
    initializeReportJalaliDatePicker();
    bindReportJalaliDatePickerInputs();
    syncAccountTransferBalanceHint();
    setTimeout(() => amount?.focus(), 50);
}

function closeAccountTransferForm() {
    document.getElementById("accountTransferModal")?.classList.add("hidden");
}

function syncAccountTransferBalanceHint() {
    const fromId = Number(document.getElementById("accountTransferFromInput")?.value || 0);
    const toId = Number(document.getElementById("accountTransferToInput")?.value || 0);
    const fromAccount = (currentAccounts || []).find(account => Number(account.account_id) === fromId);
    const toAccount = (currentAccounts || []).find(account => Number(account.account_id) === toId);
    const hint = document.getElementById("accountTransferBalanceHint");
    if (!hint) return;
    if (fromId && toId && fromId === toId) {
        hint.textContent = "حساب مبدأ و مقصد باید متفاوت باشند.";
        hint.classList.add("error");
        return;
    }
    hint.classList.remove("error");
    hint.textContent = `موجودی مبدأ: ${formatMoney(fromAccount?.current_balance || 0)} · موجودی مقصد: ${formatMoney(toAccount?.current_balance || 0)}`;
}

async function saveAccountTransfer() {
    const fromId = Number(document.getElementById("accountTransferFromInput")?.value || 0);
    const toId = Number(document.getElementById("accountTransferToInput")?.value || 0);
    const amountRaw = normalizeMoneyInput(document.getElementById("accountTransferAmountInput")?.value || "");
    const amount = Number(amountRaw);
    const description = document.getElementById("accountTransferDescriptionInput")?.value.trim() || "انتقال وجه";
    const transferDate = document.getElementById("accountTransferDate")?.value || "";

    if (!fromId || !toId || fromId === toId) {
        showToast("لطفاً دو حساب متفاوت برای مبدأ و مقصد انتخاب کنید.");
        return;
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) {
        showToast("مبلغ انتقال باید عدد صحیح و بیشتر از صفر باشد.");
        document.getElementById("accountTransferAmountInput")?.focus();
        return;
    }
    if (!transferDate) {
        showToast("تاریخ شمسی را به‌درستی انتخاب یا وارد کنید.");
        document.getElementById("accountTransferDateJalali")?.focus();
        return;
    }
    if (transferDate > getTodayGregorian()) {
        showToast("تاریخ انتقال نمی‌تواند در آینده باشد.");
        return;
    }

    const button = document.getElementById("saveAccountTransferButton");
    if (button) {
        button.disabled = true;
        button.textContent = "در حال ثبت...";
    }
    try {
        const response = await fetch("/api/accounts/transfers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                from_account_id: fromId,
                to_account_id: toId,
                amount,
                description,
                transfer_date: transferDate
            })
        });
        const data = await response.json();
        if (!response.ok || data.status !== "success") {
            throw new Error(data.message || "انتقال وجه ثبت نشد.");
        }
        closeAccountTransferForm();
        showToast(data.message || "انتقال وجه با موفقیت ثبت شد.");
        await loadAccounts();
        const historyModal = document.getElementById("accountTransactionsModal");
        if (currentAccountTransactionsId && historyModal && !historyModal.classList.contains("hidden") &&
            [fromId, toId].includes(Number(currentAccountTransactionsId))) {
            await openAccountTransactions(Number(currentAccountTransactionsId));
        }
    } catch (error) {
        console.error("saveAccountTransfer ERROR:", error);
        showToast(error.message || "خطا در ثبت انتقال وجه.");
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "تأیید انتقال";
        }
    }
}

async function loadEditAccountOptions(selectedAccountId = null) {
    const select = document.getElementById("editExpenseAccount");
    if (!select) return;
    select.innerHTML = '<option value="">بدون تغییر / حساب انتخاب نشده</option>';
    try {
        const response = await fetch("/api/accounts/");
        const data = await response.json();
        if (!response.ok || data.status !== "success") return;
        const accounts = (data.accounts || []).filter(account => account.is_active);
        for (const account of accounts) {
            const option = document.createElement("option");
            option.value = String(account.account_id);
            option.textContent = `${account.account_name} (${accountTypeLabel(account.account_type)})`;
            select.appendChild(option);
        }
        if (selectedAccountId && accounts.some(a => Number(a.account_id) === Number(selectedAccountId))) {
            select.value = String(selectedAccountId);
        }
    } catch (error) {
        console.error("loadEditAccountOptions ERROR:", error);
    }
}

async function openAccountTransactions(accountId) {
    const modal = document.getElementById("accountTransactionsModal");
    const title = document.getElementById("accountTransactionsTitle");
    const subtitle = document.getElementById("accountTransactionsSubtitle");
    const list = document.getElementById("accountTransactionsList");
    currentAccountTransactionsId = Number(accountId);
    if (modal) modal.classList.remove("hidden");
    if (title) title.textContent = "گردش حساب";
    if (subtitle) subtitle.textContent = "در حال دریافت اطلاعات...";
    if (list) list.innerHTML = '<div class="loading">در حال دریافت گردش حساب...</div>';

    try {
        const response = await fetch(`/api/accounts/${Number(accountId)}/transactions?limit=100`);
        const data = await response.json();
        if (!response.ok || data.status !== "success") throw new Error(data.message || "گردش حساب دریافت نشد.");
        if (title) title.textContent = `گردش ${data.account_name || "حساب"}`;
        if (subtitle) subtitle.textContent = `${formatNumber(data.count || 0)} تراکنش اخیر · ورودی‌ها و انتقال‌های دریافتی سبز، هزینه‌ها و انتقال‌های خروجی قرمز نمایش داده می‌شوند.`;
        if (!data.transactions?.length) {
            if (list) list.innerHTML = '<div class="accounts-empty-state compact"><div class="accounts-empty-icon">🧾</div><p>هنوز تراکنشی به این حساب متصل نشده است.</p></div>';
            return;
        }
        if (list) list.innerHTML = data.transactions.map(transaction => {
            const incoming = transaction.direction === "in";
            const sign = incoming ? "+" : "−";
            const icon = incoming ? "↗" : "↙";
            const amountClass = incoming ? "incoming" : "outgoing";
            const label = transaction.transaction_label || transaction.category_name || "تراکنش";
            return `
                <div class="account-transaction-row ${incoming ? "account-transaction-incoming" : "account-transaction-outgoing"}">
                    <div class="account-transaction-icon ${incoming ? "incoming" : "outgoing"}">${icon}</div>
                    <div class="account-transaction-main">
                        <strong>${escapeHtml(transaction.description || "بدون توضیح")}</strong>
                        <span>${escapeHtml(label)} · ${toPersianDate(transaction.expense_date || "")}</span>
                    </div>
                    <div class="account-transaction-amount ${amountClass}">${sign}${formatMoney(transaction.amount || 0)}</div>
                </div>`;
        }).join("");
    } catch (error) {
        console.error("openAccountTransactions ERROR:", error);
        if (list) list.innerHTML = `<div class="empty-state">${escapeHtml(error.message || "خطا در دریافت گردش حساب")}</div>`;
    }
}

async function handleAccountListAction(event) {
    const button = event.target.closest("[data-account-action]");
    if (!button) return;
    const accountId = Number(button.dataset.accountId);
    const action = button.dataset.accountAction;
    const account = (currentAccounts || []).find(item => Number(item.account_id) === accountId)
        || await findAccountForAction(accountId);

    if (action === "edit") {
        if (account) openAccountForm(account);
        else showToast("اطلاعات حساب پیدا نشد.");
        return;
    }
    if (action === "history") {
        await openAccountTransactions(accountId);
        return;
    }
    if (action === "credit") {
        if (account) openAccountCreditForm(account);
        else showToast("اطلاعات حساب پیدا نشد.");
        return;
    }
    if (action === "deactivate" && !window.confirm("این حساب غیرفعال شود؟ سوابق هزینه‌ها حذف نمی‌شوند.")) return;
    if (!(["deactivate", "activate"].includes(action))) return;

    try {
        const response = await fetch(`/api/accounts/${accountId}/${action}`, { method: "POST" });
        const data = await response.json();
        if (!response.ok || data.status !== "success") throw new Error(data.message || "عملیات انجام نشد.");
        showToast(data.message || "وضعیت حساب تغییر کرد.");
        await loadAccounts();
    } catch (error) {
        showToast(error.message || "خطا در تغییر وضعیت حساب.");
    }
}

async function findAccountForAction(accountId) {
    try {
        const response = await fetch("/api/accounts/?include_inactive=true");
        const data = await response.json();
        if (data.status === "success") return (data.accounts || []).find(item => Number(item.account_id) === Number(accountId)) || null;
    } catch (error) {
        console.error("findAccountForAction ERROR:", error);
    }
    return null;
}

function showAppView(viewName) {
    const homeView = document.getElementById("homeView");
    const reportsView = document.getElementById("reportsView");
    const accountsView = document.getElementById("accountsView");
    const title = document.getElementById("appTitle");
    const showHome = viewName === "home";
    const showReports = viewName === "reports";
    const showAccounts = viewName === "accounts";

    if (homeView) homeView.hidden = !showHome;
    if (reportsView) reportsView.hidden = !showReports;
    if (accountsView) accountsView.hidden = !showAccounts;
    if (title) title.textContent = showReports ? "گزارشات" : showAccounts ? "حساب‌ها" : "مدیریت هزینه";

    document.querySelectorAll('.bottom-nav-item[data-nav]').forEach(item => {
        item.classList.toggle("active", item.dataset.nav === viewName);
    });

    if (showReports) {
        initializeReportJalaliDatePicker();
        bindReportJalaliDatePickerInputs();
        loadReports();
        loadReportSchedules();
    } else if (showAccounts) {
        loadAccounts();
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
    bindReportScheduleControls();
}




/* =====================================================
   SMART SPENDING INSIGHTS
===================================================== */

async function loadSpendingInsights() {
    const section = document.getElementById("spendingInsightsSection");
    const list = document.getElementById("spendingInsightsList");
    const periodElement = document.getElementById("spendingInsightsPeriod");

    if (!section || !list) return;

    if (!isNotificationsEnabled()) {
        section.hidden = true;
        return;
    }

    try {
        const response = await fetch("/api/expenses/insights", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || data.status !== "success") {
            throw new Error(data.message || "Spending insights API error");
        }

        if (!data.active || !Array.isArray(data.insights) || data.insights.length === 0) {
            section.hidden = true;
            return;
        }

        const dismissalKey = `expense_app_spending_insights_dismissed_${data.period_key || "current"}`;
        if (localStorage.getItem(dismissalKey) === "true") {
            section.hidden = true;
            return;
        }

        if (periodElement) {
            const day = toPersianDigits(data.current_day || "");
            const month = data.current_month_name || "ماه جاری";
            const previousMonth = data.previous_month_name || "ماه قبل";
            periodElement.textContent = `از ابتدای ${month} تا روز ${day}؛ مقایسه با همین بازه ${previousMonth}`;
        }

        list.innerHTML = data.insights.map((item) => {
            const icon = item.kind === "lunch"
                ? "🍽️"
                : categoryIcon(item.category_name || "سایر");
            const current = formatMoney(item.current_total || 0);
            const previous = formatMoney(item.previous_total || 0);
            const change = item.change_label
                ? item.change_label
                : (item.increase_percent === null || item.increase_percent === undefined
                    ? "افزایش نسبت به بازه بدون هزینه"
                    : `${toPersianDigits(item.increase_percent)}٪ افزایش`);

            return `
                <article class="spending-insight-item">
                    <div class="spending-insight-item-icon" aria-hidden="true">${escapeHtml(icon)}</div>
                    <div class="spending-insight-content">
                        <div class="spending-insight-title-row">
                            <strong>${escapeHtml(item.title || "هشدار هزینه")}</strong>
                            <span class="spending-insight-change">${escapeHtml(change)}</span>
                        </div>
                        <p>${escapeHtml(item.message || "هزینه این بخش نسبت به بازه مشابه ماه قبل افزایش یافته است.")}</p>
                        <div class="spending-insight-metrics">
                            <span>این ماه: <b>${escapeHtml(current)}</b></span>
                            <span>ماه قبل: <b>${escapeHtml(previous)}</b></span>
                        </div>
                    </div>
                </article>
            `;
        }).join("");

        let dismissButton = section.querySelector("[data-dismiss-spending-insights]");
        if (!dismissButton) {
            dismissButton = document.createElement("button");
            dismissButton.type = "button";
            dismissButton.className = "spending-insights-dismiss";
            dismissButton.setAttribute("data-dismiss-spending-insights", "true");
            dismissButton.setAttribute("aria-label", "بستن هشدارهای هزینه");
            dismissButton.textContent = "×";
            const header = section.querySelector(".spending-insights-header");
            if (header) header.appendChild(dismissButton);
        }

        dismissButton.onclick = () => {
            localStorage.setItem(dismissalKey, "true");
            section.hidden = true;
        };

        section.hidden = false;
    } catch (error) {
        console.error("loadSpendingInsights ERROR:", error);
        section.hidden = true;
    }
}


async function loadUsageLevel() {
    const badge = document.getElementById("usageLevelBadge");
    if (!badge) return;
    try {
        const response = await fetch("/api/auth/usage-level", { credentials: "same-origin", cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.status !== "success" || !data.usage) return;
        const usage = data.usage;
        const labels = { PLATINUM: "پلاتینیوم", GOLD: "طلایی", SILVER: "نقره‌ای", BRONZE: "برنز" };
        const label = labels[usage.level] || usage.label || "برنز";
        badge.className = `usage-level-badge ${String(usage.level || "BRONZE").toLowerCase()}`;
        badge.textContent = `سطح ${label}`;
        badge.title = `بر اساس ${toPersianDigits(usage.score || 0)} امتیاز فعالیت مالی؛ هزینه‌ها، واریزها، انتقال‌ها و حساب‌های فعال`;
        badge.setAttribute("aria-label", badge.title);
    } catch (error) {
        console.warn("loadUsageLevel could not load the profile:", error?.message || error);
    }
}


/* =====================================================
   REFRESH DASHBOARD
===================================================== */

async function refreshDashboard() {

    // The date label, today's total and recent-expense filter must share one clock.
    await syncApplicationDate();

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
        loadExpenses(),
        loadSpendingInsights(),
        loadAccounts()
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
    const modal = document.getElementById("settingsDetailModal");
    if (!modal) return;
    modal.classList.add("hidden");
    document.body.classList.remove("settings-modal-open");
    refreshSettingsMenuSummaries();
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
                refreshSettingsMenuSummaries();

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

                await refreshApplicationAfterSettingsChange();

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
   PWA DAILY WEB PUSH HELPERS
===================================================== */
function base64UrlToUint8Array(value) {
    const padding = "=".repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = window.atob(base64);
    return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

async function registerAppServiceWorker() {
    if (!("serviceWorker" in navigator)) throw new Error("این مرورگر از Service Worker پشتیبانی نمی‌کند.");
    if (!window.isSecureContext) throw new Error("اعلان PWA فقط در HTTPS یا localhost در دسترس است.");
    appServiceWorkerRegistration = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
    return await navigator.serviceWorker.ready;
}

async function notificationApiJson(url, options = {}) {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status === "error") throw new Error(data.detail || data.message || "درخواست اعلان ناموفق بود.");
    return data;
}

async function enableDailyPushNotifications(reminderTime) {
    if (!("Notification" in window) || !("PushManager" in window)) {
        throw new Error("این مرورگر از اعلان Push پشتیبانی نمی‌کند.");
    }
    if (!window.isSecureContext) throw new Error("ابتدا سایت را با HTTPS باز کن.");
    const permission = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
    if (permission !== "granted") throw new Error("اجازه اعلان در مرورگر داده نشد.");

    const config = await notificationApiJson("/api/notifications/config");
    if (!config.configured || !config.public_key) {
        throw new Error(config.message || "کلیدهای Web Push هنوز روی سرور تنظیم نشده‌اند.");
    }

    const registration = await registerAppServiceWorker();
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64UrlToUint8Array(config.public_key)
        });
    }
    const subscriptionJson = subscription.toJSON();
    if (!subscriptionJson.endpoint || !subscriptionJson.keys?.p256dh || !subscriptionJson.keys?.auth) {
        throw new Error("اطلاعات اشتراک Push از مرورگر ناقص دریافت شد.");
    }

    await notificationApiJson("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            endpoint: subscriptionJson.endpoint,
            keys: subscriptionJson.keys,
            reminder_time: reminderTime || "20:00",
            timezone: "Asia/Tehran"
        })
    });

    pushDailyReminderActive = true;
    setSetting(SETTINGS_KEYS.DAILY_REMINDER_TIME, reminderTime || "20:00");
    return true;
}

async function disableDailyPushNotifications() {
    // Disable server-side first so no future reminders are queued for this user.
    await notificationApiJson("/api/notifications/disable", { method: "POST" });
    if (!("serviceWorker" in navigator)) {
        pushDailyReminderActive = false;
        return;
    }
    const registration = appServiceWorkerRegistration || await navigator.serviceWorker.getRegistration("/");
    const subscription = registration ? await registration.pushManager.getSubscription() : null;
    if (subscription) await subscription.unsubscribe();
    pushDailyReminderActive = false;
}

/* =====================================================
   NOTIFICATION SETTINGS
===================================================== */

async function openNotificationSettings() {
    let pushStatus = { active: false, reminder_time: getSetting(SETTINGS_KEYS.DAILY_REMINDER_TIME, "20:00") };
    try {
        const response = await fetch("/api/notifications/status", { credentials: "same-origin", cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.status === "success") pushStatus = data;
    } catch (_) {}
    pushDailyReminderActive = Boolean(pushStatus.active);
    const enabled = isNotificationsEnabled();
    const reminderTime = getSetting(SETTINGS_KEYS.DAILY_REMINDER_TIME, pushStatus.reminder_time || "20:00");

    renderSettingsDetail(
        "اعلان‌ها",
        "هشدارهای هزینه و یادآوری روزانه",
        "🔔",
        `
            <div class="edit-form notification-settings-form">
                <label for="settingsNotifications">هشدارهای تحلیل هزینه داخل برنامه</label>
                <select id="settingsNotifications">
                    <option value="true" ${enabled ? "selected" : ""}>فعال</option>
                    <option value="false" ${!enabled ? "selected" : ""}>غیرفعال</option>
                </select>

                <label for="settingsDailyReminderTime">ساعت یادآوری روزانه</label>
                <select id="settingsDailyReminderTime">
                    <option value="08:00" ${reminderTime === "08:00" ? "selected" : ""}>۰۸:۰۰ صبح</option>
                    <option value="13:00" ${reminderTime === "13:00" ? "selected" : ""}>۱۳:۰۰</option>
                    <option value="20:00" ${reminderTime === "20:00" ? "selected" : ""}>۲۰:۰۰</option>
                    <option value="21:00" ${reminderTime === "21:00" ? "selected" : ""}>۲۱:۰۰</option>
                </select>

                <div id="dailyPushStatus" class="push-reminder-status" role="status">
                    ${pushStatus.active ? "یادآور روزانه روی این مرورگر فعال است." : "یادآور روزانه هنوز روی این مرورگر فعال نشده است."}
                </div>

                <button type="button" class="primary-button full-width" id="saveNotificationSettingsButton">ذخیره تنظیمات</button>
                <button type="button" class="primary-button full-width" id="enableDailyPushButton">فعال‌سازی اعلان روزانه</button>
                <button type="button" class="secondary-button full-width" id="disableDailyPushButton">غیرفعال‌سازی اعلان روزانه</button>
                <p class="settings-item-description push-reminder-note">برای ارسال اعلان وقتی برنامه بسته است، اجازه مرورگر و تنظیم VAPID و زمان‌بند روی سرور لازم است.</p>
            </div>
        `
    );

    document.getElementById("saveNotificationSettingsButton")?.addEventListener("click", async () => {
        const localEnabled = document.getElementById("settingsNotifications")?.value === "true";
        const time = document.getElementById("settingsDailyReminderTime")?.value || "20:00";
        setSetting(SETTINGS_KEYS.NOTIFICATIONS, localEnabled);
        setSetting(SETTINGS_KEYS.DAILY_REMINDER_TIME, time);
        try {
            if (pushDailyReminderActive) {
                const response = await fetch("/api/notifications/reminder-time", {
                    method: "POST", credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reminder_time: time })
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.detail || "ذخیره ساعت یادآوری ناموفق بود.");
            }
            await loadSpendingInsights();
            refreshSettingsMenuSummaries();
            showToast("تنظیمات اعلان ذخیره شد ✅");
        } catch (error) {
            showToast(error.message || "ذخیره تنظیمات ناموفق بود.");
        }
    });
    document.getElementById("enableDailyPushButton")?.addEventListener("click", async () => {
        const time = document.getElementById("settingsDailyReminderTime")?.value || "20:00";
        const status = document.getElementById("dailyPushStatus");
        try {
            if (status) status.textContent = "در حال فعال‌سازی اعلان روزانه...";
            await enableDailyPushNotifications(time);
            if (status) status.textContent = "یادآور روزانه فعال شد؛ در ساعت انتخاب‌شده اعلان ارسال می‌شود.";
            showToast("اعلان روزانه فعال شد ✅");
            refreshSettingsMenuSummaries();
        } catch (error) {
            if (status) status.textContent = error?.message || "فعال‌سازی اعلان روزانه ناموفق بود.";
            showToast(error?.message || "فعال‌سازی اعلان روزانه ناموفق بود.");
        }
    });
    document.getElementById("disableDailyPushButton")?.addEventListener("click", async () => {
        const status = document.getElementById("dailyPushStatus");
        try {
            await disableDailyPushNotifications();
            if (status) status.textContent = "یادآور روزانه غیرفعال شد.";
            showToast("اعلان روزانه غیرفعال شد.");
            refreshSettingsMenuSummaries();
        } catch (error) {
            if (status) status.textContent = error?.message || "غیرفعال‌سازی اعلان ناموفق بود.";
            showToast(error?.message || "غیرفعال‌سازی اعلان ناموفق بود.");
        }
    });
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
                refreshSettingsMenuSummaries();

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
   REFRESH SETTINGS MENU SUMMARIES
===================================================== */
function refreshSettingsMenuSummaries() {
    const setSummary = (key, value) => {
        const node = document.querySelector(`[data-setting="${key}"] .settings-item-description`);
        if (node) node.textContent = value;
    };
    setSummary("account", getDisplayName());
    setSummary("finance", `واحد نمایش: ${getCurrency() === "rial" ? "ریال" : "تومان"}`);
    setSummary("notifications", `${isNotificationsEnabled() ? "بینش هزینه: فعال" : "بینش هزینه: غیرفعال"} · یادآور روزانه: ${pushDailyReminderActive ? "فعال" : "غیرفعال"}`);
    setSummary("voice", isVoiceEnabled() ? "فعال" : "غیرفعال");
    const theme = getThemePreference();
    setSummary("theme", theme === "dark" ? "تاریک" : theme === "light" ? "روشن" : "سیستم");
    updateSettingsSubscriptionStatus();
}

async function refreshApplicationAfterSettingsChange() {
    refreshSettingsMenuSummaries();
    updateSubscriptionStatus();
    await refreshDashboard();
    const reportsView = document.getElementById("reportsView");
    if (reportsView && !reportsView.hidden) {
        await loadReports();
    }
    const accountsView = document.getElementById("accountsView");
    if (accountsView && !accountsView.hidden) {
        await loadAccounts();
    }
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

    refreshSettingsMenuSummaries();
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


            <div class="category-management-footer category-management-footer-actions">
                <button type="button" class="secondary-button" id="prepareExistingCategoryCatalogsButton">
                    ساخت فهرست اقلام دسته‌های قبلی
                </button>
                <button type="button" class="primary-button" id="addCategoryButton">
                    ➕ افزودن دسته‌بندی
                </button>
                <div id="categoryCatalogBackfillStatus" class="category-catalog-backfill-status" role="status" aria-live="polite"></div>
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

    document.getElementById("prepareExistingCategoryCatalogsButton")?.addEventListener(
        "click",
        prepareExistingCategoryCatalogs
    );
}

async function prepareExistingCategoryCatalogs() {
    const button = document.getElementById("prepareExistingCategoryCatalogsButton");
    const status = document.getElementById("categoryCatalogBackfillStatus");
    if (!button) return;
    button.disabled = true;
    button.textContent = "در حال آماده‌سازی...";
    if (status) status.textContent = "در حال بررسی دسته‌های قبلی...";
    try {
        const response = await fetch("/api/categories/prepare-existing-catalogs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin"
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.status !== "success") {
            throw new Error(data.message || data.detail || "آماده‌سازی دسته‌های قبلی انجام نشد.");
        }
        if (status) status.textContent = data.message || "آماده‌سازی آغاز شد.";
        const jobIds = Array.isArray(data.job_ids) ? data.job_ids : [];
        if (jobIds.length) {
            const jobs = await Promise.all(jobIds.map(id => waitForCategoryCatalogJob(id, 50)));
            const completed = jobs.filter(job => job.job_status === "COMPLETED").length;
            const failed = jobs.length - completed;
            const message = `آماده‌سازی تمام شد: ${formatNumber(completed)} موفق، ${formatNumber(failed)} ناموفق.`;
            if (status) status.textContent = message;
            showToast(message);
        } else {
            showToast(data.message || "همه دسته‌ها آماده هستند.");
        }
        await loadCategoryManagement();
    } catch (error) {
        console.error("prepareExistingCategoryCatalogs ERROR:", error);
        if (status) status.textContent = error.message || "خطا در آماده‌سازی دسته‌ها.";
        showToast(error.message || "آماده‌سازی دسته‌ها انجام نشد.");
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "ساخت فهرست اقلام دسته‌های قبلی";
        }
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

                    <div
                        id="categoryCatalogProgress"
                        class="category-catalog-progress hidden"
                        role="status"
                        aria-live="polite"
                    ></div>

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
   CATEGORY CATALOG BACKGROUND JOB POLLING
===================================================== */

async function waitForCategoryCatalogJob(jobId, maxAttempts = 50) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (attempt > 0) {
            await new Promise(resolve => setTimeout(resolve, 600));
        }

        try {
            const response = await fetch(
                `/api/categories/catalog-jobs/${encodeURIComponent(jobId)}?t=${Date.now()}`,
                { cache: "no-store" }
            );
            const data = await response.json();
            if (!response.ok || data.status !== "success" || !data.job) {
                return {
                    job_status: "ERROR",
                    message: data.message || "وضعیت آماده‌سازی قابل دریافت نیست."
                };
            }

            const job = data.job;
            if (["COMPLETED", "FAILED"].includes(job.job_status)) {
                return job;
            }
        } catch (error) {
            console.error("waitForCategoryCatalogJob:", error);
            return {
                job_status: "ERROR",
                message: "ارتباط با سرویس آماده‌سازی اقلام برقرار نشد."
            };
        }
    }

    return {
        job_status: "TIMEOUT",
        message: "آماده‌سازی بیشتر از حد معمول طول کشید؛ دسته ذخیره شده و می‌توانید آماده‌سازی را دوباره اجرا کنید."
    };
}


/* =====================================================
   SAVE CATEGORY
===================================================== */

async function saveCategory(
    isEdit
) {
    // Category setup is account configuration, not a billable expense-entry
    // operation. Keep it available even when the trial has expired.
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


        if (!isEdit && data.catalog_job_id) {
            const progress = document.getElementById("categoryCatalogProgress");
            if (progress) {
                progress.classList.remove("hidden");
                progress.innerHTML = `
                    <span class="category-catalog-spinner" aria-hidden="true"></span>
                    <span>دسته ذخیره شد؛ در حال آماده‌سازی اقلام مرتبط با «${escapeHtml(categoryName)}»...</span>
                `;
            }
            button.textContent = "در حال آماده‌سازی اقلام...";
            showToast("دسته ذخیره شد؛ فهرست اقلام در حال آماده‌سازی است.");

            const job = await waitForCategoryCatalogJob(data.catalog_job_id);

            closeCategoryForm();
            await loadCategoryManagement();
            await refreshDashboard();

            if (job.job_status === "COMPLETED") {
                if (job.catalog_kind === "GENERIC") {
                    showToast(`برای «${categoryName}» ${formatNumber(job.item_count)} قلم پایه آماده شد؛ فهرست تخصصی بعداً قابل تکمیل است.`);
                } else {
                    showToast(`فهرست ${formatNumber(job.item_count)} قلم پیشنهادی برای «${categoryName}» آماده شد ✅`);
                }
            } else {
                showToast(`دسته ذخیره شد، اما آماده‌سازی اقلام کامل نشد. ${job.message || job.error_message || "از گزینه آماده‌سازی مجدد استفاده کنید."}`);
            }
            return;
        }

        closeCategoryForm();
        await loadCategoryManagement();
        await refreshDashboard();

        if (!isEdit && data.catalog_status === "NOT_CONFIGURED") {
            showToast("دسته‌بندی ذخیره شد، اما جداول فهرست اقلام نصب نیستند؛ اسکریپت SQL را یک‌بار اجرا کنید.");
        } else {
            showToast(
                isEdit
                    ? "دسته‌بندی با موفقیت ویرایش شد ✅"
                    : "دسته‌بندی با موفقیت ایجاد شد ✅"
            );
        }


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

        // Category names are shared across accounts. All active users may add a
        // new shared category, while editing/deactivation/deletion stays owner-only.
        let isCategoryOwner = false;
        try {
            const meResponse = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
            const meData = await meResponse.json().catch(() => ({}));
            isCategoryOwner = Number(meData?.user?.user_id) === 1;
        } catch (_ignored) {
            isCategoryOwner = false;
        }
        const backfillButton = document.getElementById("prepareExistingCategoryCatalogsButton");
        if (backfillButton) backfillButton.hidden = !isCategoryOwner;


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


                    <div class="category-management-actions">
                        ${isCategoryOwner ? `
                            <button type="button" class="category-action-button category-edit-action" title="ویرایش">✏️</button>
                            <button type="button" class="category-action-button category-status-action" title="${isActive ? "غیرفعال کردن" : "فعال کردن"}">${isActive ? "🔴" : "🟢"}</button>
                            <button type="button" class="category-action-button category-delete-action" title="حذف">🗑️</button>
                        ` : ""}
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

function initializeExpenseApplication() {

        const logoutButton = document.getElementById("logoutButton");
        if (logoutButton) {
            logoutButton.addEventListener("click", async () => {
                logoutButton.disabled = true;
                try {
                    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
                } finally {
                    window.location.reload();
                }
            });
        }

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

                            if (nav === "accounts") {
                                showAppView("accounts");
                                return;
                            }
                        }
                    );
                }
            );

        initializeReportControls();

        const accountSelect = document.getElementById("confirmationAccount");
        if (accountSelect) accountSelect.addEventListener("change", syncConfirmationSubmitState);

        document.getElementById("createAccountFromConfirmation")?.addEventListener("click", () => {
            accountFormReturnToConfirmation = true;
            const confirmationModal = document.getElementById("confirmationModal");
            if (confirmationModal) confirmationModal.classList.add("hidden");
            showAppView("accounts");
            openAccountForm();
        });
        document.getElementById("increaseAccountFromConfirmation")?.addEventListener("click", () => {
            const selectedId = Number(document.getElementById("confirmationAccount")?.value || 0);
            const account = (currentAccounts || []).find(item => Number(item.account_id) === selectedId)
                || (currentAccounts || [])[0];
            if (!account) {
                showToast("ابتدا یک حساب ایجاد کنید.");
                return;
            }
            creditFormReturnToConfirmation = true;
            document.getElementById("confirmationModal")?.classList.add("hidden");
            openAccountCreditForm(account);
        });

        document.getElementById("addAccountButton")?.addEventListener("click", () => openAccountForm());
        document.getElementById("emptyAddAccountButton")?.addEventListener("click", () => openAccountForm());
        document.getElementById("saveAccountButton")?.addEventListener("click", saveAccount);
        document.getElementById("cancelAccountModalButton")?.addEventListener("click", closeAccountForm);
        document.getElementById("closeAccountModalButton")?.addEventListener("click", closeAccountForm);
        document.getElementById("closeAccountTransactionsButton")?.addEventListener("click", () => {
            document.getElementById("accountTransactionsModal")?.classList.add("hidden");
            currentAccountTransactionsId = null;
        });
        document.getElementById("saveAccountCreditButton")?.addEventListener("click", saveAccountCredit);
        document.getElementById("cancelAccountCreditModalButton")?.addEventListener("click", closeAccountCreditForm);
        document.getElementById("closeAccountCreditModalButton")?.addEventListener("click", closeAccountCreditForm);
        document.getElementById("openAccountTransferButton")?.addEventListener("click", openAccountTransferForm);
        document.getElementById("saveAccountTransferButton")?.addEventListener("click", saveAccountTransfer);
        document.getElementById("cancelAccountTransferModalButton")?.addEventListener("click", closeAccountTransferForm);
        document.getElementById("closeAccountTransferModalButton")?.addEventListener("click", closeAccountTransferForm);
        document.getElementById("accountTransferFromInput")?.addEventListener("change", syncAccountTransferBalanceHint);
        document.getElementById("accountTransferToInput")?.addEventListener("change", syncAccountTransferBalanceHint);
        document.getElementById("refreshAccountsButton")?.addEventListener("click", loadAccounts);
        document.getElementById("showInactiveAccounts")?.addEventListener("change", event => {
            includeInactiveAccounts = Boolean(event.target.checked);
            loadAccounts();
        });
        document.getElementById("accountsList")?.addEventListener("click", handleAccountListAction);
        document.getElementById("accountsList")?.addEventListener("click", event => {
            if (event.target.closest("#emptyAddAccountButton")) openAccountForm();
        });
        const formatMoneyTyping = event => {
            const input = event.target;
            const oldValue = input.value;
            const oldCursor = input.selectionStart;
            const cleaned = normalizeMoneyInput(oldValue);
            const formatted = cleaned && /^\d+$/.test(cleaned)
                ? toPersianDigits(cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, "٬"))
                : toPersianDigits(oldValue);
            if (input.value !== formatted) {
                input.value = formatted;
                if (oldCursor !== null && typeof input.setSelectionRange === "function") {
                    const cursor = Math.max(0, Math.min(formatted.length, oldCursor + formatted.length - oldValue.length));
                    input.setSelectionRange(cursor, cursor);
                }
            }
        };
        document.getElementById("accountInitialBalanceInput")?.addEventListener("input", formatMoneyTyping);
        document.getElementById("accountCreditAmountInput")?.addEventListener("input", formatMoneyTyping);
        document.getElementById("accountTransferAmountInput")?.addEventListener("input", formatMoneyTyping);
        document.getElementById("editAmount")?.addEventListener("input", formatMoneyTyping);
        document.getElementById("expenseText")?.addEventListener("input", event => {
            const input = event.target;
            const cursor = input.selectionStart;
            const localized = toPersianDigits(input.value);
            if (input.value !== localized) {
                input.value = localized;
                if (cursor !== null) input.setSelectionRange(cursor, cursor);
            }
        });


        /* =================================================
           INITIAL LOAD
        ================================================= */

        refreshDashboard();

}

/* =====================================================
   AUTHENTICATION BOOTSTRAP
===================================================== */
let authMode = "login";

function showAuthMessage(message) {
    const box = document.getElementById("authMessage");
    if (!box) return;
    box.textContent = message || "خطای نامشخص رخ داد.";
    box.hidden = false;
}

function setAuthMode(mode) {
    authMode = mode === "register" ? "register" : "login";
    const fullNameWrap = document.getElementById("authFullNameWrap");
    const loginTab = document.getElementById("authLoginTab");
    const registerTab = document.getElementById("authRegisterTab");
    const submit = document.getElementById("authSubmitButton");
    const password = document.getElementById("authPassword");
    const desc = document.getElementById("authDescription");
    const message = document.getElementById("authMessage");
    if (fullNameWrap) fullNameWrap.classList.toggle("hidden", authMode !== "register");
    const fullNameInput = document.getElementById("authFullName");
    if (fullNameInput) fullNameInput.required = authMode === "register";
    if (loginTab) {
        loginTab.classList.toggle("active", authMode === "login");
        loginTab.setAttribute("aria-selected", authMode === "login" ? "true" : "false");
    }
    if (registerTab) {
        registerTab.classList.toggle("active", authMode === "register");
        registerTab.setAttribute("aria-selected", authMode === "register" ? "true" : "false");
    }
    if (submit) submit.textContent = authMode === "register" ? "ساخت حساب کاربری" : "ورود به برنامه";
    if (password) password.autocomplete = authMode === "register" ? "new-password" : "current-password";
    if (desc) desc.textContent = authMode === "register"
        ? "حساب جدید بسازید تا اطلاعات مالی شما جداگانه ذخیره شود."
        : "برای دسترسی به هزینه‌ها و حساب‌های خود وارد شوید.";
    if (message) { message.hidden = true; message.textContent = ""; }
}

async function submitAuthForm(event) {
    event.preventDefault();
    const submit = document.getElementById("authSubmitButton");
    const username = document.getElementById("authUsername")?.value.trim() || "";
    const password = document.getElementById("authPassword")?.value || "";
    const message = document.getElementById("authMessage");
    if (message) { message.hidden = true; message.textContent = ""; }
    if (submit) { submit.disabled = true; submit.textContent = "در حال بررسی..."; }
    try {
        const response = await fetch(authMode === "register" ? "/api/auth/register" : "/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ username, password })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.status !== "success") {
            throw new Error(data.detail || data.message || "ورود یا ثبت‌نام انجام نشد.");
        }
        window.location.reload();
    } catch (error) {
        setAuthMode(authMode);
        showAuthMessage(error?.message || "ارتباط با سرور برقرار نشد.");
    } finally {
        if (submit) { submit.disabled = false; submit.textContent = authMode === "register" ? "ساخت حساب کاربری" : "ورود به برنامه"; }
    }
}

let authBootstrapped = false;
let authLossCheckInProgress = false;

function showTemporaryAuthError() {
    const gate = document.getElementById("authGate");
    const shell = document.querySelector(".app-shell");
    const title = document.getElementById("authTitle");
    const description = document.getElementById("authDescription");
    const tabs = document.querySelector(".auth-tabs");
    const form = document.getElementById("authForm");
    const note = document.querySelector(".auth-note");
    const message = document.getElementById("authMessage");
    const retry = document.getElementById("authRetryButton");
    if (gate) gate.hidden = false;
    if (shell) shell.classList.add("auth-pending");
    if (title) title.textContent = "ارتباط موقتاً برقرار نیست";
    if (description) description.textContent = "سرور برای بررسی نشست پاسخ نداد. این خطا به‌معنای خروج از حساب نیست؛ اتصال را بررسی کنید و دوباره تلاش کنید.";
    if (tabs) tabs.hidden = true;
    if (form) form.hidden = true;
    if (note) note.hidden = true;
    if (message) { message.hidden = true; message.textContent = ""; }
    if (retry) retry.hidden = false;
}

function showLoginGate(messageText = "") {
    const gate = document.getElementById("authGate");
    const shell = document.querySelector(".app-shell");
    const title = document.getElementById("authTitle");
    const description = document.getElementById("authDescription");
    const tabs = document.querySelector(".auth-tabs");
    const form = document.getElementById("authForm");
    const note = document.querySelector(".auth-note");
    const retry = document.getElementById("authRetryButton");
    if (gate) gate.hidden = false;
    if (shell) shell.classList.add("auth-pending");
    if (title) title.textContent = "مدیریت هزینه";
    if (description) description.textContent = "برای دسترسی به اطلاعات خود وارد حساب شوید.";
    if (tabs) tabs.hidden = false;
    if (form) form.hidden = false;
    if (note) note.hidden = false;
    if (retry) retry.hidden = true;
    setAuthMode("login");
    if (messageText) showAuthMessage(messageText);
}

async function bootstrapAuthentication() {
    registerAppServiceWorker().catch(error => console.info("PWA service worker not yet registered:", error?.message || error));
    const gate = document.getElementById("authGate");
    const shell = document.querySelector(".app-shell");
    if (!authBootstrapped) {
        document.getElementById("authLoginTab")?.addEventListener("click", () => setAuthMode("login"));
        document.getElementById("authRegisterTab")?.addEventListener("click", () => setAuthMode("register"));
        document.getElementById("authForm")?.addEventListener("submit", submitAuthForm);
        document.getElementById("authRetryButton")?.addEventListener("click", () => window.location.reload());
        authBootstrapped = true;
    }
    setAuthMode("login");

    let authResult = null;
    let lastFailure = null;
    // A temporary Oracle/IIS/network error must not masquerade as a logged-out user.
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await originalFetchForAuth("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
            const data = await response.json().catch(() => ({}));
            if (response.ok && typeof data.authenticated === "boolean") {
                authResult = data;
                break;
            }
            lastFailure = new Error(data.detail || `HTTP ${response.status}`);
            if (response.status >= 400 && response.status < 500 && response.status !== 429) break;
        } catch (error) {
            lastFailure = error;
        }
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 450 * (attempt + 1)));
    }

    if (!authResult) {
        console.warn("Authentication status could not be confirmed:", lastFailure?.message || lastFailure);
        showTemporaryAuthError();
        return;
    }

    if (authResult.authenticated === true) {
        currentAuthUser = authResult.user || null;
        serverTrialStatus = authResult.trial || { status: "expired", remainingDays: 0 };
        try { await loadSubscriptionStatus(); }
        catch (error) { console.warn("Subscription status was not loaded:", error?.message || error); }
        try {
            const pushResponse = await originalFetchForAuth("/api/notifications/status", { credentials: "same-origin", cache: "no-store" });
            const pushData = await pushResponse.json().catch(() => ({}));
            if (pushResponse.ok && pushData.status === "success") {
                pushDailyReminderActive = Boolean(pushData.active);
                if (pushData.reminder_time) setSetting(SETTINGS_KEYS.DAILY_REMINDER_TIME, pushData.reminder_time);
            }
        } catch (_) {}
        if (gate) gate.hidden = true;
        if (shell) shell.classList.remove("auth-pending");
        initializeExpenseApplication();
        showPaymentReturnNotice();
        return;
    }

    showLoginGate();
}

const originalFetchForAuth = window.fetch.bind(window);
window.fetch = async function(input, init) {
    const url = typeof input === "string" ? input : (input?.url || "");
    const isApi = url.includes("/api/");
    const requestInit = { ...(init || {}) };
    if (isApi) {
        if (!Object.prototype.hasOwnProperty.call(requestInit, "credentials")) requestInit.credentials = "same-origin";
        if (!Object.prototype.hasOwnProperty.call(requestInit, "cache")) requestInit.cache = "no-store";
    }
    const response = await originalFetchForAuth(input, requestInit);
    if (response.status === 401 && isApi && !url.includes("/api/auth/")) {
        if (!authLossCheckInProgress) {
            authLossCheckInProgress = true;
            try {
                const check = await originalFetchForAuth("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
                const data = await check.json().catch(() => ({}));
                if (check.ok && data.authenticated === false) {
                    showLoginGate("نشست ورود پایان یافته است؛ دوباره وارد شوید.");
                }
                // If auth status itself fails or is still authenticated, don't interrupt the user.
            } catch (_) {
                // A transient network error is not evidence that the user logged out.
            } finally {
                authLossCheckInProgress = false;
            }
        }
    }
    return response;
};

document.addEventListener("DOMContentLoaded", bootstrapAuthentication);
