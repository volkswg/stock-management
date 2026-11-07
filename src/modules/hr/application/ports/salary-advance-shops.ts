import type { ExpenseShop } from "@/modules/expenses/contracts";

// Salary advance eligibility uses only shop identity and active state.
export interface SalaryAdvanceShops {
  listShops(): Promise<Pick<ExpenseShop, "id" | "active">[]>;
}
