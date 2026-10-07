/* =====================================================
   GLOBAL VARIABLES
   ===================================================== */

let currentConfirmationId = null;
let currentEditExpenseId = null;
let currentDeleteExpenseId = null;

let categoryChart = null;


/* =====================================================
   FORMAT NUMBER
   ===================================================== */

function formatNumber(number) {

    if (number === null || number === undefined) {
        return "۰";
    }

    return Number(number).toLocaleString("fa-IR");
}


/* =====================================================
   FORMAT TOMAN
   ===================================================== */

function formatToman(amount) {

    return formatNumber(amount) + " تومان";
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

        "غذا": "🍔",
        "حمل و نقل": "🚕",
        "خودرو": "🚗",
        "خانه": "🏠",
        "خرید": "🛒",
        "درمان": "💊",
        "قبوض": "💡",
        "موبایل و اینترنت": "📱",
        "آموزش": "🎓",
        "پوشاک": "👕",
        "تفریح": "🎮",
        "سفر": "✈️",
        "سایر": "📦"

    };

    return icons[categoryName] || "📦";
}


/* =====================================================
   ESCAPE HTML
   ===================================================== */

function escapeHtml(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =====================================================
   TOAST
   ===================================================== */

let toastTimer = null;

function showToast(message) {

    const toast =
        document.getElementById("toast");

    if (!toast) {
        return;
    }

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {

        toast.classList.remove("show");

    }, 3000);
}


/* =====================================================
   TODAY GREGORIAN
   ===================================================== */

