
// =====================================================
// GLOBAL VARIABLES
// =====================================================

let currentConfirmationId = null;
let currentEditExpenseId = null;
let currentDeleteExpenseId = null;


// =====================================================
// FORMAT NUMBER
// =====================================================

function formatNumber(number) {

    if (number === null || number === undefined) {
        return "۰";
    }

    return Number(number).toLocaleString("fa-IR");
}


// =====================================================
// FORMAT TOMAN
// =====================================================

function formatToman(amount) {

    return formatNumber(amount) + " تومان";
}


// =====================================================
// CATEGORY ICON
// =====================================================

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

// =====================================================
// ESCAPE HTML
// =====================================================

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


// =====================================================
// TOAST
// =====================================================

let toastTimer = null;

function showToast(message) {

    const toast = document.getElementById("toast");

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {

        toast.classList.remove("show");

    }, 3000);
}


// =====================================================
// TODAY GREGORIAN
// =====================================================

function getTodayGregorian() {

    const now = new Date();

    const year = now.getFullYear();

    const month = String(now.getMonth() + 1).padStart(2, "0");

    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


// =====================================================
// MONTH START
// =====================================================

function getMonthStartGregorian() {

    const now = new Date();

    const year = now.getFullYear();

    const month = String(now.getMonth() + 1).padStart(2, "0");

    return `${year}-${month}-01`;
}


// =====================================================
// PERSIAN DATE
// =====================================================

function toPersianDate(dateString) {

    if (!dateString) {
        return "";
    }

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
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


// =====================================================
// LOAD TODAY DATE
// =====================================================

function loadTodayDate() {

    const element = document.getElementById("todayDate");

    element.textContent =
        "امروز " + toPersianDate(getTodayGregorian());
}


// =====================================================
// LOAD TODAY SUMMARY
// =====================================================

async function loadTodaySummary() {

    const todayTotal =
        document.getElementById("todayTotal");

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
                "HTTP " + response.status
            );
        }

        const data =
            await response.json();

        console.log(
            "Today Summary:",
            data
        );

        if (data.status !== "success") {

            throw new Error(
                data.message ||
                "خطا در دریافت هزینه امروز"
            );
        }

        todayTotal.textContent =
            formatToman(
                Number(data.total_amount || 0)
            );

    } catch (error) {

        console.error(
            "loadTodaySummary ERROR:",
            error
        );

        todayTotal.textContent =
            "0 تومان";
    }
}
// =====================================================
// LOAD MONTHLY SUMMARY
// =====================================================

async function loadMonthlySummary() {

    const monthlyTotalElement =
        document.getElementById("monthlyTotal");

    const monthlyAverageElement =
        document.getElementById("monthlyAverage");

    if (!monthlyTotalElement || !monthlyAverageElement) {
        return;
    }

    try {

        const monthStart =
            getMonthStartGregorian();

        const today =
            getTodayGregorian();

        const response =
            await fetch(
                `/api/expenses/?from_date=${monthStart}&to_date=${today}`
            );

        if (!response.ok) {

            throw new Error(
                "HTTP " + response.status
            );
        }

        const data =
            await response.json();

        console.log(
            "Monthly Summary Data:",
            data
        );

        /*
         * API ممکن است لیست هزینه‌ها را
         * مستقیماً یا داخل expenses برگرداند.
         */

        const expenses =
            data.expenses ||
            data.items ||
            data ||
            [];

        if (!Array.isArray(expenses)) {

            monthlyTotalElement.textContent =
                "0 تومان";

            monthlyAverageElement.textContent =
                "0 تومان";

            return;
        }

        let total = 0;

        expenses.forEach(expense => {

            total +=
                Number(
                    expense.amount || 0
                );

        });

        /*
         * تعداد روزهای گذشته ماه
         */

        const todayDate =
            new Date();

        const year =
            todayDate.getFullYear();

        const month =
            todayDate.getMonth();

        const day =
            todayDate.getDate();

        const daysPassed =
            day;

        const average =
            daysPassed > 0
                ? Math.round(total / daysPassed)
                : 0;

        monthlyTotalElement.textContent =
            formatToman(total);

        monthlyAverageElement.textContent =
            formatToman(average);

    } catch (error) {

        console.error(
            "loadMonthlySummary ERROR:",
            error
        );

        monthlyTotalElement.textContent =
            "0 تومان";

        monthlyAverageElement.textContent =
            "0 تومان";
    }
}

