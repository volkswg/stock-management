import "server-only";
import { PostgresRecords } from "@/infrastructure/persistence/postgres/records";
import { EXPENSE_HEADERS } from "@/modules/expenses/infrastructure/google-sheets/expenses/const";
import { CATEGORY_HEADERS } from "@/modules/expenses/infrastructure/google-sheets/expenses/const";
import { SHOP_HEADERS } from "@/modules/expenses/infrastructure/google-sheets/expenses/const";

export function expensesTables() {
  return {
    expenses: new PostgresRecords({ table: "expenses", headers: EXPENSE_HEADERS }),
    expenseCategories: new PostgresRecords({ table: "expense_categories", headers: CATEGORY_HEADERS }),
    shops: new PostgresRecords({ table: "shops", headers: SHOP_HEADERS }),
  };
}
