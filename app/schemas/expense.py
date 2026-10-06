from pydantic import BaseModel
from datetime import date


class ExpenseCreate(BaseModel):
    amount: int
    description: str
    expense_date: date
    category_id: int | None = None
    account_id: int | None = None
    payment_method: str | None = None


class ExpenseEdit(BaseModel):
    expense_id: int
    amount: int
    description: str
    category_id: int | None = None
    expense_date: date


class ExpenseDelete(BaseModel):
    expense_id: int