// =====================================================
// LOAD CATEGORIES
// =====================================================

async function loadCategories() {

    const container =
        document.getElementById("categoryList");

    container.innerHTML = `
        <div class="loading">
            در حال دریافت آمار...
        </div>
    `;

    try {

        const response =
            await fetch(
                "/api/expenses/summary/categories"
            );

        if (!response.ok) {
            throw new Error(
                "HTTP " + response.status
            );
        }

        const data =
            await response.json();

        console.log(
            "Category Summary:",
            data
        );

        if (data.status !== "success") {

            throw new Error(
                data.message ||
                "خطا در دریافت آمار دسته‌بندی‌ها"
            );
        }

        const categories =
            data.categories || [];

        if (categories.length === 0) {

            container.innerHTML = `
                <div class="empty-state">

                    <div class="empty-icon">
                        📊
                    </div>

                    <div>
                        هنوز هزینه‌ای ثبت نشده است.
                    </div>

                </div>
            `;

            return;
        }

        container.innerHTML = "";

        categories.forEach(category => {

            const item =
                document.createElement("div");

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
                    category.percentage || 0
                );

            item.innerHTML = `

                <div class="category-summary-header">

                    <div class="category-summary-title">

                        <div class="category-summary-icon">
                            ${escapeHtml(icon)}
                        </div>

                        <div>
                            <div class="category-summary-name">
                                ${escapeHtml(
                                    category.category_name
                                )}
                            </div>

                            <div class="category-summary-count">
                                ${category.expense_count}
                                هزینه
                            </div>
                        </div>

                    </div>

                    <div class="category-summary-amount">
                        ${amount}
                    </div>

                </div>

                <div class="category-progress">

                    <div
                        class="category-progress-bar"
                        style="width:${percentage}%"
                    ></div>

                </div>

                <div class="category-summary-footer">

                    <span>
                        ${percentage}٪
                    </span>

                    <span>
                        سهم از کل هزینه‌ها
                    </span>

                </div>

            `;

            container.appendChild(item);

        });

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
// =====================================================
// LOAD EXPENSES
// =====================================================

async function loadExpenses() {

    const container =
        document.getElementById("expenseList");

    container.innerHTML = `
        <div class="loading">
            در حال دریافت اطلاعات...
        </div>
    `;


    try {

        const response = await fetch(
            "/api/expenses/?to_date=" +
            getTodayGregorian()
        );

        const data =
            await response.json();


        if (
            !response.ok ||
            data.status !== "success"
        ) {

            throw new Error(
                data.message || "Expense API error"
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
                        امروز هنوز هزینه‌ای ثبت نشده است.
                    </div>

                </div>
            `;

            return;
        }


        data.expenses.forEach(expense => {

            const item =
                document.createElement("div");

            item.className =
                "expense-item";


            const category =
                expense.category || {};


            const categoryName =
                category.name ||
                category.category_name ||
                "سایر";


            const categoryId =
                category.id ||
                category.category_id ||
                null;


            const description =
                expense.description ||
                "بدون توضیح";


            const amount =
                expense.amount || 0;


            const expenseDate =
                expense.expense_date || "";


            item.innerHTML = `

                <div class="expense-main">

                    <div class="expense-icon">

                        ${categoryIcon(categoryName)}

                    </div>


                    <div class="expense-info">

                        <div class="expense-description">

                            ${escapeHtml(description)}

                        </div>


                        <div class="expense-meta">

                            <span>
                                ${escapeHtml(categoryName)}
                            </span>

                            <span>
                                ${toPersianDate(expenseDate)}
                            </span>

                        </div>

                    </div>

                </div>


                <div class="expense-right">

                    <div class="expense-amount">

                        ${formatToman(amount)}

                    </div>


                    <div class="expense-actions">

                        <button
                            type="button"
                            class="expense-edit-button"
                            title="ویرایش"
                            onclick="openEditExpense(${expense.expense_id})"
                        >
                            ✏️
                        </button>


                        <button
                            type="button"
                            class="expense-delete-button"
                            title="حذف"
                            onclick="openDeleteExpense(${expense.expense_id})"
                        >
                            🗑️
                        </button>

                    </div>

                </div>

            `;


            container.appendChild(item);

        });

    } catch (error) {

        console.error("loadExpenses:", error);

        container.innerHTML = `
            <div class="empty-state">
                خطا در دریافت هزینه‌ها
            </div>
        `;
    }
}


// =====================================================
// SUBMIT EXPENSE TEXT
// =====================================================

async function submitExpenseText() {

    const input =
        document.getElementById("expenseText");

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
                "خطا در ثبت هزینه"
            );

            return;
        }


        if (
            data.status ===
            "confirmation_required"
        ) {

            showConfirmation(data);

            return;
        }


        if (
            data.status === "success"
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

        console.error(error);

        showToast(
            "خطا در ارتباط با سرور"
        );

    } finally {

        button.disabled = false;

        button.textContent =
            "ثبت هزینه";
    }
}


// =====================================================
// SHOW CONFIRMATION
// =====================================================

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
        formatToman(expense.amount || 0);


    document.getElementById(
        "confirmationCategory"
    ).textContent =
        expense.category || "-";


    document.getElementById(
        "confirmationDate"
    ).textContent =
        toPersianDate(expense.expense_date);


    document
        .getElementById("confirmationModal")
        .classList.remove("hidden");
}


// =====================================================
// CLOSE CONFIRMATION
// =====================================================

function closeConfirmation() {

    document
        .getElementById("confirmationModal")
        .classList.add("hidden");

    currentConfirmationId = null;
}


// =====================================================
// CONFIRM EXPENSE
// =====================================================

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
            data.status === "success"
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

        console.error(error);

        showToast(
            "خطا در ثبت هزینه"
        );

    } finally {

        button.disabled = false;

        button.textContent =
            "تأیید و ثبت";
    }
}


// =====================================================
// CANCEL EXPENSE
// =====================================================

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

        console.error(error);
    }


    closeConfirmation();

    showToast(
        "ثبت هزینه لغو شد."
    );
}


// =====================================================
// OPEN EDIT EXPENSE
// =====================================================

async function openEditExpense(expenseId) {

    currentEditExpenseId =
        expenseId;


    try {

        const response =
            await fetch(
                "/api/expenses/?to_date=" +
                getTodayGregorian()
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            data.status !== "success"
        ) {

            showToast(
                "خطا در دریافت اطلاعات هزینه"
            );

            return;
        }


        const expense =
            data.expenses.find(
                item =>
                    Number(item.expense_id) ===
                    Number(expenseId)
            );


        if (!expense) {

            showToast(
                "هزینه موردنظر پیدا نشد."
            );

            return;
        }


        document.getElementById(
            "editAmount"
        ).value =
            expense.amount;


        document.getElementById(
            "editDescription"
        ).value =
            expense.description;


        document.getElementById(
            "editDate"
        ).value =
            expense.expense_date;


        const selectedCategoryId =
            expense.category
                ? (
                    expense.category.id ||
                    expense.category.category_id
                )
                : null;


        await loadEditCategories(
            selectedCategoryId
        );


        document
            .getElementById(
                "editExpenseModal"
            )
            .classList.remove("hidden");


    } catch (error) {

        console.error(error);

        showToast(
            "خطا در دریافت اطلاعات هزینه"
        );
    }
}


// =====================================================
// LOAD EDIT CATEGORIES
// =====================================================

async function loadEditCategories(
    selectedCategoryId = null
) {

    const select =
        document.getElementById(
            "editCategory"
        );


    try {

        const response =
            await fetch(
                "/api/categories/"
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            data.status !== "success"
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


                option.value =
                    category.category_id;


                option.textContent =
                    category.category_name;


                if (
                    selectedCategoryId &&
                    Number(
                        category.category_id
                    ) === Number(
                        selectedCategoryId
                    )
                ) {

                    option.selected = true;
                }


                select.appendChild(
                    option
                );
            }
        );


    } catch (error) {

        console.error(error);
    }
}


// =====================================================
// CLOSE EDIT
// =====================================================

function closeEditExpense() {

    document
        .getElementById(
            "editExpenseModal"
        )
        .classList.add("hidden");


    currentEditExpenseId = null;
}


// =====================================================
// SAVE EDIT
// =====================================================

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
                            Number(categoryId),

                        expense_date:
                            expenseDate

                    })
                }
            );


        const data =
            await response.json();


        if (
            data.status === "success"
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

        console.error(error);

        showToast(
            "خطا در ویرایش هزینه"
        );

    } finally {

        button.disabled = false;

        button.textContent =
            "ذخیره تغییرات";
    }
}


// =====================================================
// OPEN DELETE EXPENSE
// =====================================================

async function openDeleteExpense(
    expenseId
) {

    currentDeleteExpenseId =
        expenseId;


    try {

        const response =
            await fetch(
                "/api/expenses/?to_date=" +
                getTodayGregorian()
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            data.status !== "success"
        ) {

            showToast(
                "خطا در دریافت اطلاعات هزینه"
            );

            return;
        }


        const expense =
            data.expenses.find(
                item =>
                    Number(item.expense_id) ===
                    Number(expenseId)
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
            formatToman(expense.amount);


        document
            .getElementById(
                "deleteExpenseModal"
            )
            .classList.remove("hidden");


    } catch (error) {

        console.error(error);

        showToast(
            "خطا در دریافت اطلاعات هزینه"
        );
    }
}


// =====================================================
// CLOSE DELETE
// =====================================================

function closeDeleteExpense() {

    document
        .getElementById(
            "deleteExpenseModal"
        )
        .classList.add("hidden");


    currentDeleteExpenseId = null;
}


// =====================================================
// DELETE EXPENSE
// =====================================================

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
            data.status === "success"
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

        console.error(error);

        showToast(
            "خطا در حذف هزینه"
        );

    } finally {

        button.disabled = false;

        button.textContent =
            "حذف هزینه";
    }
}


// =====================================================
// REFRESH DASHBOARD
// =====================================================

async function refreshDashboard() {

    await loadTodayDate();

    await loadTodaySummary();

    await loadMonthlySummary();

    await loadCategories();

    await loadExpenses();
}

// =====================================================
// EVENTS
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        // ثبت هزینه
        document
            .getElementById(
                "saveExpenseButton"
            )
            .addEventListener(
                "click",
                submitExpenseText
            );


        // Enter
        document
            .getElementById(
                "expenseText"
            )
            .addEventListener(
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


        // Confirmation
        document
            .getElementById(
                "confirmExpenseButton"
            )
            .addEventListener(
                "click",
                confirmExpense
            );


        document
            .getElementById(
                "cancelConfirmationButton"
            )
            .addEventListener(
                "click",
                cancelExpense
            );


        document
            .getElementById(
                "closeModalButton"
            )
            .addEventListener(
                "click",
                cancelExpense
            );


        // Edit
        document
            .getElementById(
                "saveEditButton"
            )
            .addEventListener(
                "click",
                saveEditExpense
            );


        document
            .getElementById(
                "cancelEditButton"
            )
            .addEventListener(
                "click",
                closeEditExpense
            );


        document
            .getElementById(
                "closeEditModalButton"
            )
            .addEventListener(
                "click",
                closeEditExpense
            );


        // Delete
        document
            .getElementById(
                "confirmDeleteButton"
            )
            .addEventListener(
                "click",
                deleteExpense
            );


        document
            .getElementById(
                "cancelDeleteButton"
            )
            .addEventListener(
                "click",
                closeDeleteExpense
            );


        document
            .getElementById(
                "closeDeleteModalButton"
            )
            .addEventListener(
                "click",
                closeDeleteExpense
            );


        // Refresh
        document
            .getElementById(
                "refreshButton"
            )
            .addEventListener(
                "click",
                refreshDashboard
            );


        // Bottom Add
        document
            .getElementById(
                "bottomAddButton"
            )
            .addEventListener(
                "click",
                () => {

                    document
                        .getElementById(
                            "expenseText"
                        )
                        .focus();
                }
            );


        // Voice
        document
            .getElementById(
                "voiceButton"
            )
            .addEventListener(
                "click",
                () => {

                    showToast(
                        "ثبت صوتی را در مرحله بعد فعال می‌کنیم 🎤"
                    );
                }
            );


        // Notification
        document
            .getElementById(
                "notificationButton"
            )
            .addEventListener(
                "click",
                () => {

                    showToast(
                        "بخش اعلان‌ها به‌زودی فعال می‌شود 🔔"
                    );
                }
            );


        // Bottom Navigation
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


        // Initial Load
        refreshDashboard();

    }
);