function getTodayGregorian() {

    const now = new Date();

    const year =
        now.getFullYear();

    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            now.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


/* =====================================================
   MONTH START
   ===================================================== */

function getMonthStartGregorian() {

    const now = new Date();

    const year =
        now.getFullYear();

    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");

    return `${year}-${month}-01`;
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
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    ).format(date);
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
            data.status !== "success"
        ) {

            throw new Error(
                data.message ||
                "خطا در دریافت هزینه امروز"
            );
        }

        todayTotal.textContent =
            formatToman(
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
            "۰ تومان";
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
            data.status !== "success"
        ) {

            throw new Error(
                data.message ||
                "خطا در دریافت خلاصه ماه"
            );
        }


        /* =================================================
           DATA
        ================================================= */

        const currentMonth =
            data.current_month || {};

        const previousMonth =
            data.previous_month || {};

        const comparison =
            data.comparison || {};


        const currentTotal =
            Number(
                currentMonth.total_amount || 0
            );


        const averageDaily =
            Number(
                currentMonth.average_daily || 0
            );


        const previousTotal =
            Number(
                previousMonth.total_amount || 0
            );


        const percentage =
            Number(
                comparison.percentage || 0
            );


        /* =================================================
           CURRENT MONTH TOTAL
        ================================================= */

        monthlyTotalElement.textContent =
            formatToman(
                currentTotal
            );


        /* =================================================
           DAILY AVERAGE
        ================================================= */

        monthlyAverageElement.textContent =
            formatToman(
                averageDaily
            );


        /* =================================================
           MONTH COMPARISON
        ================================================= */

        if (
            monthlyComparisonElement
        ) {

            if (
                previousTotal === 0
            ) {

                if (
                    currentTotal === 0
                ) {

                    monthlyComparisonElement.textContent =
                        "بدون هزینه";

                } else {

                    monthlyComparisonElement.textContent =
                        "ماه قبل هزینه‌ای ثبت نشده";
                }

                monthlyComparisonElement.className =
                    "comparison-value neutral";

            }

            else {

                const absolutePercentage =
                    Math.abs(
                        percentage
                    );


                const percentText =
                    toPersianDigits(
                        absolutePercentage
                    );


                if (
                    percentage > 0
                ) {

                    monthlyComparisonElement.textContent =
                        `↑ ${percentText}٪ بیشتر از ماه قبل`;

                    monthlyComparisonElement.className =
                        "comparison-value increase";
                }

                else if (
                    percentage < 0
                ) {

                    monthlyComparisonElement.textContent =
                        `↓ ${percentText}٪ کمتر از ماه قبل`;

                    monthlyComparisonElement.className =
                        "comparison-value decrease";
                }

                else {

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
            "۰ تومان";


        monthlyAverageElement.textContent =
            "۰ تومان";


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

/*
 * نکته:
 *
 * قبلاً این قسمت از:
 *
 * /api/expenses/summary/categories
 *
 * استفاده می‌کرد.
 *
 * ولی چون می‌خواهیم کارت‌های کوچک فقط ماه جاری را
 * نشان بدهند، از لیست هزینه‌های ماه جاری استفاده
 * می‌کنیم و دسته‌ها را همینجا محاسبه می‌کنیم.
 *
 * ظاهر کارت‌ها و HTML قبلی کاملاً حفظ شده است.
 */

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
            data.status !== "success"
        ) {

            throw new Error(
                data.message ||
                "خطا در دریافت هزینه‌های ماه جاری"
            );
        }


        const expenses =
            data.expenses || [];


        /*
         * ساخت آمار دسته‌بندی
         */

        const categoryMap = {};


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
                        expense.amount || 0
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
                            category.icon ||
                            categoryIcon(
                                categoryName
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


        /*
         * مجموع کل
         */

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


        /*
         * محاسبه درصد هر دسته
         */

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


        /*
         * مرتب‌سازی بر اساس مبلغ
         */

        categories.sort(
            (a, b) =>
                Number(
                    b.total_amount
                ) -
                Number(
                    a.total_amount
                )
        );


        /*
         * رسم نمودار
         */

        renderCategoryChart(
            categories
        );


        /*
         * اگر دسته‌بندی وجود نداشت
         */

        if (
            categories.length === 0
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


        container.innerHTML = "";


        /*
         * ساخت کارت دسته‌بندی‌ها
         */

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
                    formatToman(
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
                                ${escapeHtml(icon)}
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
                                        category.expense_count || 0
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
                                percentage.toFixed(1)
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


    if (categoryChart) {

        categoryChart.destroy();

        categoryChart = null;
    }


    if (
        !categories ||
        categories.length === 0
    ) {
        return;
    }


    if (
        typeof Chart === "undefined"
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

                type: "doughnut",


                data: {

                    labels: labels,

                    datasets: [

                        {
                            data: values,

                            borderWidth: 2
                        }

                    ]

                },


                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    cutout: "65%",


                    plugins: {

                        legend: {

                            position:
                                "bottom",

                            rtl: true,

                            labels: {

                                usePointStyle:
                                    true,

                                padding: 15,

                                font: {

                                    family:
                                        "Vazirmatn, Tahoma, Arial"
                                }

                            }

                        },


                        tooltip: {

                            rtl: true,

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
                                            formatToman(
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


    /*
     * فقط ماه جاری
     */

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
            data.status !== "success"
        ) {

            throw new Error(
                data.message ||
                "Expense API error"
            );
        }


        container.innerHTML = "";


        if (
            !data.expenses ||
            data.expenses.length === 0
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


        /*
         * هزینه‌های ماه جاری
         */

        data.expenses.forEach(
            expense => {

                const item =
                    document.createElement(
                        "div"
                    );

                item.className =
                    "expense-item";


                /*
                 * Category
                 */

                const category =
                    expense.category ||
                    {};


                const categoryName =
                    category.name ||
                    category.category_name ||
                    expense.category_name ||
                    "سایر";


                /*
                 * Description
                 */

                const description =
                    expense.description ||
                    "بدون توضیح";


                /*
                 * Amount
                 */

                const amount =
                    expense.amount ||
                    0;


                /*
                 * Date
                 */

                const expenseDate =
                    expense.expense_date ||
                    "";


                /*
                 * Expense ID
                 */

                const expenseId =
                    expense.expense_id;


                item.innerHTML = `

                    <div
                        class="expense-main"
                    >

                        <div
                            class="expense-icon"
                        >
                            ${categoryIcon(
                                categoryName
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
                            ${formatToman(
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


    button.disabled = true;

    button.textContent =
        "در حال بررسی...";


    try {

        const response =
            await fetch(
                "/api/expenses/text",
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        text: text
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

            input.value = "";

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

        button.disabled = false;

        button.textContent =
            "ثبت هزینه";
    }
}


/* =====================================================
   SHOW CONFIRMATION
   ===================================================== */

function showConfirmation(data) {

    currentConfirmationId =
        data.confirmation_id;


    const expense =
        data.expense || {};


    document.getElementById(
        "confirmationDescription"
    ).textContent =
        expense.description || "-";


    document.getElementById(
        "confirmationAmount"
    ).textContent =
        formatToman(
            expense.amount || 0
        );


    document.getElementById(
        "confirmationCategory"
    ).textContent =
        expense.category || "-";


    document.getElementById(
        "confirmationDate"
    ).textContent =
        toPersianDate(
            expense.expense_date
        );


    document
        .getElementById(
            "confirmationModal"
        )
        .classList.remove(
            "hidden"
        );
}


/* =====================================================
   CLOSE CONFIRMATION
   ===================================================== */

function closeConfirmation() {

    document
        .getElementById(
            "confirmationModal"
        )
        .classList.add(
            "hidden"
        );

    currentConfirmationId = null;
}


/* =====================================================
   CONFIRM EXPENSE
   ===================================================== */

async function confirmExpense() {

    if (!currentConfirmationId) {
        return;
    }


    const button =
        document.getElementById(
            "confirmExpenseButton"
        );


    button.disabled = true;

    button.textContent =
        "در حال ثبت...";


    try {

        const response =
            await fetch(
                "/api/expenses/confirm",
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

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

            document.getElementById(
                "expenseText"
            ).value = "";


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

        button.disabled = false;

        button.textContent =
            "تأیید و ثبت";
    }
}


/* =====================================================
   CANCEL EXPENSE
   ===================================================== */

async function cancelExpense() {

    if (!currentConfirmationId) {
        return;
    }


    try {

        await fetch(
            "/api/expenses/cancel",
            {

                method: "POST",

                headers: {

                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

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

function getExpenseCategoryId(expense) {

    /*
     * حالت 1:
     * expense.category.category_id
     */

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


    /*
     * حالت 2:
     * expense.category.id
     */

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


    /*
     * حالت 3:
     * expense.category_id
     */

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

    currentEditExpenseId =
        expenseId;


    try {

        /*
         * فقط هزینه‌های ماه جاری
         */

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


        /*
         * مبلغ
         */

        document.getElementById(
            "editAmount"
        ).value =
            expense.amount;


        /*
         * توضیحات
         */

        document.getElementById(
            "editDescription"
        ).value =
            expense.description;


        /*
         * تاریخ
         */

        document.getElementById(
            "editDate"
        ).value =
            expense.expense_date;


        /*
         * دسته‌بندی
         *
         * اینجا اصلاح اصلی انجام شده:
         * category.id
         * category.category_id
         * expense.category_id
         */

        const selectedCategoryId =
            getExpenseCategoryId(
                expense
            );


        console.log(
            "Selected Category ID:",
            selectedCategoryId
        );


        await loadEditCategories(
            selectedCategoryId
        );


        document
            .getElementById(
                "editExpenseModal"
            )
            .classList.remove(
                "hidden"
            );


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


                /*
                 * API دسته‌بندی ممکن است:
                 *
                 * category_id
                 * یا id
                 */

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


                if (
                    selectedCategoryId !==
                        null &&
                    selectedCategoryId !==
                        undefined &&
                    Number(
                        categoryId
                    ) ===
                        Number(
                            selectedCategoryId
                        )
                ) {

                    option.selected =
                        true;
                }


                select.appendChild(
                    option
                );
            }
        );


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

    document
        .getElementById(
            "editExpenseModal"
        )
        .classList.add(
            "hidden"
        );


    currentEditExpenseId =
        null;
}


/* =====================================================
   SAVE EDIT
   ===================================================== */

async function saveEditExpense() {

    if (!currentEditExpenseId) {
        return;
    }


    const amount =
        Number(
            document.getElementById(
                "editAmount"
            ).value
        );


    const description =
        document.getElementById(
            "editDescription"
        ).value.trim();


    const categoryId =
        document.getElementById(
            "editCategory"
        ).value;


    const expenseDate =
        document.getElementById(
            "editDate"
        ).value;


    if (!amount || amount <= 0) {

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


    button.disabled = true;

    button.textContent =
        "در حال ذخیره...";


    try {

        const response =
            await fetch(
                "/api/expenses/edit",
                {

                    method: "PUT",

                    headers: {

                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

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

        button.disabled = false;

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

    currentDeleteExpenseId =
        expenseId;


    try {

        /*
         * فقط ماه جاری
         */

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


        document.getElementById(
            "deleteExpenseDescription"
        ).textContent =
            expense.description;


        document.getElementById(
            "deleteExpenseAmount"
        ).textContent =
            formatToman(
                expense.amount
            );


        document
            .getElementById(
                "deleteExpenseModal"
            )
            .classList.remove(
                "hidden"
            );


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

    document
        .getElementById(
            "deleteExpenseModal"
        )
        .classList.add(
            "hidden"
        );


    currentDeleteExpenseId =
        null;
}


/* =====================================================
   DELETE EXPENSE
   ===================================================== */

async function deleteExpense() {

    if (!currentDeleteExpenseId) {
        return;
    }


    const button =
        document.getElementById(
            "confirmDeleteButton"
        );


    button.disabled = true;

    button.textContent =
        "در حال حذف...";


    try {

        const response =
            await fetch(
                "/api/expenses/delete",
                {

                    method: "DELETE",

                    headers: {

                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

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

        button.disabled = false;

        button.textContent =
            "حذف هزینه";
    }
}


/* =====================================================
   REFRESH DASHBOARD
   ===================================================== */

async function refreshDashboard() {

    loadTodayDate();

    await Promise.all([
        loadTodaySummary(),
        loadMonthlySummary(),
        loadCategories(),
        loadExpenses()
    ]);
}


/* =====================================================
   EVENTS
   ===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        /* =================================================
           ثبت هزینه
        ================================================= */

        const saveExpenseButton =
            document.getElementById(
                "saveExpenseButton"
            );

        if (saveExpenseButton) {

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

        if (expenseText) {

            expenseText.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key === "Enter"
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

        if (confirmExpenseButton) {

            confirmExpenseButton.addEventListener(
                "click",
                confirmExpense
            );
        }


        const cancelConfirmationButton =
            document.getElementById(
                "cancelConfirmationButton"
            );

        if (cancelConfirmationButton) {

            cancelConfirmationButton.addEventListener(
                "click",
                cancelExpense
            );
        }


        const closeModalButton =
            document.getElementById(
                "closeModalButton"
            );

        if (closeModalButton) {

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

        if (saveEditButton) {

            saveEditButton.addEventListener(
                "click",
                saveEditExpense
            );
        }


        const cancelEditButton =
            document.getElementById(
                "cancelEditButton"
            );

        if (cancelEditButton) {

            cancelEditButton.addEventListener(
                "click",
                closeEditExpense
            );
        }


        const closeEditModalButton =
            document.getElementById(
                "closeEditModalButton"
            );

        if (closeEditModalButton) {

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

        if (confirmDeleteButton) {

            confirmDeleteButton.addEventListener(
                "click",
                deleteExpense
            );
        }


        const cancelDeleteButton =
            document.getElementById(
                "cancelDeleteButton"
            );

        if (cancelDeleteButton) {

            cancelDeleteButton.addEventListener(
                "click",
                closeDeleteExpense
            );
        }


        const closeDeleteModalButton =
            document.getElementById(
                "closeDeleteModalButton"
            );

        if (closeDeleteModalButton) {

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

        if (refreshButton) {

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

        if (bottomAddButton) {

            bottomAddButton.addEventListener(
                "click",
                () => {

                    const input =
                        document.getElementById(
                            "expenseText"
                        );

                    if (input) {

                        input.focus();
                    }

                }
            );
        }


        /* =================================================
           Voice
        ================================================= */

        const voiceButton =
            document.getElementById(
                "voiceButton"
            );

        if (voiceButton) {

            voiceButton.addEventListener(
                "click",
                () => {

                    showToast(
                        "ثبت صوتی را در مرحله بعد فعال می‌کنیم 🎤"
                    );

                }
            );
        }


        /* =================================================
           Notification
        ================================================= */

        const notificationButton =
            document.getElementById(
                "notificationButton"
            );

        if (notificationButton) {

            notificationButton.addEventListener(
                "click",
                () => {

                    showToast(
                        "بخش اعلان‌ها به‌زودی فعال می‌شود 🔔"
                    );

                }
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

                            showToast(
                                "این بخش را در مرحله بعد می‌سازیم."
                            );

                        }
                    );

                }
            );


        /* =================================================
           INITIAL LOAD
        ================================================= */

        refreshDashboard();

    }
);