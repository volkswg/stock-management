export type Expense = {
  id: string;
  month: string;
  expenseDate: string;
  shopId: string;
  scope: "SHOP" | "SHARED";
  categoryId: string;
  name: string;
  amount: number;
  note: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  deletedAt: string;
  // Derived compatibility fields used by sales reports; not stored in expenses.
  accountId: string;
  category: string;
};
export type ExpenseCategory = { id: string; name: string; active: boolean; createdAt: string; updatedAt: string };
export type ExpenseShop = { id: string; name: string; active: boolean; loyverseAccountId: string; createdAt: string; updatedAt: string };
export type ExpenseInput = Pick<Expense, "month" | "expenseDate" | "shopId" | "scope" | "categoryId" | "name" | "amount" | "note"> & { id?: string; requestId?: string };
