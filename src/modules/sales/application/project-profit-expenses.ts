import type { Expense, ExpenseCategory, ExpenseShop } from "@/modules/expenses/contracts";
import type { ProfitExpense } from "../contracts";

export function projectProfitExpenses(
  expenses: readonly Expense[],
  shops: readonly ExpenseShop[],
  categories: readonly ExpenseCategory[],
): ProfitExpense[] {
  return expenses.map(({ id, month, scope, amount, name, note, shopId, categoryId }) => ({
    id, month, scope, amount, name, note,
    accountId: shops.find(shop => shop.id === shopId)?.loyverseAccountId || shopId,
    category: categories.find(category => category.id === categoryId)?.name || categoryId,
  }));
}
